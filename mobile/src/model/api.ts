// The queries behind the live screens. Row-level filters come from the token (the server scopes a
// driver to their vehicle, a loader to their depot, a store manager to their outlet), so these only
// say *which day* and *which shape*.
import { inList, key, lit, type ODataClient } from '@/lib/odata';
import { dayFilter, isoDay } from '@/lib/time';
import type { Deferral, LoadRecord, Notification, Order, OrderLineItem, Outlet, Plan, POD, Trip, TripStop, Vehicle } from './types';

type C = Pick<ODataClient, 'list' | 'all' | 'get' | 'fn' | 'action' | 'create'>;

const STOP_EXPAND = 'outlet,order($select=id,units,kg,m3,tempClass,status,notes,brand),pod';

export type RunDay = { date: string; isToday: boolean };

/**
 * The run day to show: today (Colombo) when it has trips, else the next day that does (today is closed,
 * the demo day is tomorrow), else the most recent day that does (a phone still opens on its last run).
 */
export async function resolveRunDay(c: C, today: string, filter?: string): Promise<RunDay> {
  const scoped = (f: string) => (filter ? `(${filter}) and ${f}` : f);
  const hit = await c.list<Pick<Trip, 'id'>>('Trips', { filter: scoped(dayFilter('runDate', today)), select: ['id'], top: 1 });
  if (hit.value.length) return { date: today, isToday: true };
  // a closed day (e.g. Sunday): the next run already planned, so the phone opens on the coming demo day
  const next = await c.list<Pick<Trip, 'runDate'>>('Trips', { filter: scoped(`runDate gt ${today}T00:00:00Z`), select: ['runDate'], orderby: 'runDate asc', top: 1 });
  const upcoming = isoDay(next.value[0]?.runDate);
  if (upcoming && upcoming > today) return { date: upcoming, isToday: false };
  const latest = await c.list<Pick<Trip, 'runDate'>>('Trips', { filter: filter, select: ['runDate'], orderby: 'runDate desc', top: 1 });
  const d = isoDay(latest.value[0]?.runDate);
  return d ? { date: d, isToday: d === today } : { date: today, isToday: true };
}

export type DriverRun = RunDay & { trips: Trip[]; stops: TripStop[] };

/** The driver's trips for the day with their stops (outlet, order, POD). */
export async function driverRun(c: C, today: string): Promise<DriverRun> {
  const day = await resolveRunDay(c, today);
  const trips = await c.all<Trip>('Trips', { filter: dayFilter('runDate', day.date), orderby: 'tripNumber', expand: 'vehicle,loadRecord' });
  const stops = trips.length
    ? await c.all<TripStop>('TripStops', { filter: inList('tripId', trips.map(t => t.id)), expand: STOP_EXPAND, orderby: 'tripId,stopSeq' })
    : [];
  return { ...day, trips, stops: sortStops(stops, trips) };
}

export function sortStops(stops: TripStop[], trips: Pick<Trip, 'id' | 'tripNumber'>[]): TripStop[] {
  const n = new Map(trips.map(t => [t.id, t.tripNumber]));
  return [...stops].sort((a, b) => (n.get(a.tripId) ?? 0) - (n.get(b.tripId) ?? 0) || a.stopSeq - b.stopSeq);
}

/** Order lines for a set of orders (the load sheet and the POD count). */
export async function orderLines(c: C, orderIds: string[]): Promise<OrderLineItem[]> {
  if (!orderIds.length) return [];
  return c.all<OrderLineItem>('OrderLineItems', { filter: inList('orderId', orderIds), orderby: 'orderId,name' });
}

export type BayQueue = RunDay & { depot: string; trips: Trip[] };

/** GET Trips/Lodestar.BayQueue(depot=…,runDate=…) for the loader's depot. */
export async function bayQueue(c: C, depot: string, today: string): Promise<BayQueue> {
  const day = await resolveRunDay(c, today, `depot eq ${lit(depot)}`);
  const trips = await c.fn<Trip[]>(`Trips/Lodestar.BayQueue(depot=${lit(depot)},runDate=${day.date})`);
  return { ...day, depot, trips: Array.isArray(trips) ? trips : [] };
}

export type LoadSheet = { trip: Trip; stops: TripStop[]; lines: OrderLineItem[]; loadRecord: LoadRecord | null };

export async function loadSheet(c: C, tripId: string): Promise<LoadSheet> {
  // the trip and its stops don't depend on each other: one round trip less on a slow link
  const [trip, stops] = await Promise.all([
    c.get<Trip>('Trips', tripId, { expand: 'vehicle,driver,loadRecord' }),
    c.all<TripStop>('TripStops', { filter: `tripId eq ${lit(tripId)}`, expand: STOP_EXPAND, orderby: 'stopSeq' }),
  ]);
  const lines = await orderLines(c, stops.map(s => s.orderId));
  return { trip, stops, lines, loadRecord: trip.loadRecord ?? null };
}

/** Load records of the loader's depot for a day (flags tab); the day is matched on the expanded trip. */
export async function loadRecords(c: C, date: string): Promise<(LoadRecord & { trip?: Trip })[]> {
  const rows = await c.all<LoadRecord & { trip?: Trip }>('LoadRecords', {
    expand: 'trip($select=id,vehicleId,district,brand,bay,status,runDate,departTime)',
    orderby: 'loadedAt desc',
    top: 200,
  });
  return rows.filter(r => !r.trip || isoDay(r.trip.runDate) === date);
}

export async function notifications(c: C, top = 50): Promise<Notification[]> {
  return (await c.list<Notification>('Notifications', { orderby: 'sentAt desc', top })).value;
}

export async function markRead(c: C, id: string): Promise<void> {
  await c.action(`Notifications${key(id)}/Lodestar.MarkRead`, {});
}

/** Proofs of delivery the caller may see (a driver's vehicle, a store's outlet), newest first. */
export async function pods(c: C, top = 50): Promise<POD[]> {
  return (await c.list<POD>('PODs', { orderby: 'savedAt desc', top, expand: 'tripStop($select=id,tripId,orderId,outletId,stopSeq,arrivalActual,leaveActual)' })).value;
}

export async function pod(c: C, id: string): Promise<POD> {
  return c.get<POD>('PODs', id, { expand: 'tripStop($select=id,tripId,orderId,outletId,stopSeq,arrivalActual,leaveActual)' });
}

// ---------------------------------------------------------------- store manager

export type StoreDay = { outlet: Outlet | null; orders: Order[] };

export async function storeDay(c: C, outletId: string): Promise<StoreDay> {
  const [outlet, orders] = await Promise.all([
    c.get<Outlet>('Outlets', outletId).catch(() => null),
    c.list<Order>('Orders', { filter: `outletId eq ${lit(outletId)}`, orderby: 'runDate desc,orderedAt desc', top: 30, expand: 'tripStop($select=id,tripId,stopSeq,status,etaModel,etaModelBandEarly,etaModelBandLate,arrivalActual,leaveActual),deferralLog($select=id,reason,status,rescheduledDate,notes)' }),
  ]);
  return { outlet, orders: orders.value };
}

export async function orderDetail(c: C, id: string): Promise<Order> {
  return c.get<Order>('Orders', id, { expand: 'lineItems,tripStop,deferralLog,outlet' });
}

export type NewOrderLine = { name: string; qty: number; kg: number; tempClass: 'CHILLED' | 'AMBIENT' };

/** m³ per kg when the outlet has no past orders to learn from (the desk's SM-01 uses the same). */
export const DEFAULT_M3_PER_KG = 0.0045;

/**
 * The bodies of POST Orders for a store's draft: one order per temperature class (dry and chilled travel apart,
 * as the desk's SM-01 sends them), m³ estimated from weight with the outlet's own m³ per kg.
 */
export function orderBodies(outlet: Pick<Outlet, 'id' | 'brand'>, runDate: string, lines: NewOrderLine[], notes?: string, m3PerKg: number = DEFAULT_M3_PER_KG) {
  return (['AMBIENT', 'CHILLED'] as const)
    .map(tempClass => {
      const items = lines.filter(l => l.tempClass === tempClass && l.qty > 0);
      const kg = Math.round(items.reduce((n, l) => n + l.kg, 0) * 10) / 10;
      return {
        outletId: outlet.id,
        runDate,
        brand: outlet.brand,
        tempClass,
        units: items.reduce((n, l) => n + l.qty, 0),
        kg,
        m3: Math.round(kg * m3PerKg * 100) / 100,
        ...(notes ? { notes } : {}),
        lineItems: items,
      };
    })
    .filter(o => o.lineItems.length > 0);
}

// ---------------------------------------------------------------- dispatcher

export async function plansAwaitingApproval(c: C): Promise<Plan[]> {
  return (await c.list<Plan>('Plans', { filter: `status eq 'NEEDS_APPROVAL' or status eq 'DRAFT'`, orderby: 'createdAt desc', top: 10 })).value;
}

export async function approvePlan(c: C, id: string, note?: string, overrideReason?: string): Promise<Plan> {
  return c.action<Plan>(`Plans${key(id)}/Lodestar.Approve`, { ...(note ? { note } : {}), ...(overrideReason ? { overrideReason } : {}) });
}

export async function rejectPlan(c: C, id: string, reason?: string): Promise<Plan> {
  return c.action<Plan>(`Plans${key(id)}/Lodestar.Reject`, reason ? { reason } : {});
}

export type LiveRoutes = RunDay & { trips: Trip[] };

export async function liveRoutes(c: C, today: string): Promise<LiveRoutes> {
  const day = await resolveRunDay(c, today);
  const trips = await c.all<Trip>('Trips', {
    filter: dayFilter('runDate', day.date),
    orderby: 'depot,departTime',
    expand: 'vehicle($select=id,type,tempClass,status,depot),driver($select=id,name),stops($select=id,stopSeq,status,outletId,etaModel,lateRiskPct,arrivalActual,leaveActual)',
  });
  return { ...day, trips };
}

export type VehicleDetail = { vehicle: Vehicle; trips: Trip[]; stops: TripStop[] };

export async function vehicleDetail(c: C, vehicleId: string, date: string): Promise<VehicleDetail> {
  const [vehicle, trips] = await Promise.all([
    c.get<Vehicle>('Vehicles', vehicleId),
    c.all<Trip>('Trips', { filter: `vehicleId eq ${lit(vehicleId)} and ${dayFilter('runDate', date)}`, orderby: 'tripNumber', expand: 'driver($select=id,name),loadRecord' }),
  ]);
  const stops = trips.length ? await c.all<TripStop>('TripStops', { filter: inList('tripId', trips.map(t => t.id)), expand: 'outlet($select=id,name,district,windowOpen,windowClose)', orderby: 'tripId,stopSeq' }) : [];
  return { vehicle, trips, stops: sortStops(stops, trips) };
}

export async function deferrals(c: C): Promise<Deferral[]> {
  return (await c.list<Deferral>('Deferrals', { orderby: 'createdAt desc', top: 30 })).value;
}
