/**
 * Waypoint Lodestar — demo scenario ("Every order, one thread.")
 * Team Adagard · Tech-Triathlon 2026
 *
 * Everything in this file is OUR story, not competition data: the people,
 * their devices, the plan versions, the hero orders, the Tue 7 Apr 2026 hero
 * trip (VEH057 → OUT106 Nuwara Eliya → OUT108 Hawa Eliya), its offline
 * blackout, the incidents and the notes. Reference tables (outlets,
 * vehicles, districts, calendar, allowances) come from DATA_DIR or the
 * synthetic generator; the scenario only overlays its own columns on them.
 *
 * applyScenario() is idempotent: every row has a deterministic id (or a
 * unique key) and is upserted, so re-running resets the demo to the story.
 */

import {
  Brand, DeferralReason, DeferralStatus, DeviceStatus, DockType, OrderStatus, ParkingType,
  PlanSource, PlanStatus, Prisma, Role, TempClass, TripStatus, VehicleStatus, VehicleType,
} from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Time helpers (the story is told in Sri Lanka time, UTC+05:30)
// ─────────────────────────────────────────────────────────────

/** "2026-04-07T06:33" in IST -> Date. */
export const ist = (local: string): Date => new Date(`${local}:00+05:30`);

export const SCENARIO_DAY = new Date('2026-04-07T00:00:00.000Z'); // Tue 7 Apr 2026 (run date)
export const PLAN_PUBLISHED_AT = ist('2026-04-06T18:40'); // Mon 6 Apr 6:40 PM IST = 13:10 UTC
export const SIGNAL_BACK_AT = ist('2026-04-07T08:40');
const ORDER_TIME = ist('2026-04-06T14:38'); // Fathima orders Mon 6 Apr 2:38 PM

// ─────────────────────────────────────────────────────────────
// People (ids are the fixed Keycloak subjects; credentials live in Keycloak)
// ─────────────────────────────────────────────────────────────

export const USER_IDS = {
  fathima: '8f1c2a10-0001-4c6e-9a01-000000000001',
  nilanthi: '8f1c2a10-0001-4c6e-9a01-000000000002',
  kasun: '8f1c2a10-0001-4c6e-9a01-000000000003',
  ruwan: '8f1c2a10-0001-4c6e-9a01-000000000004',
  admin: '8f1c2a10-0001-4c6e-9a01-000000000005',
} as const;

export type PersonKey = keyof typeof USER_IDS;

export interface Person {
  key: PersonKey;
  id: string;
  email: string;
  name: string;
  role: Role;
  depot: string | null;
  outletId: string | null;
  phone: string | null;
  /** a driver's vehicle: trips for it are assigned to them (vehicle_id claim) */
  vehicleId?: string | null;
  /** a loader's Dock sign-in ID (realm attribute staff_id, LD-06) */
  staffId?: string | null;
}

export const PEOPLE: Person[] = [
  { key: 'fathima', id: USER_IDS.fathima, email: 'fathima@waypoint.lk', name: 'Fathima Rizwan', role: Role.STORE_MANAGER, depot: 'KANDY', outletId: 'OUT106', phone: '+94774567890' },
  // Nilanthi covers both depots through her token claim; her home depot is Peliyagoda.
  { key: 'nilanthi', id: USER_IDS.nilanthi, email: 'nilanthi@waypoint.lk', name: 'Nilanthi Perera', role: Role.DISPATCHER, depot: 'PELIYAGODA', outletId: null, phone: '+94771234567' },
  { key: 'kasun', id: USER_IDS.kasun, email: 'kasun@waypoint.lk', name: 'Kasun Jayawardena', role: Role.LOADER, depot: 'KANDY', outletId: null, phone: '+94772345678', staffId: 'KDY-0427' },
  { key: 'ruwan', id: USER_IDS.ruwan, email: 'ruwan@waypoint.lk', name: 'Ruwan Bandara', role: Role.DRIVER, depot: 'KANDY', outletId: null, phone: '+94773456789', vehicleId: 'VEH057' },
  { key: 'admin', id: USER_IDS.admin, email: 'admin@waypoint.lk', name: 'Lodestar Admin', role: Role.ADMIN, depot: null, outletId: null, phone: null },
];

// The four persona phones are shared demo devices: their owner can sign in from any browser and that
// browser adopts the phone's id (no devtools step). Every other device enrolls normally (SM-32 → ADM-05).
export const DEVICES = [
  { id: 'DEV-RB-01', user: 'ruwan' as PersonKey, label: "Ruwan's Galaxy A14", platform: 'android', model: 'Galaxy A14', status: DeviceStatus.ACTIVE, sharedDemo: true, registeredAt: ist('2026-03-30T08:15'), lastSeenAt: SIGNAL_BACK_AT },
  { id: 'DEV-KJ-01', user: 'kasun' as PersonKey, label: "Kasun's Redmi Note 12", platform: 'android', model: 'Redmi Note 12', status: DeviceStatus.ACTIVE, sharedDemo: true, registeredAt: ist('2026-03-30T08:40'), lastSeenAt: ist('2026-04-07T03:40') },
  // Store and dispatch phones run the field app too (receipt count, live board), so they are bound as well.
  // Ids match the device_id user attributes in backend/identity/lodestar-realm.json.
  { id: 'DEV-FR-01', user: 'fathima' as PersonKey, label: "Fathima's Galaxy A34", platform: 'android', model: 'Galaxy A34', status: DeviceStatus.ACTIVE, sharedDemo: true, registeredAt: ist('2026-03-30T09:10'), lastSeenAt: ist('2026-04-07T07:05') },
  { id: 'DEV-NP-01', user: 'nilanthi' as PersonKey, label: "Nilanthi's iPhone 13", platform: 'ios', model: 'iPhone 13', status: DeviceStatus.ACTIVE, sharedDemo: true, registeredAt: ist('2026-03-30T09:25'), lastSeenAt: SIGNAL_BACK_AT },
];

// ─────────────────────────────────────────────────────────────
// Scenario anchors: minimum attributes the story needs.
// Used ONLY by the synthetic generator when these ids are missing;
// in CSV mode the dataset's own rows are kept and only overlays apply.
// ─────────────────────────────────────────────────────────────

const ANCHOR_TAG = 'synthetic'; // same tag as synthetic.ts (kept literal to avoid a circular import)

export const OUTLET_ANCHORS: Prisma.OutletCreateManyInput[] = [
  { id: 'OUT106', name: 'Waypoint Fresh Nuwara Eliya', brand: Brand.FRESH, district: 'Nuwara Eliya', depot: 'KANDY', dockType: DockType.REAR_DOCK, parking: ParkingType.NORMAL, windowOpen: '05:30', windowClose: '08:00', address: ANCHOR_TAG },
  { id: 'OUT108', name: 'Waypoint Fresh Hawa Eliya', brand: Brand.FRESH, district: 'Nuwara Eliya', depot: 'KANDY', dockType: DockType.REAR_DOCK, parking: ParkingType.NORMAL, windowOpen: '04:00', windowClose: '07:45', address: ANCHOR_TAG },
  { id: 'OUT027', name: 'Synthetic Fresh 027', brand: Brand.FRESH, district: 'Gampaha', depot: 'PELIYAGODA', dockType: DockType.STREET, parking: ParkingType.NORMAL, windowOpen: '04:30', windowClose: '08:30', address: ANCHOR_TAG },
  { id: 'OUT043', name: 'Synthetic Fresh 043', brand: Brand.FRESH, district: 'Kalutara', depot: 'PELIYAGODA', dockType: DockType.STREET, parking: ParkingType.NORMAL, windowOpen: '04:30', windowClose: '08:30', address: ANCHOR_TAG },
  { id: 'OUT028', name: 'Synthetic Fresh 028', brand: Brand.FRESH, district: 'Gampaha', depot: 'PELIYAGODA', dockType: DockType.STREET, parking: ParkingType.NORMAL, windowOpen: '04:30', windowClose: '08:30', address: ANCHOR_TAG },
  { id: 'OUT009', name: 'Synthetic Fresh 009', brand: Brand.FRESH, district: 'Colombo', depot: 'PELIYAGODA', dockType: DockType.REAR_DOCK, parking: ParkingType.NORMAL, windowOpen: '04:30', windowClose: '08:30', address: ANCHOR_TAG },
];

export const VEHICLE_ANCHORS: Prisma.VehicleCreateManyInput[] = [
  // The hero reefer van.
  { id: 'VEH057', depot: 'KANDY', type: VehicleType.VAN, tempClass: TempClass.CHILLED, capacityKg: 1040, capacityM3: 7.0, kmPerLitre: 10.3, weeklyLFuel: 450 },
  // Capacities below are synthetic placeholders.
  { id: 'VEH004', depot: 'PELIYAGODA', type: VehicleType.TRUCK, tempClass: TempClass.CHILLED, capacityKg: 5600, capacityM3: 28, kmPerLitre: 5.2, weeklyLFuel: 420 },
  { id: 'VEH021', depot: 'PELIYAGODA', type: VehicleType.TRUCK, tempClass: TempClass.AMBIENT, capacityKg: 4800, capacityM3: 26, kmPerLitre: 6.1, weeklyLFuel: 360 },
];

// ─────────────────────────────────────────────────────────────
// Overlays on reference rows (our columns only)
// ─────────────────────────────────────────────────────────────

export const OUTLET_OVERLAYS: Array<{ id: string; name?: string; accessNote: string }> = [
  { id: 'OUT106', name: 'Waypoint Fresh Nuwara Eliya', accessNote: 'Rear dock · normal access · enter via the Lawson St service lane; dock door opens 5:30' },
  { id: 'OUT108', name: 'Waypoint Fresh Hawa Eliya', accessNote: 'Rear dock · normal access' },
  { id: 'OUT009', accessNote: 'Rear dock · lorry often blocks morning access' },
  { id: 'OUT028', accessNote: 'Protected order: deferred yesterday, days_since 2' },
];

export const VEHICLE_OVERLAYS: Array<{ id: string; status: VehicleStatus; workshopNote: string | null; usedLThisWeek?: number }> = [
  // 298 L used before the hero trip; the trip adds ~17 L → 315 / 450 L.
  { id: 'VEH057', status: VehicleStatus.AVAILABLE, workshopNote: null, usedLThisWeek: 298 },
  // Which vehicles are in the workshop today is the demo day's (seed/demo-day.ts), not the April story's.
];

export const CALENDAR_NOTES: Array<{ date: Date; note: string }> = [
  { date: new Date('2026-04-06T00:00:00.000Z'), note: 'Plan published ~6:40 PM' },
  { date: new Date('2026-04-07T00:00:00.000Z'), note: 'HERO DAY: inter-monsoon rain + hill fog' },
];

// ─────────────────────────────────────────────────────────────
// Plans for Tue 7 Apr (PLG = Peliyagoda, PLK = Kandy)
// ─────────────────────────────────────────────────────────────

export const PLAN_IDS = {
  plgV1: 'PLG-2026-04-07-v1',
  plgV2: 'PLG-2026-04-07-v2',
  plgV3: 'PLG-2026-04-07-v3',
  plkV3: 'PLK-2026-04-07-v3',
} as const;

export const PLANS = [
  {
    id: PLAN_IDS.plgV1, depot: 'PELIYAGODA', version: 1, status: PlanStatus.SUPERSEDED, source: PlanSource.AUTOPLAN,
    createdBy: 'svc-planning', createdAt: ist('2026-04-06T16:05'),
    summary: { note: 'Drafted at cut-off, before the VEH004 workshop report' },
    explanation: 'Auto-plan at the 4:00 PM cut-off.',
  },
  {
    id: PLAN_IDS.plgV2, depot: 'PELIYAGODA', version: 2, status: PlanStatus.SUPERSEDED, source: PlanSource.MANUAL,
    createdBy: USER_IDS.nilanthi, createdAt: ist('2026-04-06T17:20'),
    summary: { chilledShortM3: 8.6, note: 'VEH004 reefer compressor failure; VEH021 gearbox' },
    explanation: 'Nilanthi removed VEH004 and VEH021 from the fleet for Tue 7 Apr.',
  },
  {
    id: PLAN_IDS.plgV3, depot: 'PELIYAGODA', version: 3, status: PlanStatus.PUBLISHED, source: PlanSource.AUTOPLAN,
    createdBy: 'svc-planning', createdAt: ist('2026-04-06T18:25'),
    approvedBy: USER_IDS.nilanthi, approvedAt: PLAN_PUBLISHED_AT, publishedAt: PLAN_PUBLISHED_AT,
    summary: { chilledShortM3: 8.6, note: 'VEH004 in workshop', deferred: ['ORD0104188', 'ORD0104195'], protected: ['ORD0104173'] },
    explanation: 'Re-planned without VEH004/VEH021; deferred the two lowest-scoring chilled orders; kept the protected Ja-Ela order.',
  },
  {
    id: PLAN_IDS.plkV3, depot: 'KANDY', version: 3, status: PlanStatus.PUBLISHED, source: PlanSource.AUTOPLAN,
    createdBy: 'svc-planning', createdAt: ist('2026-04-06T18:25'),
    approvedBy: USER_IDS.nilanthi, approvedAt: PLAN_PUBLISHED_AT, publishedAt: PLAN_PUBLISHED_AT,
    summary: { heroTrip: 'VEH057', note: 'Nuwara Eliya run: hill fog and rain expected' },
    explanation: 'Kandy hub plan; VEH057 runs OUT106 then OUT108.',
  },
];

// ─────────────────────────────────────────────────────────────
// Hero orders (placed Mon 6 Apr, run date Tue 7 Apr)
// ─────────────────────────────────────────────────────────────

type LineItem = { name: string; qty: number; kg: number; tempClass: TempClass };
export interface ScenarioOrder {
  id: string; outletId: string; orderedAt: Date; tempClass: TempClass;
  units: number; kg: number; m3: number; status: OrderStatus;
  deferredYesterday?: boolean; daysSince?: number; deferralScore?: number | null; notes?: string | null;
  lineItems?: LineItem[];
}

const A = TempClass.AMBIENT;
const C = TempClass.CHILLED;

export const ORDERS: ScenarioOrder[] = [
  {
    id: 'ORD0104216', outletId: 'OUT106', orderedAt: ORDER_TIME, tempClass: A, units: 58, kg: 452, m3: 2.2, status: OrderStatus.PLANNED,
    lineItems: [
      { name: 'Samba rice 5 kg', qty: 14, kg: 70, tempClass: A },
      { name: 'Soap bars', qty: 6, kg: 30, tempClass: A },
      { name: 'Red dhal', qty: 5, kg: 100, tempClass: A },
      { name: 'Coconut oil', qty: 6, kg: 66, tempClass: A },
      { name: 'Wheat flour', qty: 4, kg: 80, tempClass: A },
      { name: 'Sugar', qty: 2, kg: 40, tempClass: A },
      { name: 'Biscuits', qty: 10, kg: 36, tempClass: A },
      { name: 'Tea', qty: 5, kg: 15, tempClass: A },
      { name: 'Noodles', qty: 6, kg: 15, tempClass: A },
    ],
  },
  {
    id: 'ORD0104217', outletId: 'OUT106', orderedAt: ORDER_TIME, tempClass: C, units: 34, kg: 296, m3: 1.3, status: OrderStatus.PLANNED,
    notes: 'Shortfall: yoghurt 80g x24 — 2 of 6 cases short (stock), ack 3:24 AM',
    lineItems: [
      { name: 'Yoghurt 80g', qty: 6, kg: 36, tempClass: C },
      { name: 'Fresh milk', qty: 8, kg: 72, tempClass: C },
      { name: 'Whole chicken 1kg', qty: 6, kg: 60, tempClass: C },
      { name: 'Chicken sausages', qty: 4, kg: 40, tempClass: C },
      { name: 'Butter', qty: 3, kg: 18, tempClass: C },
      { name: 'Cheese slices', qty: 3, kg: 30, tempClass: C },
      { name: 'Flavoured milk', qty: 4, kg: 40, tempClass: C },
    ],
  },
  { id: 'ORD0104209', outletId: 'OUT108', orderedAt: ORDER_TIME, tempClass: C, units: 28, kg: 240, m3: 1.1, status: OrderStatus.PLANNED },
  // Suggested deferrals (confirmed by Nilanthi when she published v3).
  { id: 'ORD0104188', outletId: 'OUT027', orderedAt: ist('2026-04-06T12:30'), tempClass: C, units: 12, kg: 90, m3: 1.6, status: OrderStatus.DEFERRED, daysSince: 1, deferralScore: 22 },
  { id: 'ORD0104195', outletId: 'OUT043', orderedAt: ist('2026-04-06T13:00'), tempClass: C, units: 10, kg: 72, m3: 0.9, status: OrderStatus.DEFERRED, daysSince: 1, deferralScore: 27 },
  // Protected order: deferred yesterday, must deliver today.
  {
    id: 'ORD0104173', outletId: 'OUT028', orderedAt: ist('2026-04-05T14:30'), tempClass: C, units: 15, kg: 120, m3: 1.5, status: OrderStatus.PLANNED,
    deferredYesterday: true, daysSince: 2, deferralScore: 91,
    notes: 'PROTECTED: deferred_yesterday 1, days_since 2 — must deliver today',
  },
];

// ─────────────────────────────────────────────────────────────
// Hero trip: VEH057, Ruwan, Kandy hub, Fresh · Nuwara Eliya
// Departs 3:40 AM · signal lost 4:38 above Ramboda · back 8:40 near Pussellawa
// ─────────────────────────────────────────────────────────────

export const HERO_TRIP_ID = 'TRP-VEH057-20260407';
export const HERO_LOAD_RECORD_ID = 'LR-TRP-VEH057-20260407';

export const HERO_TRIP = {
  vehicleId: 'VEH057', depot: 'KANDY', runDate: SCENARIO_DAY, brand: Brand.FRESH, district: 'Nuwara Eliya',
  status: TripStatus.COMPLETE, planVersion: 3, planId: PLAN_IDS.plkV3, tripNumber: 1, bay: 'K2',
  sealNumber: 'KDY-57-10413', reeferTempC: 3.0, planMinutes: 196, actualMinutes: 241,
  departTime: ist('2026-04-07T03:40'), returnTime: ist('2026-04-07T09:32'),
};

type Pod = {
  unitsDelivered: number; unitsOrdered: number; receiverName: string; photoUrl: string;
  exceptions?: Prisma.InputJsonValue; creditNoteId?: string; savedOffline: boolean; savedAt: Date; syncedAt: Date;
};
export interface ScenarioStop {
  orderId: string; outletId: string; stopSeq: number;
  etaPlan: Date; etaModel: Date; etaModelBandEarly: Date; etaModelBandLate: Date;
  lateRiskPct: number; serviceMinPredicted: number; arrivalActual: Date; leaveActual: Date;
  status: OrderStatus; pod: Pod;
}

// Two orders at OUT106 → two stops with the same outlet and sequence.
const OUT106_TIMES = {
  etaPlan: ist('2026-04-07T05:31'),
  etaModel: ist('2026-04-07T06:35'), etaModelBandEarly: ist('2026-04-07T06:15'), etaModelBandLate: ist('2026-04-07T06:55'),
  lateRiskPct: 12, serviceMinPredicted: 29,
  arrivalActual: ist('2026-04-07T06:33'), leaveActual: ist('2026-04-07T07:02'),
};

export const HERO_STOPS: ScenarioStop[] = [
  {
    orderId: 'ORD0104216', outletId: 'OUT106', stopSeq: 1, ...OUT106_TIMES, status: OrderStatus.DELIVERED,
    pod: { unitsDelivered: 58, unitsOrdered: 58, receiverName: 'M. Ilyas', photoUrl: '/uploads/pod-ord0104216.jpg', savedOffline: false, savedAt: ist('2026-04-07T06:58'), syncedAt: SIGNAL_BACK_AT },
  },
  {
    orderId: 'ORD0104217', outletId: 'OUT106', stopSeq: 1, ...OUT106_TIMES, status: OrderStatus.DELIVERED,
    pod: {
      unitsDelivered: 31, unitsOrdered: 34, // 2 yoghurt short + 1 chicken damaged
      receiverName: 'M. Ilyas', photoUrl: '/uploads/pod-ord0104217.jpg',
      exceptions: [
        { type: 'SHORT', description: 'Yoghurt 80g: 2 of 6 cases not loaded (stock shortfall acknowledged 3:24 AM)', photoUrl: null },
        { type: 'DAMAGED', description: 'Whole chicken 1kg tray x1 — packaging damaged, photo taken 6:57 AM', photoUrl: '/uploads/dmg-ord0104217-chicken.jpg' },
      ],
      creditNoteId: 'CN-2604-0441',
      savedOffline: true, // saved above Ramboda, no signal
      savedAt: ist('2026-04-07T06:58'), syncedAt: SIGNAL_BACK_AT,
    },
  },
  {
    orderId: 'ORD0104209', outletId: 'OUT108', stopSeq: 2,
    etaPlan: ist('2026-04-07T06:21'),
    etaModel: ist('2026-04-07T07:25'), etaModelBandEarly: ist('2026-04-07T07:15'), etaModelBandLate: ist('2026-04-07T07:40'),
    lateRiskPct: 61, // 18% normally, 61% during the blackout; window closes 7:45
    serviceMinPredicted: 15,
    arrivalActual: ist('2026-04-07T07:26'), leaveActual: ist('2026-04-07T07:41'),
    status: OrderStatus.DELIVERED,
    pod: { unitsDelivered: 28, unitsOrdered: 28, receiverName: 'Store staff', photoUrl: '/uploads/pod-ord0104209.jpg', savedOffline: true, savedAt: ist('2026-04-07T07:27'), syncedAt: SIGNAL_BACK_AT },
  },
];

export const HERO_LOAD = {
  bay: 'K2', sealNumber: 'KDY-57-10413', reeferTempC: 3.0,
  loadedAt: ist('2026-04-07T03:34'), releasedAt: ist('2026-04-07T03:40'),
  shortfalls: [
    { item: 'Yoghurt 80g', qtyOrdered: 6, qtyLoaded: 4, reason: 'Stock shortfall — 2 cases unavailable at 3:21 AM, ack 3:24 AM' },
  ],
};

export interface ScenarioOfflineEvent {
  id: string; eventType: string; payload: Prisma.InputJsonValue; savedAt: Date;
  conflictResolved: boolean; conflictNote?: string;
}

export const HERO_OFFLINE_EVENTS: ScenarioOfflineEvent[] = [
  { id: 'OFE-VEH057-01', eventType: 'STATUS_CHANGE', payload: { status: 'SIGNAL_LOST', location: 'Above Ramboda', note: 'Coverage drops above Ramboda pass' }, savedAt: ist('2026-04-07T04:38'), conflictResolved: false },
  { id: 'OFE-VEH057-02', eventType: 'ARRIVAL', payload: { stopSeq: 1, outletId: 'OUT106', time: ist('2026-04-07T06:33').toISOString() }, savedAt: ist('2026-04-07T06:33'), conflictResolved: false },
  { id: 'OFE-VEH057-03', eventType: 'POD_SAVE', payload: { orderId: 'ORD0104216', units: 58, offline: true }, savedAt: ist('2026-04-07T06:58'), conflictResolved: false },
  { id: 'OFE-VEH057-04', eventType: 'POD_SAVE', payload: { orderId: 'ORD0104217', units: 31, offline: true, exceptions: ['SHORT:yoghurt', 'DAMAGED:chicken'] }, savedAt: ist('2026-04-07T06:58'), conflictResolved: true, conflictNote: 'Field evidence wins; correction applied to OUT108 provisional deferral' },
  { id: 'OFE-VEH057-05', eventType: 'ARRIVAL', payload: { stopSeq: 2, outletId: 'OUT108', time: ist('2026-04-07T07:26').toISOString() }, savedAt: ist('2026-04-07T07:26'), conflictResolved: true, conflictNote: 'Provisional deferral reversed; OUT108 confirmed delivered' },
  { id: 'OFE-VEH057-06', eventType: 'POD_SAVE', payload: { orderId: 'ORD0104209', units: 28, offline: true }, savedAt: ist('2026-04-07T07:27'), conflictResolved: false },
  { id: 'OFE-VEH057-07', eventType: 'STATUS_CHANGE', payload: { status: 'SIGNAL_BACK', location: 'Near Pussellawa (descent)', recordsQueued: 7 }, savedAt: SIGNAL_BACK_AT, conflictResolved: false },
];

// ─────────────────────────────────────────────────────────────
// Deferrals confirmed with plan PLG-2026-04-07-v3
// (OUT108's provisional blackout deferral was reversed after sync: no log.)
// ─────────────────────────────────────────────────────────────

export const DEFERRALS = [
  { id: 'DFL-ORD0104188', orderId: 'ORD0104188', reason: DeferralReason.CAP_REEFER, score: 22, notes: 'Chilled capacity short 8.6 m3 — auto-suggested, Nilanthi confirmed' },
  { id: 'DFL-ORD0104195', orderId: 'ORD0104195', reason: DeferralReason.CAP_REEFER, score: 27, notes: 'Chilled capacity short — Horana is a lower priority (days_since 1)' },
];
export const DEFERRAL_RESCHEDULED_TO = new Date('2026-04-08T00:00:00.000Z');

// ─────────────────────────────────────────────────────────────
// Writer
// ─────────────────────────────────────────────────────────────

/** Loose delegate shape; PrismaClient's delegates satisfy it. */
export interface ScenarioDelegate {
  upsert(args: any): Promise<any>;
  update(args: any): Promise<any>;
  create(args: any): Promise<any>;
  findUnique(args: any): Promise<any>;
  findFirst(args: any): Promise<any>;
  deleteMany(args: any): Promise<any>;
}

/** The PrismaClient surface applyScenario uses (mockable without a database). */
export interface ScenarioDb {
  user: ScenarioDelegate;
  device: ScenarioDelegate;
  outlet: ScenarioDelegate;
  vehicle: ScenarioDelegate;
  calendar: ScenarioDelegate;
  plan: ScenarioDelegate;
  order: ScenarioDelegate;
  orderLineItem: ScenarioDelegate;
  trip: ScenarioDelegate;
  tripStop: ScenarioDelegate;
  pOD: ScenarioDelegate;
  loadRecord: ScenarioDelegate;
  offlineEvent: ScenarioDelegate;
  deferralLog: ScenarioDelegate;
}

export interface ScenarioSummary {
  users: number;
  usersMigrated: string[];
  usersKeptLegacyId: string[];
  devices: number;
  plans: number;
  orders: number;
  lineItems: number;
  heroTripId: string;
  stops: number;
  offlineEvents: number;
  deferrals: number;
  calendarNotesCreated: string[];
  missingOverlayTargets: string[];
}

type Log = (msg: string) => void;

/**
 * Upsert one person. User.id must equal the Keycloak subject.
 * - Row with the fixed id exists → refresh it.
 * - Legacy row with the same email but another id (old cuid seed) → move it to the
 *   fixed id; foreign keys are ON UPDATE CASCADE, so trips/loads/devices follow.
 *   If that fails, keep the legacy id and warn (sign-in will not match that user).
 * - Otherwise create with the fixed id.
 * passwordHash is always cleared: credentials live in Keycloak.
 * Returns the id actually stored.
 */
async function upsertPerson(db: ScenarioDb, p: Person, log: Log, s: ScenarioSummary): Promise<string> {
  const data = { email: p.email, name: p.name, role: p.role, depot: p.depot, outletId: p.outletId, phone: p.phone, vehicleId: p.vehicleId ?? null, staffId: p.staffId ?? null, isActive: true, passwordHash: null };
  if (await db.user.findUnique({ where: { id: p.id } })) {
    await db.user.update({ where: { id: p.id }, data });
    return p.id;
  }
  const legacy = await db.user.findUnique({ where: { email: p.email } });
  if (legacy) {
    try {
      await db.user.update({ where: { email: p.email }, data: { ...data, id: p.id } });
      s.usersMigrated.push(p.email);
      return p.id;
    } catch (e) {
      log(`  ! ${p.email}: could not move legacy id ${legacy.id} → ${p.id} (${(e as Error).message}); keeping legacy id`);
      await db.user.update({ where: { email: p.email }, data });
      s.usersKeptLegacyId.push(p.email);
      return legacy.id;
    }
  }
  await db.user.create({ data: { id: p.id, ...data } });
  return p.id;
}

/** Apply the whole story. Safe to run repeatedly, in CSV or synthetic mode. */
export async function applyScenario(db: ScenarioDb, log: Log = console.log): Promise<ScenarioSummary> {
  const s: ScenarioSummary = {
    users: 0, usersMigrated: [], usersKeptLegacyId: [], devices: 0, plans: 0, orders: 0, lineItems: 0,
    heroTripId: '', stops: 0, offlineEvents: 0, deferrals: 0, calendarNotesCreated: [], missingOverlayTargets: [],
  };

  // 1. Overlays on reference rows (outlets must exist before Fathima links to OUT106).
  for (const o of OUTLET_OVERLAYS) {
    if (!(await db.outlet.findUnique({ where: { id: o.id } }))) { s.missingOverlayTargets.push(o.id); continue; }
    await db.outlet.update({ where: { id: o.id }, data: { accessNote: o.accessNote, ...(o.name ? { name: o.name } : {}) } });
  }
  for (const v of VEHICLE_OVERLAYS) {
    if (!(await db.vehicle.findUnique({ where: { id: v.id } }))) { s.missingOverlayTargets.push(v.id); continue; }
    await db.vehicle.update({
      where: { id: v.id },
      data: { status: v.status, workshopNote: v.workshopNote, ...(v.usedLThisWeek !== undefined ? { usedLThisWeek: v.usedLThisWeek, fuelWeekStart: new Date() } : {}) },
    });
  }
  for (const c of CALENDAR_NOTES) {
    if (await db.calendar.findUnique({ where: { date: c.date } })) {
      await db.calendar.update({ where: { date: c.date }, data: { note: c.note } });
    } else {
      // Not in the loaded calendar: add a minimal operating day carrying our note.
      await db.calendar.create({ data: { date: c.date, isOperating: true, note: c.note } });
      s.calendarNotesCreated.push(c.date.toISOString().slice(0, 10));
    }
  }
  if (s.missingOverlayTargets.length) log(`  ! scenario targets missing from reference data: ${s.missingOverlayTargets.join(', ')}`);

  // 2. People and their devices.
  const ids = {} as Record<PersonKey, string>;
  for (const p of PEOPLE) {
    ids[p.key] = await upsertPerson(db, p, log, s);
    s.users++;
  }
  for (const d of DEVICES) {
    const { user, ...rest } = d;
    const row = { ...rest, userId: ids[user], revokedAt: null, revokedBy: null, revokeReason: null };
    await db.device.upsert({ where: { id: d.id }, create: row, update: row });
    s.devices++;
  }

  // 3. Plan versions for Tue 7 Apr.
  for (const p of PLANS) {
    const row = {
      approvedBy: null, approvedAt: null, publishedAt: null, ...p,
      runDate: SCENARIO_DAY,
      // Plans reference Nilanthi by subject; follow her stored id if it is still legacy.
      ...(p.approvedBy ? { approvedBy: ids.nilanthi } : {}),
      ...(p.createdBy === USER_IDS.nilanthi ? { createdBy: ids.nilanthi } : {}),
    };
    await db.plan.upsert({ where: { id: p.id }, create: row, update: row });
    s.plans++;
  }

  // 4. Orders and line items (deterministic ids; legacy duplicates removed).
  for (const o of ORDERS) {
    const { lineItems = [], ...order } = o;
    const row = {
      deferredYesterday: false, daysSince: 0, deferralScore: null, notes: null,
      ...order, runDate: SCENARIO_DAY, brand: Brand.FRESH,
    };
    await db.order.upsert({ where: { id: o.id }, create: row, update: row });
    s.orders++;
    const itemIds = lineItems.map((_, i) => `OLI-${o.id}-${String(i + 1).padStart(2, '0')}`);
    await db.orderLineItem.deleteMany({ where: { orderId: o.id, id: { notIn: itemIds } } });
    for (const [i, li] of lineItems.entries()) {
      const item = { ...li, orderId: o.id };
      await db.orderLineItem.upsert({ where: { id: itemIds[i] }, create: { id: itemIds[i], ...item }, update: item });
      s.lineItems++;
    }
  }

  // 5. Hero trip: found by (vehicle, run date) so a legacy row is reused, else created.
  const tripData = { ...HERO_TRIP, driverId: ids.ruwan };
  const existing = await db.trip.findFirst({ where: { vehicleId: HERO_TRIP.vehicleId, runDate: SCENARIO_DAY } });
  let tripId: string;
  if (existing) {
    tripId = existing.id;
    await db.trip.update({ where: { id: tripId }, data: tripData });
  } else {
    tripId = (await db.trip.create({ data: { id: HERO_TRIP_ID, ...tripData } })).id ?? HERO_TRIP_ID;
  }
  s.heroTripId = tripId;

  for (const st of HERO_STOPS) {
    const { pod, ...stop } = st;
    const row = { ...stop, tripId };
    const saved = await db.tripStop.upsert({ where: { orderId: st.orderId }, create: { id: `STP-${st.orderId}`, ...row }, update: row });
    const tripStopId = saved?.id ?? `STP-${st.orderId}`;
    const podRow = { exceptions: Prisma.DbNull, creditNoteId: null, ...pod, tripStopId };
    await db.pOD.upsert({ where: { tripStopId }, create: { id: `POD-${st.orderId}`, ...podRow }, update: podRow });
    s.stops++;
  }

  const load = { ...HERO_LOAD, tripId, vehicleId: HERO_TRIP.vehicleId, loaderId: ids.kasun };
  await db.loadRecord.upsert({ where: { tripId }, create: { id: HERO_LOAD_RECORD_ID, ...load }, update: load });

  // Offline events: remove legacy copies of the same events (old seed used random ids), then upsert.
  const eventIds = HERO_OFFLINE_EVENTS.map((e) => e.id);
  await db.offlineEvent.deleteMany({
    where: {
      tripId,
      id: { notIn: eventIds },
      eventType: { in: [...new Set(HERO_OFFLINE_EVENTS.map((e) => e.eventType))] },
      savedAt: { in: HERO_OFFLINE_EVENTS.map((e) => e.savedAt) },
    },
  });
  for (const e of HERO_OFFLINE_EVENTS) {
    const row = { conflictNote: null, ...e, driverId: ids.ruwan, tripId, syncedAt: SIGNAL_BACK_AT };
    const { id, ...update } = row;
    await db.offlineEvent.upsert({ where: { id }, create: row, update });
    s.offlineEvents++;
  }

  // 6. Deferral logs, confirmed with PLG v3.
  for (const d of DEFERRALS) {
    const row = {
      orderId: d.orderId, reason: d.reason, score: d.score, notes: d.notes,
      resolvedBy: ids.nilanthi, rescheduledDate: DEFERRAL_RESCHEDULED_TO, isProvisional: false,
      status: DeferralStatus.CONFIRMED, confirmedAt: PLAN_PUBLISHED_AT, planId: PLAN_IDS.plgV3,
    };
    await db.deferralLog.upsert({ where: { orderId: d.orderId }, create: { id: d.id, ...row }, update: row });
    s.deferrals++;
  }

  return s;
}
