// Live Store desk and Admin screens against a mocked OData API (real ODataClient over a fake fetch).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ScreenShell from '@/components/ScreenShell';
import PlaceOrder from '@/live/sm-01-place-order';
import Deliveries, { receiptNote } from '@/live/sm-02-deliveries';
import OrdersHistory from '@/live/sm-27-orders-and-history';
import Messages from '@/live/sm-29-messages';
import AddPerson from '@/live/adm-04-add-or-edit-person';
import LostPhone from '@/live/adm-07-lost-phone';
import AuditLog from '@/live/adm-16-audit-log';
import ChainCheck from '@/live/adm-20-chain-check-result';
import type { FakeRequest } from './helpers/live';
import { page, renderLive, SESSIONS } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/store' }));

const DAY = '2026-04-07T00:00:00.000Z';
const OUTLET = { id: 'OUTT01', name: 'Outlet T01', brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true };
const order = (id: string, over = {}) => ({ id, outletId: 'OUTT01', runDate: DAY, orderedAt: DAY, brand: 'FRESH', tempClass: 'AMBIENT', units: 10, kg: 100, m3: 0.5, status: 'DELIVERED', deferredYesterday: false, daysSince: 1, ...over });
const nav = (links: Record<string, string>) => ({ links: Object.fromEntries(Object.entries(links).map(([k, href]) => [k, { href, kind: 'go' }])) });

function storeBase(req: FakeRequest) {
  if (req.query.$top === '0') return page([], 1);
  if (req.path === "Outlets('OUTT01')") return OUTLET;
  return undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

describe('SM-01 Place order', () => {
  it('starts from the last orders and submits POST /Orders with line items for the token’s outlet', async () => {
    const last = [
      order('ORDT1', { tempClass: 'AMBIENT', kg: 50, m3: 0.25, lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 10, kg: 50, tempClass: 'AMBIENT' }] }),
      order('ORDT2', { tempClass: 'CHILLED', kg: 12, m3: 0.06, lineItems: [{ id: 'l2', orderId: 'ORDT2', name: 'Milk 1 L', qty: 10, kg: 12, tempClass: 'CHILLED' }] }),
    ];
    let n = 0;
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { status: 201, body: { id: `ORDNEW${++n}`, ...(req.body as object) } } : req.path === 'Orders' ? page(last) : page([])),
    });
    expect(await screen.findByText('Rice 5 kg')).toBeInTheDocument();
    expect(screen.getByText('Milk 1 L')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('More Rice 5 kg'));
    expect(screen.getByLabelText('Rice 5 kg quantity')).toHaveTextContent('11');
    fireEvent.click(screen.getByTitle('Less Milk 1 L'));
    // add a new chilled item
    fireEvent.change(screen.getByLabelText('New chilled order item'), { target: { value: 'Yoghurt 80 g' } });
    fireEvent.change(screen.getAllByLabelText('kg per unit')[1], { target: { value: '2' } });
    fireEvent.click(within(screen.getByTestId('lines-chilled')).getByText('Add'));
    expect(screen.getByText('Yoghurt 80 g')).toBeInTheDocument();
    expect(screen.getByTestId('order-summary')).toHaveTextContent('2 orders · 3 items · 21 units');

    fireEvent.click(screen.getByTestId('submit-order'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/store/sm-27-orders-and-history'));
    const posts = view.calls.filter(c => c.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ path: 'Orders', body: { outletId: 'OUTT01', brand: 'FRESH', tempClass: 'AMBIENT', units: 11, kg: 55, lineItems: [{ name: 'Rice 5 kg', qty: 11, kg: 55, tempClass: 'AMBIENT' }] } });
    expect(posts[1].body).toMatchObject({ tempClass: 'CHILLED', units: 10, lineItems: [{ name: 'Milk 1 L', qty: 9 }, { name: 'Yoghurt 80 g', qty: 1, kg: 2 }] });
    expect((posts[0].body as { runDate: string }).runDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect((posts[0].body as { m3: number }).m3).toBeCloseTo(0.28, 2);
  });
});

describe('SM-02 Deliveries · confirm receipt and report an issue', () => {
  const stop = (id: string, o: object, over = {}) => ({ id, tripId: 'TRT1', orderId: (o as { id: string }).id, outletId: 'OUTT01', stopSeq: 1, status: 'DELIVERED', etaPlan: DAY, arrivalActual: DAY, order: o, trip: { id: 'TRT1', vehicleId: 'VEH057', status: 'ENROUTE', runDate: DAY }, ...over });

  it('counts each order, reports an issue and confirms through Orders/Lodestar.ConfirmReceipt', async () => {
    const dry = order('ORDT1', { units: 10, unitsReceived: null });
    const chilled = order('ORDT2', { tempClass: 'CHILLED', units: 6, unitsReceived: null });
    const view = renderLive(<ScreenShell board="P1" nav={nav({})} live><Deliveries /></ScreenShell>, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { id: 'x' } : req.path === 'TripStops' ? page([stop('STT1', dry), stop('STT2', chilled)]) : page([])),
    });
    expect(await screen.findByTestId('receipt')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('One less for ORDT2'));
    expect(screen.getByTestId('receipt-count-ORDT2')).toHaveTextContent('5');
    fireEvent.click(screen.getByTestId('report-issue'));
    fireEvent.change(screen.getByLabelText('Order with the issue'), { target: { value: 'ORDT2' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Damaged' }));
    fireEvent.change(screen.getByLabelText('Note for Kandy Hub'), { target: { value: 'Tray torn' } });
    expect(screen.getByTestId('confirm-receipt')).toHaveTextContent('Confirm · 1 to credit');
    fireEvent.click(screen.getByTestId('confirm-receipt'));
    await waitFor(() => expect(view.calls.filter(c => c.method === 'POST')).toHaveLength(2));
    const posts = view.calls.filter(c => c.method === 'POST');
    expect(posts[0]).toMatchObject({ path: "Orders('ORDT1')/Lodestar.ConfirmReceipt", body: { unitsReceived: 10, unitsExpected: 10, savedAt: expect.any(String) } });
    expect(posts[0].body).not.toHaveProperty('note');
    expect(posts[1]).toMatchObject({ path: "Orders('ORDT2')/Lodestar.ConfirmReceipt", body: { unitsReceived: 5, unitsExpected: 6, note: '1 short at receipt · Damaged: Tray torn' } });
  });

  it('shows the confirmed receipt once every order is counted, and nothing before the delivery is in', async () => {
    const done = order('ORDT1', { units: 10, unitsReceived: 9, receiptNote: '1 short at receipt', creditNoteId: 'CN-2604-0001' });
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'TripStops' ? page([stop('STT1', done)]) : page([])) });
    expect(await screen.findByTestId('receipt-done')).toHaveTextContent('You counted 9 of 10 units · credit note CN-2604-0001');

    expect(receiptNote({ id: 'A', units: 4 }, 4, null)).toBeUndefined();
    expect(receiptNote({ id: 'A', units: 4 }, 4, { orderId: 'A', kind: 'Temperature', note: ' ' })).toBe('Temperature');
    expect(receiptNote({ id: 'A', units: 4 }, 3, { orderId: 'B', kind: 'Short', note: 'x' })).toBe('1 short at receipt');
  });

  it('asks for the count of the delivery that is in even when the next run is already planned', async () => {
    const delivered = order('ORDT1', { units: 10, unitsReceived: null });
    const next = order('ORDT9', { status: 'PLANNED', unitsReceived: null });
    renderLive(<Deliveries />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'TripStops'
        ? page([stop('STT9', next, { tripId: 'TRT9', status: 'PLANNED', arrivalActual: null, etaPlan: '2026-04-08T00:00:00.000Z' }), stop('STT1', delivered)])
        : page([])),
    });
    expect(await screen.findByTestId('receipt')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-count-ORDT1')).toHaveTextContent('10');
    expect(screen.queryByTestId('receipt-count-ORDT9')).not.toBeInTheDocument();
  });

  it('keeps the confirmed receipt in view when the next run is already planned', async () => {
    const done = order('ORDT1', { units: 10, unitsReceived: 10 });
    const next = order('ORDT9', { status: 'PLANNED', unitsReceived: null });
    renderLive(<Deliveries />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'TripStops'
        ? page([stop('STT9', next, { tripId: 'TRT9', status: 'PLANNED', arrivalActual: null, etaPlan: '2026-04-08T00:00:00.000Z' }), stop('STT1', done)])
        : page([])),
    });
    expect(await screen.findByTestId('receipt-done')).toHaveTextContent('You counted 10 of 10 units');
  });

  it('asks for no count while the van is on the way', async () => {
    const onWay = order('ORDT1', { status: 'ENROUTE', unitsReceived: null });
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'TripStops' ? page([stop('STT1', onWay, { status: 'PLANNED', arrivalActual: null })]) : page([])) });
    expect(await screen.findByTestId('eta')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  });
});

describe('SM-27 Orders and history', () => {
  it('lists only the outlet in the token and cancels an order planning has not picked up', async () => {
    const rows = [order('ORDT5', { status: 'RECEIVED', runDate: '2026-04-08T00:00:00.000Z' }), order('ORDT6', { tripStop: { id: 'S6', orderId: 'ORDT6', arrivalActual: '2026-04-07T01:03:00.000Z' } })];
    const view = renderLive(<OrdersHistory />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { ...rows[0], status: 'CANCELLED' }
        : req.path === 'PODs' ? page([{ id: 'P6', tripStopId: 'S6', unitsDelivered: 9, unitsOrdered: 10, creditNoteId: 'CN-T6', savedOffline: true, savedAt: DAY, syncedAt: DAY }])
          : req.path === 'Orders' ? page(rows, 2) : req.path.startsWith("Orders('") ? { ...rows[0], lineItems: [] } : page([])),
    });
    const list = await screen.findByTestId('orders');
    expect(await within(list).findAllByText(/ORDT[56]/)).toHaveLength(2);
    for (const r of list.querySelectorAll('[data-order]')) expect(r.getAttribute('data-outlet')).toBe('OUTT01');
    expect(within(list).getByText('CN-T6')).toBeInTheDocument();
    expect(within(list).getByText('9 of 10')).toBeInTheDocument();
    const listCall = view.calls.find(c => c.path === 'Orders' && c.query.$expand === 'tripStop')!;
    expect(listCall.query.$filter).toBe("outletId eq 'OUTT01'");

    fireEvent.click(await screen.findByTestId('cancel-order'));
    await waitFor(() => expect(view.calls.some(c => c.method === 'POST' && c.path === "Orders('ORDT5')/Lodestar.Cancel")).toBe(true));
  });
});

describe('SM-29 Messages', () => {
  it('shows the user’s notifications and marks one read when opened; new ones arrive over the socket', async () => {
    let list = [
      { id: 'N1', recipientId: 'u-s', type: 'CREDIT_NOTE_ISSUED', channel: 'PUSH', payload: { message: 'Credit note issued' }, sentAt: DAY, readAt: null },
      { id: 'N2', recipientId: 'u-s', type: 'ETA_UPDATE', channel: 'WEBSOCKET', payload: { message: 'Arriving 6:35' }, sentAt: DAY, readAt: DAY },
    ];
    const view = renderLive(<Messages />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { ...list[0], readAt: DAY } : req.path === 'Notifications' ? page(list, list.length) : page([])),
    });
    const msgs = await screen.findByTestId('messages');
    expect(await within(msgs).findByText('Credit note issued')).toBeInTheDocument();
    fireEvent.click(msgs.querySelector('[data-notification="N1"]')!);
    await waitFor(() => expect(view.calls.some(c => c.method === 'POST' && c.path === "Notifications('N1')/Lodestar.MarkRead")).toBe(true));

    list = [{ id: 'N3', recipientId: 'u-s', type: 'DISPATCH_NOTICE', channel: 'WEBSOCKET', payload: { message: 'Dock blocked, driver waits' }, sentAt: DAY, readAt: null }, ...list];
    view.hub.emit('notification', list[0]);
    expect(await within(msgs).findByText('Dock blocked, driver waits')).toBeInTheDocument();
  });
});

describe('ADM-04 Add or edit person', () => {
  it('adds a store manager with POST /Users and returns to people', async () => {
    const view = renderLive(
      <ScreenShell board="P6" nav={nav({ L290: '/admin/adm-03-people-and-roles' })} live><AddPerson /></ScreenShell>,
      { session: SESSIONS.admin, handler: req => (req.query.$top === '0' ? page([], 1) : req.method === 'POST' ? { status: 201, body: { id: 'new' } } : req.path === 'Outlets' ? page([OUTLET]) : page([])) },
    );
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'New Manager' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'new@example.test' } });
    await screen.findByRole('option', { name: /OUTT01/ });
    fireEvent.change(screen.getByLabelText('Outlet'), { target: { value: 'OUTT01' } });
    fireEvent.click(screen.getByTestId('save-person'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/adm-03-people-and-roles'));
    expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: 'Users', body: { name: 'New Manager', email: 'new@example.test', role: 'STORE_MANAGER', outletId: 'OUTT01', depot: 'KANDY' } });
  });

  it('edits a person with PATCH and the If-Match ETag it read', async () => {
    window.sessionStorage.setItem('lodestar.focus.user', 'u9');
    const view = renderLive(<AddPerson />, {
      session: SESSIONS.admin,
      handler: req => (req.query.$top === '0' ? page([], 1)
        : req.path === "Users('u9')" && req.method === 'GET' ? { status: 200, body: { id: 'u9', email: 'd@example.test', name: 'Disp', role: 'DISPATCHER', depot: 'KANDY', isActive: true }, headers: { ETag: 'W/"77"' } }
          : req.method === 'PATCH' ? { id: 'u9' } : page([])),
    });
    expect(await screen.findByText('Edit Disp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('save-person'));
    await waitFor(() => expect(view.calls.some(c => c.method === 'PATCH')).toBe(true));
    const patch = view.calls.find(c => c.method === 'PATCH')!;
    expect(patch.path).toBe("Users('u9')");
    expect(patch.headers['If-Match']).toBe('W/"77"');
    expect(patch.body).toMatchObject({ isActive: false, role: 'DISPATCHER', depot: 'KANDY' });
  });
});

describe('ADM-07 Lost phone', () => {
  it('revokes the device with a required audit note', async () => {
    window.sessionStorage.setItem('lodestar.focus.device', 'DEVT1');
    const view = renderLive(<LostPhone />, {
      session: SESSIONS.admin,
      handler: req => (req.query.$top === '0' ? page([], 1)
        : req.path === "Devices('DEVT1')" ? { id: 'DEVT1', userId: 'u7', label: 'Driver phone', status: 'ACTIVE', registeredAt: DAY, user: { id: 'u7', name: 'Driver T', role: 'DRIVER', depot: 'KANDY' } }
          : req.path === 'OfflineEvents' ? page([{ id: 'E1', driverId: 'u7', eventType: 'POD_SAVE', payload: {}, savedAt: DAY, conflictResolved: false }])
            : req.method === 'POST' ? { id: 'DEVT1', status: 'REVOKED' } : page([])),
    });
    await waitFor(() => expect(screen.getByTestId('records-waiting')).toHaveTextContent('1 record exists only on that phone'));
    expect(screen.getByTestId('revoke')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByLabelText('Audit note'), { target: { value: 'Reported lost by the driver' } });
    fireEvent.click(screen.getByTestId('revoke'));
    await waitFor(() => expect(view.calls.find(c => c.method === 'POST')).toMatchObject({ path: "Devices('DEVT1')/Lodestar.Revoke", body: { reason: 'Reported lost by the driver' } }));
  });
});

describe('ADM-16 Audit log and ADM-20 Chain check', () => {
  const entries = [2, 1].map(seq => ({ seq, at: DAY, actor: 'u-a', actorRoles: ['admin'], client: 'lodestar-web', service: 'auth', action: 'Devices.Revoke', entitySet: 'Devices', entityKey: 'DEVT1', outcome: 'SUCCESS', prevHash: `${seq - 1}`.padEnd(64, '0'), hash: `${seq}abc`.padEnd(64, 'f') }));

  it('lists the hash-chained entries, newest first, with the chain status', async () => {
    const view = renderLive(<AuditLog />, {
      session: SESSIONS.admin,
      handler: req => (req.query.$top === '0' ? page([], 2)
        : req.path === 'AuditEntries/Lodestar.VerifyChain()' ? { valid: true, checked: 2, headSeq: 2, headHash: entries[0].hash }
          : req.path === 'AuditEntries' ? page(entries, 2) : req.path === 'Users' ? page([{ id: 'u-a', name: 'Ada Admin' }]) : page([])),
    });
    const log = await screen.findByTestId('audit-log');
    expect(await within(log).findAllByText('Devices.Revoke · DEVT1')).toHaveLength(2);
    expect(await within(log).findAllByText('Ada Admin')).toHaveLength(2);
    expect(await screen.findByTestId('chain-hero')).toHaveTextContent('Intact');
    expect(view.calls.find(c => c.path === 'AuditEntries' && c.query.$orderby)!.query.$orderby).toBe('seq desc');
    fireEvent.click(screen.getByRole('button', { name: /^Refused/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'AuditEntries' && c.query.$filter === "outcome eq 'DENIED'")).toBe(true));
  });

  it('runs VerifyChain and reports a valid chain', async () => {
    const view = renderLive(<ChainCheck />, {
      session: SESSIONS.admin,
      handler: req => (req.query.$top === '0' ? page([], 2) : req.path === 'AuditEntries/Lodestar.VerifyChain()' ? { valid: true, checked: 2, headSeq: 2, headHash: entries[0].hash } : page([])),
    });
    await waitFor(() => expect(screen.getByTestId('chain-valid')).toHaveAttribute('data-valid', 'true'));
    expect(screen.getByTestId('chain-valid')).toHaveTextContent('Intact');
    fireEvent.click(screen.getByTestId('verify-again'));
    await waitFor(() => expect(view.calls.filter(c => c.path === 'AuditEntries/Lodestar.VerifyChain()')).toHaveLength(2));
  });

  it('reports a broken chain with the first bad entry', async () => {
    renderLive(<ChainCheck />, {
      session: SESSIONS.admin,
      handler: req => (req.query.$top === '0' ? page([], 2) : req.path.includes('VerifyChain') ? { valid: false, checked: 2, headSeq: 2, firstInvalidSeq: 2, reason: 'hash mismatch' } : page([])),
    });
    expect(await screen.findByText(/Break at #2\./)).toBeInTheDocument();
    expect(screen.getByTestId('chain-valid')).toHaveTextContent('Broken');
  });
});
