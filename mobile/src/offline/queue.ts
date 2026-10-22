// The persistent outbox of field writes. Every write (arrive at stop, complete stop with POD, record
// shortfall, release vehicle, start loading, vehicle fault, confirm receipt, new order) is saved here first with a client UUID and the
// time it was saved on the phone, then sent by the sync engine (sync.ts) when there is signal.
import { Store } from '@/lib/store';

/** Driver events go through OfflineEvents/Lodestar.PushBatch; the rest are replayed as their OData call. */
export type EventKind = 'ARRIVAL' | 'LEAVE' | 'POD_SAVE' | 'STATUS_CHANGE';
// POD_PHOTO: a proof-of-delivery photo (base64 until sent), uploaded to /media/pod-photos with the stop.
export type CommandKind = 'SHORTFALL' | 'RELEASE' | 'RECEIPT' | 'ORDER' | 'PRECOOL' | 'TRIP_STATUS' | 'VEHICLE_FAULT' | 'POD_PHOTO';
export type QueueKind = EventKind | CommandKind;

// STATUS_CHANGE: a driver's report to dispatch (delay, reefer alert, problem, vehicle check), stored as the trip's OfflineEvent.
export const BATCH_KINDS: readonly QueueKind[] = ['ARRIVAL', 'LEAVE', 'POD_SAVE', 'STATUS_CHANGE'];

export type QueueStatus = 'pending' | 'sending' | 'synced' | 'conflict' | 'rejected';

export type QueueItem = {
  /** Client UUID: the server's idempotency key (OfflineEvent id / Idempotency-Key header). */
  id: string;
  kind: QueueKind;
  /** Token subject that saved it; only that user's session sends it. */
  sub: string;
  tripId?: string;
  /** What the write is about (stop id, order id, trip id) for overlays and labels. */
  ref?: string;
  /** Short human label for the sync screens ("POD · ORD…"). */
  label: string;
  payload: Record<string, any>;
  /** ISO time the write was saved on the phone. */
  savedAt: string;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  /** Server note: a conflict that was resolved (applied) or why it was refused. */
  conflict?: string | null;
  syncedAt?: string;
  /** The user has seen the conflict notice. */
  acknowledged?: boolean;
};

export interface QueueStorage {
  load(): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  remove(id: string): Promise<void>;
}

export type QueueSummary = {
  pending: number;
  sending: number;
  synced: number;
  /** Conflicts and refusals the user has not acknowledged yet. */
  attention: number;
  oldestPendingAt?: string;
  lastSyncedAt?: string;
};

export type EnqueueInput = { sub: string; payload: Record<string, any>; label: string; tripId?: string; ref?: string; savedAt?: string };

const byTime = (a: QueueItem, b: QueueItem) => a.savedAt.localeCompare(b.savedAt) || a.id.localeCompare(b.id);
const KEEP_SYNCED_MS = 36 * 3_600_000;

export class OfflineQueue {
  readonly items = new Store<QueueItem[]>([]);
  private loaded: Promise<void> | null = null;

  constructor(
    private readonly storage: QueueStorage,
    private readonly uuid: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Loads the saved outbox (once). Items left "sending" by a crash go back to pending. */
  ready(): Promise<void> {
    this.loaded ??= (async () => {
      const saved = await this.storage.load().catch(() => [] as QueueItem[]);
      const fixed = saved.map(i => (i.status === 'sending' ? { ...i, status: 'pending' as const } : i));
      const cutoff = this.now() - KEEP_SYNCED_MS;
      const keep = fixed.filter(i => !(i.status === 'synced' && i.syncedAt && Date.parse(i.syncedAt) < cutoff && (!i.conflict || i.acknowledged)));
      for (const i of fixed) if (!keep.includes(i)) await this.storage.remove(i.id).catch(() => undefined);
      // merge with anything enqueued before loading finished
      const current = this.items.get();
      this.items.set([...keep.filter(i => !current.some(c => c.id === i.id)), ...current].sort(byTime));
    })();
    return this.loaded;
  }

  list(): QueueItem[] {
    return this.items.get();
  }

  /** Save a write. Returns the queued item (status pending). */
  enqueue(kind: QueueKind, input: EnqueueInput): Promise<QueueItem> {
    return this.serial(() => this.add(kind, input));
  }

  /**
   * Save a write unless an equivalent one is already in the outbox: `exists` is checked and the item added as one
   * step, so two screens asking at the same moment (or a double tap) queue it once. Resolves to null when one
   * is there already.
   */
  enqueueUnless(kind: QueueKind, input: EnqueueInput, exists: (i: QueueItem) => boolean): Promise<QueueItem | null> {
    return this.serial(async () => (this.items.get().some(exists) ? null : this.add(kind, input)));
  }

  // Enqueues run one after another: storage.put is async, and a check made before it lands would miss the item.
  private tail: Promise<unknown> = Promise.resolve();
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async add(kind: QueueKind, input: EnqueueInput): Promise<QueueItem> {
    const item: QueueItem = {
      id: this.uuid(),
      kind,
      sub: input.sub,
      tripId: input.tripId,
      ref: input.ref,
      label: input.label,
      payload: input.payload,
      savedAt: input.savedAt ?? new Date(this.now()).toISOString(),
      status: 'pending',
      attempts: 0,
    };
    await this.storage.put(item);
    this.items.set(list => [...list, item].sort(byTime));
    return item;
  }

  async update(id: string, patch: Partial<QueueItem>): Promise<void> {
    const cur = this.items.get().find(i => i.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await this.storage.put(next).catch(() => undefined);
    this.items.set(list => list.map(i => (i.id === id ? next : i)));
  }

  /** The user drops a refused write. */
  async discard(id: string): Promise<void> {
    await this.storage.remove(id).catch(() => undefined);
    this.items.set(list => list.filter(i => i.id !== id));
  }

  async acknowledge(ids?: string[]): Promise<void> {
    for (const i of this.items.get()) {
      if ((ids ? ids.includes(i.id) : true) && needsAttention(i)) await this.update(i.id, { acknowledged: true });
    }
  }

  /** Waiting to be sent, oldest first. */
  pending(sub?: string): QueueItem[] {
    return this.items.get().filter(i => i.status === 'pending' && (!sub || i.sub === sub));
  }
}

export function needsAttention(i: QueueItem): boolean {
  return !i.acknowledged && (i.status === 'conflict' || i.status === 'rejected' || (i.status === 'synced' && !!i.conflict));
}

export function summarize(items: QueueItem[], sub?: string): QueueSummary {
  const mine = sub ? items.filter(i => i.sub === sub) : items;
  const waiting = mine.filter(i => i.status === 'pending' || i.status === 'sending');
  const synced = mine.filter(i => i.status === 'synced');
  return {
    pending: waiting.length,
    sending: mine.filter(i => i.status === 'sending').length,
    synced: synced.length,
    attention: mine.filter(needsAttention).length,
    oldestPendingAt: waiting[0]?.savedAt,
    lastSyncedAt: synced.map(i => i.syncedAt ?? '').sort((a, b) => a.localeCompare(b)).at(-1) || undefined,
  };
}

/** In-memory storage (tests, and a fallback when the database cannot open). */
export function memoryQueueStorage(initial: QueueItem[] = []): QueueStorage & { rows: Map<string, QueueItem> } {
  const rows = new Map(initial.map(i => [i.id, i]));
  return {
    rows,
    async load() {
      return [...rows.values()];
    },
    async put(item) {
      rows.set(item.id, JSON.parse(JSON.stringify(item)));
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
