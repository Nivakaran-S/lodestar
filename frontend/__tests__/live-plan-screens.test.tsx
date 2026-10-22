// Live Plan screens not covered by live-plan.test.tsx (DSP-04, DSP-08, DSP-13, DSP-17, DSP-18, DSP-19, DSP-22,
// DSP-40), plus the loading, empty and error states of DSP-01/02/03/12. Real ODataClient over a fake fetch:
// assertions on requests are at the HTTP level. Date is frozen at Mon 6 Apr 2026 13:30 (Colombo).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import ScreenShell from '@/components/ScreenShell';
import CutoffQueue from '@/live/dsp-01-cutoff-queue';
import PlanBoard from '@/live/dsp-02-plan-board';
import DeferralDecision from '@/live/dsp-03-deferral-decision';
import LiveOps from '@/live/dsp-04-live-operations';
import Today from '@/live/dsp-08-today-overview';
import ApproveAndGoLive from '@/live/dsp-12-approve-and-go-live';
import Inbox from '@/live/dsp-13-exceptions-inbox';
import DeferralLog from '@/live/dsp-17-deferral-log';
import OutletProfile from '@/live/dsp-18-outlet-profile';
import Fleet from '@/live/dsp-19-fleet-and-vehicle-profile';
import Drafting from '@/live/dsp-22-planning-agent-drafting';
import { TripDrawer } from '@/live/dsp-11-trip-and-vehicle-drawer';
import { setStarting } from '@/components/live/plan-data';
import { closeOverlay, currentOverlay } from '@/lib/overlay';
import Proposal from '@/live/dsp-40-agent-proposal-in-draft';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { agentConfigReply, page, renderLive } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/plan' }));

const NOW = '2026-04-06T08:00:00.000Z';
const DAY = '2026-04-07T00:00:00.000Z';
const RUN_FILTER = 'runDate ge 2026-04-07T00:00:00.000Z and runDate lt 2026-04-08T00:00:00.000Z';
const outlet = (id: string, over = {}) => ({ id, name: `Outlet ${id.slice(-3)}`, brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true, ...over });
const order = (id: string, over = {}) => ({ id, outletId: 'OUTT01', runDate: DAY, orderedAt: DAY, brand: 'FRESH', tempClass: 'AMBIENT', units: 10, kg: 100, m3: 1, status: 'RECEIVED', deferredYesterday: false, daysSince: 1, ...over });
const vehicle = (id: string, over = {}) => ({ id, depot: 'PELIYAGODA', type: 'VAN', tempClass: 'CHILLED', capacityKg: 1000, capacityM3: 7, kmPerLitre: 10, weeklyLFuel: 400, usedLThisWeek: 100, status: 'AVAILABLE', ...over });
const err = (status: number, message: string, code = 'Failed') => ({ status, body: { error: { code, message } } });
const nav = (links: Record<string, string>) => ({ links: Object.fromEntries(Object.entries(links).map(([k, href]) => [k, { href, kind: 'go' }])) });
const posts = (calls: FakeRequest[]) => calls.filter(c => c.method === 'POST');
const disabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';

/** Reads every Plan screen makes: sidebar counts and the latest run date. */
function base(req: FakeRequest) {
  if (agentConfigReply(req)) return agentConfigReply(req);
  if (req.query.$top === '0') return page([], 0);
  // no open orders from today on (the test day is past): the desk falls back to the latest plan's run date
  if (req.path === 'Orders' && req.query.$select === 'runDate') return page([]);
  if (req.path === 'Plans' && req.query.$select === 'runDate') return page([{ runDate: DAY }]);
  return undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/plan');
  freezeDate(NOW);
});
afterEach(unfreeze);

// ------------------------------------------------------------------------------------------------ DSP-04

describe('DSP-04 Live operations', () => {
  const trips = [
    {
      id: 'TRPT1', vehicleId: 'VEHT1', depot: 'KANDY', runDate: DAY, brand: 'FRESH', district: 'District T', status: 'ENROUTE', planVersion: 3, tripNumber: 1, departTime: '2026-04-06T23:30:00.000Z', bay: 'B2',
      stops: [
        { id: 'S2', tripId: 'TRPT1', orderId: 'ORDT2', outletId: 'OUTT02', stopSeq: 2, status: 'PLANNED', etaPlan: '2026-04-07T01:00:00.000Z', etaModel: '2026-04-07T01:30:00.000Z', lateRiskPct: 35 },
        { id: 'S1', tripId: 'TRPT1', orderId: 'ORDT1', outletId: 'OUTT01', stopSeq: 1, status: 'DELIVERED', arrivalActual: '2026-04-07T00:40:00.000Z', etaModelBandLate: '2026-04-07T00:50:00.000Z', lateRiskPct: 0 },
      ],
    },
    {
      id: 'TRPT2', vehicleId: 'VEHT2', depot: 'PELIYAGODA', runDate: DAY, brand: 'STYLE', district: 'District P', status: 'PLANNED', planVersion: 3, tripNumber: 1,
      stops: [{ id: 'S3', tripId: 'TRPT2', orderId: 'ORDT3', outletId: 'OUTT03', stopSeq: 1, status: 'PLANNED', etaPlan: '2026-04-07T02:00:00.000Z', lateRiskPct: 10 }],
    },
  ];
  const signal = { id: 'N1', recipientId: 'u-d', tripId: 'TRPT1', type: 'SIGNAL_LOST', channel: 'WEBSOCKET', payload: { vehicleId: 'VEHT1' }, sentAt: '2026-04-07T00:55:00.000Z', readAt: null };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => base(req) ?? over(req) ?? (
    req.path === 'Trips' ? page(trips)
      : req.path === 'Orders' && req.query.$filter?.includes("status eq 'EXCEPTION'") ? page([order('ORDTX', { status: 'EXCEPTION', outletId: 'OUTTX', outlet: outlet('OUTTX', { name: 'Outlet X' }), notes: 'Loader flagged a torn pallet' })])
        : req.path === 'Orders' ? page([order('ORDT2', { tempClass: 'CHILLED', units: 7 })])
          : req.path === 'Notifications' ? page([signal])
            : req.method === 'POST' ? { id: 'N1' } : page([]));

  it('shows the run’s routes by depot, the stats, and the exceptions that need the dispatcher', async () => {
    const view = renderLive(<LiveOps />, { handler: handler() });
    const routes = await screen.findByTestId('routes');
    await waitFor(() => expect(routes.querySelectorAll('[data-trip]')).toHaveLength(2));
    expect(await screen.findByText('2 things need you now')).toBeInTheDocument();
    expect(screen.getByText('Outlet X: order exception')).toBeInTheDocument();
    expect(screen.getByText('Signal lost')).toBeInTheDocument();
    expect(screen.getByText('Stops delivered').parentElement).toHaveTextContent('1/ 3');
    expect(screen.getByText('On time').parentElement).toHaveTextContent('100%');
    expect(screen.getByText('Offline, expected').parentElement).toHaveTextContent('1');
    expect(screen.getByTestId('live-status')).toHaveTextContent('Live · updated 13:30');
    // grouped in the order of the user's depots
    const groups = [...routes.querySelectorAll('.x-grp')].map(g => g.textContent);
    expect(groups).toEqual(['Peliyagoda DC1 routes', 'Kandy Hub1 routes']);
    const r1 = routes.querySelector('[data-trip="TRPT1"]') as HTMLElement;
    expect(r1).toHaveTextContent('1/2');
    expect(r1).toHaveTextContent('Next OUTT02 ~7:00');
    expect(r1).toHaveTextContent('late 35%');
    // the drawer opens on the first route and its next stop
    const drawer = screen.getByTestId('route-drawer');
    expect(drawer).toHaveTextContent('VEHT1');
    expect(drawer).toHaveTextContent('Kandy Hub · Trip 1 · Fresh · District T');
    expect(drawer).toHaveTextContent('OUTT02 chilled · 7 units');
    expect(drawer).toHaveTextContent('Plan 6:30 · model ~7:00');
    const q = view.calls.find(c => c.path === 'Trips')!;
    expect(q.query.$filter).toBe(`${RUN_FILTER} and depot in ('PELIYAGODA','KANDY')`);
    expect(q.query.$expand).toBe('stops');
  });

  it('filters the routes, selects one, and marks an alert handled', async () => {
    const view = renderLive(<LiveOps />, { handler: handler() });
    const routes = await screen.findByTestId('routes');
    await waitFor(() => expect(routes.querySelectorAll('[data-trip]')).toHaveLength(2));
    fireEvent.click(within(routes).getByRole('button', { name: /^At risk/ }));
    expect(routes.querySelectorAll('[data-trip]')).toHaveLength(1);
    expect(routes.querySelector('[data-trip="TRPT1"]')).not.toBeNull();
    fireEvent.click(within(routes).getByRole('button', { name: /^Exceptions/ }));
    expect(within(routes).getByText('No route matches this filter.')).toBeInTheDocument();
    fireEvent.click(within(routes).getByRole('button', { name: /^All/ }));

    fireEvent.click(routes.querySelector('[data-trip="TRPT2"]')!);
    expect(screen.getByTestId('route-drawer')).toHaveTextContent('VEHT2');
    fireEvent.click(await screen.findByRole('button', { name: /Show the route/ }));
    expect(screen.getByTestId('route-drawer')).toHaveTextContent('VEHT1');

    fireEvent.click(screen.getByRole('button', { name: /Mark handled/ }));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Notifications('N1')/Lodestar.MarkRead" })]));
    await waitFor(() => expect(view.calls.filter(c => c.path === 'Notifications')).toHaveLength(2));
  });

  it('empty run: no trips and nothing to triage', async () => {
    renderLive(<LiveOps />, { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('No trips for this run date.')).toBeInTheDocument();
    expect(await screen.findByText('All routes running')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you')).toBeInTheDocument();
    expect(screen.queryByTestId('route-drawer')).not.toBeInTheDocument();
  });

  it('shows the API error and retries', async () => {
    const view = renderLive(<LiveOps />, { handler: handler(req => (req.path === 'Trips' ? err(503, 'Trips are not reachable') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Trips are not reachable');
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(view.calls.filter(c => c.path === 'Trips')).toHaveLength(2));
  });
});

// ------------------------------------------------------------------------------------------------ DSP-08

describe('DSP-08 Today overview', () => {
  const counts = (f = '') => (f.includes("status eq 'DELIVERED'") ? 4 : f.includes("status ne 'CANCELLED'") ? 10 : f.includes("status eq 'DEFERRED'") ? 1 : f.includes("status eq 'ENROUTE'") ? 1 : 0);
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], counts(req.query.$filter))
      : req.path === 'Plans' && req.query.$select === 'runDate' ? page([{ runDate: DAY }])
        : req.path === 'Plans' && req.query.$filter?.startsWith("depot eq 'KANDY'") ? page([{ id: 'PLK-v3', depot: 'KANDY', runDate: DAY, version: 3, status: 'PUBLISHED', source: 'AGENT', explanation: 'Two reefers short; one order deferred.' }])
          : req.path === 'Trips' ? page([{ id: 'T1', status: 'ENROUTE' }, { id: 'T2', status: 'COMPLETE' }, { id: 'T3', status: 'PLANNED' }])
            : req.path === 'TripStops' && req.query.$filter?.includes('arrivalActual ne null') ? page([
              { arrivalActual: '2026-04-07T00:40:00.000Z', etaModelBandLate: '2026-04-07T00:50:00.000Z' },
              { arrivalActual: '2026-04-07T01:30:00.000Z', etaModelBandLate: '2026-04-07T01:00:00.000Z' },
            ])
              : req.path === 'Orders' && req.query.$filter?.includes("status eq 'EXCEPTION'") ? page([order('ORDTX', { status: 'EXCEPTION', outlet: outlet('OUTTX', { name: 'Outlet X' }) })])
                : req.path === 'Notifications' && req.query.$top === '7' ? page([{ id: 'N2', type: 'POD_MATCHED', sentAt: '2026-04-06T07:45:00.000Z', payload: { outletId: 'OUTT01' } }, { id: 'N1', type: 'SIGNAL_LOST', sentAt: '2026-04-06T07:30:00.000Z', payload: { vehicleId: 'VEHT1' } }])
                  : page([]));

  it('greets the dispatcher and shows delivered, on-time, trips, exceptions, depots and the timeline', async () => {
    const view = renderLive(<Today />, { handler: handler() });
    expect(await screen.findByText('Good afternoon, Dee')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('delivered')).toHaveTextContent('4of 10 orders'));
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('trips planned').parentElement).toHaveTextContent('3');
    expect(screen.getByText(/trips complete/).parentElement).toHaveTextContent('1 trips complete, 1 on the road.');
    expect(await screen.findByText('Outlet X: order exception')).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();
    expect(screen.getByText('Triage 1 exception')).toBeInTheDocument();
    const kandy = await screen.findByTestId('depot-KANDY');
    expect(await within(kandy).findByText('Plan v3 live')).toBeInTheDocument();
    expect(within(kandy).getByText('Two reefers short; one order deferred.')).toBeInTheDocument();
    expect(await within(screen.getByTestId('depot-PELIYAGODA')).findByText('No plan yet')).toBeInTheDocument();
    // the timeline reads oldest → newest
    const notices = await screen.findAllByText(/^(Signal lost|Pod matched)$/);
    expect(notices.map(n => n.textContent)).toEqual(['Signal lost', 'Pod matched']);
    const onTime = view.calls.find(c => c.path === 'TripStops' && c.query.$filter?.includes('arrivalActual'))!;
    expect(onTime.query.$filter).toBe('trip/runDate ge 2026-04-07T00:00:00.000Z and trip/runDate lt 2026-04-08T00:00:00.000Z and arrivalActual ne null');
  });

  it('before any run is planned it says so', async () => {
    renderLive(<Today />, { handler: handler(req => (req.path === 'Plans' && req.query.$select === 'runDate' ? page([]) : undefined)) });
    expect(await screen.findByText('No runs planned yet')).toBeInTheDocument();
    expect(screen.getByTestId('delivered')).toHaveTextContent('…of … orders');
  });

  it('nothing to triage, and a compact error when the exceptions cannot load', async () => {
    renderLive(<Today />, { handler: handler(req => (req.path === 'Orders' && req.query.$filter?.includes('EXCEPTION') ? err(500, 'Exceptions failed') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Exceptions failed');
    expect(screen.getByText('Exceptions inbox', { selector: '.d-btn' })).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ DSP-13

describe('DSP-13 Exceptions inbox', () => {
  const excOrder = order('ORDT1', { status: 'EXCEPTION', notes: 'Dock blocked', updatedAt: '2026-04-07T01:00:00.000Z', outlet: outlet('OUTT01', { name: 'Outlet T01' }) });
  const riskStop = { id: 'S2', tripId: 'TRPT1', orderId: 'ORDT2', outletId: 'OUTT02', stopSeq: 2, status: 'PLANNED', lateRiskPct: 45, etaModel: '2026-04-07T01:30:00.000Z', updatedAt: '2026-04-07T00:30:00.000Z', trip: { vehicleId: 'VEHT1' }, outlet: { name: 'Outlet T02', windowClose: '08:00' } };
  const reefer = { id: 'N1', recipientId: 'u-d', tripId: 'TRPT1', type: 'REEFER_FAIL', channel: 'PUSH', payload: { vehicleId: 'VEHT1', title: 'Reefer VEHT1 above 8 °C' }, sentAt: '2026-04-07T00:20:00.000Z', readAt: null };
  const handled = { id: 'N0', recipientId: 'u-d', tripId: 'TRPT9', type: 'SIGNAL_BACK', channel: 'PUSH', payload: {}, sentAt: '2026-04-06T07:00:00.000Z', readAt: '2026-04-06T07:30:00.000Z' };
  const trip = { id: 'TRPT1', vehicleId: 'VEHT1', depot: 'KANDY', runDate: DAY, brand: 'FRESH', district: 'District T', status: 'ENROUTE', planVersion: 3, tripNumber: 1, stops: [{ ...riskStop, status: 'PLANNED' }, { id: 'S1', tripId: 'TRPT1', orderId: 'ORDT9', outletId: 'OUTT09', stopSeq: 1, status: 'DELIVERED' }] };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => base(req) ?? over(req) ?? (
    req.path === 'Orders' ? page([excOrder])
      : req.path === 'TripStops' ? page([riskStop])
        : req.path === 'Notifications' && req.query.$filter?.startsWith('readAt ne null') ? page([handled])
          : req.path === 'Notifications' ? page([reefer])
            : req.path === "Outlets('OUTT01')" ? outlet('OUTT01', { name: 'Outlet T01' })
              : req.path === "Outlets('OUTT02')" ? outlet('OUTT02', { name: 'Outlet T02' })
              : req.path === "Trips('TRPT1')" ? trip
                : req.path === 'Users' ? page([{ id: 'u-s1', name: 'Sam Store' }])
                  : req.method === 'POST' ? { id: 'x' } : page([]));
  const shell = (ui: React.ReactElement) => <ScreenShell board="P2" nav={nav({ L164: '/plan/dsp-04-live-operations' })} live>{ui}</ScreenShell>;

  it('lists the open exceptions most urgent first and shows the selected one', async () => {
    const view = renderLive(shell(<Inbox />), { handler: handler() });
    const inbox = await screen.findByTestId('inbox');
    await waitFor(() => expect(inbox.querySelectorAll('[data-exception]')).toHaveLength(3));
    expect([...inbox.querySelectorAll('[data-exception]')].map(e => e.getAttribute('data-exception'))).toEqual(['order:ORDT1', 'note:N1', 'stop:S2']);
    expect(screen.getByText('3 open exceptions')).toBeInTheDocument();
    expect(within(inbox).getByText('Reefer VEHT1 above 8 °C')).toBeInTheDocument();
    expect(within(inbox).getByText('Late risk · Outlet T02 · stop 2 · closes 08:00 · ETA ~7:00')).toBeInTheDocument();
    const detail = screen.getByTestId('exception-detail');
    expect(detail).toHaveTextContent('Outlet T01: order exception');
    expect(await within(detail).findByText(/Window/)).toHaveTextContent('Window 05:30–08:00. ORDT1 · Dock blocked');
    expect(view.calls.find(c => c.path === 'Orders' && c.query.$filter?.includes("status eq 'EXCEPTION'"))!.query.$filter).toBe(`${RUN_FILTER} and outlet/depot in ('PELIYAGODA','KANDY') and status eq 'EXCEPTION'`);
    expect(view.calls.find(c => c.path === 'TripStops')!.query.$filter).toBe("trip/runDate ge 2026-04-07T00:00:00.000Z and trip/runDate lt 2026-04-08T00:00:00.000Z and lateRiskPct ge 30 and status ne 'DELIVERED' and trip/depot in ('PELIYAGODA','KANDY')");

    fireEvent.click(inbox.querySelector('[data-exception="stop:S2"]')!);
    await waitFor(() => expect(screen.getByText('stops done').parentElement).toHaveTextContent('1 / 2'));
    expect(screen.getByText('late risk').parentElement).toHaveTextContent('45%');
    expect(view.calls.find(c => c.path === "Trips('TRPT1')")!.query.$expand).toBe('stops');

    fireEvent.change(screen.getByLabelText('Search exceptions'), { target: { value: 'outt02' } });
    expect(inbox.querySelectorAll('[data-exception]')).toHaveLength(1);
  });

  it('messages the outlet’s store manager through Notifications/Lodestar.Send, then opens live operations', async () => {
    const view = renderLive(shell(<Inbox />), { handler: handler() });
    await screen.findByTestId('exception-detail');
    // drafted from the exception, so the button is ready; the dispatcher can rewrite it
    expect((screen.getByLabelText('Message to the store') as HTMLTextAreaElement).value).toMatch(/^Update from dispatch: /);
    expect(disabled(screen.getByTestId('message-store'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Message to the store'), { target: { value: '' } });
    expect(disabled(screen.getByTestId('message-store'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Message to the store'), { target: { value: '  Driver waits at the gate  ' } });
    fireEvent.click(screen.getByTestId('message-store'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/plan/dsp-04-live-operations'));
    expect(view.calls.find(c => c.path === 'Users')!.query.$filter).toBe("outletId eq 'OUTT01' and role eq 'STORE_MANAGER' and isActive eq true");
    expect(posts(view.calls)).toEqual([expect.objectContaining({
      path: 'Notifications/Lodestar.Send',
      body: { recipientId: 'u-s1', type: 'DISPATCH_NOTICE', outletId: 'OUTT01', payload: { message: 'Driver waits at the gate', outletId: 'OUTT01', from: 'dispatch' } },
    })]);
    expect(screen.getByText('Sent to Sam Store')).toBeInTheDocument();
    expect(screen.getByLabelText('Message to the store')).toHaveValue('');
  });

  it('says when the outlet has no store manager to message', async () => {
    const view = renderLive(shell(<Inbox />), { handler: handler(req => (req.path === 'Users' ? page([]) : undefined)) });
    await screen.findByTestId('exception-detail');
    fireEvent.change(screen.getByLabelText('Message to the store'), { target: { value: 'Call me' } });
    fireEvent.click(screen.getByTestId('message-store'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No active store manager is registered for OUTT01');
    expect(posts(view.calls)).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('marks an alert handled and lists what was resolved in the last 24 h', async () => {
    const view = renderLive(shell(<Inbox />), { handler: handler() });
    const inbox = await screen.findByTestId('inbox');
    await waitFor(() => expect(inbox.querySelector('[data-exception="note:N1"]')).not.toBeNull());
    fireEvent.click(inbox.querySelector('[data-exception="note:N1"]')!);
    fireEvent.click(screen.getByTestId('mark-handled'));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Notifications('N1')/Lodestar.MarkRead" })]));
    const resolved = view.calls.find(c => c.query.$filter?.startsWith('readAt ne null'))!;
    expect(resolved.query.$filter).toBe('readAt ne null and readAt ge 2026-04-05T08:00:00.000Z');
    fireEvent.click(screen.getByRole('button', { name: /^Resolved today/ }));
    expect(within(inbox).getByText('Signal back')).toBeInTheDocument();
    expect(within(inbox).getByText(/Handled 13:00/)).toBeInTheDocument();
    expect(inbox.querySelectorAll('[data-exception]')).toHaveLength(0);
  });

  it('shows the dock flags, POD exceptions, failed stops and store reports sent to dispatch, and acknowledges a flag', async () => {
    const issue = { id: 'N5', recipientId: 'u-d', tripId: 'TRPT1', type: 'RECEIPT_ISSUE', channel: 'WEBSOCKET', sentAt: '2026-04-07T01:10:00.000Z', readAt: null, payload: { orderId: 'ORDT7', outletId: 'OUTT01', title: 'Outlet T01: issue reported on ORDT7', note: 'Damaged: tray torn' } };
    const flag = { id: 'N6', recipientId: 'u-d', tripId: 'TRPT1', type: 'SHORTFALL_FLAGGED', channel: 'WEBSOCKET', sentAt: '2026-04-07T02:00:00.000Z', readAt: null, payload: { orderId: 'ORDT2', outletId: 'OUTT02', vehicleId: 'VEHT1', title: 'Shortfall: Milk 1L 4 of 6' } };
    const view = renderLive(shell(<Inbox />), {
      handler: handler(req => (req.path === 'Notifications' && !req.query.$filter?.startsWith('readAt ne null') ? page([issue, flag]) : req.path === 'Orders' || req.path === 'TripStops' ? page([]) : undefined)),
    });
    const inbox = await screen.findByTestId('inbox');
    await waitFor(() => expect(inbox.querySelectorAll('[data-exception]')).toHaveLength(2));
    const types = view.calls.find(c => c.path === 'Notifications' && c.query.$filter?.startsWith('readAt eq null'))!.query.$filter;
    for (const t of ['SHORTFALL_FLAGGED', 'POD_EXCEPTION', 'STOP_FAILED', 'RECEIPT_ISSUE']) expect(types).toContain(`'${t}'`);
    // the store's report needs the dispatcher first (before the newer dock flag), with its order and store
    expect([...inbox.querySelectorAll('[data-exception]')].map(e => e.getAttribute('data-exception'))).toEqual(['note:N5', 'note:N6']);
    expect(inbox).toHaveTextContent('Outlet T01: issue reported on ORDT7');
    expect(within(inbox.querySelector('[data-exception="note:N5"]') as HTMLElement).getByText(/ORDT7 · OUTT01 · Damaged: tray torn/)).toBeInTheDocument();
    expect(await within(screen.getByTestId('exception-detail')).findByText(/Outlet T01 ·/)).toBeInTheDocument();
    expect(screen.getByTestId('mark-handled')).toHaveTextContent('Mark handled');

    fireEvent.click(inbox.querySelector('[data-exception="note:N6"]')!);
    expect(screen.getByTestId('mark-handled')).toHaveTextContent('Acknowledge');
    fireEvent.click(screen.getByTestId('mark-handled'));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Notifications('N6')/Lodestar.MarkRead" })]));
  });

  it('inbox zero', async () => {
    renderLive(shell(<Inbox />), { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('Inbox zero')).toBeInTheDocument();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(screen.getByText('0 open exceptions')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ DSP-17

describe('DSP-17 Deferral log', () => {
  const d1 = { id: 'D1', orderId: 'ORDT1', reason: 'CAP_REEFER', score: 22, status: 'CONFIRMED', isProvisional: false, rescheduledDate: '2026-04-08', resolvedBy: 'u-d', confirmedAt: '2026-04-06T07:00:00.000Z', createdAt: '2026-04-06T06:00:00.000Z', order: order('ORDT1', { deferredYesterday: true }) };
  const d2 = { id: 'D2', orderId: 'ORDT2', reason: 'ACCESS', score: 40, status: 'SUGGESTED', isProvisional: true, createdAt: '2026-04-06T05:00:00.000Z', order: order('ORDT2', { outletId: 'OUTT02' }) };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], 3)
      : base(req) ?? (req.path === 'Deferrals' && req.query.$skiptoken ? page([{ ...d2, id: 'D3', orderId: 'ORDT3' }], 3)
        : req.path === 'Deferrals' && req.query.$top === '25' ? page([d1, d2], 3, 'http://localhost/odata/v4/Deferrals?$skiptoken=2')
          : req.path === 'Deferrals' ? page([d1, d2])
            : req.path === 'Outlets' ? page([outlet('OUTT01', { name: 'Outlet T01' }), outlet('OUTT02', { name: 'Outlet T02', parking: 'VAN_ONLY' })])
              : req.path === 'Users' ? page([{ id: 'u-d', name: 'Dee Dispatcher' }])
                : page([])));

  it('lists the last 30 days with the skip guard, reason codes and what happened next', async () => {
    const view = renderLive(<ScreenShell board="P2" nav={nav({ L168: '/plan/dsp-18-outlet-profile' })} live><DeferralLog /></ScreenShell>, { handler: handler() });
    const row = await screen.findByText('To Wed 8 Apr, protected then');
    expect(screen.getByTestId('skipped-twice')).toHaveTextContent('1');
    expect(screen.getByText('Waiting for a decision')).toBeInTheDocument();
    expect(screen.getByText('PROVISIONAL')).toBeInTheDocument();
    expect(screen.getAllByText('CAP-REEFER').length).toBeGreaterThan(0);
    expect(await screen.findByText('Outlet T02')).toBeInTheDocument();
    expect(screen.getByText(/· van_only/)).toBeInTheDocument();
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 2 of 3 · every row opens the outlet');
    const q = view.calls.find(c => c.path === 'Deferrals' && c.query.$top === '25')!;
    expect(q.query).toMatchObject({ $filter: "createdAt ge 2026-03-07T00:00:00Z and order/outlet/depot in ('PELIYAGODA','KANDY')", $expand: 'order,plan($select=id,runDate,approvedBy)', $orderby: 'createdAt desc', $count: 'true' });
    expect(view.calls.find(c => c.path === 'Outlets')!.query.$filter).toBe("id in ('OUTT01','OUTT02')");
    // the dispatcher who decided is named from the Users directory
    expect(await screen.findByText(/by Dee Dispatcher/)).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Users')!.query.$filter).toBe("id in ('u-d')");

    // a row opens the outlet profile for that outlet
    fireEvent.click(row);
    expect(window.sessionStorage.getItem('lodestar.focus.outlet')).toBe('OUTT01');
    expect(router.push).toHaveBeenCalledWith('/plan/dsp-18-outlet-profile');
  });

  it('reason chips, search and “Show more” send the right requests', async () => {
    const view = renderLive(<DeferralLog />, { handler: handler() });
    await screen.findByText('To Wed 8 Apr, protected then');
    fireEvent.click(screen.getByRole('button', { name: /Show more/ }));
    expect(await screen.findByText('ORDT3')).toBeInTheDocument();
    expect(view.calls.some(c => c.query.$skiptoken === '2')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^CAP-REEFER/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Deferrals' && c.query.$filter?.endsWith("and reason eq 'CAP_REEFER'"))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /^Other/ }));
    await waitFor(() => expect(view.calls.some(c => c.query.$filter?.endsWith("reason in ('WINDOW','FUEL','VEH_DOWN')"))).toBe(true));
    fireEvent.change(screen.getByLabelText('Search deferrals'), { target: { value: ' ORDT2 ' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Deferrals' && c.query.$search === 'ORDT2')).toBe(true));
  });

  it('empty and error states', async () => {
    renderLive(<DeferralLog />, { handler: handler(req => (req.path === 'Deferrals' ? page([], 0) : undefined)) });
    expect(await screen.findByText('No deferrals')).toBeInTheDocument();
    expect(screen.getByTestId('skipped-twice')).toHaveTextContent('0');
  });

  it('shows the API error', async () => {
    renderLive(<DeferralLog />, { handler: handler(req => (req.path === 'Deferrals' && req.query.$top === '25' ? err(503, 'Deferrals are not reachable') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Deferrals are not reachable');
  });
});

// ------------------------------------------------------------------------------------------------ DSP-18

describe('DSP-18 Outlet profile', () => {
  const o2 = outlet('OUTT02', { name: 'Outlet T02', dockType: 'STREET', parking: 'VAN_ONLY', accessNote: 'Narrow lane, reverse in', district: 'District T' });
  const next = order('ORDT8', { outletId: 'OUTT02', runDate: '2026-04-08T00:00:00.000Z', status: 'PLANNED', deferredYesterday: true, deferralScore: 95, tempClass: 'CHILLED', m3: 1.5, units: 14, tripStop: { id: 'S8', tripId: 'TRPT8', stopSeq: 3, orderId: 'ORDT8', outletId: 'OUTT02', status: 'PLANNED' } });
  const done = order('ORDT7', { outletId: 'OUTT02', status: 'DELIVERED', tempClass: 'CHILLED', m3: 0.5, tripStop: { id: 'S7', tripId: 'TRPT7', stopSeq: 1, orderId: 'ORDT7', outletId: 'OUTT02', status: 'DELIVERED', arrivalActual: '2026-04-07T00:40:00.000Z', etaModelBandLate: '2026-04-07T00:50:00.000Z' } });
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => base(req) ?? over(req) ?? (
    req.path === 'Outlets' ? page([outlet('OUTT01', { name: 'Outlet T01' }), o2])
      : req.path === "Outlets('OUTT02')" ? o2
        : req.path === "Outlets('OUTT01')" ? outlet('OUTT01', { name: 'Outlet T01' })
          : req.path === 'Orders' && req.query.$filter === "outletId eq 'OUTT02'" ? page([next, done])
            : req.path === 'Deferrals' ? page([{ id: 'D1', orderId: 'ORDT6', reason: 'CAP_REEFER', score: 22, status: 'CONFIRMED', isProvisional: false, rescheduledDate: '2026-04-07', createdAt: '2026-04-05T06:00:00.000Z', order: { runDate: '2026-04-06T00:00:00.000Z' } }])
              : req.path.startsWith('ServiceAllowances(') ? { minutes: 25 }
                : req.path.startsWith('DistrictTravel(') ? { depotToDistMin: 95, roadClass: 'B' }
                  : page([]));

  it('shows the outlet the user opened: skip guard, next delivery, access, record and skip history', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUTT02');
    const view = renderLive(<OutletProfile />, { handler: handler() });
    expect(await screen.findByText('Outlet T02')).toBeInTheDocument();
    expect(await screen.findByText('Protected')).toBeInTheDocument();
    expect(screen.getByText(/Score/)).toHaveTextContent('Score 95');
    expect(screen.getByText('TRPT8 · stop 3')).toBeInTheDocument();
    expect(screen.getByText('Street, no dock')).toBeInTheDocument();
    expect(screen.getByText('Vans only')).toBeInTheDocument();
    expect(screen.getByText('Narrow lane, reverse in')).toBeInTheDocument();
    expect(await screen.findByText('25 min')).toBeInTheDocument();
    expect(await screen.findByText('95 min · District T')).toBeInTheDocument();
    expect(screen.getByText(/on time, last 1 deliveries/).parentElement).toHaveTextContent('100%');
    expect(await screen.findByText('To Tue 7 Apr')).toBeInTheDocument();
    expect(view.calls.find(c => c.path.startsWith('ServiceAllowances('))!.path).toBe("ServiceAllowances(brand='FRESH',dockType='STREET')");
    expect(view.calls.find(c => c.path === 'Deferrals' && c.query.$expand)!.query.$filter).toBe("order/outletId eq 'OUTT02'");
  });

  it('protects by the planner’s own threshold (AgentConfig protectedScore), not a number on the screen', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUTT02');
    const high = { ...next, deferredYesterday: false, deferralScore: 92 };
    renderLive(<OutletProfile />, { handler: handler(req => (req.path === 'Orders' && req.query.$filter === "outletId eq 'OUTT02'" ? page([high, done]) : undefined)) });
    expect(await screen.findByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('deferred yesterday').previousSibling).toHaveTextContent('no');
  });

  it('the picker switches outlet; a new outlet without history says so', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUTT02');
    const view = renderLive(<OutletProfile />, { handler: handler(req => (req.path === 'Deferrals' && req.query.$filter?.includes('OUTT01') ? page([]) : undefined)) });
    await screen.findByText('Outlet T02');
    await screen.findByRole('option', { name: 'OUTT01 · Outlet T01' });
    fireEvent.change(screen.getByLabelText('Outlet'), { target: { value: 'OUTT01' } });
    expect(await screen.findByText('Outlet T01')).toBeInTheDocument();
    expect(await screen.findByText('This outlet has no recent orders.')).toBeInTheDocument();
    expect(await screen.findByText('Never deferred.')).toBeInTheDocument();
    expect(view.calls.some(c => c.path === "Outlets('OUTT01')")).toBe(true);
  });

  it('shows the error when the outlet cannot be read', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUTT99');
    renderLive(<OutletProfile />, { handler: handler(req => (req.path === "Outlets('OUTT99')" ? err(404, 'Outlet OUTT99 not found', 'NotFound') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Outlet OUTT99 not found');
  });
});

// ------------------------------------------------------------------------------------------------ DSP-19

describe('DSP-19 Fleet and vehicle profile', () => {
  const fleet = [
    vehicle('VEHT1', { type: 'VAN', tempClass: 'CHILLED' }),
    vehicle('VEHT2', { type: 'TRUCK', tempClass: 'AMBIENT', status: 'WORKSHOP', workshopNote: 'Brake pads' }),
    vehicle('VEHT3', { type: 'TRUCK', tempClass: 'CHILLED', usedLThisWeek: 380 }),
  ];
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => base(req) ?? over(req) ?? (
    req.path === 'Vehicles' && req.query.$filter === "depot eq 'PELIYAGODA'" ? page(fleet)
      : req.path === 'Vehicles' ? page([])
        : req.path === 'Trips' ? page([{ id: 'T1', vehicleId: 'VEHT1', planMinutes: 150, district: 'Gampaha', tripNumber: 1, status: 'PLANNED' }, { id: 'T2', vehicleId: 'VEHT1', planMinutes: 120, district: 'Kelaniya', tripNumber: 2, status: 'PLANNED' }])
          : req.method === 'POST' ? { id: 'VEHT1', status: 'WORKSHOP' } : page([]));

  it('lists the depot’s fleet with today’s trips and opens the first vehicle', async () => {
    const view = renderLive(<Fleet />, { handler: handler() });
    const table = await screen.findByTestId('fleet');
    await waitFor(() => expect(table.querySelectorAll('[data-vehicle]')).toHaveLength(3));
    expect(await within(table.querySelector('[data-vehicle="VEHT1"]') as HTMLElement).findByText('2 trips · 270 min · Gampaha, Kelaniya')).toBeInTheDocument();
    expect(within(table.querySelector('[data-vehicle="VEHT2"]') as HTMLElement).getByText('Workshop')).toBeInTheDocument();
    expect(within(table.querySelector('[data-vehicle="VEHT3"]') as HTMLElement).getByText('no trips')).toBeInTheDocument();
    const profile = screen.getByTestId('vehicle-profile');
    expect(profile).toHaveTextContent('VEHT1');
    expect(profile).toHaveTextContent('Available');
    expect(profile).toHaveTextContent('Without it Peliyagoda DC has 1 reefers ready.');
    expect(view.calls.find(c => c.path === 'Trips')!.query.$filter).toBe(`depot eq 'PELIYAGODA' and ${RUN_FILTER}`);

    fireEvent.click(within(table).getByRole('button', { name: /^Workshop/ }));
    expect(table.querySelectorAll('[data-vehicle]')).toHaveLength(1);
    fireEvent.click(table.querySelector('[data-vehicle="VEHT2"]')!);
    expect(screen.getByTestId('vehicle-profile')).toHaveTextContent('In workshop');
    expect(screen.getByTestId('vehicle-profile')).toHaveTextContent('Brake pads');
  });

  it('updates a vehicle with Vehicles(…)/Lodestar.SetStatus and reloads the fleet', async () => {
    const view = renderLive(<Fleet />, { handler: handler() });
    await screen.findByTestId('vehicle-profile');
    fireEvent.change(screen.getByLabelText('Vehicle status'), { target: { value: 'WORKSHOP' } });
    fireEvent.change(screen.getByLabelText('Workshop note'), { target: { value: 'Reefer unit fault' } });
    fireEvent.click(screen.getByTestId('update-vehicle'));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Vehicles('VEHT1')/Lodestar.SetStatus", body: { status: 'WORKSHOP', workshopNote: 'Reefer unit fault' } })]));
    await waitFor(() => expect(view.calls.filter(c => c.path === 'Vehicles' && c.query.$orderby === 'tempClass desc,id')).toHaveLength(2));
  });

  it('shows why an update was refused', async () => {
    renderLive(<Fleet />, { handler: handler(req => (req.method === 'POST' ? err(409, 'VEHT1 is on the road and cannot go to the workshop') : undefined)) });
    await screen.findByTestId('vehicle-profile');
    fireEvent.click(screen.getByTestId('update-vehicle'));
    expect(await within(screen.getByTestId('vehicle-profile')).findByRole('alert')).toHaveTextContent('VEHT1 is on the road and cannot go to the workshop');
  });

  it('the other depot’s tab loads its fleet; an empty depot says so', async () => {
    const view = renderLive(<Fleet />, { handler: handler() });
    await screen.findByTestId('vehicle-profile');
    fireEvent.click(screen.getByRole('tab', { name: /^Kandy Hub/ }));
    expect(await screen.findByText('No vehicles')).toBeInTheDocument();
    expect(view.calls.some(c => c.path === 'Vehicles' && c.query.$filter === "depot eq 'KANDY'")).toBe(true);
    expect(screen.queryByTestId('vehicle-profile')).not.toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ DSP-22

describe('DSP-22 Planning agent drafting', () => {
  const run = (status: string, over = {}) => ({ id: 'run-1', depot: 'KANDY', runDate: DAY, status, requestedBy: 'u-d', createdAt: '2026-04-06T07:55:00.000Z', detail: { history: [{ node: 'load_context', at: DAY }], contextSummary: { orders: 42, vehicles: 6, vehiclesDown: ['VEH9'] }, plan: { trips: [] } }, ...over });

  it('without a run it starts one for the depot and run date in view', async () => {
    const view = renderLive(<Drafting />, { handler: req => base(req) ?? (req.method === 'POST' ? { status: 201, body: run('DRAFTING') } : req.path === "AgentRuns('run-1')" ? run('DRAFTING') : page([])) });
    expect(screen.getByText('No draft running')).toBeInTheDocument();
    await waitFor(() => expect(disabled(screen.getByTestId('start-agent'))).toBe(false));
    fireEvent.click(screen.getByTestId('start-agent'));
    expect(await screen.findByTestId('agent-status')).toHaveTextContent(/Drafting|Starting/);
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: 'AgentRuns', body: { depot: 'PELIYAGODA', runDate: '2026-04-07T00:00:00.000Z' } })]);
    expect(window.sessionStorage.getItem('lodestar.agentRun')).toBe('run-1');
    expect(await screen.findByText('42 orders')).toBeInTheDocument();
    expect(screen.getByText('5 / 6 ready')).toBeInTheDocument();
    expect(screen.getByText(/step 3 of 6/)).toBeInTheDocument();
  });

  it('when the draft needs approval it opens the plan board after 1.5 s', async () => {
    jest.useFakeTimers({ now: new Date(NOW) });
    window.sessionStorage.setItem('lodestar.agentRun', 'run-1');
    renderLive(<Drafting />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-1')" ? run('NEEDS_APPROVAL') : page([])) });
    expect(await screen.findByText('Draft ready for your review')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status')).toHaveTextContent('Ready');
    act(() => { jest.advanceTimersByTime(1400); });
    expect(router.push).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(200); });
    expect(router.push).toHaveBeenCalledWith('/plan/dsp-02-plan-board');
  });

  it('a failed run and a run that cannot be read are reported', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-1');
    const { unmount } = renderLive(<Drafting />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-1')" ? run('FAILED') : page([])) });
    expect(await screen.findByText('The planning agent stopped')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The agent run failed. Plan manually or start a new draft.');
    unmount();
    renderLive(<Drafting />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-1')" ? err(404, 'Agent run run-1 not found') : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Agent run run-1 not found');
  });

  it('shows why the agent could not be started', async () => {
    renderLive(<Drafting />, { handler: req => base(req) ?? (req.method === 'POST' ? err(503, 'The planning agent is not reachable') : page([])) });
    await waitFor(() => expect(disabled(screen.getByTestId('start-agent'))).toBe(false));
    fireEvent.click(screen.getByTestId('start-agent'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The planning agent is not reachable');
    expect(window.sessionStorage.getItem('lodestar.agentRun')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------ DSP-40

describe('DSP-40 Agent proposal in draft', () => {
  const agentRun = {
    id: 'run-9', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: DAY,
    detail: { plan: { version: 4, trips: [{ id: 'A1', vehicleId: 'VEHT1', tripNo: 1, brand: 'FRESH', district: 'District T', chilled: true, orderIds: ['ORDT1', 'ORDT2'], kg: 300, m3: 2, minutes: 140 }] }, deferrals: [{ orderId: 'ORDT5', outletId: 'OUTT05', reason: 'CAP_REEFER', score: 18, suggested: true, m3: 1.2, rank: 1 }] },
  };
  const edits = [{ op: 'move', orderId: 'ORDT2', vehicleId: 'VEHT2', tripNo: 1 }];
  const seed = () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    window.sessionStorage.setItem('lodestar.ask.run-9', JSON.stringify([{ q: 'Move ORDT2 to VEHT2', at: DAY, a: { answer: 'VEHT2 has room.', toolCalls: [], proposal: { edits, draftVersion: 5, ruleChecks: [{ rule: 'weight', label: 'Weight', passed: true, violations: 0 }] } } }]));
  };
  const links = nav({ L159: '/plan/dsp-02-plan-board', L160: '/plan/dsp-39-ask-the-planning-agent' });
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => base(req) ?? over(req) ?? (
    req.path === "AgentRuns('run-9')" ? agentRun
      : req.path === 'Vehicles' ? page([vehicle('VEHT1', { depot: 'KANDY' })])
        : req.method === 'POST' ? { ...agentRun, detail: { ...agentRun.detail, plan: { ...agentRun.detail.plan, version: 5 } } } : page([]));

  it('shows the draft board and the agent’s proposal; “Apply to draft” resumes the run with the edits', async () => {
    seed();
    const view = renderLive(<ScreenShell board="P2" nav={links} live><Proposal /></ScreenShell>, { handler: handler() });
    const proposal = await screen.findByTestId('proposal');
    expect(proposal).toHaveTextContent('1 change to the draft');
    expect(proposal).toHaveTextContent('ORDT2move');
    expect(proposal).toHaveTextContent('VEHT2 Trip 1');
    expect(proposal).toHaveTextContent('Draft v5 · not live');
    expect(await screen.findByText('waiting for your approval')).toBeInTheDocument();
    expect(document.querySelector('[data-vehicle="VEHT1"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Review deferrals \(1\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('apply-proposal'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/plan/dsp-02-plan-board'));
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "AgentRuns('run-9')/Lodestar.Resume", body: { decision: 'edit', edits, comment: 'Move ORDT2 to VEHT2' } })]);
    expect(JSON.parse(window.sessionStorage.getItem('lodestar.ask.run-9')!)[0].a.proposal).toBeNull();
  });

  it('on an approved (live) plan the proposal becomes the next version as a new draft run, which this tab follows to approval', async () => {
    seed();
    const live = { ...agentRun, status: 'APPROVED', planId: 'PLT-2026-04-07-v1' };
    const v2 = { ...agentRun, id: 'run-10', detail: { ...agentRun.detail, plan: { ...agentRun.detail.plan, version: 2 } } };
    const view = renderLive(<ScreenShell board="P2" nav={links} live><Proposal /></ScreenShell>, {
      handler: handler(req => (req.path === "AgentRuns('run-9')" ? live
        : req.path === 'Plans' && String(req.query.$filter).includes("id eq 'PLT-2026-04-07-v1'") ? page([{ id: 'PLT-2026-04-07-v1', version: 1, status: 'PUBLISHED' }])
          : req.path === "AgentRuns('run-10')" ? v2 : req.method === 'POST' ? v2 : undefined)),
    });
    const proposal = await screen.findByTestId('proposal');
    expect(await screen.findByText('approved · live')).toBeInTheDocument();
    expect(screen.getByText(/Plan by planning agent/)).toBeInTheDocument();
    expect(proposal).toHaveTextContent('Draft v2 · not live');
    expect(proposal).toHaveTextContent('1 change to the live plan, as a new draft');
    // reviewing the draft's deferrals is not the next step on a live plan
    const review = screen.getByRole('button', { name: /Review deferrals/ });
    expect(review).not.toHaveClass('d-btn--primary');
    expect(review).toHaveTextContent(/^Review deferrals$/);
    fireEvent.click(screen.getByTestId('apply-proposal'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/plan/dsp-02-plan-board'));
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "AgentRuns('run-9')/Lodestar.Resume", body: { decision: 'edit', edits, comment: 'Move ORDT2 to VEHT2' } })]);
    expect(window.sessionStorage.getItem('lodestar.agentRun')).toBe('run-10');
  });

  it('“Dismiss” drops the proposal without calling the API', async () => {
    seed();
    const view = renderLive(<ScreenShell board="P2" nav={links} live><Proposal /></ScreenShell>, { handler: handler() });
    fireEvent.click(await screen.findByTestId('dismiss-proposal'));
    expect(router.push).toHaveBeenCalledWith('/plan/dsp-39-ask-the-planning-agent');
    expect(posts(view.calls)).toHaveLength(0);
    expect(screen.queryByTestId('proposal')).not.toBeInTheDocument();
  });

  it('shows why the proposal could not be applied, and keeps it', async () => {
    seed();
    renderLive(<ScreenShell board="P2" nav={links} live><Proposal /></ScreenShell>, { handler: handler(req => (req.method === 'POST' ? err(409, 'The draft changed; ask again') : undefined)) });
    fireEvent.click(await screen.findByTestId('apply-proposal'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The draft changed; ask again');
    expect(screen.getByTestId('proposal')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('without a draft it offers to start one; “Approve & go live” stays off', async () => {
    const view = renderLive(<Proposal />, { handler: req => base(req) ?? (req.method === 'POST' ? { status: 201, body: { ...agentRun, id: 'run-10' } } : req.path === "AgentRuns('run-10')" ? { ...agentRun, id: 'run-10' } : page([])) });
    expect(screen.getByText('No draft to ask about')).toBeInTheDocument();
    expect(disabled(screen.getByRole('button', { name: /Approve & go live/ }))).toBe(true);
    await waitFor(() => expect(disabled(screen.getByTestId('start-agent'))).toBe(false));
    fireEvent.click(screen.getByTestId('start-agent'));
    await waitFor(() => expect(window.sessionStorage.getItem('lodestar.agentRun')).toBe('run-10'));
    expect(posts(view.calls)[0]).toMatchObject({ path: 'AgentRuns', body: { depot: 'PELIYAGODA', runDate: '2026-04-07T00:00:00.000Z' } });
  });
});

// ------------------------------------------------------------------------------- DSP-01/02/03/12 states

describe('DSP-01/02/03/12 · loading, empty and error states', () => {
  it('DSP-01: loading skeleton, then an empty queue; no plans at all says so', async () => {
    const { unmount } = renderLive(<CutoffQueue />, { handler: req => base(req) ?? page([], 0) });
    expect(screen.getAllByRole('status', { name: 'Loading live data…' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('No orders for this run date yet.')).toBeInTheDocument();
    unmount();
    renderLive(<CutoffQueue />, { handler: req => (req.query.$top === '0' ? page([], 0) : page([])) });
    expect(await screen.findByText('No run date yet')).toBeInTheDocument();
  });

  it('DSP-02: an empty board and an error banner', async () => {
    const { unmount } = renderLive(<PlanBoard />, { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('No trips on the board')).toBeInTheDocument();
    unmount();
    renderLive(<PlanBoard />, { handler: req => base(req) ?? (req.path === 'Trips' ? err(503, 'Trips are not reachable') : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Trips are not reachable');
  });

  it('DSP-03: unticking a candidate leaves it out; dismissing sends Deferrals(…)/Lodestar.Dismiss', async () => {
    const deferrals = ['DT1', 'DT2'].map((id, i) => ({ id, orderId: `ORDT${i + 1}`, reason: 'CAP_REEFER', score: 20 + i, status: 'SUGGESTED', isProvisional: false, createdAt: DAY, order: order(`ORDT${i + 1}`, { m3: 1.5 }) }));
    const view = renderLive(<DeferralDecision />, { handler: req => base(req) ?? (req.path === 'Deferrals' ? page(deferrals) : req.path === 'Outlets' ? page([outlet('OUTT01')]) : req.method === 'POST' ? { id: 'x' } : page([])) });
    await screen.findByText('Defer 2 orders to Wed');
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(disabled(screen.getByTestId('confirm-all'))).toBe(true);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByTestId('confirm-all'));
    await waitFor(() => expect(posts(view.calls)).toHaveLength(1));
    expect(posts(view.calls)[0].path).toBe("Deferrals('DT2')/Lodestar.Confirm");
    fireEvent.click(screen.getByTestId('dismiss'));
    await waitFor(() => expect(posts(view.calls).map(p => p.path)).toContain("Deferrals('DT1')/Lodestar.Dismiss"));
  });

  it('DSP-03: nothing to decide, and the list error', async () => {
    const { unmount } = renderLive(<DeferralDecision />, { handler: req => base(req) ?? page([]) });
    expect(await screen.findByText('Nothing to decide')).toBeInTheDocument();
    expect(screen.getByText('No deferrals to decide')).toBeInTheDocument();
    unmount();
    renderLive(<DeferralDecision />, { handler: req => base(req) ?? (req.path === 'Deferrals' ? err(500, 'Deferrals failed') : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Deferrals failed');
  });

  it('DSP-12: rejecting the agent draft resumes it with decision reject; nothing goes live', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-9');
    const run = { id: 'run-9', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: DAY, detail: { plan: { version: 4, trips: [] }, ruleChecks: [], deferrals: [] } };
    const view = renderLive(<ApproveAndGoLive />, { handler: req => base(req) ?? (req.path === "AgentRuns('run-9')" ? run : req.method === 'POST' ? { ...run, status: 'REJECTED' } : page([])) });
    fireEvent.change(await screen.findByLabelText('Approval note'), { target: { value: 'Wrong depot' } });
    fireEvent.click(screen.getByTestId('reject-draft'));
    expect(await screen.findByText('Draft rejected. Nothing went live.')).toBeInTheDocument();
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "AgentRuns('run-9')/Lodestar.Resume", body: { decision: 'reject', comment: 'Wrong depot' } })]);
    expect(window.sessionStorage.getItem('lodestar.agentRun')).toBeNull();
  });

  it('DSP-12: a refused approval is shown and the plan does not go live', async () => {
    const view = renderLive(<ApproveAndGoLive />, {
      handler: req => base(req) ?? (req.path === 'Plans' ? page([{ id: 'PLT-v5', depot: 'KANDY', runDate: DAY, version: 5, status: 'NEEDS_APPROVAL', source: 'AUTOPLAN', summary: { plan: { trips: [{ id: 'VEHT1-T1' }] } } }])
        : req.method === 'POST' ? err(412, 'Someone else changed this plan first') : page([])),
    });
    await screen.findByText(/Approve \d+ orders and go live/);
    fireEvent.click(screen.getByTestId('approve'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this plan first');
    expect(posts(view.calls)[0].path).toBe("Plans('PLT-v5')/Lodestar.Approve");
    expect(screen.getByTestId('approve')).toHaveTextContent('Approve & go live');
  });
});

// ------------------------------------------------------------------- the demo flow: draft → board → trip drawer

describe('Agent draft → plan board → trip drawer', () => {
  const stops = [
    { seq: 1, orderId: 'ORDT1', outletId: 'OUTT01', arrive: '05:30', etaModel: '05:41', window: '05:30-08:00', dockType: 'REAR_DOCK', serviceMin: 15, lateRiskPct: 5 },
    { seq: 2, orderId: 'ORDT2', outletId: 'OUTT02', arrive: '06:10', etaModel: '06:32', window: '05:30-07:00', dockType: 'STREET', serviceMin: 12, lateRiskPct: 41 },
  ];
  const draftRun = {
    id: 'run-1', depot: 'KANDY', runDate: DAY, status: 'NEEDS_APPROVAL', requestedBy: 'u-d', createdAt: NOW,
    detail: {
      runDate: '2026-04-07',
      plan: { version: 1, trips: [
        { id: 'VEH039-T1', vehicleId: 'VEH039', tripNo: 1, brand: 'FRESH', district: 'District T', chilled: true, orderIds: ['ORDT9'], kg: 50, m3: 1, minutes: 90, departs: '03:30', stops: [] },
        { id: 'VEH057-T1', vehicleId: 'VEH057', tripNo: 1, brand: 'FRESH', district: 'Kandy', chilled: true, orderIds: ['ORDT1', 'ORDT2'], kg: 300, m3: 2.5, minutes: 120, departs: '04:50', returns: '07:30', stops },
      ] },
      ruleChecks: [
        { rule: 'weight', label: 'Weight within vehicle capacity (kg)', passed: true, violations: 0 },
        { rule: 'window', label: 'Every stop arrives before its window closes', passed: false, violations: 1 },
      ],
      violations: [{ rule: 'window', tripId: 'VEH057-T1', vehicleId: 'VEH057', orderIds: ['ORDT2'], reason: 'late', detail: '' }],
    },
  };
  const handler = (req: FakeRequest) => base(req) ?? (
    req.path === "AgentRuns('run-1')" ? draftRun
      : req.path === "Vehicles('VEH057')" ? vehicle('VEH057', { depot: 'KANDY' })
        : req.path === 'Vehicles' ? page([vehicle('VEH039', { depot: 'KANDY', type: 'TRUCK' }), vehicle('VEH057', { depot: 'KANDY' })])
          : page([]));
  afterEach(() => { act(() => { setStarting(null); closeOverlay(); }); });

  it('DSP-22 shows the draft being made (not an earlier run of the day) until the agent is done', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-1');
    act(() => setStarting({ depot: 'KANDY', runDate: '2026-04-07', at: Date.now() }));
    renderLive(<Drafting />, { handler });
    expect(await screen.findByTestId('agent-status')).toHaveTextContent('Drafting');
    expect(screen.queryByText('Draft ready for your review')).not.toBeInTheDocument();
    expect(screen.queryByText('No draft running')).not.toBeInTheDocument();
    act(() => setStarting(null));
    await waitFor(() => expect(screen.getByTestId('agent-status')).toHaveTextContent('Ready'));
  });

  it('a draft trip card (or its vehicle) opens that trip in the drawer, read from the draft', async () => {
    window.sessionStorage.setItem('lodestar.agentRun', 'run-1');
    const board = renderLive(<PlanBoard />, { handler });
    const lane = await waitFor(() => { const l = document.querySelector('[data-vehicle="VEH057"]'); expect(l).not.toBeNull(); return l as HTMLElement; });
    expect(lane).toHaveTextContent('departs 4:50');
    fireEvent.click(lane.querySelector('.x-veh')!);
    expect(window.sessionStorage.getItem('lodestar.focus.trip')).toBe('VEH057-T1');
    expect(window.sessionStorage.getItem('lodestar.focus.vehicle')).toBe('VEH057');
    expect(currentOverlay()).toBe('/plan/dsp-11-trip-and-vehicle-drawer');
    fireEvent.click(document.querySelector('[data-trip="VEH039-T1"]')!);
    expect(window.sessionStorage.getItem('lodestar.focus.trip')).toBe('VEH039-T1');
    board.unmount();

    window.sessionStorage.setItem('lodestar.focus.trip', 'VEH057-T1');
    const view = renderLive(<TripDrawer />, { handler });
    const drawer = await screen.findByTestId('trip-drawer');
    expect(await within(drawer).findByText('VEH057 · Trip 1')).toBeInTheDocument();
    expect(drawer).toHaveTextContent('draft v1');
    const rows = [...screen.getByTestId('stops').querySelectorAll('[data-stop]')];
    expect(rows.map(r => r.getAttribute('data-stop'))).toEqual(['VEH057-T1-1', 'VEH057-T1-2']);
    expect(rows[1]).toHaveTextContent('plan 6:10');
    expect(rows[1]).toHaveTextContent('model 6:32');
    expect(rows[1]).toHaveTextContent('late risk 41%');
    expect(rows[0]).toHaveTextContent('window 05:30–08:00');
    const checks = screen.getByTestId('rule-checks');
    expect(checks.querySelector('[data-rule="weight"]')).toHaveTextContent('pass');
    expect(checks.querySelector('[data-rule="window"]')).toHaveTextContent('1 on this vehicle');
    expect(screen.getByText('300 / 1,000 kg')).toBeInTheDocument();
    // a draft trip is not in Trips yet
    expect(view.calls.some(c => c.path.startsWith('Trips('))).toBe(false);
  });
});
