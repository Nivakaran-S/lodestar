// Live Admin screens not covered by live-store-admin.test.tsx (ADM-01, ADM-02, ADM-03, ADM-05, ADM-06, ADM-08,
// ADM-10, ADM-19), plus the validation, empty and error states of ADM-04/07/16/20. Real ODataClient over a fake
// fetch: assertions on requests are at the HTTP level. Date is frozen at Mon 6 Apr 2026 13:30 (Colombo).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AdminSide, adminChanged } from '@/components/live/chrome';
import ScreenShell from '@/components/ScreenShell';
import Overview from '@/live/adm-02-overview';
import People from '@/live/adm-03-people-and-roles';
import AddPerson from '@/live/adm-04-add-or-edit-person';
import Requests from '@/live/adm-05-access-requests';
import Devices from '@/live/adm-06-devices';
import LostPhone from '@/live/adm-07-lost-phone';
import Outlets from '@/live/adm-08-outlets';
import Vehicles from '@/live/adm-10-vehicles';
import AuditLog from '@/live/adm-16-audit-log';
import AuditEntry from '@/live/adm-19-audit-entry-detail';
import ChainCheck from '@/live/adm-20-chain-check-result';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { page, renderLive, SESSIONS } from './helpers/live';
import { closeOverlay, currentOverlay } from '@/lib/overlay';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin' }));

const NOW = '2026-04-06T08:00:00.000Z';
const DAY = '2026-04-07T00:00:00.000Z';
const admin = { session: SESSIONS.admin };
const err = (status: number, message: string, code = 'Failed') => ({ status, body: { error: { code, message } } });
const nav = (links: Record<string, string>) => ({ links: Object.fromEntries(Object.entries(links).map(([k, href]) => [k, { href, kind: 'go' }])) });
const posts = (calls: FakeRequest[]) => calls.filter(c => c.method === 'POST');
const disabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';
const user = (id: string, over = {}) => ({ id, email: `${id}@example.test`, name: `Person ${id}`, role: 'DRIVER', depot: 'KANDY', isActive: true, createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-04-05T04:00:00.000Z', ...over });
const device = (id: string, over = {}) => ({ id, userId: 'u7', label: 'Driver phone', platform: 'android', model: 'Pixel 7', status: 'ACTIVE', registeredAt: '2026-04-06T03:00:00.000Z', lastSeenAt: '2026-04-06T07:30:00.000Z', ...over });
const outlet = (id: string, over = {}) => ({ id, name: `Outlet ${id}`, brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true, ...over });
const vehicle = (id: string, over = {}) => ({ id, depot: 'PELIYAGODA', type: 'VAN', tempClass: 'CHILLED', capacityKg: 1000, capacityM3: 7, kmPerLitre: 10, weeklyLFuel: 400, usedLThisWeek: 100, status: 'AVAILABLE', ...over });
const entry = (seq: number, over = {}) => ({ seq, at: '2026-04-06T07:58:12.000Z', actor: 'u-a', actorRoles: ['admin'], client: 'lodestar-web', service: 'auth', action: 'Devices.Revoke', entitySet: 'Devices', entityKey: 'DEVT1', outcome: 'SUCCESS', payload: { reason: 'Lost on route', by: { id: 'u-a' } }, prevHash: `${seq - 1}`.padEnd(64, 'a'), hash: `${seq}`.padEnd(64, 'a'), ...over });

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/admin');
  freezeDate(NOW);
});
afterEach(unfreeze);

// ------------------------------------------------------------------------------------------------ ADM-01

// ADM-01: the designed sign-in form (direct grant) is covered in sign-in-screens.test.tsx.

// ------------------------------------------------------------------------------------------------ ADM-02

describe('ADM-02 Overview', () => {
  const COUNTS: Record<string, number> = {
    '': 12, 'isActive eq true': 10, "status eq 'ACTIVE'": 8, "status eq 'ACTIVE' and lastSeenAt ge 2026-04-05T00:00:00Z": 6,
    'syncedAt eq null': 3, 'at ge 2026-04-06T00:00:00Z': 40,
  };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], COUNTS[req.query.$filter ?? ''] ?? 0)
      : req.path === 'Devices' ? page([device('DEVP1', { status: 'PENDING', label: 'Bay tablet 3', user: { name: 'Kasun J' } })])
        : req.path === 'AuditEntries' && req.query.$filter?.startsWith("outcome eq 'DENIED'") ? page([entry(41, { action: 'Plans.Approve', outcome: 'DENIED', actor: 'u-x', service: 'planning' })])
          : req.path === 'AuditEntries' ? page([])
            : req.path === 'Plans' ? page([{ id: 'PLK-v4', depot: 'KANDY', runDate: DAY, version: 4, status: 'NEEDS_APPROVAL', source: 'AGENT' }])
              : req.path === 'AuditEntries/Lodestar.VerifyChain()' ? { valid: true, checked: 120 }
                : page([]));

  it('greets the admin and shows what waits, system health and plans waiting on dispatch', async () => {
    const view = renderLive(<Overview />, { ...admin, handler: handler() });
    expect(screen.getByText(/^Good (morning|afternoon|evening), Ada$/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('needs-you')).toHaveTextContent('2'));
    expect(screen.getByText('1 device request, 1 refused access')).toBeInTheDocument();
    expect(screen.getByText('2 things are waiting for you. Everything else is quiet.')).toBeInTheDocument();
    expect(screen.getByText(/Bay tablet 3 waiting/)).toBeInTheDocument();
    expect(screen.getByText('Refused: Plans.Approve')).toBeInTheDocument();
    expect(await screen.findByText('No changes by you today.')).toBeInTheDocument();
    expect(await screen.findByText('All normal')).toBeInTheDocument();
    expect(screen.getByText('People with access').parentElement).toHaveTextContent('10 of 12');
    expect(screen.getByText('Devices seen in 24 h').parentElement).toHaveTextContent('6 of 8');
    expect(screen.getByText('Sync backlog').parentElement).toHaveTextContent('3 records');
    expect(screen.getByText('Audit chain').parentElement).toHaveTextContent('Intact 120 entries40 entries today');
    expect(await screen.findByText('PLK-v4')).toBeInTheDocument();
    expect(screen.getByText('Kandy Hub · Tue 7 Apr · approval by a dispatcher')).toBeInTheDocument();
    expect(view.calls.find(c => c.query.$filter?.startsWith("outcome eq 'DENIED'"))!.query.$filter).toBe("outcome eq 'DENIED' and at ge 2026-04-05T00:00:00Z");
    expect(view.calls.find(c => c.query.$filter?.startsWith('actor eq'))!.query.$filter).toBe("actor eq 'u-a' and at ge 2026-04-06T00:00:00Z");
  });

  it('a person who asked for a new device while the old one is still active ranks first as a lost phone; each row opens its screen', async () => {
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L285: '/admin/adm-07-lost-phone' })} live><Overview /></ScreenShell>, {
      ...admin,
      handler: handler(req => (
        req.path === 'Devices' && req.query.$filter?.startsWith("status eq 'ACTIVE' and userId in") ? page([device('DEVOLD', { userId: 'u7', label: 'Driver phone', user: { name: 'Chaminda R' } })])
          : req.path === 'Devices' && req.query.$top === '5' ? page([device('DEVP1', { status: 'PENDING', userId: 'u7', label: 'New phone', user: { name: 'Chaminda R' } })])
            : req.path === 'OfflineEvents' && req.query.$filter?.includes('driverId in') ? page([{ id: 'E1', driverId: 'u7' }, { id: 'E2', driverId: 'u7' }])
              : req.path === 'DataImports' ? page([{ id: 'imp-1', file: 'calendar', fileName: 'calendar.csv', rows: 910, passed: 910, applied: true, created: 0, updated: 910, problems: [], checks: [], importedBy: 'u-a', byName: 'Ada Admin', importedAt: NOW }])
                : undefined)),
    });
    await waitFor(() => expect(screen.getByTestId('needs-you')).toHaveTextContent('3'));
    expect(screen.getByText('1 device request, 1 lost phone, 1 refused access')).toBeInTheDocument();
    expect(screen.getByText(/^Start with the lost phone/)).toHaveTextContent('Start with the lost phone: it holds 2 records that have not reached Lodestar yet.');
    expect(view.calls.find(c => c.query.$filter?.startsWith("status eq 'ACTIVE' and userId in"))!.query.$filter).toBe("status eq 'ACTIVE' and userId in ('u7')");
    expect(view.calls.find(c => c.path === 'OfflineEvents' && c.query.$filter?.includes('driverId'))!.query.$filter).toBe("syncedAt eq null and driverId in ('u7')");
    expect(await screen.findByText('calendar.csv')).toBeInTheDocument();
    expect(screen.getByTestId('last-import')).toHaveTextContent('910 rows, clean · by Ada Admin');

    fireEvent.click(document.querySelector('[data-lost="DEVOLD"]')!);
    expect(window.sessionStorage.getItem('lodestar.focus.device')).toBe('DEVOLD');
    // the lost-phone and audit drawers open over the overview (components/live/overlay.tsx)
    expect(currentOverlay()).toBe('/admin/adm-07-lost-phone');
    act(() => closeOverlay());
    fireEvent.click(document.querySelector('[data-device="DEVP1"]')!);
    expect(window.sessionStorage.getItem('lodestar.focus.device')).toBe('DEVP1');
    expect(router.push).toHaveBeenLastCalledWith('/admin/adm-05-access-requests');
    fireEvent.click(document.querySelector('[data-audit="41"]')!);
    expect(window.sessionStorage.getItem('lodestar.focus.audit')).toBe('41');
    expect(currentOverlay()).toBe('/admin/adm-19-audit-entry-detail');
    act(() => closeOverlay());
  });

  it('quiet day: nothing waiting; a broken chain is flagged', async () => {
    renderLive(<Overview />, {
      ...admin,
      handler: handler(req => (req.path === 'Devices' && req.query.$top !== '0' ? page([]) : req.path === 'AuditEntries' && req.query.$top !== '0' ? page([]) : req.path === 'Plans' ? page([])
        : req.path.includes('VerifyChain') ? { valid: false, checked: 120, firstInvalidSeq: 77 } : undefined)),
    });
    await waitFor(() => expect(screen.getByTestId('needs-you')).toHaveTextContent('0'));
    expect(screen.getByText('Nothing is waiting for you. Everything is quiet.')).toBeInTheDocument();
    expect(await screen.findByText('Check the audit chain')).toBeInTheDocument();
    expect(screen.getByText('Audit chain').parentElement).toHaveTextContent('Broken');
    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument();
  });

  // DEFECT: when the requests fail, the header still reads "Nothing is waiting for you. Everything is quiet."
  // (adm-02-overview.tsx:42 counts missing data as zero), contradicting the error banner under it.
  it('does not report a quiet day when the requests could not be read', async () => {
    renderLive(<Overview />, { ...admin, handler: handler(req => (req.query.$top !== '0' && (req.path === 'Devices' || req.path === 'AuditEntries') ? err(503, 'Directory is not reachable') : undefined)) });
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Directory is not reachable');
    expect(screen.queryByText('Nothing is waiting for you. Everything is quiet.')).not.toBeInTheDocument();
  });

  it('shows the error and retries', async () => {
    let fail = true;
    const view = renderLive(<Overview />, { ...admin, handler: handler(req => (req.path === 'Devices' && req.query.$top === '5' && fail ? err(503, 'Devices are not reachable') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Devices are not reachable');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText(/Bay tablet 3 waiting/)).toBeInTheDocument();
    expect(view.calls.filter(c => c.path === 'Devices' && c.query.$top === '5')).toHaveLength(2);
  });
});

describe('Admin sidebar', () => {
  it('reads its counts again after an admin write (adminChanged) and on a realtime notification', async () => {
    let pendingN = 3;
    const view = renderLive(<AdminSide active="N0" />, { ...admin, handler: req => (req.path === 'Devices' && req.query.$filter === "status eq 'PENDING'" ? page([], pendingN) : page([], 1)) });
    const item = () => screen.getByText('Access requests').closest('[data-lk]') as HTMLElement;
    await waitFor(() => expect(item()).toHaveTextContent('Access requests3'));
    pendingN = 2;
    act(() => adminChanged());
    await waitFor(() => expect(item()).toHaveTextContent('Access requests2'));
    pendingN = 5;
    view.hub.emit('notification', { id: 'N1' });
    await waitFor(() => expect(item()).toHaveTextContent('Access requests5'));
  });
});

// ------------------------------------------------------------------------------------------------ ADM-03

describe('ADM-03 People and roles', () => {
  const people = [
    user('u1', { name: 'Ruwan Bandara', vehicleId: 'VEH057', devices: [{ id: 'D1', status: 'REVOKED' }] }),
    user('u2', { name: 'Kasun J', role: 'LOADER', staffId: 'KDY-0427', devices: [{ id: 'D2', status: 'PENDING' }] }),
    user('u3', { name: 'Fathima R', role: 'STORE_MANAGER', outletId: 'OUT106', depot: 'KANDY', devices: [] }),
    user('u4', { name: 'Old Account', role: 'DISPATCHER', isActive: false }),
  ];
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], 4)
      : req.path === 'Users' && req.query.$skiptoken ? page([user('u5', { name: 'Late Joiner' })], 5)
        : req.path === 'Users' ? page(people, 5, 'http://localhost/odata/v4/Users?$skiptoken=4') : page([]));

  it('lists people with role, scope, sign-in method and status, and opens a person', async () => {
    const view = renderLive(<People />, { ...admin, handler: handler() });
    const table = await screen.findByTestId('people');
    await waitFor(() => expect(table.querySelectorAll('[data-user]')).toHaveLength(4));
    const row = (id: string) => table.querySelector(`[data-user="${id}"]`) as HTMLElement;
    expect(row('u1')).toHaveTextContent('Device revoked');
    expect(row('u1')).toHaveTextContent('Phone on a registered device');
    expect(row('u2')).toHaveTextContent('Request open');
    expect(row('u3')).toHaveTextContent('OUT106');
    expect(row('u3')).toHaveTextContent('Active');
    expect(row('u1')).toHaveTextContent('Vehicle VEH057');
    expect(row('u2')).toHaveTextContent('Staff ID KDY-0427');
    expect(row('u4')).toHaveTextContent('Disabled');
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 4 of 5');
    expect(view.calls.find(c => c.path === 'Users' && c.query.$expand)!.query).toMatchObject({ $expand: 'devices($select=id,status)', $orderby: 'name', $top: '30', $count: 'true' });

    fireEvent.click(row('u3'));
    expect(window.sessionStorage.getItem('lodestar.focus.user')).toBe('u3');
    expect(currentOverlay()).toBe('/admin/adm-04-add-or-edit-person');
    act(() => closeOverlay());

    // The design's locked row: a person with an open device request opens that request in ADM-05.
    fireEvent.click(row('u2'));
    expect(window.sessionStorage.getItem('lodestar.focus.device')).toBe('D2');
    expect(router.push).toHaveBeenLastCalledWith('/admin/adm-05-access-requests');
    expect(document.querySelector('.d-eyebrow')).toHaveTextContent('People and roles 4 people 5 faces');
  });

  it('role chips, search and “Show more” send the right requests', async () => {
    const view = renderLive(<People />, { ...admin, handler: handler() });
    const table = await screen.findByTestId('people');
    await waitFor(() => expect(table.querySelectorAll('[data-user]')).toHaveLength(4));
    fireEvent.click(within(table).getByRole('button', { name: /Show more/ }));
    expect(await within(table).findByText('Late Joiner')).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: /^Run/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Users' && c.query.$filter === "role eq 'DRIVER'" && c.query.$expand)).toBe(true));
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: ' ruwan ' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Users' && c.query.$search === 'ruwan')).toBe(true));
  });

  it('empty and error states', async () => {
    const { unmount } = renderLive(<People />, { ...admin, handler: handler(req => (req.path === 'Users' && req.query.$top === '30' ? page([], 0) : undefined)) });
    expect(await screen.findByText('Nobody here')).toBeInTheDocument();
    unmount();
    renderLive(<People />, { ...admin, handler: handler(req => (req.path === 'Users' && req.query.$top === '30' ? err(403, 'Admins only') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowedAdmins only');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-04

describe('ADM-04 Add or edit person · validation', () => {
  it('needs a name, a valid email and, for a store manager, an outlet', async () => {
    renderLive(<AddPerson />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 1) : req.path === 'Outlets' ? page([outlet('OUTT01')]) : page([])) });
    const save = await screen.findByTestId('save-person');
    expect(disabled(save)).toBe(true);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Manager' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'not-an-email' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'new@example.test' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(true); // no outlet yet
    await screen.findByRole('option', { name: /OUTT01/ });
    fireEvent.change(screen.getByLabelText('Outlet'), { target: { value: 'OUTT01' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(true);
  });

  it('a dispatcher needs no outlet; a refused save shows the API’s reason and stays open', async () => {
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L290: '/admin/adm-03-people-and-roles' })} live><AddPerson /></ScreenShell>, {
      ...admin,
      handler: req => (req.query.$top === '0' ? page([], 1) : req.method === 'POST' ? err(409, 'A person with this email exists', 'Conflict') : page([])),
    });
    fireEvent.click(await screen.findByRole('radio', { name: /Dispatcher/ }));
    expect(screen.queryByLabelText('Outlet')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: ' Nilanthi P ' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'nilanthi@example.test' } });
    fireEvent.click(screen.getByTestId('save-person'));
    expect(await screen.findByRole('alert')).toHaveTextContent('A person with this email exists');
    expect(posts(view.calls)[0]).toMatchObject({ path: 'Users', body: { name: 'Nilanthi P', email: 'nilanthi@example.test', role: 'DISPATCHER', outletId: null } });
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('ADM-04 Add or edit person · driver vehicle, loader staff ID and Dock PIN', () => {
  const shell = (children: React.ReactNode) => <ScreenShell board="P6" nav={nav({ L290: '/admin/adm-03-people-and-roles' })} live>{children}</ScreenShell>;
  const base = (req: FakeRequest) => (
    req.query.$top === '0' ? page([], 1)
      : req.path === 'Vehicles' ? page([vehicle('VEH057', { depot: 'KANDY' }), vehicle('VEH058', { depot: 'KANDY', type: 'TRUCK' })])
        : req.path === 'Users' && req.method === 'GET' ? page([user('u-ruwan', { name: 'Ruwan Bandara', vehicleId: 'VEH057' })])
          : req.path.startsWith('Users/Lodestar.NextStaffId') ? { depot: 'KANDY', prefix: 'KDY', staffId: 'KDY-0428' }
            : undefined);
  const fill = async (name: string, email: string) => {
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } });
  };

  it('a driver picks a vehicle of their depot; one another active driver has is shown taken and cannot be picked', async () => {
    const view = renderLive(shell(<AddPerson />), {
      ...admin,
      handler: req => base(req) ?? (req.method === 'POST' && req.path === 'Users' ? { status: 201, body: { id: 'u-new', name: 'Amal Perera' } } : page([])),
    });
    await fill('Amal Perera', 'amal@example.test');
    fireEvent.click(screen.getByRole('radio', { name: /Driver/ }));
    expect(screen.getByLabelText('Vehicle')).toBeDisabled(); // no depot yet
    fireEvent.click(await screen.findByRole('radio', { name: /KANDY/ }));
    const taken = await screen.findByRole('option', { name: 'VEH057 · Van · driven by Ruwan Bandara' });
    expect(taken).toBeDisabled();
    expect(screen.getByRole('option', { name: 'VEH058 · Truck' })).not.toBeDisabled();
    expect(view.calls.find(c => c.path === 'Vehicles' && c.query.$select)!.query.$filter).toBe("depot eq 'KANDY'");
    expect(disabled(screen.getByTestId('save-person'))).toBe(true); // a driver needs a vehicle
    fireEvent.change(screen.getByLabelText('Vehicle'), { target: { value: 'VEH058' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(false);
    fireEvent.click(screen.getByTestId('save-person'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/adm-03-people-and-roles'));
    expect(posts(view.calls)).toHaveLength(1);
    expect(posts(view.calls)[0]).toMatchObject({ path: 'Users', body: { role: 'DRIVER', depot: 'KANDY', vehicleId: 'VEH058', staffId: null, outletId: null } });
  });

  it('a loader gets the next free staff ID and a Dock PIN, which goes to SetDockPin only (never the Users row)', async () => {
    const view = renderLive(shell(<AddPerson />), {
      ...admin,
      handler: req => base(req) ?? (req.method === 'POST' && req.path === 'Users' ? { status: 201, body: { id: 'u-new', name: 'Nimal Silva' } }
        : req.method === 'POST' ? { pinSet: true } : page([])),
    });
    await fill('Nimal Silva', 'nimal@example.test');
    fireEvent.click(screen.getByRole('radio', { name: /Loader/ }));
    fireEvent.click(await screen.findByRole('radio', { name: /KANDY/ }));
    await waitFor(() => expect(screen.getByLabelText('Staff ID')).toHaveValue('KDY-0428'));
    expect(view.calls.some(c => c.path === "Users/Lodestar.NextStaffId(depot='KANDY')")).toBe(true);
    expect(disabled(screen.getByTestId('save-person'))).toBe(true); // no PIN yet
    fireEvent.change(screen.getByLabelText('Dock PIN'), { target: { value: '24a6' } });
    expect(screen.getByLabelText('Dock PIN')).toHaveValue('246');
    expect(disabled(screen.getByTestId('save-person'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Dock PIN'), { target: { value: '2468' } });
    expect(screen.getByLabelText('Dock PIN')).toHaveAttribute('type', 'password');
    // The admin types their own ID instead: lower case is fine, a malformed one is not.
    fireEvent.change(screen.getByLabelText('Staff ID'), { target: { value: 'kdy-12' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Staff ID'), { target: { value: 'kdy-0500' } });
    expect(disabled(screen.getByTestId('save-person'))).toBe(false);
    fireEvent.click(screen.getByTestId('save-person'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/adm-03-people-and-roles'));
    const [create, pin] = posts(view.calls);
    expect(create).toMatchObject({ path: 'Users', body: { role: 'LOADER', depot: 'KANDY', staffId: 'KDY-0500', vehicleId: null } });
    expect(JSON.stringify(create.body)).not.toContain('2468');
    expect(pin).toMatchObject({ path: "Users('u-new')/Lodestar.SetDockPin", body: { pin: '2468' } });
  });

  it('a refused PIN after the person was created is reported, not retried as a second create', async () => {
    const view = renderLive(shell(<AddPerson />), {
      ...admin,
      handler: req => base(req) ?? (req.method === 'POST' && req.path === 'Users' ? { status: 201, body: { id: 'u-new', name: 'Nimal Silva' } }
        : req.method === 'POST' ? err(503, 'The identity provider is not reachable', 'ServiceUnavailable') : page([])),
    });
    await fill('Nimal Silva', 'nimal@example.test');
    fireEvent.click(screen.getByRole('radio', { name: /Loader/ }));
    fireEvent.click(await screen.findByRole('radio', { name: /KANDY/ }));
    await waitFor(() => expect(screen.getByLabelText('Staff ID')).toHaveValue('KDY-0428'));
    fireEvent.change(screen.getByLabelText('Dock PIN'), { target: { value: '2468' } });
    fireEvent.click(screen.getByTestId('save-person'));
    expect(await screen.findByText(/Nimal Silva added, but the Dock PIN was not set: .*Reset PIN/)).toBeInTheDocument();
    expect(posts(view.calls).filter(c => c.path === 'Users')).toHaveLength(1);
  });

  it('editing a loader: the staff ID is kept, Reset PIN sets a new PIN with SetDockPin', async () => {
    window.sessionStorage.setItem('lodestar.focus.user', 'u-kasun');
    const kasun = { id: 'u-kasun', email: 'k@example.test', name: 'Kasun J', role: 'LOADER', depot: 'KANDY', staffId: 'KDY-0427', isActive: true };
    const view = renderLive(shell(<AddPerson />), {
      ...admin,
      handler: req => base(req) ?? (req.path === "Users('u-kasun')" && req.method === 'GET' ? { status: 200, body: kasun, headers: { ETag: 'W/"5"' } }
        : req.method === 'POST' ? { pinSet: true } : req.method === 'PATCH' ? kasun : page([])),
    });
    expect(await screen.findByText('Edit Kasun J')).toBeInTheDocument();
    expect(screen.getByLabelText('Staff ID')).toHaveValue('KDY-0427');
    expect(screen.queryByLabelText('Dock PIN')).not.toBeInTheDocument();
    expect(view.calls.some(c => c.path.startsWith('Users/Lodestar.NextStaffId'))).toBe(false);
    expect(disabled(screen.getByTestId('reset-pin'))).toBe(true);
    fireEvent.change(screen.getByLabelText('New Dock PIN'), { target: { value: '1357' } });
    fireEvent.click(screen.getByTestId('reset-pin'));
    expect(await screen.findByText('New Dock PIN set for Kasun J. Tell them in person.')).toBeInTheDocument();
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Users('u-kasun')/Lodestar.SetDockPin", body: { pin: '1357' } })]);
    expect(screen.getByLabelText('New Dock PIN')).toHaveValue('');
    expect(view.calls.some(c => c.method === 'PATCH')).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------ ADM-05

describe('ADM-05 Access requests', () => {
  const pending = device('DEVP1', { status: 'PENDING', label: 'Driver phone', userId: 'u7', user: user('u7', { name: 'Ruwan Bandara', email: 'ruwan@example.test' }) });
  const decided = device('DEVA1', { status: 'ACTIVE', label: 'Bay tablet', user: { name: 'Kasun J' } });
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => {
    let open = [pending];
    return (req: FakeRequest) => over(req) ?? (
      req.query.$top === '0' ? page([], 1)
        : req.method === 'POST' ? (open = [], { ...pending, status: 'ACTIVE' })
          : req.path === 'Devices' && req.query.$filter === "status eq 'PENDING'" ? page(open)
            : req.path === 'Devices' ? page([decided]) : page([]));
  };

  it('shows the open request with who registered it; “Approve device” activates it', async () => {
    const view = renderLive(<Requests />, { ...admin, handler: handler() });
    expect(await screen.findByText('Driver phone for Ruwan Bandara')).toBeInTheDocument();
    expect(screen.getByText(/Driver · Kandy Hub · device DEVP1 · android/)).toBeInTheDocument();
    expect(screen.getByText('ruwan@example.test')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Devices' && c.query.$filter?.startsWith('status ne'))!.query.$filter).toBe("status ne 'PENDING' and updatedAt ge 2026-04-06T00:00:00Z");
    fireEvent.click(screen.getByTestId('approve-device'));
    expect(await screen.findByText('No open requests')).toBeInTheDocument();
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Devices('DEVP1')/Lodestar.Activate", body: {} })]);
    expect(view.calls.filter(c => c.path === 'Devices' && c.query.$filter === "status eq 'PENDING'" && c.query.$expand === 'user')).toHaveLength(2);
  });

  it('opens on the request chosen elsewhere (focus device); after a decision the next request is selected', async () => {
    const second = device('DEVP2', { status: 'PENDING', label: 'Bay tablet', userId: 'u8', user: user('u8', { name: 'Kasun J', role: 'LOADER' }) });
    window.sessionStorage.setItem('lodestar.focus.device', 'DEVP2');
    let open = [pending, second];
    const view = renderLive(<Requests />, {
      ...admin,
      handler: req => (req.query.$top === '0' ? page([], open.length)
        : req.method === 'POST' ? (open = open.filter(d => !req.path.includes(d.id)), { ...second, status: 'ACTIVE' })
          : req.path === 'Devices' && req.query.$filter === "status eq 'PENDING'" ? page(open) : page([])),
    });
    expect(await screen.findByText('Bay tablet for Kasun J')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('approve-device'));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Devices('DEVP2')/Lodestar.Activate" })]));
    expect(await screen.findByText('Driver phone for Ruwan Bandara')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('lodestar.focus.device')).toBeNull();
  });

  it('declining needs a reason, which is sent with Devices(…)/Lodestar.Revoke', async () => {
    const view = renderLive(<Requests />, { ...admin, handler: handler() });
    await screen.findByText('Driver phone for Ruwan Bandara');
    expect(disabled(screen.getByTestId('decline'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: '   ' } });
    expect(disabled(screen.getByTestId('decline'))).toBe(true);
    fireEvent.click(screen.getByTestId('decline'));
    expect(posts(view.calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: ' Not a company phone ' } });
    fireEvent.click(screen.getByTestId('decline'));
    await waitFor(() => expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Devices('DEVP1')/Lodestar.Revoke", body: { reason: 'Not a company phone' } })]));
  });

  it('the resolved tab lists today’s decisions; a refused approval is shown', async () => {
    renderLive(<Requests />, { ...admin, handler: handler(req => (req.method === 'POST' ? err(409, 'Device already revoked') : undefined)) });
    await screen.findByText('Driver phone for Ruwan Bandara');
    fireEvent.click(screen.getByTestId('approve-device'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Device already revoked');
    fireEvent.click(screen.getByRole('tab', { name: /Resolved today/ }));
    const list = screen.getByTestId('requests');
    expect(within(list).getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByTestId('approve-device')).not.toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ ADM-06

describe('ADM-06 Devices', () => {
  const list = [
    device('DEV1', { userId: 'u7', user: user('u7', { name: 'Ruwan Bandara' }) }),
    device('DEV2', { userId: 'u8', status: 'REVOKED', revokedAt: '2026-04-05T04:00:00.000Z', lastSeenAt: null, user: user('u8', { name: 'Old Phone' }) }),
    device('DEV3', { userId: 'u9', status: 'PENDING', platform: 'web', label: 'Bay tablet 3', user: user('u9', { name: 'Kasun J', role: 'LOADER' }) }),
  ];
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], 3)
      : req.path === 'OfflineEvents' ? page([{ id: 'E1', driverId: 'u7' }, { id: 'E2', driverId: 'u7' }])
        : req.path === 'Devices' ? page(list, 3) : page([]));

  it('lists devices with last seen, records waiting and status; a row opens the lost-phone flow', async () => {
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L292: '/admin/adm-07-lost-phone' })} live><Devices /></ScreenShell>, { ...admin, handler: handler() });
    const table = await screen.findByTestId('devices');
    await waitFor(() => expect(table.querySelectorAll('[data-device]')).toHaveLength(3));
    const row = (id: string) => table.querySelector(`[data-device="${id}"]`) as HTMLElement;
    expect(row('DEV1')).toHaveTextContent('13:00');
    expect(row('DEV1')).toHaveTextContent('Active');
    expect(within(row('DEV1')).getByText('2')).toBeInTheDocument();
    expect(row('DEV2')).toHaveTextContent('never');
    expect(row('DEV2')).toHaveTextContent('Revoked Sun 5 Apr');
    expect(row('DEV3')).toHaveTextContent('Waiting for approval');
    expect(row('DEV3')).toHaveTextContent('Kasun J · Loader · Kandy Hub');
    expect(screen.getByText('Records waiting', { selector: '.d-kpi__l' }).parentElement).toHaveTextContent('2on 1 person');

    fireEvent.click(within(row('DEV2')).getByText('Old Phone', { exact: false }));
    expect(window.sessionStorage.getItem('lodestar.focus.device')).toBe('DEV2');
    expect(currentOverlay()).toBe('/admin/adm-07-lost-phone');
    act(() => closeOverlay());
    expect(view.calls.find(c => c.path === 'OfflineEvents')!.query.$filter).toBe('syncedAt eq null');
  });

  it('filters: records waiting asks for those people’s devices; pending, revoked and search', async () => {
    const view = renderLive(<Devices />, { ...admin, handler: handler() });
    await screen.findByText('Bay tablet 3');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Records waiting/ })).toHaveTextContent('Records waiting 1'));
    fireEvent.click(screen.getByRole('button', { name: /^Records waiting/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Devices' && c.query.$filter === "userId in ('u7')")).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /^Lost or revoked/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Devices' && c.query.$filter === "status eq 'REVOKED'" && c.query.$top === '30')).toBe(true));
    fireEvent.change(screen.getByLabelText('Search devices'), { target: { value: 'Pixel' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Devices' && c.query.$search === 'Pixel')).toBe(true));
  });

  it('records waiting with nobody waiting matches no device; empty and error states', async () => {
    const view = renderLive(<Devices />, { ...admin, handler: handler(req => (req.path === 'OfflineEvents' ? page([]) : req.path === 'Devices' && req.query.$filter === "id eq '__none__'" ? page([], 0) : undefined)) });
    await screen.findByText('Bay tablet 3');
    fireEvent.click(screen.getByRole('button', { name: /^Records waiting/ }));
    expect(await screen.findByText('No devices')).toBeInTheDocument();
    expect(view.calls.some(c => c.query.$filter === "id eq '__none__'")).toBe(true);
  });

  it('shows the API error', async () => {
    renderLive(<Devices />, { ...admin, handler: handler(req => (req.path === 'Devices' && req.query.$top === '30' ? err(500, 'Devices failed') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Devices failed');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-07

describe('ADM-07 Lost phone · states', () => {
  it('a device already revoked cannot be revoked again', async () => {
    window.sessionStorage.setItem('lodestar.focus.device', 'DEVT1');
    renderLive(<LostPhone />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 1) : req.path === "Devices('DEVT1')" ? device('DEVT1', { status: 'REVOKED', user: user('u7') }) : page([])) });
    expect(await screen.findByText('Device already revoked')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Audit note'), { target: { value: 'again' } });
    expect(disabled(screen.getByTestId('revoke'))).toBe(true);
  });

  it('no active devices to pick', async () => {
    renderLive(<LostPhone />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 0) : page([])) });
    expect(await screen.findByText('No active devices')).toBeInTheDocument();
    expect(disabled(screen.getByTestId('revoke'))).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ ADM-08

describe('ADM-08 Outlets', () => {
  const rows = [outlet('OUT101', { name: 'Fresh Kandy', parking: 'VAN_ONLY', dockType: 'STREET' }), outlet('OUT102', { name: 'Style Mall', brand: 'STYLE', parking: 'MALL_DOCK', dockType: 'MALL_BAY', depot: 'PELIYAGODA', isActive: false })];
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], req.query.$filter === "depot eq 'KANDY'" ? 60 : req.query.$filter === "depot eq 'PELIYAGODA'" ? 90 : 2)
      : req.path === 'Outlets' ? page(rows, 2) : page([]));

  it('lists outlets with window, dock and access; a row opens the outlet', async () => {
    const view = renderLive(<ScreenShell board="P6" nav={nav({ L294: '/admin/adm-09-edit-outlet' })} live><Outlets /></ScreenShell>, { ...admin, handler: handler() });
    const table = await screen.findByTestId('outlets');
    await waitFor(() => expect(table.querySelectorAll('[data-outlet]')).toHaveLength(2));
    const r1 = table.querySelector('[data-outlet="OUT101"]') as HTMLElement;
    const r2 = table.querySelector('[data-outlet="OUT102"]') as HTMLElement;
    expect(r1).toHaveTextContent('05:30 to 08:00');
    expect(r1).toHaveTextContent('street');
    expect(r1).toHaveTextContent('van_only');
    expect(r1).toHaveTextContent('Active');
    expect(r2).toHaveTextContent('Waypoint Style');
    expect(r2).toHaveTextContent('mall bay');
    expect(r2).toHaveTextContent('Inactive');
    const foot = await screen.findByText(/Showing/);
    await waitFor(() => expect(foot).toHaveTextContent('Showing 2 of 2 · Kandy Hub 60 · Peliyagoda DC 90'));
    fireEvent.click(within(r2).getByText('Style Mall'));
    expect(window.sessionStorage.getItem('lodestar.focus.outlet')).toBe('OUT102');
    expect(currentOverlay()).toBe('/admin/adm-09-edit-outlet');
    act(() => closeOverlay());
    expect(view.calls.find(c => c.path === 'Outlets' && c.query.$top === '30')!.query).toMatchObject({ $orderby: 'id', $count: 'true' });
  });

  it('brand chip, depot and search combine into one filter', async () => {
    const view = renderLive(<Outlets />, { ...admin, handler: handler() });
    await screen.findByText('Fresh Kandy');
    fireEvent.click(screen.getByRole('button', { name: /^Fresh/ }));
    fireEvent.change(screen.getByLabelText('Depot'), { target: { value: 'KANDY' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Outlets' && c.query.$top === '30' && c.query.$filter === "brand eq 'FRESH' and depot eq 'KANDY'")).toBe(true));
    fireEvent.change(screen.getByLabelText('Search outlets'), { target: { value: 'Kandy' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Outlets' && c.query.$search === 'Kandy' && c.query.$filter === "brand eq 'FRESH' and depot eq 'KANDY'")).toBe(true));
  });

  it('empty and error states', async () => {
    const { unmount } = renderLive(<Outlets />, { ...admin, handler: handler(req => (req.path === 'Outlets' && req.query.$top === '30' ? page([], 0) : undefined)) });
    expect(await screen.findByText('No outlets')).toBeInTheDocument();
    unmount();
    renderLive(<Outlets />, { ...admin, handler: handler(req => (req.path === 'Outlets' && req.query.$top === '30' ? err(503, 'Master data is not reachable') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Master data is not reachable');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-10

describe('ADM-10 Vehicles', () => {
  const fleet = [vehicle('VEH001'), vehicle('VEH002', { type: 'TRUCK', tempClass: 'AMBIENT', status: 'WORKSHOP', workshopNote: 'Gearbox', depot: 'KANDY' }), vehicle('VEH003', { status: 'ENROUTE' })];
  const counts: Record<string, number> = { "depot eq 'PELIYAGODA'": 5, "depot eq 'PELIYAGODA' and status eq 'WORKSHOP'": 0, "depot eq 'KANDY'": 4, "depot eq 'KANDY' and status eq 'WORKSHOP'": 1, "tempClass eq 'CHILLED'": 6 };
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], counts[req.query.$filter ?? ''] ?? 9)
      : req.path === 'Vehicles' && req.query.$top === '5' ? page([fleet[1]])
        : req.path === 'Vehicles' ? page(fleet, 9) : page([]));

  it('lists vehicles with capacity and status, the per-depot availability and the workshop', async () => {
    renderLive(<Vehicles />, { ...admin, handler: handler() });
    const table = await screen.findByTestId('vehicles');
    await waitFor(() => expect(table.querySelectorAll('[data-vehicle]')).toHaveLength(3));
    expect(table.querySelector('[data-vehicle="VEH001"]')).toHaveTextContent('Reefer van');
    expect(table.querySelector('[data-vehicle="VEH001"]')).toHaveTextContent('1,000 kg');
    expect(table.querySelector('[data-vehicle="VEH001"]')).toHaveTextContent('In service');
    expect(table.querySelector('[data-vehicle="VEH002"]')).toHaveTextContent('Gearbox');
    expect(table.querySelector('[data-vehicle="VEH003"]')).toHaveTextContent('On the road');
    await waitFor(() => expect(screen.getByText('Kandy Hub').parentElement).toHaveTextContent('3of 41 in the workshop'));
    expect(screen.getByText('Peliyagoda DC').parentElement).toHaveTextContent('5of 5all in service');
    expect(screen.getByText('In the workshop').parentElement).toHaveTextContent('1VEH002');
    expect(screen.getByText(/vehicles$/)).toHaveTextContent('9 vehicles');
  });

  it('chips and search narrow the request; empty and error states', async () => {
    const view = renderLive(<Vehicles />, { ...admin, handler: handler() });
    await screen.findByText('VEH001');
    fireEvent.click(screen.getByRole('button', { name: /^Reefer/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Vehicles' && c.query.$top === '30' && c.query.$filter === "tempClass eq 'CHILLED'")).toBe(true));
    fireEvent.change(screen.getByLabelText('Search vehicles'), { target: { value: 'VEH00' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Vehicles' && c.query.$search === 'VEH00')).toBe(true));
  });

  it('empty and error states', async () => {
    const { unmount } = renderLive(<Vehicles />, { ...admin, handler: handler(req => (req.path === 'Vehicles' && req.query.$top === '30' ? page([], 0) : undefined)) });
    expect(await screen.findByText('No vehicles')).toBeInTheDocument();
    unmount();
    renderLive(<Vehicles />, { ...admin, handler: handler(req => (req.path === 'Vehicles' && req.query.$top === '30' ? err(500, 'Vehicles failed') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicles failed');
  });
});

// ------------------------------------------------------------------------------------------------ ADM-16 / ADM-20

describe('ADM-16 Audit log and ADM-20 Chain check · states', () => {
  it('ADM-16: no entries for a filter, and the error banner', async () => {
    const { unmount } = renderLive(<AuditLog />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 0) : req.path.includes('VerifyChain') ? { valid: true, checked: 0 } : page([], 0)) });
    expect(await screen.findByText('No entries')).toBeInTheDocument();
    unmount();
    renderLive(<AuditLog />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 0) : req.path === 'AuditEntries' ? err(503, 'The audit service is not reachable') : { valid: true, checked: 0 }) });
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('The audit service is not reachable');
  });

  it('ADM-20: shows why the chain check failed and runs it again', async () => {
    let fail = true;
    const view = renderLive(<ChainCheck />, { ...admin, handler: req => (req.query.$top === '0' ? page([], 0) : req.path.includes('VerifyChain') ? (fail ? err(503, 'Audit is not reachable') : { valid: true, checked: 3, headSeq: 3 }) : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Audit is not reachable');
    expect(screen.getByTestId('chain-valid')).toHaveTextContent('—');
    fail = false;
    fireEvent.click(screen.getByTestId('verify-again'));
    await waitFor(() => expect(screen.getByTestId('chain-valid')).toHaveTextContent('Intact'));
    expect(view.calls.filter(c => c.method === 'GET' && c.path === 'AuditEntries/Lodestar.VerifyChain()')).toHaveLength(2);
  });
});

// ------------------------------------------------------------------------------------------------ ADM-19

describe('ADM-19 Audit entry detail', () => {
  const handler = (over: (req: FakeRequest) => unknown = () => undefined) => (req: FakeRequest) => over(req) ?? (
    req.query.$top === '0' ? page([], 0)
      : req.path === 'AuditEntries(7)' ? entry(7)
        : req.path === 'AuditEntries(6)' ? entry(6, { action: 'Devices.Activate' })
          : req.path === 'AuditEntries' && req.query.$select === 'seq' ? page([{ seq: 7 }])
            : req.path === 'AuditEntries' ? page([entry(3, { action: 'Devices.Activate', at: '2026-04-05T03:00:00.000Z' })])
              : page([]));

  it('shows the entry opened on ADM-16, its payload, the chain link and related entries', async () => {
    window.sessionStorage.setItem('lodestar.focus.audit', '7');
    const view = renderLive(<AuditEntry />, { ...admin, handler: handler() });
    const drawer = await screen.findByTestId('audit-entry');
    expect(await within(drawer).findByText('Devices.Revoke · DEVT1')).toBeInTheDocument();
    expect(drawer).toHaveTextContent('2026-04-06 13:28:12');
    expect(within(drawer).getByText('Lost on route')).toBeInTheDocument();
    expect(within(drawer).getByText('{"id":"u-a"}')).toBeInTheDocument();
    expect(await within(drawer).findByText('Links to previous ✓')).toBeInTheDocument();
    expect(drawer).toHaveTextContent('Previous entry #6 · Devices.Activate');
    expect(await within(drawer).findByText('Devices.Activate · success')).toBeInTheDocument();
    expect(view.calls.find(c => c.query.$filter?.startsWith('entitySet'))!.query.$filter).toBe("entitySet eq 'Devices' and entityKey eq 'DEVT1' and seq ne 7");
  });

  it('flags an entry that does not link to the one before it', async () => {
    window.sessionStorage.setItem('lodestar.focus.audit', '7');
    renderLive(<AuditEntry />, { ...admin, handler: handler(req => (req.path === 'AuditEntries(6)' ? entry(6, { hash: 'f'.repeat(64) }) : undefined)) });
    expect(await screen.findByText('Does not link to the previous entry')).toBeInTheDocument();
  });

  it('without a focus it opens the newest entry; “Copy entry” copies its JSON', async () => {
    const writeText = jest.fn<Promise<void>, [string]>(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const view = renderLive(<AuditEntry />, { ...admin, handler: handler() });
    expect(await screen.findByText('Devices.Revoke · DEVT1')).toBeInTheDocument();
    expect(view.calls.find(c => c.query.$select === 'seq')!.query).toMatchObject({ $orderby: 'seq desc', $top: '1' });
    fireEvent.click(screen.getByRole('button', { name: /Copy entry/ }));
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument();
    expect(JSON.parse(writeText.mock.calls[0][0])).toMatchObject({ seq: 7, action: 'Devices.Revoke' });
  });

  it('an empty audit log and an unreadable entry', async () => {
    const { unmount } = renderLive(<AuditEntry />, { ...admin, handler: handler(req => (req.query.$select === 'seq' ? page([]) : undefined)) });
    expect(await screen.findByText('The audit log is empty')).toBeInTheDocument();
    expect(disabled(screen.getByRole('button', { name: /Copy entry/ }))).toBe(true);
    unmount();
    window.sessionStorage.setItem('lodestar.focus.audit', '7');
    renderLive(<AuditEntry />, { ...admin, handler: handler(req => (req.path === 'AuditEntries(7)' ? err(404, 'Audit entry 7 not found') : undefined)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Audit entry 7 not found');
  });
});
