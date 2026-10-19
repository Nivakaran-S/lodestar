// Live Store desk screens (SM-01, SM-02, SM-26, SM-27, SM-28, SM-29) against a mocked OData API: a real
// ODataClient over a fake fetch, so every assertion on a request is at the HTTP level (method, path, query, body).
// Covers what live-store-admin.test.tsx does not: loading, empty and error states, validation, and the requests
// each user action sends. Date is frozen (Mon 6 Apr 2026, 13:30 in Colombo) so countdowns and filters are fixed.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import PlaceOrder from '@/live/sm-01-place-order';
import Deliveries from '@/live/sm-02-deliveries';
import OrdersHistory from '@/live/sm-27-orders-and-history';
import Receipts from '@/live/sm-28-receipts-and-credit-notes';
import Messages from '@/live/sm-29-messages';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { page, renderLive, SESSIONS } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/store' }));

const NOW = '2026-04-06T08:00:00.000Z'; // Mon 6 Apr, 13:30 Asia/Colombo: 2 h 30 m before the 4:00 PM cutoff
const DAY = '2026-04-07T00:00:00.000Z';
const OUTLET = { id: 'OUTT01', name: 'Outlet T01', brand: 'FRESH', district: 'District T', depot: 'KANDY', dockType: 'REAR_DOCK', parking: 'NORMAL', windowOpen: '05:30', windowClose: '08:00', isActive: true };
const order = (id: string, over = {}) => ({ id, outletId: 'OUTT01', runDate: DAY, orderedAt: DAY, brand: 'FRESH', tempClass: 'AMBIENT', units: 10, kg: 100, m3: 0.5, status: 'DELIVERED', deferredYesterday: false, daysSince: 1, ...over });
const err = (status: number, message: string, code = 'Failed') => ({ status, body: { error: { code, message } } });

/** Reads every store screen makes: sidebar/top-bar counts and the outlet in the token. */
function storeBase(req: FakeRequest) {
  if (req.query.$top === '0') return page([], 0);
  if (req.path === "Outlets('OUTT01')") return OUTLET;
  return undefined;
}
const posts = (calls: FakeRequest[]) => calls.filter(c => c.method === 'POST');
const disabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  freezeDate(NOW);
});
afterEach(unfreeze);

// ------------------------------------------------------------------------------------------------ SM-01

describe('SM-01 Place order', () => {
  const historyCall = (calls: FakeRequest[]) => calls.filter(c => c.method === 'GET' && c.path === 'Orders' && c.query.$expand === 'lineItems');

  it('shows a skeleton while the last orders load, then asks for them for the token’s outlet only', async () => {
    const view = renderLive(<PlaceOrder />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([]) });
    expect(screen.getByRole('status', { name: 'Loading live data…' })).toBeInTheDocument();
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
    expect(await screen.findByTestId('lines-ambient')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading live data…' })).not.toBeInTheDocument();
    const [q] = historyCall(view.calls);
    expect(q.query).toMatchObject({ $filter: "outletId eq 'OUTT01' and status ne 'CANCELLED'", $orderby: 'runDate desc', $top: '12' });
  });

  it('counts down to the 4:00 PM cutoff of the next open run and asks the calendar for that date', async () => {
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'Calendar' ? page([{ festivalName: 'Avurudu', festivalRamp: 0.25, isOperating: true }]) : page([])),
    });
    expect(await screen.findByText('Order for Tue 7 Apr')).toBeInTheDocument();
    expect(screen.getByText(/2 h 30 m/)).toBeInTheDocument();
    expect(await screen.findByText('Avurudu')).toBeInTheDocument();
    expect(screen.getByText('+25%')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Calendar' && c.query.$top === '1')!.query).toMatchObject({ $filter: 'date eq 2026-04-07T00:00:00Z', $top: '1' });
    // the closed days ahead are read too, so a day the operating Calendar closes is never offered
    expect(view.calls.find(c => c.path === 'Calendar' && c.query.$top === '60')!.query.$filter).toBe('isOperating eq false and date ge 2026-04-06T00:00:00Z and date lt 2026-04-22T00:00:00Z');

    fireEvent.change(screen.getByLabelText('Delivery date'), { target: { value: '2026-04-10' } });
    expect(await screen.findByText('Order for Fri 10 Apr')).toBeInTheDocument();
    await waitFor(() => expect(view.calls.some(c => c.path === 'Calendar' && c.query.$filter === 'date eq 2026-04-10T00:00:00Z')).toBe(true));
  });

  it('shows "orders closed" when dispatch closed the run (Orders/Lodestar.OrderWindow), and that run cannot be submitted', async () => {
    const last = [order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] })];
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path.startsWith('Orders/Lodestar.OrderWindow(') ? { depot: 'KANDY', runDate: '2026-04-07', closed: true, reason: 'Planning the run' }
        : req.path === 'Orders' ? page(last) : page([])),
    });
    expect(await screen.findByTestId('orders-closed')).toHaveTextContent('Orders closed for the Tue 7 Apr run');
    expect(screen.getByTestId('orders-closed')).toHaveTextContent('(Planning the run)');
    expect(view.calls.find(c => c.path.startsWith('Orders/Lodestar.OrderWindow('))!.path).toBe('Orders/Lodestar.OrderWindow(runDate=2026-04-07)');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
  });

  it('warns when the calendar has no run on the chosen date, and that date cannot be submitted', async () => {
    const last = [order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] })];
    renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'Calendar' ? (req.query.$top === '1' && req.query.$filter === 'date eq 2026-04-10T00:00:00Z' ? page([{ isOperating: false }]) : page([])) : req.path === 'Orders' ? page(last) : page([])),
    });
    await screen.findByText(/Delivered before your/);
    expect(disabled(screen.getByTestId('submit-order'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Delivery date'), { target: { value: '2026-04-10' } });
    expect(await screen.findByTestId('closed-day')).toHaveTextContent('No run on this date. The next operating day is Sat 11 Apr.');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
  });

  it('never offers a day the operating Calendar closes: the next run is the next operating day', async () => {
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'Calendar' && req.query.$top === '60' ? page([{ date: '2026-04-07T00:00:00Z' }, { date: '2026-04-08T00:00:00Z' }]) : page([])),
    });
    expect(await screen.findByText('Order for Thu 9 Apr')).toBeInTheDocument();
    await waitFor(() => expect(view.calls.some(c => c.path === 'Calendar' && c.query.$filter === 'date eq 2026-04-09T00:00:00Z')).toBe(true));
  });

  it('first order: empty tables, nothing to submit until a valid item is added', async () => {
    renderLive(<PlaceOrder />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([]) });
    const dry = await screen.findByTestId('lines-ambient');
    await screen.findByText(/Delivered before your 8:00 opening · window 05:30–08:00/);
    expect(screen.getByText(/first order/)).toBeInTheDocument();
    expect(within(dry).getByText('No lines yet')).toBeInTheDocument();
    expect(within(screen.getByTestId('lines-chilled')).getByText('No lines yet')).toBeInTheDocument();
    expect(screen.getByTestId('order-summary')).toHaveTextContent('0 orders · 0 items · 0 units · 0 kg');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);

    const add = within(dry).getByText('Add');
    const name = screen.getByLabelText('New dry order item');
    const kg = within(dry).getByLabelText('kg per unit');
    // required: a name and a positive kg per unit
    expect(disabled(add)).toBe(true);
    fireEvent.change(name, { target: { value: 'Rice 5 kg' } });
    expect(disabled(add)).toBe(true);
    for (const bad of ['abc', '0', '-2']) {
      fireEvent.change(kg, { target: { value: bad } });
      expect(disabled(add)).toBe(true);
      fireEvent.click(add);
      expect(within(dry).queryByText('Rice 5 kg')).not.toBeInTheDocument();
    }
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.change(kg, { target: { value: '5' } });
    expect(disabled(add)).toBe(true);

    fireEvent.change(name, { target: { value: '  Rice 5 kg ' } });
    expect(disabled(add)).toBe(false);
    fireEvent.click(add);
    expect(within(dry).getByText('Rice 5 kg')).toBeInTheDocument();
    expect(within(dry).queryByText('No lines yet')).not.toBeInTheDocument();
    expect(name).toHaveValue('');
    expect(kg).toHaveValue('');
    expect(screen.getByLabelText('Rice 5 kg quantity')).toHaveTextContent('1');
    expect(screen.getByTestId('order-summary')).toHaveTextContent('1 order · 1 item · 1 units · 5 kg');
    expect(screen.getByTestId('submit-order')).toHaveTextContent('Submit 1 order');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(false);

    // taking the only line down to zero leaves nothing to submit again
    fireEvent.click(screen.getByTitle('Less Rice 5 kg'));
    expect(screen.getByLabelText('Rice 5 kg quantity')).toHaveTextContent('0');
    fireEvent.click(screen.getByTitle('Less Rice 5 kg'));
    expect(screen.getByLabelText('Rice 5 kg quantity')).toHaveTextContent('0');
    expect(screen.getByTestId('order-summary')).toHaveTextContent('0 orders · 0 items · 0 units');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
  });

  it('submits only the lines with a quantity, one POST per temperature class that has any', async () => {
    const last = [order('ORDT1', { tempClass: 'AMBIENT', kg: 100, m3: 0.5, lineItems: [
      { id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 10, kg: 50, tempClass: 'AMBIENT' },
      { id: 'l2', orderId: 'ORDT1', name: 'Dhal 1 kg', qty: 2, kg: 2, tempClass: 'AMBIENT' },
    ] }), order('ORDT2', { tempClass: 'CHILLED', kg: 0, m3: 0, lineItems: [{ id: 'l3', orderId: 'ORDT2', name: 'Milk 1 L', qty: 1, kg: 1, tempClass: 'CHILLED' }] })];
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { status: 201, body: { id: 'ORDNEW', ...(req.body as object) } } : req.path === 'Orders' ? page(last) : page([])),
    });
    await screen.findByText('Dhal 1 kg');
    expect(screen.getByText('Started from ORDT1 and ORDT2 (Tue 7 Apr).')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Less Dhal 1 kg'));
    fireEvent.click(screen.getByTitle('Less Dhal 1 kg'));
    fireEvent.click(screen.getByTitle('Less Milk 1 L'));
    expect(screen.getByTestId('order-summary')).toHaveTextContent('1 order · 1 item · 10 units · 50 kg');
    fireEvent.click(screen.getByTestId('submit-order'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/store/sm-27-orders-and-history'));
    expect(posts(view.calls)).toHaveLength(1);
    expect(posts(view.calls)[0]).toMatchObject({
      path: 'Orders',
      body: { outletId: 'OUTT01', runDate: '2026-04-07T00:00:00.000Z', brand: 'FRESH', tempClass: 'AMBIENT', units: 10, kg: 50, m3: 0.25, lineItems: [{ name: 'Rice 5 kg', qty: 10, kg: 50, tempClass: 'AMBIENT' }] },
    });
  });

  it('keeps the order on screen and shows the API’s reason when the POST is refused', async () => {
    const last = [order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 10, kg: 50, tempClass: 'AMBIENT' }] })];
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? err(422, 'Orders for Tue 7 Apr closed at 4:00 PM on Mon 6 Apr.', 'CutoffPassed') : req.path === 'Orders' ? page(last) : page([])),
    });
    await screen.findByText('Rice 5 kg');
    fireEvent.click(screen.getByTestId('submit-order'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Orders for Tue 7 Apr closed at 4:00 PM on Mon 6 Apr.');
    expect(alert).toHaveTextContent('CutoffPassed');
    expect(posts(view.calls)).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('Rice 5 kg')).toBeInTheDocument();
    expect(disabled(screen.getByTestId('submit-order'))).toBe(false);
  });

  it('shows the error when the last orders cannot load, and “Try again” asks again', async () => {
    let fail = true;
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'Orders' ? (fail ? err(503, 'The orders service is not reachable') : page([order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] })])) : page([])),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('The orders service is not reachable');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('Rice 5 kg')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(historyCall(view.calls)).toHaveLength(2);
  });

  it('cannot submit while the outlet in the token cannot be loaded', async () => {
    const last = [order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] })];
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => (req.query.$top === '0' ? page([], 0) : req.path === "Outlets('OUTT01')" ? err(403, 'You do not have access to this outlet.') : req.path === 'Orders' ? page(last) : page([])),
    });
    await screen.findByText('Rice 5 kg');
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this outlet.');
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
    fireEvent.click(screen.getByTestId('submit-order'));
    expect(posts(view.calls)).toHaveLength(0);
  });

  // After the cutoff the API takes the order and moves it to the next open run (backend/apps/orders/src/order-cutoff.ts):
  // Submit stays on, the screen says where the order goes, and shows the run date and note the API returned.
  it('submits for a run whose cutoff has passed and shows the later run the API moved it to', async () => {
    jest.setSystemTime(new Date('2026-04-06T11:00:00.000Z')); // 16:30 in Colombo: Tue 7 Apr has closed
    const last = [order('ORDT1', { lineItems: [{ id: 'l1', orderId: 'ORDT1', name: 'Rice 5 kg', qty: 3, kg: 15, tempClass: 'AMBIENT' }] })];
    const note = 'Placed after the 4:00 PM cut-off for 2026-04-07; moved to the 2026-04-08 run.';
    const view = renderLive(<PlaceOrder />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? { status: 201, body: { ...(req.body as object), id: 'ORDNEW', runDate: '2026-04-08T00:00:00Z', notes: note } } : req.path === 'Orders' ? page(last) : page([])),
    });
    expect(await screen.findByText('Order for Wed 8 Apr')).toBeInTheDocument();
    await screen.findByText(/Delivered before your/);
    fireEvent.change(screen.getByLabelText('Delivery date'), { target: { value: '2026-04-07' } });
    expect(await screen.findByText('Closed')).toBeInTheDocument();
    expect(screen.getByText(/This run is closed/)).toHaveTextContent('Submit now and the order goes to the next open run, Wed 8 Apr.');
    expect(disabled(screen.getByTestId('submit-order'))).toBe(false);
    fireEvent.click(screen.getByTestId('submit-order'));
    const moved = await screen.findByTestId('order-moved');
    expect(posts(view.calls)).toHaveLength(1);
    expect(posts(view.calls)[0].body).toMatchObject({ runDate: '2026-04-07T00:00:00.000Z' });
    expect(moved).toHaveTextContent('Received: ORDNEW for Wed 8 Apr');
    expect(moved).toHaveTextContent(note);
    // the store sees the moved date before moving on, and cannot send the same order twice
    expect(router.push).not.toHaveBeenCalled();
    expect(disabled(screen.getByTestId('submit-order'))).toBe(true);
    fireEvent.click(within(moved).getByRole('button', { name: 'See your orders' }));
    expect(router.push).toHaveBeenCalledWith('/store/sm-27-orders-and-history');
  });
});

// ------------------------------------------------------------------------------------------------ SM-02

describe('SM-02 Deliveries', () => {
  const stop = (id: string, o: object, over = {}) => ({ id, tripId: 'TRT1', orderId: (o as { id: string }).id, outletId: 'OUTT01', stopSeq: 2, status: 'PLANNED', etaPlan: '2026-04-07T00:45:00.000Z', order: o, trip: { id: 'TRT1', vehicleId: 'VEH057', status: 'ENROUTE', runDate: DAY, departTime: '2026-04-06T23:30:00.000Z' }, ...over });

  it('loading, then the empty states when the outlet has no delivery, order or notice', async () => {
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([]) });
    expect(within(screen.getByTestId('next-delivery')).getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('No deliveries yet')).toBeInTheDocument();
    expect(screen.getByText(/^No delivery yet/)).toHaveTextContent('No delivery yet 0 orders');
    expect(await screen.findByText('No orders in this period')).toBeInTheDocument();
    expect(await screen.findByText('Nothing needs your attention')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  });

  it('shows the ETA band, the late risk against the outlet’s window and the order thread', async () => {
    const o = order('ORDT1', { status: 'ENROUTE', units: 12, tempClass: 'CHILLED', unitsReceived: null });
    const view = renderLive(<Deliveries />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.path === 'TripStops'
        ? page([stop('STT1', o, { etaModel: '2026-04-07T01:00:00.000Z', etaModelBandEarly: '2026-04-07T00:50:00.000Z', etaModelBandLate: '2026-04-07T01:20:00.000Z', lateRiskPct: 45 })])
        : req.path === 'Orders' ? page([o]) : page([])),
    });
    expect(await screen.findByTestId('eta')).toHaveTextContent('6:20–6:50');
    expect(screen.getByText('Next delivery')).toBeInTheDocument(); // Tue 7 Apr's run, seen on Mon 6 Apr
    expect(screen.getByText(/At risk for your 08:00 window · late risk 45%/)).toBeInTheDocument();
    expect(screen.getByText(/departs ~5:00/)).toBeInTheDocument();
    expect(screen.getByText('12 units in this delivery')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'TripStops')!.query).toMatchObject({ $filter: "outletId eq 'OUTT01'", $expand: 'trip,order,pod', $orderby: 'etaPlan desc' });
  });

  it('a past run never closed is the latest delivery, not today’s; today’s run is', async () => {
    const o = order('ORDT1', { status: 'ENROUTE', units: 12, unitsReceived: null });
    const past = (id: string) => stop(id, o, { etaPlan: '2026-03-30T00:45:00.000Z', trip: { id: 'TRP', vehicleId: 'VEH057', status: 'PLANNED', runDate: '2026-03-30T00:00:00.000Z' } });
    const { unmount } = renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'TripStops' ? page([past('STP')]) : page([])) });
    expect(await screen.findByText('Latest delivery')).toBeInTheDocument();
    // its ETA, departure and late risk are history: no live forecast, no "now" on the thread
    expect(screen.getByText(/Planned arrival/)).toBeInTheDocument();
    expect(screen.getByText(/never closed/)).toBeInTheDocument();
    expect(screen.queryByText(/departs ~/)).not.toBeInTheDocument();
    expect(screen.queryByText(/late risk/)).not.toBeInTheDocument();
    expect(screen.queryByText('now')).not.toBeInTheDocument();
    unmount();
    const today = stop('STT', o, { etaPlan: '2026-04-06T09:00:00.000Z', trip: { id: 'TRT1', vehicleId: 'VEH057', status: 'ENROUTE', runDate: '2026-04-06T00:00:00.000Z' } });
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'TripStops' ? page([past('STP'), today]) : page([])) });
    expect(await screen.findByText("Today's delivery")).toBeInTheDocument();
  });

  it('the top bar’s menu button opens the nav in a side drawer; Escape and the backdrop close it', async () => {
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([]) });
    const menu = await screen.findByRole('button', { name: 'Open navigation' });
    const drawer = screen.getByRole('complementary', { name: 'Lodestar Store navigation' });
    expect(drawer).not.toHaveClass('is-open');
    fireEvent.click(menu);
    expect(drawer).toHaveClass('is-open');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer).not.toHaveClass('is-open');
    fireEvent.click(menu);
    fireEvent.click(within(drawer).getByRole('link', { name: /Receipts/ }));
    expect(router.push).toHaveBeenCalledWith('/store/sm-28-receipts-and-credit-notes');
    expect(drawer).not.toHaveClass('is-open');
  });

  it('“Got it” marks the notice read and reloads the notices', async () => {
    let unread = [{ id: 'N1', recipientId: 'u-s', type: 'ETA_UPDATE', channel: 'PUSH', payload: { message: 'Van is 20 min late' }, sentAt: DAY, readAt: null }];
    const view = renderLive(<Deliveries />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? (unread = [], { id: 'N1' }) : req.path === 'Notifications' ? page(unread) : page([])),
    });
    expect(await screen.findByText('Van is 20 min late')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(await screen.findByText('Nothing needs your attention')).toBeInTheDocument();
    expect(posts(view.calls)).toEqual([expect.objectContaining({ path: "Notifications('N1')/Lodestar.MarkRead" })]);
    expect(view.calls.filter(c => c.path === 'Notifications' && c.query.$top === '3')).toHaveLength(2);
  });

  it('switches the order list between this week and the last 4 weeks', async () => {
    const view = renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Orders' ? page([order('ORDT1')]) : page([])) });
    expect(await screen.findByText('Delivered · count it')).toBeInTheDocument();
    const week = view.calls.find(c => c.path === 'Orders')!;
    expect(week.query.$filter).toBe("outletId eq 'OUTT01' and runDate ge 2026-03-30T00:00:00Z");
    fireEvent.click(screen.getByRole('button', { name: 'Last 4 weeks' }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Orders' && c.query.$filter === "outletId eq 'OUTT01' and runDate ge 2026-03-09T00:00:00Z")).toBe(true));
  });

  it('shows a notice by its title, and refreshes when a trip leaves the depot or a plan is published', async () => {
    const notice = { id: 'N1', recipientId: 'u-s', type: 'ORDER_AT_RISK', channel: 'WEBSOCKET', payload: { orderId: 'ORDT1', title: 'Order ORDT1 at risk: dispatch is placing it' }, sentAt: DAY, readAt: null };
    const view = renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Notifications' ? page([notice]) : page([])) });
    expect(await screen.findByTestId('notice-text')).toHaveTextContent('Order ORDT1 at risk: dispatch is placing it');
    const stopsCalls = () => view.calls.filter(c => c.path === 'TripStops').length;
    await waitFor(() => expect(stopsCalls()).toBe(1));
    view.hub.emit('trip_released', { tripId: 'TRT1' });
    await waitFor(() => expect(stopsCalls()).toBe(2));
    view.hub.emit('plan_published', { planId: 'P1' });
    await waitFor(() => expect(stopsCalls()).toBe(3));
  });

  it('counts down to the next run still open, skipping a day the operating Calendar closes', async () => {
    renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Calendar' ? page([{ date: '2026-04-07T00:00:00Z' }]) : page([])) });
    await waitFor(() => expect(screen.getByTestId('next-run')).toHaveTextContent('Wed 8 Apr orders close 4:00 PM tomorrow · 26 h 30 m left'));
  });

  it('shows the API error and retries the deliveries', async () => {
    const view = renderLive(<Deliveries />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'TripStops' ? err(503, 'Deliveries are not reachable') : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Deliveries are not reachable');
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(view.calls.filter(c => c.path === 'TripStops')).toHaveLength(2));
  });

  it('keeps the count on screen when confirming the receipt fails', async () => {
    const o = order('ORDT1', { units: 4, unitsReceived: null });
    renderLive(<Deliveries />, {
      session: SESSIONS.store,
      handler: req => storeBase(req) ?? (req.method === 'POST' ? err(409, 'This receipt was already confirmed on the phone.') : req.path === 'TripStops' ? page([stop('STT1', o, { status: 'DELIVERED', arrivalActual: DAY })]) : page([])),
    });
    const card = await screen.findByTestId('receipt');
    fireEvent.click(screen.getByTitle('One less for ORDT1'));
    fireEvent.click(screen.getByTitle('One more for ORDT1'));
    fireEvent.click(screen.getByTitle('One more for ORDT1')); // capped at the units ordered
    expect(screen.getByTestId('receipt-count-ORDT1')).toHaveTextContent('4');
    fireEvent.click(screen.getByTestId('confirm-receipt'));
    expect(await within(card).findByRole('alert')).toHaveTextContent('This receipt was already confirmed on the phone.');
    expect(screen.getByTestId('receipt')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------------------------ SM-26

// SM-26: the designed sign-in form (direct grant) is covered in sign-in-screens.test.tsx.

// ------------------------------------------------------------------------------------------------ SM-27

describe('SM-27 Orders and history · states and filters', () => {
  it('first visit: no orders yet', async () => {
    renderLive(<OrdersHistory />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([], 0) });
    expect(await screen.findByText('Place your first order.')).toBeInTheDocument();
  });

  it('a filter chip and the search narrow the request; nothing matching says so', async () => {
    const view = renderLive(<OrdersHistory />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([], 0) });
    await screen.findByText('Place your first order.');
    fireEvent.click(screen.getByRole('button', { name: /^Delivered/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Orders' && c.query.$filter === "outletId eq 'OUTT01' and status eq 'DELIVERED'")).toBe(true));
    expect(await screen.findByText('Nothing matches this filter.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search orders'), { target: { value: 'ORDT9 ' } });
    await waitFor(() => expect(view.calls.some(c => c.path === 'Orders' && c.query.$search === 'ORDT9')).toBe(true));
  });

  it('shows the error when the orders cannot load', async () => {
    renderLive(<OrdersHistory />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Orders' && req.query.$expand === 'tripStop' && req.query.$top === '25' ? err(500, 'Orders failed') : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Orders failed');
  });
});

// ------------------------------------------------------------------------------------------------ SM-28

describe('SM-28 Receipts and credit notes', () => {
  const pods = [
    { id: 'P1', tripStopId: 'S1', unitsDelivered: 9, unitsOrdered: 10, receiverName: 'Nimal', creditNoteId: 'CN-2604-0001', savedOffline: false, savedAt: '2026-04-07T01:05:00.000Z', syncedAt: '2026-04-07T01:06:00.000Z', exceptions: [{ type: 'SHORT', description: 'One tray short' }], tripStop: { id: 'S1', orderId: 'ORDT1' } },
    { id: 'P2', tripStopId: 'S2', unitsDelivered: 6, unitsOrdered: 6, receiverName: 'Kamal', creditNoteId: null, savedOffline: true, savedAt: '2026-04-06T01:00:00.000Z', syncedAt: null, tripStop: { id: 'S2', orderId: 'ORDT2' } },
  ];
  const orders = [order('ORDT1', { runDate: DAY }), order('ORDT2', { runDate: '2026-04-06T00:00:00.000Z', tempClass: 'CHILLED' })];

  it('lists the delivered orders with their PODs, the KPIs, and opens the credit note first', async () => {
    const view = renderLive(<Receipts />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'PODs' ? page(pods) : req.path === 'Orders' ? page(orders) : page([])) });
    const list = await screen.findByTestId('receipts');
    await waitFor(() => expect(list.querySelectorAll('[data-pod]')).toHaveLength(2));
    expect(screen.getByTestId('matched')).toHaveTextContent('1of 2');
    expect(screen.getByText("Some counts differ from the driver's record, or the record is still syncing")).toBeInTheDocument();
    expect(screen.getByText('1 credit note')).toBeInTheDocument();
    expect(screen.getByText('nothing waiting on you')).toBeInTheDocument();
    const detail = screen.getByTestId('credit-detail');
    expect(detail).toHaveTextContent('Credit note');
    expect(detail).toHaveTextContent('CN-2604-0001');
    expect(detail).toHaveTextContent('One tray short');
    expect(detail).toHaveTextContent('Delivered9 of 10');
    expect(within(list.querySelector('[data-pod="P1"]') as HTMLElement).getByText('Tue 7 Apr')).toBeInTheDocument();
    const ordersCall = view.calls.find(c => c.path === 'Orders')!;
    expect(ordersCall.query).toMatchObject({ $filter: "outletId eq 'OUTT01' and (unitsReceived ne null or status in ('DELIVERED','EXCEPTION'))", $expand: 'tripStop($expand=pod)' });
    // both orders came with the outlet's delivered orders: no lookup by id
    expect(view.calls.some(c => c.path === 'Orders' && String(c.query.$filter).startsWith('id in'))).toBe(false);
    expect(view.calls.find(c => c.path === 'PODs')!.query).toMatchObject({ $expand: 'tripStop', $orderby: 'savedAt desc' });

    fireEvent.click(list.querySelector('[data-pod="P2"]')!);
    expect(screen.getByTestId('credit-detail')).toHaveTextContent('Receipt');
    expect(screen.getByTestId('credit-detail')).toHaveTextContent('Syncing');
    expect(screen.getByTestId('credit-detail')).toHaveTextContent('saved offline');

    fireEvent.click(screen.getByRole('button', { name: 'Credit notes · 1' }));
    expect(list.querySelectorAll('[data-pod]')).toHaveLength(1);
    expect(list.querySelector('[data-pod="P1"]')).not.toBeNull();
  });

  it('counts a short delivery without a credit note as an open dispute', async () => {
    const short = [{ ...pods[1], id: 'P3', unitsDelivered: 4, syncedAt: DAY }];
    renderLive(<Receipts />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'PODs' ? page(short) : req.path === 'Orders' ? page(orders) : page([])) });
    expect(await screen.findByText('short without a credit note')).toBeInTheDocument();
    expect(screen.getByText('0 credit notes')).toBeInTheDocument();
    expect(screen.getByText('Open disputes').parentElement).toHaveTextContent('Open disputes1short without a credit note');
  });

  it('shows the credit note of a short count confirmed before the driver’s POD exists, with the credited units', async () => {
    const counted = order('ORDT3', { unitsReceived: 7, unitsExpected: 10, creditNoteId: 'CN-2604-0009', receiptSavedAt: '2026-04-07T01:30:00.000Z', receiptNote: '3 short at receipt' });
    renderLive(<Receipts />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Orders' ? page([counted]) : page([])) });
    const list = await screen.findByTestId('receipts');
    await waitFor(() => expect(list.querySelector('[data-order="ORDT3"]')).not.toBeNull());
    const row = list.querySelector('[data-order="ORDT3"]') as HTMLElement;
    expect(row).toHaveTextContent('7 of 10');
    expect(row).toHaveTextContent('CN-2604-0009 3 units');
    expect(row).toHaveTextContent('not synced yet');
    expect(screen.getByTestId('units-credited')).toHaveTextContent('3');
    expect(screen.getByText('1 credit note')).toBeInTheDocument();
    const detail = screen.getByTestId('credit-detail');
    expect(detail).toHaveTextContent('CN-2604-0009');
    expect(detail).toHaveTextContent('Your count7 of 10');
    expect(detail).toHaveTextContent('3 short at receipt');
  });

  it('empty: no receipts yet, and only the outlet’s own orders are asked for', async () => {
    const view = renderLive(<Receipts />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([]) });
    expect(await screen.findByText('No receipts yet')).toBeInTheDocument();
    expect(screen.queryByTestId('credit-detail')).not.toBeInTheDocument();
    expect(view.calls.filter(c => c.path === 'Orders').every(c => String(c.query.$filter).startsWith("outletId eq 'OUTT01'"))).toBe(true);
  });

  it('shows the error and retries', async () => {
    let fail = true;
    const view = renderLive(<Receipts />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'PODs' ? (fail ? err(502, 'Proofs are not reachable') : page([])) : page([])) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Proofs are not reachable');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('No receipts yet')).toBeInTheDocument();
    expect(view.calls.filter(c => c.path === 'PODs')).toHaveLength(2);
  });
});

// ------------------------------------------------------------------------------------------------ SM-29

describe('SM-29 Messages · states and filters', () => {
  it('empty inbox', async () => {
    renderLive(<Messages />, { session: SESSIONS.store, handler: req => storeBase(req) ?? page([], 0) });
    expect(await screen.findByText('No messages')).toBeInTheDocument();
    expect(screen.getByText(/nothing needs action/)).toBeInTheDocument();
  });

  it('“Needs action” asks for unread notices only; opening a read one sends nothing', async () => {
    const read = { id: 'N2', recipientId: 'u-s', type: 'ETA_UPDATE', channel: 'WEBSOCKET', payload: { message: 'Arriving 6:35' }, sentAt: DAY, readAt: DAY };
    const view = renderLive(<Messages />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Notifications' ? page([read], 1) : page([])) });
    const msgs = await screen.findByTestId('messages');
    fireEvent.click(await within(msgs).findByText('Arriving 6:35'));
    expect(posts(view.calls)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /^Needs action/ }));
    await waitFor(() => expect(view.calls.some(c => c.path === 'Notifications' && c.query.$filter === 'readAt eq null' && c.query.$top === '30')).toBe(true));
  });

  it('shows the error when the notices cannot load', async () => {
    renderLive(<Messages />, { session: SESSIONS.store, handler: req => storeBase(req) ?? (req.path === 'Notifications' && req.query.$top === '30' ? err(503, 'Notifications are not reachable') : page([], 0)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications are not reachable');
  });
});
