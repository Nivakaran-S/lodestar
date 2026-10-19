import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { assertDepotCode, EntitySet, ODataAction, ODataEntitySet, ODataError, ODataFunction, OperationContext, WriteContext } from '@lodestar/odata';
import { canAccessDepot, canAccessOutlet, HUMAN_ROLES, isPrivileged, Roles } from '@lodestar/security';
import { OrderStatus, TempClass } from '@prisma/client';
import { CANCELLABLE_STATUSES, EDITABLE_STATUSES, OrdersService } from './orders.service';
import { runDateValue, toBusinessDate } from '@lodestar/platform';
import { assertStoreMayEdit, closedDayNote, cutoffSettings, decideCutoff, movedNote } from './order-cutoff';

/** Row filters shared by Orders and (through `order`) OrderLineItems. */
const orderAbac = {
  depot: (depots: string[]) => ({ outlet: { is: { depot: { in: depots } } } }),
  outlet: (outletId: string) => ({ outletId }),
  vehicle: (vehicleId: string) => ({ tripStop: { is: { trip: { is: { vehicleId } } } } }),
};

interface LineItemInput {
  name: string;
  qty: number;
  kg: number;
  tempClass: TempClass;
}

function validateLineItems(raw: unknown): LineItemInput[] {
  if (!Array.isArray(raw)) throw ODataError.badRequest('lineItems must be an array', 'lineItems');
  return raw.map((li, i) => {
    const ok =
      li && typeof li.name === 'string' && Number.isInteger(li.qty) && li.qty > 0 &&
      typeof li.kg === 'number' && li.kg >= 0 && Object.values(TempClass).includes(li.tempClass);
    if (!ok) throw ODataError.badRequest(`lineItems[${i}] needs name, qty (>0), kg and tempClass`, 'lineItems');
    return { name: li.name, qty: li.qty, kg: li.kg, tempClass: li.tempClass };
  });
}

/** Orders: store managers place and edit their own; dispatch moves them through statuses. */
@Injectable()
@EntitySet({
  name: 'Orders',
  model: 'Order',
  read: [...HUMAN_ROLES, Roles.Service],
  create: [Roles.StoreManager, Roles.Dispatcher, Roles.Admin],
  update: [Roles.StoreManager, Roles.Dispatcher, Roles.Admin],
  abac: orderAbac,
  navigation: ['outlet', 'lineItems', 'tripStop', 'deferralLog'],
  expandPaths: ['tripStop/trip', 'tripStop/pod'],
  // the store's "Credited" filter (SM-27): a credit note on the order or on its proof of delivery
  filterPaths: ['tripStop/pod'],
  search: ['id', 'notes', 'outlet/name'],
  // orderedAt: when the phone saved it (honoured for the cut-off only within the offline grace window)
  insertable: ['id', 'outletId', 'runDate', 'brand', 'tempClass', 'units', 'kg', 'm3', 'notes', 'lineItems', 'orderedAt', 'lateReason'],
  updatable: ['runDate', 'units', 'kg', 'm3', 'notes'],
  defaultOrderBy: 'runDate desc,id',
  // A store's queued order is replayed after a blackout: Idempotency-Key keeps it single.
  idempotentCreate: true,
})
export class OrdersSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {
    super(prisma);
  }

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    for (const f of ['outletId', 'runDate', 'brand', 'tempClass', 'units', 'kg', 'm3']) {
      if (data[f] === undefined) throw ODataError.badRequest(`${f} is required`, f);
    }
    // A store manager orders for the outlet in their token; a dispatcher for outlets of their depots.
    const p = ctx.principal;
    if (!isPrivileged(p)) {
      const outlet = await this.prisma.outlet.findUnique({ where: { id: data.outletId }, select: { depot: true } });
      const allowed =
        canAccessOutlet(p, data.outletId) || (p.roles.includes(Roles.Dispatcher) && !!outlet && canAccessDepot(p, outlet.depot));
      if (!allowed) throw ODataError.forbidden('You cannot place orders for this outlet', 'outletId');
    }
    const lineItems = data.lineItems !== undefined ? validateLineItems(data.lineItems) : undefined;
    // 4:00 PM cut-off (Asia/Colombo) the day before the run
    const cutoff = decideCutoff(
      { roles: p.roles, runDate: data.runDate, now: new Date(), clientOrderedAt: data.orderedAt, lateReason: data.lateReason },
      cutoffSettings(),
    );
    if (cutoff.moved) {
      const next = await this.orders.nextOperatingRunDate(cutoff.moved.earliest);
      data = { ...data, runDate: runDateValue(next), notes: [data.notes, movedNote(cutoff.moved.from, next)].filter(Boolean).join(' ') };
    } else {
      // There is no run on a closed day (Calendar, or a Sunday it is silent about): the order goes to the next run.
      const asked = toBusinessDate(data.runDate);
      const next = await this.orders.nextOperatingRunDate(asked);
      if (next !== asked) {
        data = { ...data, runDate: runDateValue(next), notes: [data.notes, closedDayNote(asked, next)].filter(Boolean).join(' ') };
      }
    }
    // A run dispatch has closed (Orders/Lodestar.CloseOrders) takes no new orders, whoever places them.
    await this.orders.assertOrdersOpen(data.outletId, data.runDate);
    return {
      ...data,
      id: data.id ?? this.generated(await this.orders.nextOrderId()),
      orderedAt: cutoff.orderedAt,
      latePhone: cutoff.latePhone,
      lateReason: cutoff.lateReason,
      status: OrderStatus.RECEIVED,
      lineItems: lineItems ? { create: lineItems } : undefined,
    };
  }

  /** Ids this service generated (not sent by the client), which may be re-drawn on a collision. */
  private readonly generatedIds = new Set<string>();
  private generated(id: string): string {
    this.generatedIds.add(id);
    return id;
  }

  /** Two stores ordering at the same moment can draw the same next id: draw again rather than fail. */
  async create(data: Record<string, any>, ctx: WriteContext) {
    for (let attempt = 1; ; attempt++) {
      const mine = this.generatedIds.delete(data.id);
      let created: any;
      try {
        created = await super.create(data, ctx);
      } catch (e: any) {
        const idClash = e?.code === 'P2002' && [].concat(e?.meta?.target ?? []).some((t: string) => /^(id|\w+_pkey)$/.test(String(t)));
        if (!mine || !idClash || attempt >= 5) throw e;
        data = { ...data, id: this.generated(await this.orders.nextOrderId()) };
        continue;
      }
      // committed: dispatch (DSP-01) and the store see the new order live (best effort, never undoes it)
      await this.orders.announceCreated(created).catch(() => undefined);
      return created;
    }
  }

  async beforeUpdate(patch: Record<string, any>, current: any, ctx: WriteContext) {
    // Stores may only edit orders that planning has not picked up yet, and only before the cut-off.
    if (!isPrivileged(ctx.principal) && !ctx.principal.roles.includes(Roles.Dispatcher)) {
      if (!EDITABLE_STATUSES.includes(current.status)) {
        throw ODataError.conflict(`Order ${current.id} is ${current.status} and can no longer be edited`);
      }
      assertStoreMayEdit(ctx.principal.roles, current.runDate, patch.runDate, new Date(), cutoffSettings());
      // nor change an order on (or move one into) a run dispatch has closed
      await this.orders.assertOrdersOpen(current.outletId, current.runDate);
      if (patch.runDate !== undefined && patch.runDate !== null) await this.orders.assertOrdersOpen(current.outletId, patch.runDate);
    }
    if (patch.runDate !== undefined && patch.runDate !== null) {
      const asked = toBusinessDate(patch.runDate);
      if ((await this.orders.nextOperatingRunDate(asked)) !== asked) {
        throw ODataError.unprocessable('NonOperatingDay', `${asked} is not an operating day: there is no run to deliver on`, 'runDate');
      }
    }
    return patch;
  }

  /**
   * POST Orders('…')/Lodestar.SetStatus {status, notes?} — dispatch only (ORDER_TRANSITIONS). Loaders and drivers
   * move orders through their own actions (Release, CompleteStop, PushBatch); stores through ConfirmReceipt.
   */
  @ODataAction({
    name: 'SetStatus',
    binding: 'entity',
    roles: [Roles.Dispatcher, Roles.Admin, Roles.Service],
    params: { status: { type: 'Lodestar.OrderStatus', required: true }, notes: 'Edm.String' },
    returns: 'Lodestar.Order',
  })
  setStatus(ctx: OperationContext) {
    return this.orders.updateStatus(ctx.entity.id, ctx.params.status, ctx.params.notes);
  }

  /** POST Orders('…')/Lodestar.Cancel {reason?} — orders are cancelled, never deleted. */
  @ODataAction({
    name: 'Cancel',
    binding: 'entity',
    roles: [Roles.StoreManager, Roles.Dispatcher, Roles.Admin],
    params: { reason: 'Edm.String' },
    returns: 'Lodestar.Order',
  })
  async cancel(ctx: OperationContext) {
    if (!CANCELLABLE_STATUSES.includes(ctx.entity.status)) {
      throw ODataError.conflict(`Order ${ctx.entity.id} is ${ctx.entity.status} and cannot be cancelled`);
    }
    return this.orders.cancel(ctx.entity.id, ctx.params.reason);
  }

  /**
   * POST Orders('…')/Lodestar.ConfirmReceipt {unitsReceived, unitsExpected, note?, savedAt}
   * SM-03: the store manager's count. ABAC: the order is loaded through her outlet
   * row filter (another outlet's order is 404) and checked against her outlet claim again.
   */
  @ODataAction({
    name: 'ConfirmReceipt',
    binding: 'entity',
    roles: [Roles.StoreManager],
    params: {
      unitsReceived: { type: 'Edm.Int32', required: true },
      unitsExpected: { type: 'Edm.Int32', required: true },
      note: 'Edm.String',
      savedAt: { type: 'Edm.DateTimeOffset', required: true },
    },
    returns: 'Lodestar.Order',
    idempotent: true,
  })
  confirmReceipt(ctx: OperationContext) {
    if (!canAccessOutlet(ctx.principal, ctx.entity.outletId)) throw ODataError.forbidden('You can only confirm receipts for your own outlet', 'outletId');
    const { unitsReceived, unitsExpected, note, savedAt } = ctx.params;
    return this.orders.confirmReceipt(ctx.entity.id, ctx.principal.sub, { unitsReceived, unitsExpected, note, savedAt });
  }

  /** The depot an order-window call is about: the one named (checked against the caller), else the store's own. */
  private async windowDepot(ctx: OperationContext): Promise<string> {
    const p = ctx.principal;
    if (ctx.params.depot) {
      const depot = await assertDepotCode(this.prisma, ctx.params.depot, { active: false });
      if (!isPrivileged(p) && !canAccessDepot(p, depot)) throw ODataError.forbidden(`You do not work for depot ${depot}`, 'depot');
      return depot;
    }
    const outlet = p.outletId ? await this.prisma.outlet.findUnique({ where: { id: p.outletId }, select: { depot: true } }) : null;
    if (!outlet) throw ODataError.badRequest('depot is required', 'depot');
    return outlet.depot;
  }

  /**
   * POST Orders/Lodestar.CloseOrders {depot, runDate, reason?} - dispatch closes orders for a run (DSP-01): from now
   * on the orders service refuses new orders for it (422 OrdersClosed), and store edits on it. Audited as Orders.CloseOrders.
   */
  @ODataAction({
    name: 'CloseOrders',
    binding: 'collection',
    roles: [Roles.Dispatcher],
    params: { depot: { type: 'Edm.String', required: true }, runDate: { type: 'Edm.Date', required: true }, reason: 'Edm.String' },
    returns: 'Edm.Untyped',
  })
  async closeOrders(ctx: OperationContext) {
    const depot = await this.windowDepot(ctx);
    return this.orders.closeOrders(depot, ctx.params.runDate, ctx.principal.sub, ctx.params.reason);
  }

  /** POST Orders/Lodestar.ReopenOrders {depot, runDate} - dispatch takes orders for the run again. Audited. */
  @ODataAction({
    name: 'ReopenOrders',
    binding: 'collection',
    roles: [Roles.Dispatcher],
    params: { depot: { type: 'Edm.String', required: true }, runDate: { type: 'Edm.Date', required: true } },
    returns: 'Edm.Untyped',
  })
  async reopenOrders(ctx: OperationContext) {
    const depot = await this.windowDepot(ctx);
    return this.orders.reopenOrders(depot, ctx.params.runDate, ctx.principal.sub);
  }

  /**
   * GET Orders/Lodestar.OrderWindow(runDate=2026-04-07,depot='KANDY') - whether dispatch closed orders for the run
   * ({closed, closedBy, closedAt, reason, ...}). A store manager may leave depot out: their outlet's depot is used.
   */
  @ODataFunction({
    name: 'OrderWindow',
    binding: 'collection',
    roles: [Roles.StoreManager, Roles.Dispatcher, Roles.Admin, Roles.Service],
    params: { runDate: { type: 'Edm.Date', required: true }, depot: 'Edm.String' },
    returns: 'Edm.Untyped',
  })
  async orderWindow(ctx: OperationContext) {
    return this.orders.orderWindow(await this.windowDepot(ctx), ctx.params.runDate);
  }

  /** GET Orders/Lodestar.Summary(runDate=2026-04-07) */
  @ODataFunction({
    name: 'Summary',
    binding: 'collection',
    roles: [Roles.Dispatcher, Roles.Admin, Roles.Service],
    params: { runDate: { type: 'Edm.Date', required: true } },
    returns: 'Lodestar.OrdersSummary',
  })
  summary(ctx: OperationContext) {
    return this.orders.getSummary(ctx.params.runDate, ctx.rowFilter);
  }

  /** GET Orders/Lodestar.DeferralSuggestions(runDate=2026-04-07) */
  @ODataFunction({
    name: 'DeferralSuggestions',
    binding: 'collection',
    roles: [Roles.Dispatcher, Roles.Admin, Roles.Service],
    params: { runDate: { type: 'Edm.Date', required: true } },
    returns: 'Collection(Lodestar.Order)',
  })
  deferralSuggestions(ctx: OperationContext) {
    return this.orders.getDeferralSuggestions(ctx.params.runDate, ctx.rowFilter);
  }
}

/** Order lines; scoped through their order. */
@Injectable()
@EntitySet({
  name: 'OrderLineItems',
  model: 'OrderLineItem',
  read: [...HUMAN_ROLES, Roles.Service],
  create: [Roles.StoreManager, Roles.Admin],
  update: [Roles.StoreManager, Roles.Admin],
  abac: {
    depot: (d) => ({ order: { is: orderAbac.depot(d) } }),
    outlet: (o) => ({ order: { is: orderAbac.outlet(o) } }),
    vehicle: (v) => ({ order: { is: orderAbac.vehicle(v) } }),
  },
  navigation: ['order'],
  search: ['name'],
  insertable: ['orderId', 'name', 'qty', 'kg', 'tempClass'],
  updatable: ['name', 'qty', 'kg'],
})
export class OrderLineItemsSet extends ODataEntitySet {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private async editableOrder(orderId: string, ctx: WriteContext) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, outletId: true, status: true } });
    if (!order || !canAccessOutlet(ctx.principal, order.outletId)) throw ODataError.notFound(`Order ${orderId} was not found`);
    if (!EDITABLE_STATUSES.includes(order.status)) throw ODataError.conflict(`Order ${orderId} can no longer be edited`);
    return order;
  }

  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    if (!data.orderId) throw ODataError.badRequest('orderId is required', 'orderId');
    await this.editableOrder(data.orderId, ctx);
    return data;
  }

  async beforeUpdate(patch: Record<string, any>, current: any, ctx: WriteContext) {
    await this.editableOrder(current.orderId, ctx);
    return patch;
  }
}

export const ORDERS_SUMMARY_TYPE = {
  runDate: 'Edm.Date',
  total: 'Edm.Int32',
  byStatus: 'Edm.Untyped',
  chilledM3: 'Edm.Double',
  chilledKg: 'Edm.Double',
  chilledOrders: 'Edm.Int32',
  deferred: 'Edm.Int32',
  delivered: 'Edm.Int32',
};
