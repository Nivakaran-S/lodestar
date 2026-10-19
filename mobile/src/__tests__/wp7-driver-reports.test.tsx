/* eslint-disable @typescript-eslint/no-require-imports */
// WP7: the driver's field reports made live (pre-trip check, store code, report a problem, damaged goods, reefer
// alert, report a delay). Every write is a queued outbox record (STATUS_CHANGE report or POD). Synthetic fixtures only.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { network } from '@/offline/network';
import { client, queue, routes, signInAs } from './fake-platform';

jest.mock('@/model/platform', () => require('./fake-platform'));
jest.mock('expo-auth-session', () => ({
  useAuthRequest: () => [null, null, jest.fn()],
  makeRedirectUri: () => 'lodestar://auth/callback',
  ResponseType: { Code: 'code' },
  Prompt: { Login: 'login' },
}));

const params = (require('expo-router') as { __params: Record<string, string> }).__params;
const push = router.push as jest.Mock;
const opened = (key: string, extra: Record<string, string> = {}) => ({ pathname: '/s/[key]', params: { ...extra, key } });

const RUN = '2026-04-07';
const outlet = { id: 'OUT-T1', name: 'Hill Store', brand: 'FRESH', district: 'Hills', depot: 'KANDY', dockType: 'REAR', windowOpen: '05:30', windowClose: '08:00' };
const outletB = { ...outlet, id: 'OUT-T2', name: 'Lake Store', windowClose: '07:45' };
const trip = {
  id: 'T-1', vehicleId: 'VAN-T9', depot: 'KANDY', runDate: `${RUN}T00:00:00.000Z`, brand: 'FRESH', district: 'Hills', status: 'ENROUTE', planVersion: 2, tripNumber: 1, bay: 'B2',
  departTime: `${RUN}T00:10:00.000Z`, sealNumber: 'SEAL-T1', vehicle: { id: 'VAN-T9', type: 'VAN', tempClass: 'CHILLED' },
  loadRecord: { id: 'LR-1', tripId: 'T-1', loaderId: 'u-ld', bay: 'B2', reeferTempC: 3, loadedAt: `${RUN}T00:00:00.000Z`, shortfalls: [] },
};
const stops = [
  { id: 'S-1', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', stopSeq: 1, status: 'ENROUTE', etaModel: `${RUN}T01:05:00.000Z`, outlet, order: { id: 'O-1', units: 10, tempClass: 'CHILLED', status: 'ENROUTE' }, pod: null },
  { id: 'S-2', tripId: 'T-1', orderId: 'O-2', outletId: 'OUT-T2', stopSeq: 2, status: 'PLANNED', etaModel: `${RUN}T01:55:00.000Z`, outlet: outletB, order: { id: 'O-2', units: 6, tempClass: 'CHILLED', status: 'PLANNED' }, pod: null },
];
const driver = (sub: string) => ({ sub, name: 'Test Driver', realm_access: { roles: ['driver'] }, depot: ['KANDY'], vehicle_id: 'VAN-T9' });
/**
 * The driver saved the run for offline before the signal dropped (DR-13 does this at the depot): the run, each
 * order's lines and the notices are loaded while online into the phone's cache, then the phone goes offline.
 */
async function saveRunOnPhone() {
  const { prefetch } = require('@/model/query') as typeof import('@/model/query');
  const api = require('@/model/api') as typeof import('@/model/api');
  const { today } = require('@/model/hooks') as typeof import('@/model/hooks');
  const day = today();
  network.set({ online: true, since: new Date().toISOString() });
  const run = await prefetch(`run.${day}`, c => api.driverRun(c, day));
  for (const id of new Set((run?.stops ?? []).map(st => st.orderId))) await prefetch(`lines.${id}`, c => api.orderLines(c, [id]));
  await prefetch('notifications', c => api.notifications(c));
  network.set({ online: false, since: new Date().toISOString() });
}
const reports = (sub: string) => queue.list().filter(i => i.sub === sub && i.kind === 'STATUS_CHANGE').map(i => i.payload);

beforeEach(() => {
  routes.clear();
  routes.set('Trips', [trip]);
  routes.set('TripStops', stops);
  routes.set('OrderLineItems', [{ id: 'L-1', orderId: 'O-1', name: 'Yoghurt cups', qty: 6, kg: 6, tempClass: 'CHILLED' }, { id: 'L-2', orderId: 'O-1', name: 'Milk', qty: 4, kg: 14, tempClass: 'CHILLED' }]);
  for (const k of Object.keys(params)) delete params[k];
  push.mockClear();
  client.action.mockReset();
  client.action.mockResolvedValue({});
  network.set({ online: false, since: new Date().toISOString() });
});

describe('Driver reports', () => {
  it('DR-12 pre-trip check: ticks and the reefer reading are queued as VEHICLE_CHECK, then DR-13', async () => {
    await signInAs(driver('u-dr12'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-12-pre-trip-vehicle-check').default;
    await render(<Screen />);
    expect(await screen.findByText('VAN-T9')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reefer-reading'), '3');
    for (const k of ['reefer', 'seal', 'fuel', 'tyres', 'lights']) await fireEvent.press(screen.getByTestId(`check-${k}`));
    expect(screen.getByTestId('checks-done').props.children).toBe('5 of 5 done');
    await fireEvent.press(screen.getByTestId('lk-L240'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-13-saving-run-for-offline')));
    expect(reports('u-dr12')[0]).toMatchObject({ report: 'VEHICLE_CHECK', ok: true });
  });

  it('DR-16 store code: only today\'s code matches; confirm saves the POD and goes to the next stop', async () => {
    await signInAs(driver('u-dr16'));
    await saveRunOnPhone();
    params.stop = 'S-1';
    params.units = '8';
    const { dailyStoreCode } = require('@/model/field-reports');
    const { today } = require('@/model/hooks');
    const code: string = dailyStoreCode('OUT-T1', today());
    const Screen = require('@/live/dr-16-store-code-entry').default;
    await render(<Screen />);
    expect(await screen.findByText('OUT-T1')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
    for (const d of code) await fireEvent.press(screen.getByTestId(`key-${d}`));
    expect(await screen.findByTestId('code-match')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L258'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-19-stop-2-arrival-hawa-eliya', { stop: 'S-2' })));
    const pod = queue.list().find(i => i.sub === 'u-dr16' && i.kind === 'POD_SAVE');
    expect(pod?.payload).toMatchObject({ units: 8, unitsOrdered: 10, receiverName: `Store code ${code}` });
    expect(reports('u-dr16')[0]).toMatchObject({ report: 'STORE_CODE', stopId: 'S-1', code });
  });

  it('DR-17 report a problem: a store closed is queued and the driver is back at the stop', async () => {
    await signInAs(driver('u-dr17'));
    await saveRunOnPhone();
    params.stop = 'S-1';
    const Screen = require('@/live/dr-17-report-a-problem').default;
    await render(<Screen />);
    expect(await screen.findByText('Stop 1 · Hill Store')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('problem-STORE_CLOSED'));
    await fireEvent.press(screen.getByTestId('lk-L253'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-02-stop-arrival', { stop: 'S-1' })));
    expect(reports('u-dr17')[0]).toMatchObject({ report: 'PROBLEM', problem: 'STORE_CLOSED', stopId: 'S-1', orderId: 'O-1' });
  });

  it('DR-18 damaged goods: the count is queued and carried back to the POD', async () => {
    await signInAs(driver('u-dr18'));
    await saveRunOnPhone();
    params.stop = 'S-1';
    const Screen = require('@/live/dr-18-problem-detail-damaged-goods').default;
    await render(<Screen />);
    expect(await screen.findByText('Yoghurt cups')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('damage-plus'));
    expect(screen.getByTestId('damage-units').props.children).toBe('2');
    await fireEvent.press(screen.getByTestId('lk-L255'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-03-proof-of-delivery', { stop: 'S-1', damaged: '2', item: 'Yoghurt cups', note: '2 × Yoghurt cups damaged' })));
    expect(reports('u-dr18')[0]).toMatchObject({ report: 'PROBLEM', problem: 'DAMAGED_GOODS', units: 2, photo: false });
  });

  it('DR-37 reefer alert: the typed reading is queued as REEFER_TEMP, then driving mode', async () => {
    await signInAs(driver('u-dr37'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-37-reefer-temperature-alert').default;
    await render(<Screen />);
    expect(await screen.findByText('VAN-T9')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reefer-reading'), '6');
    expect(await screen.findByText('Too warm')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L247'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-36-en-route-driving-mode')));
    expect(reports('u-dr37')[0]).toMatchObject({ report: 'REEFER_TEMP', tempC: 6, action: 'CHECKED_STILL_WARM' });
  });

  it('DR-38 report a delay: reason and minutes for the current stop are queued, then driving mode', async () => {
    await signInAs(driver('u-dr38'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-38-report-a-delay').default;
    await render(<Screen />);
    expect(await screen.findByText('On the way to stop 1 ·')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reason-TRAFFIC'));
    await fireEvent.press(screen.getByTestId('delay-plus'));
    expect(screen.getByTestId('delay-minutes').props.children).toBe('+15');
    await fireEvent.press(screen.getByTestId('lk-L249'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-36-en-route-driving-mode')));
    expect(reports('u-dr38')[0]).toMatchObject({ report: 'DELAY', reason: 'TRAFFIC', minutes: 15, stopId: 'S-1' });
  });
});

describe('Driver reports carry the trip, the stop\'s order and outlet, and a human title', () => {
  it('DR-17 / DR-18 / DR-38 / DR-37 / DR-12 titles and context', async () => {
    await signInAs(driver('u-ctx'));
    const { reportToDispatch, stopContext } = require('@/model/field-reports');
    const s1 = { ...stops[0], outlet };
    await reportToDispatch('T-1', { report: 'PROBLEM', problem: 'STORE_CLOSED', stopId: 'S-1', orderId: 'O-1' }, 'S-1', stopContext(s1, 'VAN-T9'));
    await reportToDispatch('T-1', { report: 'PROBLEM', problem: 'DAMAGED_GOODS', stopId: 'S-1', orderId: 'O-1', units: 2, item: 'Yoghurt cups' }, 'S-1', stopContext(s1, 'VAN-T9'));
    await reportToDispatch('T-1', { report: 'DELAY', reason: 'TRAFFIC', minutes: 15, stopId: 'S-1', orderId: 'O-1' }, 'T-1', stopContext(s1, 'VAN-T9'));
    await reportToDispatch('T-1', { report: 'REEFER_TEMP', tempC: 6, action: 'CHECKED_STILL_WARM' }, 'T-1', { vehicleId: 'VAN-T9' });
    await reportToDispatch('T-1', { report: 'VEHICLE_CHECK', ok: false, items: [{ item: 'Tyres', ok: false }, { item: 'Seal', ok: true }] }, 'T-1', { vehicleId: 'VAN-T9' });
    const all = queue.list().filter(i => i.sub === 'u-ctx');
    expect(all.every(i => i.kind === 'STATUS_CHANGE' && i.tripId === 'T-1')).toBe(true);
    expect(all.map(i => i.payload)).toEqual([
      expect.objectContaining({ report: 'PROBLEM', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', outletName: 'Hill Store', title: 'Store closed at Hill Store' }),
      expect.objectContaining({ report: 'PROBLEM', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', title: 'Damaged goods at Hill Store · 2 × Yoghurt cups damaged' }),
      expect.objectContaining({ report: 'DELAY', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', title: 'Delay of about 15 min · Traffic · before Hill Store' }),
      expect.objectContaining({ report: 'REEFER_TEMP', tripId: 'T-1', vehicleId: 'VAN-T9', title: 'Reefer at 6 °C (above 4 °C) · VAN-T9' }),
      expect.objectContaining({ report: 'VEHICLE_CHECK', tripId: 'T-1', title: 'Pre-trip check: tyres not OK · VAN-T9' }),
    ]);
  });

  it('DR-17 on screen: the queued report names the stop\'s outlet', async () => {
    await signInAs(driver('u-dr17b'));
    await saveRunOnPhone();
    params.stop = 'S-1';
    const Screen = require('@/live/dr-17-report-a-problem').default;
    await render(<Screen />);
    expect(await screen.findByText('Stop 1 · Hill Store')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('problem-ACCESS_BLOCKED'));
    await fireEvent.press(screen.getByTestId('lk-L253'));
    await waitFor(() => expect(reports('u-dr17b')).toHaveLength(1));
    expect(reports('u-dr17b')[0]).toMatchObject({ tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', title: 'Access blocked at Hill Store', vehicleId: 'VAN-T9' });
  });
});

describe('Trip status from the driver: started (ENROUTE) and finished (COMPLETE) through the outbox', () => {
  const statusWrites = (sub: string) => queue.list().filter(i => i.sub === sub && i.kind === 'TRIP_STATUS').map(i => i.payload);

  // Start trip is the design's L12 button (lk-L12)
  it('DR-01 a trip still loading at the dock cannot be started: the driver waits for the release', async () => {
    routes.set('Trips', [{ ...trip, status: 'LOADING' }]);
    await signInAs(driver('u-start'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-01-today-s-run').default;
    await render(<Screen />);
    expect(await screen.findByText('Hill Store')).toBeTruthy();
    expect(screen.getByText('Waiting for the dock to release')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L12'));
    expect(push).not.toHaveBeenCalledWith(opened('dr-36-en-route-driving-mode'));
    expect(statusWrites('u-start')).toEqual([]);
  });

  it('DR-01 a released load not yet accepted on this phone: the handover comes first', async () => {
    await signInAs(driver('u-start2'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-01-today-s-run').default;
    await render(<Screen />);
    expect(await screen.findByText('Review the load')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L12'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-11-load-handover-received', { trip: 'T-1' })));
    expect(statusWrites('u-start2')).toEqual([]);
  });

  it('DR-01 a released load already accepted starts the trip with no status write; the dock set it en route', async () => {
    await signInAs(driver('u-start3'));
    await saveRunOnPhone();
    await require('@/model/run').setRunMark('accepted', 'T-1');
    const Screen = require('@/live/dr-01-today-s-run').default;
    await render(<Screen />);
    expect(await screen.findByText('Start trip')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L12'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-36-en-route-driving-mode')));
    expect(statusWrites('u-start3')).toEqual([]);
  });

  it('DR-04 after the last stop: the trip is set COMPLETE once, and sent as Trips SetStatus', async () => {
    const pod = (id: string, units: number) => ({ id: `P-${id}`, tripStopId: id, unitsDelivered: units, unitsOrdered: units, savedAt: `${RUN}T01:30:00.000Z` });
    routes.set('TripStops', stops.map(s => ({ ...s, status: 'DELIVERED', arrivalActual: `${RUN}T01:00:00.000Z`, leaveActual: `${RUN}T01:20:00.000Z`, pod: pod(s.id, s.order.units) })));
    await signInAs(driver('u-done'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-04-run-complete').default;
    const view = await render(<Screen />);
    expect(await screen.findByText('Trip 1 done')).toBeTruthy();
    await waitFor(() => expect(statusWrites('u-done')).toEqual([{ tripId: 'T-1', status: 'COMPLETE' }]));
    // End shift does not queue it twice
    await fireEvent.press(screen.getByTestId('end-shift'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('dr-28-end-of-shift-summary')));
    expect(statusWrites('u-done')).toHaveLength(1);
    await view.unmount();

    network.set({ online: true, since: new Date().toISOString() });
    const { sync } = require('./fake-platform');
    await sync.flush();
    expect(client.action).toHaveBeenCalledWith("Trips('T-1')/Lodestar.SetStatus", { status: 'COMPLETE' }, expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });

  it('a trip that never went en route is set ENROUTE before COMPLETE (the server completes only en-route trips)', async () => {
    await signInAs(driver('u-fin'));
    const { finishTrip, tripStatusOf } = require('@/model/actions');
    const t = { ...trip, status: 'LOADING' };
    await finishTrip(t);
    expect(statusWrites('u-fin')).toEqual([{ tripId: 'T-1', status: 'ENROUTE' }, { tripId: 'T-1', status: 'COMPLETE' }]);
    expect(tripStatusOf(t, queue.list().filter(i => i.sub === 'u-fin'))).toBe('COMPLETE');
    expect(await finishTrip(t)).toBeNull();
  });

  it('DR-28 Close shift completes finished trips, then signs out to DR-06', async () => {
    routes.set('TripStops', stops.map(s => ({ ...s, status: 'DELIVERED', pod: { id: `P-${s.id}`, tripStopId: s.id, unitsDelivered: s.order.units, unitsOrdered: s.order.units, savedAt: `${RUN}T01:30:00.000Z` } })));
    await signInAs(driver('u-close'));
    await saveRunOnPhone();
    const Screen = require('@/live/dr-28-end-of-shift-summary').default;
    await render(<Screen />);
    expect(await screen.findByText('Shift done')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lk-L22'));
    await waitFor(() => expect(router.replace as jest.Mock).toHaveBeenCalledWith(opened('dr-06-sign-in')));
    expect(statusWrites('u-close')).toEqual([{ tripId: 'T-1', status: 'COMPLETE' }]);
    const { session } = require('./fake-platform');
    expect(session.signedIn).toBe(false);
  });
});
