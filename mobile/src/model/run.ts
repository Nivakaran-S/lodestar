// Driver (Lodestar Run) helpers for the live screens: network/sync state, outbox labels, the run
// summary, and dispatch notices (stored Notifications + live socket notices, newest first).
import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
import { kv } from '@/lib/kv';
import { inList } from '@/lib/odata';
import { Store, useStore } from '@/lib/store';
import { hm } from '@/lib/time';
import { network } from '@/offline/network';
import type { QueueItem } from '@/offline/queue';
import { notices, type Notice } from '@/realtime/notices';
import * as api from './api';
import { useNotifications, type RunView } from './hooks';
import { bumpRevision, client, sync } from './platform';
import { useQuery } from './query';
import type { Outlet, Trip, TripStop } from './types';

/** Online flag plus the time it last changed ("no signal since …"). */
export function useNet() {
  return useStore(network);
}

/** The sync engine's state (running, last run, last result). */
export function useSyncStatus() {
  return useStore(sync.status);
}

/** Sends the outbox now; tells the caller what happened. */
export async function sendNow(): Promise<string> {
  const r = await sync.flush();
  if (r.offline) return 'No signal · records stay on this phone';
  if (!r.attempted) return 'Nothing waiting to send';
  return `${r.synced} of ${r.attempted} sent${r.conflicts ? ` · ${r.conflicts} to check` : ''}${r.rejected ? ` · ${r.rejected} refused` : ''}`;
}

// ---------------------------------------------------------------- outbox items

/** "POD · ORD0001" → ["POD · ", "ORD0001"] (the design sets the code in mono). */
export function labelParts(label: string): [string, string] {
  const i = label.indexOf(' · ');
  return i < 0 ? [label, ''] : [label.slice(0, i + 3), label.slice(i + 3)];
}

/** What the record says, in a few words. */
export function itemDetail(i: QueueItem): string {
  const p = i.payload ?? {};
  switch (i.kind) {
    case 'ARRIVAL':
      return `at the store ${hm(p.time) || hm(i.savedAt)}`;
    case 'LEAVE':
      return `left ${hm(p.time) || hm(i.savedAt)}`;
    case 'POD_SAVE':
      return `${p.units ?? 0}/${p.unitsOrdered ?? p.units ?? 0}${p.receiverName ? ` · ${p.receiverName}` : ''}`;
    case 'STATUS_CHANGE':
      return typeof p.title === 'string' && p.title ? p.title : `saved ${hm(i.savedAt)}`;
    case 'TRIP_STATUS':
      return p.status === 'COMPLETE' ? `trip finished ${hm(i.savedAt)}` : `trip started ${hm(i.savedAt)}`;
    default:
      return `saved ${hm(i.savedAt)}`;
  }
}

/** Short status word for a row. */
export function itemState(i: QueueItem): string {
  switch (i.status) {
    case 'pending':
      return 'waiting';
    case 'sending':
      return 'sending';
    case 'synced':
      return i.conflict ? 'heads-up' : hm(i.syncedAt) || 'sent';
    case 'conflict':
      return 'conflict';
    default:
      return 'refused';
  }
}

export const newestFirst = <T extends { savedAt: string }>(list: T[]) => [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

/** "2 arrivals · 3 PODs" for a set of records. */
export function itemMix(items: QueueItem[]): string {
  const n = (k: QueueItem['kind']) => items.filter(i => i.kind === k).length;
  const parts = [
    [n('ARRIVAL'), 'arrival', 'arrivals'],
    [n('POD_SAVE'), 'POD', 'PODs'],
    [n('LEAVE'), 'departure', 'departures'],
    [n('STATUS_CHANGE'), 'report', 'reports'],
    [n('TRIP_STATUS'), 'trip update', 'trip updates'],
    [items.length - n('ARRIVAL') - n('POD_SAVE') - n('LEAVE') - n('STATUS_CHANGE') - n('TRIP_STATUS'), 'other', 'others'],
  ] as const;
  return parts.filter(([c]) => c > 0).map(([c, one, many]) => `${c} ${c === 1 ? one : many}`).join(' · ');
}

// ---------------------------------------------------------------- calls and maps (no data needed)

/**
 * "Call dispatch" (DR-17, DR-23, DR-29, DR-37): the phone's dialer, which works where data does not. The app holds no
 * dispatch number (the directory is not readable by a driver), so the driver dials the depot's number from there.
 */
export async function openDialer(phone?: string | null): Promise<false> {
  const digits = phone?.replace(/[^\d+]/g, '') ?? '';
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch {
    throw new Error('This phone cannot open the dialer');
  }
  return false;
}

type Place = Outlet & { lat?: number | null; lng?: number | null };

/** A real street address (the synthetic network stores a placeholder tag, not an address). */
const realAddress = (a?: string | null) => (a && a.trim().length > 3 && a.trim().toLowerCase() !== 'synthetic' ? a.trim() : '');

/**
 * Where Maps should go for an outlet: its coordinates, else its street address, else its town (the synthetic
 * network has neither, so the driver at least gets directions to the right town).
 */
export function mapsPlace(o?: Place | null): { query: string; exact: boolean; town: string } | null {
  if (!o) return null;
  if (typeof o.lat === 'number' && typeof o.lng === 'number') return { query: `${o.lat},${o.lng}`, exact: true, town: o.district ?? '' };
  const address = realAddress(o.address);
  if (address) return { query: address, exact: true, town: o.district ?? '' };
  return o.district ? { query: `${o.district}, Sri Lanka`, exact: false, town: o.district } : null;
}

/** Google Maps directions through the given stops (the last one is the destination); null without a place. */
export function mapsUrl(stops: TripStop[]): string | null {
  const where = (o?: Place) => mapsPlace(o)?.query ?? '';
  const points = stops.map(s => where(s.outlet as Place | undefined)).filter(Boolean);
  if (!points.length) return null;
  const dest = encodeURIComponent(points.at(-1)!);
  const via = points.slice(0, -1).map(encodeURIComponent).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${dest}${via ? `&waypoints=${via}` : ''}`;
}

/** Opens turn-by-turn in Google Maps (DR-15, DR-36). */
export async function openMaps(stops: TripStop[]): Promise<false> {
  const url = mapsUrl(stops);
  if (!url) throw new Error('No address for this stop yet');
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error('This phone cannot open Maps');
  }
  return false;
}

// ---------------------------------------------------------------- stops with several orders

/** The orders dropped at the same stop (same trip and stop number: e.g. chilled + dry), chilled first. */
export function stopGroup(stops: TripStop[], stop: TripStop | null | undefined): TripStop[] {
  if (!stop) return [];
  const rows = stops.filter(s => s.tripId === stop.tripId && s.stopSeq === stop.stopSeq);
  const rank = (s: TripStop) => (s.order?.tempClass === 'CHILLED' ? 0 : 1);
  return (rows.length ? rows : [stop]).sort((a, b) => rank(a) - rank(b) || a.orderId.localeCompare(b.orderId));
}

/**
 * Where "Complete stop" goes (DR-03, DR-16, DR-20): the next order at the same stop (its POD), else the next
 * stop's arrival (DR-19), else the run is complete (DR-04). With no signal: the POD-saved-offline screen (DR-A2),
 * except from DR-16 (the store code, designed for no signal, goes straight on: offlineScreen false).
 */
export function afterPod(view: RunView | null, stop: TripStop, opts: { offlineScreen?: boolean } = {}): { to: string; params: Record<string, string> } {
  const open = (view?.tripStops ?? []).filter(s => s.status !== 'DELIVERED' && s.id !== stop.id);
  const sibling = open.find(s => s.stopSeq === stop.stopSeq);
  if (sibling) return { to: 'dr-03-proof-of-delivery', params: { stop: sibling.id } };
  if (opts.offlineScreen !== false && !network.get().online) return { to: 'dr-a2-pod-saved-offline', params: { stop: stop.id } };
  if (open[0]) return { to: 'dr-19-stop-2-arrival-hawa-eliya', params: { stop: open[0].id } };
  return { to: 'dr-04-run-complete', params: { stop: stop.id } };
}

// ---------------------------------------------------------------- run summary

export type TripSummary = {
  trip: Trip | null;
  stops: TripStop[];
  delivered: TripStop[];
  unitsDelivered: number;
  unitsOrdered: number;
  short: TripStop[];
  exceptions: number;
  startedAt?: string | null;
  endedAt?: string | null;
  nextTrip: Trip | null;
};

/** The finished trip (else the current one) with delivered/ordered units from the PODs. */
export function tripSummary(view: RunView | null): TripSummary {
  const empty: TripSummary = { trip: null, stops: [], delivered: [], unitsDelivered: 0, unitsOrdered: 0, short: [], exceptions: 0, nextTrip: null };
  if (!view) return empty;
  const stopsOf = (t: Trip) => view.stops.filter(s => s.tripId === t.id);
  const done = view.trips.filter(t => {
    const st = stopsOf(t);
    return st.length > 0 && st.every(s => s.status === 'DELIVERED');
  });
  const trip = done.at(-1) ?? view.trip;
  if (!trip) return empty;
  const stops = stopsOf(trip);
  const delivered = stops.filter(s => s.status === 'DELIVERED');
  const pods = stops.map(s => s.pod).filter((p): p is NonNullable<TripStop['pod']> => !!p);
  const leaves = stops.map(s => s.leaveActual).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b));
  const arrivals = stops.map(s => s.arrivalActual).filter((x): x is string => !!x).sort((a, b) => a.localeCompare(b));
  return {
    trip,
    stops,
    delivered,
    unitsDelivered: pods.reduce((n, p) => n + (p.unitsDelivered ?? 0), 0),
    // every stop's order counts, delivered or not ("0 of 51 units", never "0 of 0")
    unitsOrdered: stops.reduce((n, st) => n + (st.pod?.unitsOrdered ?? st.order?.units ?? 0), 0),
    short: stops.filter(s => s.pod && s.pod.unitsDelivered < s.pod.unitsOrdered),
    exceptions: pods.reduce((n, p) => n + (p.exceptions?.length ?? 0), 0),
    // the departure time is set by the plan: a trip has started only once it is out
    startedAt: trip.status === 'ENROUTE' || trip.status === 'COMPLETE' ? (trip.departTime ?? arrivals[0] ?? null) : (arrivals[0] ?? null),
    endedAt: leaves.at(-1) ?? null,
    nextTrip: view.trips.find(t => t.tripNumber > trip.tripNumber && stopsOf(t).some(s => s.status !== 'DELIVERED')) ?? null,
  };
}

// ---------------------------------------------------------------- dispatch notices

export type DispatchNotice = { id: string; type: string; title: string; body: string; at: string; read: boolean; stored: boolean };

const TITLES: Record<string, string> = {
  SHORTFALL_ACK: 'Shortfall acknowledged',
  POD_MATCHED: 'Delivery record matched',
  DEFERRAL_SUGGESTED: 'Order may move',
  ETA_UPDATE: 'ETA updated',
  PLAN_PUBLISHED: 'Plan published',
  TRIP_RELEASED: 'Trip released',
  SIGNAL_LOST: 'Signal lost',
  SIGNAL_BACK: 'Signal back',
  BLACKOUT_DETECTED: 'No signal on the route',
  REEFER_FAIL: 'Reefer alert',
  CREDIT_NOTE_ISSUED: 'Credit note issued',
  BAY_UPDATE: 'Bay update',
  NOTIFICATION: 'Notice from dispatch',
};

export function noticeTitle(type: string): string {
  const t = type.toUpperCase();
  return TITLES[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** A readable line from a free-form payload. */
export function noticeBody(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  for (const k of ['message', 'text', 'note', 'reason', 'summary', 'explanation']) {
    const v = payload[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return Object.entries(payload)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
}

/** Stored notifications plus live socket notices not stored yet, newest first. */
export function useDispatchNotices() {
  const q = useNotifications();
  const live = useStore(notices);
  const list = useMemo(() => {
    const stored: DispatchNotice[] = (q.data ?? []).map(n => ({
      id: n.id,
      type: n.type,
      title: noticeTitle(n.type),
      body: noticeBody(n.payload),
      at: n.sentAt,
      read: !!n.readAt,
      stored: true,
    }));
    const ids = new Set(stored.map(n => n.id));
    const fresh: DispatchNotice[] = live
      .filter(n => !ids.has(n.id))
      .map(n => ({ id: n.id, type: n.type, title: noticeTitle(n.type), body: noticeBody(n.payload), at: n.at, read: false, stored: false }));
    return [...stored, ...fresh].sort((a, b) => b.at.localeCompare(a.at));
  }, [q.data, live]);
  return { ...q, list };
}

/** Notifications MarkRead (online only); refetches after. */
export async function markNoticeRead(n: DispatchNotice, online: boolean): Promise<void> {
  if (!online || !n.stored || n.read) return;
  await api.markRead(client, n.id);
  bumpRevision();
}

/** Whole minutes from now until `iso` (NaN without a time). */
export function minutesUntil(iso?: string | null, now: number = Date.now()): number {
  return iso ? Math.round((Date.parse(iso) - now) / 60_000) : NaN;
}

// ---------------------------------------------------------------- handover, offline save, new phone (DR-11/13/14/32)

const RUN_KEY = (what: 'accepted' | 'saved', tripId: string) => `lodestar.run.${what}.${tripId}`;

/** Per trip: when this phone accepted the load (DR-11) and when the run was saved for offline (DR-13), from the device store. */
export const runMarks = new Store<Record<string, string | null>>({});

async function loadMark(k: string) {
  if (k in runMarks.get()) return;
  const v = await kv.get(k).catch(() => null);
  runMarks.set(m => (k in m ? m : { ...m, [k]: v }));
}

export async function setRunMark(what: 'accepted' | 'saved', tripId: string, at: string = new Date().toISOString()) {
  const k = RUN_KEY(what, tripId);
  runMarks.set(m => ({ ...m, [k]: at }));
  await kv.set(k, at).catch(() => undefined);
}

/** The marks of a trip (`loaded` once read from the device store; null when none). */
export function useRunMarks(tripId?: string | null): { loaded: boolean; accepted: string | null; saved: string | null } {
  const all = useStore(runMarks);
  useEffect(() => {
    if (!tripId) return;
    void loadMark(RUN_KEY('accepted', tripId));
    void loadMark(RUN_KEY('saved', tripId));
  }, [tripId]);
  if (!tripId) return { loaded: false, accepted: null, saved: null };
  const a = RUN_KEY('accepted', tripId);
  const s = RUN_KEY('saved', tripId);
  return { loaded: a in all && s in all, accepted: all[a] ?? null, saved: all[s] ?? null };
}

/** A trip_released notice for one of the driver's trips that arrived after `since` (DR-11 opens on it). */
export function useReleasedNotice(tripIds: string[], since: string): Notice | undefined {
  const live = useStore(notices);
  const ids = tripIds.join(',');
  return useMemo(() => live.find(n => n.event === 'trip_released' && n.at >= since && ids.split(',').includes(String(n.payload.tripId ?? n.payload.id ?? ''))), [live, ids, since]);
}

export type ServerEvent = { id: string; tripId?: string | null; eventType: string; savedAt: string; syncedAt?: string | null };

/** The day's offline events the server holds for the driver's trips (the vehicle scope comes from the token). */
export function useServerEvents(tripIds: string[]) {
  const ids = [...tripIds].sort((a, b) => a.localeCompare(b)).join(',');
  return useQuery<ServerEvent[]>(ids ? `run.events.${ids}` : null, c => c.all<ServerEvent>('OfflineEvents', { filter: inList('tripId', ids.split(',')), select: ['id', 'tripId', 'eventType', 'savedAt', 'syncedAt'], orderby: 'syncedAt desc' }));
}

/**
 * Run moved to a new phone (DR-32): the server holds records for today's trip that this phone never saved, and
 * this phone has not saved the run for offline yet. The outbox keeps each record's id (the server's event id).
 */
export function movedRun(events: ServerEvent[] | undefined, mine: QueueItem[], saved: string | null): { moved: boolean; lastSynced?: string } {
  if (!events?.length || saved) return { moved: false };
  const own = new Set(mine.map(i => i.id));
  const others = events.filter(e => !own.has(e.id));
  if (!others.length) return { moved: false };
  const lastSynced = others.map(e => e.syncedAt ?? e.savedAt).filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1);
  return { moved: true, lastSynced };
}
