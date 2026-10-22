import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { assertDepotCode, EntitySet, ODataAction, ODataEntitySet, ODataError, ODataFunction, OperationContext, WriteContext } from '@lodestar/odata';
import { ALL_ROLES, DEVICE_ID_PATTERN, HUMAN_ROLES, isPrivileged, Roles } from '@lodestar/security';
import { DeviceStatus, Role } from '@prisma/client';
import { AuthService, REALM_ROLE } from './auth.service';
import { nextStaffId, normalizeStaffId, STAFF_ID_PATTERN, staffPrefix } from './staff-id';

/** A Dock PIN set from ADM-04: exactly 4 digits (LD-06 "PIN · 4 digits"). */
export const DOCK_PIN_PATTERN = /^\d{4}$/;

/** The fields the per-role scope rules look at (ADM-04 validation). */
type Scope = { role: string; depot: string | null; outletId: string | null; vehicleId: string | null; staffId: string | null; isActive: boolean };
const SCOPE_FIELDS = ['role', 'depot', 'outletId', 'vehicleId', 'staffId', 'isActive'] as const;

/** Users: the directory (ADM-03/04). Dispatchers see people of their depots. */
@Injectable()
@EntitySet({
  name: 'Users',
  model: 'User',
  read: [Roles.Admin, Roles.Dispatcher, Roles.Service],
  create: [Roles.Admin],
  update: [Roles.Admin],
  abac: { depot: (depots) => ({ depot: { in: depots } }) },
  navigation: ['outlet', 'devices'],
  search: ['name', 'email', 'staffId'],
  // Personal settings are never part of the directory: only the user reads them (MyPreferences).
  hidden: ['preferences'],
  insertable: ['id', 'email', 'name', 'role', 'depot', 'outletId', 'vehicleId', 'staffId', 'phone'],
  updatable: ['name', 'role', 'depot', 'outletId', 'vehicleId', 'staffId', 'phone', 'isActive'],
  defaultOrderBy: 'name',
})
export class UsersSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly auth: AuthService,
  ) {
    super(prisma);
  }

  /**
   * Validation only: the identity is created in create(), next to the row, so it can be compensated.
   * Scope per role: a driver needs a depot and a vehicle of that depot (no other active driver on it), a loader a
   * depot and a unique staff ID, a store manager an existing outlet. Only a driver has a vehicle, only a loader a
   * staff ID. The loader's Dock PIN is set right after with SetDockPin (it is not a directory field).
   */
  async beforeCreate(data: Record<string, any>) {
    for (const f of ['email', 'name', 'role']) if (!data[f]) throw ODataError.badRequest(`${f} is required`, f);
    // role is an enum already validated by the OData body coercion; guard the REALM_ROLE mapping too.
    if (!REALM_ROLE[data.role as keyof typeof REALM_ROLE]) throw ODataError.badRequest('Unknown role', 'role');
    if ('staffId' in data) data.staffId = normalizeStaffId(data.staffId);
    if (data.depot) data.depot = await assertDepotCode(this.prisma, data.depot);
    await this.checkScope(this.scopeOf(data), new Set(SCOPE_FIELDS));
    return data;
  }

  /** Keycloak user, then the directory row; a failed insert deletes the Keycloak user again. */
  create(data: Record<string, any>, ctx: WriteContext) {
    return this.auth.createUser(data, ctx.principal);
  }

  /**
   * The same scope rules on the person as it will be, checked for what this PATCH changes (a name edit on an
   * older row without a vehicle or staff ID still saves). Leaving the driver or loader role clears the vehicle or
   * staff ID unless the patch sets one (which is refused).
   */
  async beforeUpdate(patch: Record<string, any>, current: any) {
    if ('staffId' in patch) patch.staffId = normalizeStaffId(patch.staffId);
    if (patch.depot) patch.depot = await assertDepotCode(this.prisma, patch.depot);
    const role = patch.role ?? current.role;
    if (role !== Role.DRIVER && current.vehicleId && !('vehicleId' in patch)) patch.vehicleId = null;
    if (role !== Role.LOADER && current.staffId && !('staffId' in patch)) patch.staffId = null;

    const before = this.scopeOf(current);
    const after = this.scopeOf({ ...current, ...patch });
    const changed = new Set<string>(SCOPE_FIELDS.filter((f) => before[f] !== after[f]));
    // Deactivating is always allowed; reactivating checks the person like a new one.
    if (changed.has('isActive') && !after.isActive) changed.delete('isActive');
    // A store manager is always bound to an outlet (the rule predates the others).
    if (after.role === Role.STORE_MANAGER) changed.add('outletId');
    if (changed.size) await this.checkScope(after, changed, current.id);
    return patch;
  }

  private scopeOf(u: Record<string, any>): Scope {
    return {
      role: u.role,
      depot: u.depot ?? null,
      outletId: u.outletId ?? null,
      vehicleId: u.vehicleId ?? null,
      staffId: u.staffId ?? null,
      isActive: u.isActive ?? true,
    };
  }

  /** The per-role scope rules; `changed` limits them to what the write changes (all of them on create). */
  private async checkScope(s: Scope, changed: Set<string>, selfId?: string) {
    const touched = (...f: string[]) => f.some((x) => changed.has(x));
    if (s.vehicleId && s.role !== Role.DRIVER) throw ODataError.badRequest('Only a driver has a vehicle', 'vehicleId');
    if (s.staffId && s.role !== Role.LOADER) throw ODataError.badRequest('Only a loader has a staff ID', 'staffId');

    if (s.role === Role.STORE_MANAGER && touched('role', 'outletId')) {
      if (!s.outletId) throw ODataError.badRequest('A store manager needs an outletId', 'outletId');
      await this.checkOutlet(s.outletId);
    }

    if (s.role === Role.DRIVER && touched('role', 'depot', 'vehicleId', 'isActive')) {
      // Format and existence first: the clearest error.
      const vehicle = s.vehicleId ? await this.checkVehicle(s.vehicleId) : null;
      if (!s.depot) throw ODataError.badRequest('A driver needs a depot', 'depot');
      if (!vehicle) throw ODataError.badRequest('A driver needs a vehicle', 'vehicleId');
      if (vehicle.depot && vehicle.depot !== s.depot) {
        throw ODataError.badRequest(`Vehicle ${s.vehicleId} belongs to depot ${vehicle.depot}, not ${s.depot}`, 'vehicleId');
      }
      // One active driver per vehicle: the vehicle_id claim decides whose phone runs its trips.
      if (s.isActive) {
        const other = await this.prisma.user.findFirst({
          where: { role: Role.DRIVER, isActive: true, vehicleId: s.vehicleId, ...(selfId ? { NOT: { id: selfId } } : {}) },
          select: { id: true, name: true },
        });
        if (other) {
          throw ODataError.conflict(`${s.vehicleId} is already assigned to ${other.name}. Give them another vehicle or disable them first.`, 'vehicleId');
        }
      }
    }

    if (s.role === Role.LOADER && touched('role', 'depot', 'staffId', 'isActive')) {
      if (!s.depot) throw ODataError.badRequest('A loader needs a depot', 'depot');
      if (!s.staffId) throw ODataError.badRequest('A loader needs a staff ID', 'staffId');
    }
    if (s.staffId && touched('staffId')) {
      if (!STAFF_ID_PATTERN.test(s.staffId)) throw ODataError.badRequest('A staff ID is a depot prefix and 4 digits, like KDY-0427', 'staffId');
      const other = await this.prisma.user.findFirst({
        where: { staffId: s.staffId, ...(selfId ? { NOT: { id: selfId } } : {}) },
        select: { id: true, name: true },
      });
      if (other) throw ODataError.conflict(`Staff ID ${s.staffId} is already taken by ${other.name}`, 'staffId');
    }
  }

  /** Directory row and Keycloak (role, ABAC attributes, enabled, sessions) together, or neither. */
  updateWhere(where: Record<string, any>, data: Record<string, any>, ctx?: WriteContext) {
    if (!ctx) throw new Error('UsersSet.updateWhere needs the write context');
    return this.auth.updateUser(where, data, ctx.principal);
  }

  private async checkVehicle(vehicleId: unknown): Promise<{ id: string; depot?: string | null }> {
    if (typeof vehicleId !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(vehicleId)) {
      throw ODataError.badRequest('vehicleId must be 1-32 letters, digits or dashes', 'vehicleId');
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, depot: true } });
    if (!vehicle) throw ODataError.badRequest(`Vehicle ${vehicleId} does not exist`, 'vehicleId');
    return vehicle;
  }

  private async checkOutlet(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
    if (!outlet) throw ODataError.badRequest(`Outlet ${outletId} does not exist`, 'outletId');
  }

  /**
   * POST /odata/v4/Users('…')/Lodestar.SetDockPin {pin} — ADM-04 "Set Dock PIN" / "Reset PIN" for a loader
   * (admins only). Keycloak stores it as its own credential type (the Lodestar extension hashes it); it is never
   * logged or returned, and the audit entry carries it redacted.
   */
  @ODataAction({
    name: 'SetDockPin',
    binding: 'entity',
    roles: [Roles.Admin],
    params: { pin: { type: 'Edm.String', required: true } },
    returns: 'Edm.Untyped',
  })
  setDockPin(ctx: OperationContext) {
    const pin = ctx.params.pin;
    if (typeof pin !== 'string' || !DOCK_PIN_PATTERN.test(pin)) throw ODataError.badRequest('A Dock PIN is 4 digits', 'pin');
    if (ctx.entity.role !== Role.LOADER) throw ODataError.badRequest('Only a loader has a Dock PIN', 'pin');
    if (!ctx.entity.isActive) throw ODataError.conflict('This person cannot sign in: enable them before setting a PIN');
    return this.auth.setDockPin(ctx.entity.id, pin);
  }

  /** GET /odata/v4/Users/Lodestar.NextStaffId(depot='KANDY') — ADM-04's suggestion for a new loader: {staffId: 'KDY-0428'}. */
  @ODataFunction({
    name: 'NextStaffId',
    binding: 'collection',
    roles: [Roles.Admin],
    params: { depot: { type: 'Edm.String', required: true } },
    returns: 'Edm.Untyped',
  })
  async nextStaffId(ctx: OperationContext) {
    const depot = await assertDepotCode(this.prisma, String(ctx.params.depot));
    const prefix = staffPrefix(depot);
    const taken: Array<{ staffId: string | null }> = await this.prisma.user.findMany({
      where: { staffId: { startsWith: `${prefix}-` } },
      select: { staffId: true },
    });
    return { depot, prefix, staffId: nextStaffId(prefix, taken.map((t) => t.staffId)) };
  }

  /** GET /odata/v4/Me() — session helper: claims plus directory row. */
  @ODataFunction({ name: 'Me', binding: 'unbound', roles: ALL_ROLES, returns: 'Edm.Untyped' })
  me(ctx: OperationContext) {
    return this.auth.me(ctx.principal);
  }

  /**
   * GET /odata/v4/Users/Lodestar.MyPreferences() — the caller's own settings (DSP-20, DSP-33, SM-30). Nobody
   * else's, admins included: the row is always the token subject's. Bound to Users so the gateway routes it to
   * auth, but open to every human role (store managers and field roles cannot list Users).
   */
  @ODataFunction({ name: 'MyPreferences', binding: 'collection', roles: HUMAN_ROLES, returns: 'Edm.Untyped' })
  myPreferences(ctx: OperationContext) {
    return this.auth.myPreferences(ctx.principal);
  }

  /** POST /odata/v4/Users/Lodestar.SaveMyPreferences {preferences} — merges sections into the caller's own settings. */
  @ODataAction({
    name: 'SaveMyPreferences',
    binding: 'collection',
    roles: HUMAN_ROLES,
    params: { preferences: { type: 'Edm.Untyped', required: true } },
    returns: 'Edm.Untyped',
  })
  saveMyPreferences(ctx: OperationContext) {
    return this.auth.saveMyPreferences(ctx.principal, ctx.params.preferences);
  }

  /** GET /odata/v4/Users/Lodestar.MyDispatcher() — the dispatcher of the caller's depot to call (SM-17, SM-39). */
  @ODataFunction({ name: 'MyDispatcher', binding: 'collection', roles: HUMAN_ROLES, returns: 'Edm.Untyped' })
  myDispatcher(ctx: OperationContext) {
    return this.auth.myDispatcher(ctx.principal);
  }

  /** GET /odata/v4/Users/Lodestar.MyTwoFactor() — whether the caller has an authenticator app in Keycloak (DSP-07). */
  @ODataFunction({ name: 'MyTwoFactor', binding: 'collection', roles: HUMAN_ROLES, returns: 'Edm.Untyped' })
  myTwoFactor(ctx: OperationContext) {
    return this.auth.myTwoFactor(ctx.principal);
  }

  /**
   * GET /odata/v4/Users/Lodestar.MyOutletUsers() — the active sign-ins of the caller's own outlet (SM-30 "Users &
   * access"): name and role only, the caller first. Store managers cannot list Users; nobody else's outlet is
   * readable. Empty when the token carries no outlet.
   */
  @ODataFunction({ name: 'MyOutletUsers', binding: 'collection', roles: [Roles.StoreManager], returns: 'Edm.Untyped' })
  async myOutletUsers(ctx: OperationContext) {
    const { sub, outletId } = ctx.principal;
    if (!outletId) return [];
    const rows: Array<{ id: string; name: string; role: string }> = await this.prisma.user.findMany({
      where: { outletId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    return rows
      .map(u => ({ id: u.id, name: u.name, role: u.role, self: u.id === sub }))
      .sort((a, b) => Number(b.self) - Number(a.self));
  }
}

/**
 * Devices: field-app device registry (device posture, PLATFORM.md §2.6).
 *  - Every field role registers its own phone (SM-31 "Ask Kandy Hub to add
 *    you"); it waits as PENDING until an admin activates it (ADM-05). A phone
 *    that is not bound to the token yet may still do this: the guard lets the
 *    self-enrollment routes through with `principal.enrollment` set, and the
 *    phone may then register only the id it presents as X-Device-Id.
 *  - People see only their own devices (abac.self); admins see all, activate
 *    (binding the token to the phone) and revoke lost phones (ADM-07).
 *  - `sharedDemo` marks the seeded persona phones. The field app reads its
 *    owner's row (Devices('id'), an enrollment route) and adopts the token's
 *    device_id as its install id only when the row is ACTIVE, sharedDemo and
 *    the caller's own. It is set by the seed only: never insertable or updatable.
 */
@Injectable()
@EntitySet({
  name: 'Devices',
  model: 'Device',
  read: [Roles.Admin, Roles.Dispatcher, Roles.Loader, Roles.Driver, Roles.StoreManager],
  create: [Roles.Admin, Roles.Dispatcher, Roles.Loader, Roles.Driver, Roles.StoreManager],
  update: [Roles.Admin],
  abac: { open: '*', self: (p) => ({ userId: p.sub }) },
  navigation: ['user'],
  search: ['id', 'label', 'model'],
  insertable: ['id', 'userId', 'label', 'platform', 'model'],
  updatable: ['label', 'platform', 'model'],
  defaultOrderBy: 'registeredAt desc',
})
export class DevicesSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly auth: AuthService,
  ) {
    super(prisma);
  }

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    const enrolling = ctx.principal.enrollment;
    if (enrolling) {
      // A phone asks for itself only: the key is the X-Device-Id it presented.
      if (data.id !== undefined && data.id !== enrolling.deviceId) {
        throw ODataError.badRequest('A phone can only ask for access for itself: id must equal its X-Device-Id', 'id');
      }
      data = { ...data, id: enrolling.deviceId };
    }
    if (!data.id || !DEVICE_ID_PATTERN.test(data.id)) throw ODataError.badRequest('id must be 4-64 letters, digits or dashes', 'id');
    const admin = isPrivileged(ctx.principal);
    return {
      ...data,
      // People register only their own device, and it waits for an admin.
      userId: admin ? (data.userId ?? ctx.principal.sub) : ctx.principal.sub,
      status: admin ? DeviceStatus.ACTIVE : DeviceStatus.PENDING,
      // Shared demo phones come from the seed only: no API call, an admin's included, can create one.
      sharedDemo: false,
    };
  }

  /** Admins insert directly; everyone else goes through self-enrollment (idempotent, audited). */
  create(data: Record<string, any>, ctx: WriteContext) {
    if (isPrivileged(ctx.principal)) return super.create(data, ctx);
    return this.auth.enrollDevice({ id: data.id, label: data.label, platform: data.platform, model: data.model }, ctx.principal);
  }

  /** POST Devices('DEV-RB-01')/Lodestar.Revoke {reason?} — lost phone (ADM-07). */
  @ODataAction({ name: 'Revoke', binding: 'entity', roles: [Roles.Admin], params: { reason: 'Edm.String' }, returns: 'Lodestar.Device' })
  revoke(ctx: OperationContext) {
    if (ctx.entity.status === DeviceStatus.REVOKED) throw ODataError.conflict('The device is already revoked');
    return this.auth.revokeDevice(ctx.entity.id, ctx.principal, ctx.params.reason);
  }

  /** POST Devices('…')/Lodestar.Activate — approve a phone (ADM-05) and bind the user's token to it. */
  @ODataAction({ name: 'Activate', binding: 'entity', roles: [Roles.Admin], returns: 'Lodestar.Device' })
  activate(ctx: OperationContext) {
    return this.auth.activateDevice(ctx.entity.id, ctx.principal);
  }
}
