'use client';
// Shared data for the Lodestar Plan screens: the run date and depots in view, and the exceptions list (DSP-08,
// DSP-13) built from real records: orders in EXCEPTION, stops with a high late risk, and alert notifications
// (vehicle and signal alerts, dock flags and vehicle faults, POD exceptions and failed stops, store receipt issues), and
// the run's synced offline records with a conflict note (DSP-A2). p5Link() names the P5 screen that handles an item.
import { addDays, dayFilter, fmtClock, fmtDayTime, fmtRunDate, fmtTime, isoDay } from '@/lib/format';
import { loadPlanningRules } from './planning-rules';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useAction, useEntity, useQuery } from '@/lib/odata/hooks';
import type { AgentRun, AgentRunDetail, Notification, OfflineEvent, Order, Plan, TripStop } from '@/lib/odata/types';
import { colomboDay, cutoffFor, depotFilter, useAgentRunId, useDepot, useRunDate } from '@/lib/workday';
import { valueOf } from '@/lib/odata/client';
import type { User } from '@/lib/odata/types';

export function usePlanScope() {
  const { runDate, loading, error, none } = useRunDate('Plans');
  const { depot, depots, active, setDepot } = useDepot();
  const and = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' and ') || undefined;
  return {
    runDate,
    loadingDate: loading,
    dateError: error,
    noPlans: none,
    depot,
    depots,
    active,
    setDepot,
    /** Orders of the run date in the depots in view. */
    ordersFilter: runDate ? and(dayFilter('runDate', runDate), depotFilter('outlet/depot', active)) : undefined,
    /** Trips of the run date in the depots in view. */
    tripsFilter: runDate ? and(dayFilter('runDate', runDate), depotFilter('depot', active)) : undefined,
    /** Plans of the run date in the depots in view. */
    plansFilter: runDate ? and(dayFilter('runDate', runDate), depotFilter('depot', active)) : undefined,
    and,
  };
}

/**
 * Realtime events after which a plan screen (DSP-01/02/12) reloads: any alert, a plan going live (here or on the
 * phone) and a new order in the depot (store app or a logged phone order).
 */
export const PLAN_EVENTS = ['notification', 'plan_published', 'order_created'];

export type ExceptionTone = 'bad' | 'warn' | 'off';

export interface ExceptionItem {
  id: string;
  tone: ExceptionTone;
  title: string;
  meta: string;
  /** Right-hand figure, e.g. "41%" late risk. */
  value?: string;
  valueLabel?: string;
  at?: string;
  outletId?: string;
  orderId?: string;
  tripId?: string;
  source: 'order' | 'stop' | 'notification' | 'sync';
  vehicleId?: string;
  notificationId?: string;
  /** The notification type, for notification items. */
  type?: string;
}

/** Notification types that need the dispatcher (the phone's DSP-27 uses the same list: mobile/src/model/plan.ts). */
export const ALERT_TYPES = [
  'BLACKOUT_DETECTED', 'REEFER_FAIL', 'SHORTFALL_ACK', 'DEFERRAL_SUGGESTED', 'SIGNAL_LOST', 'DOCK_BLOCKED', 'LATE_RISK',
  'SHORTFALL_FLAGGED', 'POD_EXCEPTION', 'STOP_FAILED', 'RECEIPT_ISSUE', 'VEHICLE_FAULT', 'ORDER_AT_RISK', 'DRIVER_REPORT',
];

/** Reefer limit (°C) when a report names none: the platform's REEFER_MAX_C (backend libs/platform/src/cold-chain.ts). */
const REEFER_MAX_C = 4;

/**
 * Whether a notice needs the dispatcher. Every ALERT_TYPES notice does, except a driver's report that is
 * information: a passed pre-trip check, a reefer reading within the limit, a delivery on the store code. The
 * notifications service stamps payload.severity ('info' | 'alert') on driver reports; older notices without it
 * are judged from the report itself, the same way (backend apps/notifications noticeSeverity).
 */
export function isAlertNotice(n: Pick<Notification, 'type' | 'payload'>): boolean {
  if (!ALERT_TYPES.includes(n.type)) return false;
  if (n.type !== 'DRIVER_REPORT') return true;
  return driverReportFailed((n.payload ?? {}) as Record<string, unknown>);
}

function tooWarm(p: Record<string, unknown>): boolean {
  if (p.tempC === null || p.tempC === undefined || p.tempC === '') return false;
  const t = Number(p.tempC);
  const limit = p.limitC !== null && p.limitC !== undefined && Number.isFinite(Number(p.limitC)) ? Number(p.limitC) : REEFER_MAX_C;
  return Number.isFinite(t) && t > limit;
}

function driverReportFailed(p: Record<string, unknown>): boolean {
  if (p.severity === 'info' || p.severity === 'alert') return p.severity === 'alert';
  switch (String(p.report ?? '').toUpperCase()) {
    case 'VEHICLE_CHECK':
      return p.ok === false || tooWarm(p) || (Array.isArray(p.items) && p.items.some(i => !!i && typeof i === 'object' && (i as { ok?: unknown }).ok === false));
    case 'REEFER_TEMP':
      return tooWarm(p);
    case 'STORE_CODE':
      return false;
    default:
      return true;
  }
}

/** "7:27 AM" for a notice of today (Colombo), "Wed 21 Oct · 12:25 PM" for an older one: never yesterday's as today's. */
export function fmtNoticeTime(v: string | null | undefined): string {
  if (!v) return '—';
  return colomboDay(new Date(v)) === colomboDay() ? fmtTime(v) : fmtDayTime(v);
}

/** The instant a Colombo calendar day starts ("2026-10-22" → 2026-10-21T18:30:00.000Z). */
const colomboDayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 330 * 60_000).toISOString();

/**
 * Notices that belong to the run in view: sent from the start of the run day or of today (Colombo), whichever is
 * earlier, to the end of the run day. Older unread notices (yesterday's run) stay in the notifications panel but
 * are not "things that need you now".
 */
export function noticeWindow(runDate: string, today = colomboDay()): string {
  const from = runDate < today ? runDate : today;
  const to = addDays(runDate > today ? runDate : today, 1);
  return `sentAt ge ${colomboDayStart(from)} and sentAt lt ${colomboDayStart(to)}`;
}

function describeNotification(n: Notification): Pick<ExceptionItem, 'title' | 'meta' | 'tone' | 'outletId' | 'orderId' | 'vehicleId'> {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  const nice = n.type.toLowerCase().replace(/_/g, ' ');
  const title = text('title') ?? text('message') ?? nice.charAt(0).toUpperCase() + nice.slice(1);
  const meta = [text('orderId'), text('vehicleId'), text('outletId'), text('location'), text('note'), fmtNoticeTime(n.sentAt)].filter(Boolean).join(' · ');
  // a failed pre-trip check (a driver report that needs dispatch) is as serious as a reefer fault
  const failedCheck = n.type === 'DRIVER_REPORT' && String(p.report ?? '').toUpperCase() === 'VEHICLE_CHECK';
  const tone: ExceptionTone = /BLACKOUT|SIGNAL/.test(n.type) ? 'off' : failedCheck || /FAIL|BLOCK|ISSUE|FAULT/.test(n.type) ? 'bad' : 'warn';
  return { title, meta, tone, outletId: text('outletId'), orderId: text('orderId'), vehicleId: text('vehicleId') };
}

/** Everything that needs the dispatcher for the run date, most urgent first. */
export function useExceptions(runDate: string | undefined, ordersFilter: string | undefined, active: readonly string[]) {
  return useQuery<ExceptionItem[]>(
    runDate ? `exceptions:${runDate}:${active.join(',')}` : null,
    async c => {
      // late-risk levels from the planning service (PlanningRules), not a copy on the desk
      const { lateRisk } = await loadPlanningRules(c);
      const stopsFilter = [
        dayFilter('trip/runDate', runDate!),
        `lateRiskPct ge ${lateRisk.alertPct}`,
        "status ne 'DELIVERED'",
        depotFilter('trip/depot', active),
      ].filter(Boolean).join(' and ');
      const syncFilter = [dayFilter('trip/runDate', runDate!), 'conflictNote ne null', depotFilter('trip/depot', active)].filter(Boolean).join(' and ');
      const [orders, stops, notes, synced] = await Promise.all([
        c.list<Order>('Orders', { filter: `${ordersFilter} and status eq 'EXCEPTION'`, expand: 'outlet($select=name,district)', top: 50 }),
        c.list<TripStop>('TripStops', { filter: stopsFilter, expand: 'trip($select=vehicleId,district),outlet($select=name,windowClose)', orderby: 'lateRiskPct desc', top: 50 }),
        c.list<Notification>('Notifications', {
          filter: `readAt eq null and type in (${ALERT_TYPES.map(t => `'${t}'`).join(',')}) and ${noticeWindow(runDate!)}`,
          orderby: 'sentAt desc',
          top: 20,
        }),
        // a store or dispatcher without access to offline events still gets the rest of the list
        c.list<OfflineEvent>('OfflineEvents', { filter: syncFilter, expand: 'trip($select=vehicleId)', orderby: 'syncedAt desc', top: 50 }).catch(() => ({ value: [] as OfflineEvent[] })),
      ]);
      const byTrip = new Map<string, OfflineEvent[]>();
      for (const e of synced.value) if (e.tripId) byTrip.set(e.tripId, [...(byTrip.get(e.tripId) ?? []), e]);
      const items: ExceptionItem[] = [
        ...orders.value.map(o => ({
          id: `order:${o.id}`,
          source: 'order' as const,
          tone: 'bad' as const,
          title: `${o.outlet?.name ?? o.outletId}: order exception`,
          meta: [o.id, o.notes].filter(Boolean).join(' · '),
          orderId: o.id,
          outletId: o.outletId,
          at: o.updatedAt,
        })),
        ...stops.value.map(s => ({
          id: `stop:${s.id}`,
          source: 'stop' as const,
          tone: ((s.lateRiskPct ?? 0) >= lateRisk.highPct ? 'bad' : 'warn') as ExceptionTone,
          title: `${s.trip?.vehicleId ?? 'Trip'} late risk rising`,
          meta: [s.outlet?.name ?? s.outletId, `stop ${s.stopSeq}`, s.outlet?.windowClose ? `closes ${s.outlet.windowClose}` : undefined, s.etaModel ? `ETA ~${fmtClock(s.etaModel)}` : undefined]
            .filter(Boolean)
            .join(' · '),
          value: `${s.lateRiskPct}%`,
          valueLabel: 'late risk',
          outletId: s.outletId,
          orderId: s.orderId,
          tripId: s.tripId,
          at: s.updatedAt,
        })),
        ...notes.value.filter(isAlertNotice).map(n => ({
          id: `note:${n.id}`,
          source: 'notification' as const,
          notificationId: n.id,
          type: n.type,
          tripId: n.tripId ?? undefined,
          at: n.sentAt,
          ...describeNotification(n),
        })),
        ...[...byTrip.entries()].map(([tripId, es]) => {
          const vehicleId = (es[0] as OfflineEvent & { trip?: { vehicleId?: string } }).trip?.vehicleId;
          const review = es.filter(e => !e.conflictResolved).length;
          return {
            id: `sync:${tripId}`,
            source: 'sync' as const,
            tone: (review ? 'bad' : 'warn') as ExceptionTone,
            title: `${vehicleId ?? 'A vehicle'} synced: ${es.length} conflict${es.length === 1 ? '' : 's'} to confirm`,
            meta: [es[0].conflictNote, es[0].syncedAt ? `synced ${fmtTime(es[0].syncedAt)}` : undefined].filter(Boolean).join(' · '),
            tripId,
            vehicleId,
            at: es[0].syncedAt ?? es[0].savedAt,
          };
        }),
      ];
      const rank: Record<ExceptionTone, number> = { bad: 0, warn: 1, off: 2 };
      return items.sort((a, b) => rank[a.tone] - rank[b.tone] || String(b.at ?? '').localeCompare(String(a.at ?? '')));
    },
    { refreshOn: ['notification', 'eta_update', 'signal_lost', 'signal_back', 'vehicle_fault', 'driver_report'] },
  );
}

/** The P5 degradation screen that handles an exception, and the focus it opens on. */
export function p5Link(x: ExceptionItem): { href: string; label: string; focus?: ['trip' | 'vehicle', string] } | null {
  if (x.source === 'sync' && x.tripId) return { href: '/plan/dsp-a2-reconcile-conflict', label: 'Reconcile', focus: ['trip', x.tripId] };
  if (x.type && /BLACKOUT|SIGNAL_LOST/.test(x.type)) return { href: '/plan/dsp-a1-blackout-view', label: 'Blackout view', focus: x.tripId ? ['trip', x.tripId] : undefined };
  if (x.type && /VEHICLE_FAULT|REEFER_FAIL/.test(x.type) && x.vehicleId) return { href: '/plan/dsp-b1-re-plan-diff', label: 'Re-plan', focus: ['vehicle', x.vehicleId] };
  return null;
}

const DRAFTING = new Set(['DRAFTING', 'RUNNING', 'PENDING', 'QUEUED']);

/** One planning-agent run; polled while the agent is still drafting. */
export function useAgentRun(id: string | null | undefined) {
  const q = useEntity<AgentRun>('AgentRuns', id ?? null);
  const drafting = Boolean(q.data && DRAFTING.has(String(q.data.status).toUpperCase()));
  // Reading a run refreshes it from the agent (planning re-syncs it at most every 2 s).
  useInterval(drafting ? 2000 : null, q.refresh);
  return { ...q, drafting };
}

/**
 * The planning-agent run under review for the run date and depot(s) in view: the one this tab started or opened
 * (useAgentRunId) when it belongs to that day and depot, else the newest run still drafting or waiting for
 * approval (started on another screen, another tab or the phone). Approved, rejected and failed runs drop out.
 */
export function useReviewRun() {
  const [stored, setRunId] = useAgentRunId();
  const { runDate } = useRunDate('Plans');
  const { active } = useDepot();
  const mine = useAgentRun(stored);
  const fits = (r: AgentRun) => (!runDate || isoDay(r.runDate) === runDate) && (!active.length || active.includes(r.depot));
  // a run this tab holds stays (its errors are shown) unless it turns out to be another day's or depot's
  const useStored = Boolean(stored) && (!mine.data || fits(mine.data));
  const filter = runDate
    ? [dayFilter('runDate', runDate), depotFilter('depot', active), `status in (${[...DRAFTING, 'NEEDS_APPROVAL'].map(x => `'${x}'`).join(',')})`].filter(Boolean).join(' and ')
    : null;
  const latest = useQuery<string | null>(!useStored && filter ? `review-run:${filter}` : null, async c =>
    (await c.list<AgentRun>('AgentRuns', { filter: filter!, select: 'id', orderby: 'createdAt desc', top: 1 })).value[0]?.id ?? null,
  { refreshOn: PLAN_EVENTS });
  const found = useAgentRun(useStored ? null : latest.data);
  const runId = useStored ? stored : latest.data ?? null;
  return { runId, run: useStored ? mine : found, setRunId, loading: !useStored && latest.loading };
}

/** The plan version an approved run became (Plans, by AgentRun.planId) and whether it is still the live one. */
export function useRunPlan(run: AgentRun | null | undefined) {
  const planId = run?.status === 'APPROVED' ? run.planId ?? null : null;
  const q = useQuery<Plan | null>(planId ? `run-plan:${planId}` : null, async c =>
    (await c.list<Plan>('Plans', { filter: `id eq '${planId!.replace(/'/g, "''")}'`, select: 'id,version,status', top: 1 })).value[0] ?? null,
  { refreshOn: PLAN_EVENTS });
  // until the row answers, the id says the version (PLK-2026-10-22-v1)
  const fromId = planId ? Number(/-v(\d+)$/.exec(planId)?.[1]) || undefined : undefined;
  const version = q.data?.version ?? fromId;
  return { planId, version, status: q.data?.status, live: Boolean(planId) && (q.data ? q.data.status === 'PUBLISHED' : true) };
}

/** Starts a planning-agent draft for one depot and run date. The agent drafts; it never publishes. */
export function useStartAgentRun(onStarted?: (run: AgentRun) => void, opts: { track?: boolean } = {}) {
  const action = useAction<{ depot: string; runDate: string }, AgentRun>(
    (c, p) => c.create<AgentRun>('AgentRuns', { depot: p.depot, runDate: `${p.runDate}T00:00:00.000Z` }),
    { onSuccess: r => onStarted?.(r) },
  );
  const { run: start } = action;
  const track = Boolean(opts.track);
  // tracked: the draft being started is shown on DSP-22 while the agent works (useStartingRun), so the
  // screen that started it can move there at once instead of waiting for the whole draft
  const run = useCallback(async (p: { depot: string; runDate: string }) => {
    if (!track) return start(p);
    const at = Date.now();
    setStarting({ ...p, at });
    const r = await start(p);
    setStarting(r ? null : { ...p, at, failed: true });
    return r;
  }, [start, track]);
  return { ...action, run };
}

/** A planning-agent draft this tab asked for that the agent is still drafting (the start request is in flight). */
export type StartingRun = { depot: string; runDate: string; at: number; failed?: boolean };
let starting: StartingRun | null = null;
const startingSubs = new Set<() => void>();
export function setStarting(s: StartingRun | null) { starting = s; startingSubs.forEach(fn => fn()); }
export function useStartingRun(): StartingRun | null {
  return useSyncExternalStore(fn => { startingSubs.add(fn); return () => { startingSubs.delete(fn); }; }, () => starting, () => null);
}

function useInterval(ms: number | null, fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useEffect(() => {
    if (ms === null) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/**
 * The run the cutoff queue is filling for today: the first operating day (Calendar) from tomorrow (Colombo).
 * `before` is true until today's 4:00 PM cutoff; after it the dispatcher plans the closed queue, so the empty
 * state (DSP-21 Empty queue before cutoff) never applies in the evening.
 */
export function useOpenRun(now: Date = new Date()) {
  const first = addDays(colomboDay(now), 1);
  const cal = useQuery<string | null>(`open-run:${first}`, async c => {
    const rows = await c.list<{ date: string; isOperating: boolean }>('Calendar', { filter: `date ge ${first}T00:00:00Z and isOperating eq true`, orderby: 'date', top: 1 });
    return rows.value[0] ? String(rows.value[0].date).slice(0, 10) : null;
  });
  const runDate = cal.data ?? first;
  const cutoff = cutoffFor(runDate);
  return { runDate, cutoff, before: now < cutoffFor(first) && now < cutoff, msLeft: Math.max(0, cutoff.getTime() - now.getTime()), loading: cal.loading };
}

/**
 * The next operating day (Calendar) after a run date: where approval rolls a deferred order (plan-execution's
 * nextOperatingDay), so a deferral confirmed on DSP-03 lands on the same run. `known` is false until the calendar
 * answered; `day` is then the following day as a stand-in.
 */
export function useNextOperatingDay(runDate: string | undefined) {
  const q = useQuery<string | null>(runDate ? `next-operating:${runDate}` : null, async c => {
    const rows = await c.list<{ date: string }>('Calendar', { filter: `date gt ${runDate}T00:00:00Z and isOperating eq true`, select: 'date', orderby: 'date', top: 1 });
    return rows.value[0] ? String(rows.value[0].date).slice(0, 10) : null;
  });
  const known = q.data !== undefined || Boolean(q.error);
  return { day: q.data ?? (runDate ? addDays(runDate, 1) : ''), known, fromCalendar: Boolean(q.data) };
}

/** Why an agent draft cannot serve every order as the rules stand (DSP-23 Plan infeasible). */
export interface Infeasibility {
  /** Protected orders the agent could not place (never deferred: the dispatcher must decide). */
  review: NonNullable<AgentRunDetail['needsReview']>;
  /** Hard-rule violations left after the redraft budget. */
  violations: NonNullable<AgentRunDetail['violations']>;
  /** Chilled m³ that does not fit the available reefers (0 when it fits). */
  shortM3: number;
  demandM3: number;
  capacityM3: number;
  vehiclesDown: string[];
}

/** The draft's infeasibility, or null when the draft serves the run (or there is no finished draft). */
export function infeasibility(run: AgentRun | null | undefined): Infeasibility | null {
  const d = run?.detail;
  if (!d) return null;
  const review = d.needsReview ?? [];
  const violations = d.violations ?? [];
  if (!review.length && !violations.length) return null;
  const cs = (d.contextSummary ?? {}) as { chilledDemand?: { m3?: number }; reeferCapacity?: { m3?: number }; vehiclesDown?: string[] };
  const demandM3 = Number(cs.chilledDemand?.m3 ?? 0);
  const capacityM3 = Number(cs.reeferCapacity?.m3 ?? 0);
  return {
    review,
    violations,
    demandM3,
    capacityM3,
    shortM3: Math.max(0, Math.round((demandM3 - capacityM3) * 10) / 10),
    vehiclesDown: Array.isArray(cs.vehiclesDown) ? cs.vehiclesDown : [],
  };
}

/**
 * Sends a dispatcher's message to the store manager(s) of an outlet (Notifications/Lodestar.Send, DISPATCH_NOTICE):
 * DSP-13 "Message store", DSP-15 "Warn <outlet>". Resolves to the names it reached; fails when the outlet has no
 * active store manager.
 */
export function useMessageStore(onSent?: (names: string) => void) {
  return useAction<{ outletId: string; text: string; tripId?: string }, string>(async (c, p) => {
    const managers = await c.list<User>('Users', { filter: `outletId eq '${p.outletId}' and role eq 'STORE_MANAGER' and isActive eq true`, select: 'id,name', top: 5 });
    if (!managers.value.length) throw new Error(`No active store manager is registered for ${p.outletId}`);
    for (const m of managers.value) {
      await c.action('Notifications', null, 'Send', {
        recipientId: m.id, type: 'DISPATCH_NOTICE', outletId: p.outletId, tripId: p.tripId,
        payload: { message: p.text, outletId: p.outletId, from: 'dispatch' },
      });
    }
    return managers.value.map(m => m.name).join(', ');
  }, { onSuccess: names => onSent?.(names) });
}

/** One part of a stop's late risk (planning's EtaService), as Plans/Lodestar.LateRiskExplain returns it. */
export interface LateRiskPart {
  key: 'base' | 'window' | 'road';
  label: string;
  detail: string;
  value: number;
}

export interface LateRiskExplain {
  stopId: string;
  depot: string;
  roadClass: string | null;
  monsoon: boolean;
  plannedHour: number | null;
  windowClose: string;
  lateRiskPct: number | null;
  /** The figure the plan set (base + window); null without a planned arrival. */
  planned: number | null;
  base: number | null;
  /** Base rate, arrival near the window close, updates on the road: they add up to lateRiskPct. */
  parts: LateRiskPart[];
}

/** DSP-15: a stop's late risk as the planning service explains it (GET Plans/Lodestar.LateRiskExplain(stopId=…)). */
export function useLateRiskExplain(stopId: string | null | undefined) {
  return useQuery<LateRiskExplain>(stopId ? `late-risk-explain:${stopId}` : null, async c =>
    valueOf<LateRiskExplain>(await c.fn('Plans', null, 'LateRiskExplain', { stopId: stopId! })),
  { refreshOn: ['eta_update'] });
}

/**
 * The run date and the time now, for a plan screen's eyebrow ("Mon 19 Oct · 4:10 PM"). A run date before today is
 * the latest plan kept for review, not today: it says so instead of pairing that day with the clock.
 */
export function runStamp(runDate: string | undefined, sep = ' · '): string {
  if (!runDate) return `…${sep}${fmtTime(new Date())}`;
  return runDate < colomboDay() ? `${fmtRunDate(runDate)} run, a past day` : `${fmtRunDate(runDate)}${sep}${fmtTime(new Date())}`;
}
