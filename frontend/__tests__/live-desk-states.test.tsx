// The desk's state screens, made live: DSP-21 Empty queue before cutoff, DSP-23 Plan infeasible, DSP-24 Offline
// banner, DSP-34 Reset access, DSP-35 Session expired, DSP-36 No access to this depot, SM-35 Reset access and
// SM-36 Service unavailable, plus how the desk reaches them (lib/desk-status, the route guard's expired state,
// SM-01's draft). Real ODataClient over a fake fetch. Date frozen at Mon 6 Apr 2026 13:30 Colombo; run Tue 7 Apr.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { decideGate } from '@/components/live/FaceGate';
import { storeCutOff } from '@/components/live/DeskWatch';
import { infeasibility } from '@/components/live/plan-data';
import EmptyQueue, { weekdayPattern } from '@/live/dsp-21-empty-queue-before-cutoff';
import { isEmptyBeforeCutoff } from '@/live/dsp-01-cutoff-queue';
import Infeasible from '@/live/dsp-23-plan-infeasible';
import OfflineScreen from '@/live/dsp-24-offline-banner';
import ResetPlan from '@/live/dsp-34-reset-access';
import SessionExpired, { safeReturn } from '@/live/dsp-35-session-expired';
import NoDepot from '@/live/dsp-36-no-access-to-this-depot';
import ResetStore from '@/live/sm-35-reset-access';
import ServiceUnavailable from '@/live/sm-36-service-unavailable';
import PlaceOrder from '@/live/sm-01-place-order';
import { deskStatus, reportForbidden, reportNetworkError, reportResponse, resetDeskStatus } from '@/lib/desk-status';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { mockApi, page, renderLive, SESSIONS } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/plan' }));

const NOW = '2026-04-06T08:00:00.000Z';
const DAY = '2026-04-07T00:00:00.000Z';
const err = (status: number, message: string, code = 'Failed', target?: string) => ({ status, body: { error: { code, message, ...(target ? { target } : {}) } } });
const posts = (calls: FakeRequest[]) => calls.filter(c => c.method === 'POST');
const base = (req: FakeRequest) => {
  if (req.query.$top === '0') return page([], 0);
  // no open orders from today on (the test day is past): the desk falls back to the latest plan's run date
  if (req.path === 'Orders' && req.query.$select === 'runDate') return page([]);
  if (req.path === 'Plans' && req.query.$select === 'runDate') return page([{ runDate: DAY }]);
  return undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/plan');
  resetDeskStatus();
  freezeDate(NOW);
});
afterEach(unfreeze);

describe('desk status', () => {
  it('a network error is offline until any answer; a depot 403 is recorded with its depot', async () => {
    reportNetworkError();
    expect(deskStatus().apiDownSince).not.toBeNull();
    reportResponse(200);
    expect(deskStatus().apiDownSince).toBeNull();
    const api = mockApi(() => err(403, 'You do not plan for depot PELIYAGODA', 'Forbidden', 'depot'));
    await expect(api.client.create('Plans', { depot: 'PELIYAGODA' })).rejects.toMatchObject({ status: 403 });
    expect(deskStatus().depotDenied).toMatchObject({ depot: 'PELIYAGODA' });
  });

  it('the store is cut off on a network error, or on repeated gateway errors', () => {
    expect(storeCutOff({ ...deskStatus(), apiDownSince: 1 })).toBe(true);
    expect(storeCutOff({ ...deskStatus(), serviceDownSince: 1, failures: 1 })).toBe(false);
    expect(storeCutOff({ ...deskStatus(), serviceDownSince: 1, failures: 2 })).toBe(true);
  });

  it('an ended session on Plan goes to DSP-35; elsewhere straight to sign in', () => {
    const at = { design: false, status: 'anonymous' as const, roles: [], path: '/plan/dsp-02-plan-board' };
    expect(decideGate({ ...at, face: 'plan', expired: true })).toBe('expired');
    expect(decideGate({ ...at, face: 'plan' })).toBe('login');
    expect(decideGate({ ...at, face: 'store', path: '/store/sm-01-place-order', expired: true })).toBe('login');
  });
});

describe('DSP-21 Empty queue before cutoff', () => {
  it('DSP-01 moves here only before the cutoff with nothing queued for the open run', () => {
    expect(isEmptyBeforeCutoff({ before: true, openRun: '2026-04-07', inView: '2026-04-07', queued: 0, openCount: undefined })).toBe(true);
    expect(isEmptyBeforeCutoff({ before: true, openRun: '2026-04-07', inView: '2026-04-06', queued: 12, unplanned: 0, openCount: 0 })).toBe(true);
    // today's run still has orders to plan: they show, not "No orders yet" for tomorrow
    expect(isEmptyBeforeCutoff({ before: true, openRun: '2026-04-07', inView: '2026-04-06', queued: 112, unplanned: 112, openCount: 0 })).toBe(false);
    expect(isEmptyBeforeCutoff({ before: true, openRun: '2026-04-07', inView: '2026-04-06', queued: undefined, unplanned: undefined, openCount: 0 })).toBe(false);
    expect(isEmptyBeforeCutoff({ before: true, openRun: '2026-04-07', inView: '2026-04-07', queued: 3, openCount: undefined })).toBe(false);
    expect(isEmptyBeforeCutoff({ before: false, openRun: '2026-04-07', inView: '2026-04-07', queued: 0, openCount: undefined })).toBe(false);
  });

  it('shows the open run, the time to cutoff and the fleet, with the design links', async () => {
    renderLive(<EmptyQueue />, {
      handler: req => base(req) ?? (req.path === 'Vehicles' ? page([{ id: 'V1', status: 'AVAILABLE', depot: 'KANDY' }, { id: 'V2', status: 'WORKSHOP', depot: 'KANDY' }]) : page([])),
    });
    expect(screen.getByText('Cutoff queue for Tue 7 Apr')).toBeInTheDocument();
    expect(screen.getByTestId('empty-title')).toHaveTextContent('No orders yet');
    expect(screen.getByTestId('until-cutoff')).toHaveTextContent('2 h 30 m');
    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    expect(document.querySelector('[data-lk="L171"]')).toHaveTextContent('Log phone order');
  });

  it('the usual count and first order come from the same weekday', () => {
    const p = weekdayPattern([
      { runDate: '2026-03-31T00:00:00.000Z', orderedAt: '2026-03-30T05:10:00.000Z' },
      { runDate: '2026-03-31T00:00:00.000Z', orderedAt: '2026-03-30T07:00:00.000Z' },
    ], ['2026-03-31', '2026-03-24']);
    expect(p).toEqual({ avg: 2, first: '10:40', runs: 1 });
  });
});

describe('DSP-23 Plan infeasible', () => {
  const run = {
    id: 'run-1', depot: 'PELIYAGODA', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: NOW,
    detail: {
      plan: { version: 3, trips: [] },
      contextSummary: { orders: 90, chilledDemand: { m3: 118.4 }, reeferCapacity: { m3: 116 }, vehiclesDown: ['VEHT4'] },
      needsReview: [{ orderId: 'ORDT9', outletId: 'OUTT28', reason: 'PROTECTED_UNPLACED', detail: 'No compatible trip has room (CAP_REEFER); dispatcher must place it' }],
      deferrals: [{ orderId: 'ORDT2', outletId: 'OUTT27', reason: 'CAP_REEFER', score: 22, suggested: true, m3: 1, rank: 1 }],
      violations: [],
    },
  };

  it('a draft with protected orders it could not place is infeasible; a clean one is not', () => {
    expect(infeasibility(run as never)?.shortM3).toBe(2.4);
    expect(infeasibility({ ...run, detail: { ...run.detail, needsReview: [] } } as never)).toBeNull();
  });

  it('says why, in order of impact, and what the dispatcher can do', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-1');
    renderLive(<Infeasible />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-1')" ? run : page([])) });
    expect(await screen.findByTestId('infeasible-title')).toHaveTextContent('No plan places all 90 orders as the rules stand');
    expect(screen.getByTestId('infeasible-hero')).toHaveTextContent('2.4 m³');
    const why = screen.getAllByTestId('why').map(r => r.textContent);
    expect(why[0]).toContain('CAP-REEFER');
    expect(why[1]).toContain('VEHT4');
    expect(why[2]).toContain('ORDT9 (OUTT28) is protected and has no place');
    expect(document.querySelector('[data-lk="L173"]')).toHaveTextContent('Allow 1 deferral');
    expect(document.querySelector('[data-lk="B"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-lk="L172"]').length).toBeGreaterThan(0);
  });
});

describe('DSP-24 Offline banner', () => {
  it('when the API does not answer: the banner, frozen numbers marked not live', async () => {
    renderLive(<OfflineScreen />, { handler: () => { throw new Error('Failed to fetch'); } });
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent('Lodestar is not answering');
    expect(screen.getByTestId('offline-banner')).toHaveAttribute('data-lk', 'L174');
    expect(screen.getByText('Not live')).toBeInTheDocument();
  });

  it('once the API answers, the banner says so and links back to the overview', async () => {
    renderLive(<OfflineScreen />, { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('Connected to Lodestar.')).toBeInTheDocument();
    expect(document.querySelector('[data-lk="L174"]')).toBeInTheDocument();
  });
});

describe('DSP-34 / SM-35 Reset access', () => {
  it('Plan: without self-service reset the admin path, and back to sign in', () => {
    renderLive(<ResetPlan />, { handler: () => page([]), session: null });
    expect(screen.getByText('Your admin resets your sign-in')).toBeInTheDocument();
    // no support desk hours or site are invented when none is configured
    expect(screen.getByText('Call the IT desk')).toBeInTheDocument();
    expect(screen.queryByText(/Open 24 hours/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reset-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('back-to-sign-in')).toHaveAttribute('data-lk', 'L175');
  });

  it('Store: the admin tab first; the email tab says email reset is off', () => {
    renderLive(<ResetStore />, { handler: () => page([]), session: null });
    expect(screen.getByTestId('admin-path')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-email'));
    expect(screen.getByTestId('no-self-reset')).toBeInTheDocument();
    expect(document.querySelector('[data-lk="L141"]')).toBeInTheDocument();
  });
});

describe('DSP-35 Session expired', () => {
  it('says when and as whom the session ended, and signs in again back to the page', () => {
    const endedAt = new Date(NOW).getTime();
    window.sessionStorage.setItem('lodestar.sessionEnded', JSON.stringify({ name: 'Dee Dispatcher', email: 'dee@example.lk', startedAt: (endedAt - 8 * 3_600_000) / 1000, endedAt }));
    window.history.pushState({}, '', '/plan/dsp-35-session-expired?returnTo=%2Fplan%2Fdsp-01-cutoff-queue');
    const view = renderLive(<SessionExpired />, { handler: () => page([]), session: null });
    expect(screen.getByText('Your session ended')).toBeInTheDocument();
    expect(screen.getByTestId('ended-at')).toHaveTextContent('after 8 hours');
    expect(screen.getByTestId('account')).toHaveTextContent('dee@example.lk');
    fireEvent.click(screen.getByTestId('sign-in-again'));
    expect(view.auth.login).toHaveBeenCalledWith('/plan/dsp-01-cutoff-queue', undefined);
    expect(safeReturn('https://evil.example/plan')).toBe('/plan/dsp-02-plan-board');
  });
});

describe('DSP-36 No access to this depot', () => {
  it('shows the refused depot and the user’s own depots', async () => {
    reportForbidden({ status: 403, target: 'depot', message: 'You do not plan for depot PELIYAGODA' });
    renderLive(<NoDepot />, { handler: req => base(req) ?? page([]), session: { ...SESSIONS.dispatcher, depots: ['KANDY'] } });
    // the depot's code until the registry (Depots) answers, then its name
    await waitFor(() => expect(screen.getByTestId('denied-title')).toHaveTextContent('No access to Peliyagoda DC'));
    expect(screen.getByTestId('denied-message')).toHaveTextContent('You do not plan for depot PELIYAGODA');
    expect(screen.getByTestId('own-KANDY')).toHaveTextContent('Open the Kandy Hub plan');
    expect(document.querySelector('[data-lk="B"]')).toBeInTheDocument();
  });
});

describe('SM-36 Service unavailable', () => {
  const OUTLET = { id: 'OUTT01', name: 'Outlet T01', brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true };
  const draft = { outletId: 'OUTT01', brand: 'FRESH', runDate: '2026-04-07', dry: [{ key: 'l1', name: 'Rice 5 kg', last: 3, qty: 3, unitKg: 5 }], chilled: [], ratio: 0.005, savedAt: new Date(NOW).getTime() };

  it('SM-01: a Submit the server cannot take moves here with the draft kept', async () => {
    const last = [{ id: 'ORDT1', outletId: 'OUTT01', runDate: DAY, orderedAt: DAY, brand: 'FRESH', tempClass: 'AMBIENT', units: 3, kg: 15, m3: 0.1, status: 'DELIVERED', deferredYesterday: false, daysSince: 1, lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] }];
    renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => (req.query.$top === '0' ? page([], 0) : req.path === "Outlets('OUTT01')" ? OUTLET : req.method === 'POST' ? err(503, 'The orders service is not reachable') : req.path === 'Orders' ? page(last) : page([])),
    });
    await screen.findByText('Rice 5 kg');
    fireEvent.click(screen.getByTitle('More Rice 5 kg'));
    fireEvent.click(screen.getByTestId('submit-order'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/store/sm-36-service-unavailable?from=%2Fstore%2Fsm-01-place-order'));
    expect(JSON.parse(window.sessionStorage.getItem('lodestar.orderDraft.OUTT01')!)).toMatchObject({ runDate: '2026-04-07', dry: [expect.objectContaining({ name: 'Rice 5 kg', qty: 4 })] });
  });

  it('shows the saved draft and sends it once the server answers', async () => {
    window.sessionStorage.setItem('lodestar.orderDraft.OUTT01', JSON.stringify(draft));
    reportNetworkError();
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ status: 401 })) as unknown as typeof fetch;
    try {
      const view = renderLive(<ServiceUnavailable />, { session: SESSIONS.store, handler: req => (req.method === 'POST' ? { status: 201, body: { id: 'ORDNEW', ...(req.body as object) } } : req.path === "Outlets('OUTT01')" ? OUTLET : page([], 0)) });
      expect(screen.getByTestId('draft-title')).toHaveTextContent('Your order is saved in this browser');
      expect(screen.getByTestId('draft-dry')).toHaveTextContent('Draft · not sent');
      expect(document.querySelector('[data-lk="L143"]')).toHaveTextContent('Keep editing');
      await act(async () => { fireEvent.click(screen.getByTestId('try-now')); });
      await waitFor(() => expect(screen.getByTestId('draft-title')).toHaveTextContent('Your order was sent'));
      expect(posts(view.calls)).toHaveLength(1);
      expect(posts(view.calls)[0].body).toMatchObject({ outletId: 'OUTT01', tempClass: 'AMBIENT', units: 3 });
      expect(window.sessionStorage.getItem('lodestar.orderDraft.OUTT01')).toBeNull();
    } finally {
      global.fetch = realFetch;
    }
  });
});
