import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Allow, ALL_ROLES, AUDIT_SINK, AuditSink, auditPayload } from '@lodestar/security';
import { ODataEngine, ODataResponse } from './engine';
import { ODataError } from './errors';

export const ODATA_PREFIX = '/odata/v4';

/** Absolute service root as the client sees it (behind the gateway). */
export function serviceRoot(req: Request): string {
  const fixed = process.env.PUBLIC_BASE_URL;
  if (fixed) return `${fixed.replace(/\/$/, '')}${ODATA_PREFIX}`;
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : typeof v === 'string' ? v.split(',')[0].trim() : undefined);
  const proto = first(req.headers['x-forwarded-proto']) ?? req.protocol ?? 'http';
  let host = first(req.headers['x-forwarded-host']) ?? req.headers.host ?? 'localhost';
  const port = first(req.headers['x-forwarded-port']);
  if (port && !host.includes(':') && !((proto === 'https' && port === '443') || (proto === 'http' && port === '80'))) {
    host = `${host}:${port}`;
  }
  return `${proto}://${host}${ODATA_PREFIX}`;
}

/**
 * The single HTTP entry point of a service's OData API. Every authenticated
 * role may reach it; the engine applies per-set and per-operation RBAC/ABAC.
 */
@Controller('odata/v4')
@Allow(...ALL_ROLES)
export class ODataController {
  constructor(
    private readonly engine: ODataEngine,
    @Inject(AUDIT_SINK) private readonly audit: AuditSink,
  ) {}

  @All(['', '*'])
  async handle(@Req() req: Request & { principal?: any; auditInfo?: any; auditDone?: boolean }, @Res() res: Response) {
    const url = req.originalUrl;
    const q = url.indexOf('?');
    const rawPath = q < 0 ? url : url.slice(0, q);
    const at = rawPath.indexOf(ODATA_PREFIX);
    const path = at < 0 ? '' : rawPath.slice(at + ODATA_PREFIX.length);

    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.headers['content-length'] !== '0' && req.body !== undefined) {
      const type = String(req.headers['content-type'] ?? '');
      if (type && !type.toLowerCase().startsWith('application/json')) {
        throw new ODataError(415, 'UnsupportedMediaType', 'Request bodies must be application/json');
      }
    }

    const result: ODataResponse = await this.engine.handle({
      method: req.method,
      path,
      query: q < 0 ? '' : url.slice(q + 1),
      headers: req.headers as any,
      body: req.body ?? {},
      principal: req.principal,
      baseUrl: serviceRoot(req),
    });

    // Record the write before answering (assume breach: no unaudited success).
    if (result.audit) {
      req.auditInfo = result.audit;
      await this.audit.record({
        at: new Date().toISOString(),
        actor: req.principal?.sub ?? 'anonymous',
        actorRoles: req.principal?.roles ?? [],
        client: req.principal?.clientId,
        action: result.audit.action,
        entitySet: result.audit.entitySet,
        entityKey: result.audit.entityKey,
        outcome: 'SUCCESS',
        payload: auditPayload(req.body, { method: req.method, path: rawPath, status: result.status }),
      });
      req.auditDone = true;
    }

    res.status(result.status);
    // API answers carry per-user, fast-changing data: never let a browser (or
    // any shared cache) store them. Without this, a cached body plus Express's
    // If-None-Match handling served stale reads (a Trip's expanded loadRecord).
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    if (result.body === undefined) {
      res.end();
      return;
    }
    // res.end, not res.send: send() would add Express's own body-hash ETag and turn a matching
    // If-None-Match into a 304. ETags here are the engine's (entity versions), never Express's.
    const payload = Buffer.from(typeof result.body === 'string' ? result.body : JSON.stringify(result.body), 'utf8');
    res.setHeader('Content-Length', String(payload.length));
    res.end(payload);
  }
}
