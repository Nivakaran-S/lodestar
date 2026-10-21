import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { ODataError } from '@lodestar/odata';
import {
  announceStopIssue, CLOSED_STOP_STATUSES, depotDispatchers, departureShiftMs, isPrivileged, NOTIFY, NotifyClient, podExceptionsWithStoreCount, podOutcome,
  Principal, ProgressTrip, publishEtaUpdates, recordArrival, recordDeparture, shiftRemainingEtas, storeManagers,
} from '@lodestar/security';
import { DeferralStatus, OrderStatus, Prisma } from '@prisma/client';
import { MAX_PHOTO_BYTES, PodPhotoService, validatePhoto } from './pod-photos';

/** A PHOTO event's inline image (base64, a data: URL is fine) as bytes. */
export function photoBytes(data: string): Buffer {
  return Buffer.from(data.replace(/^data:[^,]*,/, ''), 'base64');
}

/** Driver reports to dispatch (DR-12, DR-16, DR-17/18, DR-37, DR-38): STATUS_CHANGE events with payload.report. */
export const DRIVER_REPORTS = ['PROBLEM', 'DELAY', 'REEFER_TEMP', 'VEHICLE_CHECK', 'STORE_CODE'] as const;
export type DriverReportKind = (typeof DRIVER_REPORTS)[number];

/** Chilled loads must stay at or below this (°C, DR-37's limit); a warmer reefer reading is a REEFER_FAIL. */
import { REEFER_MAX_C } from '@lodestar/platform';

export { REEFER_MAX_C };

/** The longest delay a DELAY report moves the ETAs by (minutes). */
const MAX_DELAY_MIN = 600;

/** The report fields passed on to dispatch and the store (the rest of the payload stays on the event). */
const REPORT_FIELDS = ['problem', 'reason', 'minutes', 'tempC', 'setpointC', 'action', 'note', 'ok', 'items', 'odometerKm', 'units', 'photo', 'time'] as const;

/** The kind of a driver report, or null for another STATUS_CHANGE (signal lost/back, …). */
export function reportKind(payload: any): DriverReportKind | null {
  const r = typeof payload?.report === 'string' ? payload.report.trim().toUpperCase() : '';
  return (DRIVER_REPORTS as readonly string[]).includes(r) ? (r as DriverReportKind) : null;
}

/** A reefer reading above the limit (the payload's limitC, else REEFER_MAX_C). */
export function reeferTooWarm(payload: any): boolean {
  const t = Number(payload?.tempC);
  const limit = Number.isFinite(Number(payload?.limitC)) && payload?.limitC !== null && payload?.limitC !== undefined ? Number(payload.limitC) : REEFER_MAX_C;
  return payload?.tempC !== null && payload?.tempC !== undefined && Number.isFinite(t) && t > limit;
}

/** Minutes a DELAY report moves the ETAs by (whole minutes, 1–600), or null. */
export function delayMinutes(payload: any): number | null {
  const m = Number(payload?.minutes);
  return Number.isInteger(m) && m > 0 && m <= MAX_DELAY_MIN ? m : null;
}

function reportTitle(kind: DriverReportKind, p: any, vehicleId: string, orderId: string | null): string {
  switch (kind) {
    case 'PROBLEM':
      return `${vehicleId}: ${String(p.problem ?? 'problem').toLowerCase().replace(/_/g, ' ')} reported${orderId ? ` on ${orderId}` : ''}`;
    case 'DELAY':
      return `${vehicleId} running ${delayMinutes(p) ?? '?'} min late${p.reason ? `: ${String(p.reason).toLowerCase().replace(/_/g, ' ')}` : ''}`;
    case 'REEFER_TEMP':
      return reeferTooWarm(p) ? `${vehicleId} reefer at ${p.tempC} °C (limit ${p.limitC ?? REEFER_MAX_C} °C)` : `${vehicleId} reefer reading ${p.tempC ?? '?'} °C`;
    case 'VEHICLE_CHECK':
      return `${vehicleId} pre-trip check ${p.ok === false ? 'failed' : 'passed'}`;
    case 'STORE_CODE':
      return `${orderId ?? vehicleId}: delivered on the store code`;
  }
}

export const EVENT_TYPES = ['ARRIVAL', 'LEAVE', 'POD_SAVE', 'PHOTO', 'STATUS_CHANGE'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface OfflineEventInput {
  /** Client-generated id; makes replays idempotent (a retried batch is not applied twice). */
  id?: string;
  tripId?: string;
  eventType: EventType;
  payload: any;
  savedAt: string;
}

export interface EventResult {
  id?: string;
  eventType: string;
  status: 'APPLIED' | 'DUPLICATE' | 'REJECTED';
  conflict?: string | null;
  /** The conflict was not resolved automatically: a dispatcher must review it. */
  needsReview?: boolean;
  reason?: string;
}

/** What applying one event found: nothing, an auto-resolved conflict, or one that needs review. */
interface ApplyOutcome {
  note: string;
  resolved: boolean;
}

/** PODs the batch will store, by trip: `${tripId}|${orderId}`. */
type PendingPods = ReadonlySet<string>;
const podKey = (tripId: string | undefined, orderId: string) => `${tripId ?? ''}|${orderId}`;

/** Conflict note when a stop is left without a POD. */
export const LEAVE_WITHOUT_POD = 'Left the stop without a proof of delivery (signature, store code or photo): stop needs review';

const MAX_BATCH = 200;
const MAX_RECEIVER_NAME = 120;
const MAX_EXCEPTIONS = 20;
const MAX_EXCEPTION_TEXT = 500;

/** One POD exception as stored on the POD (same shape as CompleteStop and the scenario). */
export interface PodException {
  type: string;
  description: string;
  photoUrl: string | null;
}

/**
 * POD_SAVE exceptions arrive as objects ({type, description, photoUrl?}) from the
 * field app, or as "TYPE:detail" strings from older queues. Returns null when the
 * value has the wrong shape.
 */
export function normalisePodExceptions(raw: unknown): PodException[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_EXCEPTIONS) return null;
  const out: PodException[] = [];
  for (const x of raw) {
    if (typeof x === 'string') {
      const [type, ...rest] = x.split(':');
      if (!type.trim() || x.length > MAX_EXCEPTION_TEXT) return null;
      out.push({ type: type.trim().toUpperCase(), description: rest.join(':').trim(), photoUrl: null });
    } else if (x && typeof x === 'object' && typeof (x as any).type === 'string' && (x as any).type.trim()) {
      const { type, description, photoUrl } = x as Record<string, unknown>;
      if (description !== undefined && description !== null && typeof description !== 'string') return null;
      if (photoUrl !== undefined && photoUrl !== null && typeof photoUrl !== 'string') return null;
      if (String(description ?? '').length > MAX_EXCEPTION_TEXT) return null;
      out.push({ type: String(type).trim().toUpperCase(), description: String(description ?? ''), photoUrl: (photoUrl as string) ?? null });
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Offline Sync Service — handles Driver app reconnect batch sync.
 *
 * Hero scenario (Degradation A):
 *   - Signal lost 4:38 AM above Ramboda
 *   - 7 records queued on device (2 arrivals, 3 PODs, 2 photos)
 *   - Signal back 8:40 AM near Pussellawa
 *   - Conflict: provisional deferral of OUT108 must be reversed
 *   - Rule: "field evidence wins"
 *
 * Zero trust: the driver is the token subject (never a body field) and every
 * event must belong to a trip of the vehicle in the driver's token.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(NOTIFY) private notify: NotifyClient,
    @Optional() private photos?: PodPhotoService,
  ) {}

  validate(raw: unknown[]): OfflineEventInput[] {
    if (raw.length > MAX_BATCH) throw ODataError.badRequest(`A batch holds at most ${MAX_BATCH} events`, 'events');
    return raw.map((e: any, i) => {
      if (!e || typeof e !== 'object') throw ODataError.badRequest(`events[${i}] must be an object`, 'events');
      if (!EVENT_TYPES.includes(e.eventType)) throw ODataError.badRequest(`events[${i}].eventType must be one of ${EVENT_TYPES.join(', ')}`, 'events');
      if (typeof e.savedAt !== 'string' || Number.isNaN(Date.parse(e.savedAt))) {
        throw ODataError.badRequest(`events[${i}].savedAt must be a date-time`, 'events');
      }
      if (e.id !== undefined && (typeof e.id !== 'string' || !/^[\w-]{8,64}$/.test(e.id))) {
        throw ODataError.badRequest(`events[${i}].id must be 8-64 letters, digits, - or _`, 'events');
      }
      const payload = e.payload ?? {};
      const bad = (what: string) => ODataError.badRequest(`events[${i}].payload.${what}`, 'events');
      if ((e.eventType === 'ARRIVAL' || e.eventType === 'LEAVE') && !Number.isInteger(payload.stopSeq)) throw bad('stopSeq must be an integer');
      if (e.eventType === 'POD_SAVE') {
        if (typeof payload.orderId !== 'string' || !payload.orderId) throw bad('orderId is required');
        if (!Number.isInteger(payload.units) || payload.units < 0) throw bad('units must be a non-negative integer');
        if (payload.unitsOrdered !== undefined && (!Number.isInteger(payload.unitsOrdered) || payload.units > payload.unitsOrdered)) {
          throw bad('units cannot exceed unitsOrdered');
        }
        if (payload.receiverName !== undefined && payload.receiverName !== null) {
          if (typeof payload.receiverName !== 'string' || payload.receiverName.length > MAX_RECEIVER_NAME) {
            throw bad(`receiverName must be text of at most ${MAX_RECEIVER_NAME} characters`);
          }
        }
        if (payload.exceptions !== undefined && payload.exceptions !== null && !normalisePodExceptions(payload.exceptions)) {
          throw bad(`exceptions must be at most ${MAX_EXCEPTIONS} entries of {type, description?, photoUrl?} or "TYPE:detail"`);
        }
      }
      if (e.eventType === 'PHOTO') {
        // {stopId? | orderId? | stopSeq?, sha256? (a photo uploaded to /media/pod-photos), dataBase64? + mime? (inline), takenAt?}
        if (payload.orderId !== undefined && (typeof payload.orderId !== 'string' || !payload.orderId)) throw bad('orderId must be text');
        if (payload.stopId !== undefined && (typeof payload.stopId !== 'string' || !payload.stopId)) throw bad('stopId must be text');
        if (payload.stopSeq !== undefined && !Number.isInteger(payload.stopSeq)) throw bad('stopSeq must be an integer');
        if (payload.sha256 !== undefined && (typeof payload.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(payload.sha256))) throw bad('sha256 must be 64 hex digits');
        if (payload.dataBase64 !== undefined) {
          if (typeof payload.dataBase64 !== 'string' || payload.dataBase64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 64) throw bad(`dataBase64 must be a photo of at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB`);
          try {
            validatePhoto(photoBytes(payload.dataBase64), payload.mime);
          } catch (err) {
            throw bad(`dataBase64: ${(err as Error).message}`);
          }
        }
      }
      return { id: e.id, tripId: e.tripId, eventType: e.eventType, payload, savedAt: e.savedAt };
    });
  }

  /** Receive a batch of offline events from the driver device (in saved order). */
  async pushBatch(principal: Principal, events: OfflineEventInput[]) {
    const results: EventResult[] = [];
    const sorted = [...events].sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt));
    // A LEAVE may be replayed before the POD_SAVE of the same stop (clock skew, batch order).
    const pendingPods: PendingPods = new Set(
      sorted.filter((e) => e.eventType === 'POD_SAVE').map((e) => podKey(e.tripId, e.payload.orderId)),
    );

    for (const evt of sorted) {
      if (evt.id && (await this.prisma.offlineEvent.findUnique({ where: { id: evt.id }, select: { id: true } }))) {
        results.push({ id: evt.id, eventType: evt.eventType, status: 'DUPLICATE' });
        continue;
      }
      const denied = await this.checkTrip(principal, evt.tripId);
      if (denied) {
        results.push({ id: evt.id, eventType: evt.eventType, status: 'REJECTED', reason: denied });
        continue;
      }

      // Apply first, then record: if applying fails the event is not stored,
      // so the device's retry is applied instead of being skipped as a duplicate.
      // Applying is idempotent (updates and upserts), so a retry after a
      // failed record is safe too.
      const outcome = await this.applyEvent(evt, pendingPods, principal.sub);
      const saved = await this.prisma.offlineEvent.create({
        data: {
          ...(evt.id ? { id: evt.id } : {}),
          driverId: principal.sub,
          tripId: evt.tripId,
          eventType: evt.eventType,
          payload: evt.payload as Prisma.InputJsonValue,
          savedAt: new Date(evt.savedAt),
          syncedAt: new Date(),
          ...(outcome ? { conflictResolved: outcome.resolved, conflictNote: outcome.note } : {}),
        },
      });
      await this.announce(evt, outcome);
      // A driver report is told once: on its first apply (a replayed event id is a DUPLICATE above).
      if (evt.eventType === 'STATUS_CHANGE') await this.announceReport(evt, principal.sub);
      results.push({
        id: saved.id,
        eventType: evt.eventType,
        status: 'APPLIED',
        conflict: outcome?.note ?? null,
        ...(outcome && !outcome.resolved ? { needsReview: true } : {}),
      });
    }

    return {
      synced: results.filter((r) => r.status === 'APPLIED').length,
      duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
      conflicts: results.filter((r) => r.conflict).length,
      needsReview: results.filter((r) => r.needsReview).length,
      results,
    };
  }

  /**
   * Once an event is applied and recorded: a stop left without a POD (STOP_FAILED) or a POD with a failed
   * delivery or an exception (STOP_FAILED / POD_EXCEPTION) reaches the depot's dispatchers and the store; a POD
   * the phone saved with no signal tells the store it was recorded offline (SM-A1).
   */
  private async announce(evt: OfflineEventInput, outcome: ApplyOutcome | null) {
    const leftWithoutPod = evt.eventType === 'LEAVE' && outcome?.note === LEAVE_WITHOUT_POD;
    const isPod = evt.eventType === 'POD_SAVE';
    const units: number = evt.payload.units;
    const unitsOrdered: number = evt.payload.unitsOrdered ?? units;
    const exceptions = isPod ? (normalisePodExceptions(evt.payload.exceptions ?? []) ?? []) : [];
    const type = isPod ? podOutcome({ unitsDelivered: units, unitsOrdered, exceptions }) : null;
    const recordedOffline = isPod && evt.payload.offline === true;
    if (!leftWithoutPod && !type && !recordedOffline) return;

    const [stop, trip] = await Promise.all([
      this.prisma.tripStop.findFirst({
        where: isPod ? { tripId: evt.tripId, orderId: evt.payload.orderId } : { tripId: evt.tripId, stopSeq: evt.payload.stopSeq },
        select: { id: true, tripId: true, stopSeq: true, orderId: true, outletId: true },
      }),
      this.prisma.trip.findUnique({ where: { id: evt.tripId }, select: { depot: true, vehicleId: true } }),
    ]);
    if (!stop || !trip) return;
    const ref = { tripId: stop.tripId, stopId: stop.id, stopSeq: stop.stopSeq, orderId: stop.orderId, outletId: stop.outletId, depot: trip.depot, vehicleId: trip.vehicleId };
    if (leftWithoutPod) {
      await announceStopIssue(this.prisma, this.notify, 'STOP_FAILED', ref, { title: `${stop.outletId}: left without a proof of delivery`, note: LEAVE_WITHOUT_POD });
      return;
    }
    if (type) {
      await announceStopIssue(this.prisma, this.notify, type, ref, {
        title: type === 'STOP_FAILED' ? `${stop.outletId}: nothing delivered` : `${stop.orderId}: ${units} of ${unitsOrdered} delivered`,
        unitsDelivered: units,
        unitsOrdered,
        short: unitsOrdered - units,
        exceptions,
      });
    }
    if (recordedOffline) {
      const savedAt = String(evt.payload.savedAt ?? evt.savedAt);
      for (const m of await storeManagers(this.prisma, [stop.outletId])) {
        await this.notify.notice({
          recipientId: m.id, type: 'POD_RECORDED_OFFLINE', tripId: stop.tripId, outletId: m.outletId,
          payload: { ...ref, unitsDelivered: units, unitsOrdered, savedAt, syncedAt: new Date().toISOString(), title: `${stop.orderId} delivered, recorded offline` },
        });
      }
    }
  }

  /**
   * A driver's report (STATUS_CHANGE with payload.report): DRIVER_REPORT — REEFER_FAIL for a reefer reading
   * above the limit — to the depot's dispatchers (DSP-13) and to the managers of the store it names (an order
   * or outlet on the trip), and driver_report to dispatcher:<depot> and trip:<id>; a delay also reaches the
   * stores still waiting on the trip (store:<outlet>), whose ETAs it moved.
   */
  private async announceReport(evt: OfflineEventInput, driverId: string) {
    const p = evt.payload ?? {};
    const kind = reportKind(p);
    if (!kind || !evt.tripId) return;
    const trip = await this.prisma.trip.findUnique({
      where: { id: evt.tripId },
      select: { id: true, depot: true, vehicleId: true, stops: { select: { id: true, stopSeq: true, orderId: true, outletId: true, status: true } } },
    });
    if (!trip) return;
    const stops = trip.stops ?? [];
    const named =
      stops.find((s) => (typeof p.stopId === 'string' && s.id === p.stopId) || (typeof p.orderId === 'string' && s.orderId === p.orderId)) ??
      (typeof p.outletId === 'string' ? stops.find((s) => s.outletId === p.outletId) : undefined);
    const outletId = named?.outletId ?? (typeof p.outletId === 'string' ? p.outletId : null);
    const orderId = named?.orderId ?? (typeof p.orderId === 'string' ? p.orderId : null);
    const type = kind === 'REEFER_TEMP' && reeferTooWarm(p) ? 'REEFER_FAIL' : 'DRIVER_REPORT';
    const details = Object.fromEntries(REPORT_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
    const payload = {
      report: kind, ...details, tripId: trip.id, vehicleId: trip.vehicleId, depot: trip.depot, driverId,
      stopId: named?.id ?? null, stopSeq: named?.stopSeq ?? null, orderId, outletId,
      ...(kind === 'REEFER_TEMP' ? { limitC: p.limitC ?? REEFER_MAX_C } : {}),
      eventId: evt.id ?? null, savedAt: evt.savedAt, title: reportTitle(kind, p, trip.vehicleId, orderId),
    };
    for (const recipientId of await depotDispatchers(this.prisma, trip.depot)) {
      await this.notify.notice({ recipientId, type, tripId: trip.id, payload });
    }
    if (outletId) {
      for (const m of await storeManagers(this.prisma, [outletId])) {
        await this.notify.notice({ recipientId: m.id, type, tripId: trip.id, outletId: m.outletId, payload });
      }
    }
    const waiting = outletId ? [outletId] : [...new Set(stops.filter((s) => !(CLOSED_STOP_STATUSES as readonly string[]).includes(s.status)).map((s) => s.outletId))];
    await this.notify.publish('driver_report', [
      `dispatcher:${trip.depot}`, `trip:${trip.id}`,
      ...(kind === 'DELAY' ? waiting.map((o) => `store:${o}`) : []),
    ], payload);
  }

  /** The trip a stop's progress is announced for. */
  private async progressTrip(tripId: string | undefined): Promise<ProgressTrip | null> {
    if (!tripId) return null;
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, select: { id: true, depot: true, vehicleId: true } });
    return trip?.depot ? { id: trip.id ?? tripId, depot: trip.depot, vehicleId: trip.vehicleId } : null;
  }

  /** Live progress (events and later stops' ETAs) is best effort: the event itself has been applied. */
  private async progress(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`Stop progress not announced: ${(e as Error).message}`);
    }
  }

  /** A driver may only report events for trips of the vehicle in their token. */
  private async checkTrip(principal: Principal, tripId?: string): Promise<string | undefined> {
    if (!tripId) return 'tripId is required';
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, select: { vehicleId: true } });
    if (!trip) return 'Unknown trip';
    if (!isPrivileged(principal) && trip.vehicleId !== principal.vehicleId) return 'Trip is not assigned to your vehicle';
    return undefined;
  }

  private async applyEvent(evt: OfflineEventInput, pendingPods: PendingPods, driverId: string): Promise<ApplyOutcome | null> {
    switch (evt.eventType) {
      case 'ARRIVAL': {
        const stop = await this.prisma.tripStop.findFirst({
          where: { tripId: evt.tripId, stopSeq: evt.payload.stopSeq },
        });
        if (stop) {
          const at = new Date(evt.payload.time ?? evt.savedAt);
          const closed = (CLOSED_STOP_STATUSES as readonly string[]).includes(stop.status);
          await this.prisma.tripStop.update({
            where: { id: stop.id },
            data: { arrivalActual: at, ...(closed ? {} : { status: OrderStatus.ENROUTE }) },
          });
          // the store and live ops see the van arrive; the stops after it move by the delay
          const trip = await this.progressTrip(evt.tripId);
          if (trip) await this.progress(() => recordArrival(this.prisma, this.notify, trip, stop, at));
        }
        return null;
      }
      case 'LEAVE': {
        // A stop is DELIVERED only with a proof of delivery: one already stored,
        // or a POD_SAVE in this batch (which then delivers the stop itself).
        const stop = await this.prisma.tripStop.findFirst({
          where: { tripId: evt.tripId, stopSeq: evt.payload.stopSeq },
          include: { pod: { select: { id: true, unitsDelivered: true, unitsOrdered: true } } },
        });
        if (!stop) return null;
        const leaveActual = new Date(evt.payload.time ?? evt.savedAt);
        const trip = await this.progressTrip(evt.tripId);
        if (stop.pod || stop.status === OrderStatus.DELIVERED) {
          // a stored POD of nothing delivered is a failed stop, never DELIVERED
          const failed = stop.pod ? podOutcome(stop.pod) === 'STOP_FAILED' : false;
          const status = failed || stop.status === OrderStatus.EXCEPTION ? OrderStatus.EXCEPTION : OrderStatus.DELIVERED;
          await this.prisma.tripStop.update({ where: { id: stop.id }, data: { leaveActual, status } });
          if (trip) await this.progress(() => recordDeparture(this.prisma, this.notify, trip, stop, leaveActual, { status }));
          return null;
        }
        if (pendingPods.has(podKey(evt.tripId, stop.orderId))) {
          await this.prisma.tripStop.update({ where: { id: stop.id }, data: { leaveActual } });
          // the POD_SAVE later in the batch announces the delivery; the van has left, so later stops move now
          if (trip) {
            await this.progress(async () =>
              publishEtaUpdates(this.notify, trip, await shiftRemainingEtas(this.prisma, trip.id, stop.stopSeq, departureShiftMs(stop, leaveActual)), 'DEPARTURE'));
          }
          return null;
        }
        // No POD anywhere: never deliver silently. EXCEPTION puts the stop and its order in front of a
        // dispatcher (DSP-13); a later POD_SAVE for the stop still delivers them.
        await this.prisma.tripStop.update({ where: { id: stop.id }, data: { leaveActual, status: OrderStatus.EXCEPTION } });
        await this.prisma.order.update({ where: { id: stop.orderId }, data: { status: OrderStatus.EXCEPTION } });
        if (trip) await this.progress(() => recordDeparture(this.prisma, this.notify, trip, stop, leaveActual, { status: OrderStatus.EXCEPTION, note: LEAVE_WITHOUT_POD }));
        return { note: LEAVE_WITHOUT_POD, resolved: false };
      }
      case 'STATUS_CHANGE': {
        // A delay report moves the ETAs of the stops still to come (the store sees it at once); a later
        // arrival is then measured against the moved ETA, so the delay is not counted twice.
        const minutes = reportKind(evt.payload) === 'DELAY' ? delayMinutes(evt.payload) : null;
        const trip = minutes ? await this.progressTrip(evt.tripId) : null;
        if (trip && minutes) {
          await this.progress(async () =>
            publishEtaUpdates(this.notify, trip, await shiftRemainingEtas(this.prisma, trip.id, 0, minutes * 60_000), 'DELAY'));
        }
        return null;
      }
      case 'POD_SAVE': {
        // The stop must be on the event's trip (not just any stop for the order).
        const stop = await this.prisma.tripStop.findFirst({
          where: { orderId: evt.payload.orderId, tripId: evt.tripId },
        });
        if (!stop) return null;

        // Check for conflict: was there a provisional deferral for this order?
        const deferral = await this.prisma.deferralLog.findUnique({
          where: { orderId: evt.payload.orderId },
        });

        // The POD already stored (a correction) and the store's own count, if the store counted first:
        // the store's shortfall stays on the POD whatever the driver writes (credit units, SM-19/20, SM-28).
        const [previous, order] = await Promise.all([
          this.prisma.pOD.findUnique({ where: { tripStopId: stop.id }, select: { exceptions: true, creditNoteId: true, unitsOrdered: true } }),
          this.prisma.order.findUnique({
            where: { id: evt.payload.orderId },
            select: { units: true, unitsReceived: true, unitsExpected: true, receiptNote: true, receivedBy: true, receiptSavedAt: true, creditNoteId: true },
          }),
        ]);

        // What the driver recorded at the door: receiver and exceptions travel with the units.
        // Absent fields leave a stored value alone (a correction may only fix the count).
        const details: Prisma.PODUpdateInput = {};
        const receiverName = typeof evt.payload.receiverName === 'string' ? evt.payload.receiverName.trim() : '';
        if (receiverName) details.receiverName = receiverName;
        const exceptions = evt.payload.exceptions === undefined || evt.payload.exceptions === null ? null : normalisePodExceptions(evt.payload.exceptions);
        if (exceptions) details.exceptions = podExceptionsWithStoreCount(exceptions, previous?.exceptions, order) as Prisma.InputJsonValue;
        const createExceptions = podExceptionsWithStoreCount(exceptions ?? [], null, order);
        const creditNoteId = previous?.creditNoteId ?? order?.creditNoteId ?? null;
        if (creditNoteId && !previous?.creditNoteId) details.creditNoteId = creditNoteId;
        const unitsOrdered: number = evt.payload.unitsOrdered ?? previous?.unitsOrdered ?? order?.units ?? evt.payload.units;
        // recorded with the event and read by announce(): a POD of 0 units of 10 is a failed stop
        if (evt.payload.unitsOrdered === undefined && unitsOrdered !== evt.payload.units) evt.payload = { ...evt.payload, unitsOrdered };

        await this.prisma.pOD.upsert({
          where: { tripStopId: stop.id },
          update: { unitsDelivered: evt.payload.units, ...details, syncedAt: new Date() },
          create: {
            tripStopId: stop.id,
            unitsDelivered: evt.payload.units,
            unitsOrdered,
            ...(details.receiverName ? { receiverName: details.receiverName as string } : {}),
            ...(exceptions || createExceptions.length ? { exceptions: createExceptions as Prisma.InputJsonValue } : {}),
            ...(creditNoteId ? { creditNoteId } : {}),
            savedOffline: true,
            savedAt: new Date(evt.payload.savedAt ?? evt.savedAt),
            syncedAt: new Date(),
          },
        });
        // photos uploaded before this POD (the outbox sends them in either order) now count on it
        if (this.photos) await this.photos.linkStopQuietly(stop.id);

        // Nothing delivered is a failed stop: stop and order go to EXCEPTION (DSP-13), never DELIVERED.
        const status = podOutcome({ unitsDelivered: evt.payload.units, unitsOrdered }) === 'STOP_FAILED' ? OrderStatus.EXCEPTION : OrderStatus.DELIVERED;
        const leaveActual: Date = stop.leaveActual ?? new Date(evt.savedAt);
        await this.prisma.tripStop.update({
          where: { id: stop.id },
          data: { status, leaveActual },
        });
        await this.prisma.order.update({
          where: { id: evt.payload.orderId },
          data: { status },
        });
        const trip = await this.progressTrip(evt.tripId);
        if (trip) {
          await this.progress(() => recordDeparture(this.prisma, this.notify, trip, stop, leaveActual, {
            status, unitsDelivered: evt.payload.units, unitsOrdered, savedOffline: true,
          }));
        }

        if (deferral?.isProvisional && deferral.status !== DeferralStatus.REVERSED) {
          // Reverse provisional deferral — field evidence wins (records are never deleted)
          await this.prisma.deferralLog.update({
            where: { orderId: evt.payload.orderId },
            data: { status: DeferralStatus.REVERSED, notes: 'Reversed by offline sync: delivery confirmed in the field' },
          });
          return { note: 'Provisional deferral reversed — field evidence wins; delivery confirmed offline', resolved: true };
        }
        return null;
      }
      case 'PHOTO':
        return this.applyPhoto(evt, driverId);
      default:
        return null;
    }
  }

  /**
   * A proof-of-delivery photo: stored with the event's stop (inline dataBase64) or, for a photo the phone already
   * uploaded (sha256), linked to its POD. Idempotent: the event id and the stop + SHA-256 are unique, so a replay
   * stores nothing new. The image never stays in the event log: only its SHA-256 and photo id.
   */
  private async applyPhoto(evt: OfflineEventInput, driverId: string): Promise<ApplyOutcome | null> {
    const p = evt.payload ?? {};
    if (!this.photos || !(p.stopId || p.orderId || Number.isInteger(p.stopSeq))) return null;
    const { dataBase64, ...rest } = p;
    evt.payload = rest;
    let stop;
    try {
      stop = await this.photos.findStop({ stopId: p.stopId, orderId: p.orderId, tripId: evt.tripId, stopSeq: p.stopSeq });
    } catch {
      return { note: 'Photo for a stop that is not on this trip: not stored', resolved: false };
    }
    if (stop.tripId !== evt.tripId) return { note: 'Photo for a stop that is not on this trip: not stored', resolved: false };
    if (typeof dataBase64 === 'string') {
      const { photo } = await this.photos.store({
        stop, bytes: photoBytes(dataBase64), declaredMime: p.mime, takenAt: p.takenAt ?? evt.savedAt, eventId: evt.id, uploadedBy: driverId,
      });
      evt.payload = { ...rest, stopId: stop.id, sha256: photo.sha256, photoId: photo.id, size: photo.size };
      return null;
    }
    if (typeof p.sha256 === 'string') {
      const found = await this.photos.findBySha(stop.id, p.sha256.toLowerCase());
      if (found) {
        evt.payload = { ...rest, stopId: stop.id, photoId: found.id };
        await this.photos.linkStopQuietly(stop.id);
      }
    }
    return null;
  }

  async getSyncStatus(tripId: string, scope?: Prisma.OfflineEventWhereInput) {
    const events = await this.prisma.offlineEvent.findMany({
      where: { AND: [{ tripId }, scope ?? {}] },
      orderBy: { savedAt: 'asc' },
    });
    const synced = events.filter((e) => e.syncedAt);
    return {
      total: events.length,
      synced: synced.length,
      pending: events.length - synced.length,
      conflicts: events.filter((e) => e.conflictResolved || e.conflictNote).length,
      needsReview: events.filter((e) => e.conflictNote && !e.conflictResolved).length,
      lastSyncedAt: synced.at(-1)?.syncedAt ?? null,
    };
  }
}
