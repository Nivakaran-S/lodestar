import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { ODataError } from '@lodestar/odata';
import {
  OrderStatus, TempClass, DeferralReason, DeferralStatus, PlanSource, PlanStatus, Prisma, Role, TripStatus,
} from '@prisma/client';
import { runDateRange, runDateValue } from '@lodestar/platform';
import { NOTIFY, NotifyClient } from '@lodestar/security';
import { executePlan, type ExecutionResult } from './plan-execution';
import type { AgentRunSnapshot } from './agent.client';
import { DeferralScoringService } from './deferral-scoring.service';
import { CapacityService } from './capacity.service';

/** Plan id prefix per depot: PLG-2026-04-07-v3 (Peliyagoda), PLK-… (Kandy). */
export const PLAN_PREFIX: Record<string, string> = { PELIYAGODA: 'PLG', KANDY: 'PLK' };
/** Plan id prefix: the two original depots keep PLG/PLK; a depot registered later uses P + its code (PGALLE). */
export const planPrefix = (depot: string) => PLAN_PREFIX[depot] ?? `P${depot}`;

/** Publishing a plan writes every trip and order of the day in one transaction: on a remote database (Prisma
 * Postgres) that takes over a minute, so it may run up to just under the gateway's 150 s read timeout. */
export const APPROVE_TX_TIMEOUT_MS = 140_000;

/** Where an order was on the live version a new plan replaces. */
export interface PreviousStop {
  orderId: string;
  tripId: string;
  etaModel: Date | null;
  trip?: { driverId: string | null } | null;
}

/**
 * Who a newly live plan touches. A first version touches everyone on it. A later one (v2…) only the orders that
 * changed trip or arrival, and the drivers of trips whose orders changed (on the new trip, and on the old one).
 */
export function touched(x: ExecutionResult, previous: PreviousStop[] | null) {
  const everyDriver = [...new Set(x.trips.map(t => t.driverId).filter((d): d is string => Boolean(d)))];
  if (!previous) return { planned: x.planned, drivers: everyDriver };
  const before = new Map(previous.map(p => [p.orderId, p]));
  const ordersOf = (pairs: Array<{ orderId: string; tripId: string }>) => {
    const m = new Map<string, string[]>();
    for (const p of pairs) m.set(p.tripId, [...(m.get(p.tripId) ?? []), p.orderId]);
    return new Map([...m].map(([k, v]) => [k, v.sort().join(',')]));
  };
  const oldTrips = ordersOf(previous);
  const newTrips = ordersOf(x.planned);
  const planned = x.planned.filter(p => {
    const was = before.get(p.orderId);
    const eta = was?.etaModel ? new Date(was.etaModel).toISOString() : null;
    return !was || was.tripId !== p.tripId || eta !== p.etaModel;
  });
  const changedTrips = new Set([...newTrips].filter(([id, orders]) => oldTrips.get(id) !== orders).map(([id]) => id));
  const drivers = new Set(x.trips.filter(t => t.driverId && changedTrips.has(t.id)).map(t => t.driverId!));
  // orders that left their old trip (moved, deferred, at risk): that trip's driver is told too
  const moved = new Set([
    ...x.planned.filter(p => before.get(p.orderId)?.tripId !== p.tripId).map(p => p.orderId),
    ...x.deferred.map(d => d.orderId),
    ...(x.atRisk ?? []).map(a => a.orderId),
  ]);
  const newTripIds = new Set(x.trips.map(t => t.id));
  for (const p of previous) {
    const gone = !newTripIds.has(p.tripId) && !x.locked.includes(p.orderId);
    if (p.trip?.driverId && (moved.has(p.orderId) || gone)) drivers.add(p.trip.driverId);
  }
  return { planned, drivers: [...drivers] };
}

/** Plans a human may still approve or reject. */
export const OPEN_PLAN_STATUSES: PlanStatus[] = [PlanStatus.DRAFT, PlanStatus.NEEDS_APPROVAL];

/** Hard-rule violations a plan was drafted with (the agent's check_rules output in Plan.summary). */
export function planViolations(summary: unknown): Array<{ rule?: string }> {
  const v = (summary as { violations?: unknown } | null)?.violations;
  return Array.isArray(v) ? v : [];
}

/** 422 OverrideReasonRequired: approving a plan that breaks hard rules needs a stated reason. */
export function overrideReasonRequired(what: string, violations: Array<{ rule?: string }>) {
  const rules = [...new Set(violations.map((v) => v.rule ?? '?'))].join(', ');
  return ODataError.unprocessable(
    'OverrideReasonRequired',
    `${what} breaks ${violations.length} hard rule check(s) (${rules}); approving it needs an overrideReason`,
    'overrideReason',
  );
}

/** Stored window of a run date (a Date is read as its Sri Lanka calendar date). */
export function dayRange(runDate: string | Date) {
  return runDateRange(runDate);
}

/**
 * Planning Service — the core auto-plan engine.
 *
 * Auto-plan logic (from STORY.md Peliyagoda planning picture):
 *  1. Group orders by depot, brand, district
 *  2. Check reefer capacity → if short, score orders for deferral
 *  3. Move dry Fresh off reefers onto dry trucks if possible
 *  4. Assign vehicles: one brand + one district per trip
 *  5. Validate window, access, fuel constraints
 *  6. Flag van_only outlets (vans only)
 *  7. Return a plan draft with suggested deferrals — a human dispatcher approves it
 */
@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(
    private prisma: PrismaService,
    private deferralScoring: DeferralScoringService,
    private capacity: CapacityService,
    @Inject(NOTIFY) private notify: NotifyClient,
  ) {}

  /** DSP-01: the plan board for a depot and run date. */
  async getPlan(depot: string, runDate: string) {
    const { start: startOf, end: endOf, iso } = dayRange(runDate);

    const [trips, orders, reefer, demand, vehiclesInWorkshop] = await Promise.all([
      this.prisma.trip.findMany({
        where: { depot, runDate: { gte: startOf, lt: endOf } },
        include: {
          vehicle: true,
          driver: { select: { id: true, name: true } },
          stops: { include: { outlet: true, order: true, pod: true }, orderBy: { stopSeq: 'asc' } },
          loadRecord: true,
        },
        orderBy: [{ brand: 'asc' }, { district: 'asc' }],
      }),
      this.prisma.order.findMany({
        where: {
          runDate: { gte: startOf, lt: endOf },
          outlet: { depot },
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.EXCEPTION, OrderStatus.CANCELLED] },
        },
        include: { outlet: true, deferralLog: true },
      }),
      this.capacity.getReeferCapacity(depot),
      this.capacity.getChilledDemand(depot, startOf),
      this.prisma.vehicle.count({ where: { depot, status: 'WORKSHOP' } }),
    ]);

    const chilledShortM3 = Math.max(0, demand.m3 - reefer.totalM3);

    const summary = {
      depot,
      runDate: iso,
      planVersion: trips[0]?.planVersion ?? 1,
      orders: {
        total: orders.length,
        planned: orders.filter((o) => o.status === OrderStatus.PLANNED).length,
        deferred: orders.filter((o) => o.status === OrderStatus.DEFERRED).length,
        needsReview: orders.filter((o) => o.status === OrderStatus.RECEIVED).length,
      },
      chilled: { demand: demand.m3, capacity: reefer.totalM3, shortM3: chilledShortM3 },
      trips: trips.length,
      vehiclesInWorkshop,
    };

    // Compute deferral scores for unplanned chilled orders
    const scoredOrders = orders.map((o) => {
      const computedScore = this.deferralScoring.computeScore({
        deferredYesterday: o.deferredYesterday,
        daysSince: o.daysSince,
        tempClass: o.tempClass,
        brand: o.brand,
        windowOpen: o.outlet.windowOpen,
        nextRunWithin24h: false,
      });
      return {
        ...o,
        computedScore,
        isProtected: o.deferredYesterday || this.deferralScoring.isProtected(o.deferralScore ?? computedScore),
      };
    });

    return { summary, trips, orders: scoredOrders };
  }

  /** Suggested deferrals for a run: lowest scores first until the chilled shortfall is covered. */
  async suggestDeferrals(depot: string, runDate: string) {
    const { summary, orders } = await this.getPlan(depot, runDate);
    const suggestions: { orderId: string; reason: DeferralReason; score: number; notes: string }[] = [];

    if (summary.chilled.shortM3 > 0) {
      // Sort unprotected chilled orders by score ascending (lowest score = best to defer)
      const chilledOrders = orders
        .filter((o) => o.tempClass === TempClass.CHILLED && !o.isProtected)
        .sort((a, b) => a.computedScore - b.computedScore);

      let remainingShort = summary.chilled.shortM3;
      for (const o of chilledOrders) {
        if (remainingShort <= 0) break;
        suggestions.push({
          orderId: o.id,
          reason: DeferralReason.CAP_REEFER,
          score: o.computedScore,
          notes: `Chilled short ${summary.chilled.shortM3.toFixed(1)} m³. days_since ${o.daysSince}, score ${o.computedScore}`,
        });
        remainingShort -= o.m3;
      }
    }
    return { summary, suggestions };
  }

  /** Next plan id and version for a depot and run date. */
  async nextPlanId(depot: string, runDate: string | Date) {
    const { start, iso } = dayRange(runDate);
    const last = await this.prisma.plan.findFirst({
      where: { depot, runDate: start },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    return { id: `${planPrefix(depot)}-${iso}-v${version}`, version, runDate: start };
  }

  /**
   * What a change to an approved planning-agent run starts from (DSP-12: any later change is a new draft that needs
   * approval): the live plan version that run produced, and the orders and trips that have started (LOADING, ENROUTE,
   * COMPLETE), which the new version leaves as they are. 409 when the run's plan is not the live one, or when a
   * revision of it is already waiting for approval (apply the change there).
   */
  async revisionBasis(run: { id: string; depot: string; runDate: Date }) {
    const plan = await this.prisma.plan.findFirst({ where: { agentRunId: run.id }, orderBy: { version: 'desc' }, select: { id: true, version: true, status: true } });
    if (!plan) throw ODataError.conflict(`Run ${run.id} has no plan to change; draft the day with the planning agent`);
    if (plan.status !== PlanStatus.PUBLISHED) {
      throw ODataError.conflict(`Plan ${plan.id} is ${plan.status}, not live: change the live plan's draft instead`);
    }
    const waiting = await this.prisma.agentRun.findFirst({
      where: { depot: run.depot, runDate: run.runDate, status: 'NEEDS_APPROVAL', detail: { path: ['revisionOf'], equals: run.id } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (waiting) throw ODataError.conflict(`Draft ${waiting.id} for this day is already waiting for approval: apply the change to it`);
    const started = await this.prisma.trip.findMany({
      where: { depot: run.depot, runDate: run.runDate, status: { in: [TripStatus.LOADING, TripStatus.ENROUTE, TripStatus.COMPLETE] } },
      select: { vehicleId: true, tripNumber: true, stops: { select: { orderId: true } } },
    });
    return {
      planId: plan.id,
      version: plan.version,
      lockedOrderIds: started.flatMap(t => t.stops.map(s => s.orderId)),
      lockedTrips: started.map(t => ({ vehicleId: t.vehicleId, tripNo: t.tripNumber })),
    };
  }

  /** There is no run to plan on a day the Calendar marks as non-operating (422 NonOperatingDay). */
  async assertOperatingDay(runDate: string | Date) {
    const { start, iso } = dayRange(runDate);
    const day = await this.prisma.calendar.findUnique({ where: { date: start }, select: { isOperating: true } });
    if (day && !day.isOperating) {
      throw ODataError.unprocessable('NonOperatingDay', `${iso} is not an operating day: there is no run to plan`, 'runDate');
    }
  }

  /**
   * Auto-plan (Plans/Lodestar.AutoPlan): drafts the day with the planning agent — the same path as
   * POST AgentRuns — so the plan version it stores carries the agent's trips, rule checks and deferrals and
   * Plans/Lodestar.Approve can put it into effect. The run is kept as an AgentRun row linked to the plan, so
   * the dispatcher can approve either the plan or the run. `draft` starts the run with the caller's token.
   * A run that ends without a draft to approve (failed, or no trips) stores no plan: 409 AutoPlanIncomplete.
   */
  async runAutoPlan(depot: string, runDate: string, requestedBy: string, draft: (depot: string, runDate: string) => Promise<AgentRunSnapshot>) {
    await this.assertOperatingDay(runDate);
    const { iso, start } = dayRange(runDate);
    const snapshot = await draft(depot, iso);
    if (!snapshot?.id) throw new ODataError(502, 'BadGateway', 'The planning agent returned no run id');
    const runId = String(snapshot.id);
    const status = String(snapshot.status ?? 'DRAFTING').toUpperCase();
    await this.prisma.agentRun.create({
      data: { id: runId, depot, runDate: start, requestedBy, status, detail: snapshot as any, lastSyncedAt: new Date() },
    });
    const trips = (snapshot.plan as { trips?: unknown[] } | undefined)?.trips;
    if (status !== 'NEEDS_APPROVAL' || !Array.isArray(trips) || !trips.length) {
      throw new ODataError(
        409,
        'AutoPlanIncomplete',
        `The planning agent's run ${runId} is ${status} without trips to approve; no plan was stored. Review it in AgentRuns('${runId}')`,
      );
    }
    const plan = await this.createAgentPlan({ id: runId, depot, runDate: start }, snapshot, requestedBy, PlanSource.AUTOPLAN);
    await this.prisma.agentRun.update({ where: { id: runId }, data: { planId: plan.id } });
    return plan;
  }

  /**
   * Turns an approved planning-agent run into a plan version. The agent only
   * drafts; this row is what a dispatcher's approval then publishes.
   */
  async createAgentPlan(run: { id: string; depot: string; runDate: Date }, snapshot: Record<string, any>, createdBy: string, source: PlanSource = PlanSource.AGENT) {
    const next = await this.nextPlanId(run.depot, run.runDate);
    const explanation = snapshot.explanation;
    return this.prisma.plan.create({
      data: {
        id: next.id,
        depot: run.depot,
        runDate: next.runDate,
        version: next.version,
        status: PlanStatus.NEEDS_APPROVAL,
        source,
        agentRunId: run.id,
        createdBy,
        explanation: explanation === undefined ? null : typeof explanation === 'string' ? explanation : JSON.stringify(explanation),
        summary: {
          plan: snapshot.plan ?? null,
          contextSummary: snapshot.contextSummary ?? null,
          ruleChecks: snapshot.ruleChecks ?? null,
          violations: snapshot.violations ?? null,
          deferrals: snapshot.deferrals ?? null,
          needsReview: snapshot.needsReview ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Publishes a plan (dispatcher only) and puts it into effect in the same transaction: trips and stops,
   * order statuses and deferrals (plan-execution.ts). Earlier published versions become SUPERSEDED and
   * their trips that have not started are replaced. Stores, the dock and drivers are told afterwards.
   * A plan drafted with hard-rule violations is only approved with an override reason, kept in its summary.
   */
  async approvePlan(planId: string, approvedBy: string, note?: string, overrideReason?: string) {
    let execution: ExecutionResult | undefined;
    let previous: PreviousStop[] | null = null;
    const published = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan) throw ODataError.notFound(`Plan ${planId} was not found`);
      if (!OPEN_PLAN_STATUSES.includes(plan.status)) {
        throw ODataError.conflict(`Plan ${planId} is ${plan.status} and cannot be approved`);
      }
      const violations = planViolations(plan.summary);
      const reason = overrideReason?.trim();
      if (violations.length && !reason) throw overrideReasonRequired(`Plan ${planId}`, violations);
      const superseded = await tx.plan.updateMany({
        where: { depot: plan.depot, runDate: plan.runDate, status: PlanStatus.PUBLISHED, id: { not: plan.id } },
        data: { status: PlanStatus.SUPERSEDED },
      });
      // a later version (v2…) replaces a live one: remember where every order was, so only the people it touches are told
      if (superseded.count) {
        previous = await tx.tripStop.findMany({
          where: { trip: { depot: plan.depot, runDate: plan.runDate } },
          select: { orderId: true, tripId: true, etaModel: true, trip: { select: { driverId: true } } },
        });
      }
      execution = await executePlan(tx, plan);
      const now = new Date();
      // An auto-plan keeps its agent run: once the plan is live, that run is no longer waiting for approval.
      if (plan.agentRunId) {
        await tx.agentRun.updateMany({
          where: { id: plan.agentRunId, status: 'NEEDS_APPROVAL' },
          data: { status: 'APPROVED', decision: 'approve', decidedBy: approvedBy, planId: plan.id },
        });
      }
      return tx.plan.update({
        where: { id: plan.id },
        data: {
          status: PlanStatus.PUBLISHED,
          approvedBy,
          approvedAt: now,
          publishedAt: now,
          ...(note ? { notes: note } : {}),
          ...(violations.length && reason
            ? {
              summary: {
                ...(plan.summary as Record<string, unknown>),
                override: { reason: reason.slice(0, 500), by: approvedBy, at: now.toISOString(), violations: violations.length },
              } as Prisma.InputJsonValue,
            }
            : {}),
        },
      });
    }, { timeout: APPROVE_TX_TIMEOUT_MS, maxWait: 10_000 });
    // the plan is live once the transaction commits: a failed notice must not turn that into an error
    if (execution) await this.announce(execution, previous).catch((e: Error) => this.logger.warn(`Plan ${planId} is live, but announcing it failed: ${e.message}`));
    return published;
  }

  /**
   * After a plan is in effect: each affected store gets a notice, and the open screens are told to refresh. When the
   * plan replaces a live version (`previous`: where the orders were), only the people it touches are told: stores
   * whose orders changed trip or arrival, or were deferred or put at risk, and the drivers of the trips that changed.
   */
  private async announce(x: ExecutionResult, previous: PreviousStop[] | null = null) {
    const { planned, drivers } = touched(x, previous);
    const outlets = [...new Set([...planned.map(p => p.outletId), ...x.deferred.map(d => d.outletId), ...(x.atRisk ?? []).map(a => a.outletId)])];
    // the open screens first (the dock's re-plan alert, LD-14): the per-store notices below can be slow
    const rooms = [
      `dispatcher:${x.depot}`,
      `loader:${x.depot}`,
      ...outlets.map(o => `store:${o}`),
      ...drivers.map(d => `driver:${d}`),
    ];
    await this.notify.publish('plan_published', rooms, {
      planId: x.planId, depot: x.depot, runDate: x.runDate,
      trips: x.trips.length, planned: x.planned.length, deferred: x.deferred.length, supersededTrips: x.supersededTrips,
    });
    const managers = await this.prisma.user.findMany({
      where: { role: Role.STORE_MANAGER, isActive: true, outletId: { in: outlets } },
      select: { id: true, outletId: true },
    });
    for (const m of managers) {
      const mine = planned.filter(p => p.outletId === m.outletId);
      const deferred = x.deferred.filter(d => d.outletId === m.outletId);
      if (mine.length) {
        await this.notify.notice({
          recipientId: m.id, type: 'PLAN_PUBLISHED', outletId: m.outletId!,
          payload: { planId: x.planId, runDate: x.runDate, orders: mine.map(p => ({ orderId: p.orderId, tripId: p.tripId, etaModel: p.etaModel })) },
        });
      }
      for (const d of deferred) {
        await this.notify.notice({
          recipientId: m.id, type: 'ORDER_DEFERRED', outletId: m.outletId!,
          payload: { planId: x.planId, orderId: d.orderId, reason: d.reason, from: x.runDate, rescheduledDate: d.rescheduledDate },
        });
      }
      for (const a of (x.atRisk ?? []).filter(a => a.outletId === m.outletId)) {
        await this.notify.notice({
          recipientId: m.id, type: 'ORDER_AT_RISK', outletId: m.outletId!,
          payload: { planId: x.planId, orderId: a.orderId, reason: a.reason, runDate: x.runDate, title: `Order ${a.orderId} at risk: dispatch is placing it` },
        });
      }
    }
    this.logger.log(`Plan ${x.planId} in effect: ${x.trips.length} trips, ${x.planned.length} orders, ${x.deferred.length} deferred, ${x.locked.length} left on started trips`);
  }

  async rejectPlan(planId: string, reason?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !OPEN_PLAN_STATUSES.includes(plan.status)) {
      throw ODataError.conflict(`Plan ${planId} cannot be rejected`);
    }
    return this.prisma.plan.update({
      where: { id: planId },
      data: { status: PlanStatus.REJECTED, ...(reason ? { notes: reason } : {}) },
    });
  }

  /** Scores an order for deferral; protected orders are never deferred. */
  async scoreOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { outlet: true } });
    if (!order) throw ODataError.notFound(`Order ${orderId} was not found`);
    const score =
      order.deferralScore ??
      this.deferralScoring.computeScore({
        deferredYesterday: order.deferredYesterday,
        daysSince: order.daysSince,
        tempClass: order.tempClass,
        brand: order.brand,
        windowOpen: order.outlet.windowOpen,
        nextRunWithin24h: false,
      });
    const isProtected = order.deferredYesterday || this.deferralScoring.isProtected(score);
    return { order, score, isProtected };
  }

  /** Confirm a deferral suggestion: the order is deferred to its rescheduled date. */
  async confirmDeferral(deferralId: string, resolvedBy: string, notes?: string, rescheduledDate?: string) {
    return this.prisma.$transaction(async (tx) => {
      const deferral = await tx.deferralLog.findUnique({ where: { id: deferralId } });
      if (!deferral) throw ODataError.notFound(`Deferral ${deferralId} was not found`);
      if (deferral.status !== DeferralStatus.SUGGESTED) {
        throw ODataError.conflict(`Deferral ${deferralId} is ${deferral.status}`);
      }
      await tx.order.update({ where: { id: deferral.orderId }, data: { status: OrderStatus.DEFERRED } });
      return tx.deferralLog.update({
        where: { id: deferralId },
        data: {
          status: DeferralStatus.CONFIRMED,
          confirmedAt: new Date(),
          resolvedBy,
          ...(notes ? { notes } : {}),
          ...(rescheduledDate ? { rescheduledDate: runDateValue(rescheduledDate) } : {}),
        },
      });
    });
  }

  async dismissDeferral(deferralId: string, resolvedBy: string) {
    return this.prisma.deferralLog.update({
      where: { id: deferralId },
      data: { status: DeferralStatus.DISMISSED, resolvedBy },
    });
  }

  /** Reverse a deferral (field evidence wins): the order goes back into the plan. */
  async reverseDeferral(deferralId: string, resolvedBy: string, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const deferral = await tx.deferralLog.update({
        where: { id: deferralId },
        data: { status: DeferralStatus.REVERSED, resolvedBy, ...(notes ? { notes } : {}) },
      });
      await tx.order.update({ where: { id: deferral.orderId }, data: { status: OrderStatus.PLANNED } });
      return deferral;
    });
  }

  async getCapacityOutlook(depot: string) {
    return this.capacity.getCapacityOutlook(depot);
  }
}
