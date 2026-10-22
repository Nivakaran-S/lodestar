// Turns an approved plan into the day's execution: trips and stops for the dock and the drivers,
// order statuses, and a deferral record (with its reason code) for every order the plan left out.
// It runs inside the approval transaction, so a plan is either fully in effect or not at all.
import { ODataError } from '@lodestar/odata';
import { addBusinessDays, businessDateTime, minutesOfHhmm, runDateValue, toBusinessDate } from '@lodestar/platform';
import { DeferralReason, DeferralStatus, OrderStatus, Plan, Prisma, Role, TripStatus } from '@prisma/client';

/** Loading bays per depot, handed out in departure order (DSP-02, LD-01). */
export const BAYS: Record<string, string[]> = {
  PELIYAGODA: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
  KANDY: ['K1', 'K2', 'K3', 'K4'],
};

/** A depot registered later (ADM-21) gets four bays named after its code's first letter until it has its own. */
export const baysOf = (depot: string): string[] => BAYS[depot] ?? [1, 2, 3, 4].map((n) => `${depot.charAt(0).toUpperCase()}${n}`);

/** A trip as the planning agent drafts it (backend/apps/agent/lodestar_agent/domain/planner.py). */
interface DraftStop {
  seq: number;
  orderId: string;
  outletId: string;
  arrive?: string | null; // HH:MM on the run day
  etaModel?: string | null;
  lateRiskPct?: number | null;
  serviceMin?: number | null;
}
interface DraftTrip {
  vehicleId: string;
  tripNo: number;
  brand: string;
  district: string;
  orderIds: string[];
  minutes?: number | null;
  departs?: string | null;
  returns?: string | null;
  stops?: DraftStop[];
}
/** An order the agent could not place and would not defer (a protected order): the dispatcher must place it. */
interface DraftReview {
  orderId?: string;
  reason?: string; // PROTECTED_UNPLACED
  detail?: string; // e.g. "No compatible trip has room (CAP_REEFER); dispatcher must place it"
}
interface DraftDeferral {
  orderId: string;
  reason: string;
  score?: number | null;
}

export interface ExecutionResult {
  planId: string;
  depot: string;
  runDate: string;
  trips: { id: string; vehicleId: string; driverId: string | null; bay: string; outletIds: string[] }[];
  planned: { orderId: string; outletId: string; tripId: string; etaModel: string | null }[];
  deferred: { orderId: string; outletId: string; reason: DeferralReason; rescheduledDate: string }[];
  /** protected orders the plan could not place: logged as SUGGESTED deferrals for the dispatcher, the store told */
  atRisk: { orderId: string; outletId: string; reason: DeferralReason }[];
  /** orders already on a trip that has started loading; this version leaves them where they are */
  locked: string[];
  supersededTrips: number;
}

const STARTED: TripStatus[] = [TripStatus.LOADING, TripStatus.ENROUTE, TripStatus.COMPLETE];
/**
 * A trip has started once its status says so OR the dock has a load record for it: the field app
 * flips PLANNED -> LOADING lazily (and tolerates that call failing), so a PLANNED trip can already
 * carry ticks and shortfall flags. Replacing it would lose them and reuse its id for a fresh trip.
 */
const hasStarted = (t: { status: TripStatus; loadRecord?: unknown }): boolean => STARTED.includes(t.status) || !!t.loadRecord;
const REASONS = new Set<string>(Object.values(DeferralReason));

/** The trips and deferrals stored with a plan; an AUTOPLAN or seeded plan without trips cannot be executed. */
export function draftOf(plan: Plan): { trips: DraftTrip[]; deferrals: DraftDeferral[]; review: DraftReview[] } {
  const summary = (plan.summary ?? {}) as Record<string, any>;
  const trips = summary.plan?.trips;
  if (!Array.isArray(trips) || !trips.length) {
    throw new ODataError(409, 'PlanNotExecutable', `Plan ${plan.id} has no trips to put into effect; draft one with the planning agent (AgentRuns)`);
  }
  const deferrals = Array.isArray(summary.deferrals) ? summary.deferrals : Array.isArray(summary.plan?.unassigned) ? summary.plan.unassigned : [];
  const review = Array.isArray(summary.needsReview) ? (summary.needsReview as DraftReview[]).filter(r => r?.orderId) : [];
  return { trips, deferrals, review };
}

/** HH:MM on the run day as an instant; times past midnight (earlier than departure) roll to the next day. */
function at(runDate: string, hhmm: string | null | undefined, departs: number): Date | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const t = businessDateTime(runDate, hhmm);
  return minutesOfHhmm(hhmm) < departs ? new Date(t.getTime() + 86_400_000) : t;
}

/** The next operating day after a run date (Calendar), or the following day when the calendar is silent. */
async function nextOperatingDay(tx: Prisma.TransactionClient, runDate: string): Promise<string> {
  const next = await tx.calendar.findFirst({
    where: { date: { gt: runDateValue(runDate) }, isOperating: true },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return next ? toBusinessDate(next.date) : addBusinessDays(runDate, 1);
}

export async function executePlan(tx: Prisma.TransactionClient, plan: Plan): Promise<ExecutionResult> {
  const { trips: drafted, deferrals, review } = draftOf(plan);
  const runDate = toBusinessDate(plan.runDate);
  const day = runDateValue(runDate);

  // 1. The trips of earlier versions for this depot and day: started ones (status or a load record) stay, the rest are replaced.
  const existing = await tx.trip.findMany({
    where: { depot: plan.depot, runDate: day },
    select: { id: true, status: true, loadRecord: { select: { tripId: true } }, stops: { select: { orderId: true } } },
  });
  const started = existing.filter(hasStarted);
  const locked = new Set(started.flatMap(t => t.stops.map(s => s.orderId)));
  // Replaced trips have no load record by construction (hasStarted), so there is none to delete.
  const replaced = existing.filter(t => !hasStarted(t)).map(t => t.id);
  if (replaced.length) {
    await tx.notification.updateMany({ where: { tripId: { in: replaced } }, data: { tripId: null } });
    await tx.offlineEvent.updateMany({ where: { tripId: { in: replaced } }, data: { tripId: null } });
    await tx.tripStop.deleteMany({ where: { tripId: { in: replaced } } });
    await tx.trip.deleteMany({ where: { id: { in: replaced } } });
  }

  // 2. Drivers are assigned to their vehicle (User.vehicleId, the vehicle_id claim).
  const vehicleIds = [...new Set(drafted.map(t => t.vehicleId))];
  const drivers = await tx.user.findMany({
    where: { role: Role.DRIVER, isActive: true, vehicleId: { in: vehicleIds } },
    select: { id: true, vehicleId: true },
  });
  const driverOf = new Map(drivers.map(d => [d.vehicleId!, d.id]));

  const orderIds = [...new Set([...drafted.flatMap(t => t.orderIds), ...deferrals.map(d => d.orderId), ...review.map(r => r.orderId!)])];
  const orders = await tx.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, outletId: true, status: true, runDate: true, daysSince: true, deferralLog: { select: { status: true, planId: true } } },
  });
  const orderById = new Map(orders.map(o => [o.id, o]));
  const missing = orderIds.filter(id => !orderById.has(id));
  if (missing.length) throw ODataError.conflict(`Plan ${plan.id} refers to unknown orders: ${missing.slice(0, 5).join(', ')}`);

  // 3. Trips and stops, in departure order so bays are handed out the way the dock loads them.
  const ymd = runDate.replace(/-/g, '');
  const ordered = [...drafted].sort((a, b) => (a.departs ?? '').localeCompare(b.departs ?? '') || a.vehicleId.localeCompare(b.vehicleId) || a.tripNo - b.tripNo);
  const bays = baysOf(plan.depot);
  const result: ExecutionResult = { planId: plan.id, depot: plan.depot, runDate, trips: [], planned: [], deferred: [], atRisk: [], locked: [...locked], supersededTrips: replaced.length };
  let bayIndex = 0;
  const taken = new Set(started.map(t => t.id));
  for (const t of ordered) {
    const stops: DraftStop[] = (t.stops?.length ? t.stops : t.orderIds.map((orderId, i): DraftStop => ({ seq: i + 1, orderId, outletId: orderById.get(orderId)!.outletId })))
      .filter(s => !locked.has(s.orderId))
      .sort((a, b) => a.seq - b.seq);
    if (!stops.length) continue;
    const departMin = t.departs ? minutesOfHhmm(t.departs) : 0;
    // a started trip keeps its id: this vehicle's new trip takes the next free number
    let tripNo = t.tripNo;
    while (taken.has(`TRP-${t.vehicleId}-${ymd}-${tripNo}`)) tripNo++;
    const id = `TRP-${t.vehicleId}-${ymd}-${tripNo}`;
    taken.add(id);
    const bay = bays[bayIndex++ % bays.length];
    const driverId = driverOf.get(t.vehicleId) ?? null;
    await tx.trip.create({
      data: {
        id,
        vehicleId: t.vehicleId,
        driverId,
        depot: plan.depot,
        runDate: day,
        brand: t.brand as any,
        district: t.district,
        status: TripStatus.PLANNED,
        planVersion: plan.version,
        tripNumber: tripNo,
        departTime: at(runDate, t.departs, 0),
        returnTime: at(runDate, t.returns, departMin),
        planMinutes: t.minutes ?? null,
        bay,
        planId: plan.id,
        stops: {
          create: stops.map((s, i) => ({
            orderId: s.orderId,
            outletId: s.outletId,
            stopSeq: i + 1,
            etaPlan: at(runDate, s.arrive, departMin),
            etaModel: at(runDate, s.etaModel ?? s.arrive, departMin),
            lateRiskPct: s.lateRiskPct ?? null,
            serviceMinPredicted: s.serviceMin ?? null,
            status: OrderStatus.PLANNED,
          })),
        },
      },
    });
    result.trips.push({ id, vehicleId: t.vehicleId, driverId, bay, outletIds: [...new Set(stops.map(s => s.outletId))] });
    for (const s of stops) {
      result.planned.push({ orderId: s.orderId, outletId: s.outletId, tripId: id, etaModel: at(runDate, s.etaModel ?? s.arrive, departMin)?.toISOString() ?? null });
    }
  }

  // 4. Served orders are PLANNED for this day. One a previous version had deferred is brought back.
  //    One write for the plain ones: each round trip counts against the transaction's time on a remote database.
  const wasDeferred = (id: string) => {
    const o = orderById.get(id)!;
    return o.status === OrderStatus.DEFERRED && o.deferralLog?.status === DeferralStatus.CONFIRMED;
  };
  const plain = result.planned.filter(p => !wasDeferred(p.orderId)).map(p => p.orderId);
  if (plain.length) await tx.order.updateMany({ where: { id: { in: plain } }, data: { status: OrderStatus.PLANNED } });
  for (const p of result.planned.filter(x => wasDeferred(x.orderId))) {
    const o = orderById.get(p.orderId)!;
    await tx.order.update({
      where: { id: p.orderId },
      data: { status: OrderStatus.PLANNED, runDate: day, deferredYesterday: false, daysSince: Math.max(0, o.daysSince - 1) },
    });
    await tx.deferralLog.update({ where: { orderId: p.orderId }, data: { status: DeferralStatus.REVERSED, notes: `Placed by ${plan.id}` } });
  }

  // 5. Deferrals: recorded with their reason, and rolled to the next operating day, where they are protected.
  const placed = new Set(result.planned.map(p => p.orderId));
  const rescheduled = await nextOperatingDay(tx, runDate);
  for (const d of deferrals) {
    if (placed.has(d.orderId) || locked.has(d.orderId)) continue;
    const o = orderById.get(d.orderId)!;
    if (o.status === OrderStatus.DEFERRED && o.deferralLog?.planId && o.deferralLog.planId !== plan.id && o.deferralLog.status === DeferralStatus.CONFIRMED) continue; // already rolled
    const reason = (REASONS.has(d.reason) ? d.reason : DeferralReason.CAP_TIME) as DeferralReason;
    const log = {
      reason,
      score: Math.round(d.score ?? 0),
      status: DeferralStatus.CONFIRMED,
      rescheduledDate: runDateValue(rescheduled),
      confirmedAt: new Date(),
      planId: plan.id,
      notes: `Deferred by ${plan.id} (${reason}); next run ${rescheduled}`,
    };
    await tx.deferralLog.upsert({ where: { orderId: d.orderId }, update: log, create: { orderId: d.orderId, ...log } });
    await tx.order.update({
      where: { id: d.orderId },
      data: { status: OrderStatus.DEFERRED, runDate: runDateValue(rescheduled), deferredYesterday: true, daysSince: o.daysSince + 1 },
    });
    result.deferred.push({ orderId: d.orderId, outletId: o.outletId, reason, rescheduledDate: rescheduled });
  }

  // 6. Protected orders the plan could not place stay on this day (they must not be skipped twice), but never
  //    silently: each gets a SUGGESTED deferral with the reason, for the dispatcher to place or decide, and the store
  //    is told its order is at risk.
  const handled = new Set([...placed, ...result.deferred.map(d => d.orderId)]);
  for (const r of review) {
    const id = r.orderId!;
    if (handled.has(id) || locked.has(id)) continue;
    handled.add(id);
    const o = orderById.get(id)!;
    const code = (r.detail ?? '').match(/\b(CAP_REEFER|CAP_TIME|ACCESS|WINDOW|FUEL|VEH_DOWN)\b/)?.[1];
    const reason = (code ?? DeferralReason.CAP_TIME) as DeferralReason;
    const log = {
      reason,
      score: 0,
      status: DeferralStatus.SUGGESTED,
      planId: plan.id,
      notes: `Protected order ${plan.id} could not place (${reason}): the dispatcher must place it on ${runDate}`,
    };
    await tx.deferralLog.upsert({ where: { orderId: id }, update: log, create: { orderId: id, ...log } });
    result.atRisk.push({ orderId: id, outletId: o.outletId, reason });
  }
  return result;
}
