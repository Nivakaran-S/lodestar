import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { depotDelegate } from '../../../libs/odata/test/depots';
import { ODataError, operationsOf } from '@lodestar/odata';
import { AuditEvent, AuditSink, DevicePostureService, Principal, rowFilter, ServiceTokenClient } from '@lodestar/security';
import { personas, principal } from '../../../libs/security/test/principals';
import { AuthService } from './auth.service';
import { DevicesSet, UsersSet } from './auth.sets';
import { KeycloakAdminClient } from './keycloak-admin.client';

interface FindUniqueDelegate {
  findUnique(a: any): Promise<any>;
}
interface UpdateDelegate {
  update(a: any): Promise<any>;
}

const w = (p = personas.admin) => ({ principal: p, headers: {} });

describe('UsersSet', () => {
  let auth: AuthService;
  let vehicle: FindUniqueDelegate;
  let users: { findFirst(a: any): Promise<any>; findMany(a: any): Promise<any[]> };
  let set: UsersSet;
  /** Directory rows the uniqueness checks see (other active drivers, taken staff IDs). */
  let rows: Array<{ id: string; name: string; role: string; isActive: boolean; vehicleId?: string | null; staffId?: string | null }>;
  const VEHICLES: Record<string, string> = { VEH057: 'KANDY', VEH058: 'KANDY', VEH001: 'PELIYAGODA' };

  beforeEach(() => {
    auth = mock(AuthService);
    vehicle = mock<FindUniqueDelegate>();
    users = mock<{ findFirst(a: any): Promise<any>; findMany(a: any): Promise<any[]> }>();
    rows = [];
    when(vehicle.findUnique(anything())).thenCall(async (a: any) => (VEHICLES[a.where.id] ? { id: a.where.id, depot: VEHICLES[a.where.id] } : null));
    // A tiny stand-in for the where clauses checkScope sends (role/isActive/vehicleId/staffId, NOT id).
    when(users.findFirst(anything())).thenCall(async ({ where }: any) => {
      const hit = rows.find(r =>
        (where.role === undefined || r.role === where.role)
        && (where.isActive === undefined || r.isActive === where.isActive)
        && (where.vehicleId === undefined || r.vehicleId === where.vehicleId)
        && (where.staffId === undefined || r.staffId === where.staffId)
        && (where.NOT?.id === undefined || r.id !== where.NOT.id));
      return hit ? { id: hit.id, name: hit.name } : null;
    });
    when(users.findMany(anything())).thenCall(async ({ where }: any) =>
      rows.filter(r => r.staffId?.startsWith(where.staffId.startsWith)).map(r => ({ staffId: r.staffId })));
    const outlet = { findUnique: async (a: any) => (['OUT106', 'OUT108'].includes(a.where.id) ? { id: a.where.id } : null) };
    set = new UsersSet({ vehicle: instance(vehicle), depot: depotDelegate(), outlet, user: instance(users) } as any, instance(auth));
    when(auth.createIdentity(anything())).thenResolve('kc-123');
  });

  describe('beforeCreate', () => {
    const body = { email: 'a@b.lk', name: 'Amal Perera', role: 'DISPATCHER', depot: 'KANDY' };

    it.each(['email', 'name', 'role'])('requires %s', async (field) => {
      await expect(set.beforeCreate({ ...body, [field]: '' })).rejects.toMatchObject({ status: 400, target: field });
      verify(auth.createIdentity(anything())).never();
    });

    it('requires an existing outlet for a store manager', async () => {
      await expect(set.beforeCreate({ ...body, role: 'STORE_MANAGER' })).rejects.toMatchObject({ status: 400, target: 'outletId' });
      await expect(set.beforeCreate({ ...body, role: 'STORE_MANAGER', outletId: 'OUT999' })).rejects.toMatchObject({ status: 400, target: 'outletId' });
      await expect(set.beforeCreate({ ...body, role: 'STORE_MANAGER', outletId: 'OUT106' })).resolves.toMatchObject({ outletId: 'OUT106' });
    });

    it('a driver needs a depot and a vehicle of that depot', async () => {
      const driver = { ...body, role: 'DRIVER' };
      await expect(set.beforeCreate({ ...driver, depot: undefined, vehicleId: 'VEH057' })).rejects.toMatchObject({ status: 400, target: 'depot' });
      await expect(set.beforeCreate(driver)).rejects.toMatchObject({ status: 400, target: 'vehicleId', message: 'A driver needs a vehicle' });
      await expect(set.beforeCreate({ ...driver, vehicleId: 'VEH001' })).rejects.toMatchObject({ status: 400, target: 'vehicleId', message: expect.stringContaining('PELIYAGODA') });
      await expect(set.beforeCreate({ ...driver, vehicleId: 'VEH058' })).resolves.toMatchObject({ vehicleId: 'VEH058' });
    });

    it('one active driver per vehicle: a second one is refused (409, naming the first); a disabled one does not count', async () => {
      rows = [{ id: 'u-ruwan', name: 'Ruwan Bandara', role: 'DRIVER', isActive: true, vehicleId: 'VEH057' }];
      await expect(set.beforeCreate({ ...body, role: 'DRIVER', vehicleId: 'VEH057' }))
        .rejects.toMatchObject({ status: 409, target: 'vehicleId', message: expect.stringContaining('Ruwan Bandara') });
      rows[0].isActive = false;
      await expect(set.beforeCreate({ ...body, role: 'DRIVER', vehicleId: 'VEH057' })).resolves.toMatchObject({ vehicleId: 'VEH057' });
    });

    it('a loader needs a depot and a unique staff ID (depot prefix + 4 digits, stored upper-case)', async () => {
      const loader = { ...body, role: 'LOADER' };
      await expect(set.beforeCreate(loader)).rejects.toMatchObject({ status: 400, target: 'staffId' });
      await expect(set.beforeCreate({ ...loader, depot: undefined, staffId: 'KDY-0428' })).rejects.toMatchObject({ status: 400, target: 'depot' });
      await expect(set.beforeCreate({ ...loader, staffId: 'KDY-42' })).rejects.toMatchObject({ status: 400, target: 'staffId' });
      await expect(set.beforeCreate({ ...loader, staffId: ' kdy-0428 ' })).resolves.toMatchObject({ staffId: 'KDY-0428' });
      rows = [{ id: 'u-kasun', name: 'Kasun Jayawardena', role: 'LOADER', isActive: true, staffId: 'KDY-0427' }];
      await expect(set.beforeCreate({ ...loader, staffId: 'kdy-0427' }))
        .rejects.toMatchObject({ status: 409, target: 'staffId', message: expect.stringContaining('Kasun') });
    });

    it('only a driver has a vehicle and only a loader a staff ID', async () => {
      await expect(set.beforeCreate({ ...body, vehicleId: 'VEH057' })).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeCreate({ ...body, staffId: 'KDY-0428' })).rejects.toMatchObject({ status: 400, target: 'staffId' });
      await expect(set.beforeCreate({ ...body, vehicleId: null, staffId: '' })).resolves.toMatchObject({ vehicleId: null, staffId: null });
    });

    it('validates only: no identity is created before the row is written', async () => {
      await set.beforeCreate(body);
      verify(auth.createIdentity(anything())).never();
      verify(auth.createUser(anything(), anything())).never();
    });

    it('checks that a vehicleId exists', async () => {
      await expect(set.beforeCreate({ ...body, role: 'DRIVER', vehicleId: 'VEH999' })).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeCreate({ ...body, role: 'DRIVER', vehicleId: 'bad id!' })).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeCreate({ ...body, role: 'DRIVER', vehicleId: 'VEH057' })).resolves.toMatchObject({ vehicleId: 'VEH057' });
    });
  });

  it('create delegates to AuthService.createUser with the caller (identity + row + compensation)', async () => {
    when(auth.createUser(anything(), anything())).thenResolve({ id: 'kc-123' } as any);
    const data = { email: 'a@b.lk', name: 'A', role: 'DRIVER', id: 'client-chosen' };
    await expect(set.create(data, w())).resolves.toEqual({ id: 'kc-123' });
    verify(auth.createUser(deepEqual(data), personas.admin)).once();
  });

  describe('beforeUpdate', () => {
    it('keeps a store manager bound to an outlet', async () => {
      await expect(set.beforeUpdate({ role: 'STORE_MANAGER' }, { id: 'u1', role: 'DRIVER', outletId: null })).rejects.toMatchObject({ status: 400 });
      await expect(set.beforeUpdate({ outletId: null }, { id: 'u1', role: 'STORE_MANAGER', outletId: 'OUT106' })).rejects.toMatchObject({ status: 400 });
      await expect(set.beforeUpdate({ role: 'STORE_MANAGER', outletId: 'OUT108' }, { id: 'u1', role: 'DRIVER' })).resolves.toEqual({ role: 'STORE_MANAGER', outletId: 'OUT108' });
    });

    const ruwan = { id: 'u-ruwan', name: 'Ruwan Bandara', role: 'DRIVER', depot: 'KANDY', vehicleId: 'VEH057', staffId: null, isActive: true };
    const kasun = { id: 'u-kasun', name: 'Kasun Jayawardena', role: 'LOADER', depot: 'KANDY', vehicleId: null, staffId: 'KDY-0427', isActive: true };

    it('checks a new vehicleId; a driver cannot lose their vehicle, someone leaving the driver role does', async () => {
      await expect(set.beforeUpdate({ vehicleId: 'VEH999' }, ruwan)).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeUpdate({ vehicleId: null }, ruwan)).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeUpdate({ role: 'DISPATCHER' }, ruwan)).resolves.toEqual({ role: 'DISPATCHER', vehicleId: null });
      await expect(set.beforeUpdate({ role: 'DISPATCHER', vehicleId: 'VEH057' }, ruwan)).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
    });

    it('moving a driver to a vehicle someone else drives is refused; keeping their own is fine', async () => {
      rows = [ruwan, { id: 'u-amal', name: 'Amal Perera', role: 'DRIVER', isActive: true, vehicleId: 'VEH058' }];
      await expect(set.beforeUpdate({ vehicleId: 'VEH058' }, ruwan)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Amal Perera') });
      await expect(set.beforeUpdate({ vehicleId: 'VEH057', name: 'Ruwan B' }, ruwan)).resolves.toEqual({ vehicleId: 'VEH057', name: 'Ruwan B' });
      // Reactivating a disabled driver whose vehicle went to someone else meanwhile.
      rows = [ruwan, { id: 'u-amal', name: 'Amal Perera', role: 'DRIVER', isActive: true, vehicleId: 'VEH057' }];
      await expect(set.beforeUpdate({ isActive: true }, { ...ruwan, isActive: false })).rejects.toMatchObject({ status: 409 });
      // Deactivating is always allowed.
      await expect(set.beforeUpdate({ isActive: false }, ruwan)).resolves.toEqual({ isActive: false });
    });

    it('a name edit on an older driver without a vehicle still saves; making someone a driver needs one', async () => {
      const legacy = { ...ruwan, vehicleId: null };
      await expect(set.beforeUpdate({ name: 'R B', role: 'DRIVER', depot: 'KANDY' }, legacy)).resolves.toEqual({ name: 'R B', role: 'DRIVER', depot: 'KANDY' });
      await expect(set.beforeUpdate({ role: 'DRIVER' }, { ...kasun, staffId: 'KDY-0427' })).rejects.toMatchObject({ status: 400, target: 'vehicleId' });
      await expect(set.beforeUpdate({ role: 'DRIVER', vehicleId: 'VEH058' }, kasun)).resolves.toEqual({ role: 'DRIVER', vehicleId: 'VEH058', staffId: null });
    });

    it('a loader keeps a unique staff ID; making someone a loader needs one', async () => {
      rows = [kasun];
      await expect(set.beforeUpdate({ staffId: null }, kasun)).rejects.toMatchObject({ status: 400, target: 'staffId' });
      await expect(set.beforeUpdate({ staffId: 'kdy-0427' }, kasun)).resolves.toEqual({ staffId: 'KDY-0427' });
      await expect(set.beforeUpdate({ role: 'LOADER', vehicleId: null }, ruwan)).rejects.toMatchObject({ status: 400, target: 'staffId' });
      await expect(set.beforeUpdate({ role: 'LOADER', vehicleId: null, staffId: 'KDY-0427' }, ruwan)).rejects.toMatchObject({ status: 409, target: 'staffId' });
      await expect(set.beforeUpdate({ role: 'LOADER', vehicleId: null, staffId: 'KDY-0500' }, ruwan)).resolves.toEqual({ role: 'LOADER', vehicleId: null, staffId: 'KDY-0500' });
    });

    it('does not call the identity provider itself (updateWhere does, transactionally)', async () => {
      await set.beforeUpdate({ isActive: false }, { id: 'u1', isActive: true, role: 'DRIVER' });
      verify(auth.setIdentityEnabled(anything(), anything())).never();
    });
  });

  it('updateWhere delegates to AuthService.updateUser with the caller', async () => {
    when(auth.updateUser(anything(), anything(), anything())).thenResolve(1);
    await expect(set.updateWhere({ id: 'u1' }, { role: 'LOADER' }, w())).resolves.toBe(1);
    verify(auth.updateUser(deepEqual({ id: 'u1' }), deepEqual({ role: 'LOADER' }), personas.admin)).once();
    expect(() => set.updateWhere({ id: 'u1' }, {})).toThrow();
  });

  describe('SetDockPin (ADM-04 Set Dock PIN / Reset PIN)', () => {
    const op = (entity: any, pin: unknown) => ({ principal: personas.admin, params: { pin }, headers: {}, entity, key: { id: entity.id } });
    const loader = { id: 'u-kasun', role: 'LOADER', isActive: true };

    it('admins only: the PIN action and the staff ID suggestion', () => {
      const ops = Object.fromEntries(operationsOf(UsersSet).map((o) => [o.name, o]));
      expect(ops.SetDockPin).toMatchObject({ kind: 'action', binding: 'entity', roles: ['admin'] });
      expect(ops.NextStaffId).toMatchObject({ kind: 'function', binding: 'collection', roles: ['admin'] });
    });

    it('sets a 4-digit PIN for an active loader through AuthService and returns no PIN', async () => {
      when(auth.setDockPin(anything(), anything())).thenResolve({ pinSet: true });
      await expect(set.setDockPin(op(loader, '2468'))).resolves.toEqual({ pinSet: true });
      verify(auth.setDockPin('u-kasun', '2468')).once();
    });

    it.each([['246'], ['24680'], ['24a8'], [2468], [null]])('refuses %p (4 digits only)', async (pin) => {
      expect(() => set.setDockPin(op(loader, pin))).toThrow(expect.objectContaining({ status: 400, target: 'pin' }));
      verify(auth.setDockPin(anything(), anything())).never();
    });

    it('only a loader has a Dock PIN, and only one who can sign in', () => {
      expect(() => set.setDockPin(op({ ...loader, role: 'DRIVER' }, '2468'))).toThrow(expect.objectContaining({ status: 400 }));
      expect(() => set.setDockPin(op({ ...loader, isActive: false }, '2468'))).toThrow(expect.objectContaining({ status: 409 }));
      verify(auth.setDockPin(anything(), anything())).never();
    });
  });

  describe('NextStaffId', () => {
    const fn = (depot: string) => set.nextStaffId({ principal: personas.admin, params: { depot }, headers: {} });

    it('suggests one above the highest staff ID of the depot prefix', async () => {
      rows = [
        { id: 'a', name: 'A', role: 'LOADER', isActive: true, staffId: 'KDY-0427' },
        { id: 'b', name: 'B', role: 'LOADER', isActive: false, staffId: 'KDY-0012' },
        { id: 'c', name: 'C', role: 'LOADER', isActive: true, staffId: 'PLG-0900' },
      ];
      await expect(fn('kandy')).resolves.toEqual({ depot: 'KANDY', prefix: 'KDY', staffId: 'KDY-0428' });
      await expect(fn('PELIYAGODA')).resolves.toMatchObject({ staffId: 'PLG-0901' });
      rows = [];
      await expect(fn('KANDY')).resolves.toMatchObject({ staffId: 'KDY-0001' });
      await expect(fn('NOWHERE')).rejects.toMatchObject({ status: 400 });
    });
  });

  it('Me delegates with the caller principal', async () => {
    when(auth.me(anything())).thenResolve({ sub: 'ruwan' } as any);
    await set.me({ principal: personas.ruwan, params: {}, headers: {} });
    expect(capture(auth.me).last()[0]).toBe(personas.ruwan);
  });
});

/** A field token not bound to the phone that presents it, let through on an enrollment route. */
const enrolling = (p: Principal, deviceId = 'DEV-NEWPHONE01', reason: 'DeviceNotBound' | 'DeviceMismatch' = 'DeviceMismatch'): Principal => ({
  ...p,
  enrollment: { deviceId, reason },
});

describe('DevicesSet', () => {
  let auth: AuthService;
  let set: DevicesSet;
  let delegate: { create(a: any): Promise<any> };

  beforeEach(() => {
    auth = mock(AuthService);
    delegate = mock<{ create(a: any): Promise<any> }>();
    when(delegate.create(anything())).thenCall(async (a: any) => a.data);
    set = new DevicesSet({ device: instance(delegate) } as any, instance(auth));
  });

  it('every field role, store managers and dispatchers included, reads and registers only its own devices; admins read all', () => {
    expect(set.options.read).toEqual(expect.arrayContaining(['store_manager', 'dispatcher', 'loader', 'driver', 'admin']));
    expect(set.options.create).toEqual(expect.arrayContaining(['store_manager', 'dispatcher', 'loader', 'driver', 'admin']));
    expect(set.options.create).not.toContain('svc');
    expect(rowFilter(personas.fathima, set.options.abac)).toEqual({ userId: 'fathima' });
    expect(rowFilter(personas.nilanthi, set.options.abac)).toEqual({ userId: 'nilanthi' });
    expect(rowFilter(personas.admin, set.options.abac)).toBeUndefined();
  });

  it('an enrolling phone sees only its user\'s rows, even with the admin role', () => {
    expect(rowFilter(enrolling(personas.ruwan), set.options.abac)).toEqual({ userId: 'ruwan' });
    expect(rowFilter(enrolling(personas.admin), set.options.abac)).toEqual({ userId: 'admin' });
  });

  describe('beforeCreate', () => {
    it('registers a non-admin device as PENDING for the caller, ignoring userId', async () => {
      const data = await set.beforeCreate({ id: 'DEV-RB-02', userId: 'kasun', label: 'Phone' }, w(personas.ruwan));
      expect(data).toEqual({ id: 'DEV-RB-02', userId: 'ruwan', label: 'Phone', status: 'PENDING', sharedDemo: false });
    });

    it('never creates a shared demo phone through the API, not even for an admin (the seed sets sharedDemo)', async () => {
      expect(set.options.insertable).not.toContain('sharedDemo');
      expect(set.options.updatable).not.toContain('sharedDemo');
      await expect(set.beforeCreate({ id: 'DEV-RB-02', sharedDemo: true }, w(personas.ruwan))).resolves.toMatchObject({ sharedDemo: false });
      await expect(set.beforeCreate({ id: 'DEV-AD-02', sharedDemo: true }, w())).resolves.toMatchObject({ sharedDemo: false });
      const p = enrolling(personas.fathima, 'DEV-NEWPHONE01', 'DeviceNotBound');
      await expect(set.beforeCreate({ sharedDemo: true }, w(p))).resolves.toMatchObject({ sharedDemo: false });
    });

    it('lets an admin register an ACTIVE device for someone', async () => {
      await expect(set.beforeCreate({ id: 'DEV-RB-02', userId: 'ruwan' }, w())).resolves.toMatchObject({ userId: 'ruwan', status: 'ACTIVE' });
      await expect(set.beforeCreate({ id: 'DEV-AD-01' }, w())).resolves.toMatchObject({ userId: 'admin', status: 'ACTIVE' });
    });

    it.each([undefined, 'abc', 'DEV_01!', 'x'.repeat(65)])('rejects id %p with 400', async (id) => {
      await expect(set.beforeCreate({ id }, w(personas.ruwan))).rejects.toMatchObject({ status: 400, target: 'id' });
    });

    it('an enrolling phone registers the id it presents (X-Device-Id), as PENDING for its own user', async () => {
      const p = enrolling(personas.fathima, 'DEV-NEWPHONE01', 'DeviceNotBound');
      await expect(set.beforeCreate({ platform: 'android', model: 'Galaxy A15', userId: 'nilanthi' }, w(p))).resolves.toEqual({
        id: 'DEV-NEWPHONE01',
        platform: 'android',
        model: 'Galaxy A15',
        userId: 'fathima',
        status: 'PENDING',
        sharedDemo: false,
      });
      await expect(set.beforeCreate({ id: 'DEV-NEWPHONE01' }, w(p))).resolves.toMatchObject({ id: 'DEV-NEWPHONE01', status: 'PENDING' });
    });

    it('an enrolling phone may not register another id (400), and an enrolling admin gets no privileges', async () => {
      await expect(set.beforeCreate({ id: 'DEV-OTHER-01' }, w(enrolling(personas.ruwan)))).rejects.toMatchObject({ status: 400, target: 'id' });
      await expect(set.beforeCreate({ userId: 'ruwan' }, w(enrolling(personas.admin)))).resolves.toMatchObject({ userId: 'admin', status: 'PENDING' });
    });
  });

  describe('create', () => {
    it('people go through AuthService.enrollDevice (idempotent, audited)', async () => {
      when(auth.enrollDevice(anything(), anything())).thenResolve({ id: 'DEV-NEWPHONE01', status: 'PENDING' } as any);
      const p = enrolling(personas.ruwan);
      await expect(set.create({ id: 'DEV-NEWPHONE01', userId: 'ruwan', status: 'PENDING', platform: 'web' }, w(p))).resolves.toMatchObject({ status: 'PENDING' });
      const [req, actor] = capture(auth.enrollDevice).last();
      expect(req).toEqual({ id: 'DEV-NEWPHONE01', label: undefined, platform: 'web', model: undefined });
      expect(actor).toBe(p);
      verify(delegate.create(anything())).never();
    });

    it('admins insert directly', async () => {
      await set.create({ id: 'DEV-AD-01', userId: 'ruwan', status: 'ACTIVE' }, w());
      verify(delegate.create(anything())).once();
      verify(auth.enrollDevice(anything(), anything())).never();
    });
  });

  describe('Revoke', () => {
    it('409 when already revoked', () => {
      expect(() => set.revoke({ principal: personas.admin, params: {}, entity: { id: 'DEV-RB-01', status: 'REVOKED' }, headers: {} })).toThrow(
        expect.objectContaining({ status: 409 }),
      );
      verify(auth.revokeDevice(anything(), anything(), anything())).never();
    });

    it('delegates with the admin and reason', async () => {
      when(auth.revokeDevice(anything(), anything(), anything())).thenResolve({ id: 'DEV-RB-01' } as any);
      await set.revoke({ principal: personas.admin, params: { reason: 'lost' }, entity: { id: 'DEV-RB-01', status: 'ACTIVE' }, headers: {} });
      verify(auth.revokeDevice('DEV-RB-01', personas.admin, 'lost')).once();
    });
  });

  it('Activate delegates with the admin', async () => {
    when(auth.activateDevice(anything(), anything())).thenResolve({ id: 'DEV-1' } as any);
    await set.activate({ principal: personas.admin, params: {}, entity: { id: 'DEV-1' }, headers: {} });
    verify(auth.activateDevice('DEV-1', personas.admin)).once();
  });
});

describe('AuthService', () => {
  let user: FindUniqueDelegate;
  let device: UpdateDelegate;
  let keycloak: KeycloakAdminClient;
  let posture: DevicePostureService;
  let audit: AuditSink;
  let service: AuthService;

  beforeEach(() => {
    user = mock<FindUniqueDelegate>();
    device = mock<UpdateDelegate>();
    keycloak = mock(KeycloakAdminClient);
    posture = mock(DevicePostureService);
    audit = mock<AuditSink>();
    service = new AuthService({ user: instance(user), device: instance(device) } as any, instance(keycloak), instance(posture), instance(audit));
    when(device.update(anything())).thenCall(async (a: any) => ({ id: a.where.id, userId: 'ruwan', ...a.data }));
  });

  describe('revokeDevice', () => {
    beforeEach(() => when(audit.record(anything())).thenResolve());

    it('sets REVOKED, invalidates the posture cache and logs the user out', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.getAttribute('ruwan', 'device_id')).thenResolve(['DEV-RB-02']);
      when(keycloak.logoutUser('ruwan')).thenResolve(true);
      const res = await service.revokeDevice('DEV-RB-01', personas.admin, 'lost on bus');
      const [args] = capture(device.update).last();
      expect(args.where).toEqual({ id: 'DEV-RB-01' });
      expect(args.data).toMatchObject({ status: 'REVOKED', revokedBy: 'admin', revokeReason: 'lost on bus' });
      expect(args.data.revokedAt).toBeInstanceOf(Date);
      verify(posture.invalidate('DEV-RB-01')).once();
      verify(keycloak.logoutUser('ruwan')).once();
      // Another phone is bound: its device_id stays.
      verify(keycloak.updateUser(anything(), anything())).never();
      expect(res).toMatchObject({ status: 'REVOKED', sessionsRevoked: true, identityCleared: false });
    });

    it('clears the device_id attribute when the revoked phone was the bound one, and audits it', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.getAttribute('ruwan', 'device_id')).thenResolve(['DEV-RB-01']);
      when(keycloak.updateUser(anything(), anything())).thenResolve();
      when(keycloak.logoutUser('ruwan')).thenResolve(true);
      const res = await service.revokeDevice('DEV-RB-01', personas.admin, 'lost');
      verify(keycloak.updateUser('ruwan', deepEqual({ attributes: { device_id: null } }))).once();
      expect(res).toMatchObject({ identityCleared: true, sessionsRevoked: true });
      expect(capture(audit.record).last()[0]).toMatchObject({
        actor: 'admin',
        action: 'Devices.UnbindIdentity',
        entitySet: 'Devices',
        entityKey: 'DEV-RB-01',
        outcome: 'SUCCESS',
        payload: { userId: 'ruwan', wasBound: true, identityCleared: true, sessionsRevoked: true },
      });
    });

    it('defaults the reason and survives a Keycloak failure (the revocation stands; audited FAILED)', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.getAttribute(anything(), anything())).thenReject(new Error('identity down'));
      when(keycloak.logoutUser(anything())).thenReject(new Error('boom'));
      const res = await service.revokeDevice('DEV-RB-01', personas.admin);
      expect(res).toMatchObject({ status: 'REVOKED', revokeReason: 'Reported lost', sessionsRevoked: false, identityCleared: false });
      verify(posture.invalidate('DEV-RB-01')).once();
      expect(capture(audit.record).last()[0]).toMatchObject({ action: 'Devices.UnbindIdentity', outcome: 'FAILED', payload: { errors: [expect.stringContaining('identity down'), expect.stringContaining('boom')] } });
    });

    it('does not call Keycloak when it is not configured', async () => {
      when(keycloak.configured).thenReturn(false);
      const res = await service.revokeDevice('DEV-RB-01', personas.admin);
      expect(res.sessionsRevoked).toBe(false);
      verify(keycloak.logoutUser(anything())).never();
      verify(keycloak.getAttribute(anything(), anything())).never();
    });
  });

  describe('createIdentity', () => {
    it('without Keycloak requires and returns the given id', async () => {
      when(keycloak.configured).thenReturn(false);
      await expect(service.createIdentity({ email: 'a@b', name: 'A', role: 'DRIVER' })).rejects.toMatchObject({ status: 400, target: 'id' });
      await expect(service.createIdentity({ id: 'sub-1', email: 'a@b', name: 'A', role: 'DRIVER' })).resolves.toBe('sub-1');
      verify(keycloak.createUser(anything())).never();
    });

    it('with Keycloak creates the user with realm role and ABAC attributes', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.createUser(anything())).thenResolve('kc-9');
      const id = await service.createIdentity({ email: 'f@x.lk', name: 'Fathima Rizvi Mohamed', role: 'STORE_MANAGER', outletId: 'OUT106', depot: 'KANDY' });
      expect(id).toBe('kc-9');
      expect(capture(keycloak.createUser).last()[0]).toEqual({
        email: 'f@x.lk',
        firstName: 'Fathima',
        lastName: 'Rizvi Mohamed',
        role: 'store_manager',
        attributes: { depot: ['KANDY'], outlet_id: ['OUT106'] },
      });
    });

    it('passes a driver vehicle as the vehicle_id attribute', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.createUser(anything())).thenResolve('kc-9');
      await service.createIdentity({ email: 'r@x.lk', name: 'Ruwan', role: 'DRIVER', depot: 'KANDY', vehicleId: 'VEH057' });
      expect(capture(keycloak.createUser).last()[0].attributes).toEqual({ depot: ['KANDY'], vehicle_id: ['VEH057'] });
    });

    it('passes the staff ID of a loader as the staff_id attribute (the Dock sign-in looks the loader up by it)', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.createUser(anything())).thenResolve('kc-10');
      await service.createIdentity({ email: 'k@x.lk', name: 'Kasun', role: 'LOADER', depot: 'KANDY', staffId: 'KDY-0428' });
      expect(capture(keycloak.createUser).last()[0]).toMatchObject({ role: 'loader', attributes: { depot: ['KANDY'], staff_id: ['KDY-0428'] } });
    });
  });

  describe('setDockPin', () => {
    it('sets the PIN in Keycloak and answers without it', async () => {
      when(keycloak.configured).thenReturn(true);
      when(keycloak.setPin(anything(), anything())).thenResolve();
      await expect(service.setDockPin('u-kasun', '2468')).resolves.toEqual({ pinSet: true });
      verify(keycloak.setPin('u-kasun', '2468')).once();
    });

    it('503 without an identity admin API; identity errors pass through as 5xx', async () => {
      when(keycloak.configured).thenReturn(false);
      await expect(service.setDockPin('u-kasun', '2468')).rejects.toMatchObject({ status: 503 });
      when(keycloak.configured).thenReturn(true);
      when(keycloak.setPin(anything(), anything())).thenReject(new Error('boom'));
      await expect(service.setDockPin('u-kasun', '2468')).rejects.toMatchObject({ status: 502 });
    });
  });

  it('setIdentityEnabled calls Keycloak only when configured', async () => {
    when(keycloak.configured).thenReturn(false);
    await service.setIdentityEnabled('u1', false);
    verify(keycloak.setEnabled(anything(), anything())).never();
    when(keycloak.configured).thenReturn(true);
    when(keycloak.setEnabled(anything(), anything())).thenResolve();
    await service.setIdentityEnabled('u1', false);
    verify(keycloak.setEnabled('u1', false)).once();
  });

  describe('me', () => {
    it('merges token claims with the directory row (claims win)', async () => {
      const row = { id: 'ruwan', email: 'ruwan@dir.lk', name: 'Ruwan (dir)', role: 'DRIVER', depot: 'KANDY', outletId: null, phone: null, isActive: true };
      when(user.findUnique(anything())).thenResolve(row);
      const p = { ...personas.ruwan, name: 'Ruwan Bandara' };
      const me = await service.me(p);
      expect(me).toEqual({
        sub: 'ruwan',
        name: 'Ruwan Bandara',
        email: 'ruwan@dir.lk',
        roles: ['driver'],
        depots: ['KANDY'],
        outletId: null,
        vehicleId: 'VEH057',
        deviceId: 'DEV-RB-01',
        clientId: 'lodestar-field',
        enrollment: null,
        user: row,
      });
      expect(capture(user.findUnique).last()[0].where).toEqual({ id: 'ruwan' });
    });

    it('works without a directory row', async () => {
      when(user.findUnique(anything())).thenResolve(null);
      const me = await service.me(principal({ sub: 'svc', roles: ['svc'] }));
      expect(me).toMatchObject({ sub: 'svc', name: null, email: null, clientId: null, user: null });
    });

    it('tells an enrolling phone which id it asked for', async () => {
      when(user.findUnique(anything())).thenResolve(null);
      const me = await service.me(enrolling(personas.ruwan, 'DEV-NEWPHONE01'));
      expect(me).toMatchObject({ deviceId: 'DEV-RB-01', enrollment: { deviceId: 'DEV-NEWPHONE01', reason: 'DeviceMismatch' } });
    });
  });

  describe('myDispatcher', () => {
    const svc = (users: any[], outlet: any = null) => {
      const findMany = jest.fn().mockResolvedValue(users);
      const outletFind = jest.fn().mockResolvedValue(outlet);
      const s = new AuthService({ user: { findMany }, outlet: { findUnique: outletFind } } as any, instance(keycloak), instance(posture), instance(audit));
      return { s, findMany, outletFind };
    };

    it("returns an active dispatcher of the caller's depot with a phone", async () => {
      const { s, findMany } = svc([{ name: 'Anil', phone: null, depot: 'KANDY' }, { name: 'Dilani', phone: ' 0771234567 ', depot: 'KANDY' }]);
      await expect(s.myDispatcher(personas.fathima)).resolves.toEqual({ depot: 'KANDY', name: 'Dilani', phone: '0771234567' });
      expect(findMany.mock.calls[0][0].where).toEqual({ role: 'DISPATCHER', isActive: true, depot: { in: ['KANDY'] } });
    });

    it("takes the store's depot from its outlet when the token has none", async () => {
      const { s, findMany, outletFind } = svc([], { depot: 'PELIYAGODA' });
      await expect(s.myDispatcher(principal({ sub: 'sm', roles: ['store_manager'], outletId: 'OUT027' }))).resolves.toEqual({ depot: 'PELIYAGODA', name: null, phone: null });
      expect(outletFind.mock.calls[0][0].where).toEqual({ id: 'OUT027' });
      expect(findMany.mock.calls[0][0].where.depot).toEqual({ in: ['PELIYAGODA'] });
    });

    it('is empty without a depot', async () => {
      const { s, findMany } = svc([]);
      await expect(s.myDispatcher(principal({ sub: 'x', roles: ['store_manager'] }))).resolves.toEqual({ depot: null, name: null, phone: null });
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService directory writes with Keycloak', () => {
  interface UserDelegate {
    findUnique(a: any): Promise<any>;
    findFirst(a: any): Promise<any>;
    create(a: any): Promise<any>;
    updateMany(a: any): Promise<{ count: number }>;
  }
  let user: UserDelegate;
  let txUser: UserDelegate;
  let keycloak: KeycloakAdminClient;
  let audit: AuditSink;
  let service: AuthService;
  /** Outcome of the last $transaction: committed or rolled back. */
  let tx: { committed: boolean; rolledBack: boolean; options?: any };

  const audits = (): AuditEvent[] => {
    const out: AuditEvent[] = [];
    for (let i = 0; ; i++) {
      try {
        out.push(capture(audit.record).byCallIndex(i)[0]);
      } catch {
        return out;
      }
    }
  };

  beforeEach(() => {
    user = mock<UserDelegate>();
    txUser = mock<UserDelegate>();
    keycloak = mock(KeycloakAdminClient);
    audit = mock<AuditSink>();
    tx = { committed: false, rolledBack: false };
    const prisma = {
      user: instance(user),
      $transaction: async (fn: (t: any) => Promise<any>, options?: any) => {
        tx.options = options;
        try {
          const result = await fn({ user: instance(txUser) });
          tx.committed = true;
          return result;
        } catch (err) {
          tx.rolledBack = true;
          throw err;
        }
      },
    };
    service = new AuthService(prisma as any, instance(keycloak), instance(mock(DevicePostureService)), instance(audit));
    when(keycloak.configured).thenReturn(true);
    when(audit.record(anything())).thenResolve();
  });

  describe('createUser (orphaned identity compensation)', () => {
    const data = { email: 'amal@waypoint.lk', name: 'Amal Perera', role: 'DRIVER', depot: 'KANDY', vehicleId: 'VEH057' };

    beforeEach(() => {
      when(user.findUnique(anything())).thenResolve(null);
      when(keycloak.createUser(anything())).thenResolve('kc-77');
      when(keycloak.deleteUser(anything())).thenResolve();
    });

    it('creates the identity, then the row with the identity id', async () => {
      when(user.create(anything())).thenCall(async (a: any) => a.data);
      const row = await service.createUser({ ...data, id: 'client-chosen' }, personas.admin);
      expect(row).toMatchObject({ id: 'kc-77', email: 'amal@waypoint.lk', vehicleId: 'VEH057' });
      expect(capture(user.create).last()[0].data.id).toBe('kc-77');
      verify(keycloak.deleteUser(anything())).never();
      verify(audit.record(anything())).never();
    });

    it('deletes the Keycloak user, audits and rethrows when the row insert fails', async () => {
      const dbError = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), { code: 'P2002' });
      when(user.create(anything())).thenReject(dbError);

      await expect(service.createUser(data, personas.admin)).rejects.toBe(dbError);

      verify(keycloak.deleteUser('kc-77')).once();
      const [event] = audits();
      expect(event).toMatchObject({
        actor: 'admin',
        action: 'Users.CompensateIdentity',
        entitySet: 'Users',
        entityKey: 'kc-77',
        outcome: 'SUCCESS',
        payload: { identityDeleted: true, email: 'amal@waypoint.lk' },
      });
    });

    it('audits FAILED (for manual cleanup) when the Keycloak delete fails too, and still rethrows the DB error', async () => {
      const dbError = new Error('connection reset');
      when(user.create(anything())).thenReject(dbError);
      when(keycloak.deleteUser(anything())).thenReject(new Error('identity down'));

      await expect(service.createUser(data, personas.admin)).rejects.toBe(dbError);
      expect(audits()[0]).toMatchObject({ action: 'Users.CompensateIdentity', outcome: 'FAILED', payload: { identityDeleted: false, error: 'identity down' } });
    });

    it('does not create an identity for an email the directory already has', async () => {
      when(user.findUnique(anything())).thenResolve({ id: 'u-existing' });
      await expect(service.createUser(data, personas.admin)).rejects.toMatchObject({ status: 409, target: 'email' });
      verify(keycloak.createUser(anything())).never();
    });

    it('creates nothing in the directory when Keycloak fails', async () => {
      when(keycloak.createUser(anything())).thenReject(Object.assign(new Error('down'), { status: 503 }));
      await expect(service.createUser(data, personas.admin)).rejects.toMatchObject({ status: 503 });
      verify(user.create(anything())).never();
      verify(keycloak.deleteUser(anything())).never();
    });

    it('without a Keycloak admin API there is nothing to compensate', async () => {
      when(keycloak.configured).thenReturn(false);
      when(user.create(anything())).thenReject(new Error('db down'));
      await expect(service.createUser({ ...data, id: 'sub-1' }, personas.admin)).rejects.toThrow('db down');
      verify(keycloak.deleteUser(anything())).never();
    });
  });

  describe('updateUser (access changes reach Keycloak)', () => {
    const before = { id: 'u-ruwan', email: 'r@x.lk', role: 'DRIVER', depot: 'KANDY', outletId: null, vehicleId: 'VEH057', isActive: true };
    const where = { id: 'u-ruwan' };

    beforeEach(() => {
      when(txUser.findFirst(anything())).thenResolve(before);
      when(txUser.updateMany(anything())).thenResolve({ count: 1 });
      when(keycloak.setRealmRole(anything(), anything(), anything())).thenResolve();
      when(keycloak.updateUser(anything(), anything())).thenResolve();
      when(keycloak.logoutUser(anything())).thenResolve(true);
    });

    it('a change without access fields does not touch Keycloak or open a transaction', async () => {
      when(user.updateMany(anything())).thenResolve({ count: 1 });
      await expect(service.updateUser(where, { name: 'Ruwan B', phone: '077' }, personas.admin)).resolves.toBe(1);
      verify(keycloak.setRealmRole(anything(), anything(), anything())).never();
      verify(keycloak.logoutUser(anything())).never();
      expect(tx.committed).toBe(false);
    });

    it('role change: maps the new realm role (removing the old app role), logs the user out, audits, commits', async () => {
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).resolves.toBe(1);

      verify(keycloak.setRealmRole('u-ruwan', 'loader', deepEqual(['dispatcher', 'loader', 'driver', 'store_manager', 'admin']))).once();
      verify(keycloak.updateUser(anything(), anything())).never();
      verify(keycloak.logoutUser('u-ruwan')).once();
      expect(capture(txUser.updateMany).last()[0]).toEqual({ where, data: { role: 'LOADER' } });
      expect(tx).toMatchObject({ committed: true, rolledBack: false });
      expect(tx.options.timeout).toBeGreaterThanOrEqual(30_000);
      expect(audits()[0]).toMatchObject({
        action: 'Users.SyncAccess',
        entityKey: 'u-ruwan',
        outcome: 'SUCCESS',
        payload: { changed: ['role'], sessionsRevoked: true },
      });
    });

    it('depot, outlet and vehicle changes update the attributes (null removes), then end sessions', async () => {
      await service.updateUser(where, { depot: 'PELIYAGODA', vehicleId: null }, personas.admin);
      verify(keycloak.setRealmRole(anything(), anything(), anything())).never();
      const [id, changes] = capture(keycloak.updateUser).last();
      expect(id).toBe('u-ruwan');
      expect(changes).toEqual({ attributes: { depot: ['PELIYAGODA'], outlet_id: null, vehicle_id: null, staff_id: null } });
      verify(keycloak.logoutUser('u-ruwan')).once();
      expect(tx.committed).toBe(true);
    });

    it('a store manager move sets outlet_id; deactivation disables the identity', async () => {
      when(txUser.findFirst(anything())).thenResolve({ ...before, role: 'STORE_MANAGER', outletId: 'OUT106', vehicleId: null });
      await service.updateUser(where, { outletId: 'OUT108', isActive: false }, personas.admin);
      expect(capture(keycloak.updateUser).last()[1]).toEqual({
        attributes: { depot: ['KANDY'], outlet_id: ['OUT108'], vehicle_id: null, staff_id: null },
        enabled: false,
      });
    });

    it('an access field set to its current value changes nothing in Keycloak', async () => {
      await expect(service.updateUser(where, { role: 'DRIVER', vehicleId: 'VEH057' }, personas.admin)).resolves.toBe(1);
      verify(keycloak.setRealmRole(anything(), anything(), anything())).never();
      verify(keycloak.logoutUser(anything())).never();
      verify(audit.record(anything())).never();
    });

    it('Keycloak failure: rolls the row back, restores Keycloak, audits FAILED, answers 502', async () => {
      when(keycloak.updateUser(anything(), anything())).thenCall(async (_id: string, changes: any) => {
        // The forward change fails; the restore (back to KANDY / VEH057) succeeds.
        if (changes.attributes?.depot?.[0] === 'PELIYAGODA') throw new ODataError(502, 'BadGateway', 'Identity provider answered HTTP 500');
      });

      await expect(service.updateUser(where, { role: 'LOADER', depot: 'PELIYAGODA' }, personas.admin)).rejects.toMatchObject({ status: 502 });

      expect(tx).toMatchObject({ committed: false, rolledBack: true });
      // Forward: loader; restore: driver again.
      verify(keycloak.setRealmRole('u-ruwan', 'loader', anything())).once();
      verify(keycloak.setRealmRole('u-ruwan', 'driver', anything())).once();
      expect(capture(keycloak.updateUser).last()[1]).toEqual({ attributes: { depot: ['KANDY'], outlet_id: null, vehicle_id: ['VEH057'], staff_id: null } });
      verify(keycloak.logoutUser(anything())).never();
      expect(audits()[0]).toMatchObject({ action: 'Users.SyncAccess', outcome: 'FAILED', payload: { identityRestored: true, changed: ['role', 'depot'] } });
    });

    it('identity provider unreachable: 503 and rollback', async () => {
      when(keycloak.setRealmRole(anything(), anything(), anything())).thenReject(new ODataError(503, 'ServiceUnavailable', 'The identity provider is not reachable'));
      await expect(service.updateUser(where, { role: 'ADMIN' }, personas.admin)).rejects.toMatchObject({ status: 503 });
      expect(tx.rolledBack).toBe(true);
      expect(audits()[0]).toMatchObject({ outcome: 'FAILED', payload: { identityRestored: false } });
    });

    it('sessions that cannot be ended fail the change (502) so no token keeps stale claims', async () => {
      when(keycloak.logoutUser(anything())).thenResolve(false);
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).rejects.toMatchObject({ status: 502 });
      expect(tx.rolledBack).toBe(true);
      verify(keycloak.setRealmRole('u-ruwan', 'driver', anything())).once();
    });

    it('an unexpected error becomes a 502', async () => {
      when(keycloak.setRealmRole(anything(), anything(), anything())).thenReject(new TypeError('fetch failed'));
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).rejects.toMatchObject({ status: 502, code: 'BadGateway' });
    });

    it('a stale row (ETag moved) changes nothing and calls no one', async () => {
      when(txUser.findFirst(anything())).thenResolve(null);
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).resolves.toBe(0);
      verify(txUser.updateMany(anything())).never();
      verify(keycloak.setRealmRole(anything(), anything(), anything())).never();
    });

    it('without a Keycloak admin API the directory is still updated', async () => {
      when(keycloak.configured).thenReturn(false);
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).resolves.toBe(1);
      verify(keycloak.setRealmRole(anything(), anything(), anything())).never();
      expect(tx.committed).toBe(true);
    });

    it('an audit sink failure does not mask the result', async () => {
      when(audit.record(anything())).thenReject(new Error('audit down'));
      await expect(service.updateUser(where, { role: 'LOADER' }, personas.admin)).resolves.toBe(1);
    });

    it('a new staff ID reaches the staff_id attribute', async () => {
      when(txUser.findFirst(anything())).thenResolve({ ...before, role: 'LOADER', vehicleId: null, staffId: 'KDY-0427' });
      await service.updateUser(where, { staffId: 'KDY-0430' }, personas.admin);
      expect(capture(keycloak.updateUser).last()[1]).toEqual({ attributes: { depot: ['KANDY'], outlet_id: null, vehicle_id: null, staff_id: ['KDY-0430'] } });
      verify(keycloak.logoutUser('u-ruwan')).once();
    });

    it('someone who stops being a loader loses the staff ID and the Dock PIN (audited)', async () => {
      when(txUser.findFirst(anything())).thenResolve({ ...before, role: 'LOADER', vehicleId: null, staffId: 'KDY-0427' });
      when(keycloak.removePin(anything())).thenResolve();
      await service.updateUser(where, { role: 'DISPATCHER', staffId: null }, personas.admin);
      verify(keycloak.removePin('u-ruwan')).once();
      expect(capture(keycloak.updateUser).last()[1]).toMatchObject({ attributes: { staff_id: null } });
      expect(audits()[0]).toMatchObject({ action: 'Users.SyncAccess', outcome: 'SUCCESS', payload: { pinRemoved: true } });
    });

    it('a PIN that cannot be removed does not undo the role change (logged, audited pinRemoved: false)', async () => {
      when(txUser.findFirst(anything())).thenResolve({ ...before, role: 'LOADER', vehicleId: null, staffId: 'KDY-0427' });
      when(keycloak.removePin(anything())).thenReject(new ODataError(502, 'BadGateway', 'x'));
      await expect(service.updateUser(where, { role: 'DISPATCHER', staffId: null }, personas.admin)).resolves.toBe(1);
      expect(tx.committed).toBe(true);
      expect(audits()[0]).toMatchObject({ payload: { pinRemoved: false } });
    });

    it('other role changes leave PINs alone', async () => {
      await service.updateUser(where, { role: 'LOADER' }, personas.admin);
      verify(keycloak.removePin(anything())).never();
    });

    it('a staff ID taken in a race answers 409, not 500', async () => {
      when(txUser.updateMany(anything())).thenReject(Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['staffId'] } }));
      await expect(service.updateUser(where, { role: 'LOADER', staffId: 'KDY-0427' }, personas.admin)).rejects.toMatchObject({ status: 409, target: 'staffId' });
    });
  });
});

describe('AuthService device enrollment and approval', () => {
  interface DeviceDelegate {
    findUnique(a: any): Promise<any>;
    findMany(a: any): Promise<any[]>;
    count(a: any): Promise<number>;
    create(a: any): Promise<any>;
    update(a: any): Promise<any>;
    updateMany(a: any): Promise<{ count: number }>;
  }
  let device: DeviceDelegate;
  let txDevice: DeviceDelegate;
  let keycloak: KeycloakAdminClient;
  let posture: DevicePostureService;
  let audit: AuditSink;
  let service: AuthService;
  let tx: { committed: boolean; rolledBack: boolean };

  const audits = (): AuditEvent[] => {
    const out: AuditEvent[] = [];
    for (let i = 0; ; i++) {
      try {
        out.push(capture(audit.record).byCallIndex(i)[0]);
      } catch {
        return out;
      }
    }
  };

  beforeEach(() => {
    device = mock<DeviceDelegate>();
    txDevice = mock<DeviceDelegate>();
    keycloak = mock(KeycloakAdminClient);
    posture = mock(DevicePostureService);
    audit = mock<AuditSink>();
    tx = { committed: false, rolledBack: false };
    const prisma = {
      device: instance(device),
      $transaction: async (fn: (t: any) => Promise<any>) => {
        try {
          const result = await fn({ device: instance(txDevice) });
          tx.committed = true;
          return result;
        } catch (err) {
          tx.rolledBack = true;
          throw err;
        }
      },
    };
    service = new AuthService(prisma as any, instance(keycloak), instance(posture), instance(audit));
    when(audit.record(anything())).thenResolve();
    when(keycloak.configured).thenReturn(true);
  });

  describe('enrollDevice (self-enrollment, SM-31 -> SM-32)', () => {
    const req = { id: 'DEV-NEWPHONE01', platform: 'android', model: 'Galaxy A15', label: "Fathima's phone" };
    const p = enrolling(personas.fathima, 'DEV-NEWPHONE01', 'DeviceMismatch');

    beforeEach(() => {
      when(device.findUnique(anything())).thenResolve(null);
      when(device.count(anything())).thenResolve(0);
      when(device.create(anything())).thenCall(async (a: any) => ({ ...a.data, registeredAt: new Date() }));
    });

    it('creates a PENDING row for the caller and audits Devices.Enroll', async () => {
      const row = await service.enrollDevice(req, { ...p, deviceId: 'DEV-FR-01' });
      expect(capture(device.create).last()[0].data).toEqual({ ...req, userId: 'fathima', status: 'PENDING' });
      expect(row).toMatchObject({ id: 'DEV-NEWPHONE01', status: 'PENDING' });
      expect(audits()[0]).toMatchObject({
        actor: 'fathima',
        action: 'Devices.Enroll',
        entitySet: 'Devices',
        entityKey: 'DEV-NEWPHONE01',
        outcome: 'SUCCESS',
        payload: { status: 'PENDING', repeat: false, platform: 'android', tokenDeviceId: 'DEV-FR-01', postureWaived: 'DeviceMismatch' },
      });
      verify(keycloak.updateUser(anything(), anything())).never();
    });

    it('is idempotent per user and phone: asking again returns the existing row (any status)', async () => {
      for (const status of ['PENDING', 'ACTIVE', 'REVOKED']) {
        when(device.findUnique(anything())).thenResolve({ id: 'DEV-NEWPHONE01', userId: 'fathima', status });
        await expect(service.enrollDevice(req, p)).resolves.toMatchObject({ id: 'DEV-NEWPHONE01', status });
      }
      verify(device.create(anything())).never();
      expect(audits().map((a) => a.payload)).toEqual([
        expect.objectContaining({ repeat: true, status: 'PENDING' }),
        expect.objectContaining({ repeat: true, status: 'ACTIVE' }),
        expect.objectContaining({ repeat: true, status: 'REVOKED' }),
      ]);
    });

    it('409 when the phone is registered to someone else (audited DENIED)', async () => {
      when(device.findUnique(anything())).thenResolve({ id: 'DEV-NEWPHONE01', userId: 'ruwan', status: 'ACTIVE' });
      await expect(service.enrollDevice(req, p)).rejects.toMatchObject({ status: 409, target: 'id' });
      expect(audits()[0]).toMatchObject({ action: 'Devices.Enroll', outcome: 'DENIED' });
    });

    it('caps the phones waiting for approval per user', async () => {
      when(device.count(anything())).thenResolve(3);
      await expect(service.enrollDevice(req, p)).rejects.toMatchObject({ status: 409 });
      expect(capture(device.count).last()[0]).toEqual({ where: { userId: 'fathima', status: 'PENDING' } });
      verify(device.create(anything())).never();
    });

    it('a concurrent duplicate insert answers like a repeat', async () => {
      when(device.create(anything())).thenReject(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
      when(device.findUnique(anything())).thenResolve(null).thenResolve({ id: 'DEV-NEWPHONE01', userId: 'fathima', status: 'PENDING' });
      await expect(service.enrollDevice(req, p)).resolves.toMatchObject({ status: 'PENDING' });
    });

    it('other database errors propagate', async () => {
      when(device.create(anything())).thenReject(new Error('db down'));
      await expect(service.enrollDevice(req, p)).rejects.toThrow('db down');
    });
  });

  describe('activateDevice (ADM-05, all or nothing with Keycloak)', () => {
    const pending = { id: 'DEV-NEWPHONE01', userId: 'fathima', status: 'PENDING' };

    beforeEach(() => {
      when(txDevice.findUnique(anything())).thenResolve(pending);
      when(txDevice.findMany(anything())).thenResolve([{ id: 'DEV-FR-01' }]);
      when(txDevice.update(anything())).thenCall(async (a: any) => ({ ...pending, ...a.data }));
      when(txDevice.updateMany(anything())).thenResolve({ count: 1 });
      when(keycloak.getAttribute(anything(), anything())).thenResolve(['DEV-FR-01']);
      when(keycloak.updateUser(anything(), anything())).thenResolve();
      when(keycloak.logoutUser(anything())).thenResolve(true);
    });

    it('activates, revokes the previous ACTIVE phone, binds device_id in Keycloak, ends sessions, commits, audits', async () => {
      const res = await service.activateDevice('DEV-NEWPHONE01', personas.admin);

      expect(capture(txDevice.update).last()[0]).toEqual({
        where: { id: 'DEV-NEWPHONE01' },
        data: { status: 'ACTIVE', revokedAt: null, revokedBy: null, revokeReason: null },
      });
      expect(capture(txDevice.findMany).last()[0].where).toEqual({ userId: 'fathima', status: 'ACTIVE', NOT: { id: 'DEV-NEWPHONE01' } });
      const [revoked] = capture(txDevice.updateMany).last();
      expect(revoked.where).toEqual({ id: { in: ['DEV-FR-01'] } });
      expect(revoked.data).toMatchObject({ status: 'REVOKED', revokedBy: 'admin', revokeReason: 'Replaced by DEV-NEWPHONE01' });

      verify(keycloak.updateUser('fathima', deepEqual({ attributes: { device_id: ['DEV-NEWPHONE01'] } }))).once();
      verify(keycloak.logoutUser('fathima')).once();
      expect(tx).toEqual({ committed: true, rolledBack: false });
      verify(posture.invalidate('DEV-NEWPHONE01')).once();
      verify(posture.invalidate('DEV-FR-01')).once();
      expect(res).toMatchObject({ id: 'DEV-NEWPHONE01', status: 'ACTIVE', replacedDeviceIds: ['DEV-FR-01'], identitySynced: true, sessionsRevoked: true });
      expect(audits()[0]).toMatchObject({
        actor: 'admin',
        action: 'Devices.BindIdentity',
        entitySet: 'Devices',
        entityKey: 'DEV-NEWPHONE01',
        outcome: 'SUCCESS',
        payload: { userId: 'fathima', replaced: ['DEV-FR-01'], identitySynced: true },
      });
    });

    it('without a previous phone revokes nothing', async () => {
      when(txDevice.findMany(anything())).thenResolve([]);
      await service.activateDevice('DEV-NEWPHONE01', personas.admin);
      verify(txDevice.updateMany(anything())).never();
      expect(tx.committed).toBe(true);
    });

    it('Keycloak write fails: restores the old device_id, rolls back, audits FAILED, answers 502', async () => {
      when(keycloak.updateUser(anything(), anything())).thenCall(async (_id: string, changes: any) => {
        if (changes.attributes.device_id?.[0] === 'DEV-NEWPHONE01') throw new ODataError(502, 'BadGateway', 'Identity provider answered HTTP 500');
      });
      await expect(service.activateDevice('DEV-NEWPHONE01', personas.admin)).rejects.toMatchObject({ status: 502 });
      expect(tx).toEqual({ committed: false, rolledBack: true });
      expect(capture(keycloak.updateUser).last()[1]).toEqual({ attributes: { device_id: ['DEV-FR-01'] } });
      verify(keycloak.logoutUser(anything())).never();
      verify(posture.invalidate(anything())).never();
      expect(audits()).toHaveLength(1);
      expect(audits()[0]).toMatchObject({ action: 'Devices.BindIdentity', outcome: 'FAILED', payload: { previous: ['DEV-FR-01'], identityRestored: true } });
    });

    it('sessions that cannot be ended fail the approval (502) and restore a user that had no device_id', async () => {
      when(keycloak.getAttribute(anything(), anything())).thenResolve(null);
      when(keycloak.logoutUser(anything())).thenResolve(false);
      await expect(service.activateDevice('DEV-NEWPHONE01', personas.admin)).rejects.toMatchObject({ status: 502, code: 'BadGateway' });
      expect(tx.rolledBack).toBe(true);
      expect(capture(keycloak.updateUser).last()[1]).toEqual({ attributes: { device_id: null } });
    });

    it('identity provider unreachable: 503, nothing written to Keycloak, rollback', async () => {
      when(keycloak.getAttribute(anything(), anything())).thenReject(new ODataError(503, 'ServiceUnavailable', 'The identity provider is not reachable'));
      await expect(service.activateDevice('DEV-NEWPHONE01', personas.admin)).rejects.toMatchObject({ status: 503 });
      expect(tx.rolledBack).toBe(true);
      verify(keycloak.updateUser(anything(), anything())).never();
      expect(audits()[0]).toMatchObject({ outcome: 'FAILED', payload: { identityRestored: true } });
    });

    it('a failed restore is reported (identityRestored false) and the error still surfaces', async () => {
      when(keycloak.updateUser(anything(), anything())).thenReject(new TypeError('fetch failed'));
      await expect(service.activateDevice('DEV-NEWPHONE01', personas.admin)).rejects.toMatchObject({ status: 502 });
      expect(audits()[0]).toMatchObject({ outcome: 'FAILED', payload: { identityRestored: false } });
    });

    it('404 for an unknown device', async () => {
      when(txDevice.findUnique(anything())).thenResolve(null);
      await expect(service.activateDevice('DEV-NOPE-01', personas.admin)).rejects.toMatchObject({ status: 404 });
      verify(keycloak.getAttribute(anything(), anything())).never();
    });

    it('without a Keycloak admin API the rows are still committed (not synced)', async () => {
      when(keycloak.configured).thenReturn(false);
      await expect(service.activateDevice('DEV-NEWPHONE01', personas.admin)).resolves.toMatchObject({ status: 'ACTIVE', identitySynced: false });
      verify(keycloak.updateUser(anything(), anything())).never();
      expect(tx.committed).toBe(true);
    });
  });
});

describe('KeycloakAdminClient', () => {
  const saved = { url: process.env.KEYCLOAK_ADMIN_URL, realm: process.env.KEYCLOAK_REALM };
  let tokens: ServiceTokenClient;

  const res = (status: number, init: { location?: string; body?: unknown } = {}) =>
    new Response(init.body !== undefined ? JSON.stringify(init.body) : null, {
      status,
      headers: init.location ? { Location: init.location } : {},
    });

  function build(url: string | null = 'http://identity:8080/auth/') {
    if (url === null) delete process.env.KEYCLOAK_ADMIN_URL;
    else process.env.KEYCLOAK_ADMIN_URL = url;
    delete process.env.KEYCLOAK_REALM;
    return new KeycloakAdminClient(instance(tokens));
  }

  beforeEach(() => {
    tokens = mock(ServiceTokenClient);
    when(tokens.configured).thenReturn(true);
  });

  afterEach(() => {
    if (saved.url === undefined) delete process.env.KEYCLOAK_ADMIN_URL;
    else process.env.KEYCLOAK_ADMIN_URL = saved.url;
    if (saved.realm === undefined) delete process.env.KEYCLOAK_REALM;
    else process.env.KEYCLOAK_REALM = saved.realm;
  });

  const newUser = { email: 'a@b.lk', firstName: 'A', lastName: 'B', role: 'driver', attributes: { depot: ['KANDY'] } };

  it('createUser returns the id from the Location header and maps the realm role', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenCall(async (url: string, init: RequestInit) => {
      if (init.method === 'POST' && url.endsWith('/users')) return res(201, { location: 'http://identity:8080/auth/admin/realms/lodestar/users/kc-42' });
      if (init.method === 'GET') return res(200, { body: { id: 'role-1', name: 'driver' } });
      return res(204);
    });

    await expect(client.createUser(newUser)).resolves.toBe('kc-42');

    const first = capture(tokens.fetch).first();
    expect(first[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users');
    expect(JSON.parse(String(first[1].body))).toMatchObject({ username: 'a@b.lk', email: 'a@b.lk', enabled: true, attributes: { depot: ['KANDY'] } });
    expect(capture(tokens.fetch).second()[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/roles/driver');
    const third = capture(tokens.fetch).third();
    expect(third[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users/kc-42/role-mappings/realm');
    expect(JSON.parse(String(third[1].body))).toEqual([{ id: 'role-1', name: 'driver' }]);
  });

  it('createUser maps 409 to ODataError 409 and other failures to 502', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(409));
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 409, target: 'email' });
    when(tokens.fetch(anything(), anything())).thenResolve(res(500));
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502 });
    when(tokens.fetch(anything(), anything())).thenResolve(res(201));
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502 });
  });

  it('createUser fails with 502 when the realm role is missing or cannot be granted', async () => {
    const client = build();
    const created = () => res(201, { location: 'http://identity:8080/auth/admin/realms/lodestar/users/kc-42' });

    when(tokens.fetch(anything(), anything())).thenCall(async (_url: string, init: RequestInit) =>
      init.method === 'POST' ? created() : res(404),
    );
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502 });

    when(tokens.fetch(anything(), anything())).thenCall(async (url: string, init: RequestInit) => {
      if (init.method === 'GET') return res(200, { body: { id: 'role-1', name: 'driver' } });
      return url.endsWith('/role-mappings/realm') ? res(403) : created();
    });
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502 });
  });

  it('createUser deletes the half-created user when the realm role cannot be granted', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenCall(async (url: string, init: RequestInit) => {
      if (init.method === 'POST' && url.endsWith('/users')) return res(201, { location: 'http://identity:8080/auth/admin/realms/lodestar/users/kc-42' });
      if (init.method === 'GET') return res(404);
      return res(204);
    });
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502 });
    const last = capture(tokens.fetch).last();
    expect(last[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users/kc-42');
    expect(last[1].method).toBe('DELETE');

    // A failing cleanup is logged; the original error still surfaces.
    when(tokens.fetch(anything(), anything())).thenCall(async (url: string, init: RequestInit) => {
      if (init.method === 'POST' && url.endsWith('/users')) return res(201, { location: 'http://identity:8080/auth/admin/realms/lodestar/users/kc-43' });
      return res(500);
    });
    await expect(client.createUser(newUser)).rejects.toMatchObject({ status: 502, message: "Identity provider has no realm role 'driver'" });
  });

  it('deleteUser: 204 and 404 are success, other errors are 502', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(204));
    await expect(client.deleteUser('kc 1')).resolves.toBeUndefined();
    expect(capture(tokens.fetch).last()[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users/kc%201');
    expect(capture(tokens.fetch).last()[1].method).toBe('DELETE');
    when(tokens.fetch(anything(), anything())).thenResolve(res(404));
    await expect(client.deleteUser('kc-1')).resolves.toBeUndefined();
    when(tokens.fetch(anything(), anything())).thenResolve(res(500));
    await expect(client.deleteUser('kc-1')).rejects.toMatchObject({ status: 502 });
  });

  describe('setRealmRole', () => {
    const managed = ['dispatcher', 'loader', 'driver', 'store_manager', 'admin'];
    const calls = () => {
      const out: { method: string; url: string; body: any }[] = [];
      for (let i = 0; ; i++) {
        try {
          const [url, init] = capture(tokens.fetch).byCallIndex(i);
          out.push({ method: String(init.method), url: String(url).replace('http://identity:8080/auth/admin/realms/lodestar', ''), body: init.body ? JSON.parse(String(init.body)) : undefined });
        } catch {
          return out;
        }
      }
    };

    it('grants the new role and removes other app roles, keeping default roles', async () => {
      const client = build();
      when(tokens.fetch(anything(), anything())).thenCall(async (url: string, init: RequestInit) => {
        if (init.method === 'GET' && url.endsWith('/role-mappings/realm')) {
          return res(200, { body: [{ id: 'r-drv', name: 'driver' }, { id: 'r-def', name: 'default-roles-lodestar' }, { id: 'r-off', name: 'offline_access' }] });
        }
        if (init.method === 'GET') return res(200, { body: { id: 'r-ldr', name: 'loader' } });
        return res(204);
      });
      await client.setRealmRole('u1', 'loader', managed);
      expect(calls()).toEqual([
        { method: 'GET', url: '/users/u1/role-mappings/realm', body: undefined },
        { method: 'GET', url: '/roles/loader', body: undefined },
        { method: 'POST', url: '/users/u1/role-mappings/realm', body: [{ id: 'r-ldr', name: 'loader' }] },
        { method: 'DELETE', url: '/users/u1/role-mappings/realm', body: [{ id: 'r-drv', name: 'driver' }] },
      ]);
    });

    it('does nothing more when the role is already the only app role', async () => {
      const client = build();
      when(tokens.fetch(anything(), anything())).thenResolve(res(200, { body: [{ id: 'r-ldr', name: 'loader' }] }));
      await client.setRealmRole('u1', 'loader', managed);
      verify(tokens.fetch(anything(), anything())).once();
    });

    it('fails with 502 when roles cannot be read or removed', async () => {
      const client = build();
      when(tokens.fetch(anything(), anything())).thenResolve(res(500));
      await expect(client.setRealmRole('u1', 'loader', managed)).rejects.toMatchObject({ status: 502 });
      when(tokens.fetch(anything(), anything())).thenCall(async (_url: string, init: RequestInit) =>
        init.method === 'GET' ? res(200, { body: [{ id: 'r-ldr', name: 'loader' }, { id: 'r-adm', name: 'admin' }] }) : res(403),
      );
      await expect(client.setRealmRole('u1', 'loader', managed)).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('updateUser', () => {
    it('merges attributes into the current representation (null removes) and sets enabled', async () => {
      const client = build();
      const current = { id: 'u1', username: 'r@x.lk', enabled: true, attributes: { depot: ['KANDY'], vehicle_id: ['VEH057'], device_id: ['DEV-RB-01'] } };
      when(tokens.fetch(anything(), anything())).thenCall(async (_url: string, init: RequestInit) => (init.method === 'GET' ? res(200, { body: current }) : res(204)));
      await client.updateUser('u1', { attributes: { depot: ['PELIYAGODA'], outlet_id: null, vehicle_id: null }, enabled: false });
      const [url, init] = capture(tokens.fetch).last();
      expect(url).toBe('http://identity:8080/auth/admin/realms/lodestar/users/u1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(String(init.body))).toEqual({
        id: 'u1',
        username: 'r@x.lk',
        enabled: false,
        attributes: { depot: ['PELIYAGODA'], device_id: ['DEV-RB-01'] },
      });
    });

    it('fails with 502 when the user cannot be read or written', async () => {
      const client = build();
      when(tokens.fetch(anything(), anything())).thenResolve(res(404));
      await expect(client.updateUser('u1', { enabled: false })).rejects.toMatchObject({ status: 502 });
      when(tokens.fetch(anything(), anything())).thenCall(async (_url: string, init: RequestInit) => (init.method === 'GET' ? res(200, { body: { id: 'u1' } }) : res(500)));
      await expect(client.updateUser('u1', { enabled: false })).rejects.toMatchObject({ status: 502 });
    });
  });

  it('is not configured without a URL or service credentials (503)', async () => {
    const noUrl = build(null);
    expect(noUrl.configured).toBe(false);
    await expect(noUrl.createUser(newUser)).rejects.toMatchObject({ status: 503 });
    await expect(noUrl.logoutUser('u1')).rejects.toMatchObject({ status: 503 });

    when(tokens.configured).thenReturn(false);
    const noCreds = build();
    expect(noCreds.configured).toBe(false);
    verify(tokens.fetch(anything(), anything())).never();
  });

  it('maps a network failure to 503', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenReject(new Error('ECONNREFUSED'));
    await expect(client.logoutUser('u1')).rejects.toMatchObject({ status: 503 });
  });

  it('logoutUser: 204 and 404 are success, other errors are false', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(204));
    await expect(client.logoutUser('u 1')).resolves.toBe(true);
    expect(capture(tokens.fetch).last()[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users/u%201/logout');
    when(tokens.fetch(anything(), anything())).thenResolve(res(404));
    await expect(client.logoutUser('u1')).resolves.toBe(true);
    when(tokens.fetch(anything(), anything())).thenResolve(res(500));
    await expect(client.logoutUser('u1')).resolves.toBe(false);
  });

  it('getAttribute reads one attribute of the user (null when missing), 502 on errors', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenCall(async () => res(200, { body: { id: 'u1', attributes: { device_id: ['DEV-RB-01'], depot: ['KANDY'] } } }));
    await expect(client.getAttribute('u 1', 'device_id')).resolves.toEqual(['DEV-RB-01']);
    expect(capture(tokens.fetch).last()[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/users/u%201');
    expect(capture(tokens.fetch).last()[1].method).toBe('GET');
    await expect(client.getAttribute('u1', 'vehicle_id')).resolves.toBeNull();
    when(tokens.fetch(anything(), anything())).thenResolve(res(200, { body: { id: 'u1' } }));
    await expect(client.getAttribute('u1', 'device_id')).resolves.toBeNull();
    when(tokens.fetch(anything(), anything())).thenResolve(res(404));
    await expect(client.getAttribute('u1', 'device_id')).rejects.toMatchObject({ status: 502 });
  });

  it('setEnabled tolerates 404 and fails on other errors', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(404));
    await expect(client.setEnabled('u1', false)).resolves.toBeUndefined();
    when(tokens.fetch(anything(), anything())).thenResolve(res(500));
    await expect(client.setEnabled('u1', false)).rejects.toMatchObject({ status: 502 });
  });

  it('setPin posts the PIN to the extension endpoint (lodestar-pin) and never puts it in an error', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(204));
    await expect(client.setPin('u 1', '2468')).resolves.toBeUndefined();
    const [url, init] = capture(tokens.fetch).last();
    expect(url).toBe('http://identity:8080/auth/admin/realms/lodestar/lodestar-pin/u%201');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ pin: '2468' });
    for (const [status, code] of [[400, 400], [404, 502], [403, 502], [500, 502]]) {
      when(tokens.fetch(anything(), anything())).thenResolve(res(status));
      const err = await client.setPin('u1', '2468').catch((e) => e);
      expect(err).toMatchObject({ status: code });
      expect(JSON.stringify({ m: err.message, t: err.target })).not.toContain('2468');
    }
  });

  it('removePin deletes the PIN credential; a missing user counts as done', async () => {
    const client = build();
    when(tokens.fetch(anything(), anything())).thenResolve(res(204));
    await client.removePin('u1');
    expect(capture(tokens.fetch).last()[0]).toBe('http://identity:8080/auth/admin/realms/lodestar/lodestar-pin/u1');
    expect(capture(tokens.fetch).last()[1].method).toBe('DELETE');
    when(tokens.fetch(anything(), anything())).thenResolve(res(404));
    await expect(client.removePin('u1')).resolves.toBeUndefined();
    when(tokens.fetch(anything(), anything())).thenResolve(res(500));
    await expect(client.removePin('u1')).rejects.toMatchObject({ status: 502 });
  });
});
