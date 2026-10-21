/* eslint-disable @typescript-eslint/no-require-imports */
// Device enrollment: a phone whose token does not name it asks for access (POST Devices), waits on SM-32,
// and opens the app once an admin has approved it and the token names the phone.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Claims } from '@/auth/claims';
import { deviceId, DEVICE_ID_KEY, pinnedDeviceId, resetDeviceIdCache, SEEDED_DEVICE_IDS, setSharedDeviceId, SHARED_DEVICE_KEY } from '@/auth/device';
import { DeviceEnrollment, hubName, type DeviceRow, type EnrollmentDeps } from '@/auth/enrollment';
import { Session } from '@/auth/session';
import { memoryStore } from '@/auth/secure';
import { client, oidc, routes, session, signInAs } from './fake-platform';
import { jwt } from './helpers';

jest.mock('@/model/platform', () => require('./fake-platform'));
jest.mock('expo-auth-session', () => ({
  useAuthRequest: () => [{ codeVerifier: 'v' }, null, jest.fn(async () => ({ type: 'dismiss' }))],
  makeRedirectUri: () => 'lodestar://auth/callback',
  exchangeCodeAsync: jest.fn(),
  ResponseType: { Code: 'code' },
  Prompt: { Login: 'login' },
}));

const replace = router.replace as jest.Mock;
const INSTALL = 'DEV-TEST-0001'; // fake-platform getDeviceId

const claims = (deviceIdClaim?: string): Claims => ({ sub: 'u-1', name: 'Test Manager', roles: ['store_manager'], depots: ['KANDY'], outletId: 'OUT-T1', deviceId: deviceIdClaim });

/** DeviceEnrollment over fakes: `c` is the current token's claims. */
function harness(over: Partial<EnrollmentDeps> = {}) {
  const state = { c: claims('DEV-OLD-01') as Claims | null, signedIn: true };
  const deps = {
    getDeviceId: jest.fn(async () => 'DEV-NEW-0001'),
    claims: () => state.c,
    signedIn: () => state.signedIn,
    refresh: jest.fn(async () => true),
    register: jest.fn(async (b: { id: string }): Promise<DeviceRow> => ({ id: b.id, status: 'PENDING', registeredAt: '2026-04-07T02:33:00Z' })),
    read: jest.fn(async (id: string): Promise<DeviceRow> => ({ id, status: 'PENDING', registeredAt: '2026-04-07T02:33:00Z' })),
    describe: () => ({ platform: 'web', label: "Test's browser" }),
    sendsDeviceHeader: () => true,
    now: () => Date.parse('2026-04-07T02:40:00Z'),
    ...over,
  };
  return { e: new DeviceEnrollment(deps), deps: deps as typeof deps & { refresh: jest.Mock; read: jest.Mock; register: jest.Mock }, state };
}

describe('DeviceEnrollment', () => {
  it('a bound phone opens the app without asking', async () => {
    const { e, deps } = harness();
    await expect(e.ensure(claims('DEV-NEW-0001'))).resolves.toBe(true);
    expect(e.state.get().status).toBe('idle');
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('where X-Device-Id cannot be sent (cross-origin web) the API cannot check the phone, so nothing is asked', async () => {
    const { e, deps } = harness({ sendsDeviceHeader: () => false });
    await expect(e.ensure(claims(undefined))).resolves.toBe(true);
    expect(deps.register).not.toHaveBeenCalled();
  });

  it.each([['another phone', 'DEV-OLD-01'], ['no claim', undefined]])('token naming %s: asks for access for this install and waits', async (_what, claim) => {
    const { e, deps } = harness();
    await expect(e.ensure(claims(claim))).resolves.toBe(false);
    expect(deps.register).toHaveBeenCalledWith({ id: 'DEV-NEW-0001', platform: 'web', label: "Test's browser" });
    expect(e.state.get()).toMatchObject({ status: 'pending', deviceId: 'DEV-NEW-0001', requestedAt: '2026-04-07T02:33:00Z', since: '2026-04-07T02:40:00.000Z', message: null });
    expect(e.active).toBe(true);
  });

  it('shows a revoked phone, a phone of someone else, and a request that could not be sent', async () => {
    const revoked = harness({ register: jest.fn(async () => ({ id: 'DEV-NEW-0001', status: 'REVOKED' })) });
    await revoked.e.request();
    expect(revoked.e.state.get()).toMatchObject({ status: 'revoked', message: expect.stringMatching(/removed/) });

    const taken = harness({ register: jest.fn(async () => Promise.reject({ status: 409, message: 'This phone is registered to someone else.' })) });
    await taken.e.request();
    expect(taken.e.state.get()).toMatchObject({ status: 'conflict', message: 'This phone is registered to someone else.' });

    const offline = harness({ register: jest.fn(async () => Promise.reject({ status: 0, code: 'NetworkError', message: 'No connection to the server' })) });
    await offline.e.request();
    expect(offline.e.state.get()).toMatchObject({ status: 'error', message: expect.stringMatching(/No connection/) });
  });

  describe('shared demo phones (the seeded personas sign in from any browser)', () => {
    /** An install whose id can be adopted: `id` is what it presents as X-Device-Id. */
    function adopting(row: Partial<DeviceRow> | Error) {
      const install = { id: 'DEV-NEW-0001' };
      const h = harness({
        getDeviceId: jest.fn(async () => install.id),
        read: jest.fn(async (id: string): Promise<DeviceRow> => {
          if (row instanceof Error) throw row;
          return { id, status: 'ACTIVE', userId: 'u-1', sharedDemo: true, ...row };
        }),
        adoptDevice: jest.fn(async (id: string | null) => void (install.id = id ?? 'DEV-NEW-0001')),
      });
      return { ...h, install, adopt: h.deps.adoptDevice as jest.Mock };
    }

    it("adopts the token's phone when the backend confirms it is an ACTIVE shared demo phone of this user", async () => {
      const h = adopting({});
      await expect(h.e.ensure(claims('DEV-RB-01'))).resolves.toBe(true);
      expect(h.deps.read).toHaveBeenCalledWith('DEV-RB-01');
      expect(h.adopt).toHaveBeenCalledWith('DEV-RB-01');
      expect(h.install.id).toBe('DEV-RB-01');
      expect(h.deps.register).not.toHaveBeenCalled();
      expect(h.e.state.get().status).toBe('idle');
    });

    it.each([
      ['not a shared demo phone', { sharedDemo: false }],
      ['no sharedDemo flag (older API)', { sharedDemo: undefined }],
      ['a pending phone', { status: 'PENDING' }],
      ['a revoked phone', { status: 'REVOKED' }],
      ["another user's phone", { userId: 'u-2' }],
      ['a different row', { id: 'DEV-OTHER-01' }],
      ['an unreadable row', new Error('Resource not found')],
    ] as [string, Partial<DeviceRow> | Error][])('keeps device binding for %s: this install asks for access with its own id', async (_what, row) => {
      const h = adopting(row);
      await expect(h.e.ensure(claims('DEV-RB-01'))).resolves.toBe(false);
      expect(h.adopt).toHaveBeenCalledWith(null);
      expect(h.deps.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'DEV-NEW-0001' }));
      expect(h.e.state.get().status).toBe('pending');
    });

    it('a dropped Devices read is tried again: the demo phone is still adopted (no access request)', async () => {
      const h = adopting({});
      const read = h.deps.read as jest.Mock;
      const real = read.getMockImplementation()!;
      read.mockImplementationOnce(async () => Promise.reject({ status: 0, message: 'aborted' })).mockImplementationOnce(async () => Promise.reject({ status: 502 }));
      read.mockImplementation(real);
      await expect(h.e.ensure(claims('DEV-RB-01'))).resolves.toBe(true);
      expect(read).toHaveBeenCalledTimes(3);
      expect(h.adopt).toHaveBeenCalledWith('DEV-RB-01');
      expect(h.deps.register).not.toHaveBeenCalled();
    });

    it('a refused Devices read (403) is not tried again', async () => {
      const h = adopting(Object.assign(new Error('Forbidden'), { status: 403 }));
      await expect(h.e.ensure(claims('DEV-RB-01'))).resolves.toBe(false);
      expect(h.deps.read).toHaveBeenCalledTimes(1);
    });

    it("another user on a browser that adopted a demo phone gets the install's own id back", async () => {
      const h = adopting({ sharedDemo: false });
      h.install.id = 'DEV-RB-01'; // adopted for ruwan earlier
      // this user's token names the browser's own (approved) id
      await expect(h.e.ensure(claims('DEV-NEW-0001'))).resolves.toBe(true);
      expect(h.adopt).toHaveBeenCalledWith(null);
      expect(h.install.id).toBe('DEV-NEW-0001');

      h.install.id = 'DEV-RB-01';
      await expect(h.e.ensure(claims('DEV-MINE-01'))).resolves.toBe(false);
      expect(h.adopt).toHaveBeenLastCalledWith(null);
      expect(h.deps.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'DEV-NEW-0001' }));
    });

    it('no token claim: nothing is read and nothing adopted', async () => {
      const h = adopting({});
      await expect(h.e.ensure(claims(undefined))).resolves.toBe(false);
      expect(h.deps.read).not.toHaveBeenCalled();
      expect(h.adopt).toHaveBeenCalledWith(null);
    });
  });

  it('an already approved phone (row ACTIVE, token still old) asks to sign in again', async () => {
    const { e } = harness({ register: jest.fn(async () => ({ id: 'DEV-NEW-0001', status: 'ACTIVE' })) });
    await e.ensure();
    expect(e.state.get()).toMatchObject({ status: 'signin', message: expect.stringMatching(/approved/) });
  });

  describe('Check again', () => {
    it('refreshes the token; once it names this phone the request is approved', async () => {
      const h = harness();
      await h.e.ensure();
      h.deps.refresh.mockImplementation(async () => {
        h.state.c = claims('DEV-NEW-0001');
        return true;
      });
      await expect(h.e.checkAgain()).resolves.toBe('approved');
      expect(h.deps.refresh).toHaveBeenCalledTimes(1);
      expect(h.deps.read).not.toHaveBeenCalled();
      expect(h.e.active).toBe(false);
    });

    it('still waiting: reads the request and stays pending', async () => {
      const h = harness();
      await h.e.ensure();
      await expect(h.e.checkAgain()).resolves.toBe('pending');
      expect(h.deps.read).toHaveBeenCalledWith('DEV-NEW-0001');
      expect(h.e.state.get().checkedAt).toBe('2026-04-07T02:40:00.000Z');
    });

    it('the approval ended the session (refresh refused): sign in again', async () => {
      const h = harness();
      await h.e.ensure();
      h.deps.refresh.mockImplementation(async () => {
        h.state.signedIn = false;
        return false;
      });
      await expect(h.e.checkAgain()).resolves.toBe('signin');
      expect(h.deps.read).not.toHaveBeenCalled();
    });

    it('a request the server does not know (404) is sent again; a revoked one is shown', async () => {
      const h = harness({ read: jest.fn(async () => Promise.reject({ status: 404, message: 'Resource not found' })) });
      await h.e.ensure();
      await expect(h.e.checkAgain()).resolves.toBe('pending');
      expect(h.deps.register).toHaveBeenCalledTimes(2);

      h.deps.read.mockImplementation(async () => ({ id: 'DEV-NEW-0001', status: 'REVOKED' }));
      await expect(h.e.checkAgain()).resolves.toBe('revoked');
    });

    it('a double tap checks once', async () => {
      const h = harness();
      await h.e.ensure();
      await Promise.all([h.e.checkAgain(), h.e.checkAgain()]);
      expect(h.deps.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('a call refused mid-session as unbound asks for access once', async () => {
    const { e, deps } = harness();
    e.unbound();
    e.unbound();
    await waitFor(() => expect(e.state.get().status).toBe('pending'));
    e.unbound();
    expect(deps.register).toHaveBeenCalledTimes(1);
    e.reset();
    expect(e.state.get().status).toBe('idle');
  });

  it('names the approving hub', () => {
    const names: Record<string, string> = { KANDY: 'Kandy Hub', PELIYAGODA: 'Peliyagoda DC' };
    const name = (c: string) => names[c] ?? c;
    expect(hubName(['KANDY'], name)).toBe('Kandy Hub');
    expect(hubName(['PELIYAGODA'], name)).toBe('Peliyagoda DC');
    expect(hubName(['GALLE'], name)).toBe('GALLE'); // not in the registry yet: its code, never a guess
    expect(hubName(['PELIYAGODA', 'KANDY'], name)).toBe('your depot');
    expect(hubName(undefined)).toBe('your depot');
  });
});

describe('Session and unbound phones', () => {
  const token = (c: object) => ({ access_token: jwt({ sub: 'u-1', exp: 4_000_000_000, realm_access: { roles: ['driver'] }, ...c }), refresh_token: 'rt-1', expires_in: 300 });

  it('DeviceMismatch / DeviceNotBound keep the session and hand over to enrollment', async () => {
    const s = new Session(memoryStore, { refresh: jest.fn(), logout: jest.fn(async () => undefined) });
    const unbound = jest.fn();
    s.onDeviceUnbound(unbound);
    await s.signIn(token({ device_id: 'DEV-OLD-01' }));
    for (const code of ['DeviceMismatch', 'DeviceNotBound']) {
      await expect(s.handleUnauthorized({ code, message: 'X-Device-Id does not match the device the token is bound to' })).resolves.toBe(false);
    }
    expect(unbound).toHaveBeenCalledTimes(2);
    expect(s.state.get()).toMatchObject({ status: 'signed-in', problem: null });

    // other posture failures still end the session
    await s.handleUnauthorized({ code: 'DeviceInactive', message: 'Device is revoked' });
    expect(s.state.get()).toMatchObject({ status: 'signed-out', problem: { kind: 'revoked' } });
  });

  it('without an enrollment handler an unbound phone ends the session as before', async () => {
    const s = new Session(memoryStore, { refresh: jest.fn(), logout: jest.fn(async () => undefined) });
    await s.signIn(token({ device_id: 'DEV-OLD-01' }));
    await s.handleUnauthorized({ code: 'DeviceMismatch', message: 'X-Device-Id does not match the device the token is bound to' });
    expect(s.state.get()).toMatchObject({ status: 'signed-out', problem: { kind: 'unregistered' } });
  });
});

describe('install id overrides (dev / e2e)', () => {
  const saved = process.env.EXPO_PUBLIC_DEVICE_ID;
  const store = () => {
    const data = new Map<string, string>();
    return { data, get: async (k: string) => data.get(k) ?? null, set: async (k: string, v: string) => void data.set(k, v), remove: async (k: string) => void data.delete(k) };
  };
  beforeEach(() => resetDeviceIdCache());
  afterEach(() => {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_DEVICE_ID;
    else process.env.EXPO_PUBLIC_DEVICE_ID = saved;
    resetDeviceIdCache();
  });

  it('EXPO_PUBLIC_DEVICE_ID pins the id (a malformed value is ignored)', async () => {
    process.env.EXPO_PUBLIC_DEVICE_ID = SEEDED_DEVICE_IDS.ruwan;
    const st = store();
    await expect(deviceId(st, () => 'u')).resolves.toBe('DEV-RB-01');
    expect(st.data.size).toBe(0);
    process.env.EXPO_PUBLIC_DEVICE_ID = 'no!';
    expect(pinnedDeviceId()).toBeNull();
  });

  it("an adopted shared demo phone is presented instead of the install's own id, until it is dropped", async () => {
    delete process.env.EXPO_PUBLIC_DEVICE_ID;
    const st = store();
    const own = await deviceId(st, () => 'abc-123');
    expect(own).toBe('DEV-ABC123');
    await setSharedDeviceId(st, 'DEV-RB-01');
    await expect(deviceId(st, () => 'x')).resolves.toBe('DEV-RB-01');
    expect(st.data.get(SHARED_DEVICE_KEY)).toBe('DEV-RB-01');
    expect(st.data.get(DEVICE_ID_KEY)).toBe(own);
    resetDeviceIdCache(); // a reload keeps the adoption
    await expect(deviceId(st, () => 'x')).resolves.toBe('DEV-RB-01');
    await setSharedDeviceId(st, null);
    await expect(deviceId(st, () => 'x')).resolves.toBe(own);
    expect(st.data.has(SHARED_DEVICE_KEY)).toBe(false);
  });

  it('a pre-seeded stored id (web: localStorage lodestar.device-id) is respected', async () => {
    delete process.env.EXPO_PUBLIC_DEVICE_ID;
    const st = store();
    st.data.set(DEVICE_ID_KEY, SEEDED_DEVICE_IDS.kasun);
    const uuid = jest.fn(() => 'x');
    await expect(deviceId(st, uuid)).resolves.toBe('DEV-KJ-01');
    expect(uuid).not.toHaveBeenCalled();
    expect(SEEDED_DEVICE_IDS).toEqual({ ruwan: 'DEV-RB-01', kasun: 'DEV-KJ-01', fathima: 'DEV-FR-01', nilanthi: 'DEV-NP-01' });
  });
});

describe('SM-32 access request (live)', () => {
  const manager = (device_id?: string) => ({ sub: 'u-sm32', name: 'Test Manager', realm_access: { roles: ['store_manager'] }, depot: ['KANDY'], outlet_id: 'OUT-T1', ...(device_id ? { device_id } : {}) });
  let enrollment: DeviceEnrollment;

  beforeEach(async () => {
    // first-run screens already seen on this device: sign-in goes straight to the role's home
    await require('@/lib/settings').markOnboardingSeen('u-sm32');
    enrollment = require('@/auth/device-access').enrollment;
    enrollment.reset();
    routes.clear();
    replace.mockClear();
    client.create.mockClear();
    client.get.mockClear();
    oidc.refresh.mockReset();
    client.create.mockImplementation(async (_set: string, body: unknown) => ({ ...(body as object), status: 'PENDING', registeredAt: '2026-04-07T02:33:00.000Z' }) as any);
  });

  it('after sign-in an unbound phone asks for access, the guard opens SM-32, which shows the install id', async () => {
    const { enterApp } = require('@/auth/use-sign-in');
    const { AccessGuard } = require('@/auth/access-guard');
    await signInAs(manager('DEV-FR-01'));
    await render(<AccessGuard />);
    await act(async () => expect(await enterApp(session.claims, 400)).toBe(false));
    expect(client.create).toHaveBeenCalledWith('Devices', expect.objectContaining({ id: INSTALL, platform: expect.any(String), label: expect.stringMatching(/^Test's /) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-32-access-request-sent' } }));
    expect(replace).not.toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-11-today-order-day' } });

    const Screen = require('@/live/sm-32-access-request-sent').default;
    await render(<Screen />);
    expect(screen.getByTestId('device-id').props.children).toBe(INSTALL);
    // the hub's name from the depot registry (Depots), which an enrolling phone may read
    await waitFor(() => expect(screen.getByTestId('enroll-title').props.children).toBe('Access request sent to Kandy Hub'));
    expect(screen.getByTestId('enroll-status').props.children).toBe('Sent');
  });

  it('Check again: still pending, then approved → the role\'s home screen', async () => {
    const { enterApp } = require('@/auth/use-sign-in');
    await signInAs(manager());
    await act(async () => void (await enterApp(session.claims, 400)));
    routes.set(`Devices('${INSTALL}')`, { id: INSTALL, status: 'PENDING', registeredAt: '2026-04-07T02:33:00.000Z' });
    oidc.refresh.mockResolvedValue({ access_token: jwt({ exp: 4_000_000_000, ...manager() }), refresh_token: 'rt-2', expires_in: 3600 });

    const Screen = require('@/live/sm-32-access-request-sent').default;
    await render(<Screen />);
    await fireEvent.press(screen.getByTestId('check-again'));
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('Devices', INSTALL));
    expect(enrollment.state.get().status).toBe('pending');
    expect(screen.getByTestId('enroll-status').props.children).toBe('Sent');

    // Kandy Hub approved: the refreshed token names this phone
    oidc.refresh.mockResolvedValue({ access_token: jwt({ exp: 4_000_000_000, ...manager(INSTALL) }), refresh_token: 'rt-3', expires_in: 3600 });
    await fireEvent.press(screen.getByTestId('check-again'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-11-today-order-day' } }));
    expect(enrollment.state.get().status).toBe('idle');
  });

  it('the approval ended the session: SM-32 asks to sign in again and the guard stays put', async () => {
    const { enterApp } = require('@/auth/use-sign-in');
    const { AccessGuard } = require('@/auth/access-guard');
    const { OidcError } = require('@/auth/oidc');
    await signInAs(manager('DEV-FR-01'));
    await render(<AccessGuard />);
    await act(async () => void (await enterApp(session.claims, 400)));
    oidc.refresh.mockRejectedValue(new OidcError('invalid_grant', 'Session not active'));

    const Screen = require('@/live/sm-32-access-request-sent').default;
    await render(<Screen />);
    replace.mockClear();
    await fireEvent.press(screen.getByTestId('check-again'));
    await waitFor(() => expect(enrollment.state.get().status).toBe('signin'));
    expect(session.state.get()).toMatchObject({ status: 'signed-out', problem: { kind: 'expired' } });
    expect(screen.getByTestId('enroll-title').props.children).toBe('Sign in again to continue');
    // no jump to the "session expired" screen: the user signs in from here
    expect(replace).not.toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-33-session-expired' } });
  });

  it('a leftover session that expires on a sign-in screen stays there (a loader on a tablet a manager used)', async () => {
    const { AccessGuard } = require('@/auth/access-guard');
    const { OidcError } = require('@/auth/oidc');
    const path = (require('expo-router') as { __path: { value: string } }).__path;
    await signInAs(manager());
    path.value = '/s/ld-06-sign-in';
    await render(<AccessGuard />);
    replace.mockClear();
    oidc.refresh.mockRejectedValue(new OidcError('invalid_grant', 'Session not active'));
    await act(async () => void (await session.refresh()));
    expect(session.state.get()).toMatchObject({ status: 'signed-out', problem: { kind: 'expired' } });
    expect(replace).not.toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-33-session-expired' } });

    // anywhere else, the store manager is told the session ended (and that the draft is kept)
    await signInAs(manager());
    path.value = '/s/sm-11-today-order-day';
    await act(async () => void (await session.refresh()));
    await waitFor(() => expect(replace).toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-33-session-expired' } }));
    path.value = '/';
  });

  it('a bound phone goes straight home', async () => {
    const { enterApp } = require('@/auth/use-sign-in');
    await signInAs(manager(INSTALL));
    await act(async () => expect(await enterApp(session.claims, 400)).toBe(true));
    expect(client.create).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({ pathname: '/s/[key]', params: { key: 'sm-11-today-order-day' } });
  });
});
