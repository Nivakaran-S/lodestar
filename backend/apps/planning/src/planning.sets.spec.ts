import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { depotDelegate } from '../../../libs/odata/test/depots';
import { ODataError, runWithRequestContext } from '@lodestar/odata';
import type { AuditSink } from '@lodestar/security';
import { personas, principal } from '../../../libs/security/test/principals';
import { AgentClient } from './agent.client';
import { EtaService } from './eta.service';
import { PlanningService } from './planning.service';
import { AgentRunsSet, DeferralsSet, PlansSet } from './planning.sets';

interface OutletDelegate {
  findUnique(args: any): Promise<any>;
}

interface AgentRunDelegate {
  findFirst(args: any): Promise<any>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
}

const RUN_DATE = new Date('2026-04-07T00:00:00.000Z');

describe('PlansSet', () => {
  let planning: PlanningService;
  let eta: EtaService;
  let agent: AgentClient;
  let set: PlansSet;

  beforeEach(() => {
    planning = mock(PlanningService);
    eta = mock(EtaService);
    agent = mock(AgentClient);
    set = new PlansSet({ depot: depotDelegate() } as any, instance(planning), instance(eta), instance(agent));
    when(planning.nextPlanId(anything(), anything())).thenResolve({ id: 'PLK-2026-04-07-v2', version: 2, runDate: RUN_DATE });
  });

  describe('beforeCreate', () => {
    it('marks a plan drafted by the agent service as NEEDS_APPROVAL / AGENT', async () => {
      const data = await set.beforeCreate({ depot: 'KANDY', runDate: RUN_DATE, status: 'PUBLISHED' }, { principal: personas.agent, headers: {} });
      expect(data).toMatchObject({
        id: 'PLK-2026-04-07-v2',
        version: 2,
        runDate: RUN_DATE,
        status: 'NEEDS_APPROVAL',
        source: 'AGENT',
        createdBy: 'svc-agent-sa',
      });
      expect(capture(planning.nextPlanId).last()).toEqual(['KANDY', RUN_DATE.toISOString()]);
    });

    it('marks a human plan as a MANUAL DRAFT', async () => {
      const data = await set.beforeCreate({ depot: 'KANDY', runDate: RUN_DATE }, { principal: personas.nilanthi, headers: {} });
      expect(data).toMatchObject({ status: 'DRAFT', source: 'MANUAL', createdBy: 'nilanthi' });
    });

    it('does not treat another service identity as the agent', async () => {
      const other = principal({ sub: 'svc-orders-sa', roles: ['svc'], clientId: 'svc-orders' });
      const data = await set.beforeCreate({ depot: 'KANDY', runDate: RUN_DATE }, { principal: other, headers: {} });
      expect(data).toMatchObject({ status: 'DRAFT', source: 'MANUAL' });
    });

    it('refuses a depot outside the caller depots', async () => {
      const kandyOnly = { ...personas.nilanthi, depots: ['KANDY'] };
      await expect(set.beforeCreate({ depot: 'PELIYAGODA', runDate: RUN_DATE }, { principal: kandyOnly, headers: {} })).rejects.toMatchObject({
        status: 403,
      });
      verify(planning.nextPlanId(anything(), anything())).never();
    });

    it('requires depot and runDate', async () => {
      await expect(set.beforeCreate({ depot: 'KANDY' }, { principal: personas.nilanthi, headers: {} })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('beforeUpdate', () => {
    it('allows edits only while the plan is open', async () => {
      await expect(set.beforeUpdate({ notes: 'x' }, { id: 'P1', status: 'DRAFT' })).resolves.toEqual({ notes: 'x' });
      await expect(set.beforeUpdate({ notes: 'x' }, { id: 'P1', status: 'PUBLISHED' })).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('Lodestar.Approve', () => {
    it('delegates a dispatcher approval to PlanningService.approvePlan', async () => {
      when(planning.approvePlan('PLK-1', 'nilanthi', 'ok', undefined)).thenResolve({ id: 'PLK-1', status: 'PUBLISHED' } as any);
      const res = await set.approve({ principal: personas.nilanthi, params: { note: 'ok' }, entity: { id: 'PLK-1' }, headers: {} });
      expect(res).toMatchObject({ status: 'PUBLISHED' });
      verify(planning.approvePlan('PLK-1', 'nilanthi', 'ok', undefined)).once();
    });

    it('passes the override reason through', async () => {
      when(planning.approvePlan(anything(), anything(), anything(), anything())).thenResolve({ id: 'PLK-1' } as any);
      await set.approve({ principal: personas.nilanthi, params: { note: 'ok', overrideReason: 'agreed' }, entity: { id: 'PLK-1' }, headers: {} });
      verify(planning.approvePlan('PLK-1', 'nilanthi', 'ok', 'agreed')).once();
    });

    it('refuses a service principal even if it carries the dispatcher role', async () => {
      const svc = { ...personas.nilanthi, isService: true };
      expect(() => set.approve({ principal: svc, params: {}, entity: { id: 'PLK-1' }, headers: {} })).toThrow(ODataError);
      expect(() => set.approve({ principal: personas.agent, params: {}, entity: { id: 'PLK-1' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 403 }),
      );
      verify(planning.approvePlan(anything(), anything(), anything(), anything())).never();
    });
  });

  describe('Lodestar.AutoPlan / Board / CapacityOutlook', () => {
    const bearer = { authorization: 'Bearer t' };
    it('drafts with the planning agent for an allowed depot, with the caller token', async () => {
      when(planning.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', anything())).thenResolve({ id: 'PLK-2026-04-07-v1' } as any);
      when(agent.startRun('KANDY', '2026-04-07', 'Bearer t')).thenResolve({ id: 'run-1', status: 'NEEDS_APPROVAL' });
      await set.autoPlan({ principal: personas.nilanthi, params: { depot: 'KANDY', runDate: '2026-04-07' }, headers: bearer });
      const [, , , draft] = capture(planning.runAutoPlan).last();
      await expect(draft('KANDY', '2026-04-07')).resolves.toMatchObject({ id: 'run-1' });
      verify(agent.startRun('KANDY', '2026-04-07', 'Bearer t')).once();
    });

    it('needs the dispatcher token to reach the agent', async () => {
      await expect(set.autoPlan({ principal: personas.nilanthi, params: { depot: 'KANDY', runDate: '2026-04-07' }, headers: {} })).rejects.toMatchObject({ status: 403 });
      verify(planning.runAutoPlan(anything(), anything(), anything(), anything())).never();
    });

    it('refuses auto-plan, board and outlook for a foreign depot', async () => {
      const ctx = { principal: personas.kasun, params: { depot: 'PELIYAGODA', runDate: '2026-04-07' }, headers: bearer };
      await expect(set.autoPlan(ctx)).rejects.toMatchObject({ status: 403 });
      await expect(set.board(ctx)).rejects.toMatchObject({ status: 403 });
      await expect(set.capacityOutlook(ctx)).rejects.toMatchObject({ status: 403 });
      verify(planning.runAutoPlan(anything(), anything(), anything(), anything())).never();
    });

    it('accepts a depot code in any case and refuses one the Depots registry does not know (400)', async () => {
      await set.autoPlan({ principal: personas.nilanthi, params: { depot: 'kandy', runDate: '2026-04-07' }, headers: bearer });
      verify(planning.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', anything())).once();
      await expect(set.autoPlan({ principal: personas.nilanthi, params: { depot: 'GALLE', runDate: '2026-04-07' }, headers: bearer })).rejects.toMatchObject({ status: 400, target: 'depot' });
    });

    it('lets an admin plan any depot', async () => {
      when(planning.getPlan(anything(), anything())).thenResolve({} as any);
      await set.board({ principal: personas.admin, params: { depot: 'PELIYAGODA', runDate: '2026-04-07' }, headers: {} });
      verify(planning.getPlan('PELIYAGODA' as any, '2026-04-07')).once();
    });
  });

  describe('Lodestar.LateRiskExplain', () => {
    const explained = { stopId: 's1', depot: 'KANDY', lateRiskPct: 61, base: 20, planned: 50, parts: [] };
    const kandyDispatcher = principal({ sub: 'd-kandy', roles: ['dispatcher'], depots: ['KANDY'], clientId: 'lodestar-web' });

    it('explains a stop of a depot the dispatcher plans', async () => {
      when(eta.explainStop('s1')).thenResolve(explained as any);
      await expect(set.lateRiskExplain({ principal: kandyDispatcher, params: { stopId: 's1' }, headers: {} })).resolves.toMatchObject({ stopId: 's1', base: 20 });
    });

    it('refuses a stop of a foreign depot and an unknown stop', async () => {
      when(eta.explainStop('s1')).thenResolve({ ...explained, depot: 'PELIYAGODA' } as any);
      await expect(set.lateRiskExplain({ principal: kandyDispatcher, params: { stopId: 's1' }, headers: {} })).rejects.toMatchObject({ status: 403 });
      when(eta.explainStop('nope')).thenResolve(null);
      await expect(set.lateRiskExplain({ principal: kandyDispatcher, params: { stopId: 'nope' }, headers: {} })).rejects.toMatchObject({ status: 404 });
    });
  });
});

describe('DeferralsSet', () => {
  let planning: PlanningService;
  let outlet: OutletDelegate;
  let set: DeferralsSet;

  beforeEach(() => {
    planning = mock(PlanningService);
    outlet = mock<OutletDelegate>();
    set = new DeferralsSet({ outlet: instance(outlet) } as any, instance(planning));
    when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
  });

  describe('beforeCreate', () => {
    it('stores a SUGGESTED deferral with the computed score', async () => {
      when(planning.scoreOrder('ORD1')).thenResolve({ order: { id: 'ORD1', outletId: 'OUT106' }, score: 27, isProtected: false } as any);
      const data = await set.beforeCreate({ orderId: 'ORD1', reason: 'CAP_REEFER', status: 'CONFIRMED' }, { principal: personas.nilanthi, headers: {} });
      expect(data).toEqual({ orderId: 'ORD1', reason: 'CAP_REEFER', status: 'SUGGESTED', score: 27, resolvedBy: null });
      expect(capture(outlet.findUnique).last()[0]).toMatchObject({ where: { id: 'OUT106' } });
    });

    it('refuses to defer a protected order', async () => {
      when(planning.scoreOrder('ORD1')).thenResolve({ order: { id: 'ORD1', outletId: 'OUT106' }, score: 95, isProtected: true } as any);
      await expect(set.beforeCreate({ orderId: 'ORD1', reason: 'CAP_REEFER' }, { principal: personas.nilanthi, headers: {} })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('refuses an order of a foreign depot', async () => {
      when(planning.scoreOrder('ORD1')).thenResolve({ order: { id: 'ORD1', outletId: 'OUT001' }, score: 10, isProtected: false } as any);
      when(outlet.findUnique(anything())).thenResolve({ depot: 'PELIYAGODA' });
      const kandyOnly = { ...personas.nilanthi, depots: ['KANDY'] };
      await expect(set.beforeCreate({ orderId: 'ORD1', reason: 'CAP_REEFER' }, { principal: kandyOnly, headers: {} })).rejects.toMatchObject({
        status: 403,
      });
    });

    it('requires orderId and reason', async () => {
      await expect(set.beforeCreate({ orderId: 'ORD1' }, { principal: personas.nilanthi, headers: {} })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('Confirm / Dismiss / Reverse', () => {
    it('confirm delegates with the caller and params', async () => {
      when(planning.confirmDeferral(anything(), anything(), anything(), anything())).thenResolve({ id: 'D1', status: 'CONFIRMED' } as any);
      await set.confirm({ principal: personas.nilanthi, params: { notes: 'n', rescheduledDate: '2026-04-08' }, entity: { id: 'D1', status: 'SUGGESTED' }, headers: {} });
      verify(planning.confirmDeferral('D1', 'nilanthi', 'n', '2026-04-08')).once();
    });

    it('dismiss only a SUGGESTED deferral', async () => {
      when(planning.dismissDeferral('D1', 'nilanthi')).thenResolve({ id: 'D1', status: 'DISMISSED' } as any);
      await set.dismiss({ principal: personas.nilanthi, params: {}, entity: { id: 'D1', status: 'SUGGESTED' }, headers: {} });
      verify(planning.dismissDeferral('D1', 'nilanthi')).once();
      expect(() => set.dismiss({ principal: personas.nilanthi, params: {}, entity: { id: 'D1', status: 'CONFIRMED' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 409 }),
      );
      verify(planning.dismissDeferral(anything(), anything())).once();
    });

    it('reverse only a CONFIRMED deferral', async () => {
      when(planning.reverseDeferral('D1', 'nilanthi', 'field')).thenResolve({ id: 'D1', status: 'REVERSED' } as any);
      await set.reverse({ principal: personas.nilanthi, params: { notes: 'field' }, entity: { id: 'D1', status: 'CONFIRMED' }, headers: {} });
      verify(planning.reverseDeferral('D1', 'nilanthi', 'field')).once();
      expect(() => set.reverse({ principal: personas.nilanthi, params: {}, entity: { id: 'D1', status: 'SUGGESTED' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    });
  });
});


describe('AgentRunsSet', () => {
  const AUTH = 'Bearer dispatcher-token';
  const headers = { authorization: AUTH };
  let agent: AgentClient;
  let planning: PlanningService;
  let audit: AuditSink;
  let runs: AgentRunDelegate;
  let set: AgentRunsSet;

  beforeEach(() => {
    agent = mock(AgentClient);
    planning = mock(PlanningService);
    audit = mock<AuditSink>();
    runs = mock<AgentRunDelegate>();
    set = new AgentRunsSet({ agentRun: instance(runs), depot: depotDelegate() } as any, instance(agent), instance(planning), instance(audit));
    when(runs.create(anything())).thenCall(async (a: any) => a.data);
    when(runs.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));
    when(audit.record(anything())).thenResolve();
  });

  describe('beforeCreate', () => {
    it('checks the depot and required fields', async () => {
      const kandyOnly = { ...personas.nilanthi, depots: ['KANDY'] };
      await expect(set.beforeCreate({ depot: 'PELIYAGODA', runDate: RUN_DATE }, { principal: kandyOnly, headers })).rejects.toMatchObject({ status: 403 });
      await expect(set.beforeCreate({ depot: 'KANDY' }, { principal: kandyOnly, headers })).rejects.toMatchObject({ status: 400 });
      await expect(set.beforeCreate({ depot: 'KANDY', runDate: RUN_DATE }, { principal: kandyOnly, headers })).resolves.toBeDefined();
      verify(planning.assertOperatingDay(RUN_DATE)).once();
    });

    it('refuses a non-operating day before the agent is asked', async () => {
      when(planning.assertOperatingDay(anything())).thenReject(ODataError.unprocessable('NonOperatingDay', 'closed', 'runDate'));
      await expect(set.beforeCreate({ depot: 'KANDY', runDate: RUN_DATE }, { principal: personas.nilanthi, headers })).rejects.toMatchObject({
        status: 422, code: 'NonOperatingDay',
      });
    });
  });

  describe('create', () => {
    it('starts an agent run with the ISO date and the caller token, and stores the reference row', async () => {
      when(agent.startRun('KANDY', '2026-04-07', AUTH)).thenResolve({ id: 'run-1', status: 'drafting' });
      const row = await set.create({ depot: 'KANDY', runDate: new Date('2026-04-07T10:30:00.000Z') }, { principal: personas.nilanthi, headers });
      verify(agent.startRun('KANDY', '2026-04-07', AUTH)).once();
      const args = capture(runs.create).last()[0];
      expect(args.data).toMatchObject({ id: 'run-1', depot: 'KANDY', runDate: RUN_DATE, requestedBy: 'nilanthi', status: 'DRAFTING' });
      expect(args.data.detail).toEqual({ id: 'run-1', status: 'drafting' });
      expect(args.data.lastSyncedAt).toBeInstanceOf(Date);
      expect(row.id).toBe('run-1');
    });

    it('refuses without a bearer token (403) and never calls the agent', async () => {
      await expect(set.create({ depot: 'KANDY', runDate: '2026-04-07' }, { principal: personas.nilanthi, headers: {} })).rejects.toMatchObject({ status: 403 });
      await expect(
        set.create({ depot: 'KANDY', runDate: '2026-04-07' }, { principal: personas.nilanthi, headers: { authorization: 'Basic abc' } }),
      ).rejects.toMatchObject({ status: 403 });
      verify(agent.startRun(anything(), anything(), anything())).never();
    });

    it('fails with 502 when the agent returns no run id', async () => {
      when(agent.startRun(anything(), anything(), anything())).thenResolve({} as any);
      await expect(set.create({ depot: 'KANDY', runDate: '2026-04-07' }, { principal: personas.nilanthi, headers })).rejects.toMatchObject({ status: 502 });
      verify(runs.create(anything())).never();
    });
  });

  describe('findFirst refresh', () => {
    const live = { id: 'run-1', status: 'DRAFTING', lastSyncedAt: null };
    const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext({ principal: personas.nilanthi, headers }, fn);

    it('refreshes a live run from the agent with the caller token', async () => {
      when(runs.findFirst(anything())).thenResolve(live, { ...live, status: 'NEEDS_APPROVAL' });
      when(agent.getRun('run-1', AUTH)).thenResolve({ id: 'run-1', status: 'needs_approval' });
      const row = await inRequest(() => set.findFirst({ where: { id: 'run-1' } }));
      expect(row.status).toBe('NEEDS_APPROVAL');
      const upd = capture(runs.update).last()[0];
      expect(upd.where).toEqual({ id: 'run-1' });
      expect(upd.data).toMatchObject({ status: 'NEEDS_APPROVAL' });
    });

    it('keeps the last known state when the agent fails', async () => {
      when(runs.findFirst(anything())).thenResolve(live, live);
      when(agent.getRun(anything(), anything())).thenReject(new ODataError(503, 'ServiceUnavailable', 'down'));
      await expect(inRequest(() => set.findFirst({ where: { id: 'run-1' } }))).resolves.toEqual(live);
      verify(runs.update(anything())).never();
    });

    it('skips the refresh outside a request, for terminal runs and for recently synced runs', async () => {
      when(runs.findFirst(anything())).thenResolve(live, live);
      await set.findFirst({ where: { id: 'run-1' } });
      when(runs.findFirst(anything())).thenResolve({ id: 'run-1', status: 'APPROVED' }, { id: 'run-1', status: 'APPROVED' });
      await inRequest(() => set.findFirst({ where: { id: 'run-1' } }));
      when(runs.findFirst(anything())).thenResolve({ id: 'run-1', status: 'DRAFTING', lastSyncedAt: new Date() }, { id: 'run-1' });
      await inRequest(() => set.findFirst({ where: { id: 'run-1' } }));
      verify(agent.getRun(anything(), anything())).never();
    });

    it('returns null when the row is not found', async () => {
      when(runs.findFirst(anything())).thenResolve(null);
      await expect(inRequest(() => set.findFirst({ where: { id: 'nope' } }))).resolves.toBeNull();
    });
  });

  describe('Lodestar.Resume', () => {
    const entity = { id: 'run-1', status: 'NEEDS_APPROVAL', depot: 'KANDY', runDate: RUN_DATE, planId: null as string | null };
    let rows: Record<string, any>;
    let calls: string[];

    /** agentRun.update merges into a stored row, like the database would. */
    function seed(row: Record<string, any>) {
      rows = { [row.id]: { ...row } };
      calls = [];
      when(runs.update(anything())).thenCall(async (a: any) => {
        calls.push(`update:${Object.keys(a.data).sort().join(',')}`);
        rows[a.where.id] = { ...(rows[a.where.id] ?? { id: a.where.id }), ...a.data };
        return { ...rows[a.where.id] };
      });
      when(planning.createAgentPlan(anything(), anything(), anything())).thenCall(async () => {
        calls.push('createAgentPlan');
        return { id: 'PLK-2026-04-07-v3' };
      });
      when(planning.approvePlan(anything(), anything(), anything(), anything())).thenCall(async () => {
        calls.push('approvePlan');
        return {};
      });
      when(audit.record(anything())).thenCall(async () => void calls.push('audit'));
    }

    beforeEach(() => seed(entity));

    it('rejects an unknown decision with 400', async () => {
      await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'maybe' }, entity, headers })).rejects.toMatchObject({ status: 400 });
      verify(agent.resume(anything(), anything(), anything(), anything(), anything())).never();
    });

    it('rejects edit without edits with 400', async () => {
      await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'edit', edits: [] }, entity, headers })).rejects.toMatchObject({
        status: 400,
        target: 'edits',
      });
      verify(agent.resume(anything(), anything(), anything(), anything(), anything())).never();
    });

    it('passes the agent 409 (run not waiting for approval) through', async () => {
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenReject(ODataError.conflict('not waiting'));
      await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'approve' }, entity, headers })).rejects.toMatchObject({ status: 409 });
      verify(runs.update(anything())).never();
      verify(planning.approvePlan(anything(), anything(), anything(), anything())).never();
    });

    it('records the agent state and decision right after the agent call', async () => {
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'needs_approval' });
      await set.resume({ principal: personas.nilanthi, params: { decision: 'edit', edits: [{ op: 'move' }] }, entity, headers });
      const [first] = capture(runs.update).first();
      expect(first.where).toEqual({ id: 'run-1' });
      expect(first.data).toMatchObject({ status: 'NEEDS_APPROVAL', decision: 'edit', decidedBy: 'nilanthi' });
      expect(first.data.detail).toEqual({ id: 'run-1', status: 'needs_approval' });
      expect(first.data.lastSyncedAt).toBeInstanceOf(Date);
      expect(first.data).not.toHaveProperty('planId');
    });

    it('on an approved run without a plan: records state, stores the draft, links it, publishes and audits — in that order', async () => {
      const snapshot = { id: 'run-1', status: 'approved', plan: { trips: [] } };
      when(agent.resume('run-1', AUTH, 'approve', undefined, 'ship it')).thenResolve(snapshot);

      const run = await set.resume({ principal: personas.nilanthi, params: { decision: 'APPROVE', comment: 'ship it' }, entity, headers });

      expect(calls).toEqual([
        'update:decidedBy,decision,detail,lastSyncedAt,status',
        'createAgentPlan',
        'update:planId',
        'approvePlan',
        'audit',
      ]);
      expect(capture(planning.createAgentPlan).last()).toEqual([entity, snapshot, 'nilanthi']);
      expect(capture(runs.update).second()[0]).toEqual({ where: { id: 'run-1' }, data: { planId: 'PLK-2026-04-07-v3' } });
      verify(planning.approvePlan('PLK-2026-04-07-v3', 'nilanthi', 'Approved via planning-agent run run-1', undefined)).once();
      const [event] = capture(audit.record).last();
      expect(event).toMatchObject({ actor: 'nilanthi', action: 'Plans.Approve', entitySet: 'Plans', entityKey: 'PLK-2026-04-07-v3', outcome: 'SUCCESS' });
      expect(run).toMatchObject({ id: 'run-1', status: 'APPROVED', decision: 'approve', decidedBy: 'nilanthi', planId: 'PLK-2026-04-07-v3' });
      verify(runs.update(anything())).twice();
    });

    it('refuses to approve a draft with violations without an override reason, before the agent records anything', async () => {
      when(agent.getRun('run-1', AUTH)).thenResolve({ id: 'run-1', status: 'NEEDS_APPROVAL', violations: [{ rule: 'mall' }] });
      await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'approve', overrideReason: '  ' }, entity, headers })).rejects.toMatchObject({
        status: 422, code: 'OverrideReasonRequired', target: 'overrideReason',
      });
      verify(agent.resume(anything(), anything(), anything(), anything(), anything())).never();
      verify(runs.update(anything())).never();
    });

    it('approves a draft with violations given a reason, and records it on the plan and in the audit', async () => {
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'APPROVED', violations: [{ rule: 'mall' }] });
      await set.resume({ principal: personas.nilanthi, params: { decision: 'approve', overrideReason: ' Mall agreed a late slot ' }, entity, headers });
      verify(agent.getRun(anything(), anything())).never();
      verify(planning.approvePlan('PLK-2026-04-07-v3', 'nilanthi', 'Approved via planning-agent run run-1', 'Mall agreed a late slot')).once();
      expect(capture(audit.record).last()[0].payload).toEqual({ via: 'AgentRuns.Resume', agentRunId: 'run-1', overrideReason: 'Mall agreed a late slot' });
    });

    it('keeps the decision and plan link when publishing fails', async () => {
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'APPROVED' });
      when(planning.approvePlan(anything(), anything(), anything(), anything())).thenReject(ODataError.conflict('Plan is PUBLISHED'));
      await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'approve' }, entity, headers })).rejects.toMatchObject({ status: 409 });
      expect(rows['run-1']).toMatchObject({ status: 'APPROVED', decision: 'approve', decidedBy: 'nilanthi', planId: 'PLK-2026-04-07-v3' });
      verify(audit.record(anything())).never();
    });

    it('reuses the planId already on the run', async () => {
      seed({ ...entity, planId: 'PLK-X' });
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'APPROVED' });
      const run = await set.resume({ principal: personas.nilanthi, params: { decision: 'approve' }, entity: { ...entity, planId: 'PLK-X' }, headers });
      verify(planning.createAgentPlan(anything(), anything(), anything())).never();
      verify(planning.approvePlan('PLK-X', 'nilanthi', anything(), undefined)).once();
      verify(runs.update(anything())).once();
      expect(run.planId).toBe('PLK-X');
    });

    describe('edit on an approved (live) run', () => {
      const live = { ...entity, status: 'APPROVED', planId: 'PLK-2026-04-07-v1' };
      const edits = [{ op: 'move', orderId: 'ORD1', vehicleId: 'VEH057', tripNo: 2 }];
      const basis = { planId: 'PLK-2026-04-07-v1', version: 1, lockedOrderIds: ['ORD9'], lockedTrips: [{ vehicleId: 'VEH054', tripNo: 1 }] };

      it('starts the next version as a new draft run seeded from the live plan, with started trips locked', async () => {
        when(planning.revisionBasis(anything())).thenResolve(basis);
        when(agent.reviseRun(anything(), anything(), anything())).thenResolve({ id: 'run-2', status: 'needs_approval', version: 2, revisionOf: 'run-1' });
        const row = await set.resume({ principal: personas.nilanthi, params: { decision: 'edit', edits, comment: ' Move ORD1 to VEH057 trip 2 ' }, entity: live, headers });
        expect(capture(agent.reviseRun).last()).toEqual(['run-1', AUTH, { edits, version: 1, lockedOrderIds: ['ORD9'], lockedTrips: [{ vehicleId: 'VEH054', tripNo: 1 }], comment: 'Move ORD1 to VEH057 trip 2' }]);
        const args = capture(runs.create).last()[0];
        expect(args.data).toMatchObject({ id: 'run-2', depot: 'KANDY', runDate: RUN_DATE, requestedBy: 'nilanthi', status: 'NEEDS_APPROVAL' });
        expect(row.id).toBe('run-2');
        verify(agent.resume(anything(), anything(), anything(), anything(), anything())).never();
        verify(runs.update(anything())).never();
        verify(planning.approvePlan(anything(), anything(), anything(), anything())).never();
      });

      it('passes a refusal (plan not live, a revision already waiting) through without asking the agent', async () => {
        when(planning.revisionBasis(anything())).thenReject(ODataError.conflict('Plan PLK-2026-04-07-v1 is SUPERSEDED, not live'));
        await expect(set.resume({ principal: personas.nilanthi, params: { decision: 'edit', edits }, entity: live, headers })).rejects.toMatchObject({ status: 409 });
        verify(agent.reviseRun(anything(), anything(), anything())).never();
      });
    });

    it('does not publish when the agent did not approve, or on reject/edit', async () => {
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'NEEDS_APPROVAL' });
      await set.resume({ principal: personas.nilanthi, params: { decision: 'approve' }, entity, headers });
      await set.resume({ principal: personas.nilanthi, params: { decision: 'edit', edits: [{ op: 'move' }] }, entity, headers });
      when(agent.resume(anything(), anything(), anything(), anything(), anything())).thenResolve({ id: 'run-1', status: 'REJECTED' });
      const run = await set.resume({ principal: personas.nilanthi, params: { decision: 'reject' }, entity, headers });
      expect(run).toMatchObject({ status: 'REJECTED', decision: 'reject' });
      expect(capture(agent.resume).second()).toEqual(['run-1', AUTH, 'edit', [{ op: 'move' }], undefined]);
      verify(planning.createAgentPlan(anything(), anything(), anything())).never();
      verify(planning.approvePlan(anything(), anything(), anything(), anything())).never();
      verify(audit.record(anything())).never();
    });
  });


  describe('Lodestar.Ask', () => {
    it('trims the question and forwards the caller token', async () => {
      when(agent.ask('run-1', 'why?', AUTH)).thenResolve({ answer: 'because' });
      await expect(set.ask({ principal: personas.nilanthi, params: { question: '  why?  ' }, entity: { id: 'run-1' }, headers })).resolves.toEqual({
        answer: 'because',
      });
    });

    it.each(['   ', 'x'.repeat(2001)])('rejects an empty or too long question with 400', (question) => {
      expect(() => set.ask({ principal: personas.nilanthi, params: { question }, entity: { id: 'run-1' }, headers })).toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });
  });
});
