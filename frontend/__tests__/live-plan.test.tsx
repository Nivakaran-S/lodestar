// Live Plan screens against a mocked OData API (real ODataClient over a fake fetch).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import ScreenShell from '@/components/ScreenShell';
import CutoffQueue from '@/live/dsp-01-cutoff-queue';
import PlanBoard from '@/live/dsp-02-plan-board';
import DeferralDecision from '@/live/dsp-03-deferral-decision';
import ApproveAndGoLive from '@/live/dsp-12-approve-and-go-live';
import AskAgent from '@/live/dsp-39-ask-the-planning-agent';
import type { FakeRequest } from './helpers/live';
import { agentConfigReply, page, renderLive } from './helpers/live';
import { closeOverlay, currentOverlay } from '@/lib/overlay';
import { rulePairs } from '@/components/live/AskAgent';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/plan' }));

const DAY = '2026-04-07T00:00:00.000Z';
const outlet = (id: string, over = {}) => ({ id, name: `Outlet ${id}`, brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true, ...over });
const order = (id: string, over = {}) => ({ id, outletId: 'OUTT01', runDate: DAY, orderedAt: DAY, brand: 'FRESH', tempClass: 'AMBIENT', units: 10, kg: 100, m3: 1, status: 'RECEIVED', deferredYesterday: false, daysSince: 1, outlet: outlet('OUTT01'), ...over });
const vehicle = (id: string, over = {}) => ({ id, depot: 'KANDY', type: 'VAN', tempClass: 'CHILLED', capacityKg: 1000, capacityM3: 7, kmPerLitre: 10, weeklyLFuel: 400, usedLThisWeek: 100, status: 'AVAILABLE', ...over });

/** Common reads every Plan screen makes (sidebar counts, latest run date, fleet). */
function base(req: FakeRequest) {
  if (agentConfigReply(req)) return agentConfigReply(req);
  if (req.query.$top === '0') return page([], 2);
  // no open orders from today on (the test day is past): the desk falls back to the latest plan's run date
  if (req.path === 'Orders' && req.query.$select === 'runDate') return page([]);
  if (req.path === 'Plans' && req.query.$select === 'runDate') return page([{ runDate: DAY }]);
  if (req.path === 'Vehicles') return page([vehicle('VEHT1'), vehicle('VEHT2', { status: 'WORKSHOP', tempClass: 'AMBIENT', type: 'TRUCK' })]);
  return undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/plan');
});

const nav = (links: Record<string, string>) => ({ links: Object.fromEntries(Object.entries(links).map(([k, href]) => [k, { href, kind: 'go' }])) });

describe('DSP-01 Cutoff queue', () => {
  it('lists the run date’s orders, filters them, and starts a planning-agent draft', async () => {
    const queue = [order('ORDT1', { deferredYesterday: true, tempClass: 'CHILLED' }), order('ORDT2', { outlet: outlet('OUTT02', { parking: 'VAN_ONLY' }), outletId: 'OUTT02' })];
    const view = renderLive(
      <ScreenShell board="P2" nav={nav({ L1: '/plan/dsp-22-planning-agent-drafting' })} live><CutoffQueue /></ScreenShell>,
      {
        handler: req => base(req) ?? (req.path === 'Orders' ? page(queue, queue.length)
          : req.path === 'AgentRuns' && req.method === 'POST' ? { status: 201, body: { id: 'run-1', status: 'NEEDS_APPROVAL', depot: 'PELIYAGODA', runDate: DAY } }
            : page([])),
      },
    );
    const table = await screen.findByTestId('queue');
    expect(within(table).getByText('ORDT1')).toBeInTheDocument();
    expect(within(table).getByText('ORDT2')).toBeInTheDocument();
    expect(screen.getByText(/Protected · deferred yesterday/)).toBeInTheDocument();
    expect(screen.getByText('Cutoff queue for Tue 7 Apr')).toBeInTheDocument();
    expect(screen.getByTestId('queue-total')).toHaveTextContent('2');
    // the run date and the dispatcher's depots scope the request
    const q = view.calls.find(c => c.path === 'Orders' && c.query.$expand === 'outlet')!;
    expect(q.query.$filter).toContain('runDate ge 2026-04-07T00:00:00.000Z and runDate lt 2026-04-08T00:00:00.000Z');
    expect(q.query.$filter).toContain("outlet/depot in ('PELIYAGODA','KANDY')");

    fireEvent.click(screen.getByRole('button', { name: /^Chilled \d+$/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Orders' && c.query.$filter?.includes("tempClass eq 'CHILLED'"))).toBe(true));

    fireEvent.click(screen.getByTestId('start-agent'));
    // DSP-22 opens at once and shows the draft being made; the run is stored when the agent is done
    expect(router.push).toHaveBeenCalledWith('/plan/dsp-22-planning-agent-drafting');
    await waitFor(() => expect(window.sessionStorage.getItem('lodestar.agentRun')).toBe('run-1'));
    const post = view.calls.find(c => c.method === 'POST')!;
    expect(post).toMatchObject({ path: 'AgentRuns', body: { depot: 'PELIYAGODA', runDate: '2026-04-07T00:00:00.000Z' } });
    expect(window.sessionStorage.getItem('lodestar.agentRun')).toBe('run-1');
  });

  it('closes orders for the run with Orders/Lodestar.CloseOrders, shows the closed state, and reopens', async () => {
    let closed = false;
    const win = () => ({ depot: 'PELIYAGODA', runDate: '2026-04-07', closed, closedBy: closed ? 'u-d' : null, closedAt: closed ? '2026-04-06T11:00:00.000Z' : null, reason: null, reopenedBy: null, reopenedAt: null });
    const view = renderLive(<CutoffQueue />, {
      handler: req => {
        if (req.path.startsWith('Orders/Lodestar.OrderWindow(')) return win();
        if (req.path === 'Orders/Lodestar.CloseOrders') { closed = true; return win(); }
        if (req.path === 'Orders/Lodestar.ReopenOrders') { closed = false; return win(); }
        return base(req) ?? (req.path === 'Orders' ? page([order('ORDT1')], 1) : page([]));
      },
    });
    await screen.findByTestId('queue');
    const read = await waitFor(() => view.calls.find(c => c.path.startsWith('Orders/Lodestar.OrderWindow('))!);
    expect(read.path).toBe("Orders/Lodestar.OrderWindow(runDate=2026-04-07,depot='PELIYAGODA')");
    expect(screen.queryByTestId('orders-closed')).toBeNull();
    fireEvent.click(await screen.findByTestId('close-orders'));
    expect(await screen.findByTestId('orders-closed')).toHaveTextContent('Orders closed');
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: 'Orders/Lodestar.CloseOrders', body: { depot: 'PELIYAGODA', runDate: '2026-04-07' } });
    expect(screen.getByText(/Orders closed by dispatch/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reopen-orders'));
    await waitFor(() => expect(screen.queryByTestId('orders-closed')).toBeNull());
    expect(view.calls.filter(c => c.method === 'POST').map(c => c.path)).toEqual(['Orders/Lodestar.CloseOrders', 'Orders/Lodestar.ReopenOrders']);
  });

  it('opens on the first run from today that still has open orders (a new demo day), not the latest plan', async () => {
    const NEXT = '2026-04-09T00:00:00.000Z';
    const view = renderLive(<CutoffQueue />, {
      handler: req => (req.path === 'Orders' && req.query.$select === 'runDate' ? page([{ runDate: NEXT }]) : base(req) ?? (req.path === 'Orders' ? page([order('ORDT9', { runDate: NEXT })], 1) : page([]))),
    });
    expect(await screen.findByText('Cutoff queue for Thu 9 Apr')).toBeInTheDocument();
    const day = view.calls.find(c => c.path === 'Orders' && c.query.$select === 'runDate')!;
    expect(day.query).toMatchObject({ $orderby: 'runDate asc', $top: '1' });
    expect(day.query.$filter).toMatch(/^runDate ge \d{4}-\d{2}-\d{2}T00:00:00.000Z and status in \('RECEIVED','PLANNED','LOADED','ENROUTE','EXCEPTION'\)$/);
    // the latest plan's date is not asked for when the orders give the day
    expect(view.calls.some(c => c.path === 'Plans' && c.query.$select === 'runDate')).toBe(false);
  });

  it('reloads the queue on a new order, a published plan and every 30 s', async () => {
    jest.useFakeTimers();
    try {
      const view = renderLive(<CutoffQueue />, { handler: req => base(req) ?? (req.path === 'Orders' ? page([order('ORDT1')], 1) : page([])) });
      await screen.findByTestId('queue');
      const reads = () => view.calls.filter(c => c.path === 'Orders' && c.query.$select?.startsWith('id,brand')).length;
      const before = reads();
      act(() => view.hub.emit('order_created', { orderId: 'ORDT2' }));
      await waitFor(() => expect(reads()).toBe(before + 1));
      act(() => view.hub.emit('plan_published', { planId: 'PLT-v1' }));
      await waitFor(() => expect(reads()).toBe(before + 2));
      act(() => { jest.advanceTimersByTime(30_000); });
      await waitFor(() => expect(reads()).toBe(before + 3));
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the API error in the design’s banner', async () => {
    renderLive(<CutoffQueue />, { handler: req => base(req) ?? (req.path === 'Orders' ? { status: 503, body: { error: { code: 'ServiceUnavailable', message: 'The owning service is not reachable' } } } : page([])) });
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('The owning service is not reachable');
  });
});

describe('DSP-02 Plan board', () => {
  it('shows the real trips of the run date as vehicle lanes', async () => {
    const trips = [{ id: 'TRPT1', vehicleId: 'VEHT1', depot: 'KANDY', runDate: DAY, brand: 'FRESH', district: 'District T', status: 'ENROUTE', planVersion: 3, tripNumber: 1, planMinutes: 150, departTime: '2026-04-06T22:10:00.000Z', stops: [{ id: 'S1', orderId: 'ORDT1', outletId: 'OUTT01', stopSeq: 1, status: 'PLANNED' }] }];
    const view = renderLive(<PlanBoard />, {
      handler: req => base(req) ?? (req.path === 'Trips' ? page(trips) : req.path === 'Orders' ? page([order('ORDT1', { kg: 300, m3: 2 })])
        : req.path === 'Plans' ? page([{ id: 'PLT-v3', depot: 'KANDY', runDate: DAY, version: 3, status: 'PUBLISHED', source: 'AUTOPLAN', explanation: 'Synthetic explanation' }]) : page([])),
    });
    const board = await screen.findByTestId('board');
    await waitFor(() => expect(board.querySelector('[data-vehicle="VEHT1"]')).not.toBeNull());
    expect(within(board).getByText('Fresh · District T')).toBeInTheDocument();
    expect(within(board).getByText('300 / 1,000')).toBeInTheDocument();
    expect(screen.getByText(/In workshop, unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Synthetic explanation')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Trips')!.query.$expand).toContain('stops');
  });
});

describe('DSP-03 Deferral decision', () => {
  it('confirms the selected deferrals with a note and the next operating day (as approval rolls them)', async () => {
    window.sessionStorage.setItem('lodestar.depot', 'KANDY');
    const deferrals = [{ id: 'DT1', orderId: 'ORDT3', reason: 'CAP_REEFER', score: 22, status: 'SUGGESTED', isProvisional: false, createdAt: DAY, order: order('ORDT3', { tempClass: 'CHILLED', m3: 1.5 }) }];
    const view = renderLive(
      <ScreenShell board="P2" nav={nav({ L4: '/plan/dsp-12-approve-and-go-live' })} live><DeferralDecision /></ScreenShell>,
      // Wed 8 Apr is not an operating day: the next run is Thu 9 Apr
      { handler: req => base(req) ?? (req.path === 'Deferrals' ? page(deferrals) : req.path === 'Outlets' ? page([outlet('OUTT01')]) : req.path === 'Calendar' ? page([{ date: '2026-04-09T00:00:00.000Z' }]) : req.method === 'POST' ? { id: 'DT1', status: 'CONFIRMED' } : page([])) },
    );
    await screen.findByText('Defer 1 order to Thu');
    fireEvent.change(screen.getByLabelText('Note to store'), { target: { value: 'Covered till Wednesday' } });
    fireEvent.click(screen.getByTestId('confirm-all'));
    // approval opens over the deferral decision (components/live/overlay.tsx)
    await waitFor(() => expect(currentOverlay()).toBe('/plan/dsp-12-approve-and-go-live'));
    act(() => closeOverlay());
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "Deferrals('DT1')/Lodestar.Confirm", body: { notes: 'Covered till Wednesday', rescheduledDate: '2026-04-09' } });
    expect(view.calls.find(c => c.path === 'Calendar')!.query).toMatchObject({ $filter: 'date gt 2026-04-07T00:00:00Z and isOperating eq true', $top: '1' });
    expect(view.calls.find(c => c.path === 'Deferrals' && c.query.$expand === 'order')!.query.$filter).toContain("order/outlet/depot eq 'KANDY'");
  });
});

describe('DSP-40 proposal rule checks', () => {
  it('lays them out two per row, failing first (ten nowrap chips in one row overlapped)', () => {
    const checks = ['a', 'b', 'c', 'd', 'e'].map((rule, i) => ({ rule, label: rule, passed: i !== 3 }));
    expect(rulePairs(checks).map(r => r.map(c => c.rule))).toEqual([['d', 'a'], ['b', 'c'], ['e']]);
  });
});

describe('DSP-03 with an agent draft under review', () => {
  it('shows the draft deferral with its reason code and the protected outlet it keeps', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-3');
    const run = {
      id: 'run-3', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: DAY,
      detail: {
        plan: { version: 1, trips: [{ id: 'VEHT1-T1', vehicleId: 'VEHT1', tripNo: 1, brand: 'FRESH', district: 'District T', chilled: true, orderIds: ['ORDP1'], kg: 50, m3: 0.5, minutes: 90,
          stops: [{ seq: 1, orderId: 'ORDP1', outletId: 'OUTP1', protected: true }] }] },
        deferrals: [{ orderId: 'ORDB1', outletId: 'OUTB1', reason: 'CAP_REEFER', score: 20, suggested: true, m3: 34.2, rank: 1 }],
      },
    };
    renderLive(
      <ScreenShell board="P2" nav={nav({})} live><DeferralDecision /></ScreenShell>,
      { handler: req => base(req) ?? (req.path === "AgentRuns('run-3')" ? run : page([])) },
    );
    expect(await screen.findByText(/^Defer 1 order to/)).toBeInTheDocument();
    expect(screen.getByText('CAP-REEFER')).toBeInTheDocument();
    expect(screen.getByText('Reefer capacity')).toBeInTheDocument();
    const prot = screen.getByTestId('protected-outlet');
    expect(within(prot).getByText('OUTP1')).toBeInTheDocument();
    expect(within(prot).getByText('Protected')).toBeInTheDocument();
  });
});

describe('DSP-12 Approve and go live', () => {
  const run = {
    id: 'run-9', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: DAY,
    detail: { plan: { version: 4, trips: [{ id: 'VEHT1-T1', vehicleId: 'VEHT1', tripNo: 1, brand: 'FRESH', district: 'District T', chilled: true, orderIds: ['ORDT1'], kg: 50, m3: 0.5, minutes: 90 }] }, ruleChecks: [{ rule: 'weight', label: 'Weight', passed: true, violations: 0 }], deferrals: [], needsReview: [] },
  };

  it('a human approves the agent draft with Resume {decision: approve}; it continues to the docks', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const view = renderLive(
      <ScreenShell board="P2" nav={{ links: { L5: { app: 'Lodestar Dock', screen: 'LD-01 Dock queue', kind: 'go' } } }} live><ApproveAndGoLive /></ScreenShell>,
      { handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? run : req.method === 'POST' ? { ...run, status: 'APPROVED', planId: 'PLT-v4' } : page([])) },
    );
    expect(await screen.findByText(/Approve \d+ orders and go live/)).toBeInTheDocument();
    expect(screen.getByText('The agent cannot publish on its own.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Approval note'), { target: { value: 'Checked the reefer gap' } });
    fireEvent.click(screen.getByTestId('approve'));
    expect(await screen.findByText('Plan PLT-v4 is live')).toBeInTheDocument();
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "AgentRuns('run-9')/Lodestar.Resume", body: { decision: 'approve', comment: 'Checked the reefer gap' } });
    expect(screen.getByRole('status')).toHaveTextContent('Continues in Lodestar Dock');
  });

  it('without a run held in this tab it finds the draft waiting for approval (started elsewhere, e.g. the phone)', async () => {
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === 'AgentRuns' ? page([{ id: 'run-9' }]) : req.path === "AgentRuns('run-9')" ? run : req.method === 'POST' ? { ...run, status: 'APPROVED', planId: 'PLT-v4' } : page([])),
    });
    expect(await screen.findByText(/Approve \d+ orders and go live/)).toBeInTheDocument();
    const list = view.calls.find(c => c.path === 'AgentRuns')!;
    expect(list.query).toMatchObject({ $select: 'id', $orderby: 'createdAt desc', $top: '1' });
    expect(list.query.$filter).toContain('runDate ge 2026-04-07T00:00:00.000Z and runDate lt 2026-04-08T00:00:00.000Z');
    expect(list.query.$filter).toContain("status in ('DRAFTING','RUNNING','PENDING','QUEUED','NEEDS_APPROVAL')");
    fireEvent.click(screen.getByTestId('approve'));
    await waitFor(() => expect(view.calls.some(c => c.method === 'POST' && c.path === "AgentRuns('run-9')/Lodestar.Resume")).toBe(true));
  });

  it('approves a plan waiting for approval with Plans(…)/Lodestar.Approve when there is no agent draft', async () => {
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === 'Plans' ? page([{ id: 'PLT-v5', depot: 'KANDY', runDate: DAY, version: 5, status: 'NEEDS_APPROVAL', source: 'AUTOPLAN', summary: { plan: { trips: [{ id: 'VEHT1-T1' }] } } }])
        : req.method === 'POST' ? { id: 'PLT-v5', status: 'PUBLISHED' } : page([])),
    });
    await screen.findByText(/Approve \d+ orders and go live/);
    fireEvent.click(screen.getByTestId('approve'));
    await waitFor(() => expect(view.calls.some(c => c.method === 'POST' && c.path === "Plans('PLT-v5')/Lodestar.Approve")).toBe(true));
  });

  it('does not offer to approve a plan without trips (an older capacity-only auto-plan): it cannot go live', async () => {
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === 'Plans' ? page([{ id: 'PLT-v2', depot: 'KANDY', runDate: DAY, version: 2, status: 'NEEDS_APPROVAL', source: 'AUTOPLAN', summary: { suggestions: [] } }]) : page([])),
    });
    expect(await screen.findByText('This plan has no trips to put into effect: draft the day with the planning agent')).toBeInTheDocument();
    expect(screen.getByTestId('approve')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('approve'));
    expect(view.calls.filter(c => c.method === 'POST')).toHaveLength(0);
  });

  it('a plan with rule violations needs an override reason, sent as overrideReason with the note', async () => {
    const violation = { rule: 'weight', tripId: 'VEHT1-T1', vehicleId: 'VEHT1', orderIds: ['ORDT1'], reason: 'Over weight', detail: '1050 kg of 1000 kg' };
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === 'Plans' ? page([{ id: 'PLT-v5', depot: 'KANDY', runDate: DAY, version: 5, status: 'NEEDS_APPROVAL', source: 'MANUAL', summary: { plan: { trips: [{ id: 'VEHT1-T1' }] }, violations: [violation] } }])
        : req.method === 'POST' ? { id: 'PLT-v5', status: 'PUBLISHED' } : page([])),
    });
    await screen.findByText(/Approve \d+ orders and go live/);
    expect(screen.getByText('1 rule violation(s) in the plan')).toBeInTheDocument();
    expect(screen.getByText('Reason to override the rule violations (required)')).toBeInTheDocument();
    expect(screen.getByTestId('approve')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByLabelText('Override reason'), { target: { value: '   ' } });
    expect(screen.getByTestId('approve')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('approve'));
    expect(view.calls.filter(c => c.method === 'POST')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Override reason'), { target: { value: 'Scale reads 40 kg high' } });
    expect(screen.getByTestId('approve')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByTestId('approve'));
    expect(await screen.findByText('Plan PLT-v5 is live')).toBeInTheDocument();
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "Plans('PLT-v5')/Lodestar.Approve", body: { note: 'Scale reads 40 kg high', overrideReason: 'Scale reads 40 kg high' } });
  });

  it('an agent draft with rule violations is approved with Resume {overrideReason}; rejecting needs no reason', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const bad = { ...run, detail: { ...run.detail, violations: [{ rule: 'weight', tripId: 'VEHT1-T1', vehicleId: 'VEHT1', orderIds: ['ORDT1'], reason: 'Over weight', detail: '1050 kg of 1000 kg' }] } };
    const view = renderLive(<ApproveAndGoLive />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? bad : req.method === 'POST' ? { ...bad, status: 'APPROVED', planId: 'PLT-v4' } : page([])) });
    await screen.findByText(/Approve \d+ orders and go live/);
    expect(screen.getByTestId('approve')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('reject-draft')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('violations')).toHaveTextContent('1050 kg of 1000 kg');
    fireEvent.change(screen.getByLabelText('Override reason'), { target: { value: 'Checked on the scale' } });
    fireEvent.click(screen.getByTestId('approve'));
    expect(await screen.findByText('Plan PLT-v4 is live')).toBeInTheDocument();
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "AgentRuns('run-9')/Lodestar.Resume", body: { decision: 'approve', comment: 'Checked on the scale', overrideReason: 'Checked on the scale' } });
  });

  it('counts what the draft plans and defers, and a protected order kept on a trip passes "Protected outlets kept"', async () => {
    // the day's deferral records also hold yesterday's deferral of ORDT1, which rolled to today (protected) and is on a trip
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const draft = {
      ...run,
      detail: {
        ...run.detail,
        plan: { version: 1, trips: [{ ...run.detail.plan.trips[0], orderIds: ['ORDT1', 'ORDT2'], stops: [{ seq: 1, orderId: 'ORDT1', outletId: 'OUTP1', protected: true }, { seq: 2, orderId: 'ORDT2', outletId: 'OUTT02' }] }] },
        deferrals: [{ orderId: 'ORDT9', outletId: 'OUTT76', reason: 'CAP_REEFER', score: 12, suggested: true, m3: 1, rank: 1 }],
      },
    };
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? draft
        : req.path === 'Orders' && String(req.query.$filter).includes('deferredYesterday eq true') ? page([{ id: 'ORDT1' }]) : page([])),
    });
    expect(await screen.findByText('Approve 2 orders and go live')).toBeInTheDocument();
    const check = await screen.findByTestId('protected-check');
    await waitFor(() => expect(check).toHaveTextContent('1 kept, never deferred'));
    expect(check).not.toHaveAttribute('data-ok');
    expect(screen.getByText('1 deferred outlet told why and the new date')).toBeInTheDocument();
    expect(view.calls.some(c => c.path === 'Deferrals' && String(c.query.$filter).includes('deferredYesterday'))).toBe(false);
  });

  it('flags a protected order the draft leaves off its trips', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const draft = { ...run, detail: { ...run.detail, deferrals: [{ orderId: 'ORDT7', outletId: 'OUTP7', reason: 'CAP_REEFER', score: 95, suggested: true, m3: 1, rank: 1 }] } };
    renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? draft
        : req.path === 'Orders' && String(req.query.$filter).includes('deferredYesterday eq true') ? page([{ id: 'ORDT7' }]) : page([])),
    });
    const check = await screen.findByTestId('protected-check');
    await waitFor(() => expect(check).toHaveTextContent('1 not on a trip'));
    expect(check).toHaveAttribute('data-ok', 'false');
  });

  it('with nothing waiting it cannot approve', async () => {
    renderLive(<ApproveAndGoLive />, { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('Nothing to approve')).toBeInTheDocument();
    expect(screen.getByTestId('approve')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('DSP-39 Ask the planning agent', () => {
  it('asks a question with AgentRuns(…)/Lodestar.Ask and shows the answer', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const view = renderLive(<AskAgent />, {
      handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? { id: 'run-9', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', createdAt: DAY, detail: { plan: { version: 4, trips: [] } } }
        : req.method === 'POST' ? { value: { answer: 'Reefer space is short.\nThe lowest score waits.', toolCalls: [{ name: 'plan_summary' }] } } : page([])),
    });
    await screen.findByTestId('ask-agent');
    fireEvent.change(screen.getByLabelText('Ask about this plan'), { target: { value: 'Why defer this order?' } });
    fireEvent.click(screen.getByTestId('ask-send'));
    expect(await screen.findByText('Reefer space is short.')).toBeInTheDocument();
    expect(screen.getByText('The lowest score waits.')).toBeInTheDocument();
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "AgentRuns('run-9')/Lodestar.Ask", body: { question: 'Why defer this order?' } });
  });

  it('shows the tools the agent used as the API names them (plain strings)', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    renderLive(<AskAgent />, {
      handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? { id: 'run-9', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', createdAt: DAY, detail: { plan: { version: 4, trips: [] } } }
        : req.method === 'POST' ? { value: { answer: 'Moved it.', toolCalls: ['propose_edit'], proposal: null } } : page([])),
    });
    await screen.findByTestId('ask-agent');
    fireEvent.change(screen.getByLabelText('Ask about this plan'), { target: { value: 'Move ORD1 to VEH057' } });
    fireEvent.click(screen.getByTestId('ask-send'));
    expect(await screen.findByText('Moved it.')).toBeInTheDocument();
    expect(screen.getByText('propose edit')).toBeInTheDocument();
  });
});

// DSP-06: the designed sign-in form (direct grant) is covered in sign-in-screens.test.tsx.
