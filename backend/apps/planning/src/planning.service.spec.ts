import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { CapacityService } from './capacity.service';
import { DeferralScoringService } from './deferral-scoring.service';
import { EtaService } from './eta.service';
import { NotifyClient } from '@lodestar/security';
import { dayRange, PlanningService, touched } from './planning.service';
import { executePlan, type ExecutionResult } from './plan-execution';

// Plan execution (trips, stops, deferrals) is covered in plan-execution.spec.ts against an in-memory store.
jest.mock('./plan-execution', () => ({ ...jest.requireActual('./plan-execution'), executePlan: jest.fn() }));
const executed = executePlan as jest.MockedFunction<typeof executePlan>;

const EXECUTION: ExecutionResult = {
  planId: 'PLK-2026-04-07-v2', depot: 'KANDY', runDate: '2026-04-07',
  trips: [{ id: 'TRP-VEH057-20260407-1', vehicleId: 'VEH057', driverId: 'ruwan', bay: 'K1', outletIds: ['OUT106'] }],
  planned: [{ orderId: 'ORD1', outletId: 'OUT106', tripId: 'TRP-VEH057-20260407-1', etaModel: '2026-04-07T01:05:00.000Z' }],
  deferred: [{ orderId: 'ORD2', outletId: 'OUT108', reason: 'CAP_REEFER', rescheduledDate: '2026-04-08' }],
  atRisk: [], locked: [], supersededTrips: 0,
};

interface PlanDelegate {
  findUnique(args: any): Promise<any>;
  findFirst(args: any): Promise<any>;
  updateMany(args: any): Promise<{ count: number }>;
  update(args: any): Promise<any>;
}

describe('dayRange', () => {
  it('normalises strings and dates to a UTC day', () => {
    const r = dayRange('2026-04-07T18:45:00+05:30');
    expect(r.iso).toBe('2026-04-07');
    expect(r.start.toISOString()).toBe('2026-04-07T00:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-04-08T00:00:00.000Z');
    expect(dayRange(new Date('2026-04-07T13:00:00.000Z')).iso).toBe('2026-04-07');
  });
});

describe('PlanningService', () => {
  let plan: PlanDelegate;
  let txPlan: PlanDelegate;
  let capacity: CapacityService;
  let scoring: DeferralScoringService;
  let service: PlanningService;
  let notify: NotifyClient;
  let users: { findMany: jest.Mock };
  let stops: { findMany: jest.Mock };

  beforeEach(() => {
    plan = mock<PlanDelegate>();
    txPlan = mock<PlanDelegate>();
    capacity = mock(CapacityService);
    scoring = new DeferralScoringService();
    notify = mock(NotifyClient);
    when(notify.notice(anything())).thenResolve(true);
    when(notify.publish(anything(), anything(), anything())).thenResolve(true);
    users = { findMany: jest.fn().mockResolvedValue([{ id: 'fathima', outletId: 'OUT106' }, { id: 'hawa-sm', outletId: 'OUT108' }]) };
    executed.mockReset().mockResolvedValue(EXECUTION);
    stops = { findMany: jest.fn().mockResolvedValue([]) };
    const tx = { plan: instance(txPlan), tripStop: stops };
    const prisma = { plan: instance(plan), user: users, $transaction: async (cb: (t: any) => any) => cb(tx) };
    service = new PlanningService(prisma as any, scoring, instance(capacity), instance(notify));
  });

  describe('approvePlan', () => {
    const open = { id: 'PLK-2026-04-07-v2', depot: 'KANDY', runDate: new Date('2026-04-07T00:00:00.000Z'), status: 'NEEDS_APPROVAL' };

    it('supersedes other published versions and publishes this one', async () => {
      when(txPlan.findUnique(anything())).thenResolve(open);
      when(txPlan.updateMany(anything())).thenResolve({ count: 1 });
      when(txPlan.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));

      const res = await service.approvePlan(open.id, 'nilanthi', 'looks good');

      const [many] = capture(txPlan.updateMany).last();
      expect(many).toEqual({
        where: { depot: 'KANDY', runDate: open.runDate, status: 'PUBLISHED', id: { not: open.id } },
        data: { status: 'SUPERSEDED' },
      });
      const [upd] = capture(txPlan.update).last();
      expect(upd.where).toEqual({ id: open.id });
      expect(upd.data).toMatchObject({ status: 'PUBLISHED', approvedBy: 'nilanthi', notes: 'looks good' });
      expect(upd.data.approvedAt).toBeInstanceOf(Date);
      expect(upd.data.publishedAt).toBe(upd.data.approvedAt);
      expect(res.status).toBe('PUBLISHED');
    });

    it('an auto-plan approved as a plan closes its agent run, so the run is no longer offered for approval', async () => {
      when(txPlan.findUnique(anything())).thenResolve({ ...open, agentRunId: 'run-7' });
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      when(txPlan.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));
      const agentRun = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
      const tx = { plan: instance(txPlan), agentRun };
      const svc = new PlanningService({ user: users, $transaction: async (cb: (t: any) => any) => cb(tx) } as any, scoring, instance(capacity), instance(notify));
      await svc.approvePlan(open.id, 'nilanthi');
      expect(agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'run-7', status: 'NEEDS_APPROVAL' },
        data: { status: 'APPROVED', decision: 'approve', decidedBy: 'nilanthi', planId: open.id },
      });
    });

    it('puts the plan into effect in the same transaction, then tells stores, dock and drivers', async () => {
      when(txPlan.findUnique(anything())).thenResolve(open);
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      when(txPlan.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));

      await service.approvePlan(open.id, 'nilanthi');

      expect(executed).toHaveBeenCalledTimes(1);
      expect(executed.mock.calls[0][1]).toBe(open);
      const notices = capture(notify.notice);
      expect(notices.first()[0]).toMatchObject({ recipientId: 'fathima', type: 'PLAN_PUBLISHED', outletId: 'OUT106' });
      expect(notices.second()[0]).toMatchObject({
        recipientId: 'hawa-sm', type: 'ORDER_DEFERRED', outletId: 'OUT108',
        payload: { orderId: 'ORD2', reason: 'CAP_REEFER', rescheduledDate: '2026-04-08' },
      });
      const [event, rooms, payload] = capture(notify.publish).last();
      expect(event).toBe('plan_published');
      expect(rooms).toEqual(['dispatcher:KANDY', 'loader:KANDY', 'store:OUT106', 'store:OUT108', 'driver:ruwan']);
      expect(payload).toMatchObject({ planId: open.id, trips: 1, planned: 1, deferred: 1 });
    });

    it('a later version replacing a live one tells only the stores and drivers it touches', async () => {
      when(txPlan.findUnique(anything())).thenResolve(open);
      when(txPlan.updateMany(anything())).thenResolve({ count: 1 });
      when(txPlan.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));
      // ORD1 was on the same trip at the same time: OUT106 and its driver are not touched; ORD2 is newly deferred
      stops.findMany.mockResolvedValue([{ orderId: 'ORD1', tripId: 'TRP-VEH057-20260407-1', etaModel: new Date('2026-04-07T01:05:00.000Z'), trip: { driverId: 'ruwan' } }]);
      await service.approvePlan(open.id, 'nilanthi');
      expect(stops.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { trip: { depot: 'KANDY', runDate: open.runDate } } }));
      const notices = capture(notify.notice);
      expect(notices.first()[0]).toMatchObject({ recipientId: 'hawa-sm', type: 'ORDER_DEFERRED', outletId: 'OUT108' });
      verify(notify.notice(anything())).once();
      expect(capture(notify.publish).last()[1]).toEqual(['dispatcher:KANDY', 'loader:KANDY', 'store:OUT108']);
    });

    it('a plan that went live stays live when the store notices fail: the dock is told first', async () => {
      when(txPlan.findUnique(anything())).thenResolve(open);
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      when(txPlan.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, ...a.data }));
      users.findMany.mockRejectedValue(new Error("Can't reach database server"));
      await expect(service.approvePlan(open.id, 'nilanthi')).resolves.toMatchObject({ status: 'PUBLISHED' });
      expect(capture(notify.publish).last()[0]).toBe('plan_published');
    });

    it('does not publish when the plan cannot be put into effect', async () => {
      when(txPlan.findUnique(anything())).thenResolve(open);
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      executed.mockRejectedValueOnce(Object.assign(new Error('no trips'), { status: 409, code: 'PlanNotExecutable' }));
      await expect(service.approvePlan(open.id, 'nilanthi')).rejects.toMatchObject({ code: 'PlanNotExecutable' });
      verify(txPlan.update(anything())).never();
      verify(notify.publish(anything(), anything(), anything())).never();
    });

    it('omits notes when no note is given', async () => {
      when(txPlan.findUnique(anything())).thenResolve({ ...open, status: 'DRAFT' });
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      when(txPlan.update(anything())).thenCall(async (a: any) => a.data);
      const data = await service.approvePlan(open.id, 'nilanthi');
      expect(data).not.toHaveProperty('notes');
    });

    it('refuses a plan that is not open with 409', async () => {
      when(txPlan.findUnique(anything())).thenResolve({ ...open, status: 'PUBLISHED' });
      await expect(service.approvePlan(open.id, 'nilanthi')).rejects.toMatchObject({ status: 409 });
      verify(txPlan.updateMany(anything())).never();
      verify(txPlan.update(anything())).never();
    });

    it('404 when the plan does not exist', async () => {
      when(txPlan.findUnique(anything())).thenResolve(null);
      await expect(service.approvePlan('nope', 'nilanthi')).rejects.toMatchObject({ status: 404 });
    });

    describe('a plan drafted with hard-rule violations', () => {
      const summary = { plan: { trips: [] }, violations: [{ rule: 'window', orderIds: ['O-1'] }, { rule: 'fuel', orderIds: ['O-2'] }] };

      beforeEach(() => {
        when(txPlan.findUnique(anything())).thenResolve({ ...open, summary });
        when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
        when(txPlan.update(anything())).thenCall(async (a: any) => a.data);
      });

      it.each([undefined, '', '   '])('is refused without an override reason (%p → 422 OverrideReasonRequired)', async (reason) => {
        await expect(service.approvePlan(open.id, 'nilanthi', 'ok', reason)).rejects.toMatchObject({
          status: 422, code: 'OverrideReasonRequired', target: 'overrideReason',
        });
        expect(executed).not.toHaveBeenCalled();
        verify(txPlan.update(anything())).never();
      });

      it('is published with a reason, which is kept on the plan', async () => {
        const data = await service.approvePlan(open.id, 'nilanthi', 'ok', ' Reefer swap agreed with the depot manager ');
        expect(data.summary).toEqual({
          ...summary,
          override: { reason: 'Reefer swap agreed with the depot manager', by: 'nilanthi', at: expect.any(String), violations: 2 },
        });
        expect(data).toMatchObject({ status: 'PUBLISHED', notes: 'ok' });
      });
    });

    it('a plan without violations needs no reason and keeps its summary', async () => {
      when(txPlan.findUnique(anything())).thenResolve({ ...open, summary: { violations: [] } });
      when(txPlan.updateMany(anything())).thenResolve({ count: 0 });
      when(txPlan.update(anything())).thenCall(async (a: any) => a.data);
      const data = await service.approvePlan(open.id, 'nilanthi');
      expect(data).toMatchObject({ status: 'PUBLISHED' });
      expect(data).not.toHaveProperty('summary');
    });
  });

  describe('revisionBasis (a change to an approved run)', () => {
    const run = { id: 'run-1', depot: 'KANDY', runDate: new Date('2026-04-07T00:00:00.000Z') };
    const make = (plan: any, waiting: any = null) => {
      const prisma = {
        plan: { findFirst: jest.fn().mockResolvedValue(plan) },
        agentRun: { findFirst: jest.fn().mockResolvedValue(waiting) },
        trip: { findMany: jest.fn().mockResolvedValue([{ vehicleId: 'VEH054', tripNumber: 1, stops: [{ orderId: 'ORD9' }, { orderId: 'ORD8' }] }]) },
      };
      return { prisma, svc: new PlanningService(prisma as any, scoring, instance(capacity), instance(notify)) };
    };

    it('starts from the live version and locks the started trips', async () => {
      const { prisma, svc } = make({ id: 'PLK-2026-04-07-v1', version: 1, status: 'PUBLISHED' });
      await expect(svc.revisionBasis(run)).resolves.toEqual({
        planId: 'PLK-2026-04-07-v1', version: 1, lockedOrderIds: ['ORD9', 'ORD8'], lockedTrips: [{ vehicleId: 'VEH054', tripNo: 1 }],
      });
      expect(prisma.plan.findFirst.mock.calls[0][0].where).toEqual({ agentRunId: 'run-1' });
      expect(prisma.trip.findMany.mock.calls[0][0].where).toEqual({ depot: 'KANDY', runDate: run.runDate, status: { in: ['LOADING', 'ENROUTE', 'COMPLETE'] } });
    });

    it('refuses a run without a plan, a plan that is no longer live, and a second revision while one waits', async () => {
      await expect(make(null).svc.revisionBasis(run)).rejects.toMatchObject({ status: 409 });
      await expect(make({ id: 'PLK-2026-04-07-v1', version: 1, status: 'SUPERSEDED' }).svc.revisionBasis(run)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('SUPERSEDED') });
      await expect(make({ id: 'PLK-2026-04-07-v1', version: 1, status: 'PUBLISHED' }, { id: 'run-2' }).svc.revisionBasis(run)).rejects.toMatchObject({
        status: 409, message: expect.stringContaining('run-2'),
      });
    });
  });

  describe('assertOperatingDay', () => {
    it('refuses a run date the Calendar marks as non-operating (422 NonOperatingDay); a silent calendar runs', async () => {
      const calendar = { findUnique: jest.fn() };
      const svc = new PlanningService({ calendar } as any, scoring, instance(capacity), instance(notify));
      calendar.findUnique.mockResolvedValueOnce({ isOperating: false });
      await expect(svc.assertOperatingDay('2026-04-12')).rejects.toMatchObject({ status: 422, code: 'NonOperatingDay', target: 'runDate' });
      expect(calendar.findUnique).toHaveBeenLastCalledWith({ where: { date: new Date('2026-04-12T00:00:00.000Z') }, select: { isOperating: true } });
      calendar.findUnique.mockResolvedValueOnce({ isOperating: true });
      await expect(svc.assertOperatingDay('2026-04-13')).resolves.toBeUndefined();
      calendar.findUnique.mockResolvedValueOnce(null);
      await expect(svc.assertOperatingDay('2026-04-14')).resolves.toBeUndefined();
    });

    it('runAutoPlan checks the day before planning anything', async () => {
      const calendar = { findUnique: jest.fn().mockResolvedValue({ isOperating: false }) };
      const svc = new PlanningService({ calendar } as any, scoring, instance(capacity), instance(notify));
      const draft = jest.fn();
      await expect(svc.runAutoPlan('KANDY' as any, '2026-04-12', 'nilanthi', draft)).rejects.toMatchObject({ code: 'NonOperatingDay' });
      expect(draft).not.toHaveBeenCalled();
    });

    const autoPlanSvc = (version = 1) => {
      const calendar = { findUnique: jest.fn().mockResolvedValue(null) };
      const agentRun = { create: jest.fn(async (a: any) => a.data), update: jest.fn(async (a: any) => a.data) };
      const planRows = { findFirst: jest.fn().mockResolvedValue({ version }), create: jest.fn(async (a: any) => a.data) };
      const svc = new PlanningService({ calendar, agentRun, plan: planRows } as any, scoring, instance(capacity), instance(notify));
      return { svc, agentRun, planRows };
    };

    it('runAutoPlan drafts with the agent and stores an executable AUTOPLAN version linked to the run', async () => {
      const { svc, agentRun, planRows } = autoPlanSvc(2);
      const trips = [{ tripId: 'VEH057-T1', vehicleId: 'VEH057', stops: [] }];
      const draft = jest.fn().mockResolvedValue({ id: 'run-7', status: 'needs_approval', plan: { trips }, violations: [], explanation: 'why' });
      const created = await svc.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', draft);
      expect(draft).toHaveBeenCalledWith('KANDY', '2026-04-07');
      expect(agentRun.create.mock.calls[0][0].data).toMatchObject({ id: 'run-7', depot: 'KANDY', status: 'NEEDS_APPROVAL', requestedBy: 'nilanthi' });
      expect(created).toMatchObject({ id: 'PLK-2026-04-07-v3', source: 'AUTOPLAN', status: 'NEEDS_APPROVAL', agentRunId: 'run-7', summary: { plan: { trips } } });
      expect(planRows.create).toHaveBeenCalledTimes(1);
      expect(agentRun.update).toHaveBeenCalledWith({ where: { id: 'run-7' }, data: { planId: 'PLK-2026-04-07-v3' } });
    });

    it('runAutoPlan stores no plan when the agent run has no trips to approve (409 AutoPlanIncomplete)', async () => {
      const { svc, agentRun, planRows } = autoPlanSvc();
      const empty = jest.fn().mockResolvedValue({ id: 'run-8', status: 'NEEDS_APPROVAL', plan: { trips: [] } });
      await expect(svc.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', empty)).rejects.toMatchObject({ status: 409, code: 'AutoPlanIncomplete' });
      const failed = jest.fn().mockResolvedValue({ id: 'run-9', status: 'FAILED' });
      await expect(svc.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', failed)).rejects.toMatchObject({ code: 'AutoPlanIncomplete' });
      expect(agentRun.create).toHaveBeenCalledTimes(2);
      expect(planRows.create).not.toHaveBeenCalled();
      await expect(svc.runAutoPlan('KANDY' as any, '2026-04-07', 'nilanthi', jest.fn().mockResolvedValue({}))).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('rejectPlan', () => {
    it('rejects open plans only', async () => {
      when(plan.findUnique(anything())).thenResolve({ id: 'P', status: 'DRAFT' });
      when(plan.update(anything())).thenCall(async (a: any) => a.data);
      await expect(service.rejectPlan('P', 'no')).resolves.toEqual({ status: 'REJECTED', notes: 'no' });
      when(plan.findUnique(anything())).thenResolve({ id: 'P', status: 'SUPERSEDED' });
      await expect(service.rejectPlan('P')).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('nextPlanId', () => {
    it('uses the PLG prefix for Peliyagoda and starts at v1', async () => {
      when(plan.findFirst(anything())).thenResolve(null);
      const next = await service.nextPlanId('PELIYAGODA', '2026-04-07');
      expect(next).toEqual({ id: 'PLG-2026-04-07-v1', version: 1, runDate: new Date('2026-04-07T00:00:00.000Z') });
      const [args] = capture(plan.findFirst).last();
      expect(args).toMatchObject({ where: { depot: 'PELIYAGODA', runDate: new Date('2026-04-07T00:00:00.000Z') }, orderBy: { version: 'desc' } });
    });

    it('uses the PLK prefix for Kandy and increments the last version', async () => {
      when(plan.findFirst(anything())).thenResolve({ version: 3 });
      const next = await service.nextPlanId('KANDY', '2026-04-07T00:00:00.000Z');
      expect(next.id).toBe('PLK-2026-04-07-v4');
      expect(next.version).toBe(4);
    });
  });

  describe('createAgentPlan', () => {
    interface CreateDelegate {
      create(a: any): Promise<any>;
    }

    it('stores the agent draft as a NEEDS_APPROVAL AGENT plan version', async () => {
      const create = mock<CreateDelegate>();
      when(create.create(anything())).thenCall(async (a: any) => a.data);
      when(plan.findFirst(anything())).thenResolve({ version: 2 });
      const prisma = { plan: Object.assign(instance(plan), { create: instance(create).create }) };
      const svc = new PlanningService(prisma as any, scoring, instance(capacity), instance(notify));

      const run = { id: 'run-1', depot: 'KANDY' as const, runDate: new Date('2026-04-07T00:00:00.000Z') };
      const data = await svc.createAgentPlan(run, { id: 'run-1', status: 'APPROVED', plan: { trips: 3 }, explanation: { why: 'x' }, violations: [] }, 'nilanthi');

      expect(data).toMatchObject({
        id: 'PLK-2026-04-07-v3',
        version: 3,
        depot: 'KANDY',
        status: 'NEEDS_APPROVAL',
        source: 'AGENT',
        agentRunId: 'run-1',
        createdBy: 'nilanthi',
        explanation: '{"why":"x"}',
        summary: { plan: { trips: 3 }, contextSummary: null, ruleChecks: null, violations: [], deferrals: null, needsReview: null },
      });

      const plain = await svc.createAgentPlan(run, { explanation: 'because' }, 'nilanthi');
      expect(plain.explanation).toBe('because');
      const none = await svc.createAgentPlan(run, {}, 'nilanthi');
      expect(none.explanation).toBeNull();
    });
  });

  describe('suggestDeferrals', () => {
    const order = (id: string, computedScore: number, m3: number, extra: Record<string, any> = {}) => ({
      id,
      computedScore,
      m3,
      daysSince: 1,
      tempClass: 'CHILLED',
      isProtected: false,
      ...extra,
    });

    function stubPlan(shortM3: number, orders: any[]) {
      jest.spyOn(service, 'getPlan').mockResolvedValue({ summary: { chilled: { shortM3 } }, trips: [], orders } as any);
    }

    it('picks the lowest-scoring unprotected chilled orders until the shortfall is covered', async () => {
      stubPlan(5, [
        order('A', 40, 3),
        order('B', 10, 3),
        order('C', 95, 10, { isProtected: true }),
        order('D', 20, 3),
        order('E', 5, 10, { tempClass: 'AMBIENT' }),
      ]);
      const { suggestions } = await service.suggestDeferrals('PELIYAGODA', '2026-04-07');
      expect(suggestions.map((s) => s.orderId)).toEqual(['B', 'D']);
      expect(suggestions[0]).toMatchObject({ reason: 'CAP_REEFER', score: 10 });
      expect(suggestions[0].notes).toContain('Chilled short 5.0');
    });

    it('never suggests protected orders even if nothing else is left', async () => {
      stubPlan(50, [order('C', 95, 10, { isProtected: true }), order('X', 12, 1)]);
      const { suggestions } = await service.suggestDeferrals('PELIYAGODA', '2026-04-07');
      expect(suggestions.map((s) => s.orderId)).toEqual(['X']);
    });

    it('suggests nothing without a shortfall', async () => {
      stubPlan(0, [order('A', 1, 1)]);
      await expect(service.suggestDeferrals('KANDY', '2026-04-07')).resolves.toMatchObject({ suggestions: [] });
    });
  });
});

describe('DeferralScoringService', () => {
  const s = new DeferralScoringService();
  const base = { deferredYesterday: false, daysSince: 0, tempClass: 'AMBIENT' as any, brand: 'STYLE' as any, windowOpen: '09:00', nextRunWithin24h: false };

  it('applies each term of the formula', () => {
    expect(s.computeScore(base)).toBe(0);
    expect(s.computeScore({ ...base, deferredYesterday: true })).toBe(40);
    expect(s.computeScore({ ...base, daysSince: 2 })).toBe(24);
    expect(s.computeScore({ ...base, tempClass: 'CHILLED' as any })).toBe(15);
    expect(s.computeScore({ ...base, brand: 'FRESH' as any, windowOpen: '05:30' })).toBe(10);
    expect(s.computeScore({ ...base, brand: 'FRESH' as any, windowOpen: '08:00' })).toBe(0);
    expect(s.computeScore({ ...base, daysSince: 3, nextRunWithin24h: true })).toBe(26);
    expect(s.computeScore({ ...base, daysSince: 5, stockCoverDays: 10 })).toBe(40); // cover capped at -20
    expect(s.computeScore({ ...base, daysSince: 5, stockCoverDays: 2 })).toBe(50);
  });

  it('never goes below zero', () => {
    expect(s.computeScore({ ...base, nextRunWithin24h: true, stockCoverDays: 10 })).toBe(0);
  });

  it('combines to a protected score', () => {
    const score = s.computeScore({ ...base, deferredYesterday: true, daysSince: 3, tempClass: 'CHILLED' as any, brand: 'FRESH' as any, windowOpen: '05:30' });
    expect(score).toBe(101);
    expect(s.isProtected(score)).toBe(true);
  });

  it('isProtected / isDeferralCandidate thresholds', () => {
    expect(s.isProtected(90)).toBe(false);
    expect(s.isProtected(91)).toBe(true);
    expect(s.isDeferralCandidate(29)).toBe(true);
    expect(s.isDeferralCandidate(30)).toBe(false);
  });
});

describe('EtaService.computeModelEta', () => {
  const eta = new EtaService({} as any);
  // Sri Lanka wall-clock times on the hero day; independent of the server's TZ.
  const at = (h: number, m = 0) => new Date(`2026-04-07T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`);
  const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

  it('hill road in monsoon before 6 AM: speed index 64 → +29 min, ±20 band, 20% risk', () => {
    const r = eta.computeModelEta({ etaPlan: at(5), roadClass: 'hill', isMonsoon: true, plannedHour: 5, windowClose: '08:00' });
    expect(minutesBetween(at(5), r.etaModel)).toBe(29);
    expect(minutesBetween(r.bandEarly, r.etaModel)).toBe(20);
    expect(minutesBetween(r.etaModel, r.bandLate)).toBe(20);
    expect(r.lateRiskPct).toBe(20);
  });

  it('hill road in monsoon at 7 AM: speed index 48 → +42 min, near window close adds 30%', () => {
    const r = eta.computeModelEta({ etaPlan: at(7), roadClass: 'hill', isMonsoon: true, plannedHour: 7, windowClose: '08:00' });
    expect(minutesBetween(at(7), r.etaModel)).toBe(42);
    expect(r.lateRiskPct).toBe(83);
  });

  it('urban roads: no delay before 6 AM, +10 after, 15-min band, 8% risk', () => {
    const early = eta.computeModelEta({ etaPlan: at(5), roadClass: 'urban', isMonsoon: true, plannedHour: 5, windowClose: '08:00' });
    expect(early.etaModel.getTime()).toBe(at(5).getTime());
    expect(minutesBetween(early.bandEarly, early.etaModel)).toBe(15);
    expect(early.lateRiskPct).toBe(8);
    const later = eta.computeModelEta({ etaPlan: at(7), roadClass: 'urban', isMonsoon: false, plannedHour: 7, windowClose: '08:00' });
    expect(minutesBetween(at(7), later.etaModel)).toBe(10);
    expect(later.lateRiskPct).toBe(8);
  });

  it('hill road outside monsoon is treated like an unknown road class', () => {
    const r = eta.computeModelEta({ etaPlan: at(5), roadClass: 'hill', isMonsoon: false, plannedHour: 5, windowClose: '08:00' });
    expect(r.etaModel.getTime()).toBe(at(5).getTime());
    expect(r.lateRiskPct).toBe(5);
  });

  it('getServiceMin falls back to 15 minutes', async () => {
    interface SaDelegate {
      findUnique(a: any): Promise<any>;
    }
    const sa = mock<SaDelegate>();
    when(sa.findUnique(anything())).thenResolve(null, { minutes: 25 });
    const svc = new EtaService({ serviceAllowance: instance(sa) } as any);
    await expect(svc.getServiceMin('FRESH', 'STREET')).resolves.toBe(15);
    await expect(svc.getServiceMin('FRESH', 'STREET')).resolves.toBe(25);
  });
});


describe('touched (who a newly live version tells)', () => {
  const x = (over: Partial<ExecutionResult> = {}): ExecutionResult => ({ ...EXECUTION, deferred: [], ...over });
  const was = (orderId: string, tripId: string, eta: string | null, driverId: string | null = 'ruwan') => ({ orderId, tripId, etaModel: eta ? new Date(eta) : null, trip: { driverId } });

  it('a first version touches everyone on it', () => {
    expect(touched(x(), null)).toEqual({ planned: EXECUTION.planned, drivers: ['ruwan'] });
  });

  it('an order moved to another trip touches its store, the new driver and the old one', () => {
    const moved = x({
      trips: [{ id: 'TRP-VEH057-20260407-2', vehicleId: 'VEH057', driverId: 'ruwan', bay: 'K1', outletIds: ['OUT106'] }],
      planned: [{ orderId: 'ORD1', outletId: 'OUT106', tripId: 'TRP-VEH057-20260407-2', etaModel: '2026-04-07T05:00:00.000Z' }],
    });
    const r = touched(moved, [was('ORD1', 'TRP-VEH042-20260407-1', '2026-04-07T01:05:00.000Z', 'kamal'), was('ORD3', 'TRP-VEH042-20260407-1', '2026-04-07T01:30:00.000Z', 'kamal')]);
    expect(r.planned.map(p => p.orderId)).toEqual(['ORD1']);
    expect(r.drivers.sort()).toEqual(['kamal', 'ruwan']);
  });

  it('a later arrival on the same trip touches the store; orders on started trips do not', () => {
    const r = touched(x({ locked: ['ORD9'] }), [was('ORD1', 'TRP-VEH057-20260407-1', '2026-04-07T00:40:00.000Z'), was('ORD9', 'TRP-VEH054-20260407-1', null, 'nimal')]);
    expect(r.planned.map(p => p.orderId)).toEqual(['ORD1']);
    expect(r.drivers).toEqual([]);
  });
});
