import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Prisma } from '@prisma/client';
import { buildEdmModel, DmmfDatamodel, entitySetOptions, ODataError, parseQueryOptions, QueryBuilder } from '@lodestar/odata';
import { nextOrderableRunDate, toBusinessDate } from '@lodestar/platform';
import { personas } from '../../../libs/security/test/principals';
import { depotDelegate } from '../../../libs/odata/test/depots';
import { OrdersService } from './orders.service';
import { OrdersSet } from './orders.sets';

/** Prisma delegate surface the Orders set touches. */
interface OutletDelegate {
  findUnique(args: any): Promise<any>;
}

describe('OrdersSet', () => {
  let orders: OrdersService;
  let outlet: OutletDelegate;
  let set: OrdersSet;

  beforeEach(() => {
    orders = mock(OrdersService);
    outlet = mock<OutletDelegate>();
    set = new OrdersSet({ outlet: instance(outlet) } as any, instance(orders));
    when(orders.nextOrderId()).thenResolve('ORD0104300');
    // every day is an operating day here (closed days: the 'closed run dates' tests below)
    when(orders.nextOperatingRunDate(anything())).thenCall(async (d: any) => toBusinessDate(d));
    when(orders.announceCreated(anything())).thenResolve();
  });

  // a run date still open for orders today (the 4:00 PM cut-off is covered in order-cutoff.spec.ts)
  const body = { outletId: 'OUT106', runDate: new Date(nextOrderableRunDate()), brand: 'FRESH', tempClass: 'CHILLED', units: 4, kg: 20, m3: 0.2 };

  describe('create (generated ids)', () => {
    const clash = () => Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['id'] } });

    it('draws a new id when another order took the generated one at the same moment', async () => {
      const created: string[] = [];
      const order = { create: jest.fn(async ({ data }: any) => { if (data.id === 'ORD0104300') throw clash(); created.push(data.id); return data; }) };
      set = new OrdersSet({ outlet: instance(outlet), order } as any, instance(orders));
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      when(orders.nextOrderId()).thenResolve('ORD0104300', 'ORD0104301');
      const data: any = await set.beforeCreate({ ...body }, { principal: personas.fathima, headers: {} });
      await expect(set.create(data, { principal: personas.fathima, headers: {} })).resolves.toMatchObject({ id: 'ORD0104301' });
      expect(created).toEqual(['ORD0104301']);
    });

    it('still refuses a client-chosen id that already exists', async () => {
      const order = { create: jest.fn(async () => { throw clash(); }) };
      set = new OrdersSet({ outlet: instance(outlet), order } as any, instance(orders));
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body, id: 'ORD0104216' }, { principal: personas.admin, headers: {} });
      await expect(set.create(data, { principal: personas.admin, headers: {} })).rejects.toMatchObject({ code: 'P2002' });
      expect(order.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeCreate (ABAC on writes)', () => {
    it('lets a store manager order for her own outlet and fills server-side fields', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body }, { principal: personas.fathima, headers: {} });
      expect(data).toMatchObject({ id: 'ORD0104300', status: 'RECEIVED', outletId: 'OUT106' });
      expect(data.orderedAt).toBeInstanceOf(Date);
    });

    it('refuses an order for another outlet', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      await expect(set.beforeCreate({ ...body, outletId: 'OUT108' }, { principal: personas.fathima, headers: {} })).rejects.toMatchObject({
        status: 403,
      });
    });

    it('lets a dispatcher order for an outlet in her depots only', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      await expect(set.beforeCreate({ ...body }, { principal: personas.nilanthi, headers: {} })).resolves.toBeDefined();
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const kandyOnly = { ...personas.nilanthi, depots: ['PELIYAGODA'] };
      await expect(set.beforeCreate({ ...body }, { principal: kandyOnly, headers: {} })).rejects.toBeInstanceOf(ODataError);
    });

    it('turns line items into a nested create and validates them', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate(
        { ...body, lineItems: [{ name: 'Fresh milk', qty: 2, kg: 4, tempClass: 'CHILLED' }] },
        { principal: personas.admin, headers: {} },
      );
      expect(data.lineItems).toEqual({ create: [{ name: 'Fresh milk', qty: 2, kg: 4, tempClass: 'CHILLED' }] });
      await expect(
        set.beforeCreate({ ...body, lineItems: [{ name: 'x', qty: 0 }] }, { principal: personas.admin, headers: {} }),
      ).rejects.toThrow(/lineItems\[0\]/);
    });

    it('requires the order fields', async () => {
      await expect(set.beforeCreate({ outletId: 'OUT106' }, { principal: personas.admin, headers: {} })).rejects.toThrow(/runDate is required/);
    });
  });

  describe('beforeUpdate', () => {
    it('blocks a store edit once planning picked the order up', async () => {
      await expect(set.beforeUpdate({ notes: 'x' }, { id: 'ORD1', status: 'PLANNED' }, { principal: personas.fathima, headers: {} })).rejects.toMatchObject({
        status: 409,
      });
      await expect(set.beforeUpdate({ notes: 'x' }, { id: 'ORD1', status: 'RECEIVED' }, { principal: personas.fathima, headers: {} })).resolves.toEqual({
        notes: 'x',
      });
      await expect(set.beforeUpdate({ notes: 'x' }, { id: 'ORD1', status: 'PLANNED' }, { principal: personas.nilanthi, headers: {} })).resolves.toBeDefined();
    });
  });

  describe('Lodestar.Cancel', () => {
    it('cancels an order that is not loaded yet', async () => {
      when(orders.cancel('ORD1', 'duplicate')).thenResolve({ id: 'ORD1', status: 'CANCELLED' } as any);
      const res = await set.cancel({ principal: personas.fathima, params: { reason: 'duplicate' }, entity: { id: 'ORD1', status: 'RECEIVED' }, headers: {} });
      expect(res).toMatchObject({ status: 'CANCELLED' });
      verify(orders.cancel('ORD1', 'duplicate')).once();
    });

    it('refuses to cancel a delivered order', async () => {
      await expect(
        set.cancel({ principal: personas.fathima, params: {}, entity: { id: 'ORD1', status: 'DELIVERED' }, headers: {} }),
      ).rejects.toMatchObject({ status: 409 });
      verify(orders.cancel(anything(), anything())).never();
    });
  });

  describe('Lodestar.SetStatus and functions', () => {
    it('delegates the status change', async () => {
      when(orders.updateStatus('ORD1', 'LOADED' as any, undefined)).thenResolve({ id: 'ORD1' } as any);
      await set.setStatus({ principal: personas.nilanthi, params: { status: 'LOADED' }, entity: { id: 'ORD1' }, headers: {} });
      verify(orders.updateStatus('ORD1', 'LOADED' as any, undefined)).once();
    });

    it('passes the caller row filter into Summary and DeferralSuggestions', async () => {
      const rowFilter = { outlet: { is: { depot: { in: ['KANDY'] } } } };
      when(orders.getSummary(anything(), anything())).thenResolve({ total: 1 } as any);
      when(orders.getDeferralSuggestions(anything(), anything())).thenResolve([]);
      await set.summary({ principal: personas.nilanthi, params: { runDate: '2026-04-07' }, rowFilter, headers: {} });
      await set.deferralSuggestions({ principal: personas.nilanthi, params: { runDate: '2026-04-07' }, rowFilter, headers: {} });
      expect(capture(orders.getSummary).last()).toEqual(['2026-04-07', rowFilter]);
      expect(capture(orders.getDeferralSuggestions).last()).toEqual(['2026-04-07', rowFilter]);
    });
  });

  describe('order_created (a new order reaches dispatch and the store live)', () => {
    it('is announced once the order is committed, with the stored row', async () => {
      const order = { create: jest.fn(async ({ data }: any) => ({ ...data, runDate: data.runDate })) };
      set = new OrdersSet({ outlet: instance(outlet), order } as any, instance(orders));
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body }, { principal: personas.fathima, headers: {} });
      const created = await set.create(data, { principal: personas.fathima, headers: {} });
      verify(orders.announceCreated(anything())).once();
      expect(capture(orders.announceCreated).last()[0]).toBe(created);
    });

    it('is not announced for an order that was not created, and a failed announcement never fails the order', async () => {
      const failing = { create: jest.fn(async () => { throw new Error('db down'); }) };
      set = new OrdersSet({ outlet: instance(outlet), order: failing } as any, instance(orders));
      await expect(set.create({ id: 'ORD1' }, { principal: personas.admin, headers: {} })).rejects.toThrow('db down');
      verify(orders.announceCreated(anything())).never();

      when(orders.announceCreated(anything())).thenReject(new Error('outlet lookup failed'));
      const ok = { create: jest.fn(async ({ data }: any) => data) };
      set = new OrdersSet({ outlet: instance(outlet), order: ok } as any, instance(orders));
      await expect(set.create({ id: 'ORD2' }, { principal: personas.admin, headers: {} })).resolves.toMatchObject({ id: 'ORD2' });
    });
  });

  describe('closed run dates (Calendar; a silent calendar runs Monday to Saturday)', () => {
    // the real rule, on an empty Calendar
    const realOrders = () => new OrdersService({
      calendar: { findMany: async () => [] }, order: { findFirst: async () => ({ id: 'ORD0104299' }) },
      outlet: { findUnique: async () => ({ depot: 'KANDY' }) }, orderClosure: { findUnique: async () => null },
    } as any, {} as any);

    afterEach(() => jest.useRealTimers());

    it('Saturday 3 Oct before 4 PM: an order for Sunday goes to the Monday 5 Oct run, and says why', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-03T09:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); // 14:30 Colombo
      set = new OrdersSet({ outlet: instance(outlet) } as any, realOrders());
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body, runDate: '2026-10-04', notes: 'Extra milk' }, { principal: personas.fathima, headers: {} });
      expect(data.runDate).toEqual(new Date('2026-10-05T00:00:00.000Z'));
      expect(data.notes).toBe('Extra milk 2026-10-04 is not an operating day; moved to the 2026-10-05 run.');
    });

    it('Saturday 3 Oct after 4 PM: the moved order skips Sunday too', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-03T11:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); // 16:30 Colombo
      set = new OrdersSet({ outlet: instance(outlet) } as any, realOrders());
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body, runDate: '2026-10-04' }, { principal: personas.fathima, headers: {} });
      expect(data.runDate).toEqual(new Date('2026-10-05T00:00:00.000Z'));
      expect(data.notes).toBe('Placed after the 4:00 PM cut-off for 2026-10-04; moved to the 2026-10-05 run.');
    });

    it('an operating day is kept as asked', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      const data: any = await set.beforeCreate({ ...body }, { principal: personas.fathima, headers: {} });
      expect(data.runDate).toEqual(body.runDate);
      expect(data.notes).toBeUndefined();
    });

    it('moving an order onto a closed day is refused (422 NonOperatingDay)', async () => {
      when(orders.nextOperatingRunDate('2026-10-11')).thenResolve('2026-10-12');
      await expect(set.beforeUpdate({ runDate: '2026-10-11' }, { id: 'ORD1', status: 'PLANNED', runDate: new Date('2026-10-10T00:00:00Z') }, { principal: personas.nilanthi, headers: {} }))
        .rejects.toMatchObject({ status: 422, code: 'NonOperatingDay', target: 'runDate' });
    });
  });

  describe('closed by dispatch (Orders/Lodestar.CloseOrders, ReopenOrders, OrderWindow)', () => {
    const refused = () => Object.assign(new ODataError(422, 'OrdersClosed', 'closed', 'runDate'));

    it('refuses a new order, and a store edit, for a run dispatch has closed', async () => {
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      when(orders.assertOrdersOpen(anything(), anything())).thenReject(refused());
      await expect(set.beforeCreate({ ...body }, { principal: personas.fathima, headers: {} })).rejects.toMatchObject({ code: 'OrdersClosed' });
      await expect(set.beforeCreate({ ...body }, { principal: personas.nilanthi, headers: {} })).rejects.toMatchObject({ code: 'OrdersClosed' });
      const current = { id: 'ORD1', outletId: 'OUT106', status: 'RECEIVED', runDate: body.runDate };
      await expect(set.beforeUpdate({ units: 5 }, current, { principal: personas.fathima, headers: {} })).rejects.toMatchObject({ code: 'OrdersClosed' });
    });

    it('closes and reopens for a dispatcher of the depot, with the reason', async () => {
      set = new OrdersSet({ outlet: instance(outlet), depot: depotDelegate() } as any, instance(orders));
      when(orders.closeOrders('KANDY', '2026-10-05', 'nilanthi', 'planning')).thenResolve({ closed: true } as any);
      when(orders.reopenOrders('KANDY', '2026-10-05', 'nilanthi')).thenResolve({ closed: false } as any);
      await expect(set.closeOrders({ principal: personas.nilanthi, params: { depot: 'kandy', runDate: '2026-10-05', reason: 'planning' }, headers: {} })).resolves.toEqual({ closed: true });
      await expect(set.reopenOrders({ principal: personas.nilanthi, params: { depot: 'KANDY', runDate: '2026-10-05' }, headers: {} })).resolves.toEqual({ closed: false });
      const galle = { ...personas.nilanthi, depots: ['PELIYAGODA'] };
      await expect(set.closeOrders({ principal: galle, params: { depot: 'KANDY', runDate: '2026-10-05' }, headers: {} })).rejects.toMatchObject({ status: 403 });
      await expect(set.closeOrders({ principal: personas.nilanthi, params: { depot: 'NOWHERE', runDate: '2026-10-05' }, headers: {} })).rejects.toMatchObject({ status: 400 });
    });

    it("tells a store manager her own depot's window without naming the depot", async () => {
      set = new OrdersSet({ outlet: instance(outlet), depot: depotDelegate() } as any, instance(orders));
      when(outlet.findUnique(anything())).thenResolve({ depot: 'KANDY' });
      when(orders.orderWindow('KANDY', '2026-10-05')).thenResolve({ closed: true } as any);
      await expect(set.orderWindow({ principal: personas.fathima, params: { runDate: '2026-10-05' }, headers: {} })).resolves.toEqual({ closed: true });
      await expect(set.orderWindow({ principal: personas.nilanthi, params: { runDate: '2026-10-05' }, headers: {} })).rejects.toMatchObject({ status: 400, target: 'depot' });
    });
  });
});

describe('OrdersSet query policy', () => {
  it("accepts the store's Credited filter (SM-27): a credit note on the order or on its proof of delivery", () => {
    const model = buildEdmModel(Prisma.dmmf.datamodel as unknown as DmmfDatamodel);
    const o = entitySetOptions(OrdersSet)!;
    const builder = new QueryBuilder(model, model.entityTypes.get('Order')!, {
      navigation: o.navigation ?? [], search: o.search ?? [], hidden: {}, expandPaths: o.expandPaths, filterPaths: o.filterPaths,
    });
    const plan = builder.build(parseQueryOptions("$filter=outletId eq 'OUT106' and (creditNoteId ne null or tripStop/pod/creditNoteId ne null)&$expand=tripStop"));
    expect(JSON.stringify(plan.where)).toContain('"pod":{"is":{"creditNoteId":{"not":null}}}');
  });
});
