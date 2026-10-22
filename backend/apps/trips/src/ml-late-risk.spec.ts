import { MlClient } from '@lodestar/platform';
import { modelLateRiskPct } from './ml-late-risk';
import { TripsService } from './trips.service';

const lk = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00+05:30`);

function prismaStub() {
  const trip = {
    id: 'T1', depot: 'PELIYAGODA', runDate: new Date('2026-10-05T00:00:00Z'), departTime: lk('05:00'), district: 'Colombo',
    vehicle: { id: 'VEH001', type: 'TRUCK', tempClass: 'CHILLED', capacityKg: 5000, capacityM3: 26, kmPerLitre: 4.7, weeklyLFuel: 340 },
    stops: [
      { id: 'S1', etaPlan: lk('05:24'), order: { brand: 'FRESH', tempClass: 'CHILLED', units: 10, kg: 90, m3: 0.5, orderedAt: new Date('2026-10-04T09:00:00Z'), deferredYesterday: false },
        outlet: { id: 'OUT001', brand: 'FRESH', district: 'Colombo', dockType: 'STREET', parking: 'VAN_ONLY', mallWindow: null, windowOpen: '05:30', windowClose: '07:30' } },
      { id: 'S2', etaPlan: lk('06:00'), order: { brand: 'FRESH', tempClass: 'AMBIENT', units: 12, kg: 96, m3: 0.6, orderedAt: new Date('2026-10-04T09:00:00Z'), deferredYesterday: true },
        outlet: { id: 'OUT002', brand: 'FRESH', district: 'Colombo', dockType: 'REAR_DOCK', parking: 'NORMAL', mallWindow: null, windowOpen: '05:30', windowClose: '08:00' } },
    ],
  };
  return {
    tripStop: { findUnique: jest.fn().mockResolvedValue({ tripId: 'T1' }), update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })) },
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    districtTravel: { findUnique: jest.fn().mockResolvedValue({ roadClass: 'urban', distKm: 12, depotToDistMin: 24, interStopMin: 8 }) },
    calendar: { findUnique: jest.fn().mockResolvedValue({ monsoon: 1, isPayday: true, festivalRamp: 0.2 }) },
    serviceAllowance: { findMany: jest.fn().mockResolvedValue([{ brand: 'FRESH', dockType: 'STREET', minutes: 16 }, { brand: 'FRESH', dockType: 'REAR_DOCK', minutes: 15 }]) },
  };
}

function mlStub(result: Map<string, any> | null, enabled = true) {
  const ml = new MlClient();
  Object.assign(ml, { baseUrl: enabled ? 'http://ml:8000' : '' });
  const predictStops = jest.spyOn(ml, 'predictStops').mockResolvedValue(result);
  return { ml, predictStops };
}

describe('modelLateRiskPct (Task 1 model on the trip, UpdateLateRisk)', () => {
  it('scores the whole trip in one call, rebuilding the planned legs from the stored plan ETAs', async () => {
    const prisma = prismaStub();
    const { ml, predictStops } = mlStub(new Map([['S2', { stopId: 'S2', lateProb: 0.427 }]]));
    expect(await modelLateRiskPct(prisma as any, ml, 'S2')).toBe(43);
    expect(predictStops).toHaveBeenCalledTimes(1);
    const [rows] = predictStops.mock.calls[0];
    expect(rows.map((r) => [r.stopId, r.seq, r.plannedDepart, r.plannedArrive, r.plannedTravelMin, r.serviceAllowanceMin])).toEqual([
      ['S1', 0, '05:00', '05:24', 24, 16],
      // waits for the 05:30 opening, 16 min allowance: leaves 05:46
      ['S2', 1, '05:46', '06:00', 14, 15],
    ]);
    expect(rows[1]).toMatchObject({ routeId: 'T1', date: '2026-10-05', depot: 'PELIYAGODA', deferred: true, monsoon: 1, isPayday: true, roadClass: 'urban', vehicleTemp: 'CHILLED' });
  });

  it('a van released after its plan had it at the first stop is scored on the moved (stored model) ETAs', async () => {
    const prisma = prismaStub();
    const base = await prismaStub().trip.findUnique();
    prisma.trip.findUnique.mockResolvedValue({
      ...base, departTime: lk('07:24'),
      stops: [{ ...base.stops[0], etaModel: lk('07:48') }, { ...base.stops[1], etaModel: lk('08:24') }],
    });
    const { ml, predictStops } = mlStub(new Map([['S2', { stopId: 'S2', lateProb: 0.9 }]]));
    expect(await modelLateRiskPct(prisma as any, ml, 'S2')).toBe(90);
    const [rows] = predictStops.mock.calls[0];
    expect(rows.map((r) => [r.plannedDepart, r.plannedArrive, r.plannedTravelMin])).toEqual([['07:24', '07:48', 24], ['08:04', '08:24', 20]]);
  });

  it('is null (heuristic) when ML is disabled, fails, or the trip has no planned times', async () => {
    expect(await modelLateRiskPct(prismaStub() as any, mlStub(new Map(), false).ml, 'S1')).toBeNull();
    expect(await modelLateRiskPct(prismaStub() as any, mlStub(null).ml, 'S1')).toBeNull();
    const prisma = prismaStub();
    prisma.trip.findUnique.mockResolvedValue({ ...(await prismaStub().trip.findUnique()), departTime: null });
    const { ml, predictStops } = mlStub(new Map());
    expect(await modelLateRiskPct(prisma as any, ml, 'S1')).toBeNull();
    expect(predictStops).not.toHaveBeenCalled();
  });
});

describe('TripsService.updateLateRisk', () => {
  const service = (prisma: any, ml: MlClient) => new TripsService(prisma, {} as any, {} as any, ml);

  it('stores the reported figure when it is above the model', async () => {
    const prisma = prismaStub();
    await service(prisma, mlStub(new Map([['S1', { stopId: 'S1', lateProb: 0.2 }]])).ml).updateLateRisk('S1', 61);
    expect(prisma.tripStop.update).toHaveBeenCalledWith({ where: { id: 'S1' }, data: { lateRiskPct: 61 } });
  });

  it('keeps the model figure as the floor', async () => {
    const prisma = prismaStub();
    await service(prisma, mlStub(new Map([['S1', { stopId: 'S1', lateProb: 0.55 }]])).ml).updateLateRisk('S1', 10);
    expect(prisma.tripStop.update).toHaveBeenCalledWith({ where: { id: 'S1' }, data: { lateRiskPct: 55 } });
  });

  it('stores the reported figure as given without the model (disabled, down, or an error building the call)', async () => {
    const prisma = prismaStub();
    await service(prisma, mlStub(null).ml).updateLateRisk('S1', 10);
    expect(prisma.tripStop.update).toHaveBeenLastCalledWith({ where: { id: 'S1' }, data: { lateRiskPct: 10 } });
    prisma.trip.findUnique.mockRejectedValue(new Error('db down'));
    await service(prisma, mlStub(new Map()).ml).updateLateRisk('S1', 12);
    expect(prisma.tripStop.update).toHaveBeenLastCalledWith({ where: { id: 'S1' }, data: { lateRiskPct: 12 } });
  });
});
