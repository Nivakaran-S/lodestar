/* eslint-disable @typescript-eslint/no-require-imports */
// WP7: the dock screens made live from their design boards: pre-cool check (LD-09), scan a line (LD-10), type a
// code (LD-11), bay overview (LD-21) and release checklist (LD-22). Synthetic fixtures only.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { network } from '@/offline/network';
import { notices } from '@/realtime/notices';
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
const outlet = { id: 'OUT-T1', name: 'Hill Store', brand: 'FRESH', district: 'Hills', depot: 'KANDY', dockType: 'REAR', windowOpen: '05:30', windowClose: '08:00', lat: 7.1, lng: 80.7 };
const trip = {
  id: 'T-1', vehicleId: 'VAN-T9', depot: 'KANDY', runDate: `${RUN}T00:00:00.000Z`, brand: 'FRESH', district: 'Hills', status: 'LOADING', planVersion: 2, tripNumber: 1, bay: 'B2',
  departTime: `${RUN}T00:10:00.000Z`, vehicle: { id: 'VAN-T9', type: 'VAN', tempClass: 'CHILLED', capacityKg: 1000, capacityM3: 10 },
  driver: { id: 'u-dr', name: 'Test Driver' },
  loadRecord: { id: 'LR-1', tripId: 'T-1', loaderId: 'u-ld', bay: 'B2', shortfalls: [] },
};
const stop = { id: 'S-1', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', stopSeq: 1, status: 'PLANNED', etaPlan: `${RUN}T00:50:00.000Z`, outlet, order: { id: 'O-1', units: 10, m3: 0.4, kg: 20, tempClass: 'CHILLED', status: 'PLANNED' }, pod: null };
const lines = [{ id: 'L-1', orderId: 'O-1', name: 'Yoghurt cups', qty: 6, kg: 6, tempClass: 'CHILLED' }, { id: 'L-2', orderId: 'O-1', name: 'Milk', qty: 4, kg: 14, tempClass: 'CHILLED' }];
const loader = (sub: string) => ({ sub, name: 'Test Loader', realm_access: { roles: ['loader'] }, depot: ['KANDY'] });

beforeEach(() => {
  routes.clear();
  for (const k of Object.keys(params)) delete params[k];
  push.mockClear();
  client.action.mockReset();
  client.action.mockResolvedValue({});
  notices.set([]);
  network.set({ online: true, since: new Date().toISOString() });
  routes.set('Trips/Lodestar.BayQueue', [trip]);
  routes.set('Trips', [trip]);
  routes.set("Trips('T-1')", trip);
  routes.set('TripStops', [stop]);
  routes.set('OrderLineItems', lines);
});

describe('Dock (WP7)', () => {
  it('LD-09 pre-cool check: the typed reading is queued as PRECOOL and loading starts on the load sheet', async () => {
    await signInAs(loader('u-ld09'));
    params.trip = 'T-1';
    const Screen = require('@/live/ld-09-pre-cool-check').default;
    await render(<Screen />);
    await fireEvent.changeText(await screen.findByTestId('reefer-reading'), '3');
    await fireEvent.press(screen.getByTestId('check-doors'));
    await fireEvent.press(screen.getByTestId('check-floor'));
    await fireEvent.press(screen.getByTestId('lk-L192'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-02-load-sheet', { trip: 'T-1' })));
    expect(queue.list().find(i => i.sub === 'u-ld09' && i.kind === 'PRECOOL')).toMatchObject({ tripId: 'T-1', payload: { tripId: 'T-1', reeferTempC: 3 } });
  });

  it('LD-10 scan a line: the line from LD-03 is matched and confirming opens the release', async () => {
    await signInAs(loader('u-ld10'));
    params.trip = 'T-1';
    params.line = 'L-2';
    const Screen = require('@/live/ld-10-scan-a-line').default;
    await render(<Screen />);
    await waitFor(() => expect(screen.getByTestId('scan-state').props.children).toBe('Matched'));
    await fireEvent.press(screen.getByTestId('lk-L197'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-04-release-vehicle', { trip: 'T-1' })));
  });

  it('the first line checked on a planned trip queues Trips SetStatus LOADING, once per trip', async () => {
    await signInAs(loader('u-ldst'));
    const planned = { ...trip, id: 'T-P', status: 'PLANNED', loadRecord: null };
    routes.set('Trips/Lodestar.BayQueue', [planned]);
    routes.set('Trips', [planned]);
    routes.set("Trips('T-P')", planned);
    routes.set('TripStops', [{ ...stop, tripId: 'T-P' }]);
    params.trip = 'T-P';
    params.line = 'L-1';
    const Screen = require('@/live/ld-10-scan-a-line').default;
    await render(<Screen />);
    await waitFor(() => expect(screen.getByTestId('scan-state').props.children).toBe('Matched'));
    await fireEvent.press(screen.getByTestId('lk-L197'));
    await waitFor(() => expect(queue.list().filter(i => i.sub === 'u-ldst' && i.kind === 'TRIP_STATUS')).toHaveLength(1));
    expect(queue.list().find(i => i.sub === 'u-ldst' && i.kind === 'TRIP_STATUS')).toMatchObject({ tripId: 'T-P', payload: { tripId: 'T-P', status: 'LOADING' } });
    // more lines on the same trip: still one LOADING write
    const { markLoading } = require('@/model/dock');
    expect(await markLoading('T-P')).toBeNull();
    expect(queue.list().filter(i => i.sub === 'u-ldst' && i.kind === 'TRIP_STATUS')).toHaveLength(1);
  });

  it('screens asking at the same moment queue one LOADING and one RELEASE per trip (2026-10-22 duplicates)', async () => {
    await signInAs(loader('u-ldst3'));
    const { markLoading } = require('@/model/dock');
    const { releaseVehicle } = require('@/model/actions');
    // the first tick (no label), the load sheet's effect and the shortfall flag (vehicle label), all within ms
    const marks = await Promise.all([markLoading('T-D'), markLoading('T-D', 'VEH042'), markLoading('T-D', 'VEH042')]);
    expect(marks.filter(Boolean)).toHaveLength(1);
    expect(queue.list().filter(i => i.sub === 'u-ldst3' && i.kind === 'TRIP_STATUS' && i.tripId === 'T-D')).toHaveLength(1);
    // a double tap on Release
    const t = { id: 'T-D', bay: 'B2', vehicleId: 'VEH042' };
    const rel = await Promise.all([releaseVehicle(t, 'S-1', 3), releaseVehicle(t, 'S-1', 3)]);
    expect(rel.filter(Boolean)).toHaveLength(1);
    expect(queue.list().filter(i => i.sub === 'u-ldst3' && i.kind === 'RELEASE' && i.tripId === 'T-D')).toHaveLength(1);
  });

  it('a trip the server already has as LOADING is not set again when a line is checked', async () => {
    await signInAs(loader('u-ldst2'));
    params.trip = 'T-1';
    params.line = 'L-1';
    const Screen = require('@/live/ld-10-scan-a-line').default;
    await render(<Screen />);
    await waitFor(() => expect(screen.getByTestId('scan-state').props.children).toBe('Matched'));
    await fireEvent.press(screen.getByTestId('lk-L197'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-04-release-vehicle', { trip: 'T-1' })));
    expect(queue.list().filter(i => i.sub === 'u-ldst2' && i.kind === 'TRIP_STATUS')).toHaveLength(0);
  });

  it('LD-11 type a code: the keypad code matches a line and confirming opens the release', async () => {
    await signInAs(loader('u-ld11'));
    params.trip = 'T-1';
    const Screen = require('@/live/ld-11-type-a-code').default;
    await render(<Screen />);
    await screen.findByTestId('key-1');
    await fireEvent.press(screen.getByTestId('key-1'));
    await waitFor(() => expect(screen.getByTestId('matched-line').props.children).toBe('Yoghurt cups'));
    await fireEvent.press(screen.getByTestId('lk-L199'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-04-release-vehicle', { trip: 'T-1' })));
  });

  it('LD-21 bay overview: trips by bay, and a bay opens its tablet load sheet', async () => {
    await signInAs(loader('u-ld21'));
    const Screen = require('@/live/ld-21-bay-overview').default;
    await render(<Screen />);
    await fireEvent.press(await screen.findByTestId('bay-T-1'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-02-load-sheet-tablet', { trip: 'T-1' })));
  });

  it('LD-22 release checklist: release waits for a seal, then queues RELEASE and returns to the bays', async () => {
    await signInAs(loader('u-ld22'));
    params.trip = 'T-1';
    const Screen = require('@/live/ld-22-release-checklist').default;
    await render(<Screen />);
    await fireEvent.changeText(await screen.findByTestId('seal-number'), 'SEAL-T-22');
    await fireEvent.press(screen.getByTestId('lk-L225'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(opened('ld-21-bay-overview')));
    expect(queue.list().find(i => i.sub === 'u-ld22' && i.kind === 'RELEASE')).toMatchObject({ tripId: 'T-1', payload: { tripId: 'T-1', sealNumber: 'SEAL-T-22' } });
  });
});
