// The figures on DSP-12 Approve and go live, from what is being approved (an agent draft or a plan's stored draft),
// not from the day's deferral records: those also hold earlier runs' deferrals, e.g. yesterday's deferral of an order
// that rolled to today and is now protected and on a trip.
import type { AgentRunDetail } from '@/lib/odata/types';

type Draft = Pick<AgentRunDetail, 'plan' | 'deferrals' | 'needsReview'>;

export interface ApprovalFigures {
  /** Orders on the draft's trips: what "Approve N orders" puts on the road. */
  planned: number;
  /** Orders the draft defers, each with a reason code. */
  deferred: number;
  /** Outlets of the deferred orders (the stores told why and the new date). */
  deferredOutlets: number;
  /** Protected orders (deferred on the previous run) on the draft's trips. */
  protectedKept: number;
  /** Protected orders the draft defers or leaves off its trips: must be 0. */
  protectedDeferred: number;
}

/**
 * `protectedIds`: the run date's protected orders (deferredYesterday), from Orders; the draft's own stop flags
 * (`protected`) count too. A plan's stored summary carries its deferrals in `deferrals`, or in `plan.unassigned`.
 */
export function approvalFigures(draft: Draft | null | undefined, protectedIds: Iterable<string> = []): ApprovalFigures | null {
  if (!draft?.plan) return null;
  const trips = draft.plan.trips ?? [];
  const onTrips = new Set(trips.flatMap(t => t.orderIds ?? []));
  const flagged = trips.flatMap(t => (t.stops ?? []).filter(s => s.protected).map(s => s.orderId));
  const prot = new Set([...protectedIds, ...flagged]);
  const deferrals: Array<{ orderId: string; outletId?: string }> = draft.deferrals?.length ? draft.deferrals : draft.plan.unassigned ?? [];
  const deferredIds = new Set(deferrals.map(d => d.orderId).filter(id => !onTrips.has(id)));
  const reviewIds = (draft.needsReview ?? []).map(r => r.orderId).filter(id => !onTrips.has(id));
  return {
    planned: onTrips.size,
    deferred: deferredIds.size,
    deferredOutlets: new Set(deferrals.filter(d => deferredIds.has(d.orderId)).map(d => d.outletId ?? d.orderId)).size,
    protectedKept: [...prot].filter(id => onTrips.has(id)).length,
    protectedDeferred: new Set([...deferredIds, ...reviewIds].filter(id => prot.has(id))).size,
  };
}
