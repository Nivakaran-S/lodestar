import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { depotDelegate } from '../../../libs/odata/test/depots';
import { DevicePostureService, JwtVerifier, Principal } from '@lodestar/security';
import { personas, principal } from '../../../libs/security/test/principals';
import { canonicalRoom, NotificationsGateway } from './notifications.gateway';
import { noticeSeverity, NotificationsService } from './notifications.service';
import { NotificationsSet } from './notifications.set';

interface FindUniqueDelegate {
  findUnique(a: any): Promise<any>;
}
interface NotificationDelegate {
  create(a: any): Promise<any>;
  update(a: any): Promise<any>;
}
interface FindManyDelegate {
  findMany(a: any): Promise<any[]>;
}

describe('NotificationsSet', () => {
  let service: NotificationsService;
  let user: FindUniqueDelegate;
  let set: NotificationsSet;

  beforeEach(() => {
    service = mock(NotificationsService);
    user = mock<FindUniqueDelegate>();
    set = new NotificationsSet({ user: instance(user), depot: depotDelegate() } as any, instance(service));
    when(user.findUnique(anything())).thenResolve({ id: 'fathima' });
    when(service.send(anything())).thenResolve({ id: 'N1' } as any);
  });

  describe('Send', () => {
    it('refuses an unknown recipient with 400', async () => {
      when(user.findUnique(anything())).thenResolve(null);
      await expect(set.send({ principal: personas.agent, params: { recipientId: 'ghost', type: 'ETA_UPDATE' }, headers: {} })).rejects.toMatchObject({
        status: 400,
        target: 'recipientId',
      });
      verify(service.send(anything())).never();
    });

    it.each(['eta_update', 'ET', 'ETA-UPDATE', '1ETA', 'A'.repeat(42)])('refuses type %p with 400', async (type) => {
      await expect(set.send({ principal: personas.agent, params: { recipientId: 'fathima', type }, headers: {} })).rejects.toMatchObject({
        status: 400,
        target: 'type',
      });
      verify(service.send(anything())).never();
    });

    describe('depot scoping for dispatchers', () => {
      const kandyOnly = { ...personas.nilanthi, depots: ['KANDY'] };

      it('lets a dispatcher notify a recipient of her depot', async () => {
        when(user.findUnique(anything())).thenResolve({ id: 'kasun', depot: 'KANDY' });
        await set.send({ principal: kandyOnly, params: { recipientId: 'kasun', type: 'SHORTFALL_ACK', depot: 'KANDY' }, headers: {} });
        verify(service.send(anything())).once();
        expect(capture(user.findUnique).last()[0]).toEqual({ where: { id: 'kasun' }, select: { id: true, depot: true } });
      });

      it('403 for a recipient outside her depots (or without a depot)', async () => {
        when(user.findUnique(anything())).thenResolve({ id: 'x', depot: 'PELIYAGODA' }, { id: 'y', depot: null });
        for (let i = 0; i < 2; i++) {
          await expect(set.send({ principal: kandyOnly, params: { recipientId: 'x', type: 'SHORTFALL_ACK' }, headers: {} })).rejects.toMatchObject({
            status: 403,
            target: 'recipientId',
          });
        }
        verify(service.send(anything())).never();
      });

      it('403 for a depot room outside her depots', async () => {
        when(user.findUnique(anything())).thenResolve({ id: 'kasun', depot: 'KANDY' });
        await expect(
          set.send({ principal: kandyOnly, params: { recipientId: 'kasun', type: 'REEFER_FAIL', depot: 'PELIYAGODA' }, headers: {} }),
        ).rejects.toMatchObject({ status: 403, target: 'depot' });
        verify(service.send(anything())).never();
      });

      it('privileged callers are not depot-scoped', async () => {
        when(user.findUnique(anything())).thenResolve({ id: 'x', depot: 'PELIYAGODA' });
        await set.send({ principal: personas.admin, params: { recipientId: 'x', type: 'REEFER_FAIL', depot: 'PELIYAGODA' }, headers: {} });
        await set.send({ principal: personas.agent, params: { recipientId: 'x', type: 'REEFER_FAIL', depot: 'KANDY' }, headers: {} });
        verify(service.send(anything())).twice();
      });
    });

    it('delegates a valid notification', async () => {
      const params = { recipientId: 'fathima', type: 'ETA_UPDATE', tripId: 'T1', outletId: 'OUT106', payload: { eta: '06:10' } };
      await expect(set.send({ principal: personas.agent, params, headers: {} })).resolves.toEqual({ id: 'N1' });
      verify(service.send(deepEqual(params))).once();
      expect(capture(user.findUnique).last()[0]).toMatchObject({ where: { id: 'fathima' } });
    });
  });

  describe('MarkRead', () => {
    it('returns the entity unchanged when already read', async () => {
      const entity = { id: 'N1', readAt: new Date('2026-04-07T01:00:00Z') };
      expect(await set.markRead({ principal: personas.fathima, params: {}, entity, headers: {} })).toBe(entity);
      verify(service.markRead(anything())).never();
    });

    describe('a dispatcher marking a dock flag handled acknowledges it (LD-03, DSP-13)', () => {
      const flag = { id: 'N7', type: 'SHORTFALL_FLAGGED', tripId: 'T1', readAt: null, payload: { loaderId: 'kasun', item: 'Milk 1L', depot: 'KANDY' } };
      beforeEach(() => {
        when(service.markRead('N7')).thenResolve({ ...flag, readAt: new Date() } as any);
        when(service.acknowledgeShortfall(anything(), anything())).thenResolve();
      });

      it('acknowledges as the dispatcher', async () => {
        await set.markRead({ principal: personas.nilanthi, params: {}, entity: flag, headers: {} });
        const [read, by] = capture(service.acknowledgeShortfall).last();
        expect(read).toMatchObject({ id: 'N7', type: 'SHORTFALL_FLAGGED' });
        expect(by).toEqual({ sub: 'nilanthi', name: personas.nilanthi.name });
      });

      it('a store manager reading their copy acknowledges nothing', async () => {
        await set.markRead({ principal: personas.fathima, params: {}, entity: flag, headers: {} });
        verify(service.acknowledgeShortfall(anything(), anything())).never();
      });

      it('other notices acknowledge nothing', async () => {
        when(service.markRead('N8')).thenResolve({ id: 'N8', type: 'POD_EXCEPTION', readAt: new Date() } as any);
        await set.markRead({ principal: personas.nilanthi, params: {}, entity: { id: 'N8', readAt: null }, headers: {} });
        verify(service.acknowledgeShortfall(anything(), anything())).never();
      });
    });

    it('marks an unread notification', async () => {
      when(service.markRead('N1')).thenResolve({ id: 'N1', readAt: new Date() } as any);
      await set.markRead({ principal: personas.fathima, params: {}, entity: { id: 'N1', readAt: null }, headers: {} });
      verify(service.markRead('N1')).once();
    });
  });
});

describe('NotificationsSet · Publish', () => {
  let service: NotificationsService;
  let set: NotificationsSet;
  beforeEach(() => {
    service = mock(NotificationsService);
    set = new NotificationsSet({ depot: depotDelegate() } as any, instance(service));
    when(service.publish(anything(), anything(), anything())).thenCall((event: string, rooms: string[]) => ({ event, rooms }));
  });
  const call = (params: Record<string, unknown>) => set.publish({ principal: personas.agent, params, headers: {} } as any);

  it('emits a realtime event the clients listen for to the given rooms', () => {
    expect(call({ event: 'plan_published', rooms: ['dispatcher:KANDY', 'store:OUT106'], payload: { planId: 'P1' } })).toEqual({
      event: 'plan_published',
      rooms: ['dispatcher:KANDY', 'store:OUT106'],
    });
    expect(capture(service.publish).last()).toEqual(['plan_published', ['dispatcher:KANDY', 'store:OUT106'], { planId: 'P1' }]);
  });

  it.each([
    [{ event: 'PlanPublished', rooms: ['dispatcher:KANDY'] }, 'event'],
    [{ event: 'plan_published', rooms: [] }, 'rooms'],
    [{ event: 'plan_published', rooms: ['everyone'] }, 'rooms'],
    [{ event: 'plan_published', rooms: ['store:OUT106; drop'] }, 'rooms'],
  ])('refuses %p with 400', (params, target) => {
    expect(() => call(params)).toThrow(expect.objectContaining({ status: 400, target }));
    verify(service.publish(anything(), anything(), anything())).never();
  });
});

describe('NotificationsService', () => {
  let notification: NotificationDelegate;
  let gateway: NotificationsGateway;
  let service: NotificationsService;
  const row = { id: 'N1' };

  beforeEach(() => {
    notification = mock<NotificationDelegate>();
    gateway = mock(NotificationsGateway);
    service = new NotificationsService({ notification: instance(notification) } as any, instance(gateway));
    when(notification.create(anything())).thenResolve(row);
    when(notification.update(anything())).thenCall(async (a: any) => a);
  });

  it('publishes an event to each room once, with depot rooms upper-cased', () => {
    service.publish('trip_released', ['dispatcher:kandy', 'trip:T1', 'trip:T1'], { tripId: 'T1' });
    verify(gateway.emit('dispatcher:KANDY', 'trip_released', anything())).once();
    verify(gateway.emit('trip:T1', 'trip_released', anything())).once();
  });

  it('stores a WEBSOCKET notification and emits to the recipient room', async () => {
    const res = await service.send({ recipientId: 'fathima', type: 'POD_MATCHED', tripId: 'T1' });
    expect(res).toBe(row);
    expect(capture(notification.create).last()[0]).toEqual({
      data: { recipientId: 'fathima', tripId: 'T1', type: 'POD_MATCHED', channel: 'WEBSOCKET', payload: {} },
    });
    verify(gateway.emit('user:fathima', 'notification', row)).once();
    verify(gateway.dispatcherAlert(anything(), anything(), anything())).never();
  });

  it('routes BLACKOUT_DETECTED and SIGNAL_BACK to the depot', async () => {
    const payload = { vehicleId: 'VEH057' };
    await service.send({ recipientId: 'nilanthi', type: 'BLACKOUT_DETECTED', depot: 'KANDY', payload });
    await service.send({ recipientId: 'nilanthi', type: 'SIGNAL_BACK', depot: 'KANDY', payload });
    verify(gateway.blackout('KANDY', payload, deepEqual([]))).once();
    verify(gateway.blackoutResolved('KANDY', payload, deepEqual([]))).once();
    await service.send({ recipientId: 'nilanthi', type: 'BLACKOUT_DETECTED', payload });
    verify(gateway.blackout(anything(), anything(), anything())).once();
  });

  describe('signal lost / back also reaches the stores still waiting on the trip (SM-A1)', () => {
    let tripStop: FindManyDelegate;
    beforeEach(() => {
      tripStop = mock<FindManyDelegate>();
      when(tripStop.findMany(anything())).thenResolve([{ outletId: 'OUT106' }, { outletId: 'OUT108' }, { outletId: 'OUT106' }]);
      service = new NotificationsService({ notification: instance(notification), tripStop: instance(tripStop) } as any, instance(gateway));
    });

    it("passes the trip's undelivered stores to the gateway", async () => {
      const payload = { vehicleId: 'VEH057', tripId: 'T1' };
      await service.send({ recipientId: 'nilanthi', type: 'BLACKOUT_DETECTED', depot: 'KANDY', tripId: 'T1', payload });
      await service.send({ recipientId: 'nilanthi', type: 'SIGNAL_BACK', depot: 'KANDY', tripId: 'T1', payload });
      verify(gateway.blackout('KANDY', payload, deepEqual(['OUT106', 'OUT108']))).once();
      verify(gateway.blackoutResolved('KANDY', payload, deepEqual(['OUT106', 'OUT108']))).once();
      expect(capture(tripStop.findMany).last()[0]).toEqual({
        where: { tripId: 'T1', status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        select: { outletId: true },
      });
    });

    it('tells the stores even without a depot', async () => {
      await service.send({ recipientId: 'fathima', type: 'BLACKOUT_DETECTED', tripId: 'T1', payload: {} });
      verify(gateway.blackout(undefined, anything(), deepEqual(['OUT106', 'OUT108']))).once();
    });
  });

  describe('acknowledgeShortfall', () => {
    const flag = { id: 'N7', type: 'SHORTFALL_FLAGGED', tripId: 'T1', payload: { loaderId: 'kasun', item: 'Milk 1L', orderId: 'O1', depot: 'KANDY', vehicleId: 'VEH057' } } as any;

    it("sends SHORTFALL_ACK to the loader who flagged it and shortfall_ack to the depot's loaders and the trip", async () => {
      await service.acknowledgeShortfall(flag, { sub: 'nilanthi', name: 'Nilanthi Perera' });
      const created = capture(notification.create).last()[0].data;
      expect(created).toMatchObject({ recipientId: 'kasun', type: 'SHORTFALL_ACK', tripId: 'T1' });
      expect(created.payload).toMatchObject({ tripId: 'T1', item: 'Milk 1L', orderId: 'O1', by: 'Nilanthi Perera', byId: 'nilanthi' });
      verify(gateway.emit('user:kasun', 'notification', anything())).once();
      verify(gateway.emit('loader:KANDY', 'shortfall_ack', anything())).once();
      verify(gateway.emit('trip:T1', 'shortfall_ack', anything())).once();
      expect(capture(gateway.emit).last()[2]).toMatchObject({ item: 'Milk 1L', by: 'Nilanthi Perera' });
    });

    describe("one acknowledgement resolves every dispatcher's copy of the flag", () => {
      let siblings: { findMany: jest.Mock; updateMany: jest.Mock };
      beforeEach(() => {
        siblings = {
          findMany: jest.fn(async () => [
            { id: 'N8', recipientId: 'kandy-dispatcher', payload: { ...flag.payload } }, // the same flag, another dispatcher
            { id: 'N9', recipientId: 'kandy-dispatcher', payload: { ...flag.payload, item: 'Yoghurt 80g' } }, // another flag
          ]),
          updateMany: jest.fn(async () => ({ count: 1 })),
        };
        const prisma = { notification: { create: instance(notification).create, update: instance(notification).update, ...siblings } };
        service = new NotificationsService(prisma as any, instance(gateway));
      });

      it("marks the other dispatchers' unread copies read and tells them (shortfall_ack)", async () => {
        await service.acknowledgeShortfall(flag, { sub: 'nilanthi', name: 'Nilanthi Perera' });
        expect(siblings.findMany).toHaveBeenCalledWith({
          where: { type: 'SHORTFALL_FLAGGED', tripId: 'T1', readAt: null, id: { not: 'N7' }, recipient: { role: 'DISPATCHER' } },
          select: { id: true, recipientId: true, payload: true },
        });
        expect(siblings.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['N8'] }, readAt: null }, data: { readAt: expect.any(Date) } });
        verify(gateway.emit('user:kandy-dispatcher', 'shortfall_ack', anything())).once();
        verify(gateway.emit('dispatcher:KANDY', 'shortfall_ack', anything())).once();
        expect(capture(gateway.emit).last()[2]).toMatchObject({ flagIds: ['N7', 'N8'] });
      });

      it('with no other copies it marks nothing', async () => {
        siblings.findMany.mockResolvedValue([]);
        await service.acknowledgeShortfall(flag, { sub: 'nilanthi' });
        expect(siblings.updateMany).not.toHaveBeenCalled();
      });
    });

    it('without a loader on record it still tells the dock', async () => {
      await service.acknowledgeShortfall({ ...flag, payload: { ...flag.payload, loaderId: undefined } }, { sub: 'nilanthi' });
      verify(notification.create(anything())).never();
      verify(gateway.emit('loader:KANDY', 'shortfall_ack', anything())).once();
    });
  });

  it('routes CREDIT_NOTE_ISSUED to the store only with outlet and credit note', async () => {
    await service.send({ recipientId: 'fathima', type: 'CREDIT_NOTE_ISSUED', outletId: 'OUT106', creditNoteId: 'CN1', payload: { amount: 10 } });
    verify(gateway.creditNoteIssued('OUT106', 'CN1', deepEqual({ amount: 10 }))).once();
    await service.send({ recipientId: 'fathima', type: 'CREDIT_NOTE_ISSUED', outletId: 'OUT106' });
    verify(gateway.creditNoteIssued(anything(), anything(), anything())).once();
  });

  it('routes ETA_UPDATE to trip and store', async () => {
    await service.send({ recipientId: 'fathima', type: 'ETA_UPDATE', tripId: 'T1', outletId: 'OUT106', payload: { eta: 'x' } });
    verify(gateway.etaUpdate('T1', 'OUT106', deepEqual({ eta: 'x' }))).once();
  });

  it('routes other types with a depot as a dispatcher alert', async () => {
    await service.send({ recipientId: 'nilanthi', type: 'REEFER_FAIL', depot: 'KANDY', payload: { t: 9 } });
    verify(gateway.dispatcherAlert('KANDY', 'REEFER_FAIL', deepEqual({ t: 9 }))).once();
  });

  describe('driver reports carry a severity: only failures are alerts (DSP-04, DSP-08, DSP-13)', () => {
    it.each([
      [{ report: 'VEHICLE_CHECK', ok: true, tempC: 3.5 }, 'info'],
      [{ report: 'VEHICLE_CHECK', ok: false, tempC: 50 }, 'alert'],
      [{ report: 'VEHICLE_CHECK', ok: true, items: [{ item: 'Tyres', ok: false }] }, 'alert'],
      [{ report: 'VEHICLE_CHECK', ok: true, tempC: 9 }, 'alert'],
      [{ report: 'VEHICLE_CHECK', ok: true, tempC: 5, limitC: 8 }, 'info'],
      [{ report: 'REEFER_TEMP', tempC: 3 }, 'info'],
      [{ report: 'STORE_CODE' }, 'info'],
      [{ report: 'PROBLEM', problem: 'DAMAGED_GOODS' }, 'alert'],
      [{ report: 'DELAY', minutes: 20 }, 'alert'],
      [{ report: 'VEHICLE_CHECK', ok: false, severity: 'info' }, 'info'],
    ])('%j is %s', (payload, severity) => {
      expect(noticeSeverity('DRIVER_REPORT', payload)).toBe(severity);
    });

    it('other types have none', () => {
      expect(noticeSeverity('REEFER_FAIL', { tempC: 9 })).toBeUndefined();
      expect(noticeSeverity('POD_MATCHED', undefined)).toBeUndefined();
    });

    it('is stored on the notice', async () => {
      await service.send({ recipientId: 'nilanthi', type: 'DRIVER_REPORT', tripId: 'T1', payload: { report: 'VEHICLE_CHECK', ok: true } });
      expect(capture(notification.create).last()[0].data.payload).toEqual({ report: 'VEHICLE_CHECK', ok: true, severity: 'info' });
    });
  });

  it('markRead stamps readAt', async () => {
    const res: any = await service.markRead('N1');
    expect(res.where).toEqual({ id: 'N1' });
    expect(res.data.readAt).toBeInstanceOf(Date);
  });
});

describe('NotificationsGateway', () => {
  let verifier: JwtVerifier;
  let posture: DevicePostureService;
  let trip: FindUniqueDelegate;
  let gateway: NotificationsGateway;

  beforeEach(() => {
    verifier = mock(JwtVerifier);
    posture = mock(DevicePostureService);
    trip = mock<FindUniqueDelegate>();
    gateway = new NotificationsGateway(instance(verifier), instance(posture), { trip: instance(trip) } as any);
    when(trip.findUnique(anything())).thenResolve({ depot: 'KANDY', vehicleId: 'VEH057', stops: [{ outletId: 'OUT106' }] });
    when(posture.check(anything(), anything())).thenResolve(undefined as any);
  });

  describe('roomAllowed', () => {
    it('admins may join any well-formed room', async () => {
      expect(await gateway.roomAllowed(personas.admin, 'dispatcher:PELIYAGODA')).toBe(true);
      expect(await gateway.roomAllowed(personas.admin, 'store:OUT999')).toBe(true);
      expect(await gateway.roomAllowed(personas.admin, 'nocolon')).toBe(false);
    });

    it('dispatchers join their depot rooms only', async () => {
      const kandyOnly = { ...personas.nilanthi, depots: ['KANDY'] };
      expect(await gateway.roomAllowed(kandyOnly, 'dispatcher:KANDY')).toBe(true);
      expect(await gateway.roomAllowed(kandyOnly, 'dispatcher:kandy')).toBe(true);
      expect(await gateway.roomAllowed(kandyOnly, 'dispatcher:PELIYAGODA')).toBe(false);
      expect(await gateway.roomAllowed(personas.kasun, 'dispatcher:KANDY')).toBe(false);
    });

    it('loaders join their depot loader room', async () => {
      expect(await gateway.roomAllowed(personas.kasun, 'loader:KANDY')).toBe(true);
      expect(await gateway.roomAllowed(personas.kasun, 'loader:PELIYAGODA')).toBe(false);
    });

    it('store managers join only their own outlet room', async () => {
      expect(await gateway.roomAllowed(personas.fathima, 'store:OUT106')).toBe(true);
      expect(await gateway.roomAllowed(personas.fathima, 'store:OUT108')).toBe(false);
      expect(await gateway.roomAllowed(personas.nilanthi, 'store:OUT106')).toBe(false);
    });

    it('driver and user rooms only for self', async () => {
      expect(await gateway.roomAllowed(personas.ruwan, 'driver:ruwan')).toBe(true);
      expect(await gateway.roomAllowed(personas.ruwan, 'driver:kasun')).toBe(false);
      expect(await gateway.roomAllowed(personas.ruwan, 'user:kasun')).toBe(false);
    });

    it('trip rooms check the vehicle, outlet stops or depot', async () => {
      expect(await gateway.roomAllowed(personas.ruwan, 'trip:T1')).toBe(true);
      expect(await gateway.roomAllowed({ ...personas.ruwan, vehicleId: 'VEH001' }, 'trip:T1')).toBe(false);
      expect(await gateway.roomAllowed(personas.fathima, 'trip:T1')).toBe(true);
      expect(await gateway.roomAllowed({ ...personas.fathima, outletId: 'OUT108' }, 'trip:T1')).toBe(false);
      expect(await gateway.roomAllowed(personas.nilanthi, 'trip:T1')).toBe(true);
      expect(await gateway.roomAllowed({ ...personas.nilanthi, depots: ['PELIYAGODA'] }, 'trip:T1')).toBe(false);
      expect(await gateway.roomAllowed(personas.agent, 'trip:T1')).toBe(true);
      expect(capture(trip.findUnique).last()[0]).toMatchObject({ where: { id: 'T1' } });
    });

    it('unknown trips and unknown room kinds are denied', async () => {
      when(trip.findUnique(anything())).thenResolve(null);
      expect(await gateway.roomAllowed(personas.nilanthi, 'trip:NOPE')).toBe(false);
      expect(await gateway.roomAllowed(personas.nilanthi, 'admin:all')).toBe(false);
    });
  });

  describe('handleConnection', () => {
    function fakeSocket(handshake: any) {
      const rooms = new Set<string>(['sock-1']);
      const socket = {
        id: 'sock-1',
        handshake,
        data: {} as any,
        rooms,
        joined: [] as string[],
        emitted: [] as [string, any][],
        disconnected: undefined as boolean | undefined,
        join(room: string) {
          this.joined.push(room);
          rooms.add(room);
        },
        emit(event: string, payload: any) {
          this.emitted.push([event, payload]);
          return true;
        },
        disconnect(close?: boolean) {
          this.disconnected = close;
        },
      };
      return socket;
    }

    it('disconnects a client without a token', async () => {
      const s = fakeSocket({ auth: {}, headers: {}, query: {} });
      await gateway.handleConnection(s as any);
      expect(s.disconnected).toBe(true);
      expect(s.emitted[0][0]).toBe('unauthorized');
      expect(s.joined).toEqual([]);
      verify(verifier.verify(anything())).never();
    });

    it('disconnects when the token or device posture fails', async () => {
      when(verifier.verify('bad')).thenReject(new Error('bad sig'));
      const s1 = fakeSocket({ auth: { token: 'bad' }, headers: {}, query: {} });
      await gateway.handleConnection(s1 as any);
      expect(s1.disconnected).toBe(true);

      when(verifier.verify('tok')).thenResolve(personas.ruwan);
      when(posture.check(anything(), anything())).thenReject(new Error('revoked'));
      const s2 = fakeSocket({ auth: { token: 'tok' }, headers: {}, query: {} });
      await gateway.handleConnection(s2 as any);
      expect(s2.disconnected).toBe(true);
      expect(s2.joined).toEqual([]);
    });

    it('joins the user room and the allowed requested rooms, and reports denied rooms', async () => {
      const kandyDispatcher: Principal = principal({ sub: 'nilanthi', roles: ['dispatcher'], depots: ['KANDY'] });
      when(verifier.verify('h.p.s')).thenResolve(kandyDispatcher);
      const s = fakeSocket({ auth: {}, headers: { authorization: 'Bearer h.p.s' }, query: { room: 'dispatcher:KANDY, dispatcher:PELIYAGODA,trip:T1,store:OUT106' } });

      await gateway.handleConnection(s as any);

      verify(verifier.verify('h.p.s')).once();
      verify(posture.check(kandyDispatcher, undefined)).once();
      expect(s.data.principal).toBe(kandyDispatcher);
      expect(s.joined).toEqual(['user:nilanthi', 'dispatcher:KANDY', 'trip:T1']);
      expect(s.emitted).toEqual([
        ['room_denied', { room: 'dispatcher:PELIYAGODA' }],
        ['room_denied', { room: 'store:OUT106' }],
      ]);
      expect(s.disconnected).toBeUndefined();
    });

    it('checks the requested trip rooms together, joins them in order, and ignores repeats', async () => {
      when(verifier.verify('tok')).thenResolve(personas.nilanthi);
      const s = fakeSocket({ auth: { token: 'tok' }, headers: {}, query: { room: 'trip:T1,trip:T2,trip:T1,trip:T3' } });
      await gateway.handleConnection(s as any);
      expect(s.joined).toEqual(['user:nilanthi', 'trip:T1', 'trip:T2', 'trip:T3']);
      verify(trip.findUnique(anything())).times(3);
    });

    it('binds a field token to the device named in the handshake (auth.deviceId, else X-Device-Id)', async () => {
      when(verifier.verify('tok')).thenResolve(personas.ruwan);
      await gateway.handleConnection(fakeSocket({ auth: { token: 'tok', deviceId: 'DEV-RB-01' }, headers: { 'x-device-id': 'ignored' }, query: {} }) as any);
      verify(posture.check(personas.ruwan, 'DEV-RB-01')).once();

      await gateway.handleConnection(fakeSocket({ auth: { token: 'tok' }, headers: { 'x-device-id': 'DEV-RB-01' }, query: {} }) as any);
      verify(posture.check(personas.ruwan, 'DEV-RB-01')).twice();

      when(posture.check(personas.ruwan, 'DEV-OTHER')).thenReject(new Error('DeviceMismatch'));
      const s = fakeSocket({ auth: { token: 'tok', deviceId: 'DEV-OTHER' }, headers: {}, query: {} });
      await gateway.handleConnection(s as any);
      expect(s.disconnected).toBe(true);
      expect(s.joined).toEqual([]);
    });

    it('joins the canonical (upper-case) depot room and reports denials under the requested name', async () => {
      when(verifier.verify('h.p.s')).thenResolve(principal({ sub: 'kasun', roles: ['loader'], depots: ['KANDY'] }));
      const s = fakeSocket({ auth: { token: 'h.p.s' }, headers: {}, query: { room: 'loader:kandy,dispatcher:kandy' } });
      await gateway.handleConnection(s as any);
      expect(s.joined).toEqual(['user:kasun', 'loader:KANDY']);
      expect(s.emitted).toEqual([['room_denied', { room: 'dispatcher:kandy' }]]);
    });

    it('accepts a handshake auth token with a Bearer prefix', async () => {
      when(verifier.verify('abc')).thenResolve(personas.fathima);
      const s = fakeSocket({ auth: { token: 'Bearer abc' }, headers: {}, query: {} });
      await gateway.handleConnection(s as any);
      expect(s.joined).toEqual(['user:fathima']);
    });
  });

  describe('canonicalRoom', () => {
    it('upper-cases the id of depot rooms only', () => {
      expect(canonicalRoom('dispatcher:kandy')).toBe('dispatcher:KANDY');
      expect(canonicalRoom('loader:Peliyagoda')).toBe('loader:PELIYAGODA');
      expect(canonicalRoom('store:out106')).toBe('store:out106');
      expect(canonicalRoom('trip:t1')).toBe('trip:t1');
      expect(canonicalRoom('dispatcher')).toBe('dispatcher');
      expect(canonicalRoom('dispatcher:')).toBe('dispatcher:');
    });
  });

  describe('emit helpers', () => {
    it('emit to rooms through the server', () => {
      const emitted: [string, string, any][] = [];
      gateway.server = { to: (room: string) => ({ emit: (e: string, p: any) => emitted.push([room, e, p]) }) } as any;
      gateway.etaUpdate('T1', 'OUT106', { eta: 1 });
      gateway.blackout('KANDY', { v: 1 });
      gateway.creditNoteIssued('OUT106', 'CN1', { amount: 5, creditNoteId: 'SPOOFED' });
      gateway.blackout('KANDY', { v: 2 }, ['OUT106']);
      gateway.blackoutResolved(undefined, { v: 3 }, ['OUT106', 'OUT108']);
      expect(emitted).toEqual([
        ['trip:T1', 'eta_update', { eta: 1 }],
        ['store:OUT106', 'eta_update', { eta: 1 }],
        ['dispatcher:KANDY', 'signal_lost', { v: 1 }],
        ['store:OUT106', 'credit_note_issued', { creditNoteId: 'CN1', amount: 5 }],
        ['dispatcher:KANDY', 'signal_lost', { v: 2 }],
        ['store:OUT106', 'signal_lost', { v: 2 }],
        ['store:OUT106', 'signal_back', { v: 3 }],
        ['store:OUT108', 'signal_back', { v: 3 }],
      ]);
    });
  });
});
