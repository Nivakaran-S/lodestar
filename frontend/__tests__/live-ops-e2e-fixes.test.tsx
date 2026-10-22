// Fixes from the live end-to-end test of 22 Oct 2026: DSP-04's map draws the run even without coordinates, a passed
// pre-trip check is not an exception, yesterday's unread notices are not today's, and DSP-08's timeline never shows
// a notice dated later than now. Date frozen at Thu 22 Oct 2026 6:40 AM (Colombo).
import { screen, waitFor } from '@testing-library/react';
import LiveOps from '@/live/dsp-04-live-operations';
import Today from '@/live/dsp-08-today-overview';
import { fmtNoticeTime, isAlertNotice, noticeWindow } from '@/components/live/plan-data';
import { depotPosition, outletPosition } from '@/components/live/ops-map';
import { freezeDate, unfreeze } from './helpers/clock';
import type { FakeRequest } from './helpers/live';
import { agentConfigReply, page, renderLive } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/plan' }));

const NOW = '2026-10-22T01:10:00.000Z'; // 6:40 AM Colombo
const DAY = '2026-10-22T00:00:00.000Z';

function base(req: FakeRequest) {
  if (agentConfigReply(req)) return agentConfigReply(req);
  if (req.query.$top === '0') return page([], 0);
  if (req.path === 'Orders' && req.query.$select === 'runDate') return page([{ runDate: DAY }]);
  return undefined;
}

const notice = (id: string, payload: Record<string, unknown>, sentAt: string, type = 'DRIVER_REPORT') => ({ id, recipientId: 'u-d', tripId: 'TRK1', type, channel: 'WEBSOCKET', payload, sentAt, readAt: null });
const passed = notice('N1', { report: 'VEHICLE_CHECK', ok: true, tempC: 3.5, vehicleId: 'VEH057', title: 'VEH057 pre-trip check passed', note: 'Reefer 3.5 °C' }, '2026-10-22T00:57:00.000Z');
const failed = notice('N2', { report: 'VEHICLE_CHECK', ok: false, tempC: 50, vehicleId: 'VEH057', title: 'VEH057 pre-trip check failed', note: 'Reefer 50 °C' }, '2026-10-22T00:58:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/plan');
  freezeDate(NOW);
});
afterEach(unfreeze);

describe('notices: alert or information, and of which day', () => {
  it('a passed pre-trip check, a reefer reading within the limit and a store-code delivery are information', () => {
    expect(isAlertNotice(passed)).toBe(false);
    expect(isAlertNotice(failed)).toBe(true);
    expect(isAlertNotice(notice('x', { report: 'VEHICLE_CHECK', ok: true, tempC: 9 }, NOW))).toBe(true);
    expect(isAlertNotice(notice('x', { report: 'REEFER_TEMP', tempC: 3 }, NOW))).toBe(false);
    expect(isAlertNotice(notice('x', { report: 'STORE_CODE' }, NOW))).toBe(false);
    expect(isAlertNotice(notice('x', { report: 'DELAY', minutes: 20 }, NOW))).toBe(true);
    expect(isAlertNotice(notice('x', { report: 'VEHICLE_CHECK', ok: false, severity: 'info' }, NOW))).toBe(false);
    expect(isAlertNotice(notice('x', {}, NOW, 'REEFER_FAIL'))).toBe(true);
    expect(isAlertNotice(notice('x', {}, NOW, 'POD_MATCHED'))).toBe(false);
  });

  it('the window runs over Colombo days; an older notice shows its date', () => {
    expect(noticeWindow('2026-10-22', '2026-10-22')).toBe('sentAt ge 2026-10-21T18:30:00.000Z and sentAt lt 2026-10-22T18:30:00.000Z');
    expect(noticeWindow('2026-10-23', '2026-10-22')).toBe('sentAt ge 2026-10-21T18:30:00.000Z and sentAt lt 2026-10-23T18:30:00.000Z');
    expect(noticeWindow('2026-10-20', '2026-10-22')).toBe('sentAt ge 2026-10-19T18:30:00.000Z and sentAt lt 2026-10-22T18:30:00.000Z');
    expect(fmtNoticeTime('2026-10-22T00:57:00.000Z')).toBe('6:27 AM');
    expect(fmtNoticeTime('2026-10-21T06:55:00.000Z')).toBe('Wed 21 Oct · 12:25 PM');
  });
});

describe('DSP-04 Live operations', () => {
  const trips = [
    {
      id: 'TRK1', vehicleId: 'VEH057', depot: 'KANDY', runDate: DAY, brand: 'FRESH', district: 'Nuwara Eliya', status: 'ENROUTE', planVersion: 1, tripNumber: 1,
      stops: [
        { id: 'S1', tripId: 'TRK1', orderId: 'O1', outletId: 'OUT106', stopSeq: 1, status: 'DELIVERED', lateRiskPct: 0 },
        { id: 'S2', tripId: 'TRK1', orderId: 'O2', outletId: 'OUT108', stopSeq: 2, status: 'PLANNED', lateRiskPct: 10 },
      ],
    },
    {
      id: 'TRK2', vehicleId: 'VEH039', depot: 'KANDY', runDate: DAY, brand: 'FRESH', district: 'Kandy', status: 'COMPLETE', planVersion: 1, tripNumber: 1,
      stops: [{ id: 'S3', tripId: 'TRK2', orderId: 'O3', outletId: 'OUT085', stopSeq: 1, status: 'DELIVERED', lateRiskPct: 0 }],
    },
  ];
  const handler = (req: FakeRequest) => base(req) ?? (
    req.path === 'Trips' ? page(trips)
      // the live registry: no coordinates at all
      : req.path === 'Outlets' ? page([{ id: 'OUT106', name: 'Hawa Eliya', district: 'Nuwara Eliya', lat: null, lng: null }, { id: 'OUT108', district: 'Nuwara Eliya' }])
        : req.path === 'Notifications' ? page([passed, failed])
          : page([]));

  it('draws the routes, depot and van on a schematic when nothing has coordinates', async () => {
    const view = renderLive(<LiveOps />, { handler });
    const map = await screen.findByTestId('ops-map');
    await waitFor(() => expect(map.querySelectorAll('[data-map-trip]')).toHaveLength(2));
    expect(map.querySelector('[data-map-depot="KANDY"]')).not.toBeNull();
    expect(map.querySelectorAll('[data-map-stop]')).toHaveLength(3);
    // the van en route sits at its last stop; the complete trip has none
    expect(map.querySelector('[data-map-van="VEH057"]')).not.toBeNull();
    expect(map.querySelector('[data-map-van="VEH039"]')).toBeNull();
    expect(screen.getByTestId('map-approx')).toHaveTextContent('placed by district');
    await waitFor(() => expect(view.calls.some(c => c.path === 'Outlets')).toBe(true));
    expect(view.calls.find(c => c.path === 'Outlets')!.query.$select).toBe('id,name,district,lat,lng');
  });

  it('lists the failed pre-trip check as an exception, not the passed one, and only notices of the run’s days', async () => {
    const view = renderLive(<LiveOps />, { handler });
    expect(await screen.findByText('VEH057 pre-trip check failed')).toBeInTheDocument();
    expect(screen.queryByText('VEH057 pre-trip check passed')).not.toBeInTheDocument();
    expect(await screen.findByText('1 thing needs you now')).toBeInTheDocument();
    const q = view.calls.find(c => c.path === 'Notifications')!;
    expect(q.query.$filter).toMatch(/^readAt eq null and type in \(.*\) and sentAt ge 2026-10-21T18:30:00.000Z and sentAt lt 2026-10-22T18:30:00.000Z$/);
  });
});

describe('positions without coordinates', () => {
  it('a depot falls back to its known site, an outlet to its district (spread by id), then around the depot', () => {
    expect(depotPosition('KANDY', { lat: null, lng: null, district: 'Kandy' })).toMatchObject({ approx: true });
    expect(depotPosition('X', { lat: 7, lng: 80, district: 'Kandy' })).toEqual({ lat: 7, lng: 80, approx: false });
    expect(depotPosition('X', { lat: null, lng: null, district: 'Atlantis' })).toBeUndefined();
    const a = outletPosition('OUT106', { lat: null, lng: null, district: 'Nuwara Eliya' }, undefined, undefined)!;
    const b = outletPosition('OUT108', { lat: null, lng: null, district: 'Nuwara Eliya' }, undefined, undefined)!;
    expect(a.approx).toBe(true);
    expect(Math.abs(a.lat - 6.97)).toBeLessThan(0.1);
    expect(a).not.toEqual(b);
    expect(outletPosition('OUT1', undefined, 'Nowhere', { lat: 7, lng: 80 })).toMatchObject({ approx: true });
  });
});

describe('DSP-08 Today overview', () => {
  it('“This morning” never shows a notice dated later than now; an older one carries its date', async () => {
    const handler = (req: FakeRequest) => base(req) ?? (
      req.path === 'Plans' && req.query.$select === 'runDate' ? page([{ runDate: DAY }])
        : req.path === 'Notifications' && req.query.$top === '7' ? page([
          { id: 'F', type: 'REEFER_FAIL', sentAt: '2026-10-22T08:26:00.000Z', payload: {} }, // 1:56 PM: later than now
          { id: 'T', type: 'DRIVER_REPORT', sentAt: '2026-10-22T00:57:00.000Z', payload: { vehicleId: 'VEH057' } },
          { id: 'Y', type: 'POD_MATCHED', sentAt: '2026-10-21T06:55:00.000Z', payload: { outletId: 'OUT106' } },
        ])
          : page([]));
    const view = renderLive(<Today />, { handler });
    const times = await screen.findAllByTestId('notice-time');
    expect(times.map(t => t.textContent?.trim())).toEqual(['Wed 21 Oct 12:25', '6:27']);
    expect(screen.getByText('Latest notices')).toBeInTheDocument();
    expect(view.calls.find(c => c.path === 'Notifications' && c.query.$top === '7')!.query.$filter).toBe('sentAt le 2026-10-22T01:10:00.000Z');
  });
});
