// Sends the outbox when there is signal.
//   Driver events (ARRIVAL, LEAVE, POD_SAVE) → POST OfflineEvents/Lodestar.PushBatch {events}, oldest first,
//     each with its client UUID as `id` (the server answers DUPLICATE for a replay: idempotent).
//   Loader / store writes → their own OData call, with the client UUID as Idempotency-Key:
//     SHORTFALL → LoadRecords('…')/Lodestar.RecordShortfalls (or POST LoadRecords when none exists yet)
//     RELEASE   → Trips('…')/Lodestar.Release (records the load first if the server asks for it)
//     RECEIPT   → Orders('…')/Lodestar.ConfirmReceipt
//     ORDER     → POST Orders
//     PRECOOL   → POST LoadRecords {tripId, bay, reeferTempC} (LD-09 pre-cool reading)
//     TRIP_STATUS → Trips('…')/Lodestar.SetStatus {status} (the dock started loading: LOADING, so a re-plan keeps the trip;
//                 the driver started the trip: ENROUTE; the driver finished it: COMPLETE, the server records the return
//                 time and the fuel used. No client sets COMPLETE any other way.)
//     VEHICLE_FAULT → Trips('…')/Lodestar.ReportVehicleFault {fault, reeferTempC?, note?} (LD-B1)
//     POD_PHOTO → POST /media/pod-photos?stopId=…&takenAt=…&eventId=… with the image bytes (the server stores one copy
//                 per stop and SHA-256, so a resend is a duplicate, not a second photo). Once sent, the image is dropped
//                 from the outbox (only its size stays).
//   STATUS_CHANGE (driver reports to dispatch) goes in the PushBatch with the other driver events.
// Outcomes: applied → synced (a server conflict note is kept and shown); 409/412 → conflict (except a RELEASE of a
// trip that has left already, and a non-COMPLETE TRIP_STATUS the trip is past: synced);
// other 4xx → rejected (shown, the user can discard); network / 5xx / 429 → stays pending.
import { Store } from '@/lib/store';
import { key, lit, ODataError, type ODataClient } from '@/lib/odata';
import { BATCH_KINDS, type OfflineQueue, type QueueItem } from './queue';

export type FlushResult = { attempted: number; synced: number; conflicts: number; rejected: number; offline: boolean };

type PushResult = {
  synced: number;
  duplicates: number;
  rejected: number;
  conflicts: number;
  results: { id?: string; eventType: string; status: 'APPLIED' | 'DUPLICATE' | 'REJECTED'; conflict?: string | null; reason?: string }[];
};

type Outcome = { status: 'synced'; conflict?: string | null } | { status: 'conflict' | 'rejected'; reason: string } | { status: 'retry'; reason: string; stop: boolean };

const MAX_BATCH = 200;
/** The trips service's 409 for a release of a trip that has left already ("A ENROUTE trip cannot be released"). */
const ALREADY_RELEASED = /\b(ENROUTE|COMPLETE) trip cannot be released/i;

export type SyncStatus = { running: boolean; lastRunAt?: string; lastResult?: FlushResult };

export class SyncEngine {
  readonly status = new Store<SyncStatus>({ running: false });
  private inflight: Promise<FlushResult> | null = null;

  constructor(
    private readonly queue: OfflineQueue,
    private readonly client: Pick<ODataClient, 'action' | 'create' | 'list'> & Partial<Pick<ODataClient, 'request'>>,
    private readonly opts: {
      /** Subject of the signed-in user; null when signed out (nothing is sent). */
      sub: () => string | null;
      online: () => boolean;
      now?: () => number;
      onSynced?: (items: QueueItem[]) => void;
    },
  ) {}

  /** Sends everything pending (one flush at a time; a second call joins the running one). */
  flush(): Promise<FlushResult> {
    this.inflight ??= this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  private async run(): Promise<FlushResult> {
    const result: FlushResult = { attempted: 0, synced: 0, conflicts: 0, rejected: 0, offline: false };
    await this.queue.ready();
    const sub = this.opts.sub();
    if (!sub || !this.opts.online()) return { ...result, offline: !this.opts.online() };
    const pending = this.queue.pending(sub);
    if (!pending.length) return result;

    this.status.set(s => ({ ...s, running: true }));
    const done: QueueItem[] = [];
    try {
      const events = pending.filter(i => BATCH_KINDS.includes(i.kind));
      const commands = pending.filter(i => !BATCH_KINDS.includes(i.kind));

      for (let i = 0; i < events.length && !result.offline; i += MAX_BATCH) {
        await this.pushEvents(events.slice(i, i + MAX_BATCH), result, done);
      }
      for (const item of commands) {
        if (result.offline) break;
        result.attempted++;
        await this.mark(item, 'sending');
        const outcome = await this.sendCommand(item);
        await this.apply(item, outcome, result, done);
      }
    } finally {
      const lastResult = { ...result };
      this.status.set({ running: false, lastRunAt: new Date(this.now()).toISOString(), lastResult });
      if (done.length) this.opts.onSynced?.(done);
    }
    return result;
  }

  private async mark(item: QueueItem, status: QueueItem['status']) {
    await this.queue.update(item.id, { status });
  }

  private async apply(item: QueueItem, o: Outcome, result: FlushResult, done: QueueItem[]) {
    const attempts = item.attempts + 1;
    if (o.status === 'synced') {
      result.synced++;
      if (o.conflict) result.conflicts++;
      await this.queue.update(item.id, {
        status: 'synced', attempts, conflict: o.conflict ?? null, syncedAt: new Date(this.now()).toISOString(), lastError: undefined,
        // a sent photo leaves the phone's outbox storage (the server has it)
        ...(item.kind === 'POD_PHOTO' ? { payload: withoutImage(item.payload) } : {}),
      });
      done.push(item);
    } else if (o.status === 'retry') {
      if (o.stop) result.offline = true;
      await this.queue.update(item.id, { status: 'pending', attempts, lastError: o.reason });
    } else {
      if (o.status === 'conflict') result.conflicts++;
      else result.rejected++;
      await this.queue.update(item.id, { status: o.status, attempts, conflict: o.reason, lastError: o.reason, acknowledged: false });
      done.push(item);
    }
  }

  private async pushEvents(items: QueueItem[], result: FlushResult, done: QueueItem[]) {
    result.attempted += items.length;
    for (const i of items) await this.mark(i, 'sending');
    let res: PushResult;
    try {
      res = await this.client.action<PushResult>(
        'OfflineEvents/Lodestar.PushBatch',
        { events: items.map(toEvent) },
        { idempotencyKey: items.length === 1 ? items[0].id : undefined },
      );
    } catch (e) {
      const o = classify(e);
      // One malformed event must not hold back the others: retry them one by one.
      if (o.status === 'rejected' && items.length > 1 && (e as ODataError).status === 400) {
        result.attempted -= items.length;
        for (const i of items) {
          await this.pushEvents([{ ...i, status: 'pending' }], result, done);
          if (result.offline) break;
        }
        return;
      }
      for (const i of items) await this.apply(i, o, result, done);
      return;
    }
    const byId = new Map((res?.results ?? []).filter(r => r.id).map(r => [r.id!, r]));
    for (const i of items) {
      const r = byId.get(i.id);
      if (!r) await this.apply(i, { status: 'retry', reason: 'Not confirmed by the server', stop: false }, result, done);
      else if (r.status === 'REJECTED') await this.apply(i, { status: 'rejected', reason: r.reason ?? 'Refused by the server' }, result, done);
      else await this.apply(i, { status: 'synced', conflict: r.conflict ?? null }, result, done);
    }
  }

  private async sendCommand(item: QueueItem): Promise<Outcome> {
    const p = item.payload;
    const idem = { idempotencyKey: item.id };
    try {
      switch (item.kind) {
        case 'SHORTFALL': {
          let lr: string | undefined = p.loadRecordId;
          if (!lr) {
            const found = await this.client.list<{ id: string }>('LoadRecords', { filter: `tripId eq ${lit(p.tripId)}`, select: ['id'], top: 1 });
            lr = found.value[0]?.id;
          }
          if (lr) await this.client.action(`LoadRecords${key(lr)}/Lodestar.RecordShortfalls`, { shortfalls: p.shortfalls }, idem);
          else await this.client.create('LoadRecords', { tripId: p.tripId, bay: p.bay, shortfalls: p.shortfalls }, idem);
          return { status: 'synced' };
        }
        case 'RELEASE': {
          const body = { sealNumber: p.sealNumber, ...(typeof p.reeferTempC === 'number' ? { reeferTempC: p.reeferTempC } : {}) };
          const path = `Trips${key(p.tripId)}/Lodestar.Release`;
          try {
            await this.client.action(path, body, idem);
          } catch (e) {
            // "record the load first": create the load record for this bay, then release
            if (e instanceof ODataError && e.status === 409 && /load record/i.test(e.message) && p.bay) {
              await this.client.create('LoadRecords', { tripId: p.tripId, bay: p.bay }, { idempotencyKey: `${item.id}-lr` });
              await this.client.action(path, body, idem);
            } else if (e instanceof ODataError && e.status === 409 && ALREADY_RELEASED.test(e.message)) {
              // The vehicle has left: this write has nothing left to do. A repeat of a release this phone already
              // sent is quietly done; one released by someone else is done too, with a note to show. Any other 409
              // (reefer too warm, a trip that cannot leave) stays a conflict.
              const ownSent = this.queue.list().some(o => o.id !== item.id && o.kind === 'RELEASE' && o.tripId === p.tripId && o.status === 'synced');
              return { status: 'synced', conflict: ownSent ? null : 'The trip had already been released' };
            } else throw e;
          }
          return { status: 'synced' };
        }
        case 'RECEIPT': {
          try {
            await this.client.action(`Orders${key(p.orderId)}/Lodestar.ConfirmReceipt`, { unitsReceived: p.unitsReceived, unitsExpected: p.unitsExpected, note: p.note ?? null, savedAt: item.savedAt }, idem);
          } catch (e) {
            // The orders service may not offer the action yet: keep the receipt on the phone and retry later.
            if (e instanceof ODataError && (e.status === 404 || e.status === 405 || e.status === 501) && !/Orders\(/.test(e.message)) {
              return { status: 'retry', reason: 'The server cannot take receipt confirmations yet; kept on this phone', stop: false };
            }
            throw e;
          }
          return { status: 'synced' };
        }
        case 'PRECOOL': {
          // LD-09: the reefer reading goes on the trip's load record when it is created; a record that exists
          // already cannot be changed (LoadRecords takes reeferTempC on create only), so the reading then
          // travels with the release (Trips Release reeferTempC) and is kept here as a note.
          const found = await this.client.list<{ id: string }>('LoadRecords', { filter: `tripId eq ${lit(p.tripId)}`, select: ['id'], top: 1 });
          if (found.value[0]) return { status: 'synced', conflict: 'Load record already open: the reading goes with the release' };
          await this.client.create('LoadRecords', { tripId: p.tripId, bay: p.bay, reeferTempC: p.reeferTempC }, idem);
          return { status: 'synced' };
        }
        case 'TRIP_STATUS': {
          try {
            await this.client.action(`Trips${key(p.tripId)}/Lodestar.SetStatus`, { status: p.status }, idem);
          } catch (e) {
            // the trip moved on meanwhile (released, or already past this status): nothing left to say. A refused
            // COMPLETE is shown (the trip would otherwise stay open on the dispatcher's board).
            if (e instanceof ODataError && e.status === 409 && p.status !== 'COMPLETE') return { status: 'synced', conflict: null };
            throw e;
          }
          return { status: 'synced' };
        }
        case 'VEHICLE_FAULT': {
          const body = { fault: p.fault, ...(typeof p.reeferTempC === 'number' ? { reeferTempC: p.reeferTempC } : {}), ...(p.note ? { note: p.note } : {}) };
          await this.client.action(`Trips${key(p.tripId)}/Lodestar.ReportVehicleFault`, body, idem);
          return { status: 'synced' };
        }
        case 'POD_PHOTO': {
          if (!this.client.request) return { status: 'retry', reason: 'Photos cannot be sent from here yet', stop: false };
          if (typeof p.dataBase64 !== 'string') return { status: 'synced', conflict: null }; // sent already
          const q = new URLSearchParams({ ...(p.stopId ? { stopId: p.stopId } : { orderId: p.orderId }), takenAt: p.takenAt ?? item.savedAt, eventId: item.id, ...(p.kind === 'SIGNATURE' ? { kind: 'SIGNATURE' } : {}) });
          await this.client.request('POST', `/media/pod-photos?${q.toString()}`, {
            raw: base64ToBytes(p.dataBase64),
            headers: { 'Content-Type': p.mime ?? 'image/jpeg' },
            idempotencyKey: item.id,
          });
          return { status: 'synced' };
        }
        case 'ORDER': {
          // orderedAt = when the store saved it: an order saved before the 4:00 PM cut-off and sent
          // later (no signal) still counts, within the server's grace window
          await this.client.create('Orders', { ...p.order, orderedAt: item.savedAt }, idem);
          return { status: 'synced' };
        }
        default:
          return { status: 'rejected', reason: `Unknown write ${item.kind}` };
      }
    } catch (e) {
      return classify(e);
    }
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Base64 (a data: URL is fine) → bytes, without atob/Buffer (not on every phone runtime). */
export function base64ToBytes(data: string): Uint8Array {
  const s = data.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  const at = (i: number) => (i < s.length ? B64_INDEX[s.charCodeAt(i)] : -1);
  let n = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = at(i), b = at(i + 1), c = at(i + 2), d = at(i + 3);
    out[n++] = (a << 2) | (b >> 4);
    if (c >= 0) out[n++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[n++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, n);
}

function withoutImage(payload: Record<string, any>): Record<string, any> {
  const { dataBase64, ...rest } = payload;
  if (typeof dataBase64 !== 'string') return rest;
  const b64 = dataBase64.replace(/^data:[^,]*,/, '');
  return { ...rest, bytes: rest.bytes ?? Math.floor((b64.length * 3) / 4) - (b64.match(/=+$/)?.[0].length ?? 0) };
}

function toEvent(i: QueueItem) {
  const payload = { ...i.payload };
  delete payload.stopId; // local reference only
  return { id: i.id, tripId: i.tripId, eventType: i.kind, payload, savedAt: i.savedAt };
}

export function classify(e: unknown): Outcome {
  if (!(e instanceof ODataError)) return { status: 'retry', reason: (e as Error)?.message ?? 'Unknown error', stop: false };
  if (e.isNetwork) return { status: 'retry', reason: e.message, stop: true };
  if (e.isTransient) return { status: 'retry', reason: e.message, stop: false };
  if (e.status === 401) return { status: 'retry', reason: 'Sign in again to send', stop: true };
  if (e.status === 409 || e.status === 412) return { status: 'conflict', reason: e.message };
  return { status: 'rejected', reason: e.message };
}

/** Ids of trips mentioned by pending writes (for cache refresh after a sync). */
export function tripsOf(items: QueueItem[]): string[] {
  return [...new Set(items.map(i => i.tripId).filter((t): t is string => !!t))];
}
