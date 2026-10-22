import { Injectable, Logger } from '@nestjs/common';
import { ODataError } from '@lodestar/odata';
import { ServiceTokenClient } from '@lodestar/security';

export interface NewIdentityUser {
  email: string;
  firstName: string;
  lastName: string;
  role: string; // realm role
  attributes: Record<string, string[]>;
}

/**
 * Minimal Keycloak Admin REST client used by the auth service with its own
 * service account (svc-auth has realm-management view/manage/query-users;
 * manage-users also opens the extension's lodestar-pin endpoint).
 *
 *   KEYCLOAK_ADMIN_URL  e.g. http://identity:8080/auth   (internal URL)
 *   KEYCLOAK_REALM      default lodestar
 */
@Injectable()
export class KeycloakAdminClient {
  private readonly logger = new Logger(KeycloakAdminClient.name);
  private readonly base = process.env.KEYCLOAK_ADMIN_URL?.replace(/\/$/, '');
  private readonly realm = process.env.KEYCLOAK_REALM || 'lodestar';

  constructor(private readonly tokens: ServiceTokenClient) {}

  get configured(): boolean {
    return !!this.base && this.tokens.configured;
  }

  private url(path: string) {
    return `${this.base}/admin/realms/${this.realm}${path}`;
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    if (!this.configured) throw new ODataError(503, 'ServiceUnavailable', 'The identity provider is not configured');
    try {
      return await this.tokens.fetch(this.url(path), {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.logger.warn(`Keycloak ${method} ${path} failed: ${(err as Error).message}`);
      throw new ODataError(503, 'ServiceUnavailable', 'The identity provider is not reachable');
    }
  }

  /** Creates a user with a realm role; returns the Keycloak id (the token `sub`). */
  async createUser(u: NewIdentityUser): Promise<string> {
    const res = await this.call('POST', '/users', {
      username: u.email,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      enabled: true,
      emailVerified: false,
      attributes: u.attributes,
      requiredActions: ['UPDATE_PASSWORD'],
    });
    if (res.status === 409) throw ODataError.conflict('A user with this email already exists in the identity provider', 'email');
    if (!res.ok) throw new ODataError(502, 'BadGateway', `Identity provider answered HTTP ${res.status}`);
    const id = res.headers.get('location')?.split('/').pop();
    if (!id) throw new ODataError(502, 'BadGateway', 'Identity provider returned no user id');

    // A user without their realm role would be locked out of everything: fail loudly,
    // and remove the half-created user so a retry can succeed.
    try {
      await this.grantRealmRole(id, u.role);
    } catch (err) {
      try {
        await this.deleteUser(id);
        this.logger.warn(`Removed Keycloak user ${id} after its realm role could not be granted`);
      } catch (cleanup) {
        this.logger.error(`Keycloak user ${id} has no realm role and could not be removed: ${(cleanup as Error).message}`);
      }
      throw err;
    }
    return id;
  }

  private async grantRealmRole(userId: string, roleName: string): Promise<void> {
    const role = await this.call('GET', `/roles/${encodeURIComponent(roleName)}`);
    if (!role.ok) throw new ODataError(502, 'BadGateway', `Identity provider has no realm role '${roleName}'`);
    const mapped = await this.call('POST', `/users/${encodeURIComponent(userId)}/role-mappings/realm`, [await role.json()]);
    if (!mapped.ok) throw new ODataError(502, 'BadGateway', `Could not grant realm role '${roleName}' (HTTP ${mapped.status})`);
  }

  /** Deletes a user (compensation for a failed directory write). A missing user counts as deleted. */
  async deleteUser(userId: string): Promise<void> {
    const res = await this.call('DELETE', `/users/${encodeURIComponent(userId)}`);
    if (!res.ok && res.status !== 404) throw new ODataError(502, 'BadGateway', `Could not delete identity ${userId} (HTTP ${res.status})`);
  }

  /**
   * Makes `roleName` the user's only application realm role: grants it if
   * missing and removes the other roles listed in `managedRoles` (default
   * roles such as offline_access are left alone).
   */
  async setRealmRole(userId: string, roleName: string, managedRoles: readonly string[]): Promise<void> {
    const id = encodeURIComponent(userId);
    const res = await this.call('GET', `/users/${id}/role-mappings/realm`);
    if (!res.ok) throw new ODataError(502, 'BadGateway', `Could not read the realm roles of ${userId} (HTTP ${res.status})`);
    const current = ((await res.json()) ?? []) as { id: string; name: string }[];
    if (!current.some((r) => r.name === roleName)) await this.grantRealmRole(userId, roleName);
    const stale = current.filter((r) => r.name !== roleName && managedRoles.includes(r.name));
    if (stale.length) {
      const removed = await this.call('DELETE', `/users/${id}/role-mappings/realm`, stale);
      if (!removed.ok) throw new ODataError(502, 'BadGateway', `Could not remove realm roles of ${userId} (HTTP ${removed.status})`);
    }
  }

  /**
   * Updates user attributes (null removes one) and optionally `enabled`.
   * Keycloak's PUT replaces the attribute map, so the current representation
   * is read and merged first: attributes we do not manage are kept.
   */
  async updateUser(userId: string, changes: { attributes?: Record<string, string[] | null>; enabled?: boolean }): Promise<void> {
    const id = encodeURIComponent(userId);
    const res = await this.call('GET', `/users/${id}`);
    if (!res.ok) throw new ODataError(502, 'BadGateway', `Could not read identity ${userId} (HTTP ${res.status})`);
    const rep = (await res.json()) as Record<string, any>;
    const attributes: Record<string, string[]> = { ...(rep.attributes ?? {}) };
    for (const [k, v] of Object.entries(changes.attributes ?? {})) {
      if (v === null || v.length === 0) delete attributes[k];
      else attributes[k] = v;
    }
    const body = { ...rep, attributes, ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}) };
    const put = await this.call('PUT', `/users/${id}`, body);
    if (!put.ok) throw new ODataError(502, 'BadGateway', `Could not update identity ${userId} (HTTP ${put.status})`);
  }

  /** The values of one user attribute (e.g. device_id), or null when the user has none. */
  async getAttribute(userId: string, name: string): Promise<string[] | null> {
    const res = await this.call('GET', `/users/${encodeURIComponent(userId)}`);
    if (!res.ok) throw new ODataError(502, 'BadGateway', `Could not read identity ${userId} (HTTP ${res.status})`);
    const rep = ((await res.json()) ?? {}) as { attributes?: Record<string, unknown> };
    const v = rep.attributes?.[name];
    const values = (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter((x): x is string => typeof x === 'string' && x !== '');
    return values.length ? values : null;
  }

  /**
   * 2-step verification status (DSP-07): the user's OTP credentials and whether Keycloak will ask them to set
   * one up at the next sign-in (required action CONFIGURE_TOTP). Labels and dates only, never secrets.
   */
  async twoFactor(userId: string): Promise<{ otp: Array<{ label: string | null; createdAt: string | null }>; setupRequired: boolean }> {
    const id = encodeURIComponent(userId);
    const creds = await this.call('GET', `/users/${id}/credentials`);
    if (!creds.ok) throw new ODataError(502, 'BadGateway', `Could not read the sign-in methods of ${userId} (HTTP ${creds.status})`);
    const list = ((await creds.json()) ?? []) as Array<{ type?: string; userLabel?: string; createdDate?: number }>;
    const user = await this.call('GET', `/users/${id}`);
    if (!user.ok) throw new ODataError(502, 'BadGateway', `Could not read identity ${userId} (HTTP ${user.status})`);
    const rep = ((await user.json()) ?? {}) as { requiredActions?: string[] };
    return {
      otp: list
        .filter((c) => c.type === 'otp')
        .map((c) => ({ label: c.userLabel ?? null, createdAt: typeof c.createdDate === 'number' ? new Date(c.createdDate).toISOString() : null })),
      setupRequired: (rep.requiredActions ?? []).includes('CONFIGURE_TOTP'),
    };
  }

  /**
   * Sets (replaces) a loader's Dock PIN through the Lodestar identity extension
   * (POST /admin/realms/{realm}/lodestar-pin/{userId}, PinAdminResource): its own credential type, hashed by
   * Keycloak, never the password. The PIN is only in the request body: never logged, never returned.
   */
  async setPin(userId: string, pin: string): Promise<void> {
    const res = await this.call('POST', `/lodestar-pin/${encodeURIComponent(userId)}`, { pin });
    if (res.ok) return;
    if (res.status === 400) throw ODataError.badRequest('The identity provider refused the Dock PIN (4 digits)', 'pin');
    if (res.status === 404) {
      throw new ODataError(502, 'BadGateway', 'The identity provider has no Dock PIN endpoint or no such user (is the Lodestar identity image deployed?)');
    }
    throw new ODataError(502, 'BadGateway', `Could not set the Dock PIN (HTTP ${res.status})`);
  }

  /** Removes a user's Dock PIN (DELETE lodestar-pin/{userId}); a missing user counts as done. */
  async removePin(userId: string): Promise<void> {
    const res = await this.call('DELETE', `/lodestar-pin/${encodeURIComponent(userId)}`);
    if (!res.ok && res.status !== 404) throw new ODataError(502, 'BadGateway', `Could not remove the Dock PIN (HTTP ${res.status})`);
  }

  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    const res = await this.call('PUT', `/users/${encodeURIComponent(userId)}`, { enabled });
    if (!res.ok && res.status !== 404) throw new ODataError(502, 'BadGateway', `Identity provider answered HTTP ${res.status}`);
  }

  /** Ends every session of a user (used when a phone is reported lost, ADM-07). */
  async logoutUser(userId: string): Promise<boolean> {
    const res = await this.call('POST', `/users/${encodeURIComponent(userId)}/logout`);
    return res.ok || res.status === 404;
  }
}
