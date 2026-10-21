// WP6 live Admin screens: ADM-09 Edit outlet, ADM-11 Vehicle status, ADM-12 Operating rules, ADM-13 Calendar and
// ADM-18 Notifications and integrations. Real ODataClient over a fake fetch: assertions on requests are at the
// HTTP level. Date is frozen at Mon 6 Apr 2026 13:30 (Colombo).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ScreenShell from '@/components/ScreenShell';
import EditOutlet from '@/live/adm-09-edit-outlet';
import VehicleStatus from '@/live/adm-11-vehicle-status';
import OperatingRules from '@/live/adm-12-operating-rules';
import Calendar from '@/live/adm-13-calendar';
import Notifications from '@/live/adm-18-notifications-and-integrations';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { agentConfigReply, page, renderLive, SESSIONS } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin' }));

const NOW = '2026-04-06T08:00:00.000Z';
const admin = { session: SESSIONS.admin };
const err = (status: number, message: string, code = 'Failed') => ({ status, body: { error: { code, message } } });
const nav = (links: Record<string, string>) => ({ links: Object.fromEntries(Object.entries(links).map(([k, href]) => [k, { href, kind: 'go' }])) });
const disabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';
const outlet = (id: string, over = {}) => ({ id, name: 'Nuwara Eliya', brand: 'FRESH', district: 'Nuwara Eliya', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true, ...over });
const vehicle = (id: string, over = {}) => ({ id, depot: 'PELIYAGODA', type: 'TRUCK', tempClass: 'CHILLED', capacityKg: 6840, capacityM3: 33.4, kmPerLitre: 4.4, weeklyLFuel: 380, usedLThisWeek: 100, status: 'AVAILABLE', workshopNote: null, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/admin');
  freezeDate(NOW);
});
afterEach(unfreeze);

// ------------------------------------------------------------------------------------------------ ADM-09

describe('ADM-09 Edit outlet', () => {
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], 1)
      : req.path === "Outlets('OUT106')" && req.method === 'GET' ? { status: 200, body: outlet('OUT106'), headers: { ETag: 'W/"12"' } }
        : req.path === 'Users' ? page([{ id: 'u5', name: 'Fathima Rizwan' }])
          : req.method === 'PATCH' ? outlet('OUT106', { windowOpen: '06:00' }) : page([]));

  it('shows the outlet and its store manager; saves a new window with PATCH and If-Match, then returns to Outlets', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUT106');
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L296: '/admin/adm-08-outlets' })} live><EditOutlet /></ScreenShell>, { ...admin, handler: handler() });
    expect(await screen.findByText('Waypoint Fresh Nuwara Eliya')).toBeInTheDocument();
    expect(screen.getByText('Outlet · OUT106')).toBeInTheDocument();
    expect(await screen.findByText('Store manager Fathima Rizwan')).toBeInTheDocument();
    expect(screen.getByText('Nuwara Eliya · Kandy Hub')).toBeInTheDocument();
    expect(screen.getByText('rear_dock · normal access')).toBeInTheDocument();
    expect(screen.getByTestId('window-now')).toHaveTextContent('05:30 to 08:00');
    expect(view.calls.find(c => c.path === 'Users' && c.query.$top !== '0')!.query.$filter).toBe("outletId eq 'OUT106' and role eq 'STORE_MANAGER'");
    expect(disabled(screen.getByTestId('save-window'))).toBe(true); // nothing changed yet
    fireEvent.change(screen.getByLabelText('Window opens'), { target: { value: '06:00' } });
    expect(disabled(screen.getByTestId('save-window'))).toBe(false);
    fireEvent.click(screen.getByTestId('save-window'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/adm-08-outlets'));
    const patch = view.calls.find(c => c.method === 'PATCH')!;
    expect(patch.path).toBe("Outlets('OUT106')");
    expect(patch.headers['If-Match']).toBe('W/"12"');
    expect(patch.body).toEqual({ windowOpen: '06:00', windowClose: '08:00' });
  });

  it('a window that ends before it starts cannot be saved', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUT106');
    renderLive(<EditOutlet />, { ...admin, handler: handler() });
    await screen.findByText('Waypoint Fresh Nuwara Eliya');
    fireEvent.change(screen.getByLabelText('Window closes'), { target: { value: '05:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('A delivery window must end after it starts.');
    expect(disabled(screen.getByTestId('save-window'))).toBe(true);
  });

  it('a refused save shows the API’s reason and stays open', async () => {
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUT106');
    renderLive(<ScreenShell board="P6" nav={nav({ L296: '/admin/adm-08-outlets' })} live><EditOutlet /></ScreenShell>, {
      ...admin,
      handler: handler(req => (req.method === 'PATCH' ? err(412, 'The outlet changed since you opened it', 'PreconditionFailed') : undefined)),
    });
    await screen.findByText('Waypoint Fresh Nuwara Eliya');
    fireEvent.change(screen.getByLabelText('Window opens'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByTestId('save-window'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The outlet changed since you opened it');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('without a chosen outlet it asks for one; a missing outlet shows the error', async () => {
    const { unmount } = renderLive(<EditOutlet />, { ...admin, handler: handler() });
    expect(screen.getByText('No outlet chosen')).toBeInTheDocument();
    unmount();
    window.sessionStorage.setItem('lodestar.focus.outlet', 'OUT999');
    renderLive(<EditOutlet />, { ...admin, handler: handler(req => (req.path === "Outlets('OUT999')" ? err(404, 'Outlet OUT999 not found', 'NotFound') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Outlet OUT999 not found');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-11

describe('ADM-11 Vehicle status', () => {
  const SAME = "depot eq 'PELIYAGODA' and tempClass eq 'CHILLED' and type eq 'TRUCK'";
  const handler = (v: object, over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], req.query.$filter === `${SAME} and status eq 'AVAILABLE'` ? 7 : 1)
      : req.path === "Vehicles('VEH006')" ? v
        : req.path === 'Vehicles' && req.query.$filter === `${SAME} and status eq 'WORKSHOP' and id ne 'VEH006'` ? page([{ id: 'VEH004' }])
          : req.method === 'POST' ? { ...v, status: 'WORKSHOP' } : page([]));

  it('marks a vehicle in the workshop with a required reason and says what the planner does', async () => {
    window.sessionStorage.setItem('lodestar.focus.vehicle', 'VEH006');
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L298: '/admin/adm-10-vehicles' })} live><VehicleStatus /></ScreenShell>, { ...admin, handler: handler(vehicle('VEH006')) });
    expect(await screen.findByText('VEH006 · reefer truck')).toBeInTheDocument();
    expect(screen.getByText('Vehicle · Peliyagoda')).toBeInTheDocument();
    expect(screen.getByText('6,840 kg · 33.4 m³ · 4.4 km/L · 380 L a week')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'In service' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('agent-effect')).not.toBeInTheDocument();
    expect(disabled(screen.getByTestId('set-status'))).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: /In workshop/ }));
    expect(disabled(screen.getByTestId('set-status'))).toBe(true); // reason first
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Reefer unit failed pre-departure check' } });
    expect(disabled(screen.getByTestId('set-status'))).toBe(false);
    const effect = screen.getByTestId('agent-effect');
    expect(effect).toHaveTextContent('Leaves VEH006 out of the drafts until it is back in service.');
    await waitFor(() => expect(effect).toHaveTextContent('Peliyagoda reefer trucks drop from 7 to 6 (VEH004 is out too). Expect deferral proposals with reason CAP-REEFER.'));
    expect(effect).toHaveTextContent('Nothing published changes.');

    fireEvent.click(screen.getByTestId('set-status'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/adm-10-vehicles'));
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({
      path: "Vehicles('VEH006')/Lodestar.SetStatus",
      body: { status: 'WORKSHOP', workshopNote: 'Reefer unit failed pre-departure check' },
    });
  });

  it('a vehicle in the workshop goes back in service without a reason', async () => {
    window.sessionStorage.setItem('lodestar.focus.vehicle', 'VEH006');
    const view = renderLive(<VehicleStatus />, { ...admin, handler: handler(vehicle('VEH006', { status: 'WORKSHOP', workshopNote: 'Compressor' })) });
    await screen.findByText('VEH006 · reefer truck');
    expect(screen.getByRole('radio', { name: /In workshop/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Reason')).toHaveValue('Compressor');
    fireEvent.click(screen.getByRole('radio', { name: 'In service' }));
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('agent-effect')).toHaveTextContent('Peliyagoda reefer trucks rise from 7 to 8'));
    expect(screen.getByTestId('set-status')).toHaveTextContent('Mark in service');
    fireEvent.click(screen.getByTestId('set-status'));
    await waitFor(() => expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "Vehicles('VEH006')/Lodestar.SetStatus", body: { status: 'AVAILABLE' } }));
  });

  it('a refused change shows the API’s reason; no vehicle chosen asks for one', async () => {
    window.sessionStorage.setItem('lodestar.focus.vehicle', 'VEH006');
    const { unmount } = renderLive(<VehicleStatus />, { ...admin, handler: handler(vehicle('VEH006'), req => (req.method === 'POST' ? err(403, 'Not allowed for this depot', 'Forbidden') : undefined)) });
    await screen.findByText('VEH006 · reefer truck');
    fireEvent.click(screen.getByRole('radio', { name: /In workshop/ }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Brakes' } });
    fireEvent.click(screen.getByTestId('set-status'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed for this depot');
    unmount();
    window.sessionStorage.clear();
    renderLive(<VehicleStatus />, { ...admin, handler: handler(vehicle('VEH006')) });
    expect(screen.getByText('No vehicle chosen')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ ADM-12

describe('ADM-12 Operating rules', () => {
  const MIN: Record<string, number[]> = { FRESH: [15, 16, 18], STYLE: [38, 46, 59], TECH: [43, 55, 55] };
  const allowances = Object.entries(MIN).flatMap(([brand, m]) => ['REAR_DOCK', 'STREET', 'MALL_BAY'].map((dockType, i) => ({ brand, dockType, minutes: m[i] })));

  it('shows the planner’s locked rules and the service allowances from the API', async () => {
    const view = renderLive(<OperatingRules />, { ...admin, handler: req => agentConfigReply(req) ?? (req.query.$top === '0' ? page([], 1) : req.path === 'ServiceAllowances' ? page(allowances) : page([])) });
    expect(await screen.findByText('Max 2 a day')).toBeInTheDocument();
    expect(screen.getByText('3:30 to 8:00 · 270 min')).toBeInTheDocument();
    expect(screen.getByText('480 min')).toBeInTheDocument();
    expect(screen.getByText('One brand, one district')).toBeInTheDocument();
    const card = screen.getByTestId('service-allowances');
    await waitFor(() => expect(card.querySelectorAll('[data-brand]')).toHaveLength(3));
    expect(card.querySelector('[data-brand="FRESH"]')).toHaveTextContent('F Fresh151618');
    expect(card.querySelector('[data-brand="TECH"]')).toHaveTextContent('T Tech435555');
    expect(view.calls.find(c => c.path === 'ServiceAllowances')!.query.$orderby).toBe('brand,dockType');
    expect(screen.queryByText('Propose a change')).not.toBeInTheDocument();
    expect(screen.queryByText(/Proposed v8/)).not.toBeInTheDocument();
  });

  it('a missing allowance shows a dash; empty and error states', async () => {
    const { unmount } = renderLive(<OperatingRules />, { ...admin, handler: req => (req.path === 'ServiceAllowances' ? page(allowances.slice(1)) : page([], 1)) });
    await waitFor(() => expect(screen.getByTestId('service-allowances').querySelector('[data-brand="FRESH"]')).toHaveTextContent('F Fresh—1618'));
    unmount();
    const second = renderLive(<OperatingRules />, { ...admin, handler: req => (req.path === 'ServiceAllowances' ? page([]) : page([], 1)) });
    expect(await screen.findByText('No service allowances')).toBeInTheDocument();
    second.unmount();
    renderLive(<OperatingRules />, { ...admin, handler: req => (req.path === 'ServiceAllowances' ? err(500, 'Database is not reachable') : page([], 1)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is not reachable');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-13

describe('ADM-13 Calendar', () => {
  const at = (d: string) => `${d}T00:00:00.000Z`;
  const add = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const RAMP: Record<string, number> = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [add('2026-04-04', i), (i + 1) / 10]));
  const day = (d: string) => {
    const sun = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
    const ny = d === '2026-04-13' || d === '2026-04-14';
    return { date: at(d), isOperating: !sun && !ny, isPayday: d === '2026-04-25', festivalRamp: RAMP[d] ?? 0, monsoon: 1, festivalName: ny ? 'Sinhala and Tamil New Year' : null, note: null };
  };
  const span = (from: string, to: string) => {
    const out = [];
    for (let d = from; d < to; d = add(d, 1)) out.push(day(d));
    return out;
  };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => {
    const o = over(req);
    if (o !== undefined) return o;
    if (req.query.$top === '0') return page([], 1);
    if (req.path !== 'Calendar') return page([]);
    const f = req.query.$filter ?? '';
    if (!f && req.query.$orderby === 'date') return page([{ date: at('2024-01-01') }]);
    if (!f && req.query.$orderby === 'date desc') return page([{ date: at('2026-06-28') }]);
    if (f.startsWith('monsoon eq 0 and date lt')) return page([{ date: at('2026-02-28') }]);
    if (f.startsWith('monsoon eq 0 and date gt')) return page([]);
    const m = /^date ge (\S+)T00:00:00Z and date lt (\S+)T00:00:00Z$/.exec(f);
    return m ? page(span(m[1], m[2] < '2026-06-29' ? m[2] : '2026-06-29')) : page([]);
  };

  it('draws this month from the Calendar set with today, holidays, ramps and paydays', async () => {
    const view = renderLive(<Calendar />, { ...admin, handler: handler() });
    expect(await screen.findByText(/1 Jan 2024 to 28 Jun 2026/)).toBeInTheDocument();
    const month = screen.getByTestId('calendar-month');
    expect(within(month).getByText('April 2026')).toBeInTheDocument();
    await waitFor(() => expect(month.querySelectorAll('.adm-cal__row')).toHaveLength(5));
    expect(view.calls.some(c => c.path === 'Calendar' && c.query.$filter === 'date ge 2026-03-30T00:00:00Z and date lt 2026-05-04T00:00:00Z')).toBe(true);
    const cell = (d: string) => month.querySelector(`[data-day="${d}"]`) as HTMLElement;
    await waitFor(() => expect(cell('2026-04-06')).toHaveTextContent('6 Today'));
    expect(cell('2026-04-06')).toHaveClass('adm-day--today');
    expect(cell('2026-04-06')).toHaveTextContent('ramp 0.3');
    expect(cell('2026-04-05')).toHaveClass('adm-day--sun');
    expect(cell('2026-04-05')).toHaveTextContent('Sun · closed');
    expect(cell('2026-04-13')).toHaveClass('adm-day--hol');
    expect(cell('2026-04-13')).toHaveTextContent('Sinhala and Tamil New YearClosed');
    expect(cell('2026-04-25')).toHaveTextContent('Payday');
    expect(cell('2026-03-31')).toHaveClass('adm-day--out');
    expect(cell('2026-03-31')).toHaveTextContent('31Mar');
    expect(within(month).getByText('W15')).toBeInTheDocument();
    expect(within(month).getByText('Monsoon all month')).toBeInTheDocument();
    expect(screen.getByText('Replace calendar.csv').closest('[data-lk]')).toHaveAttribute('data-lk', 'L66');
  });

  it('lists what is coming up: festivals with their ramp, paydays, the monsoon run and the calendar end', async () => {
    renderLive(<Calendar />, { ...admin, handler: handler() });
    const list = await screen.findByTestId('coming-up');
    await waitFor(() => expect(list).toHaveTextContent('Monsoon flag on'));
    const rows = [...list.querySelectorAll('.dx-kv')].map(r => r.textContent);
    expect(rows).toEqual([
      '13 AprSinhala and Tamil New YearMon 13 and Tue 14 closed · ramp from 4 Apr',
      '25 AprPaydaySat · operating',
      '1 MarMonsoon flag onEvery day to 28 Jun. Hill runs use monsoon speeds',
      '28 JunCalendar endsLoad W27 onward',
    ]);
  });

  it('another month is read when picked', async () => {
    const view = renderLive(<Calendar />, { ...admin, handler: handler() });
    fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '2026-05' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Calendar' && c.query.$filter === 'date ge 2026-04-27T00:00:00Z and date lt 2026-06-01T00:00:00Z')).toBe(true));
    expect(within(screen.getByTestId('calendar-month')).getByText('May 2026')).toBeInTheDocument();
  });

  it('empty and error states', async () => {
    const { unmount } = renderLive(<Calendar />, { ...admin, handler: handler(req => (req.path === 'Calendar' ? page([]) : undefined)) });
    expect(await screen.findByText('No calendar yet')).toBeInTheDocument();
    unmount();
    renderLive(<Calendar />, { ...admin, handler: handler(req => (req.path === 'Calendar' ? err(503, 'The outlets service is not reachable') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('The outlets service is not reachable');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-18

describe('ADM-18 Notifications and integrations', () => {
  const sent = [
    { id: 'N1', type: 'ETA_UPDATE', recipientId: 'u-s1' },
    { id: 'N2', type: 'ETA_UPDATE', recipientId: 'u-s2' },
    { id: 'N3', type: 'SHORTFALL_FLAGGED', recipientId: 'u-d1' },
  ];
  const users = [{ id: 'u-s1', role: 'STORE_MANAGER' }, { id: 'u-s2', role: 'STORE_MANAGER' }, { id: 'u-d1', role: 'DISPATCHER' }];

  it('shows the app push channel with today’s notifications, the hub’s state and who got what; no SMS, email or voice', async () => {
    const view = renderLive(<Notifications />, {
      ...admin,
      handler: req => (req.path === 'Notifications' ? page(sent, 1284) : req.path === 'Users' ? page(users) : req.query.$top === '0' ? page([], 1) : page([])),
    });
    const card = screen.getByTestId('channels');
    expect(within(card).getByText('App push')).toBeInTheDocument();
    expect(within(card).getByText('All up')).toBeInTheDocument();
    expect(await within(card).findByText('1,284 today')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Notifications')!.query.$filter).toBe('sentAt ge 2026-04-06T00:00:00Z');
    const who = screen.getByTestId('who-gets-what');
    await waitFor(() => expect(who.querySelector('[data-type="ETA_UPDATE"]')).toHaveTextContent('Store manager: eta update2 · app'));
    expect(who.querySelector('[data-type="SHORTFALL_FLAGGED"]')).toHaveTextContent('Dispatcher: shortfall flagged1 · app');
    expect(view.calls.find(c => c.path === 'Users' && c.query.$top !== '0')!.query.$filter).toBe("id in ('u-s1','u-s2','u-d1')");
    expect(screen.queryByText('SMS gateway')).not.toBeInTheDocument();
  });

  it('“Send test push” sends a stored notification to the signed-in admin only, then shows the result', async () => {
    const view = renderLive(<Notifications />, {
      ...admin,
      handler: req => (req.path === 'Notifications/Lodestar.Send' ? { id: 'N9', recipientId: 'u-a', type: 'ADMIN_TEST', channel: 'WEBSOCKET', sentAt: '2026-04-06T08:00:00.000Z' }
        : req.path === 'Notifications' ? page([], 0) : page([], 0)),
    });
    expect(await screen.findByText('Nothing sent today')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Test message'), { target: { value: 'Check from the desk' } });
    fireEvent.click(screen.getByTestId('send-test'));
    expect(await screen.findByTestId('test-result')).toHaveTextContent('Test sent 1:30 PM. Stored as N9');
    const post = view.calls.find(c => c.method === 'POST')!;
    expect(post.path).toBe('Notifications/Lodestar.Send');
    expect(post.body).toEqual({ recipientId: 'u-a', type: 'ADMIN_TEST', payload: { message: 'Check from the desk', from: 'Ada Admin' } });
    await waitFor(() => expect(view.calls.filter(c => c.path === 'Notifications' && c.method === 'GET').length).toBeGreaterThan(1));
  });

  it('reads today in pages of 500 (the server refuses a larger $top) and counts every page', async () => {
    const base = 'http://localhost/odata/v4/Notifications';
    const view = renderLive(<Notifications />, {
      ...admin,
      handler: req => (req.path === 'Notifications'
        ? (req.query.$skiptoken ? page([sent[2]]) : page(sent.slice(0, 2), 3, `${base}?$skiptoken=2`))
        : req.path === 'Users' ? page(users) : page([], 1)),
    });
    const who = screen.getByTestId('who-gets-what');
    await waitFor(() => expect(who.querySelector('[data-type="SHORTFALL_FLAGGED"]')).toHaveTextContent('Dispatcher: shortfall flagged1 · app'));
    const reads = view.calls.filter(c => c.path === 'Notifications' && c.method === 'GET');
    expect(reads[0].query.$top).toBe('500');
    expect(reads.some(c => c.query.$skiptoken === '2')).toBe(true);
  });

  it('a new notification refreshes the count', async () => {
    let n = 3;
    const view = renderLive(<Notifications />, { ...admin, handler: req => (req.path === 'Notifications' ? page([], n) : page([], 1)) });
    expect(await screen.findByText('3 today')).toBeInTheDocument();
    n = 4;
    view.hub.emit('notification', { id: 'N1' });
    expect(await screen.findByText('4 today')).toBeInTheDocument();
  });
});
