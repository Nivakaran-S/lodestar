/* eslint-disable @typescript-eslint/no-require-imports */
// UI fixes from the live end-to-end test of 2026-10-22: dock screens (LD-01, LD-02, LD-03, LD-04, LD-07) and the
// shared vehicle icon. Synthetic fixtures only.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { network } from '@/offline/network';
import { notices } from '@/realtime/notices';
import { tempClassIcon } from '@/lodestar/vehicle-icon';
import { client, routes, signInAs } from './fake-platform';

jest.mock('@/model/platform', () => require('./fake-platform'));
jest.mock('expo-auth-session', () => ({
  useAuthRequest: () => [null, null, jest.fn()],
  makeRedirectUri: () => 'lodestar://auth/callback',
  ResponseType: { Code: 'code' },
  Prompt: { Login: 'login' },
}));

const params = (require('expo-router') as { __params: Record<string, string> }).__params;

const RUN = '2026-04-07';
const outlet = { id: 'OUT-T1', name: 'Hill Store', brand: 'FRESH', district: 'Hills', depot: 'KANDY', dockType: 'REAR', windowOpen: '05:30', windowClose: '08:00', lat: 7.1, lng: 80.7 };
const base = {
  depot: 'KANDY', runDate: `${RUN}T00:00:00.000Z`, brand: 'FRESH', district: 'Hills', status: 'LOADING', planVersion: 2, driver: { id: 'u-dr', name: 'Test Driver' },
};
const trip = {
  ...base, id: 'T-1', vehicleId: 'VAN-T9', tripNumber: 1, bay: 'B2', departTime: `${RUN}T00:10:00.000Z`,
  vehicle: { id: 'VAN-T9', type: 'VAN', tempClass: 'CHILLED', capacityKg: 1000, capacityM3: 10 },
  loadRecord: { id: 'LR-1', tripId: 'T-1', loaderId: 'u-ld', bay: 'B2', shortfalls: [] },
};
// the same dry truck runs two trips today
const dry1 = { ...base, id: 'T-2', vehicleId: 'TRK-D1', tripNumber: 1, bay: 'B3', status: 'PLANNED', departTime: `${RUN}T00:20:00.000Z`, vehicle: { id: 'TRK-D1', type: 'TRUCK', tempClass: 'AMBIENT', capacityKg: 3000, capacityM3: 20 } };
const dry2 = { ...dry1, id: 'T-3', tripNumber: 2, departTime: `${RUN}T04:20:00.000Z` };
const stop = { id: 'S-1', tripId: 'T-1', orderId: 'O-1', outletId: 'OUT-T1', stopSeq: 1, status: 'PLANNED', etaPlan: `${RUN}T00:50:00.000Z`, outlet, order: { id: 'O-1', units: 10, m3: 0.4, kg: 20, tempClass: 'CHILLED', status: 'PLANNED' }, pod: null };
const lines = [{ id: 'L-1', orderId: 'O-1', name: 'Yoghurt cups', qty: 6, kg: 6, tempClass: 'CHILLED' }, { id: 'L-2', orderId: 'O-1', name: 'Milk', qty: 4, kg: 14, tempClass: 'CHILLED' }];
const loader = (sub: string) => ({ sub, name: 'Test Loader', realm_access: { roles: ['loader'] }, depot: ['KANDY'] });

const flat = (c: unknown): string => (Array.isArray(c) ? c.map(flat).join('') : c === null || c === undefined || typeof c === 'boolean' ? '' : typeof c === 'object' ? flat((c as { props?: { children?: unknown } }).props?.children) : String(c));

beforeEach(() => {
  routes.clear();
  for (const k of Object.keys(params)) delete params[k];
  client.action.mockReset();
  client.action.mockResolvedValue({});
  notices.set([]);
  network.set({ online: true, since: new Date().toISOString() });
  routes.set('Trips/Lodestar.BayQueue', [trip, dry1, dry2]);
  routes.set('Trips', [trip]);
  routes.set("Trips('T-1')", trip);
  routes.set('TripStops', [stop]);
  routes.set('OrderLineItems', lines);
});

describe('UI fixes 2026-10-22', () => {
  it('vehicle icon: a snowflake only for a chilled vehicle, a box for a dry one', () => {
    expect(tempClassIcon('CHILLED')).toMatchObject({ chilled: true, color: '#0e7490' });
    expect(tempClassIcon('AMBIENT')).toMatchObject({ chilled: false, color: '#b45309' });
    expect(tempClassIcon('AMBIENT').xml).not.toContain('M12 2v20M4.2 7l15.6 10');
  });

  it('LD-01: a dry truck reads "Dry truck" (not the reefer kind)', async () => {
    await signInAs(loader('u-ld01'));
    const Screen = require('@/live/ld-01-dock-queue').default;
    await render(<Screen />);
    const kinds = await waitFor(() => {
      const all = screen.getAllByTestId(/^bay-row-\d+-kind$/).map(n => flat(n.props.children));
      expect(all.length).toBe(3);
      return all;
    });
    expect(kinds).toEqual(expect.arrayContaining(['Reefer van', 'Dry truck']));
  });

  it('LD-02: the line that flags has an accessible name', async () => {
    await signInAs(loader('u-ld02'));
    params.trip = 'T-1';
    const Screen = require('@/live/ld-02-load-sheet').default;
    await render(<Screen />);
    const flag = await screen.findByLabelText('Flag a problem with Yoghurt cups');
    expect(flag.props.accessibilityRole).toBe('button');
  });

  it('LD-03: the short count reads "1 unit" with a space and the singular', async () => {
    await signInAs(loader('u-ld03'));
    params.trip = 'T-1';
    params.item = 'Milk';
    const Screen = require('@/live/ld-03-flag-shortfall').default;
    await render(<Screen />);
    await waitFor(() => expect(screen.getByTestId('qty-loaded').props.children).toBe('3'));
    expect(screen.getByText(' 1 unit')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('qty-minus'));
    expect(screen.getByText(' 2 units')).toBeTruthy();
  });

  it('LD-07: trips and vehicles are counted apart', async () => {
    await signInAs(loader('u-ld07'));
    const Screen = require('@/live/ld-07-start-shift').default;
    await render(<Screen />);
    await waitFor(() => expect(screen.getByText(/3 trips · 2 vehicles to load/)).toBeTruthy());
  });

  it('LD-04: the reefer stepper starts at a passing reading, and every counted check shows its tick', async () => {
    await signInAs(loader('u-ld04'));
    params.trip = 'T-1';
    const Screen = require('@/live/ld-04-release-vehicle').default;
    await render(<Screen />);
    await waitFor(() => expect(flat(screen.getByTestId('reefer-temp').props.children)).toBe('— °C'));
    await fireEvent.press(screen.getByTestId('reefer-plus'));
    expect(flat(screen.getByTestId('reefer-temp').props.children)).toBe('3 °C');
    expect(screen.getByText('passes')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reefer-plus'));
    expect(flat(screen.getByTestId('reefer-temp').props.children)).toBe('3.5 °C');
    // the driver is assigned: its row carries the tick that the header counts
    expect(screen.getByTestId('driver-check').props.children).toBeTruthy();
  });
});
