// Typed OData v4 client for the Lodestar API (docs/architecture/PLATFORM.md §3).
// Bearer token on every call, device id header, server-driven paging (@odata.nextLink), ETags
// (If-Match on PATCH and optionally on actions) and the OData JSON error shape.
// Tokens are never logged.

export type Query = {
  filter?: string;
  select?: string | string[];
  expand?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  count?: boolean;
  search?: string;
};

export type Collection<T> = { value: T[]; count?: number; nextLink?: string };
export type WithEtag<T> = T & { '@odata.etag'?: string };

export class ODataError extends Error {
  readonly status: number;
  readonly code: string;
  readonly target?: string | null;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, target?: string | null, details: unknown[] = []) {
    super(message);
    this.name = 'ODataError';
    this.status = status;
    this.code = code;
    this.target = target;
    this.details = details;
  }

  /** No answer at all (offline, DNS, TLS, timeout): worth retrying later. */
  get isNetwork() {
    return this.status === 0;
  }

  /** Worth retrying later: network, rate limit or a server-side failure. */
  get isTransient() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }

  /** The device posture check refused the token (PLATFORM.md §2.6). */
  get isDeviceProblem() {
    return this.status === 401 && /device/i.test(this.message);
  }
}

/** ('ORD1') / (42): an OData key segment. */
export function key(value: string | number): string {
  return typeof value === 'number' ? `(${value})` : `(${lit(value)})`;
}

/** An OData literal: strings quoted with '' escaping, numbers and booleans as is. */
export function lit(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  return String(value);
}

/** `field in ('a','b')` */
export function inList(field: string, values: (string | number)[]): string {
  return `${field} in (${values.map(v => lit(v)).join(',')})`;
}

export function queryString(q?: Query): string {
  if (!q) return '';
  const parts: string[] = [];
  const add = (k: string, v: string) => parts.push(`${k}=${encodeURIComponent(v)}`);
  if (q.filter) add('$filter', q.filter);
  if (q.select) add('$select', Array.isArray(q.select) ? q.select.join(',') : q.select);
  if (q.expand) add('$expand', q.expand);
  if (q.orderby) add('$orderby', q.orderby);
  if (q.top !== undefined) add('$top', String(q.top));
  if (q.skip !== undefined) add('$skip', String(q.skip));
  if (q.count) add('$count', 'true');
  if (q.search) add('$search', q.search);
  return parts.length ? `?${parts.join('&')}` : '';
}

export type ClientOptions = {
  /** Gateway origin, e.g. https://localhost:8443 (a function is read on every call). */
  baseUrl: string | (() => string);
  /** OData root path; default /odata/v4 */
  root?: string;
  fetch?: typeof fetch;
  /** Current access token, refreshed as needed. null when signed out. */
  getToken: () => Promise<string | null>;
  /** Device id sent as X-Device-Id (device posture). */
  getDeviceId?: () => Promise<string | null>;
  /** Send X-Device-Id and Idempotency-Key (only where no CORS preflight blocks them). */
  extraHeaders?: () => boolean;
  /**
   * A 401 came back. Return true when a new token is available and the call should be
   * retried once (e.g. after a refresh); false to give up (the session handles sign-out).
   */
  onUnauthorized?: (err: ODataError) => Promise<boolean>;
  /** Network reachability feedback for the offline banner. */
  onNetwork?: (ok: boolean) => void;
  timeoutMs?: number;
};

export type RequestOptions = {
  query?: Query;
  body?: unknown;
  ifMatch?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  /** A binary body sent as is (a POD photo); its Content-Type goes in `headers`. */
  raw?: ArrayBuffer | Uint8Array;
};

export type Response<T> = { status: number; data: T; etag?: string };

export class ODataClient {
  private readonly root: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: ClientOptions) {
    this.root = opts.root ?? '/odata/v4';
    this.doFetch = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Absolute URL for a path under the OData root ('Trips', "Trips('x')/Lodestar.Release"). */
  url(path: string, q?: Query): string {
    if (/^https?:\/\//i.test(path)) path = path.replace(/^https?:\/\/[^/]+/i, '');
    const rel = path.startsWith('/') ? path : `${this.root}/${path}`;
    const base = typeof this.opts.baseUrl === 'function' ? this.opts.baseUrl() : this.opts.baseUrl;
    return `${base}${rel}${queryString(q)}`;
  }

  async request<T = unknown>(method: string, path: string, o: RequestOptions = {}, retried = false): Promise<Response<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', 'OData-MaxVersion': '4.0', ...o.headers };
    const token = await this.opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const extras = this.opts.extraHeaders ? this.opts.extraHeaders() : true;
    if (extras) {
      const device = this.opts.getDeviceId ? await this.opts.getDeviceId() : null;
      if (device) headers['X-Device-Id'] = device;
      if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey;
    }
    if (o.ifMatch) headers['If-Match'] = o.ifMatch;
    let body: string | ArrayBuffer | Uint8Array | undefined;
    if (o.raw !== undefined) {
      body = o.raw;
    } else if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.body);
    }

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 20_000) : undefined;
    let res: globalThis.Response;
    try {
      // no-store: never revalidate against the browser's HTTP cache (a 304 would bring back a stale $expand)
      res = await this.doFetch(this.url(path, o.query), { method, headers, body: body as BodyInit | undefined, signal: ctrl?.signal, cache: 'no-store' });
    } catch (e) {
      this.opts.onNetwork?.(false);
      const aborted = (e as Error)?.name === 'AbortError';
      throw new ODataError(0, aborted ? 'Timeout' : 'NetworkError', aborted ? 'The server took too long to answer' : 'No connection to the server');
    } finally {
      if (timer) clearTimeout(timer);
    }
    this.opts.onNetwork?.(true);

    const text = await res.text();
    let json: any = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    if (!res.ok) {
      const e = json && typeof json === 'object' && json.error ? json.error : {};
      const err = new ODataError(
        res.status,
        typeof e.code === 'string' ? e.code : `Http${res.status}`,
        typeof e.message === 'string' ? e.message : res.statusText || `HTTP ${res.status}`,
        e.target ?? null,
        Array.isArray(e.details) ? e.details : [],
      );
      if (res.status === 401 && !retried && this.opts.onUnauthorized && (await this.opts.onUnauthorized(err))) {
        return this.request<T>(method, path, o, true);
      }
      throw err;
    }
    const etag = res.headers.get('ETag') ?? (json && typeof json === 'object' ? json['@odata.etag'] : undefined) ?? undefined;
    return { status: res.status, data: json as T, etag };
  }

  /** One page of a collection. */
  async list<T>(set: string, q?: Query): Promise<Collection<T>> {
    const { data } = await this.request<any>('GET', set, { query: q });
    return { value: data?.value ?? [], count: data?.['@odata.count'], nextLink: data?.['@odata.nextLink'] };
  }

  /** Every page of a collection, following @odata.nextLink (bounded). */
  async all<T>(set: string, q?: Query, maxPages = 20): Promise<T[]> {
    const out: T[] = [];
    let page = await this.list<T>(set, q);
    out.push(...page.value);
    for (let i = 1; page.nextLink && i < maxPages; i++) {
      const { data } = await this.request<any>('GET', page.nextLink);
      page = { value: data?.value ?? [], nextLink: data?.['@odata.nextLink'] };
      out.push(...page.value);
    }
    return out;
  }

  async get<T>(set: string, id: string | number, q?: Pick<Query, 'select' | 'expand'>): Promise<WithEtag<T>> {
    const { data, etag } = await this.request<any>('GET', `${set}${key(id)}`, { query: q });
    return etag && !data['@odata.etag'] ? { ...data, '@odata.etag': etag } : data;
  }

  async create<T>(set: string, body: unknown, o: Omit<RequestOptions, 'body'> = {}): Promise<WithEtag<T>> {
    const { data } = await this.request<any>('POST', set, { ...o, body });
    return data;
  }

  /** PATCH with If-Match (the API requires the entity's ETag). */
  async patch<T>(set: string, id: string | number, patch: unknown, etag: string): Promise<WithEtag<T>> {
    const { data } = await this.request<any>('PATCH', `${set}${key(id)}`, { body: patch, ifMatch: etag });
    return data;
  }

  /** POST an action, e.g. action("Trips('T1')/Lodestar.Release", {...}). Edm.Untyped results come back unwrapped. */
  async action<T = unknown>(path: string, params: unknown = {}, o: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    const { data } = await this.request<any>('POST', path, { ...o, body: params });
    return unwrap<T>(data);
  }

  /** GET a function, e.g. fn("Trips/Lodestar.BayQueue(depot='KANDY',runDate=2026-04-07)"). */
  async fn<T = unknown>(path: string): Promise<T> {
    const { data } = await this.request<any>('GET', path);
    return unwrap<T>(data);
  }
}

/** Operation results: {"value": …} for primitives/untyped/collections, the entity itself otherwise. */
function unwrap<T>(data: any): T {
  if (data && typeof data === 'object' && 'value' in data && Object.keys(data).every(k => k === 'value' || k.startsWith('@'))) return data.value as T;
  return data as T;
}
