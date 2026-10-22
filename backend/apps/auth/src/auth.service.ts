import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { ODataError } from '@lodestar/odata';
import { AUDIT_SINK, AuditOutcome, AuditSink, DevicePostureService, Principal } from '@lodestar/security';
import { DeviceStatus, Prisma, Role, User } from '@prisma/client';
import { KeycloakAdminClient } from './keycloak-admin.client';
import { mergePreferences, Preferences, validatePreferences } from './preferences';

/** Directory role (Prisma enum) → realm role (token). */
export const REALM_ROLE: Record<Role, string> = {
  DISPATCHER: 'dispatcher',
  LOADER: 'loader',
  DRIVER: 'driver',
  STORE_MANAGER: 'store_manager',
  ADMIN: 'admin',
};

/** The directory fields that decide what a user may do; Keycloak mirrors them into the token. */
export interface DirectoryAccess {
  role: Role;
  depot: string | null;
  outletId: string | null;
  vehicleId: string | null;
  /** a loader's Dock sign-in ID (the staff_id attribute the sign-in extension looks the loader up by) */
  staffId: string | null;
  isActive: boolean;
}

export const ACCESS_FIELDS = ['role', 'depot', 'outletId', 'vehicleId', 'staffId', 'isActive'] as const;

const accessOf = (u: Partial<DirectoryAccess>): DirectoryAccess => ({
  role: u.role as Role,
  depot: u.depot ?? null,
  outletId: u.outletId ?? null,
  vehicleId: u.vehicleId ?? null,
  staffId: u.staffId ?? null,
  isActive: u.isActive ?? true,
});

/** Keycloak user attributes (token claims depot, outlet_id, vehicle_id; the Dock sign-in's staff_id); null removes one. */
export function identityAttributes(a: Pick<DirectoryAccess, 'depot' | 'outletId' | 'vehicleId' | 'staffId'>): Record<string, string[] | null> {
  return {
    depot: a.depot ? [a.depot] : null,
    outlet_id: a.outletId ? [a.outletId] : null,
    vehicle_id: a.vehicleId ? [a.vehicleId] : null,
    staff_id: a.staffId ? [a.staffId] : null,
  };
}

/** A Keycloak round trip can take a while; keep the directory row locked for at most this long. */
const ACCESS_TX_TIMEOUT_MS = 45_000;

/** Keycloak attribute (token claim) that binds field tokens to one phone. */
export const DEVICE_ATTRIBUTE = 'device_id';

/** A user may have at most this many phones waiting for approval (self-enrollment spam guard). */
export const MAX_PENDING_DEVICES = 3;

/** An identity-provider failure as the OData error the caller sees: 5xx kept (503 unreachable), else 502. */
function identityError(err: unknown): ODataError {
  return err instanceof ODataError && err.status >= 500
    ? err
    : new ODataError(502, 'BadGateway', `Identity provider update failed: ${(err as Error)?.message ?? String(err)}`);
}

const isUniqueViolation = (err: unknown) => (err as { code?: unknown })?.code === 'P2002';

/** What a phone sends when it asks for access (POST Devices). */
export interface DeviceRequest {
  id: string;
  label?: string | null;
  platform?: string | null;
  model?: string | null;
}

type DeviceRow = { id: string; userId: string; status: DeviceStatus; platform?: string | null; model?: string | null };

/**
 * Auth service: session helpers (/Me), the user directory mirrored from the
 * identity provider, and the field-device registry (device posture).
 * Credentials never live here — Keycloak (Entra ID on Azure) owns them.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloak: KeycloakAdminClient,
    private readonly posture: DevicePostureService,
    @Inject(AUDIT_SINK) private readonly audit: AuditSink,
  ) {}

  /** Who am I: token claims plus the directory row (if any). */
  async me(p: Principal) {
    const user = await this.prisma.user.findUnique({
      where: { id: p.sub },
      select: { id: true, email: true, name: true, role: true, depot: true, outletId: true, vehicleId: true, staffId: true, phone: true, isActive: true },
    });
    return {
      sub: p.sub,
      name: p.name ?? user?.name ?? null,
      email: p.email ?? user?.email ?? null,
      roles: p.roles,
      depots: p.depots,
      outletId: p.outletId ?? null,
      vehicleId: p.vehicleId ?? null,
      deviceId: p.deviceId ?? null,
      clientId: p.clientId ?? null,
      // Set when this phone is not bound to the token yet (self-enrollment, SM-32).
      enrollment: p.enrollment ?? null,
      user,
    };
  }

  /** MyPreferences(): the signed-in user's own settings ({} when none are saved yet). */
  async myPreferences(p: Principal): Promise<Preferences> {
    const user = await this.prisma.user.findUnique({ where: { id: p.sub }, select: { preferences: true } });
    if (!user) throw ODataError.notFound('You have no Lodestar directory entry');
    return (user.preferences as Preferences | null) ?? {};
  }

  /**
   * MyDispatcher(): who the caller phones at their depot (SM-17/SM-39 "Call dispatcher"): an active dispatcher of
   * the caller's depot (a store's depot comes from its outlet when the token carries none), one with a phone first.
   * Only the name and phone are shown; store and field roles cannot list Users. Nulls when nobody is on file.
   */
  async myDispatcher(p: Principal): Promise<{ depot: string | null; name: string | null; phone: string | null }> {
    let depots = p.depots.filter((d) => !!d);
    if (!depots.length && p.outletId) {
      const outlet = await this.prisma.outlet.findUnique({ where: { id: p.outletId }, select: { depot: true } });
      if (outlet) depots = [outlet.depot];
    }
    if (!depots.length) return { depot: null, name: null, phone: null };
    const rows = await this.prisma.user.findMany({
      where: { role: Role.DISPATCHER, isActive: true, depot: { in: depots } },
      select: { name: true, phone: true, depot: true },
      orderBy: { name: 'asc' },
    });
    const pick = rows.find(r => r.phone?.trim()) ?? rows[0];
    return pick ? { depot: pick.depot ?? depots[0], name: pick.name, phone: pick.phone?.trim() || null } : { depot: depots[0], name: null, phone: null };
  }

  /** SaveMyPreferences({preferences}): merges the given sections into the signed-in user's own settings. */
  async saveMyPreferences(p: Principal, input: unknown): Promise<Preferences> {
    const patch = validatePreferences(input);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: p.sub }, select: { preferences: true } });
      if (!user) throw ODataError.notFound('You have no Lodestar directory entry');
      const next = mergePreferences(user.preferences, patch);
      await tx.user.update({ where: { id: p.sub }, data: { preferences: next as Prisma.InputJsonObject } });
      return next;
    });
  }

  /**
   * MyTwoFactor(): 2-step verification status of the signed-in user (DSP-07). Keycloak owns the codes; this only
   * reports whether an authenticator is set up. `available` is false when no identity admin API is configured.
   */
  async myTwoFactor(p: Principal) {
    if (!this.keycloak.configured) return { available: false, enabled: false, setupRequired: false, otp: [] as Array<{ label: string | null; createdAt: string | null }> };
    const status = await this.keycloak.twoFactor(p.sub);
    return { available: true, enabled: status.otp.length > 0, setupRequired: status.setupRequired, otp: status.otp };
  }

  /** ADM-04: create the identity first, then the directory row with the same id. */
  async createIdentity(data: Record<string, any>): Promise<string> {
    if (!this.keycloak.configured) {
      if (!data.id) throw ODataError.badRequest('id (the identity provider subject) is required when no identity admin API is configured', 'id');
      return data.id;
    }
    const [firstName, ...rest] = String(data.name).split(' ');
    const attributes: Record<string, string[]> = {};
    if (data.depot) attributes.depot = [data.depot];
    if (data.outletId) attributes.outlet_id = [data.outletId];
    if (data.vehicleId) attributes.vehicle_id = [data.vehicleId];
    if (data.staffId) attributes.staff_id = [data.staffId];
    return this.keycloak.createUser({
      email: data.email,
      firstName,
      lastName: rest.join(' '),
      role: REALM_ROLE[data.role as Role],
      attributes,
    });
  }

  /**
   * ADM-04 create: the identity first (its id is the directory key and the
   * token `sub`), then the directory row. If the row cannot be written the
   * identity is deleted again (compensation), logged and audited, so no
   * orphaned Keycloak user is left behind.
   */
  async createUser(data: Record<string, any>, actor: Principal): Promise<User> {
    // Cheap pre-check: do not create an identity for a row that cannot be inserted.
    const taken = await this.prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (taken) throw ODataError.conflict('A user with this email already exists', 'email');

    const id = await this.createIdentity(data);
    try {
      return await this.prisma.user.create({ data: { ...data, id } as Prisma.UserUncheckedCreateInput });
    } catch (err) {
      if (this.keycloak.configured) await this.compensateIdentity(id, data, actor, err as Error);
      // Two admins giving out the same staff ID at once: the loser gets a 409, not a 500.
      if (isUniqueViolation(err) && String((err as { meta?: { target?: unknown } }).meta?.target ?? '').includes('staffId')) {
        throw ODataError.conflict(`Staff ID ${data.staffId} is already taken`, 'staffId');
      }
      throw err;
    }
  }

  private async compensateIdentity(id: string, data: Record<string, any>, actor: Principal, cause: Error) {
    let outcome: AuditOutcome = 'SUCCESS';
    let error: string | undefined;
    try {
      await this.keycloak.deleteUser(id);
      this.logger.warn(`Users.Create: directory insert failed (${cause.message}); deleted Keycloak user ${id}`);
    } catch (err) {
      outcome = 'FAILED';
      error = (err as Error).message;
      this.logger.error(`Users.Create: directory insert failed and Keycloak user ${id} (${data.email}) could not be deleted: ${error}. Remove it by hand.`);
    }
    await this.record(actor, 'Users.CompensateIdentity', id, outcome, {
      reason: 'Directory insert failed after the identity was created',
      cause: cause.message,
      email: data.email,
      identityDeleted: outcome === 'SUCCESS',
      ...(error ? { error } : {}),
    });
  }

  /**
   * PATCH Users: writes the directory row and mirrors access changes (realm
   * role; depot, outlet_id, vehicle_id attributes; enabled) to Keycloak, then
   * ends the user's sessions so the next token carries the new claims.
   * All or nothing: the row is written in a transaction that commits only
   * after Keycloak accepted every change. On a Keycloak failure the Keycloak
   * side is restored as far as possible, the transaction rolls back and the
   * caller gets 502/503.
   *
   * Returns the number of rows changed (0 when `where` no longer matches,
   * e.g. a stale ETag).
   */
  async updateUser(where: Prisma.UserWhereInput, patch: Record<string, any>, actor: Principal): Promise<number> {
    try {
      return await this.writeUser(where, patch, actor);
    } catch (err) {
      if (isUniqueViolation(err) && String((err as { meta?: { target?: unknown } }).meta?.target ?? '').includes('staffId')) {
        throw ODataError.conflict(`Staff ID ${patch.staffId} is already taken`, 'staffId');
      }
      throw err;
    }
  }

  private async writeUser(where: Prisma.UserWhereInput, patch: Record<string, any>, actor: Principal): Promise<number> {
    const touchesAccess = ACCESS_FIELDS.some((f) => f in patch);
    if (!touchesAccess) return (await this.prisma.user.updateMany({ where, data: patch })).count;

    return this.prisma.$transaction(
      async (tx) => {
        const before = await tx.user.findFirst({ where });
        if (!before) return 0;
        const { count } = await tx.user.updateMany({ where, data: patch });
        if (count === 0) return 0;

        const from = accessOf(before);
        const to = accessOf({ ...before, ...patch });
        const changed = ACCESS_FIELDS.filter((f) => from[f] !== to[f]);
        if (!changed.length) return count;

        if (!this.keycloak.configured) {
          this.logger.warn(`Users.Update ${before.id}: no identity admin API configured; ${changed.join(', ')} not synced to the identity provider`);
          return count;
        }
        await this.syncAccess(before.id, from, to, changed, actor);
        return count;
      },
      { timeout: ACCESS_TX_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  /** Applies an access change in Keycloak; on failure restores `from` and throws (the caller rolls back). */
  private async syncAccess(userId: string, from: DirectoryAccess, to: DirectoryAccess, changed: string[], actor: Principal) {
    const payload = { changed, from, to };
    try {
      await this.applyIdentityAccess(userId, from, to);
      if (!(await this.keycloak.logoutUser(userId))) {
        throw new ODataError(502, 'BadGateway', `Could not end the sessions of ${userId}; access change rolled back`);
      }
    } catch (err) {
      let restored = true;
      try {
        await this.applyIdentityAccess(userId, to, from);
      } catch (undo) {
        restored = false;
        this.logger.error(`Users.Update ${userId}: Keycloak restore failed (${(undo as Error).message}); check the user by hand`);
      }
      const error = identityError(err);
      this.logger.warn(`Users.Update ${userId}: Keycloak sync failed (${error.message}); directory change rolled back`);
      await this.record(actor, 'Users.SyncAccess', userId, 'FAILED', { ...payload, error: error.message, identityRestored: restored });
      throw error;
    }
    // Someone who is no longer a loader keeps no Dock PIN (it would still open a session by email + PIN).
    let pinRemoved: boolean | undefined;
    if (from.role === Role.LOADER && to.role !== Role.LOADER) {
      try {
        await this.keycloak.removePin(userId);
        pinRemoved = true;
      } catch (err) {
        pinRemoved = false;
        this.logger.warn(`Users.Update ${userId}: Dock PIN not removed after the role change (${(err as Error).message}); remove it in Keycloak`);
      }
    }
    await this.record(actor, 'Users.SyncAccess', userId, 'SUCCESS', { ...payload, sessionsRevoked: true, ...(pinRemoved !== undefined ? { pinRemoved } : {}) });
  }

  /**
   * ADM-04 "Set Dock PIN" / "Reset PIN": replaces a loader's Dock PIN in Keycloak (the extension's lodestar-pin
   * endpoint; Keycloak hashes it). The PIN is never logged, stored here or returned. The OData layer audits the
   * call as Users.SetDockPin with the PIN redacted (libs/security audit.ts).
   */
  async setDockPin(userId: string, pin: string): Promise<{ pinSet: true }> {
    if (!this.keycloak.configured) throw new ODataError(503, 'ServiceUnavailable', 'The identity provider is not configured: a Dock PIN cannot be set');
    try {
      await this.keycloak.setPin(userId, pin);
    } catch (err) {
      if (err instanceof ODataError) throw err;
      throw identityError(err);
    }
    return { pinSet: true };
  }

  private async applyIdentityAccess(userId: string, from: DirectoryAccess, to: DirectoryAccess) {
    if (from.role !== to.role) await this.keycloak.setRealmRole(userId, REALM_ROLE[to.role], Object.values(REALM_ROLE));
    const attrsChanged = from.depot !== to.depot || from.outletId !== to.outletId || from.vehicleId !== to.vehicleId || from.staffId !== to.staffId;
    if (attrsChanged || from.isActive !== to.isActive) {
      await this.keycloak.updateUser(userId, {
        ...(attrsChanged ? { attributes: identityAttributes(to) } : {}),
        ...(from.isActive !== to.isActive ? { enabled: to.isActive } : {}),
      });
    }
  }

  private async record(actor: Principal, action: string, entityKey: string, outcome: AuditOutcome, payload: Record<string, unknown>, entitySet = 'Users') {
    try {
      await this.audit.record({
        at: new Date().toISOString(),
        actor: actor.sub,
        actorRoles: actor.roles,
        client: actor.clientId,
        action,
        entitySet,
        entityKey,
        outcome,
        payload,
      });
    } catch (err) {
      this.logger.error(`Could not audit ${action} for ${entityKey}: ${(err as Error).message}`);
    }
  }

  async setIdentityEnabled(userId: string, enabled: boolean) {
    if (this.keycloak.configured) await this.keycloak.setEnabled(userId, enabled);
  }

  /**
   * Self-enrollment (SM-31 "Ask Kandy Hub to add you" -> SM-32 "Access request
   * sent"): the caller registers a phone for themselves; it waits as PENDING
   * until an admin activates it (ADM-05). Idempotent per user + device: asking
   * again for the same phone returns the existing row (whatever its status).
   * A phone registered to someone else is a 409. Audited as Devices.Enroll.
   */
  async enrollDevice(req: DeviceRequest, actor: Principal) {
    const existing = await this.prisma.device.findUnique({ where: { id: req.id } });
    if (existing) return this.enrollExisting(existing, actor);

    const waiting = await this.prisma.device.count({ where: { userId: actor.sub, status: DeviceStatus.PENDING } });
    if (waiting >= MAX_PENDING_DEVICES) {
      await this.record(actor, 'Devices.Enroll', req.id, 'DENIED', { reason: 'Too many phones waiting for approval', waiting }, 'Devices');
      throw ODataError.conflict(`You already have ${waiting} phones waiting for approval. Ask Kandy Hub to approve or remove them.`, 'id');
    }

    let device;
    try {
      device = await this.prisma.device.create({
        data: {
          id: req.id,
          userId: actor.sub,
          label: req.label ?? null,
          platform: req.platform ?? null,
          model: req.model ?? null,
          status: DeviceStatus.PENDING,
        },
      });
    } catch (err) {
      // Two requests for the same phone at once: the loser answers like a repeat.
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.prisma.device.findUnique({ where: { id: req.id } });
      if (!raced) throw err;
      return this.enrollExisting(raced, actor);
    }
    await this.record(actor, 'Devices.Enroll', device.id, 'SUCCESS', this.enrollPayload(device, actor, false), 'Devices');
    return device;
  }

  private async enrollExisting<D extends DeviceRow>(device: D, actor: Principal): Promise<D> {
    if (device.userId !== actor.sub) {
      await this.record(actor, 'Devices.Enroll', device.id, 'DENIED', { reason: 'Device is registered to another user' }, 'Devices');
      throw ODataError.conflict('This phone is registered to someone else. Ask Kandy Hub to remove it first.', 'id');
    }
    await this.record(actor, 'Devices.Enroll', device.id, 'SUCCESS', this.enrollPayload(device, actor, true), 'Devices');
    return device;
  }

  private enrollPayload(device: DeviceRow, actor: Principal, repeat: boolean) {
    return {
      status: device.status,
      repeat,
      platform: device.platform ?? null,
      model: device.model ?? null,
      // What the token said when the phone asked (no claim, or another phone's id).
      tokenDeviceId: actor.deviceId ?? null,
      postureWaived: actor.enrollment?.reason ?? null,
    };
  }

  /**
   * ADM-05 approve a phone. All or nothing with Keycloak, like the user sync:
   * in one transaction the device becomes ACTIVE and the user's previous ACTIVE
   * phone is revoked; then Keycloak gets the user's `device_id` attribute (so
   * the next token is bound to this phone) and the user's sessions are ended.
   * The transaction commits only after Keycloak accepted both; on a Keycloak
   * failure the attribute is restored, the rows roll back and the caller gets
   * 502/503. Audited as Devices.BindIdentity.
   */
  async activateDevice(deviceId: string, actor: Principal) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.device.findUnique({ where: { id: deviceId } });
        if (!current) throw ODataError.notFound(`Device ${deviceId} does not exist`);
        const replaced = (
          await tx.device.findMany({ where: { userId: current.userId, status: DeviceStatus.ACTIVE, NOT: { id: deviceId } }, select: { id: true } })
        ).map((d) => d.id);

        const device = await tx.device.update({
          where: { id: deviceId },
          data: { status: DeviceStatus.ACTIVE, revokedAt: null, revokedBy: null, revokeReason: null },
        });
        if (replaced.length) {
          await tx.device.updateMany({
            where: { id: { in: replaced } },
            data: { status: DeviceStatus.REVOKED, revokedAt: new Date(), revokedBy: actor.sub, revokeReason: `Replaced by ${deviceId}` },
          });
        }

        if (!this.keycloak.configured) {
          this.logger.warn(`Devices.Activate ${deviceId}: no identity admin API configured; ${DEVICE_ATTRIBUTE} of ${current.userId} not synced`);
          return { device, replaced, identitySynced: false };
        }
        await this.bindIdentityDevice(current.userId, deviceId, replaced, actor);
        return { device, replaced, identitySynced: true };
      },
      { timeout: ACCESS_TX_TIMEOUT_MS, maxWait: 10_000 },
    );

    for (const id of [deviceId, ...result.replaced]) this.posture.invalidate(id);
    await this.record(
      actor,
      'Devices.BindIdentity',
      deviceId,
      'SUCCESS',
      { userId: result.device.userId, replaced: result.replaced, identitySynced: result.identitySynced, sessionsRevoked: result.identitySynced },
      'Devices',
    );
    return { ...result.device, replacedDeviceIds: result.replaced, identitySynced: result.identitySynced, sessionsRevoked: result.identitySynced };
  }

  /** Writes device_id = deviceId and ends the sessions; on failure restores the old value and throws (the caller rolls back). */
  private async bindIdentityDevice(userId: string, deviceId: string, replaced: string[], actor: Principal) {
    let previous: string[] | null | undefined;
    try {
      previous = await this.keycloak.getAttribute(userId, DEVICE_ATTRIBUTE);
      await this.keycloak.updateUser(userId, { attributes: { [DEVICE_ATTRIBUTE]: [deviceId] } });
      if (!(await this.keycloak.logoutUser(userId))) {
        throw new ODataError(502, 'BadGateway', `Could not end the sessions of ${userId}; activation rolled back`);
      }
    } catch (err) {
      let restored = true;
      if (previous !== undefined) {
        try {
          await this.keycloak.updateUser(userId, { attributes: { [DEVICE_ATTRIBUTE]: previous } });
        } catch (undo) {
          restored = false;
          this.logger.error(`Devices.Activate ${deviceId}: restoring ${DEVICE_ATTRIBUTE} of ${userId} failed (${(undo as Error).message}); check the user by hand`);
        }
      }
      const error = identityError(err);
      this.logger.warn(`Devices.Activate ${deviceId}: Keycloak sync failed (${error.message}); activation rolled back`);
      await this.record(
        actor,
        'Devices.BindIdentity',
        deviceId,
        'FAILED',
        { userId, replaced, previous: previous ?? null, error: error.message, identityRestored: restored },
        'Devices',
      );
      throw error;
    }
  }

  /**
   * ADM-07 lost phone: disable the device (field tokens bound to it stop
   * working at the next posture check), clear the user's `device_id` attribute
   * when it named this phone, and end the user's sessions. The revocation
   * itself always stands (fail safe): a Keycloak failure is logged and audited
   * as Devices.UnbindIdentity FAILED, not rolled back.
   */
  async revokeDevice(deviceId: string, actor: Principal, reason?: string) {
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.REVOKED, revokedAt: new Date(), revokedBy: actor.sub, revokeReason: reason ?? 'Reported lost' },
    });
    this.posture.invalidate(deviceId);

    let wasBound = false;
    let identityCleared = false;
    let sessionsRevoked = false;
    const errors: string[] = [];
    if (this.keycloak.configured) {
      try {
        wasBound = !!(await this.keycloak.getAttribute(device.userId, DEVICE_ATTRIBUTE))?.includes(deviceId);
        if (wasBound) {
          await this.keycloak.updateUser(device.userId, { attributes: { [DEVICE_ATTRIBUTE]: null } });
          identityCleared = true;
        }
      } catch (err) {
        errors.push(`${DEVICE_ATTRIBUTE}: ${(err as Error).message}`);
        this.logger.warn(`Could not clear ${DEVICE_ATTRIBUTE} of ${device.userId}: ${(err as Error).message}`);
      }
      try {
        sessionsRevoked = await this.keycloak.logoutUser(device.userId);
        if (!sessionsRevoked) errors.push('sessions: logout refused');
      } catch (err) {
        errors.push(`sessions: ${(err as Error).message}`);
        this.logger.warn(`Could not end sessions of ${device.userId}: ${(err as Error).message}`);
      }
    }
    await this.record(
      actor,
      'Devices.UnbindIdentity',
      deviceId,
      errors.length ? 'FAILED' : 'SUCCESS',
      {
        userId: device.userId,
        reason: device.revokeReason,
        identityConfigured: this.keycloak.configured,
        wasBound,
        identityCleared,
        sessionsRevoked,
        ...(errors.length ? { errors } : {}),
      },
      'Devices',
    );
    return { ...device, sessionsRevoked, identityCleared };
  }
}
