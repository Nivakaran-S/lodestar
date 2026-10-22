// Lodestar Dock (loader) helpers: line ticks kept on the device per trip, the load order of a sheet,
// the day's flags (load-record shortfalls + unsent SHORTFALL writes) and their acknowledgements.
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { kv } from '@/lib/kv';
import { inList, lit, type ODataClient } from '@/lib/odata';
import { openScreen } from '@/lodestar/runtime';
import { notices, type Notice } from '@/realtime/notices';
import { Store, useStore } from '@/lib/store';
import { colomboDate, dayFilter, isoDay } from '@/lib/time';
import type { QueueItem } from '@/offline/queue';
import type { LoadSheet } from './api';
import { queue, session } from './platform';
import { useQuery } from './query';
import type { LoadRecord, Notification, OrderLineItem, Plan, Shortfall, Trip, TripStatus, TripStop, Vehicle } from './types';

// ---------------------------------------------------------------- line ticks (local, persisted)

/** tripId → (line id → ISO time ticked). Loaded lazily from the device store. */
const ticks = new Store<Record<string, Record<string, string>>>({});
const loading = new Set<string>();
const KEY = (tripId: string) => `lodestar.ticks.${tripId}`;

function ensure(tripId: string) {
  if (ticks.get()[tripId] || loading.has(tripId)) return;
  loading.add(tripId);
  void kv
    .get(KEY(tripId))
    .then(raw => {
      let saved: Record<string, string> = {};
      try {
        const v: unknown = raw ? JSON.parse(raw) : {};
        if (v && typeof v === 'object' && !Array.isArray(v)) saved = v as Record<string, string>;
      } catch {
        // a damaged entry starts empty
      }
      // keep ticks made before the load finished
      ticks.set(all => ({ ...all, [tripId]: { ...saved, ...(all[tripId] ?? {}) } }));
    })
    .catch(() => ticks.set(all => (all[tripId] ? all : { ...all, [tripId]: {} })))
    .finally(() => loading.delete(tripId));
}

function save(tripId: string, next: Record<string, string>) {
  ticks.set(all => ({ ...all, [tripId]: next }));
  void kv.set(KEY(tripId), JSON.stringify(next)).catch(() => undefined);
}

/**
 * The ticked ("loaded") lines of a trip; every change is saved on the device at once. The first tick also tells
 * the server the trip is being loaded (markLoading), unless `status` says it is already past PLANNED.
 */
export function useTicks(tripId: string | undefined, status?: TripStatus) {
  const all = useStore(ticks);
  useEffect(() => {
    if (tripId) ensure(tripId);
  }, [tripId]);
  const map = useMemo(() => (tripId ? (all[tripId] ?? {}) : {}), [all, tripId]);
  return useMemo(() => {
    const started = () => {
      if (tripId && (!status || status === 'PLANNED')) void markLoading(tripId).catch(() => undefined);
    };
    return {
      map,
      isTicked: (lineId: string) => !!map[lineId],
      toggle: (lineId: string) => {
        if (!tripId) return;
        const next = { ...map };
        if (next[lineId]) delete next[lineId];
        else {
          next[lineId] = new Date().toISOString();
          started();
        }
        save(tripId, next);
      },
      tick: (lineId: string) => {
        if (!tripId || map[lineId]) return;
        save(tripId, { ...map, [lineId]: new Date().toISOString() });
        started();
      },
    };
  }, [map, tripId, status]);
}

// ---------------------------------------------------------------- trip status (outbox)

/** A LOADING write for the trip is in the outbox (waiting, or already sent). */
export function loadingQueued(items: QueueItem[], tripId: string): boolean {
  return items.some(i => i.kind === 'TRIP_STATUS' && i.tripId === tripId && i.payload.status === 'LOADING' && i.status !== 'rejected');
}

/**
 * The dock started loading a trip (first tick, or a load record): Trips SetStatus LOADING through the outbox,
 * once per trip, so a re-plan treats the trip as started and does not drop a half-loaded vehicle.
 */
export async function markLoading(tripId: string, label?: string) {
  const sub = session.claims?.sub;
  if (!sub) return null;
  await queue.ready();
  // checked and queued as one step: the first tick, the load sheet's effect and a shortfall flag can all ask at once
  return queue.enqueueUnless(
    'TRIP_STATUS',
    { sub, tripId, ref: tripId, label: `Loading · ${label ?? tripId}`, payload: { tripId, status: 'LOADING' } },
    i => loadingQueued([i], tripId),
  );
}

/** A planned trip that already has a load record (flag, pre-cool) is being loaded: tell the server once. */
export function useMarkLoading(trip: Pick<Trip, 'id' | 'status' | 'vehicleId'> | null | undefined, started: boolean) {
  const id = trip?.id;
  const go = !!id && trip?.status === 'PLANNED' && started;
  const vehicle = trip?.vehicleId;
  useEffect(() => {
    if (go && id) void markLoading(id, vehicle).catch(() => undefined);
  }, [go, id, vehicle]);
}

/** Number of ticked lines over several trips (shift summaries). */
export function useTickCount(tripIds: string[]): number {
  const all = useStore(ticks);
  const keyList = tripIds.join(',');
  useEffect(() => {
    for (const id of keyList ? keyList.split(',') : []) ensure(id);
  }, [keyList]);
  return tripIds.reduce((n, id) => n + Object.keys(all[id] ?? {}).length, 0);
}

/** Ticked lines per trip (bay overview: each bay's progress). */
export function useTickCounts(tripIds: string[]): Record<string, number> {
  const all = useStore(ticks);
  const keyList = tripIds.join(',');
  useEffect(() => {
    for (const id of keyList ? keyList.split(',') : []) ensure(id);
  }, [keyList]);
  return Object.fromEntries(tripIds.map(id => [id, Object.keys(all[id] ?? {}).length]));
}

// ---------------------------------------------------------------- my bay (LD-07, kept on the device)

const BAY_KEY = 'lodestar.dock.bay';
const myBay = new Store<{ loaded: boolean; bay: string | null }>({ loaded: false, bay: null });
let bayLoading = false;

/** The bay this loader picked at shift start (LD-07, "change any time"); null until one is picked. */
export function useMyBay(): [string | null, (bay: string | null) => void] {
  const v = useStore(myBay);
  useEffect(() => {
    if (v.loaded || bayLoading) return;
    bayLoading = true;
    void kv
      .get(BAY_KEY)
      .then(raw => myBay.set(cur => (cur.loaded ? cur : { loaded: true, bay: raw || null })))
      .catch(() => myBay.set(cur => ({ ...cur, loaded: true })))
      .finally(() => (bayLoading = false));
  }, [v.loaded]);
  const set = (bay: string | null) => {
    myBay.set({ loaded: true, bay });
    void (bay ? kv.set(BAY_KEY, bay) : kv.set(BAY_KEY, '')).catch(() => undefined);
  };
  return [v.bay, set];
}

/** The next trip to load: the first planned or loading one at my bay, else the first on the dock. */
export function nextToLoad<T extends Pick<Trip, 'status' | 'bay'>>(trips: T[], bay: string | null): T | null {
  const open = trips.filter(t => t.status === 'PLANNED' || t.status === 'LOADING');
  return (bay ? open.find(t => t.bay === bay) : undefined) ?? open[0] ?? null;
}

// ---------------------------------------------------------------- load order

/** `ticked` counts the lines accounted for (ticked, or flagged short). */
export type LoadGroup = { stop: TripStop; lines: OrderLineItem[]; ticked: number; order: number };

/** Stops in loading order (last stop goes in first), each with its order lines. */
export function loadGroups(sheet: LoadSheet | undefined, done: (line: OrderLineItem) => boolean): LoadGroup[] {
  if (!sheet) return [];
  const stops = [...sheet.stops].sort((a, b) => b.stopSeq - a.stopSeq);
  return stops.map((stop, i) => {
    const lines = sheet.lines.filter(l => l.orderId === stop.orderId);
    return { stop, lines, ticked: lines.filter(done).length, order: i + 1 };
  });
}

/** 1st, 2nd, 3rd, 4th … */
export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export const tempLabel = (t?: string | null) => (t === 'CHILLED' ? 'Chilled' : t === 'AMBIENT' ? 'Ambient' : '');

/** The shortfall flagged for a line (by item name and, when known, order). */
export function shortfallFor(shortfalls: Shortfall[], line: Pick<OrderLineItem, 'name' | 'orderId'>): Shortfall | undefined {
  return shortfalls.find(s => s.item === line.name && (!s.orderId || s.orderId === line.orderId));
}

/** Reefer reading for a trip: the load record's, else the trip's. */
export function reeferOf(trip?: Trip | null, lr?: LoadRecord | null): number | undefined {
  const v = lr?.reeferTempC ?? trip?.reeferTempC;
  return typeof v === 'number' ? v : undefined;
}

// ---------------------------------------------------------------- flags

export type FlagRecord = LoadRecord & { trip?: Pick<Trip, 'id' | 'vehicleId' | 'district' | 'brand' | 'bay' | 'status' | 'runDate' | 'departTime'> };

/** The depot's load records (with their trip), newest first: every day, for the flags tab's history. */
export async function flagRecords(c: Pick<ODataClient, 'all'>): Promise<FlagRecord[]> {
  return c.all<FlagRecord>('LoadRecords', {
    expand: 'trip($select=id,vehicleId,district,brand,bay,status,runDate,departTime)',
    orderby: 'loadedAt desc',
    top: 200,
  });
}

export function useFlagRecords(day: string | undefined) {
  return useQuery(day ? `dock.flags.${day}` : null, c => flagRecords(c), { persist: true });
}

export type Flag = {
  key: string;
  tripId: string;
  vehicleId?: string;
  day: string;
  shortfall: Shortfall;
  loaderId?: string;
  /** still on this phone */
  unsent: boolean;
  ack?: Notification;
};

/** The SHORTFALL_ACK notice for a flag, if dispatch answered it. */
export function ackFor(notes: Notification[] | undefined, tripId: string, item: string): Notification | undefined {
  return (notes ?? []).find(n => {
    if (n.type !== 'SHORTFALL_ACK') return false;
    const p = n.payload ?? {};
    const trip = n.tripId ?? (typeof p.tripId === 'string' ? p.tripId : undefined);
    if (trip !== tripId) return false;
    return typeof p.item === 'string' ? p.item === item : true;
  });
}

/** Server shortfalls of the load records, replaced per trip by the newest unsent SHORTFALL write. */
export function collectFlags(records: FlagRecord[], items: QueueItem[], notes: Notification[] | undefined): Flag[] {
  const unsent = new Map<string, QueueItem>();
  for (const i of items) {
    if (i.kind === 'SHORTFALL' && i.tripId && (i.status === 'pending' || i.status === 'sending')) unsent.set(i.tripId, i);
  }
  const out: Flag[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    seen.add(r.tripId);
    const q = unsent.get(r.tripId);
    const list: Shortfall[] = q ? ((q.payload.shortfalls as Shortfall[]) ?? []) : (r.shortfalls ?? []);
    for (const s of list) {
      const sent = !q || (r.shortfalls ?? []).some(x => x.item === s.item && x.qtyLoaded === s.qtyLoaded);
      out.push({ key: `${r.tripId}.${s.item}`, tripId: r.tripId, vehicleId: r.vehicleId, day: isoDay(r.trip?.runDate) || isoDay(r.loadedAt), shortfall: s, loaderId: r.loaderId, unsent: !sent, ack: ackFor(notes, r.tripId, s.item) });
    }
  }
  for (const [tripId, q] of unsent) {
    if (seen.has(tripId)) continue;
    for (const s of (q.payload.shortfalls as Shortfall[]) ?? []) {
      out.push({ key: `${tripId}.${s.item}`, tripId, vehicleId: undefined, day: colomboDate(Date.parse(s.at ?? q.savedAt) || Date.now()), shortfall: s, loaderId: q.sub, unsent: true, ack: ackFor(notes, tripId, s.item) });
    }
  }
  return out.sort((a, b) => (b.shortfall.at ?? '').localeCompare(a.shortfall.at ?? ''));
}

// ---------------------------------------------------------------- shift, plans, re-plans

/** Order lines per trip (shift summary: "n of m lines"). */
export async function tripLineCounts(c: Pick<ODataClient, 'all'>, tripIds: string[]): Promise<Record<string, number>> {
  if (!tripIds.length) return {};
  const stops = await c.all<Pick<TripStop, 'id' | 'tripId' | 'orderId'>>('TripStops', { filter: inList('tripId', tripIds), select: ['id', 'tripId', 'orderId'] });
  const orderIds = [...new Set(stops.map(s => s.orderId))];
  const lines = orderIds.length ? await c.all<Pick<OrderLineItem, 'id' | 'orderId'>>('OrderLineItems', { filter: inList('orderId', orderIds), select: ['id', 'orderId'] }) : [];
  const perOrder = new Map<string, number>();
  for (const l of lines) perOrder.set(l.orderId, (perOrder.get(l.orderId) ?? 0) + 1);
  const out: Record<string, number> = {};
  for (const id of tripIds) out[id] = 0;
  for (const s of stops) out[s.tripId] = (out[s.tripId] ?? 0) + (perOrder.get(s.orderId) ?? 0);
  return out;
}

export function useTripLineCounts(tripIds: string[]) {
  const ids = [...tripIds].sort((a, b) => a.localeCompare(b)).join(',');
  return useQuery(ids ? `dock.lines.${ids}` : null, c => tripLineCounts(c, ids.split(',')), { persist: true });
}

/** Released: the server says so (release time or the trip left), or a release is waiting on this phone. */
export function isReleased(t: Pick<Trip, 'id' | 'status' | 'loadRecord'>, items: QueueItem[] = []): boolean {
  if (t.loadRecord?.releasedAt || t.status === 'ENROUTE' || t.status === 'COMPLETE') return true;
  return items.some(i => i.kind === 'RELEASE' && i.tripId === t.id && i.status !== 'rejected' && i.status !== 'conflict');
}

/** On time: released at or before the planned departure (undefined when either time is missing). */
export function onTime(t: Pick<Trip, 'departTime' | 'loadRecord'>): boolean | undefined {
  const rel = Date.parse(t.loadRecord?.releasedAt ?? '');
  const dep = Date.parse(t.departTime ?? '');
  if (!Number.isFinite(rel) || !Number.isFinite(dep)) return undefined;
  return rel <= dep;
}

/** A plan as the API returns it (publishedAt and approvedBy are not in the shared Plan type). */
export type PublishedPlan = Plan & { publishedAt?: string | null; approvedBy?: string | null };

/** The depot's latest published plan (of `date` when given). */
export async function latestPlan(c: Pick<ODataClient, 'list'>, depot: string, date?: string): Promise<PublishedPlan | null> {
  const f = [`depot eq ${lit(depot)}`, `status eq 'PUBLISHED'`, ...(date ? [dayFilter('runDate', date)] : [])].join(' and ');
  const r = await c.list<PublishedPlan>('Plans', { filter: f, orderby: 'publishedAt desc,createdAt desc', top: 1 });
  return r.value[0] ?? null;
}

export function useLatestPlan(depot: string | undefined, date: string | undefined) {
  return useQuery(depot && date ? `dock.plan.${depot}.${date}` : null, c => latestPlan(c, depot!, date), { persist: true });
}

/** Orders a plan left out (Plan.summary deferrals, else the plan's unassigned list); undefined when not recorded. */
export function deferredCount(plan?: Pick<Plan, 'summary'> | null): number | undefined {
  const s = (plan?.summary ?? null) as Record<string, any> | null;
  if (!s) return undefined;
  if (Array.isArray(s.deferrals)) return s.deferrals.length;
  if (Array.isArray(s.plan?.unassigned)) return s.plan.unassigned.length;
  return undefined;
}

export type RePlan = {
  plan: PublishedPlan | null; down: Vehicle[]; trips: Trip[]; stops: TripStop[];
  /** Orders the version before this one had on a vehicle now in the workshop: the lines the re-plan moved. */
  moved?: string[];
};

/** The version a re-plan replaced: the newest earlier version of the depot's day that was in effect (a rejected draft never was). */
export async function previousPlan(c: Pick<ODataClient, 'list'>, plan: Pick<Plan, 'depot' | 'runDate' | 'version'>): Promise<PublishedPlan | null> {
  if (plan.version <= 1) return null;
  const r = await c.list<PublishedPlan>('Plans', {
    filter: `depot eq ${lit(plan.depot)} and ${dayFilter('runDate', isoDay(plan.runDate))} and version lt ${plan.version} and status eq 'SUPERSEDED'`,
    orderby: 'version desc',
    top: 1,
  });
  return r.value[0] ?? null;
}

/** The orders `prev` (a plan's summary) had on the vehicles in `down`. */
export function movedOrders(prev: Pick<Plan, 'summary'> | null | undefined, down: Pick<Vehicle, 'id'>[]): string[] {
  const ids = new Set(down.map(v => v.id));
  const trips = ((prev?.summary as Record<string, any> | null)?.plan?.trips ?? []) as { vehicleId?: string; orderIds?: string[] }[];
  return trips.filter(t => t.vehicleId && ids.has(t.vehicleId)).flatMap(t => t.orderIds ?? []);
}

/** A re-plan for the dock: the plan (by id, else the depot's latest published), vehicles in the workshop, the plan's trips and stops. */
export async function rePlan(c: Pick<ODataClient, 'list' | 'all' | 'get'>, depot: string, planId?: string): Promise<RePlan> {
  const plan = planId ? await c.get<PublishedPlan>('Plans', planId).catch(() => null) : await latestPlan(c, depot);
  const [down, trips] = await Promise.all([
    c.all<Vehicle>('Vehicles', { filter: `depot eq ${lit(depot)} and status eq 'WORKSHOP'` }),
    plan ? c.all<Trip>('Trips', { filter: `planId eq ${lit(plan.id)}`, orderby: 'bay,departTime', expand: 'vehicle($select=id,type,tempClass)' }) : Promise.resolve([] as Trip[]),
  ]);
  const stops = trips.length
    ? await c.all<TripStop>('TripStops', { filter: inList('tripId', trips.map(t => t.id)), expand: 'order($select=id,m3)', orderby: 'tripId,stopSeq' })
    : [];
  const prev = plan && down.length ? await previousPlan(c, plan).catch(() => null) : null;
  // the vehicle the re-plan was for (it had trips in the version before) first
  const had = (v: Vehicle) => movedOrders(prev, [v]).length > 0;
  return { plan, down: [...down.filter(had), ...down.filter(v => !had(v))], trips, stops, moved: movedOrders(prev, down) };
}

export function useRePlan(depot: string | undefined, planId: string | undefined) {
  return useQuery(depot ? `dock.replan.${depot}.${planId ?? 'latest'}` : null, c => rePlan(c, depot!, planId), { persist: true });
}

/** "PLG-2026-04-07-v3" → 3 */
export const planVersionOf = (planId?: string) => {
  const m = /-v(\d+)$/.exec(planId ?? '');
  return m ? Number(m[1]) : undefined;
};

/** A plan_published notice that replaces an earlier plan (a first plan of the day is not a re-plan). */
export function isRePlanNotice(n: Notice, depot: string | undefined): boolean {
  if (n.event !== 'plan_published' || !depot || n.payload.depot !== depot || typeof n.payload.planId !== 'string') return false;
  if (typeof n.payload.supersededTrips === 'number') return n.payload.supersededTrips > 0 || (planVersionOf(n.payload.planId) ?? 1) > 1;
  return (planVersionOf(n.payload.planId) ?? 1) > 1;
}

/**
 * When dispatch publishes a re-plan for `depot` after the screen mounted: opens LD-14 (re-plan received), or what
 * `open` says (the load sheet opens "plan changed" for the trip being loaded).
 */
export function useRePlanAlert(depot: string | undefined, open?: (planId: string) => void) {
  const list = useStore(notices);
  // notices already here when the screen opened are not news
  const [seen] = useState(() => new Set(notices.get().map(n => n.id)));
  const go = useEffectEvent((planId: string) => (open ? open(planId) : openScreen('ld-14-re-plan-received', { plan: planId })));
  useEffect(() => {
    const fresh = list.filter(n => !seen.has(n.id));
    for (const n of fresh) seen.add(n.id);
    const hit = fresh.find(n => isRePlanNotice(n, depot));
    if (hit) go(String(hit.payload.planId));
  }, [list, depot, seen]);
}

/** A re-plan dispatch is working on for the trip's depot and day (a newer draft plan): the load sheet locks (LD-18). */
export async function openRePlan(c: Pick<ODataClient, 'list'>, trip: Pick<Trip, 'depot' | 'runDate' | 'planVersion'>): Promise<Plan | null> {
  const r = await c.list<Plan>('Plans', {
    filter: `depot eq ${lit(trip.depot)} and ${dayFilter('runDate', isoDay(trip.runDate))} and (status eq 'DRAFT' or status eq 'NEEDS_APPROVAL') and version gt ${trip.planVersion}`,
    orderby: 'createdAt desc',
    top: 1,
  });
  return r.value[0] ?? null;
}

export function useOpenRePlan(trip: Pick<Trip, 'id' | 'depot' | 'runDate' | 'planVersion' | 'status'> | null | undefined) {
  const active = !!trip && (trip.status === 'LOADING' || trip.status === 'ENROUTE');
  return useQuery(active ? `dock.locked.${trip!.id}.${trip!.planVersion}` : null, c => openRePlan(c, trip!));
}

export type PlanChange = {
  plan: PublishedPlan | null;
  before: Trip | null;
  after: Trip | null;
  /** Lines whose stop changed between the two versions (or that came on / went off this vehicle). */
  moved: { line: OrderLineItem; from: number | null; to: number | null; outletId: string }[];
  lines: number;
};

/** What changed for the vehicle of `tripId` in plan `planId`: its trip in the new plan and the order lines that moved. */
export async function planChange(c: Pick<ODataClient, 'list' | 'all' | 'get'>, tripId: string, planId?: string): Promise<PlanChange> {
  const before = await c.get<Trip>('Trips', tripId).catch(() => null);
  const plan = planId ? await c.get<PublishedPlan>('Plans', planId).catch(() => null) : null;
  const after = plan && before
    ? ((await c.all<Trip>('Trips', { filter: `planId eq ${lit(plan.id)} and vehicleId eq ${lit(before.vehicleId)}`, orderby: 'tripNumber', top: 1 }))[0] ?? before)
    : before;
  const ids = [...new Set([before?.id, after?.id].filter((x): x is string => !!x))];
  const stops = ids.length ? await c.all<TripStop>('TripStops', { filter: inList('tripId', ids), select: ['id', 'tripId', 'orderId', 'outletId', 'stopSeq'] }) : [];
  const orderIds = [...new Set(stops.map(st => st.orderId))];
  const lines = orderIds.length ? await c.all<OrderLineItem>('OrderLineItems', { filter: inList('orderId', orderIds), orderby: 'orderId,name' }) : [];
  const seqOf = (trip: string | undefined, orderId: string) => stops.find(st => st.tripId === trip && st.orderId === orderId)?.stopSeq ?? null;
  const moved: PlanChange['moved'] = [];
  if (before && after && before.id !== after.id) {
    for (const l of lines) {
      const from = seqOf(before.id, l.orderId);
      const to = seqOf(after.id, l.orderId);
      if (from !== to) moved.push({ line: l, from, to, outletId: stops.find(st => st.orderId === l.orderId)?.outletId ?? '' });
    }
  }
  const afterOrders = new Set(stops.filter(st => st.tripId === after?.id).map(st => st.orderId));
  return { plan, before, after, moved, lines: lines.filter(l => afterOrders.has(l.orderId)).length };
}

export function usePlanChange(tripId: string | undefined, planId: string | undefined) {
  return useQuery(tripId ? `dock.change.${tripId}.${planId ?? ''}` : null, c => planChange(c, tripId!, planId), { persist: true });
}

// ---------------------------------------------------------------- vehicle can't depart (LD-B1)

export type VehicleFault = 'NOT_COOLING' | 'ENGINE' | 'DOOR_SEAL' | 'OTHER';

/**
 * Trips('…')/Lodestar.ReportVehicleFault through the outbox like every field write: sent at once with signal,
 * kept on the phone (and shown as queued) without. The vehicle goes to the workshop and dispatch is told.
 */
export async function reportVehicleFault(trip: Pick<Trip, 'id' | 'vehicleId'>, fault: VehicleFault, reeferTempC?: number, note?: string) {
  const sub = session.claims?.sub;
  if (!sub) throw new Error('Sign in to report a vehicle');
  return queue.enqueue('VEHICLE_FAULT', {
    sub,
    tripId: trip.id,
    ref: trip.id,
    label: `Vehicle fault · ${trip.vehicleId}`,
    payload: { tripId: trip.id, fault, ...(reeferTempC !== undefined ? { reeferTempC } : {}), ...(note ? { note } : {}) },
  });
}

/** The newest vehicle-fault report for a trip in the outbox (queued, sent, or refused). */
export function faultReport(items: QueueItem[], tripId: string | undefined): QueueItem | undefined {
  return tripId ? items.filter(i => i.kind === 'VEHICLE_FAULT' && i.tripId === tripId).at(-1) : undefined;
}

/** What a vehicle still has on the dock today: its trips not yet released, with stops (outlet, order volume). */
export async function vehicleDockLoad(c: Pick<ODataClient, 'all'>, tripIds: string[]): Promise<TripStop[]> {
  if (!tripIds.length) return [];
  return c.all<TripStop>('TripStops', { filter: inList('tripId', tripIds), expand: 'outlet($select=id,name,district),order($select=id,m3,tempClass)', orderby: 'tripId,stopSeq' });
}

export function useVehicleDockLoad(tripIds: string[]) {
  const ids = [...tripIds].sort((a, b) => a.localeCompare(b)).join(',');
  return useQuery(ids ? `dock.vehicle.${ids}` : null, c => vehicleDockLoad(c, ids.split(',')), { persist: true });
}
