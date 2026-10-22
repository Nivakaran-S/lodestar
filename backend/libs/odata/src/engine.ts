import { andWhere, hasAnyRole, Principal, Role, Roles, rowFilter } from '@lodestar/security';
import { etagProperty } from './edm/model';
import { generateCsdl, serviceDocument } from './edm/csdl';
import { ODataError } from './errors';
import { etagMatches, makeEtag } from './etag';
import { formatKey, keyText, parseKeyPredicate } from './keys';
import { coerceEntityBody, coerceParams, parseFunctionArgs } from './params';
import { parseResourcePath, PathSegment, unqualified } from './path';
import { MAX_TOP, Projection, QueryBuilder } from './query/builder';
import { parseQueryOptions, parseQueryString, QueryOptions } from './query/options';
import { ODataRegistry, RegisteredOperation, RegisteredSet } from './registry';
import { contextUrl, ODATA_JSON, projectEntity } from './serialize';
import { OperationContext, WriteContext } from './entity-set';
import { ServiceDocumentEntry } from './service-map';
import { runWithRequestContext } from './request-context';
import { IDEMPOTENCY_KEY_HEADER, IdempotencyService } from './idempotency';

export interface ODataRequest {
  method: string;
  /** Resource path after /odata/v4, still percent-encoded, e.g. /Orders('X') */
  path: string;
  /** Raw query string without '?' */
  query: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  principal: Principal;
  /** Absolute service root as the client sees it, e.g. https://localhost:8443/odata/v4 */
  baseUrl: string;
}

export interface ODataResponse {
  status: number;
  headers: Record<string, string>;
  /** Object → JSON; string → sent as-is with the given Content-Type */
  body?: unknown;
  /** Set for writes so the audit entry names the business operation */
  audit?: { action: string; entitySet?: string; entityKey?: string };
}

type Access = 'read' | 'write';

interface Preferences {
  maxPageSize?: number;
  returnMinimal?: boolean;
  returnRepresentation?: boolean;
}

function header(req: ODataRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v.join(', ') : v;
}

function preferences(req: ODataRequest): Preferences {
  const prefs: Preferences = {};
  for (const part of (header(req, 'prefer') ?? '').split(',')) {
    const [k, v] = part.trim().split('=').map((s) => s?.trim());
    if (k === 'odata.maxpagesize' && /^\d+$/.test(v ?? '')) prefs.maxPageSize = Math.max(1, Number(v));
    if (k === 'return' && v === 'minimal') prefs.returnMinimal = true;
    if (k === 'return' && v === 'representation') prefs.returnRepresentation = true;
  }
  return prefs;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): ODataResponse => ({
  status,
  headers: { 'Content-Type': ODATA_JSON, 'OData-Version': '4.0', ...headers },
  body,
});

/**
 * Framework-independent OData request processor for one service. The Nest
 * controller adapts Express to ODataRequest/ODataResponse; unit tests call
 * handle() directly.
 */
export class ODataEngine {
  private readonly builders = new Map<string, QueryBuilder>();
  private csdl?: string;

  constructor(
    private readonly registry: ODataRegistry,
    private readonly complexTypes: Record<string, Record<string, string>> = {},
    /** Replaces the root service document (auth serves the merged one on AKS). */
    private readonly serviceDocumentOverride?: ServiceDocumentEntry[],
    /** Idempotency-Key support for writes declared idempotent (absent: the header is ignored). */
    private readonly idempotency?: IdempotencyService,
  ) {}

  private get model() {
    return this.registry.model;
  }

  /** Processes one request; the caller is available to data hooks via currentRequest(). */
  handle(req: ODataRequest): Promise<ODataResponse> {
    return runWithRequestContext({ principal: req.principal, headers: req.headers }, () => this.dispatch(req));
  }

  private async dispatch(req: ODataRequest): Promise<ODataResponse> {
    const segments = parseResourcePath(req.path);
    if (segments.length === 0) {
      this.requireMethod(req, 'GET');
      if (this.serviceDocumentOverride) {
        return json(200, { '@odata.context': `${req.baseUrl}/$metadata`, value: this.serviceDocumentOverride });
      }
      const functions = [...this.registry.unbound.values()].filter((o) => o.meta.kind === 'function').map((o) => o.meta.name);
      return json(200, serviceDocument(req.baseUrl, [...this.registry.sets.keys()], functions));
    }

    const [first, ...rest] = segments;
    if (first.name === '$metadata') {
      this.requireMethod(req, 'GET');
      if (rest.length) throw ODataError.notFound();
      return { status: 200, headers: { 'Content-Type': 'application/xml', 'OData-Version': '4.0' }, body: this.metadata() };
    }
    if (first.name.startsWith('$')) throw ODataError.notImplemented(`${first.name} is not supported`);

    const set = this.registry.sets.get(first.name);
    if (!set) {
      const op = this.registry.unbound.get(unqualified(first.name, this.model.namespace));
      if (!op || rest.length) throw ODataError.notFound(`'${first.name}' is not an entity set or operation of this service`);
      return this.invoke(op, req, first);
    }

    if (first.args === undefined) {
      if (rest.length === 0) {
        if (req.method === 'GET') return this.list(set, req);
        if (req.method === 'POST') {
          const rbac = () => this.authorize(req.principal, set.options.create, `create ${set.options.name}`, 'write');
          return this.once(req, !!set.options.idempotentCreate && !!set.options.create?.length, rbac, () => this.create(set, req));
        }
        throw ODataError.methodNotAllowed(`${req.method} is not allowed on a collection`);
      }
      if (rest.length === 1 && rest[0].name === '$count' && rest[0].args === undefined) return this.count(set, req);
      if (rest.length === 1) {
        const op = this.findOperation(set, rest[0].name, 'collection');
        if (op) return this.once(req, this.isIdempotent(op, req), this.opRbac(op, req), () => this.invoke(op, req, rest[0]));
      }
      throw ODataError.notFound(`Unknown path segment '${rest[0].name}'`);
    }

    const key = parseKeyPredicate(first.args, set.type, this.model);
    if (rest.length === 0) {
      switch (req.method) {
        case 'GET':
          return this.get(set, key, req);
        case 'PATCH':
          return this.update(set, key, req);
        case 'DELETE':
          throw ODataError.methodNotAllowed('Business records are never deleted; cancel them with an action');
        default:
          throw ODataError.methodNotAllowed(`${req.method} is not allowed on an entity (use PATCH)`);
      }
    }
    if (rest.length === 1) {
      const op = this.findOperation(set, rest[0].name, 'entity');
      if (op) return this.once(req, this.isIdempotent(op, req), this.opRbac(op, req), () => this.invoke(op, req, rest[0], key));
      if (rest[0].args === undefined) return this.member(set, key, rest[0].name, req);
    }
    throw ODataError.notFound(`Unknown path segment '${rest[rest.length - 1].name}'`);
  }

  // ── idempotent retries ──────────────────────────────────

  private isIdempotent(op: RegisteredOperation, req: ODataRequest): boolean {
    return !!op.meta.idempotent && op.meta.kind === 'action' && req.method === 'POST';
  }

  private opRbac(op: RegisteredOperation, req: ODataRequest) {
    return () => this.authorize(req.principal, op.meta.roles, `invoke ${op.meta.name}`, 'write');
  }

  /**
   * Runs a write at most once per (caller, Idempotency-Key) when the route opts
   * in; a retry gets the stored response with Idempotent-Replay: true. Keys are
   * scoped to the caller's subject, so one user can never replay another's, and
   * RBAC is checked again before anything is replayed.
   */
  private async once(
    req: ODataRequest,
    enabled: boolean,
    rbac: () => void,
    exec: () => Promise<ODataResponse>,
  ): Promise<ODataResponse> {
    if (!enabled || !this.idempotency) return exec();
    rbac();
    const key = IdempotencyService.keyFrom(req.headers[IDEMPOTENCY_KEY_HEADER]);
    if (!key) return exec();
    return this.idempotency.run({ userId: req.principal.sub, key, route: `${req.method} ${req.path}`, body: req.body ?? {} }, exec);
  }

  // ── metadata ────────────────────────────────────────────

  metadata(): string {
    if (!this.csdl) {
      const hidden = this.registry.hiddenFields();
      this.csdl = generateCsdl(this.model, {
        entitySets: [...this.registry.sets.values()].map((s) => ({ name: s.options.name, entityType: s.type.name })),
        operations: this.registry.csdlOperations(),
        complexTypes: this.complexTypes,
        isHidden: (t, p) => !!hidden[t]?.includes(p),
      });
    }
    return this.csdl;
  }

  // ── authorization ───────────────────────────────────────

  /**
   * RBAC for a set or operation, plus least-privilege scopes for service
   * identities: a svc token needs `<service>.read` / `<service>.write`.
   */
  private authorize(p: Principal, roles: Role[] | undefined, what: string, access: Access) {
    if (!roles?.length || !hasAnyRole(p, roles)) throw ODataError.forbidden(`Your role may not ${what}`);
    if (p.isService && !p.roles.includes(Roles.Admin)) {
      const scope = `${this.registry.service}.${access}`;
      if (!p.scopes.includes(scope)) throw ODataError.forbidden(`Service token lacks scope ${scope}`);
    }
  }

  private requireMethod(req: ODataRequest, method: string) {
    if (req.method !== method) throw ODataError.methodNotAllowed(`Only ${method} is allowed here`);
  }

  private builder(set: RegisteredSet): QueryBuilder {
    let b = this.builders.get(set.options.name);
    if (!b) {
      b = new QueryBuilder(this.model, set.type, {
        navigation: set.options.navigation ?? [],
        filterPaths: set.options.filterPaths ?? [],
        expandPaths: set.options.expandPaths ?? [],
        search: set.options.search ?? [],
        hidden: this.registry.hiddenFields(),
        defaultOrderBy: set.defaultOrderBy,
      });
      this.builders.set(set.options.name, b);
    }
    return b;
  }

  // ── reads ───────────────────────────────────────────────

  private async list(set: RegisteredSet, req: ODataRequest): Promise<ODataResponse> {
    this.authorize(req.principal, set.options.read, `read ${set.options.name}`, 'read');
    const opts = parseQueryOptions(req.query);
    const plan = this.builder(set).build(opts);
    const where = andWhere(plan.where, rowFilter(req.principal, set.options.abac));

    const prefs = preferences(req);
    const pageSize = Math.min(prefs.maxPageSize ?? MAX_TOP, MAX_TOP);
    // $top equal to the server maximum is read as "one full page, keep paging":
    // clients (the planning agent) send $top=500 and follow @odata.nextLink.
    const top = plan.top === MAX_TOP ? undefined : plan.top;
    const remaining = top ?? Number.POSITIVE_INFINITY;
    const take = Math.min(pageSize, remaining);

    const [rows, count] = await Promise.all([
      set.handler.findMany({ where, select: plan.select, orderBy: plan.orderBy, skip: plan.skip, take: take + 1 }),
      opts.count ? set.handler.count(where) : Promise.resolve(undefined),
    ]);
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);

    const body: Record<string, unknown> = {
      '@odata.context': contextUrl(req.baseUrl, set.options.name + this.selectSuffix(opts)),
    };
    if (count !== undefined) body['@odata.count'] = count;
    body.value = page.map((r) => projectEntity(r, plan.projection));
    if (hasMore && take < remaining) {
      body['@odata.nextLink'] = this.nextLink(req, plan.skip + take, top !== undefined ? top - take : undefined);
    }
    const headers: Record<string, string> = {};
    if (prefs.maxPageSize) headers['Preference-Applied'] = `odata.maxpagesize=${pageSize}`;
    return json(200, body, headers);
  }

  private selectSuffix(opts: QueryOptions): string {
    return opts.select && !opts.select.includes('*') ? `(${opts.select.join(',')})` : '';
  }

  /** Next page link: same request with $skip advanced (and $top reduced if given). */
  private nextLink(req: ODataRequest, skip: number, top?: number): string {
    const kept = req.query
      .split('&')
      .filter((p) => p && !/^(\$|%24)(skip|top|skiptoken)=/i.test(p));
    kept.push(`$skip=${skip}`);
    if (top !== undefined) kept.push(`$top=${top}`);
    return `${req.baseUrl}${req.path}?${kept.join('&')}`;
  }

  private async count(set: RegisteredSet, req: ODataRequest): Promise<ODataResponse> {
    this.requireMethod(req, 'GET');
    this.authorize(req.principal, set.options.read, `read ${set.options.name}`, 'read');
    const opts = parseQueryOptions(req.query);
    const plan = this.builder(set).build({ aliases: opts.aliases, filter: opts.filter, search: opts.search });
    const n = await set.handler.count(andWhere(plan.where, rowFilter(req.principal, set.options.abac)));
    return { status: 200, headers: { 'Content-Type': 'text/plain', 'OData-Version': '4.0' }, body: String(n) };
  }

  /** Only $select/$expand/$format apply to a single entity. */
  private singleOptions(req: ODataRequest): QueryOptions {
    const opts = parseQueryOptions(req.query);
    for (const k of ['filter', 'orderby', 'top', 'skip', 'count', 'search'] as const) {
      if (opts[k] !== undefined) throw ODataError.invalidQuery(`$${k}`, `$${k} is not allowed when addressing a single entity`);
    }
    return opts;
  }

  private async get(set: RegisteredSet, key: Record<string, unknown>, req: ODataRequest): Promise<ODataResponse> {
    this.authorize(req.principal, set.options.read, `read ${set.options.name}`, 'read');
    const opts = this.singleOptions(req);
    const plan = this.builder(set).build({ aliases: {}, select: opts.select, expand: opts.expand });
    const row = await set.handler.findFirst({
      where: andWhere(key, rowFilter(req.principal, set.options.abac)),
      select: plan.select,
    });
    if (!row) throw ODataError.notFound(`${set.options.name}${formatKey(set.type, key)} was not found`);
    const entity = projectEntity(row, plan.projection);
    // The ETag versions the ROOT entity only (its updatedAt). With $expand the
    // representation also depends on related rows (a LoadRecord created under
    // a Trip does not touch Trip.updatedAt), so a root ETag header would let
    // If-None-Match revalidation answer 304 with a stale expansion. The body
    // keeps @odata.etag, which is all If-Match on writes needs.
    const etagHeader = entity['@odata.etag'] && !opts.expand?.length ? { ETag: String(entity['@odata.etag']) } : {};
    return json(
      200,
      { '@odata.context': contextUrl(req.baseUrl, `${set.options.name}${this.selectSuffix(opts)}/$entity`), ...entity },
      etagHeader,
    );
  }

  /** GET Set('key')/property or Set('key')/navigation */
  private async member(set: RegisteredSet, key: Record<string, unknown>, name: string, req: ODataRequest) {
    this.requireMethod(req, 'GET');
    this.authorize(req.principal, set.options.read, `read ${set.options.name}`, 'read');
    const builder = this.builder(set);
    const prop = set.type.properties.get(name);
    if (!prop || builder.isHidden(set.type, name)) throw ODataError.notFound(`'${name}' is not a property of ${set.type.name}`);
    const where = andWhere(key, rowFilter(req.principal, set.options.abac));
    const ctx = contextUrl(req.baseUrl, `${set.options.name}${formatKey(set.type, key)}/${name}`);

    if (prop.kind !== 'object') {
      const row = await set.handler.findFirst({ where, select: { [name]: true } });
      if (!row) throw ODataError.notFound();
      return json(200, { '@odata.context': ctx, value: row[name] ?? null });
    }
    const opts = parseQueryOptions(req.query);
    const plan = builder.build({
      aliases: {},
      select: set.type.keys,
      expand: [{ navigation: name, options: { select: opts.select, filter: opts.filter, orderby: opts.orderby, top: opts.top, skip: opts.skip } }],
    });
    const row = await set.handler.findFirst({ where, select: plan.select });
    if (!row) throw ODataError.notFound();
    const projected = projectEntity(row, plan.projection)[name];
    if (Array.isArray(projected)) return json(200, { '@odata.context': ctx, value: projected });
    if (!projected) return { status: 204, headers: { 'OData-Version': '4.0' } };
    return json(200, { '@odata.context': ctx, ...(projected as object) });
  }

  // ── writes ──────────────────────────────────────────────

  private writeContext(req: ODataRequest): WriteContext {
    return { principal: req.principal, headers: req.headers };
  }

  private async create(set: RegisteredSet, req: ODataRequest): Promise<ODataResponse> {
    if (!set.options.create?.length) throw ODataError.methodNotAllowed(`${set.options.name} is read-only`);
    this.authorize(req.principal, set.options.create, `create ${set.options.name}`, 'write');
    const ctx = this.writeContext(req);

    let data = coerceEntityBody(req.body, set.type, set.options.insertable ?? [], this.model);
    data = await set.handler.beforeCreate(data, ctx);
    const created = await set.handler.create(data, ctx);

    const keyWhere = Object.fromEntries(set.type.keys.map((k) => [k, created[k]]));
    const plan = this.builder(set).build({ aliases: {} });
    const row = (await set.handler.findFirst({ where: keyWhere, select: plan.select })) ?? created;
    const entity = projectEntity(row, plan.projection);
    const location = `${req.baseUrl}/${set.options.name}${formatKey(set.type, row)}`;
    const audit = { action: `${set.options.name}.Create`, entitySet: set.options.name, entityKey: keyText(set.type, row) };
    const headers: Record<string, string> = { Location: location };
    if (entity['@odata.etag']) headers.ETag = String(entity['@odata.etag']);

    if (preferences(req).returnMinimal) {
      return { status: 204, headers: { ...headers, 'OData-Version': '4.0', 'OData-EntityId': location, 'Preference-Applied': 'return=minimal' }, audit };
    }
    return { ...json(201, { '@odata.context': contextUrl(req.baseUrl, `${set.options.name}/$entity`), ...entity }, headers), audit };
  }

  private async update(set: RegisteredSet, key: Record<string, unknown>, req: ODataRequest): Promise<ODataResponse> {
    if (!set.options.update?.length) throw ODataError.methodNotAllowed(`${set.options.name} cannot be changed with PATCH`);
    this.authorize(req.principal, set.options.update, `change ${set.options.name}`, 'write');
    const ctx = this.writeContext(req);
    const scoped = andWhere(key, rowFilter(req.principal, set.options.abac));
    const plan = this.builder(set).build({ aliases: {} });

    const current = await set.handler.findFirst({ where: scoped, select: plan.select });
    if (!current) throw ODataError.notFound(`${set.options.name}${formatKey(set.type, key)} was not found`);

    const etagField = etagProperty(set.type);
    if (etagField) {
      const ifMatch = header(req, 'if-match');
      if (!ifMatch) throw ODataError.preconditionRequired();
      if (!etagMatches(ifMatch, makeEtag(current[etagField]))) throw ODataError.preconditionFailed();
    }

    let patch = coerceEntityBody(req.body, set.type, set.options.updatable ?? [], this.model);
    if (!Object.keys(patch).length) throw ODataError.badRequest('Nothing to update');
    patch = await set.handler.beforeUpdate(patch, current, ctx);

    // Conditional write: the row must still carry the ETag we checked.
    const changed = await set.handler.updateWhere(
      andWhere(scoped, etagField ? { [etagField]: current[etagField] } : undefined)!,
      patch,
      ctx,
    );
    if (changed === 0) throw ODataError.preconditionFailed();

    const row = await set.handler.findFirst({ where: key, select: plan.select });
    const entity = projectEntity(row ?? current, plan.projection);
    const audit = { action: `${set.options.name}.Update`, entitySet: set.options.name, entityKey: keyText(set.type, key) };
    const headers: Record<string, string> = entity['@odata.etag'] ? { ETag: String(entity['@odata.etag']) } : {};
    if (preferences(req).returnMinimal) return { status: 204, headers: { ...headers, 'OData-Version': '4.0' }, audit };
    return { ...json(200, { '@odata.context': contextUrl(req.baseUrl, `${set.options.name}/$entity`), ...entity }, headers), audit };
  }

  // ── operations ──────────────────────────────────────────

  private findOperation(set: RegisteredSet, segment: string, binding: 'entity' | 'collection'): RegisteredOperation | undefined {
    const name = unqualified(segment, this.model.namespace);
    return set.operations.find((o) => o.meta.name === name && o.meta.binding === binding);
  }

  private async invoke(
    op: RegisteredOperation,
    req: ODataRequest,
    segment: PathSegment,
    key?: Record<string, unknown>,
  ): Promise<ODataResponse> {
    const { meta, set } = op;
    if (meta.kind === 'action' && req.method !== 'POST') throw ODataError.methodNotAllowed(`Action ${meta.name} must be invoked with POST`);
    if (meta.kind === 'function' && req.method !== 'GET') throw ODataError.methodNotAllowed(`Function ${meta.name} must be invoked with GET`);
    this.authorize(req.principal, meta.roles, `invoke ${meta.name}`, meta.kind === 'action' ? 'write' : 'read');

    let raw: Record<string, unknown>;
    if (meta.kind === 'action') {
      if (segment.args && segment.args.trim()) throw ODataError.badRequest('Action parameters go in the request body');
      const body = req.body ?? {};
      if (typeof body !== 'object' || Array.isArray(body)) throw ODataError.badRequest('The request body must be a JSON object');
      raw = body as Record<string, unknown>;
    } else {
      raw = parseFunctionArgs(segment.args, Object.fromEntries(parseQueryString(req.query)));
    }
    const params = coerceParams(raw, meta.params, this.model);
    const ctx: OperationContext = { principal: req.principal, params, headers: req.headers };

    if (set && meta.binding === 'entity') {
      const where = andWhere(key, rowFilter(req.principal, set.options.abac));
      const entity = await set.handler.findFirst({ where });
      if (!entity) throw ODataError.notFound(`${set.options.name}${formatKey(set.type, key!)} was not found`);
      const ifMatch = header(req, 'if-match');
      const etagField = etagProperty(set.type);
      if (ifMatch && etagField && !etagMatches(ifMatch, makeEtag(entity[etagField]))) throw ODataError.preconditionFailed();
      ctx.key = key;
      ctx.entity = entity;
    } else if (set) {
      ctx.rowFilter = rowFilter(req.principal, set.options.abac);
    }

    const result = await op.invoke(ctx);
    const audit =
      meta.kind === 'action'
        ? {
            action: set ? `${set.options.name}.${meta.name}` : meta.name,
            entitySet: set?.options.name,
            entityKey: key && set ? keyText(set.type, key) : undefined,
          }
        : undefined;
    return { ...this.operationResult(meta.returns, result, req.baseUrl), audit };
  }

  /** Wraps an operation result in the OData response shape for its declared return type. */
  private operationResult(returns: string | undefined, result: unknown, baseUrl: string): ODataResponse {
    if (result === undefined || result === null) return { status: 204, headers: { 'OData-Version': '4.0' } };
    const ns = this.model.namespace;
    const coll = returns ? /^Collection\((.+)\)$/.exec(returns) : null;
    const inner = coll ? coll[1] : returns;
    const typeName = inner?.startsWith(`${ns}.`) ? inner.slice(ns.length + 1) : undefined;
    const type = typeName ? this.model.entityTypes.get(typeName) : undefined;

    if (type) {
      const set = [...this.registry.sets.values()].find((s) => s.type.name === type.name);
      const projection: Projection = set
        ? this.builder(set).build({ aliases: {} }).projection
        : { type, fields: [...type.properties.values()].filter((p) => p.kind !== 'object').map((p) => p.name), etagField: etagProperty(type), expand: {} };
      const fragment = set ? set.options.name : `${ns}.${type.name}`;
      if (coll) {
        const rows = Array.isArray(result) ? result : [];
        return json(200, { '@odata.context': contextUrl(baseUrl, fragment), value: rows.map((r) => projectEntity(r, projection)) });
      }
      return json(200, { '@odata.context': contextUrl(baseUrl, `${fragment}/$entity`), ...projectEntity(result as any, projection) });
    }

    const fragment = inner ? (coll ? `Collection(${inner})` : inner) : undefined;
    const ctx = fragment ? { '@odata.context': contextUrl(baseUrl, fragment) } : {};
    if (Array.isArray(result) || typeof result !== 'object' || inner?.startsWith('Edm.')) return json(200, { ...ctx, value: result });
    return json(200, { ...ctx, ...(result as object) });
  }
}
