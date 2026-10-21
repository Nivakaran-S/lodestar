import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { depotDelegate } from '../../../libs/odata/test/depots';
import { NotifyClient } from '@lodestar/security';
import { personas } from '../../../libs/security/test/principals';
import { FleetClient } from './fleet.client';
import { newShortfalls, STOP_TX, TripsService, tripLitres } from './trips.service';
import { LoadRecordsSet, TripsSet, TripStopsSet } from './trips.sets';

interface TravelDelegate {
  findUnique(args: any): Promise<any>;
}
interface TripDelegate {
  findUnique(args: any): Promise<any>;
  findMany(args: any): Promise<any[]>;
  update(args: any): Promise<any>;
}
interface LoadRecordDelegate {
  findUnique(args: any): Promise<any>;
  update(args: any): Promise<any>;
}
interface PodDelegate {
  upsert(args: any): Promise<any>;
}
interface FindManyDelegate {
  findMany(args: any): Promise<any[]>;
}
interface StopDelegate {
  findUnique(args: any): Promise<any>;
}
interface UpdateDelegate {
  update(args: any): Promise<any>;
  findMany(args: any): Promise<any[]>;
  updateMany(args: any): Promise<{ count: number }>;
}

describe('TripsSet', () => {
  let trips: TripsService;
  let set: TripsSet;

  beforeEach(() => {
    trips = mock(TripsService);
    set = new TripsSet({ depot: depotDelegate() } as any, instance(trips));
  });

  it('SetStatus passes the current status from the bound entity', async () => {
    when(trips.updateStatus(anything(), anything(), anything(), anything())).thenResolve({} as any);
    const departTime = new Date('2026-04-07T00:30:00.000Z');
    await set.setStatus({ principal: personas.kasun, params: { status: 'LOADING', departTime }, entity: { id: 'T1', status: 'PLANNED' }, headers: {} });
    verify(trips.updateStatus('T1', 'PLANNED' as any, 'LOADING' as any, departTime)).once();
  });

  describe('Release', () => {
    it.each(['   ', '', undefined, null, 12345])('requires a non-empty string seal number (%p → 400)', (sealNumber) => {
      expect(() => set.release({ principal: personas.kasun, params: { sealNumber }, entity: { id: 'T1' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 400, target: 'sealNumber' }),
      );
      verify(trips.release(anything(), anything(), anything())).never();
    });

    it('delegates with seal and reefer temperature', async () => {
      when(trips.release('T1', 'SEAL-9', 3.5)).thenResolve({ id: 'T1', status: 'ENROUTE' } as any);
      await expect(
        set.release({ principal: personas.kasun, params: { sealNumber: 'SEAL-9', reeferTempC: 3.5 }, entity: { id: 'T1' }, headers: {} }),
      ).resolves.toMatchObject({ status: 'ENROUTE' });
    });
  });

  describe('BayQueue', () => {
    it('refuses a foreign depot', async () => {
      await expect(
        set.bayQueue({ principal: personas.kasun, params: { depot: 'PELIYAGODA', runDate: '2026-04-07' }, rowFilter: {}, headers: {} }),
      ).rejects.toMatchObject({ status: 403 });
      verify(trips.getBayQueue(anything(), anything(), anything())).never();
    });

    it('refuses a depot that is not registered (400)', async () => {
      await expect(
        set.bayQueue({ principal: personas.admin, params: { depot: 'GALLE', runDate: '2026-04-07' }, rowFilter: {}, headers: {} }),
      ).rejects.toMatchObject({ status: 400, target: 'depot' });
    });

    it('passes depot, run date and row filter for the caller depot', async () => {
      const rowFilter = { depot: { in: ['KANDY'] } };
      when(trips.getBayQueue(anything(), anything(), anything())).thenResolve([]);
      await set.bayQueue({ principal: personas.kasun, params: { depot: 'KANDY', runDate: '2026-04-07' }, rowFilter, headers: {} });
      expect(capture(trips.getBayQueue).last()).toEqual(['KANDY', '2026-04-07', rowFilter]);
    });
  });
});

describe('TripStopsSet', () => {
  let trips: TripsService;
  let set: TripStopsSet;

  beforeEach(() => {
    trips = mock(TripsService);
    set = new TripStopsSet({} as any, instance(trips));
  });

  it('CompleteStop delegates with the stop id and entity.orderId', async () => {
    const params = { unitsDelivered: 10, unitsOrdered: 10, receiverName: 'Fathima' };
    when(trips.completeStop(anything(), anything(), anything())).thenResolve({ id: 'S1' } as any);
    await set.completeStop({ principal: personas.ruwan, params, entity: { id: 'S1', orderId: 'ORD1', tripId: 'T1' }, headers: {} });
    verify(trips.completeStop('S1', 'ORD1', deepEqual(params))).once();
  });

  it('Arrive uses the given time or now', async () => {
    when(trips.arrive(anything(), anything())).thenResolve({} as any);
    const t = new Date('2026-04-07T01:00:00.000Z');
    await set.arrive({ principal: personas.ruwan, params: { time: t }, entity: { id: 'S1' }, headers: {} });
    expect(capture(trips.arrive).last()).toEqual(['S1', t]);
    await set.arrive({ principal: personas.ruwan, params: {}, entity: { id: 'S1' }, headers: {} });
    expect(capture(trips.arrive).last()[1]).toBeInstanceOf(Date);
  });

  describe('UpdateLateRisk', () => {
    it.each([-1, 101])('rejects %p with 400', (pct) => {
      expect(() => set.updateLateRisk({ principal: personas.nilanthi, params: { lateRiskPct: pct }, entity: { id: 'S1' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 400 }),
      );
    });

    it.each([0, 61, 100])('accepts %p', async (pct) => {
      when(trips.updateLateRisk('S1', pct)).thenResolve({} as any);
      await set.updateLateRisk({ principal: personas.nilanthi, params: { lateRiskPct: pct }, entity: { id: 'S1' }, headers: {} });
      verify(trips.updateLateRisk('S1', pct)).once();
    });
  });
});

describe('LoadRecordsSet', () => {
  let trips: TripsService;
  let trip: TripDelegate;
  let set: LoadRecordsSet;

  beforeEach(() => {
    trips = mock(TripsService);
    trip = mock<TripDelegate>();
    set = new LoadRecordsSet({ trip: instance(trip) } as any, instance(trips));
  });

  it('sets loaderId from the caller and vehicleId from the trip', async () => {
    when(trip.findUnique(anything())).thenResolve({ vehicleId: 'VEH057', depot: 'KANDY' });
    const data = await set.beforeCreate(
      { tripId: 'T1', bay: 'B2', loaderId: 'someone-else', vehicleId: 'VEH999' },
      { principal: personas.kasun, headers: {} },
    );
    expect(data).toMatchObject({ tripId: 'T1', bay: 'B2', loaderId: 'kasun', vehicleId: 'VEH057' });
    expect(data.loadedAt).toBeInstanceOf(Date);
    expect(capture(trip.findUnique).last()[0]).toMatchObject({ where: { id: 'T1' } });
  });

  it('hides a trip of a foreign depot as 404', async () => {
    when(trip.findUnique(anything())).thenResolve({ vehicleId: 'VEH001', depot: 'PELIYAGODA' });
    await expect(set.beforeCreate({ tripId: 'T9', bay: 'B1' }, { principal: personas.kasun, headers: {} })).rejects.toMatchObject({ status: 404 });
  });

  it('404 for an unknown trip, 400 without tripId/bay', async () => {
    when(trip.findUnique(anything())).thenResolve(null);
    await expect(set.beforeCreate({ tripId: 'T9', bay: 'B1' }, { principal: personas.kasun, headers: {} })).rejects.toMatchObject({ status: 404 });
    await expect(set.beforeCreate({ tripId: 'T9' }, { principal: personas.kasun, headers: {} })).rejects.toMatchObject({ status: 400 });
  });

  it('RecordShortfalls delegates with the trip id and the flagging loader', async () => {
    const shortfalls = [{ item: 'milk', qtyOrdered: 4, qtyLoaded: 3, reason: 'stock' }];
    when(trips.updateShortfalls(anything(), anything(), anything())).thenResolve({} as any);
    await set.recordShortfalls({ principal: personas.kasun, params: { shortfalls }, entity: { id: 'LR1', tripId: 'T1' }, headers: {} });
    expect(capture(trips.updateShortfalls).last()).toEqual(['T1', shortfalls, 'kasun']);
  });

  it('a load record created with flags announces them', async () => {
    const shortfalls = [{ item: 'milk', qtyOrdered: 4, qtyLoaded: 3, reason: 'stock' }];
    const loadRecord = { create: jest.fn(async (a: any) => ({ id: 'LR1', ...a.data })) };
    set = new LoadRecordsSet({ trip: instance(trip), loadRecord } as any, instance(trips));
    await set.create({ tripId: 'T1', bay: 'K2', loaderId: 'kasun', shortfalls }, { principal: personas.kasun, headers: {} });
    verify(trips.announceShortfalls('T1', deepEqual([]), shortfalls, 'kasun')).once();
  });
});

describe('TripsService', () => {
  let txOptions: unknown[] = [];
  let trip: TripDelegate;
  let txTrip: TripDelegate;
  let txLoad: LoadRecordDelegate;
  let txPod: PodDelegate;
  let txOrder: UpdateDelegate;
  let txStop: UpdateDelegate;
  let service: TripsService;
  let notify: NotifyClient;
  let fleet: FleetClient;
  let travel: TravelDelegate;
  let loadRecord: LoadRecordDelegate;
  let tripStop: StopDelegate;
  let user: FindManyDelegate;
  let txVehicleClass: 'AMBIENT' | 'CHILLED' = 'AMBIENT';

  beforeEach(() => {
    trip = mock<TripDelegate>();
    txTrip = mock<TripDelegate>();
    txLoad = mock<LoadRecordDelegate>();
    txPod = mock<PodDelegate>();
    txOrder = mock<UpdateDelegate>();
    txStop = mock<UpdateDelegate>();
    // the vehicle of a release: ambient unless a test says it is a reefer (txVehicleClass)
    txVehicleClass = 'AMBIENT';
    const txVehicle = { findUnique: async () => ({ tempClass: txVehicleClass }) };
    const tx = { trip: instance(txTrip), loadRecord: instance(txLoad), pOD: instance(txPod), order: instance(txOrder), tripStop: instance(txStop), vehicle: txVehicle };
    travel = mock<TravelDelegate>();
    loadRecord = mock<LoadRecordDelegate>();
    tripStop = mock<StopDelegate>();
    user = mock<FindManyDelegate>();
    txOptions = [];
    const prisma = {
      trip: instance(trip), districtTravel: instance(travel), loadRecord: instance(loadRecord), tripStop: instance(tripStop), user: instance(user),
      $transaction: async (cb: (t: any) => any, opts?: unknown) => { txOptions.push(opts); return cb(tx); },
    };
    // the directory: Nilanthi (based at Peliyagoda, covers Kandy) and Fathima, manager of OUT106
    when(user.findMany(anything())).thenCall(async (a: any) =>
      a.where.role === 'DISPATCHER' ? [{ id: 'nilanthi', depot: 'PELIYAGODA' }] : [{ id: 'fathima', outletId: 'OUT106' }].filter((u) => a.where.outletId.in.includes(u.outletId)));
    notify = mock(NotifyClient);
    when(notify.notice(anything())).thenResolve(true);
    when(notify.publish(anything(), anything(), anything())).thenResolve(true);
    fleet = mock(FleetClient);
    when(fleet.recordFuel(anything(), anything(), anything())).thenResolve(true);
    service = new TripsService(prisma as any, instance(notify), instance(fleet));
    for (const d of [trip, txLoad, txOrder, txStop]) when(d.update(anything())).thenCall(async (a: any) => a);
    // a released trip comes back with its stops' outlets (for the stores to tell)
    when(txTrip.update(anything())).thenCall(async (a: any) => ({ ...a, id: 'T1', depot: 'KANDY', vehicleId: 'VEH057', driverId: 'ruwan', bay: 'K2', stops: [{ outletId: 'OUT106' }, { outletId: 'OUT108' }] }));
    when(txStop.findMany(anything())).thenResolve([{ orderId: 'O1' }, { orderId: 'O2' }]);
    for (const d of [txOrder, txStop]) when(d.updateMany(anything())).thenResolve({ count: 2 });
    when(txPod.upsert(anything())).thenResolve({});
    when(txTrip.findUnique(anything())).thenResolve({ status: 'LOADING' });
  });

  describe('updateStatus', () => {
    it.each([
      ['PLANNED', 'LOADING'],
      ['PLANNED', 'ENROUTE'],
      ['LOADING', 'ENROUTE'],
      ['LOADING', 'PLANNED'],
      ['ENROUTE', 'COMPLETE'],
      ['ENROUTE', 'ENROUTE'],
    ])('allows %s → %s', async (from, to) => {
      await service.updateStatus('T1', from as any, to as any);
      expect(capture(trip.update).last()[0]).toMatchObject({ where: { id: 'T1' }, data: { status: to } });
    });

    it.each([
      ['PLANNED', 'COMPLETE'],
      ['ENROUTE', 'PLANNED'],
      ['ENROUTE', 'LOADING'],
      ['COMPLETE', 'ENROUTE'],
      ['COMPLETE', 'PLANNED'],
    ])('refuses %s → %s with 409', async (from, to) => {
      await expect(service.updateStatus('T1', from as any, to as any)).rejects.toMatchObject({ status: 409 });
      verify(trip.update(anything())).never();
    });

    it('stamps returnTime on COMPLETE and keeps an explicit departTime', async () => {
      const departTime = new Date('2026-04-07T00:00:00.000Z');
      await service.updateStatus('T1', 'PLANNED', 'LOADING', departTime);
      expect(capture(trip.update).last()[0].data).toEqual({ status: 'LOADING', departTime });
      await service.updateStatus('T1', 'ENROUTE', 'COMPLETE');
      expect(capture(trip.update).last()[0].data.returnTime).toBeInstanceOf(Date);
    });

    describe('fuel', () => {
      beforeEach(() => {
        // Alpha: 15 km out, 10 min between stops; 3 stops on a 5 km/L truck → (2 × 15 + 2 × 5) / 5 = 8 L
        when(trip.findUnique(anything())).thenResolve({ vehicleId: 'V-T1', district: 'Alpha', vehicle: { kmPerLitre: 5 }, _count: { stops: 3 } });
        when(travel.findUnique(anything())).thenResolve({ district: 'Alpha', distKm: 15, depotToDistMin: 20, interStopMin: 10 });
      });

      it('a completed trip records the litres of its route with fleet', async () => {
        await service.updateStatus('T1', 'ENROUTE', 'COMPLETE');
        verify(fleet.recordFuel('V-T1', 8, 'T1')).once(); // the trip id goes along for the log
        expect(capture(travel.findUnique).last()[0]).toEqual({ where: { district: 'Alpha' } });
      });

      it.each([['PLANNED', 'LOADING'], ['LOADING', 'ENROUTE'], ['COMPLETE', 'COMPLETE']])('records no fuel for %s → %s', async (from, to) => {
        await service.updateStatus('T1', from as any, to as any);
        verify(fleet.recordFuel(anything(), anything(), anything())).never();
      });
    });
  });

  describe('reportVehicleFault (LD-B1)', () => {
    const atDock = { id: 'T1', status: 'LOADING', vehicleId: 'VEH057', depot: 'KANDY', bay: 'K2', stops: [{ outletId: 'OUT106', orderId: 'O1' }] };

    it("sends the vehicle to the workshop in fleet and tells the depot's dispatchers", async () => {
      when(trip.findUnique(anything())).thenResolve(atDock as any);
      when(fleet.setStatus(anything(), anything(), anything(), anything())).thenResolve(true);
      const r = await service.reportVehicleFault('T1', 'NOT_COOLING', 'kasun', 9.5, 'compressor off');
      const [vehicle, status, note, forTrip] = capture(fleet.setStatus).last();
      expect(forTrip).toBe('T1');
      expect([vehicle, status]).toEqual(['VEH057', 'WORKSHOP']);
      expect(note).toBe('Reefer not cooling reported at bay K2 (reefer 9.5 °C): compressor off');
      const [notice] = capture(notify.notice).last();
      expect(notice).toMatchObject({ recipientId: 'nilanthi', type: 'VEHICLE_FAULT', tripId: 'T1', depot: 'KANDY' });
      expect((notice.payload as any)).toMatchObject({ vehicleId: 'VEH057', fault: 'NOT_COOLING', reportedBy: 'kasun', orderIds: ['O1'] });
      verify(notify.publish('vehicle_fault', deepEqual(['dispatcher:KANDY', 'loader:KANDY', 'trip:T1']), anything())).once();
      expect(r).toMatchObject({ vehicleStatus: 'WORKSHOP' });
    });

    it('refuses a trip that has already left the dock', async () => {
      when(trip.findUnique(anything())).thenResolve({ ...atDock, status: 'ENROUTE' } as any);
      await expect(service.reportVehicleFault('T1', 'ENGINE', 'kasun')).rejects.toMatchObject({ status: 409 });
      verify(fleet.setStatus(anything(), anything(), anything(), anything())).never();
      verify(notify.notice(anything())).never();
    });

    it('goes on when fleet timed out but the vehicle is already in the workshop', async () => {
      when(trip.findUnique(anything())).thenResolve(atDock as any, { vehicle: { status: 'WORKSHOP' } } as any);
      when(fleet.setStatus(anything(), anything(), anything(), anything())).thenResolve(false);
      await expect(service.reportVehicleFault('T1', 'NOT_COOLING', 'kasun')).resolves.toMatchObject({ vehicleStatus: 'WORKSHOP' });
      verify(notify.publish('vehicle_fault', anything(), anything())).once();
    });

    it('says so when fleet could not mark the vehicle down, and tells nobody', async () => {
      when(trip.findUnique(anything())).thenResolve(atDock as any);
      when(fleet.setStatus(anything(), anything(), anything(), anything())).thenResolve(false);
      await expect(service.reportVehicleFault('T1', 'DOOR_SEAL', 'kasun')).rejects.toMatchObject({ status: 502, code: 'FleetUnavailable' });
      verify(notify.notice(anything())).never();
    });
  });

  describe('tripLitres', () => {
    it('is the round trip plus the hops between stops, at the vehicle km/L', () => {
      expect(tripLitres({ distKm: 30, depotToDistMin: 40, interStopMin: 12 }, 1, 6)).toBe(10);
      expect(tripLitres({ distKm: null, depotToDistMin: 50, interStopMin: 10 }, 2, 5)).toBe(13); // 2 × 50 × 0.6 + 5 = 65 km
      expect(tripLitres(null, 2, 5)).toBe(0);
      expect(tripLitres({ distKm: 30, depotToDistMin: 40, interStopMin: 12 }, 1, 0)).toBe(0);
    });
  });

  describe('release', () => {
    it.each(['ENROUTE', 'COMPLETE'])('refuses a %s trip with 409 before touching the load record', async (status) => {
      when(txTrip.findUnique(anything())).thenResolve({ status });
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1' });
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409 });
      expect(capture(txTrip.findUnique).last()[0]).toEqual({ where: { id: 'T1' }, select: { status: true } });
      verify(txLoad.update(anything())).never();
      verify(txTrip.update(anything())).never();
    });

    it('refuses a missing trip with 409', async () => {
      when(txTrip.findUnique(anything())).thenResolve(null);
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409 });
      verify(txLoad.findUnique(anything())).never();
    });

    it('releases a PLANNED trip too', async () => {
      when(txTrip.findUnique(anything())).thenResolve({ status: 'PLANNED' });
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1' });
      await expect(service.release('T1', 'SEAL-1')).resolves.toMatchObject({ data: { status: 'ENROUTE' } });
    });

    it('refuses a trip without a load record with 409', async () => {
      when(txLoad.findUnique(anything())).thenResolve(null);
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409 });
      verify(txTrip.update(anything())).never();
    });

    it('sends the open stops and their orders en route and tells the driver, depot and stores (trip_released)', async () => {
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1' });
      const out = await service.release('T1', 'SEAL-1');
      expect(out).not.toHaveProperty('stops');
      expect(capture(txStop.updateMany).last()[0]).toMatchObject({ where: { tripId: 'T1' }, data: { status: 'ENROUTE' } });
      expect(capture(txOrder.updateMany).last()[0]).toEqual({ where: { id: { in: ['O1', 'O2'] } }, data: { status: 'ENROUTE' } });
      expect(capture(notify.notice).last()[0]).toMatchObject({ recipientId: 'ruwan', type: 'TRIP_RELEASED', tripId: 'T1' });
      const [event, rooms, payload] = capture(notify.publish).last();
      expect(event).toBe('trip_released');
      expect(rooms).toEqual(['trip:T1', 'dispatcher:KANDY', 'loader:KANDY', 'driver:ruwan', 'store:OUT106', 'store:OUT108']);
      expect(payload).toMatchObject({ tripId: 'T1', vehicleId: 'VEH057', sealNumber: 'SEAL-1', outlets: ['OUT106', 'OUT108'] });
    });

    it('does not announce a release that was refused', async () => {
      when(txLoad.findUnique(anything())).thenResolve(null);
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409 });
      verify(notify.publish(anything(), anything(), anything())).never();
    });

    it('seals the load record and sends the trip ENROUTE', async () => {
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1' });
      await service.release('T1', 'SEAL-1', 4);
      const lr = capture(txLoad.update).last()[0];
      expect(lr.where).toEqual({ tripId: 'T1' });
      expect(lr.data).toMatchObject({ sealNumber: 'SEAL-1', reeferTempC: 4 });
      const t = capture(txTrip.update).last()[0];
      expect(t.data).toMatchObject({ status: 'ENROUTE', sealNumber: 'SEAL-1', reeferTempC: 4 });
      expect(t.data.departTime).toBe(lr.data.releasedAt);
    });

    it('lets a reefer leave only at or below 4 °C, with the reading sent or the pre-cool one on the load record', async () => {
      txVehicleClass = 'CHILLED';
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1', vehicleId: 'VEH057', reeferTempC: null });
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Read the reefer first/) });
      await expect(service.release('T1', 'SEAL-1', 6.5)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/6.5 °C, above 4 °C/) });
      verify(txTrip.update(anything())).never();
      verify(notify.publish(anything(), anything(), anything())).never();
      await expect(service.release('T1', 'SEAL-1', 4)).resolves.toMatchObject({ data: { status: 'ENROUTE' } });
      // the pre-cool reading recorded at the bay counts when the release carries none
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1', vehicleId: 'VEH057', reeferTempC: 3.2 });
      await expect(service.release('T1', 'SEAL-1')).resolves.toMatchObject({ data: { status: 'ENROUTE' } });
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1', vehicleId: 'VEH057', reeferTempC: 7 });
      await expect(service.release('T1', 'SEAL-1')).rejects.toMatchObject({ status: 409 });
    });

    it('omits the reefer temperature when not given', async () => {
      when(txLoad.findUnique(anything())).thenResolve({ tripId: 'T1' });
      await service.release('T1', 'SEAL-1');
      expect(capture(txTrip.update).last()[0].data).not.toHaveProperty('reeferTempC');
    });
  });

  describe('updateShortfalls (LD-03 flag to dispatch, store and driver)', () => {
    const milk = { item: 'Milk 1L', qtyOrdered: 6, qtyLoaded: 4, reason: 'Out of stock', orderId: 'O1' };
    beforeEach(() => {
      when(loadRecord.update(anything())).thenCall(async (a: any) => ({ id: 'LR1', tripId: 'T1', loaderId: 'kasun', ...a.data }));
      when(trip.findUnique(anything())).thenResolve({
        depot: 'KANDY', vehicleId: 'VEH057', bay: 'K2', driverId: 'ruwan',
        stops: [{ orderId: 'O1', outletId: 'OUT106' }, { orderId: 'O2', outletId: 'OUT108' }],
      });
    });

    it('saves the list and sends SHORTFALL_FLAGGED to the dispatchers, the store of the short order and the driver', async () => {
      when(loadRecord.findUnique(anything())).thenResolve({ shortfalls: [] });
      await service.updateShortfalls('T1', [milk], 'kasun');
      expect(capture(loadRecord.update).last()[0]).toEqual({ where: { tripId: 'T1' }, data: { shortfalls: [milk] } });
      verify(notify.notice(anything())).thrice();
      const notices = [0, 1, 2].map((i) => capture(notify.notice).byCallIndex(i)[0]);
      expect(notices.map((n) => n.recipientId)).toEqual(['nilanthi', 'fathima', 'ruwan']);
      for (const n of notices) {
        expect(n).toMatchObject({ type: 'SHORTFALL_FLAGGED', tripId: 'T1' });
        expect(n.payload).toMatchObject({
          tripId: 'T1', orderId: 'O1', outletId: 'OUT106', item: 'Milk 1L', qtyOrdered: 6, qtyLoaded: 4, short: 2, loaderId: 'kasun', depot: 'KANDY', vehicleId: 'VEH057',
        });
      }
      expect(notices[1].outletId).toBe('OUT106');
    });

    it('announces only new or changed flags (the whole list is sent each time)', async () => {
      when(loadRecord.findUnique(anything())).thenResolve({ shortfalls: [milk] });
      await service.updateShortfalls('T1', [milk], 'kasun');
      verify(notify.notice(anything())).never();
      await service.updateShortfalls('T1', [{ ...milk, qtyLoaded: 3 }], 'kasun');
      verify(notify.notice(anything())).thrice();
      expect(capture(notify.notice).last()[0].payload).toMatchObject({ qtyLoaded: 3, short: 3 });
    });

    it('a flag without an order reaches dispatch and the driver only', async () => {
      when(loadRecord.findUnique(anything())).thenResolve(null);
      await service.updateShortfalls('T1', [{ item: 'Crates', qtyOrdered: 2, qtyLoaded: 0 }]);
      verify(notify.notice(anything())).twice();
      expect(capture(notify.notice).first()[0]).toMatchObject({ recipientId: 'nilanthi', payload: { loaderId: 'kasun', outletId: null } });
    });

    it('newShortfalls ignores malformed and fully loaded lines', () => {
      expect(newShortfalls(null, [milk, { item: 'x' }, { ...milk, item: 'Eggs', qtyLoaded: 6 }, 'junk'])).toEqual([milk]);
    });
  });

  describe('completeStop', () => {
    it('rejects unitsDelivered > unitsOrdered with 400', async () => {
      await expect(service.completeStop('S1', 'ORD1', { unitsDelivered: 11, unitsOrdered: 10 })).rejects.toMatchObject({
        status: 400,
        target: 'unitsDelivered',
      });
      await expect(service.completeStop('S1', 'ORD1', { unitsDelivered: -1, unitsOrdered: 10 })).rejects.toMatchObject({ status: 400 });
      verify(txPod.upsert(anything())).never();
    });

    it('runs the POD in one transaction with room for a remote database (not the 5 s default)', async () => {
      await service.completeStop('S1', 'ORD1', { unitsDelivered: 10, unitsOrdered: 10, receiverName: 'F' });
      expect(txOptions).toContain(STOP_TX);
      expect(STOP_TX.timeout).toBeGreaterThanOrEqual(20_000);
    });

    it('upserts the POD and delivers order and stop', async () => {
      const arrivalActual = new Date('2026-04-07T01:00:00.000Z');
      await service.completeStop('S1', 'ORD1', { unitsDelivered: 8, unitsOrdered: 10, receiverName: 'F', arrivalActual });
      const pod = capture(txPod.upsert).last()[0];
      expect(pod.where).toEqual({ tripStopId: 'S1' });
      expect(pod.create).toMatchObject({ tripStopId: 'S1', unitsDelivered: 8, unitsOrdered: 10, receiverName: 'F' });
      expect(pod.create).not.toHaveProperty('arrivalActual');
      expect(pod.update.syncedAt).toBeInstanceOf(Date);
      expect(capture(txOrder.update).last()[0]).toEqual({ where: { id: 'ORD1' }, data: { status: 'DELIVERED' } });
      const stop = capture(txStop.update).last()[0];
      expect(stop.data).toMatchObject({ status: 'DELIVERED', arrivalActual });
      expect(stop.data.leaveActual).toBeInstanceOf(Date);
    });

    describe('a POD exception or a failed stop reaches the dispatchers and the store', () => {
      beforeEach(() => {
        when(tripStop.findUnique(anything())).thenResolve({ id: 'S1', tripId: 'T1', stopSeq: 2, orderId: 'ORD1', outletId: 'OUT106', trip: { depot: 'KANDY', vehicleId: 'VEH057' } });
      });

      it('a short count is a POD_EXCEPTION', async () => {
        await service.completeStop('S1', 'ORD1', { unitsDelivered: 8, unitsOrdered: 10 });
        verify(notify.notice(anything())).twice();
        const [toDispatch] = capture(notify.notice).first();
        const [toStore] = capture(notify.notice).last();
        expect(toDispatch).toMatchObject({ recipientId: 'nilanthi', type: 'POD_EXCEPTION', tripId: 'T1' });
        expect(toStore).toMatchObject({ recipientId: 'fathima', type: 'POD_EXCEPTION', tripId: 'T1', outletId: 'OUT106' });
        expect(toDispatch.payload).toMatchObject({
          tripId: 'T1', stopId: 'S1', stopSeq: 2, orderId: 'ORD1', outletId: 'OUT106', vehicleId: 'VEH057', unitsDelivered: 8, unitsOrdered: 10, short: 2,
        });
      });

      it('a full count with a recorded exception is a POD_EXCEPTION', async () => {
        const exceptions = [{ type: 'DAMAGED', description: 'tray torn' }];
        await service.completeStop('S1', 'ORD1', { unitsDelivered: 10, unitsOrdered: 10, exceptions });
        expect(capture(notify.notice).last()[0]).toMatchObject({ type: 'POD_EXCEPTION', payload: { short: 0, exceptions } });
      });

      it('nothing delivered is a STOP_FAILED', async () => {
        await service.completeStop('S1', 'ORD1', { unitsDelivered: 0, unitsOrdered: 10 });
        expect(capture(notify.notice).last()[0]).toMatchObject({ type: 'STOP_FAILED', payload: { unitsDelivered: 0 } });
      });

      it('a full, clean delivery tells nobody', async () => {
        await service.completeStop('S1', 'ORD1', { unitsDelivered: 10, unitsOrdered: 10, exceptions: [] });
        verify(notify.notice(anything())).never();
      });
    });
  });

  it('getBayQueue ANDs the day range with the scope', async () => {
    when(trip.findMany(anything())).thenResolve([]);
    const scope = { depot: { in: ['KANDY'] } };
    await service.getBayQueue('KANDY', '2026-04-07', scope as any);
    const where = capture(trip.findMany).last()[0].where;
    expect(where.AND[0]).toEqual({
      depot: 'KANDY',
      runDate: { gte: new Date('2026-04-07T00:00:00.000Z'), lt: new Date('2026-04-08T00:00:00.000Z') },
    });
    expect(where.AND[1]).toBe(scope);
  });

  describe('failed stops and credit units (completeStop)', () => {
    it('nothing delivered: the stop and the order go to EXCEPTION, never DELIVERED (DSP-13)', async () => {
      await service.completeStop('S1', 'ORD1', { unitsDelivered: 0, unitsOrdered: 10 });
      expect(capture(txOrder.update).last()[0]).toEqual({ where: { id: 'ORD1' }, data: { status: 'EXCEPTION' } });
      expect(capture(txStop.update).last()[0].data.status).toBe('EXCEPTION');
    });

    it("a store count made before the POD existed goes onto the new POD with its credit note", async () => {
      when(tripStop.findUnique(anything())).thenResolve({
        id: 'S1', tripId: 'T1', stopSeq: 1, orderId: 'ORD1', outletId: 'OUT106', status: 'ENROUTE', trip: { id: 'T1', depot: 'KANDY', vehicleId: 'VEH057' }, pod: null,
        order: { unitsReceived: 7, unitsExpected: 10, receiptNote: null, receivedBy: 'fathima', receiptSavedAt: new Date('2026-10-05T01:00:00Z'), creditNoteId: 'CN-2610-0001' },
      });
      await service.completeStop('S1', 'ORD1', { unitsDelivered: 10, unitsOrdered: 10 });
      const pod = capture(txPod.upsert).last()[0];
      expect(pod.create.creditNoteId).toBe('CN-2610-0001');
      expect(pod.create.exceptions).toEqual([expect.objectContaining({ type: 'SHORT', source: 'STORE_RECEIPT', qty: 3, unitsReceived: 7, unitsExpected: 10 })]);
    });

    it("the driver's exceptions never drop the store's entry already on the POD", async () => {
      const storeEntry = { type: 'SHORT', source: 'STORE_RECEIPT', qty: 3 };
      when(tripStop.findUnique(anything())).thenResolve({
        id: 'S1', tripId: 'T1', stopSeq: 1, orderId: 'ORD1', outletId: 'OUT106', status: 'DELIVERED', trip: { id: 'T1', depot: 'KANDY', vehicleId: 'VEH057' },
        pod: { exceptions: [storeEntry], creditNoteId: 'CN-2610-0001' }, order: { unitsReceived: 7, unitsExpected: 10 },
      });
      await service.completeStop('S1', 'ORD1', { unitsDelivered: 9, unitsOrdered: 10, exceptions: [{ type: 'DAMAGED', description: 'tray' }] });
      expect(capture(txPod.upsert).last()[0].update.exceptions).toEqual([{ type: 'DAMAGED', description: 'tray' }, storeEntry]);
    });
  });
});

describe('TripsService · live stop progress (stop_arrived, stop_delivered, eta_update)', () => {
  const T = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00+05:30`);
  let rows: any[];
  let notify: NotifyClient;
  let service: TripsService;

  beforeEach(() => {
    rows = [
      { id: 'S1', tripId: 'T1', stopSeq: 1, orderId: 'ORD1', outletId: 'OUT106', status: 'ENROUTE', etaModel: T('06:00'), etaPlan: T('06:00'), serviceMinPredicted: 20, arrivalActual: null, leaveActual: null },
      { id: 'S2', tripId: 'T1', stopSeq: 2, orderId: 'ORD2', outletId: 'OUT108', status: 'ENROUTE', etaModel: T('06:40'), etaPlan: T('06:40'), etaModelBandEarly: T('06:30'), etaModelBandLate: T('06:55') },
    ];
    const tripStop = {
      findUnique: jest.fn(async ({ where }: any) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? { ...r, trip: { id: 'T1', depot: 'KANDY', vehicleId: 'VEH057' }, pod: null, order: null } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.stopSeq > where.stopSeq.gt && !where.status.notIn.includes(r.status))),
      update: jest.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data)),
    };
    const tx = { pOD: { upsert: jest.fn() }, order: { update: jest.fn() }, tripStop };
    notify = mock(NotifyClient);
    when(notify.publish(anything(), anything(), anything())).thenResolve(true);
    when(notify.notice(anything())).thenResolve(true);
    service = new TripsService({ tripStop, user: { findMany: async () => [] }, $transaction: async (fn: any) => fn(tx) } as any, instance(notify), instance(mock(FleetClient)));
  });

  /** The publish calls of one event, in order. */
  const published = (event: string) => {
    const calls: Array<[string, string[], any]> = [];
    for (let i = 0; ; i++) {
      let call: [string, string[], ...unknown[]];
      try {
        call = capture(notify.publish).byCallIndex(i);
      } catch {
        return calls;
      }
      if (call[0] === event) calls.push(call as [string, string[], any]);
    }
  };

  it('Arrive 25 min late: the store and DSP-04 see the arrival, the next store its ETA moved by 25 min', async () => {
    await service.arrive('S1', T('06:25'));
    expect(rows[0]).toMatchObject({ arrivalActual: T('06:25'), status: 'ENROUTE' });
    const [arrived] = published('stop_arrived');
    expect(arrived[1]).toEqual(['store:OUT106', 'dispatcher:KANDY', 'trip:T1']);
    expect(arrived[2]).toMatchObject({ stopId: 'S1', lateMin: 25 });
    const [eta] = published('eta_update');
    expect(eta[1]).toEqual(['store:OUT108', 'trip:T1']);
    expect(eta[2]).toMatchObject({ stopId: 'S2', etaModel: T('07:05').toISOString(), shiftMin: 25 });
    expect(rows[1]).toMatchObject({ etaModel: T('07:05'), etaModelBandEarly: T('06:55'), etaModelBandLate: T('07:20') });
  });

  it('a repeated Arrive does not move the later stops twice', async () => {
    await service.arrive('S1', T('06:25'));
    await service.arrive('S1', T('06:25'));
    expect(rows[1].etaModel).toEqual(T('07:05'));
    expect(published('eta_update')).toHaveLength(1);
  });

  it('CompleteStop: stop_delivered to the store and the depot, and the overrun at the door moves the next stop', async () => {
    await service.arrive('S1', T('06:00'));
    await service.completeStop('S1', 'ORD1', { unitsDelivered: 10, unitsOrdered: 10, leaveActual: T('06:35') }); // 35 min at the door, 20 predicted
    const [delivered] = published('stop_delivered');
    expect(delivered[1]).toEqual(['store:OUT106', 'dispatcher:KANDY', 'trip:T1']);
    expect(delivered[2]).toMatchObject({ stopId: 'S1', status: 'DELIVERED', unitsDelivered: 10, leaveActual: T('06:35').toISOString() });
    expect(rows[1].etaModel).toEqual(T('06:55'));
  });

  it('a failed stop is announced as stop_delivered with status EXCEPTION', async () => {
    await service.completeStop('S1', 'ORD1', { unitsDelivered: 0, unitsOrdered: 10, leaveActual: T('06:20') });
    expect(published('stop_delivered')[0][2]).toMatchObject({ status: 'EXCEPTION' });
  });

  it('404 for an unknown stop', async () => {
    await expect(service.arrive('S9', T('06:00'))).rejects.toMatchObject({ status: 404 });
  });
});
