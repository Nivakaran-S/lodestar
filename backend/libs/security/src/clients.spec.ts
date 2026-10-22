import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CallHandler, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { personas } from '../test/principals';
import { AuditEvent, AuditSink, auditPayload, HttpAuditSink, redact } from './audit';
import { AuditInterceptor } from './audit.interceptor';
import { OidcConfig } from './config';
import { NO_AUDIT_KEY } from './decorators';
import { DeviceLookup, DevicePostureService } from './device-posture.service';
import { PrismaDeviceLookup } from './prisma-device-lookup';
import { ServiceTokenClient, TOKEN_EXPIRY_MARGIN_MS } from './service-token.client';

const config: OidcConfig = {
  issuers: ['https://id/realms/lodestar'],
  tokenUrl: 'http://identity:8080/token',
  audience: 'lodestar-api',
  clientId: 'svc-orders',
  clientSecret: 'secret',
  fieldClientId: 'lodestar-field',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ServiceTokenClient (client credentials)', () => {
  let now = 1_000_000;
  let fetchImpl: jest.Mock;
  let client: ServiceTokenClient;

  beforeEach(() => {
    now = 1_000_000;
    fetchImpl = jest.fn();
    client = new ServiceTokenClient(config, fetchImpl as any, () => now);
    (client as any).logger = { error: jest.fn() };
  });

  it('requests a token with the client credentials grant', async () => {
    fetchImpl.mockResolvedValueOnce(json({ access_token: 't1', expires_in: 300 }));
    await expect(client.getToken()).resolves.toBe('t1');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://identity:8080/token');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe('grant_type=client_credentials&client_id=svc-orders&client_secret=secret');
  });

  it('caches until 60 s before expiry, then refreshes', async () => {
    fetchImpl.mockResolvedValueOnce(json({ access_token: 't1', expires_in: 300 })).mockResolvedValueOnce(json({ access_token: 't2', expires_in: 300 }));
    await client.getToken();
    now += 300_000 - TOKEN_EXPIRY_MARGIN_MS - 1;
    await expect(client.getToken()).resolves.toBe('t1');
    now += 2;
    await expect(client.getToken()).resolves.toBe('t2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    fetchImpl.mockResolvedValue(json({ access_token: 't1', expires_in: 300 }));
    const [a, b] = await Promise.all([client.getToken(), client.getToken()]);
    expect([a, b]).toEqual(['t1', 't1']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('attaches the token and retries once after a 401', async () => {
    fetchImpl
      .mockResolvedValueOnce(json({ access_token: 't1', expires_in: 300 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json({ access_token: 't2', expires_in: 300 }))
      .mockResolvedValueOnce(json({ ok: true }));
    const res = await client.fetch('http://audit:3009/x', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(new Headers(fetchImpl.mock.calls[3][1].headers).get('Authorization')).toBe('Bearer t2');
  });

  it('fails clearly without credentials or on token errors', async () => {
    const bare = new ServiceTokenClient({ ...config, clientSecret: undefined }, fetchImpl as any);
    expect(bare.configured).toBe(false);
    await expect(bare.getToken()).rejects.toThrow(/not configured/);
    fetchImpl.mockResolvedValueOnce(new Response('no', { status: 401 }));
    await expect(client.getToken()).rejects.toThrow(/returned 401/);
    fetchImpl.mockResolvedValueOnce(json({}));
    await expect(client.getToken()).rejects.toThrow(/no access_token/);
  });
});

describe('ServiceTokenClient (Azure workload identity)', () => {
  it('sends the projected federated token as client assertion, re-reading the file each time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-'));
    const file = join(dir, 'token');
    writeFileSync(file, 'assertion-1\n');
    const fetchImpl = jest.fn().mockImplementation(async () => json({ access_token: 'entra', expires_in: 3599 }));
    const now = { t: 0 };
    const client = new ServiceTokenClient(
      { ...config, clientSecret: undefined, clientId: 'app-guid', federatedTokenFile: file, tokenUrl: 'https://login.microsoftonline.com/t/oauth2/v2.0/token', tokenScope: 'api://lodestar-api/.default' },
      fetchImpl as any,
      () => now.t,
    );
    expect(client.configured).toBe(true);
    await expect(client.getToken()).resolves.toBe('entra');
    const form = new URLSearchParams(String(fetchImpl.mock.calls[0][1].body));
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'app-guid',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: 'assertion-1',
      scope: 'api://lodestar-api/.default',
    });
    writeFileSync(file, 'assertion-2');
    now.t = 3_600_000;
    await client.getToken();
    expect(new URLSearchParams(String(fetchImpl.mock.calls[1][1].body)).get('client_assertion')).toBe('assertion-2');
  });
});

describe('DevicePostureService', () => {
  let lookup: DeviceLookup;
  let now = 0;
  let posture: DevicePostureService;

  beforeEach(() => {
    lookup = mock<DeviceLookup>();
    now = 0;
    posture = new DevicePostureService(config, instance(lookup), () => now);
  });

  it('ignores tokens of other clients', async () => {
    await expect(posture.check(personas.nilanthi)).resolves.toBeUndefined();
    verify(lookup.findDevice(anything())).never();
  });

  const RB = 'DEV-RB-01';
  /** The OData error code a posture failure carries (the exception filter uses it). */
  const codeOf = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as UnauthorizedException).getResponse() as { code: string };

  it('accepts an active device of the same user and caches it', async () => {
    when(lookup.findDevice('DEV-RB-01')).thenResolve({ id: 'DEV-RB-01', userId: 'ruwan', status: 'ACTIVE' });
    await posture.check(personas.ruwan, RB);
    await posture.check(personas.ruwan, RB);
    verify(lookup.findDevice('DEV-RB-01')).once();
    now = 31_000;
    await posture.check(personas.ruwan, RB);
    verify(lookup.findDevice('DEV-RB-01')).twice();
  });

  it('rejects missing, unknown, revoked and foreign devices', async () => {
    await expect(posture.check({ ...personas.ruwan, deviceId: undefined }, RB)).rejects.toThrow('not bound to a device');
    when(lookup.findDevice('DEV-RB-01')).thenResolve(null);
    await expect(posture.check(personas.ruwan, RB)).rejects.toThrow('not registered');
    posture.invalidate('DEV-RB-01');
    when(lookup.findDevice('DEV-RB-01')).thenResolve({ id: 'DEV-RB-01', userId: 'ruwan', status: 'REVOKED' });
    await expect(posture.check(personas.ruwan, RB)).rejects.toThrow('Device is revoked');
    expect(await codeOf(posture.check(personas.ruwan, RB))).toMatchObject({ code: 'DeviceInactive' });
    posture.invalidate('DEV-RB-01');
    when(lookup.findDevice('DEV-RB-01')).thenResolve({ id: 'DEV-RB-01', userId: 'kasun', status: 'ACTIVE' });
    await expect(posture.check(personas.ruwan, RB)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(new DevicePostureService(config).check(personas.ruwan, RB)).rejects.toThrow('registry unavailable');
  });

  describe('X-Device-Id binding', () => {
    beforeEach(() => when(lookup.findDevice(anything())).thenCall(async (id: string) => ({ id, userId: id === 'DEV-FR-01' ? 'fathima' : id === 'DEV-NP-01' ? 'nilanthi' : 'ruwan', status: 'ACTIVE' })));

    it('401 DeviceMismatch when the header names another device, before the registry is read', async () => {
      const err = await posture.check(personas.ruwan, 'DEV-SOMEONE-ELSE').catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.getStatus()).toBe(401);
      expect(err.getResponse()).toMatchObject({ code: 'DeviceMismatch', message: expect.stringMatching(/X-Device-Id/) });
      verify(lookup.findDevice(anything())).never();
    });

    it('takes the first value of a repeated header and ignores blank values', async () => {
      await expect(posture.check(personas.ruwan, [RB, 'DEV-X'])).resolves.toBeUndefined();
      expect(await codeOf(posture.check(personas.ruwan, ['DEV-X', RB]))).toMatchObject({ code: 'DeviceMismatch' });
      expect(await codeOf(posture.check(personas.ruwan, '   '))).toMatchObject({ code: 'DeviceHeaderRequired' });
    });

    it('requires the header by default (REQUIRE_DEVICE_HEADER unset or true)', async () => {
      expect(await codeOf(posture.check(personas.ruwan))).toMatchObject({ code: 'DeviceHeaderRequired' });
      const strict = new DevicePostureService({ ...config, requireDeviceHeader: true }, instance(lookup), () => now);
      expect(await codeOf(strict.check(personas.ruwan, undefined))).toMatchObject({ code: 'DeviceHeaderRequired' });
    });

    it('accepts a missing header when REQUIRE_DEVICE_HEADER=false, but still checks a present one', async () => {
      const lenient = new DevicePostureService({ ...config, requireDeviceHeader: false }, instance(lookup), () => now);
      await expect(lenient.check(personas.ruwan)).resolves.toBeUndefined();
      expect(await codeOf(lenient.check(personas.ruwan, 'DEV-X'))).toMatchObject({ code: 'DeviceMismatch' });
      // the registry is still consulted without the header
      when(lookup.findDevice(RB)).thenResolve({ id: RB, userId: 'ruwan', status: 'REVOKED' });
      lenient.invalidate(RB);
      expect(await codeOf(lenient.check(personas.ruwan))).toMatchObject({ code: 'DeviceInactive' });
    });

    it('keeps posture on for store managers and dispatchers using the field app', async () => {
      const fathima = { ...personas.fathima, clientId: 'lodestar-field', deviceId: 'DEV-FR-01' };
      const nilanthi = { ...personas.nilanthi, clientId: 'lodestar-field', deviceId: 'DEV-NP-01' };
      await expect(posture.check(fathima, 'DEV-FR-01')).resolves.toBeUndefined();
      await expect(posture.check(nilanthi, 'DEV-NP-01')).resolves.toBeUndefined();
      expect(await codeOf(posture.check({ ...fathima, deviceId: undefined }, 'DEV-FR-01'))).toMatchObject({ code: 'DeviceNotBound' });
      expect(await codeOf(posture.check(fathima, 'DEV-NP-01'))).toMatchObject({ code: 'DeviceMismatch' });
      // nilanthi's token naming fathima's phone: header matches the claim, but the device is not hers
      expect(await codeOf(posture.check({ ...nilanthi, deviceId: 'DEV-FR-01' }, 'DEV-FR-01'))).toMatchObject({ code: 'DeviceNotOwned' });
    });

    it('never applies to web or service tokens, header or not', async () => {
      await expect(posture.check(personas.fathima, 'DEV-ANY')).resolves.toBeUndefined();
      await expect(posture.check(personas.agent)).resolves.toBeUndefined();
      verify(lookup.findDevice(anything())).never();
    });
  });

  it('reads devices from the Device table', async () => {
    const prisma = { device: { findUnique: jest.fn().mockResolvedValue({ id: 'D', userId: 'u', status: 'ACTIVE' }) } };
    await expect(new PrismaDeviceLookup(prisma as any).findDevice('D')).resolves.toEqual({ id: 'D', userId: 'u', status: 'ACTIVE' });
    expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { id: 'D' }, select: { id: true, userId: true, status: true } });
  });
});

describe('HttpAuditSink', () => {
  let tokens: ServiceTokenClient;
  let sink: HttpAuditSink;
  const event: AuditEvent = { at: '2026-04-07T00:00:00Z', actor: 'nilanthi', actorRoles: ['dispatcher'], action: 'Plans.Approve', outcome: 'SUCCESS' };

  beforeEach(() => {
    jest.useFakeTimers();
    tokens = mock(ServiceTokenClient);
    when(tokens.configured).thenReturn(true);
    sink = new HttpAuditSink('http://audit:3009/', instance(tokens));
    (sink as any).logger = { warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    sink.stop();
    jest.useRealTimers();
  });

  it('POSTs events to the audit service with the service token client', async () => {
    when(tokens.fetch(anything(), anything())).thenResolve(new Response(null, { status: 204 }));
    await sink.record(event);
    const [url, init] = capture(tokens.fetch).last();
    expect(url).toBe('http://audit:3009/odata/v4/AuditEntries');
    expect(JSON.parse(init!.body as string)).toEqual(event);
    expect(sink.queued).toBe(0);
  });

  it('queues events while the audit service is down and flushes them in order', async () => {
    when(tokens.fetch(anything(), anything())).thenReject(new Error('ECONNREFUSED'));
    await sink.record(event);
    await sink.record({ ...event, action: 'second' });
    expect(sink.queued).toBe(2);
    when(tokens.fetch(anything(), anything())).thenResolve(new Response(null, { status: 503 }));
    await sink.flush();
    expect(sink.queued).toBe(2);
    when(tokens.fetch(anything(), anything())).thenResolve(new Response(null, { status: 204 }));
    await sink.flush();
    expect(sink.queued).toBe(0);
  });

  it('keeps the queue bounded', async () => {
    when(tokens.fetch(anything(), anything())).thenReject(new Error('down'));
    for (let i = 0; i < 1001; i++) await sink.record({ ...event, action: `a${i}` });
    expect(sink.queued).toBe(1000);
  });

  it('only logs when no credentials are configured (local dev)', async () => {
    when(tokens.configured).thenReturn(false);
    await sink.record(event);
    verify(tokens.fetch(anything(), anything())).never();
  });
});

describe('audit payloads', () => {
  it('redacts secrets and caps size', () => {
    expect(redact({ password: 'x', nested: { signature: 'sig', ok: 1 }, list: [{ token: 't' }] })).toEqual({
      password: '[redacted]',
      nested: { signature: '[redacted]', ok: 1 },
      list: [{ token: '[redacted]' }],
    });
    const big = auditPayload({ notes: 'x'.repeat(5000) }, { method: 'POST' });
    expect(big).toMatchObject({ method: 'POST', body: { truncated: true } });
    expect(String(big.bodySha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(auditPayload(undefined).body).toBeUndefined();
  });

  it('never keeps a Dock PIN, not even as a reversible hash of the body', () => {
    const { createHash } = jest.requireActual<typeof import('crypto')>('crypto');
    const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
    const p = auditPayload({ pin: '2468' }, { method: 'POST' });
    expect(p.body).toEqual({ pin: '[redacted]' });
    expect(p.bodyRedacted).toBe(true);
    expect(JSON.stringify(p)).not.toContain('2468');
    // Trying all 10 000 PINs against the hash finds nothing: it covers the redacted body.
    expect(p.bodySha256).toBe(sha({ pin: '[redacted]' }));
    expect(p.bodySha256).not.toBe(sha({ pin: '2468' }));
    expect(redact({ dockPin: '1234', shipping: 'x', spin: 1 })).toEqual({ dockPin: '[redacted]', shipping: 'x', spin: 1 });
    // Bulky fields are dropped but keep the full-body hash (ADM-14 uploads are identified by it).
    const csv = auditPayload({ csv: 'a,b\n1,2' });
    expect(csv.bodySha256).toBe(sha({ csv: 'a,b\n1,2' }));
    expect(csv.bodyRedacted).toBeUndefined();
  });
});

describe('AuditInterceptor', () => {
  let reflector: Reflector;
  let sink: AuditSink;
  let interceptor: AuditInterceptor;
  const handler = () => undefined;
  class C {}
  const ctx = (req: any) =>
    ({ getType: () => 'http', getHandler: () => handler, getClass: () => C, switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;
  const next = (value: unknown): CallHandler => ({ handle: () => of(value) });

  beforeEach(() => {
    reflector = mock(Reflector);
    sink = mock<AuditSink>();
    when(sink.record(anything())).thenResolve();
    when(reflector.getAllAndOverride(NO_AUDIT_KEY, deepEqual([handler, C]))).thenReturn(undefined as any);
    interceptor = new AuditInterceptor(instance(reflector), instance(sink));
  });

  it('records successful writes with the principal and business action', async () => {
    const req = { method: 'POST', originalUrl: '/odata/v4/Plans?x=1', body: { note: 'ok' }, principal: personas.nilanthi, auditInfo: { action: 'Plans.Approve', entitySet: 'Plans', entityKey: 'P1' } };
    await expect(lastValueFrom(interceptor.intercept(ctx(req), next('done')))).resolves.toBe('done');
    const [event] = capture(sink.record).last();
    expect(event).toMatchObject({ actor: 'nilanthi', actorRoles: ['dispatcher'], client: 'lodestar-web', action: 'Plans.Approve', entityKey: 'P1', outcome: 'SUCCESS' });
    expect((event.payload as any).path).toBe('/odata/v4/Plans');
  });

  it('records failures and denials, then rethrows', async () => {
    const req = { method: 'PATCH', originalUrl: '/odata/v4/Orders', body: {}, principal: personas.fathima };
    const failing: CallHandler = { handle: () => throwError(() => new ForbiddenException()) };
    await expect(lastValueFrom(interceptor.intercept(ctx(req), failing))).rejects.toBeInstanceOf(ForbiddenException);
    expect(capture(sink.record).last()[0]).toMatchObject({ outcome: 'DENIED', action: 'PATCH /odata/v4/Orders' });

    const boom: CallHandler = { handle: () => throwError(() => ({ status: 409 })) };
    await expect(lastValueFrom(interceptor.intercept(ctx(req), boom))).rejects.toEqual({ status: 409 });
    expect(capture(sink.record).last()[0].outcome).toBe('FAILED');
  });

  it('skips reads, @NoAudit routes, non-HTTP contexts and already-audited requests', async () => {
    await lastValueFrom(interceptor.intercept(ctx({ method: 'GET' }), next(1)));
    await lastValueFrom(interceptor.intercept(ctx({ method: 'POST', auditDone: true }), next(1)));
    await lastValueFrom(interceptor.intercept({ getType: () => 'ws' } as any, next(1)));
    when(reflector.getAllAndOverride(NO_AUDIT_KEY, deepEqual([handler, C]))).thenReturn(true as any);
    await lastValueFrom(interceptor.intercept(ctx({ method: 'POST' }), next(1)));
    verify(sink.record(anything())).never();
  });

  it('records anonymous callers too', async () => {
    await lastValueFrom(interceptor.intercept(ctx({ method: 'DELETE', url: '/x' }), next(1)));
    expect(capture(sink.record).last()[0]).toMatchObject({ actor: 'anonymous', actorRoles: [] });
  });
});
