import { executePlan } from './plan-execution';

/** The few Prisma operations plan execution uses, over plain arrays. */
function store(seed: { orders: any[]; trips?: any[]; users?: any[]; calendar?: any[]; deferrals?: any[] }) {
  const db = {
    orders: seed.orders.map(o => ({ status: 'RECEIVED', daysSince: 0, deferredYesterday: false, ...o })),
    trips: (seed.trips ?? []) as any[],
    stops: [] as any[],
    deferrals: (seed.deferrals ?? []) as any[],
    users: seed.users ?? [],
    calendar: seed.calendar ?? [],
    writes: 0,
  };
  for (const t of db.trips) for (const s of t.stops ?? []) db.stops.push({ ...s, tripId: t.id });
  const ids = (w: any) => (w?.in ?? [w]) as string[];
  const tx: any = {
    trip: {
      findMany: async ({ where }: any) =>
        db.trips.filter(t => t.depot === where.depot && +t.runDate === +where.runDate)
          .map(t => ({ id: t.id, status: t.status, loadRecord: t.loadRecord ?? null, stops: db.stops.filter(s => s.tripId === t.id).map(s => ({ orderId: s.orderId })) })),
      deleteMany: async ({ where }: any) => { db.trips = db.trips.filter(t => !ids(where.id).includes(t.id)); },
      create: async ({ data }: any) => {
        if (db.trips.some(t => t.id === data.id)) throw new Error(`duplicate trip ${data.id}`);
        const { stops, ...trip } = data;
        db.trips.push(trip);
        for (const s of stops.create) {
          if (db.stops.some(x => x.orderId === s.orderId)) throw new Error(`order ${s.orderId} already has a stop`);
          db.stops.push({ ...s, tripId: data.id });
        }
      },
    },
    tripStop: { deleteMany: async ({ where }: any) => { db.stops = db.stops.filter(s => !ids(where.tripId).includes(s.tripId)); } },
    notification: { updateMany: async () => ({ count: 0 }) },
    offlineEvent: { updateMany: async () => ({ count: 0 }) },
    loadRecord: { deleteMany: async () => { throw new Error('a load record must never be deleted by re-planning'); } },
    user: { findMany: async ({ where }: any) => db.users.filter(u => u.role === where.role && ids(where.vehicleId).includes(u.vehicleId)) },
    order: {
      findMany: async ({ where }: any) =>
        db.orders.filter(o => ids(where.id).includes(o.id)).map(o => ({ ...o, deferralLog: db.deferrals.find(d => d.orderId === o.id) ?? null })),
      update: async ({ where, data }: any) => { db.writes++; return Object.assign(db.orders.find(o => o.id === where.id), data); },
      updateMany: async ({ where, data }: any) => { db.writes++; for (const o of db.orders.filter(x => ids(where.id).includes(x.id))) Object.assign(o, data); },
    },
    deferralLog: {
      update: async ({ where, data }: any) => Object.assign(db.deferrals.find(d => d.orderId === where.orderId), data),
      upsert: async ({ where, update, create }: any) => {
        const d = db.deferrals.find(x => x.orderId === where.orderId);
        if (d) Object.assign(d, update); else db.deferrals.push({ ...create });
      },
    },
    calendar: {
      findFirst: async ({ where }: any) =>
        db.calendar.filter(c => c.isOperating && +c.date > +where.date.gt).sort((a, b) => +a.date - +b.date)[0] ?? null,
    },
  };
  return { db, tx };
}

const RUN = new Date('2026-04-07T00:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ORDERS = [
  { id: 'O1', outletId: 'OUT106', runDate: RUN },
  { id: 'O2', outletId: 'OUT108', runDate: RUN },
  { id: 'O3', outletId: 'OUT106', runDate: RUN },
  { id: 'O4', outletId: 'OUT027', runDate: RUN, daysSince: 2 },
];
const plan = (version: number, trips: any[], deferrals: any[] = []) => ({
  id: `PLK-2026-04-07-v${version}`, depot: 'KANDY', runDate: RUN, version, status: 'NEEDS_APPROVAL',
  summary: { plan: { trips }, deferrals },
}) as any;
const trip = (vehicleId: string, tripNo: number, departs: string, stops: [string, string, string][]) => ({
  vehicleId, tripNo, brand: 'FRESH', district: 'Nuwara Eliya', departs, returns: '09:10', minutes: 340,
  orderIds: stops.map(s => s[0]),
  stops: stops.map(([orderId, outletId, arrive], i) => ({ seq: i + 1, orderId, outletId, arrive, etaModel: arrive, lateRiskPct: 12 })),
});
const CALENDAR = [
  { date: day('2026-04-08'), isOperating: false }, // holiday: deferrals skip it
  { date: day('2026-04-09'), isOperating: true },
];
const RUWAN = { id: 'ruwan', role: 'DRIVER', vehicleId: 'VEH057' };

describe('executePlan', () => {
  it('creates trips and stops with bays, the vehicle\'s driver and Colombo ETAs, and plans the served orders', async () => {
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR });
    const x = await executePlan(tx, plan(1, [
      trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35'], ['O3', 'OUT106', '06:35'], ['O2', 'OUT108', '07:25']]),
    ], [{ orderId: 'O4', reason: 'CAP_REEFER', score: 41 }]));

    expect(db.trips).toHaveLength(1);
    const t = db.trips[0];
    expect(t).toMatchObject({ id: 'TRP-VEH057-20260407-1', driverId: 'ruwan', bay: 'K1', status: 'PLANNED', planVersion: 1, planId: 'PLK-2026-04-07-v1' });
    expect(t.departTime.toISOString()).toBe('2026-04-06T22:00:00.000Z'); // 03:30 Colombo
    expect(db.stops.map(s => [s.orderId, s.stopSeq])).toEqual([['O1', 1], ['O3', 2], ['O2', 3]]);
    expect(db.stops[0].etaModel.toISOString()).toBe('2026-04-07T01:05:00.000Z'); // 06:35 Colombo
    expect(db.orders.filter(o => o.status === 'PLANNED').map(o => o.id)).toEqual(['O1', 'O2', 'O3']);
    expect(x.planned).toHaveLength(3);
  });

  it('plans the served orders in one write (each round trip counts on a remote database)', async () => {
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR });
    await executePlan(tx, plan(1, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35'], ['O3', 'OUT106', '06:35'], ['O2', 'OUT108', '07:25']])]));
    expect(db.writes).toBe(1);
    expect(db.orders.filter(o => o.status === 'PLANNED').map(o => o.id)).toEqual(['O1', 'O2', 'O3']);
  });

  it('records each deferral with its reason and rolls the order to the next operating day, where it is protected', async () => {
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR });
    const x = await executePlan(tx, plan(1, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35']])], [
      { orderId: 'O4', reason: 'CAP_REEFER', score: 41 },
      { orderId: 'O2', reason: 'NOT_A_CODE', score: 30 },
    ]));
    const o4 = db.orders.find(o => o.id === 'O4');
    expect(o4).toMatchObject({ status: 'DEFERRED', deferredYesterday: true, daysSince: 3 });
    expect(o4.runDate.toISOString()).toBe('2026-04-09T00:00:00.000Z'); // 8 Apr is not an operating day
    expect(db.deferrals.find(d => d.orderId === 'O4')).toMatchObject({ reason: 'CAP_REEFER', score: 41, status: 'CONFIRMED', planId: 'PLK-2026-04-07-v1' });
    expect(db.deferrals.find(d => d.orderId === 'O2')).toMatchObject({ reason: 'CAP_TIME' }); // unknown codes fall back
    expect(x.deferred.map(d => [d.orderId, d.rescheduledDate])).toEqual([['O4', '2026-04-09'], ['O2', '2026-04-09']]);
  });

  it('re-approving a new version replaces trips that have not started, without duplicating them', async () => {
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR });
    await executePlan(tx, plan(1, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35'], ['O2', 'OUT108', '07:25']])]));
    const x = await executePlan(tx, plan(2, [
      trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:40']]),
      trip('VEH058', 1, '04:00', [['O2', 'OUT108', '07:10'], ['O3', 'OUT106', '07:30']]),
    ]));
    expect(db.trips.map(t => [t.id, t.planVersion, t.bay])).toEqual([
      ['TRP-VEH057-20260407-1', 2, 'K1'],
      ['TRP-VEH058-20260407-1', 2, 'K2'],
    ]);
    expect(db.stops).toHaveLength(3);
    expect(x.supersededTrips).toBe(1);
  });

  it('leaves a trip that has started loading, and its orders, untouched', async () => {
    const started = { id: 'TRP-VEH057-20260407-1', depot: 'KANDY', runDate: RUN, status: 'LOADING', stops: [{ orderId: 'O1', outletId: 'OUT106', stopSeq: 1 }] };
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR, trips: [started] });
    const x = await executePlan(tx, plan(2, [
      trip('VEH058', 1, '04:00', [['O1', 'OUT106', '06:40'], ['O2', 'OUT108', '07:10']]),
    ], [{ orderId: 'O1', reason: 'CAP_TIME' }]));
    expect(db.trips.map(t => t.id)).toEqual(['TRP-VEH057-20260407-1', 'TRP-VEH058-20260407-1']);
    expect(db.stops.filter(s => s.tripId === 'TRP-VEH058-20260407-1').map(s => s.orderId)).toEqual(['O2']);
    expect(db.deferrals).toHaveLength(0);
    expect(x.locked).toEqual(['O1']);
  });

  it('treats a PLANNED trip that already has a load record (flags, ticks) as started: kept, its orders locked', async () => {
    // The field app flips PLANNED -> LOADING lazily and tolerates that failing, so the dock's work can sit on a PLANNED trip.
    const flagged = {
      id: 'TRP-VEH057-20260407-1', depot: 'KANDY', runDate: RUN, status: 'PLANNED', planVersion: 1,
      loadRecord: { tripId: 'TRP-VEH057-20260407-1', shortfalls: [{ orderId: 'O1', short: 2 }] },
      stops: [{ orderId: 'O1', outletId: 'OUT106', stopSeq: 1 }],
    };
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR, trips: [flagged] });
    const x = await executePlan(tx, plan(2, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:40'], ['O2', 'OUT108', '07:10']])]));
    expect(db.trips.map(t => [t.id, t.status, t.planVersion])).toEqual([
      ['TRP-VEH057-20260407-1', 'PLANNED', 1],
      ['TRP-VEH057-20260407-2', 'PLANNED', 2],
    ]);
    expect(db.trips[0].loadRecord).toBe(flagged.loadRecord);
    expect(db.stops.filter(s => s.tripId === 'TRP-VEH057-20260407-1').map(s => s.orderId)).toEqual(['O1']);
    expect(db.stops.filter(s => s.tripId === 'TRP-VEH057-20260407-2').map(s => s.orderId)).toEqual(['O2']);
    expect(x.locked).toEqual(['O1']);
    expect(x.supersededTrips).toBe(0);
  });

  it("gives a vehicle's new trip the next number when its trip of that number has left", async () => {
    const started = { id: 'TRP-VEH057-20260407-1', depot: 'KANDY', runDate: RUN, status: 'ENROUTE', stops: [{ orderId: 'O1', outletId: 'OUT106', stopSeq: 1 }] };
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR, trips: [started] });
    await executePlan(tx, plan(2, [trip('VEH057', 1, '09:30', [['O2', 'OUT108', '11:10']])]));
    expect(db.trips.map(t => [t.id, t.status])).toEqual([['TRP-VEH057-20260407-1', 'ENROUTE'], ['TRP-VEH057-20260407-2', 'PLANNED']]);
    expect(db.trips[1].tripNumber).toBe(2);
  });

  it('brings back an order an earlier version deferred when the new version places it', async () => {
    const { db, tx } = store({ orders: ORDERS, users: [RUWAN], calendar: CALENDAR });
    await executePlan(tx, plan(1, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35']])], [{ orderId: 'O4', reason: 'CAP_REEFER', score: 41 }]));
    await executePlan(tx, plan(2, [trip('VEH057', 1, '03:30', [['O1', 'OUT106', '06:35'], ['O4', 'OUT027', '07:50']])]));
    expect(db.orders.find(o => o.id === 'O4')).toMatchObject({ status: 'PLANNED', runDate: RUN, deferredYesterday: false, daysSince: 2 });
    expect(db.deferrals.find(d => d.orderId === 'O4')).toMatchObject({ status: 'REVERSED' });
  });

  it('refuses a plan with no trips (AUTOPLAN or seeded) with PlanNotExecutable', async () => {
    const { tx } = store({ orders: ORDERS });
    await expect(executePlan(tx, { ...plan(1, []), summary: { note: 'capacity only' } })).rejects.toMatchObject({ status: 409, code: 'PlanNotExecutable' });
  });

  it('refuses a plan that names an order that does not exist', async () => {
    const { tx } = store({ orders: ORDERS });
    await expect(executePlan(tx, plan(1, [trip('VEH057', 1, '03:30', [['NOPE', 'OUT106', '06:35']])]))).rejects.toMatchObject({ status: 409 });
  });
});
