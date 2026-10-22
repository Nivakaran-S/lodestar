import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { Notification, NotificationChannel, OrderStatus, Prisma } from '@prisma/client';
import { canonicalRoom, NotificationsGateway } from './notifications.gateway';
import { SmsService } from './sms';
import { REEFER_MAX_C } from '@lodestar/platform';

export interface SendParams {
  recipientId: string;
  tripId?: string;
  type: string;
  payload?: any;
  depot?: string;
  outletId?: string;
  creditNoteId?: string;
}

/** A reefer reading in the payload above its limit (payload.limitC, else REEFER_MAX_C). */
function tooWarm(p: Record<string, any>): boolean {
  if (p.tempC === null || p.tempC === undefined || p.tempC === '') return false;
  const t = Number(p.tempC);
  const limit = p.limitC !== null && p.limitC !== undefined && Number.isFinite(Number(p.limitC)) ? Number(p.limitC) : REEFER_MAX_C;
  return Number.isFinite(t) && t > limit;
}

/**
 * Whether a driver's report (DRIVER_REPORT) is information or something dispatch must act on. A passed pre-trip
 * check, a reefer reading within the limit and a delivery on the store code are information: the desk's exceptions
 * lists (DSP-04, DSP-08, DSP-13) leave them out. A failed check (payload.ok false, an item not OK, or a reefer
 * reading above the limit), a problem and a delay are alerts. Other types carry no severity (undefined).
 * Stored on the notice as payload.severity, unless the sender set one.
 */
export function noticeSeverity(type: string, payload: unknown): 'info' | 'alert' | undefined {
  if (type !== 'DRIVER_REPORT') return undefined;
  const p = (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) as Record<string, any>;
  if (p.severity === 'info' || p.severity === 'alert') return p.severity;
  switch (String(p.report ?? '').toUpperCase()) {
    case 'VEHICLE_CHECK': {
      const itemFailed = Array.isArray(p.items) && p.items.some((i: any) => i && typeof i === 'object' && i.ok === false);
      return p.ok === false || itemFailed || tooWarm(p) ? 'alert' : 'info';
    }
    case 'REEFER_TEMP':
      return tooWarm(p) ? 'alert' : 'info';
    case 'STORE_CODE':
      return 'info';
    default:
      return 'alert';
  }
}

/**
 * Notification types from STORY.md:
 *  DEFERRAL_SUGGESTED | BLACKOUT_DETECTED | SIGNAL_BACK | POD_MATCHED |
 *  SHORTFALL_ACK | REEFER_FAIL | CREDIT_NOTE_ISSUED | ETA_UPDATE
 */
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    @Optional() private sms?: SmsService,
  ) {}

  /** The delivery channels this deployment offers (Notifications/Lodestar.Channels): the faces hide the rest. */
  channels() {
    return { websocket: true, push: false, sms: this.sms?.enabled ?? false, call: false };
  }

  async send(params: SendParams) {
    const severity = noticeSeverity(params.type, params.payload);
    const payload = severity ? { ...(params.payload ?? {}), severity } : (params.payload ?? {});
    const notif = await this.prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        tripId: params.tripId,
        type: params.type,
        channel: NotificationChannel.WEBSOCKET,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    const sent = await this.sendSms(notif);

    // Always deliver to the recipient's personal room…
    this.gateway.emit(`user:${params.recipientId}`, 'notification', notif);

    // …and route typed events to the operational rooms.
    switch (params.type) {
      case 'BLACKOUT_DETECTED':
      case 'SIGNAL_BACK': {
        // The depot's dispatchers, and the stores still waiting on the trip (SM-A1 "in progress, low signal").
        const stores = await this.waitingStores(params.tripId);
        if (params.depot || stores.length) {
          if (params.type === 'BLACKOUT_DETECTED') this.gateway.blackout(params.depot, params.payload, stores);
          else this.gateway.blackoutResolved(params.depot, params.payload, stores);
        }
        break;
      }
      case 'CREDIT_NOTE_ISSUED':
        if (params.outletId && params.creditNoteId)
          this.gateway.creditNoteIssued(params.outletId, params.creditNoteId, params.payload);
        break;
      case 'ETA_UPDATE':
        if (params.tripId && params.outletId) this.gateway.etaUpdate(params.tripId, params.outletId, params.payload);
        break;
      default:
        if (params.depot) this.gateway.dispatcherAlert(params.depot, params.type, params.payload);
    }

    return sent;
  }

  /**
   * SMS when the flag is on and the recipient's preferences ask for this type (sms.ts). What was sent (or, with the
   * log provider, what would have been) is kept on the notification as payload.delivery.sms and in the audit log.
   */
  private async sendSms(notif: Notification): Promise<Notification> {
    if (!this.sms?.enabled) return notif;
    try {
      const recipient = await this.prisma.user.findUnique({ where: { id: notif.recipientId }, select: { phone: true, preferences: true } });
      const sms = await this.sms.deliver(notif, recipient);
      if (!sms) return notif;
      const payload = (notif.payload && typeof notif.payload === 'object' && !Array.isArray(notif.payload) ? notif.payload : {}) as Record<string, unknown>;
      const delivery = (payload.delivery && typeof payload.delivery === 'object' ? payload.delivery : {}) as Record<string, unknown>;
      return await this.prisma.notification.update({
        where: { id: notif.id },
        data: { payload: { ...payload, delivery: { ...delivery, sms } } as unknown as Prisma.InputJsonValue },
      });
    } catch {
      return notif; // an SMS problem never fails the in-app notification
    }
  }

  /** Realtime only (nothing stored): an operational event to rooms, e.g. plan_published to dispatcher:KANDY. */
  publish(event: string, rooms: string[], payload: unknown) {
    for (const room of new Set(rooms)) this.gateway.emit(canonicalRoom(room), event, payload);
    return { event, rooms: [...new Set(rooms)].map(canonicalRoom) };
  }

  /**
   * A dispatcher handled a dock flag (DSP-13): the loader who flagged it gets SHORTFALL_ACK (LD-03
   * "Acknowledged by …", LD-13), and the depot's loaders and the trip's room get shortfall_ack.
   */
  async acknowledgeShortfall(flag: Notification, by: { sub: string; name?: string }) {
    const p = (flag.payload ?? {}) as Record<string, any>;
    const tripId = flag.tripId ?? (typeof p.tripId === 'string' ? p.tripId : undefined);
    const ack = {
      tripId: tripId ?? null, item: p.item ?? null, orderId: p.orderId ?? null, outletId: p.outletId ?? null, vehicleId: p.vehicleId ?? null,
      by: by.name ?? null, byId: by.sub, at: new Date().toISOString(),
    };
    // Every dispatcher of the depot got their own copy of the flag: one acknowledgement handles it for all.
    const siblings = await this.resolveSiblingFlags(flag);
    if (typeof p.loaderId === 'string' && p.loaderId) {
      await this.send({ recipientId: p.loaderId, type: 'SHORTFALL_ACK', ...(tripId ? { tripId } : {}), payload: ack });
    }
    const rooms = [
      ...(typeof p.depot === 'string' ? [`loader:${p.depot}`, `dispatcher:${p.depot}`] : []),
      ...(tripId ? [`trip:${tripId}`] : []),
      ...siblings.recipients.map((r) => `user:${r}`),
    ];
    if (rooms.length) this.publish('shortfall_ack', rooms, { ...ack, flagIds: [flag.id, ...siblings.ids] });
  }

  /**
   * The other dispatchers' unread copies of the same dock flag (same trip, item, order and quantities) are
   * marked read, so the flag leaves every DSP-13 inbox. Store and driver copies are information and stay.
   * Returns the copies resolved and their dispatchers.
   */
  private async resolveSiblingFlags(flag: Notification): Promise<{ ids: string[]; recipients: string[] }> {
    const p = (flag.payload ?? {}) as Record<string, any>;
    const candidates = await this.prisma.notification.findMany({
      where: { type: 'SHORTFALL_FLAGGED', tripId: flag.tripId, readAt: null, id: { not: flag.id }, recipient: { role: 'DISPATCHER' } },
      select: { id: true, recipientId: true, payload: true },
    });
    const same = (q: Record<string, any>) =>
      (['item', 'orderId', 'qtyOrdered', 'qtyLoaded', 'reason'] as const).every((k) => (q?.[k] ?? null) === (p[k] ?? null));
    const siblings = (candidates ?? []).filter((n) => same((n.payload ?? {}) as Record<string, any>));
    if (!siblings.length) return { ids: [], recipients: [] };
    await this.prisma.notification.updateMany({ where: { id: { in: siblings.map((n) => n.id) }, readAt: null }, data: { readAt: new Date() } });
    return { ids: siblings.map((n) => n.id), recipients: [...new Set(siblings.map((n) => n.recipientId))] };
  }

  /** Outlets of a trip's stops not delivered yet. */
  private async waitingStores(tripId?: string): Promise<string[]> {
    if (!tripId) return [];
    const stops = await this.prisma.tripStop.findMany({
      where: { tripId, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
      select: { outletId: true },
    });
    return [...new Set(stops.map((s) => s.outletId))];
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
