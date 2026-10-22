import { anything, capture, instance, mock, resetCalls, verify, when } from 'ts-mockito';
import { ALL_ROLES } from '@lodestar/security';
import { personas, principal } from '../../security/test/principals';
import { testModel } from '../test/fixtures';
import { ODataEngine, ODataRequest } from './engine';
import { EntitySet, ModelDelegate, ODataAction, ODataEntitySet, ODataFunction, OperationContext, WriteContext } from './entity-set';
import { ODataRegistry } from './registry';
import { currentRequest } from './request-context';

@EntitySet({
  name: 'Orders',
  model: 'Order',
  read: ['dispatcher', 'store_manager', 'svc', 'admin'],
  create: ['store_manager'],
  update: ['dispatcher'],
  abac: {
    depot: (d) => ({ outlet: { is: { depot: { in: d } } } }),
    outlet: (o) => ({ outletId: o }),
  },
  navigation: ['outlet', 'lineItems'],
  search: ['notes'],
  insertable: ['id', 'outletId', 'units', 'kg', 'runDate', 'status', 'tempClass', 'deferredYesterday', 'notes'],
  updatable: ['notes', 'units'],
  hidden: ['meta'],
})
class OrdersTestSet extends ODataEntitySet {
  created: any[] = [];

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    return { ...data, createdBy: ctx.principal.sub };
  }

  async create(data: Record<string, any>) {
    this.created.push(data);
    return { id: data.id };
  }

  @ODataAction({ name: 'Cancel', binding: 'entity', roles: ['store_manager'], params: { reason: 'Edm.String' }, returns: 'Lodestar.Order' })
  async cancel(ctx: OperationContext) {
    return { ...ctx.entity, status: 'CANCELLED', updatedAt: new Date(5) };
  }

  @ODataAction({ name: 'Touch', binding: 'entity', roles: ['store_manager'] })
  async touch() {
    return undefined;
  }

  @ODataFunction({
    name: 'Summary',
    binding: 'collection',
    roles: ['dispatcher'],
    params: { runDate: { type: 'Edm.Date', required: true }, depot: 'Lodestar.Depot' },
    returns: 'Lodestar.OrdersSummary',
  })
  summary(ctx: OperationContext) {
    return { runDate: ctx.params.runDate, depot: ctx.params.depot, filter: ctx.rowFilter, caller: currentRequest()?.principal.sub };
  }

  @ODataFunction({ name: 'Open', binding: 'collection', roles: ['dispatcher'], returns: 'Collection(Lodestar.Order)' })
  open() {
    return [{ id: 'A', units: 1, updatedAt: new Date(1) }];
  }
}

@EntitySet({ name: 'ServiceAllowances', model: 'ServiceAllowance', read: ALL_ROLES, abac: { open: '*' } })
class AllowancesTestSet extends ODataEntitySet {}

@EntitySet({ name: 'Calendar', model: 'Calendar', read: ALL_ROLES, abac: { open: '*' } })
class CalendarTestSet extends ODataEntitySet {}

class Operations {
  @ODataFunction({ name: 'Ping', binding: 'unbound', roles: ALL_ROLES, params: { n: 'Edm.Int32' }, returns: 'Edm.String' })
  ping(ctx: OperationContext) {
    return `pong ${ctx.params.n ?? 0}`;
  }

  @ODataAction({ name: 'Reset', binding: 'unbound', roles: ['admin'] })
  reset() {
    return undefined;
  }
}

describe('ODataEngine', () => {
  const model = testModel();
  let orders: ModelDelegate;
  let allowances: ModelDelegate;
  let calendar: ModelDelegate;
  let set: OrdersTestSet;
  let engine: ODataEngine;
  const base = 'https://localhost:8443/odata/v4';

  const req = (over: Partial<ODataRequest>): ODataRequest => ({
    method: 'GET',
    path: '',
    query: '',
    headers: {},
    principal: personas.nilanthi,
    baseUrl: base,
    ...over,
  });

  const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, units: 3, notes: null, updatedAt: new Date(1_700_000_000_000), ...extra });

  beforeEach(() => {
    orders = mock<ModelDelegate>();
    allowances = mock<ModelDelegate>();
    calendar = mock<ModelDelegate>();
    const prisma = { order: instance(orders), serviceAllowance: instance(allowances), calendar: instance(calendar) };
    set = new OrdersTestSet(prisma);
    const registry = new ODataRegistry('orders', model, [set, new AllowancesTestSet(prisma), new CalendarTestSet(prisma)], [new Operations()]);
    engine = new ODataEngine(registry, { OrdersSummary: { runDate: 'Edm.Date' } });
  });

  describe('service document and $metadata', () => {
    it('lists the entity sets and function imports', async () => {
      const res = await engine.handle(req({ path: '/' }));
      expect(res.status).toBe(200);
      expect(res.headers['OData-Version']).toBe('4.0');
      expect(res.body).toEqual({
        '@odata.context': `${base}/$metadata`,
        value: [
          { name: 'Orders', kind: 'EntitySet', url: 'Orders' },
          { name: 'ServiceAllowances', kind: 'EntitySet', url: 'ServiceAllowances' },
          { name: 'Calendar', kind: 'EntitySet', url: 'Calendar' },
          { name: 'Ping', kind: 'FunctionImport', url: 'Ping' },
        ],
      });
    });

    it('serves CSDL XML with sets, operations and complex types; hides secrets', async () => {
      const res = await engine.handle(req({ path: '/$metadata' }));
      expect(res.headers['Content-Type']).toBe('application/xml');
      const xml = res.body as string;
      expect(xml).toContain('<EntitySet Name="Orders" EntityType="Lodestar.Order"/>');
      expect(xml).toContain('<Action Name="Cancel" IsBound="true">');
      expect(xml).toContain('<Function Name="Summary" IsBound="true">');
      expect(xml).toContain('<FunctionImport Name="Ping" Function="Lodestar.Ping" IncludeInServiceDocument="true"/>');
      expect(xml).toContain('<ActionImport Name="Reset" Action="Lodestar.Reset"/>');
      expect(xml).toContain('<ComplexType Name="OrdersSummary">');
      expect(xml).not.toContain('passwordHash');
      expect(xml).not.toContain('Name="meta"');
      expect(await engine.metadata()).toBe(xml); // cached
    });

    it('can serve a merged service document instead of its own', async () => {
      const merged = new ODataEngine((engine as any).registry, {}, [
        { name: 'Orders', kind: 'EntitySet', url: 'Orders' },
        { name: 'Trips', kind: 'EntitySet', url: 'Trips' },
      ]);
      const res = await merged.handle(req({ path: '' }));
      expect((res.body as any).value.map((v: any) => v.name)).toEqual(['Orders', 'Trips']);
    });

    it('rejects writes to the service root and unknown $ segments', async () => {
      await expect(engine.handle(req({ method: 'POST', path: '/' }))).rejects.toMatchObject({ status: 405 });
      await expect(engine.handle(req({ path: '/$batch' }))).rejects.toMatchObject({ status: 501 });
      await expect(engine.handle(req({ path: '/$metadata/x' }))).rejects.toMatchObject({ status: 404 });
      await expect(engine.handle(req({ path: '/Nope' }))).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('collections', () => {
    it('translates the query, applies the row filter and wraps the result', async () => {
      when(orders.findMany(anything())).thenResolve([row('A'), row('B')]);
      when(orders.count(anything())).thenResolve(2);
      const res = await engine.handle(req({ path: '/Orders', query: "$filter=units%20gt%202&$select=units&$count=true&$orderby=units%20desc" }));

      const [args] = capture(orders.findMany).last();
      expect(args).toEqual({
        where: { AND: [{ units: { gt: 2 } }, { outlet: { is: { depot: { in: ['PELIYAGODA', 'KANDY'] } } } }] },
        select: { id: true, units: true, updatedAt: true },
        orderBy: [{ units: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 501,
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        '@odata.context': `${base}/$metadata#Orders(units)`,
        '@odata.count': 2,
        value: [
          { '@odata.etag': 'W/"1700000000000"', id: 'A', units: 3 },
          { '@odata.etag': 'W/"1700000000000"', id: 'B', units: 3 },
        ],
      });
    });

    it('pages on the server with @odata.nextLink (Prefer odata.maxpagesize)', async () => {
      when(orders.findMany(anything())).thenResolve([row('A'), row('B'), row('C')]);
      const res = await engine.handle(req({ path: '/Orders', query: '$select=id', headers: { prefer: 'odata.maxpagesize=2' } }));
      expect((res.body as any).value).toHaveLength(2);
      expect((res.body as any)['@odata.nextLink']).toBe(`${base}/Orders?$select=id&$skip=2`);
      expect(res.headers['Preference-Applied']).toBe('odata.maxpagesize=2');
      expect(capture(orders.findMany).last()[0].take).toBe(3);
    });

    it('carries the remaining $top into the next link', async () => {
      when(orders.findMany(anything())).thenResolve([row('A'), row('B'), row('C')]);
      const res = await engine.handle(req({ path: '/Orders', query: '$top=5&$skip=10', headers: { prefer: 'odata.maxpagesize=2' } }));
      expect((res.body as any)['@odata.nextLink']).toBe(`${base}/Orders?$skip=12&$top=3`);
    });

    it('treats $top=500 (the maximum) as a page size and keeps paging', async () => {
      when(orders.findMany(anything())).thenResolve(Array.from({ length: 501 }, (_, i) => row(`O${i}`)));
      const res = await engine.handle(req({ path: '/Orders', query: '$top=500&$filter=units%20gt%200' }));
      expect((res.body as any).value).toHaveLength(500);
      expect((res.body as any)['@odata.nextLink']).toBe(`${base}/Orders?$filter=units%20gt%200&$skip=500`);
    });

    it('does not page beyond an explicit $top', async () => {
      when(orders.findMany(anything())).thenResolve([row('A'), row('B'), row('C')]);
      const res = await engine.handle(req({ path: '/Orders', query: '$top=2' }));
      expect((res.body as any).value).toHaveLength(2);
      expect((res.body as any)['@odata.nextLink']).toBeUndefined();
    });

    it('expands navigations and projects nested rows', async () => {
      when(orders.findMany(anything())).thenResolve([
        { ...row('A'), lineItems: [{ id: 'L1', name: 'Milk', qty: 2, kg: 1 }], outlet: null },
      ]);
      const res = await engine.handle(req({ path: '/Orders', query: '$select=id&$expand=lineItems($select=name),outlet' }));
      expect((res.body as any).value[0]).toEqual({ '@odata.etag': 'W/"1700000000000"', id: 'A', lineItems: [{ id: 'L1', name: 'Milk' }], outlet: null });
    });

    it('scopes a store manager to her outlet and denies callers without the claim', async () => {
      when(orders.findMany(anything())).thenResolve([]);
      await engine.handle(req({ path: '/Orders', principal: personas.fathima }));
      expect(capture(orders.findMany).last()[0].where).toEqual({ outletId: 'OUT106' });

      await engine.handle(req({ path: '/Orders', principal: principal({ roles: ['store_manager'] }) }));
      expect(capture(orders.findMany).last()[0].where).toEqual({ OR: [] });
    });

    it('enforces RBAC and service scopes', async () => {
      when(orders.findMany(anything())).thenResolve([]);
      await expect(engine.handle(req({ path: '/Orders', principal: personas.ruwan }))).rejects.toMatchObject({ status: 403 });
      await expect(engine.handle(req({ path: '/Orders', principal: principal({ roles: ['svc'], scopes: ['fleet.read'] }) }))).rejects.toThrow(
        /lacks scope orders.read/,
      );
      const res = await engine.handle(req({ path: '/Orders', principal: principal({ roles: ['svc'], scopes: ['orders.read'] }) }));
      expect(res.status).toBe(200);
      expect(capture(orders.findMany).last()[0].where).toBeUndefined(); // services are not row-filtered
    });

    it('answers $count as text', async () => {
      when(orders.count(anything())).thenResolve(7);
      const res = await engine.handle(req({ path: '/Orders/$count', query: '$search=milk' }));
      expect(res).toMatchObject({ status: 200, body: '7' });
      expect(res.headers['Content-Type']).toBe('text/plain');
      expect(capture(orders.count).last()[0]).toEqual({
        where: { AND: [{ OR: [{ notes: { contains: 'milk', mode: 'insensitive' } }] }, { outlet: { is: { depot: { in: ['PELIYAGODA', 'KANDY'] } } } }] },
      });
      await expect(engine.handle(req({ method: 'POST', path: '/Orders/$count' }))).rejects.toMatchObject({ status: 405 });
    });

    it('rejects other methods on collections and unknown segments', async () => {
      await expect(engine.handle(req({ method: 'PATCH', path: '/Orders' }))).rejects.toMatchObject({ status: 405 });
      await expect(engine.handle(req({ path: '/Orders/Lodestar.Nope' }))).rejects.toMatchObject({ status: 404 });
      await expect(engine.handle(req({ path: "/Orders('A')/a/b" }))).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('single entities', () => {
    it('reads by key through the row filter, with ETag', async () => {
      when(orders.findFirst(anything())).thenResolve(row('ORD0104217'));
      const res = await engine.handle(req({ path: "/Orders('ORD0104217')", query: '$select=units' }));
      expect(capture(orders.findFirst).last()[0]).toEqual({
        where: { AND: [{ id: 'ORD0104217' }, { outlet: { is: { depot: { in: ['PELIYAGODA', 'KANDY'] } } } }] },
        select: { id: true, units: true, updatedAt: true },
      });
      expect(res.headers.ETag).toBe('W/"1700000000000"');
      expect(res.body).toEqual({
        '@odata.context': `${base}/$metadata#Orders(units)/$entity`,
        '@odata.etag': 'W/"1700000000000"',
        id: 'ORD0104217',
        units: 3,
      });
    });

    it('sends no ETag header with $expand (the root ETag does not version the expansion), but keeps @odata.etag', async () => {
      // Regression (2026-10-22): a LoadRecord created under a Trip left Trip.updatedAt alone, so
      // If-None-Match on Trips('…')?$expand=loadRecord matched and Express answered 304 with the stale body.
      when(orders.findFirst(anything())).thenResolve({ ...row('A'), lineItems: [{ id: 'L1', name: 'Milk' }] });
      const res = await engine.handle(req({ path: "/Orders('A')", query: '$expand=lineItems($select=name)' }));
      expect(res.headers.ETag).toBeUndefined();
      expect((res.body as any)['@odata.etag']).toBe('W/"1700000000000"');
      expect((res.body as any).lineItems).toEqual([{ id: 'L1', name: 'Milk' }]);
    });

    it('decodes percent-encoded keys', async () => {
      when(orders.findFirst(anything())).thenResolve(row("O'1"));
      await engine.handle(req({ path: "/Orders(%27O''1%27)", principal: personas.admin }));
      expect(capture(orders.findFirst).last()[0].where).toEqual({ id: "O'1" });
    });

    it('404s when the row is missing or outside the caller scope', async () => {
      when(orders.findFirst(anything())).thenResolve(null);
      await expect(engine.handle(req({ path: "/Orders('X')" }))).rejects.toMatchObject({ status: 404, message: "Orders('X') was not found" });
    });

    it('supports composite and date keys', async () => {
      when(allowances.findFirst(anything())).thenResolve({ brand: 'FRESH', dockType: 'REAR_DOCK', minutes: 15 });
      const res = await engine.handle(req({ path: "/ServiceAllowances(brand='FRESH',dockType='REAR_DOCK')" }));
      expect(capture(allowances.findFirst).last()[0].where).toEqual({ brand: 'FRESH', dockType: 'REAR_DOCK' });
      expect((res.body as any).minutes).toBe(15);

      when(calendar.findFirst(anything())).thenResolve({ date: new Date('2026-04-07T00:00:00Z'), isOperating: true });
      await engine.handle(req({ path: '/Calendar(2026-04-07)' }));
      expect(capture(calendar.findFirst).last()[0].where).toEqual({ date: new Date('2026-04-07T00:00:00Z') });
    });

    it('rejects collection options on a single entity and bad keys', async () => {
      await expect(engine.handle(req({ path: "/Orders('A')", query: '$top=1' }))).rejects.toThrow(/not allowed when addressing a single entity/);
      await expect(engine.handle(req({ path: '/Orders(5)' }))).rejects.toThrow(/does not match the type/);
      await expect(engine.handle(req({ path: "/ServiceAllowances('FRESH')" }))).rejects.toThrow(/composite key/);
      await expect(engine.handle(req({ path: "/ServiceAllowances(brand='FRESH')" }))).rejects.toThrow(/Missing key properties: dockType/);
      await expect(engine.handle(req({ path: "/ServiceAllowances(x='1',dockType='A')" }))).rejects.toThrow(/not a key property/);
      await expect(engine.handle(req({ path: '/Orders()' }))).rejects.toThrow(/Missing key/);
    });

    it('reads a property and a navigation', async () => {
      when(orders.findFirst(anything())).thenResolve({ units: 9 });
      const prop = await engine.handle(req({ path: "/Orders('A')/units" }));
      expect(prop.body).toEqual({ '@odata.context': `${base}/$metadata#Orders('A')/units`, value: 9 });

      when(orders.findFirst(anything())).thenResolve({ id: 'A', lineItems: [{ id: 'L1', name: 'Milk', qty: 1, kg: 1, orderId: 'A' }] });
      const nav = await engine.handle(req({ path: "/Orders('A')/lineItems", query: '$select=name' }));
      expect(nav.body).toEqual({ '@odata.context': `${base}/$metadata#Orders('A')/lineItems`, value: [{ id: 'L1', name: 'Milk' }] });

      when(orders.findFirst(anything())).thenResolve({ id: 'A', outlet: null });
      const empty = await engine.handle(req({ path: "/Orders('A')/outlet" }));
      expect(empty.status).toBe(204);

      await expect(engine.handle(req({ path: "/Orders('A')/meta" }))).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('POST (create)', () => {
    it('validates, runs hooks, answers 201 with Location/ETag and audit info', async () => {
      when(orders.findFirst(anything())).thenResolve(row('ORD9'));
      const res = await engine.handle(
        req({ method: 'POST', path: '/Orders', principal: personas.fathima, body: { id: 'ORD9', units: 4, runDate: '2026-04-08', '@odata.type': '#x' } }),
      );
      expect(set.created[0]).toEqual({ id: 'ORD9', units: 4, runDate: new Date('2026-04-08T00:00:00Z'), createdBy: 'fathima' });
      expect(res.status).toBe(201);
      expect(res.headers.Location).toBe(`${base}/Orders('ORD9')`);
      expect(res.headers.ETag).toBe('W/"1700000000000"');
      expect(res.audit).toEqual({ action: 'Orders.Create', entitySet: 'Orders', entityKey: 'ORD9' });
      expect((res.body as any)['@odata.context']).toBe(`${base}/$metadata#Orders/$entity`);
    });

    it('honours Prefer: return=minimal', async () => {
      when(orders.findFirst(anything())).thenResolve(row('ORD9'));
      const res = await engine.handle(req({ method: 'POST', path: '/Orders', principal: personas.fathima, body: { id: 'ORD9' }, headers: { prefer: 'return=minimal' } }));
      expect(res.status).toBe(204);
      expect(res.headers['OData-EntityId']).toBe(`${base}/Orders('ORD9')`);
    });

    it('rejects bad bodies, forbidden roles and read-only sets', async () => {
      const fathima = personas.fathima;
      await expect(engine.handle(req({ method: 'POST', path: '/Orders', principal: fathima, body: { meta: {} } }))).rejects.toThrow(/cannot be set/);
      await expect(engine.handle(req({ method: 'POST', path: '/Orders', principal: fathima, body: { units: 'x' } }))).rejects.toThrow(/wrong type/);
      await expect(engine.handle(req({ method: 'POST', path: '/Orders', principal: fathima, body: { status: 'NOPE' } }))).rejects.toThrow(/must be one of/);
      await expect(engine.handle(req({ method: 'POST', path: '/Orders', principal: fathima, body: [] }))).rejects.toThrow(/JSON object/);
      await expect(engine.handle(req({ method: 'POST', path: '/Orders', body: {} }))).rejects.toMatchObject({ status: 403 });
      await expect(engine.handle(req({ method: 'POST', path: '/Calendar', principal: personas.admin, body: {} }))).rejects.toMatchObject({ status: 405 });
    });
  });

  describe('PATCH (update) with ETags', () => {
    const current = row('A');
    const etag = 'W/"1700000000000"';

    beforeEach(() => {
      when(orders.findFirst(anything())).thenResolve(current);
    });

    it('requires If-Match (428) and a matching ETag (412)', async () => {
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { notes: 'x' } }))).rejects.toMatchObject({ status: 428 });
      await expect(
        engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { notes: 'x' }, headers: { 'if-match': 'W/"1"' } })),
      ).rejects.toMatchObject({ status: 412 });
    });

    it('writes conditionally on the ETag and returns the new representation', async () => {
      when(orders.updateMany(anything())).thenResolve({ count: 1 });
      const res = await engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { notes: 'late' }, headers: { 'if-match': etag } }));
      const [args] = capture(orders.updateMany).last();
      expect(args).toEqual({
        where: { AND: [{ AND: [{ id: 'A' }, { outlet: { is: { depot: { in: ['PELIYAGODA', 'KANDY'] } } } }] }, { updatedAt: current.updatedAt }] },
        data: { notes: 'late' },
      });
      expect(res.status).toBe(200);
      expect(res.audit).toEqual({ action: 'Orders.Update', entitySet: 'Orders', entityKey: 'A' });
    });

    it('accepts If-Match: * and Prefer return=minimal', async () => {
      when(orders.updateMany(anything())).thenResolve({ count: 1 });
      const res = await engine.handle(
        req({ method: 'PATCH', path: "/Orders('A')", body: { units: 5 }, headers: { 'if-match': '*', prefer: 'return=minimal' } }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.ETag).toBe(etag);
    });

    it('412s when someone else wrote in between', async () => {
      when(orders.updateMany(anything())).thenResolve({ count: 0 });
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { notes: 'x' }, headers: { 'if-match': etag } }))).rejects.toMatchObject({
        status: 412,
      });
    });

    it('rejects non-updatable fields, empty patches, other roles, DELETE and PUT', async () => {
      const h = { 'if-match': etag };
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { units: 1, kg: 2 }, headers: h }))).rejects.toThrow(/cannot be set/);
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: {}, headers: h }))).rejects.toThrow(/Nothing to update/);
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", principal: personas.fathima, body: {} }))).rejects.toMatchObject({ status: 403 });
      await expect(engine.handle(req({ method: 'DELETE', path: "/Orders('A')" }))).rejects.toThrow(/never deleted/);
      await expect(engine.handle(req({ method: 'PUT', path: "/Orders('A')" }))).rejects.toMatchObject({ status: 405 });
      await expect(engine.handle(req({ method: 'PATCH', path: '/Calendar(2026-04-07)', principal: personas.admin }))).rejects.toMatchObject({ status: 405 });
    });

    it('404s when the entity is outside the caller scope', async () => {
      when(orders.findFirst(anything())).thenResolve(null);
      await expect(engine.handle(req({ method: 'PATCH', path: "/Orders('A')", body: { notes: 'x' }, headers: { 'if-match': '*' } }))).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('operations', () => {
    it('invokes an entity-bound action on the scoped entity', async () => {
      when(orders.findFirst(anything())).thenResolve(row('A', { outletId: 'OUT106' }));
      const res = await engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel", principal: personas.fathima, body: { reason: 'dup' } }));
      expect(capture(orders.findFirst).last()[0]).toEqual({ where: { AND: [{ id: 'A' }, { outletId: 'OUT106' }] } });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ '@odata.context': `${base}/$metadata#Orders/$entity`, id: 'A', '@odata.etag': 'W/"5"' });
      expect((res.body as any).status).toBe('CANCELLED');
      expect(res.audit).toEqual({ action: 'Orders.Cancel', entitySet: 'Orders', entityKey: 'A' });
    });

    it('accepts the unqualified name and checks If-Match when given', async () => {
      when(orders.findFirst(anything())).thenResolve(row('A'));
      const res = await engine.handle(req({ method: 'POST', path: "/Orders('A')/Touch", principal: personas.fathima }));
      expect(res.status).toBe(204);
      await expect(
        engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Touch", principal: personas.fathima, headers: { 'if-match': 'W/"2"' } })),
      ).rejects.toMatchObject({ status: 412 });
    });

    it('validates methods, roles, parameters and the entity', async () => {
      when(orders.findFirst(anything())).thenResolve(row('A'));
      await expect(engine.handle(req({ path: "/Orders('A')/Lodestar.Cancel", principal: personas.fathima }))).rejects.toMatchObject({ status: 405 });
      await expect(engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel" }))).rejects.toMatchObject({ status: 403 });
      await expect(
        engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel", principal: personas.fathima, body: { bogus: 1 } })),
      ).rejects.toThrow(/Unknown parameter 'bogus'/);
      await expect(
        engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel", principal: personas.fathima, body: { reason: 5 } })),
      ).rejects.toThrow(/must be Edm.String/);
      await expect(
        engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel(reason='x')", principal: personas.fathima })),
      ).rejects.toThrow(/go in the request body/);
      when(orders.findFirst(anything())).thenResolve(null);
      await expect(engine.handle(req({ method: 'POST', path: "/Orders('A')/Lodestar.Cancel", principal: personas.fathima }))).rejects.toMatchObject({
        status: 404,
      });
    });

    it('invokes collection-bound functions with URL parameters, aliases and the row filter', async () => {
      const res = await engine.handle(req({ path: "/Orders/Lodestar.Summary(runDate=2026-04-07,depot=@d)", query: "@d='kandy'" }));
      expect(res.body).toEqual({
        '@odata.context': `${base}/$metadata#Lodestar.OrdersSummary`,
        runDate: '2026-04-07',
        depot: 'KANDY',
        filter: { outlet: { is: { depot: { in: ['PELIYAGODA', 'KANDY'] } } } },
        caller: 'nilanthi',
      });
      expect(res.audit).toBeUndefined();
      await expect(engine.handle(req({ path: '/Orders/Lodestar.Summary()' }))).rejects.toThrow(/'runDate' is required/);
      await expect(engine.handle(req({ path: "/Orders/Lodestar.Summary(runDate='x')" }))).rejects.toThrow(/must be Edm.Date/);
      await expect(engine.handle(req({ path: '/Orders/Lodestar.Summary(runDate=2026-04-07)', method: 'POST' }))).rejects.toMatchObject({ status: 405 });
    });

    it('wraps entity collections returned by functions', async () => {
      const res = await engine.handle(req({ path: '/Orders/Lodestar.Open()' }));
      expect(res.body).toEqual({ '@odata.context': `${base}/$metadata#Orders`, value: [{ '@odata.etag': 'W/"1"', id: 'A', units: 1, updatedAt: new Date(1) }] });
    });

    it('invokes unbound functions and actions', async () => {
      const ping = await engine.handle(req({ path: '/Ping(n=3)' }));
      expect(ping.body).toEqual({ '@odata.context': `${base}/$metadata#Edm.String`, value: 'pong 3' });
      const qualified = await engine.handle(req({ path: '/Lodestar.Ping()' }));
      expect((qualified.body as any).value).toBe('pong 0');
      const reset = await engine.handle(req({ method: 'POST', path: '/Reset', principal: personas.admin }));
      expect(reset).toMatchObject({ status: 204, audit: { action: 'Reset' } });
      await expect(engine.handle(req({ path: '/Ping/x' }))).rejects.toMatchObject({ status: 404 });
    });
  });

  it('does not touch the database for rejected requests', async () => {
    resetCalls(orders);
    await expect(engine.handle(req({ path: '/Orders', principal: personas.ruwan }))).rejects.toBeDefined();
    verify(orders.findMany(anything())).never();
  });
});
