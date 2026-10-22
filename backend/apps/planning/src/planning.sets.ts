import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import {
  assertDepotCode, callerAuthorization, currentRequest, EntitySet, ODataAction, ODataEntitySet, ODataError, ODataFunction, OperationContext, WriteContext,
} from '@lodestar/odata';
import { AUDIT_SINK, AuditSink, canAccessDepot, isPrivileged, Principal, Roles, serviceName } from '@lodestar/security';
import { DeferralStatus, PlanSource, PlanStatus } from '@prisma/client';
import { AgentClient, AgentRunSnapshot } from './agent.client';
import { EtaService } from './eta.service';
import { measureModels, planningRules } from './planning-rules';
import { dayRange, OPEN_PLAN_STATUSES, overrideReasonRequired, PlanningService, planViolations } from './planning.service';

function assertDepot(p: Principal, depot: string) {
  if (!canAccessDepot(p, depot)) throw ODataError.forbidden(`You do not plan for depot ${depot}`, 'depot');
}

/** Plans: versioned dispatch plans. Only a human dispatcher can approve (publish). */
@Injectable()
@EntitySet({
  name: 'Plans',
  model: 'Plan',
  read: [Roles.Dispatcher, Roles.Loader, Roles.Admin, Roles.Service],
  create: [Roles.Dispatcher, Roles.Admin, Roles.Service],
  update: [Roles.Dispatcher, Roles.Admin],
  abac: { depot: (depots) => ({ depot: { in: depots } }) },
  navigation: ['trips', 'deferrals'],
  search: ['id', 'notes'],
  insertable: ['depot', 'runDate', 'summary', 'explanation', 'agentRunId', 'notes'],
  updatable: ['summary', 'explanation', 'notes'],
  defaultOrderBy: 'runDate desc,version desc',
})
export class PlansSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly planning: PlanningService,
    private readonly eta: EtaService,
    private readonly agent: AgentClient,
  ) {
    super(prisma);
  }

  /** Drafts only: the id, version and status are assigned here, never by the client. */
  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    if (!data.depot || !data.runDate) throw ODataError.badRequest('depot and runDate are required');
    data.depot = await assertDepotCode(this.prisma, data.depot);
    assertDepot(ctx.principal, data.depot);
    const next = await this.planning.nextPlanId(data.depot, data.runDate.toISOString());
    const fromAgent = serviceName(ctx.principal) === 'agent';
    return {
      ...data,
      id: next.id,
      version: next.version,
      runDate: next.runDate,
      // The agent drafts and asks for approval; it can never publish.
      status: fromAgent ? PlanStatus.NEEDS_APPROVAL : PlanStatus.DRAFT,
      source: fromAgent ? PlanSource.AGENT : PlanSource.MANUAL,
      createdBy: ctx.principal.sub,
    };
  }

  async beforeUpdate(patch: Record<string, any>, current: any) {
    if (!OPEN_PLAN_STATUSES.includes(current.status)) throw ODataError.conflict(`Plan ${current.id} is ${current.status} and read-only`);
    return patch;
  }

  /** POST Plans('PLG-2026-04-07-v3')/Lodestar.Approve — human dispatchers only (not svc, not admin). */
  @ODataAction({
    name: 'Approve',
    binding: 'entity',
    roles: [Roles.Dispatcher],
    params: { note: 'Edm.String', overrideReason: 'Edm.String' },
    returns: 'Lodestar.Plan',
  })
  approve(ctx: OperationContext) {
    if (ctx.principal.isService) throw ODataError.forbidden('Only a human dispatcher can approve a plan');
    return this.planning.approvePlan(ctx.entity.id, ctx.principal.sub, ctx.params.note, ctx.params.overrideReason);
  }

  /** POST Plans('…')/Lodestar.Reject {reason?} */
  @ODataAction({ name: 'Reject', binding: 'entity', roles: [Roles.Dispatcher], params: { reason: 'Edm.String' }, returns: 'Lodestar.Plan' })
  reject(ctx: OperationContext) {
    return this.planning.rejectPlan(ctx.entity.id, ctx.params.reason);
  }

  /**
   * POST Plans/Lodestar.AutoPlan {depot, runDate} — drafts the day with the planning agent (as POST AgentRuns does,
   * with the calling dispatcher's token) and stores the draft as a plan version awaiting approval, with its trips,
   * so Plans('…')/Lodestar.Approve can put it into effect. Dispatchers only, like AgentRuns.
   */
  @ODataAction({
    name: 'AutoPlan',
    binding: 'collection',
    roles: [Roles.Dispatcher],
    params: { depot: { type: 'Edm.String', required: true }, runDate: { type: 'Edm.Date', required: true } },
    returns: 'Lodestar.Plan',
  })
  async autoPlan(ctx: OperationContext) {
    const depot = await assertDepotCode(this.prisma, ctx.params.depot);
    assertDepot(ctx.principal, depot);
    const auth = callerAuthorization(ctx.headers);
    if (!auth) throw ODataError.forbidden('The planning agent needs the calling dispatcher’s token');
    return this.planning.runAutoPlan(depot, ctx.params.runDate, ctx.principal.sub, (d, iso) => this.agent.startRun(d, iso, auth));
  }

  /** GET Plans/Lodestar.Board(depot='KANDY',runDate=2026-04-07) — DSP-01 plan board. */
  @ODataFunction({
    name: 'Board',
    binding: 'collection',
    roles: [Roles.Dispatcher, Roles.Loader, Roles.Admin, Roles.Service],
    params: { depot: { type: 'Edm.String', required: true }, runDate: { type: 'Edm.Date', required: true } },
    returns: 'Edm.Untyped',
  })
  async board(ctx: OperationContext) {
    const depot = await assertDepotCode(this.prisma, ctx.params.depot, { active: false });
    assertDepot(ctx.principal, depot);
    return this.planning.getPlan(depot, ctx.params.runDate);
  }

  /** GET Plans/Lodestar.CapacityOutlook(depot='PELIYAGODA') — DSP-05 10-week outlook. */
  @ODataFunction({
    name: 'CapacityOutlook',
    binding: 'collection',
    roles: [Roles.Dispatcher, Roles.Admin, Roles.Service],
    params: { depot: { type: 'Edm.String', required: true } },
    returns: 'Edm.Untyped',
  })
  async capacityOutlook(ctx: OperationContext) {
    const depot = await assertDepotCode(this.prisma, ctx.params.depot, { active: false });
    assertDepot(ctx.principal, depot);
    return this.planning.getCapacityOutlook(depot);
  }

  /**
   * GET Plans/Lodestar.PlanningRules() — the rules the planning service enforces (deferral score weights and
   * thresholds, late-risk and load levels, order cut-off, default alert rules, model targets) and the measured
   * quality of the estimators over the caller's depots (DSP-16, DSP-20 and the plan desk's thresholds).
   */
  @ODataFunction({ name: 'PlanningRules', binding: 'collection', roles: [Roles.Dispatcher, Roles.Loader, Roles.Admin, Roles.Service], returns: 'Edm.Untyped' })
  async planningRulesFn(ctx: OperationContext) {
    const depots = isPrivileged(ctx.principal) ? null : ctx.principal.depots;
    return { ...planningRules(), models: await measureModels(this.prisma, depots) };
  }

  /** GET Plans/Lodestar.LateRiskExplain(stopId='…') — DSP-15: a stop's late risk as parts that add up. */
  @ODataFunction({
    name: 'LateRiskExplain',
    binding: 'collection',
    roles: [Roles.Dispatcher, Roles.Admin],
    params: { stopId: { type: 'Edm.String', required: true } },
    returns: 'Edm.Untyped',
  })
  async lateRiskExplain(ctx: OperationContext) {
    const out = await this.eta.explainStop(String(ctx.params.stopId));
    if (!out) throw ODataError.notFound(`Trip stop ${ctx.params.stopId} not found`, 'stopId');
    assertDepot(ctx.principal, out.depot);
    return out;
  }
}

const deferralDepot = (depots: string[]) => ({ order: { is: { outlet: { is: { depot: { in: depots } } } } } });

/** Deferrals: suggested by the planner or a dispatcher, confirmed by a dispatcher. */
@Injectable()
@EntitySet({
  name: 'Deferrals',
  model: 'DeferralLog',
  read: [Roles.Dispatcher, Roles.StoreManager, Roles.Admin, Roles.Service],
  create: [Roles.Dispatcher, Roles.Admin],
  abac: {
    depot: deferralDepot,
    outlet: (outletId) => ({ order: { is: { outletId } } }),
  },
  navigation: ['order', 'plan'],
  filterPaths: ['order/outlet'],
  search: ['orderId', 'notes'],
  insertable: ['orderId', 'reason', 'notes', 'rescheduledDate', 'isProvisional', 'planId'],
  defaultOrderBy: 'createdAt desc',
})
export class DeferralsSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly planning: PlanningService,
  ) {
    super(prisma);
  }

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    if (!data.orderId || !data.reason) throw ODataError.badRequest('orderId and reason are required');
    const { order, score, isProtected } = await this.planning.scoreOrder(data.orderId);
    const outlet = await this.prisma.outlet.findUnique({ where: { id: order.outletId }, select: { depot: true } });
    assertDepot(ctx.principal, outlet?.depot);
    if (isProtected) throw ODataError.conflict(`Order ${order.id} is protected and is never deferred`, 'orderId');
    return { ...data, score, status: DeferralStatus.SUGGESTED, resolvedBy: null };
  }

  /** POST Deferrals('…')/Lodestar.Confirm {notes?, rescheduledDate?} */
  @ODataAction({
    name: 'Confirm',
    binding: 'entity',
    roles: [Roles.Dispatcher],
    params: { notes: 'Edm.String', rescheduledDate: 'Edm.Date' },
    returns: 'Lodestar.DeferralLog',
  })
  confirm(ctx: OperationContext) {
    return this.planning.confirmDeferral(ctx.entity.id, ctx.principal.sub, ctx.params.notes, ctx.params.rescheduledDate);
  }

  /** POST Deferrals('…')/Lodestar.Dismiss */
  @ODataAction({ name: 'Dismiss', binding: 'entity', roles: [Roles.Dispatcher], returns: 'Lodestar.DeferralLog' })
  dismiss(ctx: OperationContext) {
    if (ctx.entity.status !== DeferralStatus.SUGGESTED) throw ODataError.conflict(`Deferral is ${ctx.entity.status}`);
    return this.planning.dismissDeferral(ctx.entity.id, ctx.principal.sub);
  }

  /** POST Deferrals('…')/Lodestar.Reverse {notes?} — field evidence wins. */
  @ODataAction({
    name: 'Reverse',
    binding: 'entity',
    roles: [Roles.Dispatcher, Roles.Service],
    params: { notes: 'Edm.String' },
    returns: 'Lodestar.DeferralLog',
  })
  reverse(ctx: OperationContext) {
    if (ctx.entity.status !== DeferralStatus.CONFIRMED) throw ODataError.conflict(`Deferral is ${ctx.entity.status}`);
    return this.planning.reverseDeferral(ctx.entity.id, ctx.principal.sub, ctx.params.notes);
  }
}

const TERMINAL_RUN = new Set(['APPROVED', 'REJECTED', 'FAILED', 'COMPLETED', 'CANCELLED']);
const RESYNC_AFTER_MS = 2_000;

/** Fields we keep from an agent run view. */
function fromSnapshot(s: AgentRunSnapshot) {
  return {
    status: String(s.status ?? 'DRAFTING').toUpperCase(),
    detail: s as any,
    lastSyncedAt: new Date(),
  };
}

/**
 * AgentRuns: the planning agent's runs, exposed as OData.
 *  - POST AgentRuns {depot, runDate} starts a draft run in the agent.
 *  - The reference row makes runs listable and depot-scoped; reading one
 *    refreshes it from the agent.
 *  - Every agent call carries the calling dispatcher's own token.
 */
@Injectable()
@EntitySet({
  name: 'AgentRuns',
  model: 'AgentRun',
  read: [Roles.Dispatcher, Roles.Admin],
  create: [Roles.Dispatcher],
  abac: { depot: (depots) => ({ depot: { in: depots } }) },
  navigation: [],
  search: ['id', 'status'],
  insertable: ['depot', 'runDate'],
  defaultOrderBy: 'createdAt desc',
})
export class AgentRunsSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly agent: AgentClient,
    private readonly planning: PlanningService,
    @Inject(AUDIT_SINK) private readonly audit: AuditSink,
  ) {
    super(prisma);
  }

  private authorization(headers?: Record<string, string | string[] | undefined>): string {
    const auth = callerAuthorization(headers);
    if (!auth) throw ODataError.forbidden('The planning agent needs the calling dispatcher’s token');
    return auth;
  }

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    if (!data.depot || !data.runDate) throw ODataError.badRequest('depot and runDate are required');
    data.depot = await assertDepotCode(this.prisma, data.depot);
    assertDepot(ctx.principal, data.depot);
    await this.planning.assertOperatingDay(data.runDate);
    return data;
  }

  /** POST /odata/v4/AgentRuns {depot, runDate} → starts a draft run in the agent. */
  async create(data: Record<string, any>, ctx: WriteContext) {
    const { iso, start } = dayRange(data.runDate);
    const snapshot = await this.agent.startRun(data.depot, iso, this.authorization(ctx.headers));
    if (!snapshot?.id) throw new ODataError(502, 'BadGateway', 'The planning agent returned no run id');
    return this.prisma.agentRun.create({
      data: { id: String(snapshot.id), depot: data.depot, runDate: start, requestedBy: ctx.principal.sub, ...fromSnapshot(snapshot) },
    });
  }

  /** Single reads refresh a live run from the agent with the caller's token (best effort). */
  async findFirst(args: { where?: any; select?: any }) {
    const row = await super.findFirst({ where: args.where });
    if (!row) return null;
    const auth = callerAuthorization(currentRequest()?.headers);
    const stale = !row.lastSyncedAt || Date.now() - new Date(row.lastSyncedAt).getTime() > RESYNC_AFTER_MS;
    if (auth && stale && !TERMINAL_RUN.has(row.status)) {
      try {
        const snapshot = await this.agent.getRun(row.id, auth);
        await this.prisma.agentRun.update({ where: { id: row.id }, data: fromSnapshot(snapshot) });
      } catch {
        // Keep the last known state if the agent is unavailable.
      }
    }
    return super.findFirst(args);
  }

  /**
   * POST AgentRuns('…')/Lodestar.Resume {decision: approve|edit|reject, edits?, comment?, overrideReason?}
   * The human decision. On "approve", planning stores the agent's draft as a
   * plan version and publishes it with the dispatcher's authority (Plans
   * Approve) — the agent itself can never publish. A draft with hard-rule
   * violations needs an overrideReason, checked before the agent records the approval.
   */
  @ODataAction({
    name: 'Resume',
    binding: 'entity',
    roles: [Roles.Dispatcher],
    params: { decision: { type: 'Edm.String', required: true }, edits: 'Collection(Edm.Untyped)', comment: 'Edm.String', overrideReason: 'Edm.String' },
    returns: 'Lodestar.AgentRun',
  })
  async resume(ctx: OperationContext) {
    const decision = String(ctx.params.decision).toLowerCase();
    if (!['approve', 'edit', 'reject'].includes(decision)) throw ODataError.badRequest('decision must be approve, edit or reject', 'decision');
    if (decision === 'edit' && !(ctx.params.edits as unknown[] | undefined)?.length) {
      throw ODataError.badRequest("decision 'edit' needs at least one edit", 'edits');
    }
    // A change to an approved (live) plan is a new draft of the next version, not an edit of the run (DSP-12)
    if (decision === 'edit' && String(ctx.entity.status).toUpperCase() === 'APPROVED') return this.revise(ctx);
    const overrideReason = typeof ctx.params.overrideReason === 'string' ? ctx.params.overrideReason.trim() : '';
    if (decision === 'approve' && !overrideReason) {
      const violations = planViolations(await this.agent.getRun(ctx.entity.id, this.authorization(ctx.headers)));
      if (violations.length) throw overrideReasonRequired('This draft', violations);
    }

    const snapshot = await this.agent.resume(ctx.entity.id, this.authorization(ctx.headers), decision, ctx.params.edits, ctx.params.comment);
    // Record the agent's new state first, so a failure below never loses the decision.
    let run = await this.prisma.agentRun.update({
      where: { id: ctx.entity.id },
      data: { ...fromSnapshot(snapshot), decision, decidedBy: ctx.principal.sub },
    });

    if (decision === 'approve' && String(snapshot.status).toUpperCase() === 'APPROVED') {
      let planId: string | undefined = run.planId ?? undefined;
      if (!planId) {
        planId = (await this.planning.createAgentPlan(ctx.entity, snapshot, ctx.principal.sub)).id;
        run = await this.prisma.agentRun.update({ where: { id: run.id }, data: { planId } });
      }
      // If publishing fails here, the draft stays NEEDS_APPROVAL and can be approved with Plans('…')/Lodestar.Approve.
      await this.planning.approvePlan(planId, ctx.principal.sub, `Approved via planning-agent run ${ctx.entity.id}`, overrideReason || undefined);
      // The publication is its own audited write, attributed to the dispatcher.
      await this.audit.record({
        at: new Date().toISOString(),
        actor: ctx.principal.sub,
        actorRoles: ctx.principal.roles,
        client: ctx.principal.clientId,
        action: 'Plans.Approve',
        entitySet: 'Plans',
        entityKey: planId,
        outcome: 'SUCCESS',
        payload: { via: 'AgentRuns.Resume', agentRunId: ctx.entity.id, ...(overrideReason ? { overrideReason } : {}) },
      });
    }
    return run;
  }

  /**
   * Resume {decision: 'edit'} on an approved run: the edits become the next version of the live plan (v2…), a new
   * agent run seeded from that plan plus the edits, with started trips locked. It waits for a dispatcher's approval
   * like any draft (DSP-12, DSP-40). Returns the new run; the approved one stays as it was.
   */
  private async revise(ctx: OperationContext) {
    const auth = this.authorization(ctx.headers);
    const basis = await this.planning.revisionBasis(ctx.entity);
    const comment = typeof ctx.params.comment === 'string' && ctx.params.comment.trim() ? ctx.params.comment.trim().slice(0, 500) : undefined;
    const snapshot = await this.agent.reviseRun(ctx.entity.id, auth, {
      edits: ctx.params.edits as unknown[], version: basis.version, lockedOrderIds: basis.lockedOrderIds, lockedTrips: basis.lockedTrips, ...(comment ? { comment } : {}),
    });
    if (!snapshot?.id) throw new ODataError(502, 'BadGateway', 'The planning agent returned no run id');
    return this.prisma.agentRun.create({
      data: { id: String(snapshot.id), depot: ctx.entity.depot, runDate: ctx.entity.runDate, requestedBy: ctx.principal.sub, ...fromSnapshot(snapshot) },
    });
  }

  /**
   * GET AgentRuns/Lodestar.AgentConfig() — the planning agent's model, fallback and the guardrails it enforces
   * (DSP-16 models and fallbacks, ADM-17 planning agent guardrails). Read-only, from the agent's own GET /config
   * with the caller's token.
   */
  @ODataFunction({ name: 'AgentConfig', binding: 'collection', roles: [Roles.Dispatcher, Roles.Admin], returns: 'Edm.Untyped' })
  agentConfig(ctx: OperationContext) {
    return this.agent.config(this.authorization(ctx.headers));
  }

  /** POST AgentRuns('…')/Lodestar.Ask {question} — "Ask the planning agent" (DSP-39/40). */
  @ODataAction({
    name: 'Ask',
    binding: 'entity',
    roles: [Roles.Dispatcher],
    params: { question: { type: 'Edm.String', required: true } },
    returns: 'Edm.Untyped',
  })
  ask(ctx: OperationContext) {
    const question = String(ctx.params.question).trim();
    if (!question || question.length > 2000) throw ODataError.badRequest('question must be 1–2000 characters', 'question');
    return this.agent.ask(ctx.entity.id, question, this.authorization(ctx.headers));
  }
}
