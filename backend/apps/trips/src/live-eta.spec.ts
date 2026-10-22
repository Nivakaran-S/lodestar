import { anything, capture, instance, mock, when } from 'ts-mockito';
import { NotifyClient } from '@lodestar/security';
import { FleetClient } from './fleet.client';
import { etaShiftMs, liveTripEtas, MIN_FIRST_LEG_MIN, projectTripEtas, windowLateRiskPct, withKeys } from './live-eta';
import { TripsService } from './trips.service';
import { etaClock, TripsSet, TripStopsSet } from './trips.sets';

// The live test of 22 Oct 2026: the plan has the van leave Kandy at 03:30, OUT106 at 03:55 (window 05:30–08:00),
// back at 04:18; the loader releases it at 07:24.
const lk = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00+05:30`);
const RUN = new Date('2026-10-22T00:00:00Z');
const plannedTrip = (over: Record<string, unknown> = {}) => ({
  id: 'T1', status: 'PLANNED', departTime: lk('03:30'), returnTime: lk('04:18'), runDate: RUN,
  stops: [
    { id: 'S1', stopSeq: 1, orderId: 'ORD1', outletId: 'OUT106', status: 'PLANNED', etaPlan: lk('03:50'), etaModel: lk('03:55'),
      etaModelBandEarly: lk('03:45'), etaModelBandLate: lk('04:05'), lateRiskPct: 0, arrivalActual: null, outlet: { windowClose: '08:00' } },
    { id: 'S2', stopSeq: 2, orderId: 'ORD2', outletId: 'OUT108', status: 'PLANNED', etaPlan: lk('04:00'), etaModel: lk('04:05'),
      etaModelBandEarly: null, etaModelBandLate: null, lateRiskPct: 2, arrivalActual: null, outlet: { windowClose: '07:30' } },
  ],
  ...over,
});

describe('windowLateRiskPct', () => {
  it('is near-certain past the window close, high in its last half hour, else the stored figure', () => {
    expect(windowLateRiskPct(lk('08:10'), RUN, '08:00', 2)).toBe(95);
    expect(windowLateRiskPct(lk('07:50'), RUN, '08:00', 2)).toBe(70);
    expect(windowLateRiskPct(lk('07:40'), RUN, '08:00', 2)).toBe(40);
    expect(windowLateRiskPct(lk('06:00'), RUN, '08:00', 2)).toBe(2);
    expect(windowLateRiskPct(lk('06:00'), RUN, '08:00', null)).toBeNull();
    expect(windowLateRiskPct(lk('07:50'), RUN, '08:00', 80)).toBe(80); // the model's higher figure stands
    expect(windowLateRiskPct(lk('09:00'), RUN, null, 5)).toBe(5);
  });
});

describe('etaShiftMs', () => {
  const stops = plannedTrip().stops;
  it('is the departure delay in whole minutes', () => {
    expect(etaShiftMs(stops, lk('07:24').getTime(), lk('07:24').getTime() - lk('03:30').getTime() + 30_000)).toBe(234 * 60_000);
  });
  it('keeps the first stop a first leg after the departure, and ignores under a minute', () => {
    expect(etaShiftMs(stops, lk('03:50').getTime(), 0)).toBe((MIN_FIRST_LEG_MIN - 5) * 60_000); // 03:50 + 15 min is 10 min after the 03:55 ETA
    expect(etaShiftMs(stops, lk('03:30').getTime(), 30_000)).toBe(0);
    expect(etaShiftMs([], lk('09:00').getTime(), 3_600_000)).toBe(0);
  });
});

describe('projectTripEtas (read)', () => {
  it('a trip still at the dock at 07:36 reads as leaving now: ETAs, bands, return and late risk move', () => {
    const eta = projectTripEtas(plannedTrip(), lk('07:36'));
    expect(eta.shiftMs).toBe(246 * 60_000);
    expect(eta.stops.get('S1')).toEqual({ etaModel: lk('08:01'), etaModelBandEarly: lk('07:51'), etaModelBandLate: lk('08:11'), lateRiskPct: 95 });
    expect(eta.stops.get('S2')).toMatchObject({ etaModel: lk('08:11'), etaModelBandEarly: null, lateRiskPct: 95 });
    expect(eta.returnTime).toEqual(lk('08:24'));
  });

  it('a trip not yet due, a complete one and one under way read as stored', () => {
    expect(projectTripEtas(plannedTrip(), lk('03:00')).shiftMs).toBe(0);
    expect(projectTripEtas(plannedTrip({ status: 'COMPLETE' }), lk('07:36')).shiftMs).toBe(0);
    const t = plannedTrip({ status: 'ENROUTE', departTime: lk('03:30') });
    t.stops[0] = { ...t.stops[0], status: 'DELIVERED', arrivalActual: lk('03:58') };
    expect(projectTripEtas(t, lk('07:36')).shiftMs).toBe(0);
  });

  it('en route with nothing reached: no stop before the actual departure plus a first leg', () => {
    const eta = projectTripEtas(plannedTrip({ status: 'ENROUTE', departTime: lk('07:24') }), lk('07:36'));
    expect(eta.stops.get('S1')!.etaModel).toEqual(lk('07:39'));
    expect(eta.stops.get('S1')!.etaModel.getTime()).toBeGreaterThan(lk('07:24').getTime());
    expect(eta.stops.get('S2')!.etaModel).toEqual(lk('07:49'));
  });
});

describe('liveTripEtas', () => {
  it('asks only for trips late at the dock or en route, and skips the ones that read as stored', async () => {
    const findMany = jest.fn().mockResolvedValue([plannedTrip(), plannedTrip({ id: 'T2', status: 'COMPLETE' })]);
    const live = await liveTripEtas({ trip: { findMany } }, ['T1', 'T2', 'T1'], lk('07:36'));
    expect([...live.keys()]).toEqual(['T1']);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ id: { in: ['T1', 'T2'] }, departTime: { not: null } });
    expect(await liveTripEtas({ trip: { findMany } }, [], lk('07:36'))).toEqual(new Map());
  });
});

describe('withKeys', () => {
  it('adds the keys at the top and in the named relations', () => {
    expect(withKeys({ etaModel: true, trip: { select: { departTime: true } } }, ['tripId'], ['trip'])).toEqual({
      etaModel: true, id: true, tripId: true, trip: { select: { departTime: true, id: true } },
    });
    expect(withKeys(undefined, ['tripId'], ['trip'])).toBeUndefined();
  });
});

describe('Trips and TripStops read with live ETAs', () => {
  const now = lk('07:36');
  let realNow: () => Date;
  beforeEach(() => {
    realNow = etaClock.now;
    etaClock.now = () => now;
  });
  afterEach(() => {
    etaClock.now = realNow;
  });

  it('TripStops (SM-02 with $expand=trip): the stop and its trip show the times of leaving now', async () => {
    const prisma = {
      tripStop: { findMany: jest.fn(async () => [{ id: 'S1', tripId: 'T1', etaModel: lk('03:55'), lateRiskPct: 0, trip: { id: 'T1', departTime: lk('03:30'), returnTime: lk('04:18') } }]) },
      trip: { findMany: jest.fn(async () => [plannedTrip()]) },
    };
    const set = new TripStopsSet(prisma as any, {} as any);
    const [row] = await set.findMany({ select: { etaModel: true, lateRiskPct: true, trip: { select: { departTime: true, returnTime: true } } } });
    expect((prisma.tripStop.findMany.mock.calls[0] as any[])[0].select).toMatchObject({ id: true, tripId: true, trip: { select: { id: true } } });
    expect(row).toMatchObject({ etaModel: lk('08:01'), lateRiskPct: 95, trip: { departTime: lk('03:30'), returnTime: lk('08:24') } });
  });

  it('Trips with $expand=stops (driver app, live ops): stops and the return move; nothing is written', async () => {
    const trip = { findMany: jest.fn(async (a: any) => (a.where?.id?.in ? [plannedTrip()] : [{ id: 'T1', returnTime: lk('04:18'), stops: [{ id: 'S2', etaModel: lk('04:05') }] }])), update: jest.fn() };
    const set = new TripsSet({ trip } as any, {} as any);
    const [row] = await set.findMany({ select: { returnTime: true, stops: { select: { etaModel: true } } } });
    expect(row).toMatchObject({ returnTime: lk('08:24'), stops: [{ etaModel: lk('08:11') }] });
    expect(trip.update).not.toHaveBeenCalled();
  });
});

describe('TripsService · a late departure moves the stops (Release, SetStatus ENROUTE)', () => {
  let rows: any[];
  let tripRow: any;
  let notify: NotifyClient;
  let service: TripsService;
  let tripUpdates: any[];

  beforeEach(() => {
    jest.useFakeTimers({ now: lk('07:24') });
    const t = plannedTrip({ status: 'LOADING' });
    rows = t.stops;
    tripRow = t;
    tripUpdates = [];
    const tripStop = {
      findMany: jest.fn(async () => rows.map((r) => ({ orderId: r.orderId }))),
      update: jest.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data)),
      updateMany: jest.fn(async () => ({ count: 2 })),
    };
    const trip = {
      findUnique: jest.fn(async ({ select }: any) => (select.stops ? { ...tripRow, stops: rows } : { status: tripRow.status })),
      update: jest.fn(async (a: any) => {
        tripUpdates.push(a);
        return { ...tripRow, ...a.data, depot: 'KANDY', vehicleId: 'VEH054', driverId: null, bay: 'K2', stops: rows.map((r) => ({ outletId: r.outletId })) };
      }),
    };
    const tx = {
      trip, tripStop, order: { updateMany: jest.fn() },
      loadRecord: { findUnique: jest.fn(async () => ({ tripId: 'T1', vehicleId: 'VEH054' })), update: jest.fn() },
      vehicle: { findUnique: jest.fn(async () => ({ tempClass: 'AMBIENT' })) },
    };
    notify = mock(NotifyClient);
    when(notify.publish(anything(), anything(), anything())).thenResolve(true);
    when(notify.notice(anything())).thenResolve(true);
    service = new TripsService({ ...tx, $transaction: async (fn: any) => fn(tx) } as any, instance(notify), instance(mock(FleetClient)));
  });
  afterEach(() => jest.useRealTimers());

  it('released at 07:24 for a 03:30 departure: stops, bands and return move 3 h 54 min, late risk against the window', async () => {
    await service.release('T1', 'SEAL-1');
    expect(rows[0]).toMatchObject({ etaModel: lk('07:49'), etaModelBandEarly: lk('07:39'), etaModelBandLate: lk('07:59'), lateRiskPct: 70 });
    expect(rows[1]).toMatchObject({ etaModel: lk('07:59'), lateRiskPct: 95 }); // its window closes 07:30
    const last = tripUpdates[tripUpdates.length - 1];
    expect(last.data).toMatchObject({ status: 'ENROUTE', departTime: lk('07:24'), returnTime: lk('08:12') });
    // and no ETA reads earlier than the departure afterwards
    expect(projectTripEtas({ ...tripRow, status: 'ENROUTE', departTime: lk('07:24'), stops: rows }, lk('07:36')).shiftMs).toBe(0);
    // the stores and live ops hear of it
    const updates = Array.from({ length: 10 }, (_, i) => { try { return capture(notify.publish).byCallIndex(i); } catch { return null; } })
      .filter((c): c is any => !!c && c[0] === 'eta_update');
    expect(updates.map((c) => c[1])).toEqual([['store:OUT106', 'trip:T1'], ['store:OUT108', 'trip:T1']]);
    expect(updates[0][2]).toMatchObject({ stopId: 'S1', shiftMin: 234, lateRiskPct: 70, cause: 'DEPARTURE_DELAY' });
  });

  it('released on time: nothing moves', async () => {
    jest.setSystemTime(lk('03:30'));
    await service.release('T1', 'SEAL-1');
    expect(rows[0].etaModel).toEqual(lk('03:55'));
    expect(tripUpdates[tripUpdates.length - 1].data.returnTime).toBeUndefined();
  });

  it('SetStatus ENROUTE without a time departs now and moves the stops the same way', async () => {
    await service.updateStatus('T1', 'LOADING' as any, 'ENROUTE' as any);
    expect(rows[0].etaModel).toEqual(lk('07:49'));
    expect(tripUpdates[0].data).toMatchObject({ status: 'ENROUTE', departTime: lk('07:24'), returnTime: lk('08:12') });
  });
});
