// Lodestar Plan phone (dispatcher): the alerts list, the plan under review, trip progress and signal state,
// built from Notifications, Plans, the day's trips and the live socket notices.
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { inList, key, lit, type ODataClient } from '@/lib/odata';
import { addDays, dayFilter, dayLabel, hm } from '@/lib/time';
import { titleCase } from '@/lodestar/live';
import { notices, type Notice } from '@/realtime/notices';
import * as api from './api';
import { useClaims, useLiveRoutes, useNotifications, useParam } from './hooks';
import { client } from './platform';
import { LATE_RISK_PCT } from './preferences';
import { useQuery } from './query';
import type { Deferral, Notification, Order, Outlet, Plan, Trip, TripStop } from './types';
import { depotName } from './depots';

/** How often the dispatcher's live screens re-read when no realtime notice arrives (a dropped socket, a quiet zone). */
export const LIVE_POLL_MS = 30_000;

/** Calls `fn` every `ms` while the screen is mounted. */
export function useEvery(ms: number, fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Late risk at or above this needs the dispatcher (one value with the desk: LATE_RISK_PCT). */
export const LATE_RISK = LATE_RISK_PCT;

/** The planning agent's limits (AgentRuns/Lodestar.AgentConfig, from the agent's GET /config). */
export type AgentLimits = { maxTripsPerVehicle: number; freshMinutesBudget: number; otherMinutesBudget: number };
export type AgentConfig = { firstDeparture?: string; limits: AgentLimits; rules: { rule: string; label: string }[] };

export function useAgentConfig() {
  return useQuery<AgentConfig>('agent-config', c => c.fn<AgentConfig>('AgentRuns/Lodestar.AgentConfig()'), { persist: true });
}

/** "212 / 270 min" with the trip's day budget (Fresh or Style and Tech) when the config is known, else "212 min". */
export function minutesOfBudget(minutes: number | null | undefined, brand: string | null | undefined, cfg?: AgentConfig): string {
  if (minutes === null || minutes === undefined) return '—';
  const budget = cfg ? (brand === 'FRESH' ? cfg.limits.freshMinutesBudget : cfg.limits.otherMinutesBudget) : undefined;
  return budget ? `${Math.round(minutes)} / ${budget} min` : `${Math.round(minutes)} min`;
}

/**
 * Notification types that wake the dispatcher until they are read: the same alert list as the desk's exceptions
 * inbox (frontend/components/live/plan-data.ts ALERT_TYPES), plus the order and driver reports sent to dispatch.
 */
export const ALERT_TYPES = new Set([
  'BLACKOUT_DETECTED', 'SIGNAL_LOST', 'REEFER_FAIL', 'DEFERRAL_SUGGESTED', 'LATE_RISK', 'DOCK_BLOCKED', 'SHORTFALL_ACK',
  'SHORTFALL_FLAGGED', 'POD_EXCEPTION', 'STOP_FAILED', 'RECEIPT_ISSUE', 'VEHICLE_FAULT', 'ORDER_AT_RISK', 'DRIVER_REPORT',
]);

export type AlertTone = 'late' | 'signal' | 'done';

/** An alert type, unless the server marked it information only (a passed pre-trip check: payload.severity 'info'). */
export const isAlert = (n: Pick<Notification, 'type' | 'payload'>) =>
  ALERT_TYPES.has(n.type) && ((n.payload ?? {}) as Payload).severity !== 'info';

export type AlertRow = {
  id: string;
  tone: AlertTone;
  title: string;
  meta: string;
  /** An id shown in mono in the meta line (order, outlet). */
  code?: string;
  at?: string;
  needsYou: boolean;
  plan?: string;
  vehicle?: string;
};

type Payload = Record<string, unknown>;
const text = (p: Payload, k: string) => (typeof p[k] === 'string' && p[k] ? (p[k] as string) : undefined);
const num = (p: Payload, k: string) => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
const nice = (type: string) => titleCase(type);

/** "Kandy Hub", or "both depots" / "3 depots" for the dispatcher's depots (names from the Depots registry). */
export function depotsLabel(depots?: string[] | null): string {
  if (!depots?.length) return '';
  return depots.length === 2 ? 'both depots' : depots.length > 2 ? `${depots.length} depots` : depotName(depots[0]);
}

export function planSource(p: Pick<Plan, 'source'>): string {
  return p.source === 'AGENT' ? 'Planning agent' : p.source === 'AUTOPLAN' ? 'Auto-plan' : 'Manual plan';
}

function vehicleOf(p: Payload, tripId: string | null | undefined, trips: Trip[]): string | undefined {
  const v = text(p, 'vehicleId');
  if (v) return v;
  const t = tripId ?? text(p, 'tripId');
  return t ? trips.find(x => x.id === t)?.vehicleId : undefined;
}

function fromNotification(n: Notification, trips: Trip[]): AlertRow {
  const p = (n.payload ?? {}) as Payload;
  const vehicle = vehicleOf(p, n.tripId, trips);
  const pct = num(p, 'lateRiskPct');
  const title =
    text(p, 'title') ??
    text(p, 'message') ??
    (n.type === 'BLACKOUT_DETECTED' ? `${vehicle ?? 'A vehicle'} lost signal`
      : n.type === 'SIGNAL_BACK' ? `${vehicle ?? 'A vehicle'} has signal again`
      : n.type === 'REEFER_FAIL' ? `${vehicle ?? 'A vehicle'} reefer failed`
      : n.type === 'SHORTFALL_ACK' ? 'Shortfall acknowledged'
      : n.type === 'POD_MATCHED' ? 'Proof of delivery matched'
      : n.type === 'DEFERRAL_SUGGESTED' ? 'Deferral suggested'
      : pct !== undefined && vehicle ? `${vehicle} late risk ${pct}%`
      : nice(n.type));
  const meta = [vehicle && !title.includes(vehicle) ? vehicle : undefined, text(p, 'location'), text(p, 'note'), text(p, 'reason')].filter(Boolean).join(' · ');
  const code = text(p, 'orderId') ?? text(p, 'outletId');
  const tone: AlertTone = /BLACKOUT|SIGNAL_LOST/.test(n.type) ? 'signal' : isAlert(n) ? 'late' : 'done';
  return {
    id: `n:${n.id}`,
    tone,
    title,
    meta: meta || (n.readAt ? `Read ${hm(n.readAt)}` : nice(n.type)),
    code,
    at: n.sentAt,
    needsYou: isAlert(n) && !n.readAt,
    plan: text(p, 'planId'),
    vehicle,
  };
}

function fromNotice(x: Notice, trips: Trip[]): AlertRow | null {
  const p = x.payload ?? {};
  const vehicle = vehicleOf(p, undefined, trips);
  const where = [text(p, 'location'), text(p, 'note')].filter(Boolean).join(' · ');
  switch (x.event) {
    case 'signal_lost':
      return { id: `s:${x.id}`, tone: 'signal', title: `${vehicle ?? 'A vehicle'} in a signal-loss zone`, meta: where || 'Live notice', at: x.at, needsYou: true, vehicle };
    case 'signal_back':
      return { id: `s:${x.id}`, tone: 'done', title: `${vehicle ?? 'A vehicle'} has signal again`, meta: where || 'Live notice', at: x.at, needsYou: false, vehicle };
    case 'eta_update': {
      const pct = num(p, 'lateRiskPct');
      if (pct === undefined || pct < LATE_RISK) return null;
      return { id: `s:${x.id}`, tone: 'late', title: `${vehicle ?? 'A trip'} late risk ${pct}%`, meta: [text(p, 'outletId'), text(p, 'etaModel') ? `ETA ~${hm(text(p, 'etaModel'))}` : undefined].filter(Boolean).join(' · ') || 'Live notice', at: x.at, needsYou: true, vehicle };
    }
    case 'plan_published':
      return { id: `s:${x.id}`, tone: 'done', title: 'Plan published', meta: [text(p, 'depot') ? depotName(text(p, 'depot')) : undefined, text(p, 'planId') ?? text(p, 'id')].filter(Boolean).join(' · ') || 'Live notice', at: x.at, needsYou: false, plan: text(p, 'planId') ?? text(p, 'id') };
    case 'shortfall_ack':
      return { id: `s:${x.id}`, tone: 'done', title: 'Shortfall acknowledged', meta: vehicle ?? 'Live notice', code: text(p, 'orderId'), at: x.at, needsYou: false, vehicle };
    case 'trip_released':
      return { id: `s:${x.id}`, tone: 'done', title: `${vehicle ?? 'A trip'} released from the bay`, meta: where || 'Live notice', at: x.at, needsYou: false, vehicle };
    default:
      return null;
  }
}

/** Open stops of a trip at or above the late-risk threshold. */
export function lateStops(t: Trip): TripStop[] {
  return (t.stops ?? []).filter(s => s.status !== 'DELIVERED' && (s.lateRiskPct ?? 0) >= LATE_RISK);
}

/** Vehicles whose latest signal event is a loss (socket notices and notifications), with when it was lost. */
export function useSignalLost(): Map<string, string> {
  const live = useStore(notices);
  const notes = useNotifications().data;
  const routes = useLiveRoutes().data;
  return useMemo(() => {
    const trips = routes?.trips ?? [];
    const events: { vehicle: string; lost: boolean; at: string }[] = [];
    for (const x of live) {
      if (x.event !== 'signal_lost' && x.event !== 'signal_back') continue;
      const v = vehicleOf(x.payload ?? {}, undefined, trips);
      if (v) events.push({ vehicle: v, lost: x.event === 'signal_lost', at: x.at });
    }
    for (const n of notes ?? []) {
      if (n.type !== 'BLACKOUT_DETECTED' && n.type !== 'SIGNAL_BACK') continue;
      const v = vehicleOf((n.payload ?? {}) as Payload, n.tripId, trips);
      if (v) events.push({ vehicle: v, lost: n.type === 'BLACKOUT_DETECTED', at: n.sentAt });
    }
    events.sort((a, b) => a.at.localeCompare(b.at));
    const out = new Map<string, string>();
    for (const e of events) {
      if (e.lost) out.set(e.vehicle, e.at);
      else out.delete(e.vehicle);
    }
    return out;
  }, [live, notes, routes]);
}

/** Everything for DSP-27: plans awaiting approval, late-risk stops, notifications and live notices. */
export function useAlerts() {
  const claims = useClaims();
  const notes = useNotifications();
  const plans = useReviewPlans();
  const routes = useLiveRoutes();
  const live = useStore(notices);
  const rows = useMemo(() => {
    const trips = routes.data?.trips ?? [];
    const out: AlertRow[] = [];
    for (const p of plans.data ?? []) {
      out.push({
        id: `p:${p.id}`,
        tone: 'late',
        title: p.version ? `Plan v${p.version} waits for you` : 'Agent draft waits for you',
        meta: [planSource(p), depotName(p.depot), dayLabel(p.runDate)].filter(Boolean).join(' · '),
        at: p.createdAt,
        needsYou: true,
        plan: p.id,
      });
    }
    for (const t of trips) {
      for (const s of lateStops(t)) {
        out.push({
          id: `r:${s.id}`,
          tone: 'late',
          title: `${t.vehicleId} late risk ${s.lateRiskPct}%`,
          meta: [t.district, `stop ${s.stopSeq}`, s.etaModel ? `ETA ~${hm(s.etaModel)}` : undefined].filter(Boolean).join(' · '),
          code: s.outletId,
          at: s.etaModel ?? undefined,
          needsYou: true,
          vehicle: t.vehicleId,
        });
      }
    }
    for (const n of notes.data ?? []) out.push(fromNotification(n, trips));
    const seen = new Set((notes.data ?? []).map(n => n.id));
    for (const x of live) {
      if (x.event === 'notification' || seen.has(x.id)) continue;
      const r = fromNotice(x, trips);
      if (r) out.push(r);
    }
    const byTime = (a: AlertRow, b: AlertRow) => String(b.at ?? '').localeCompare(String(a.at ?? ''));
    return { needs: out.filter(r => r.needsYou).sort(byTime), handled: out.filter(r => !r.needsYou).sort(byTime) };
  }, [plans.data, routes.data, notes.data, live]);
  const loading = notes.loading || plans.loading || routes.loading;
  const hasData = notes.data !== undefined || plans.data !== undefined || routes.data !== undefined;
  const refresh = () => {
    notes.refresh();
    plans.refresh();
    routes.refresh();
  };
  return { ...rows, signedIn: !!claims, loading, hasData, date: routes.data?.date, refresh };
}

/** The number on the Alerts tab (0 = no badge). */
export function useAlertCount(): number {
  return useAlerts().needs.length;
}

/** A planning-agent run (AgentRuns): its draft lives on the run until a dispatcher approves it. */
export type AgentRunRow = {
  id: string;
  depot: Plan['depot'];
  runDate: string;
  status: string;
  planId?: string | null;
  detail?: Record<string, any> | null;
  createdAt: string;
  updatedAt?: string;
};

/** A plan waiting for the dispatcher: a Plan row, or an agent draft (`agentRunId`) shown in the same shape. */
export type ReviewPlan = Plan & { agentRunId?: string };

/** An agent run's draft as a plan awaiting approval (summary and explanation in the shapes readPlan reads). */
export function runAsPlan(r: AgentRunRow): ReviewPlan {
  const d = r.detail ?? {};
  const version = Number(d.plan?.version ?? d.version ?? 0) || 0;
  const explanation = d.explanation === undefined || d.explanation === null ? null : typeof d.explanation === 'string' ? d.explanation : JSON.stringify(d.explanation);
  return {
    id: r.id,
    agentRunId: r.id,
    depot: r.depot,
    runDate: r.runDate,
    version,
    status: 'NEEDS_APPROVAL',
    source: 'AGENT',
    createdAt: r.createdAt,
    explanation,
    summary: {
      plan: d.plan ?? null,
      ruleChecks: d.ruleChecks ?? null,
      violations: d.violations ?? null,
      deferrals: d.deferrals ?? null,
      needsReview: d.needsReview ?? null,
      contextSummary: d.contextSummary ?? null,
    },
  };
}

/**
 * A Plan row that approval can put into effect: one with drawn trips (an agent, auto-plan or manual plan). An older
 * capacity-only auto-plan has no trips (Plans/Approve answers 409 PlanNotExecutable) and is never offered.
 */
export function isExecutable(p: Pick<Plan, 'summary'>): boolean {
  const trips = (p.summary as { plan?: { trips?: unknown[] } } | null | undefined)?.plan?.trips;
  return Array.isArray(trips) && trips.length > 0;
}

/** Agent drafts waiting for approval and executable plans awaiting approval, newest first. */
export async function reviewPlans(c: ODataClient): Promise<ReviewPlan[]> {
  const [plans, runs] = await Promise.all([
    api.plansAwaitingApproval(c),
    c.list<AgentRunRow>('AgentRuns', { filter: "status eq 'NEEDS_APPROVAL'", orderby: 'createdAt desc', top: 10 }).then(r => r.value),
  ]);
  // An auto-plan is a plan version linked to the agent run that drafted it: list it once, as the run.
  const runIds = new Set(runs.map(r => r.id));
  const out: ReviewPlan[] = [...runs.map(runAsPlan), ...plans.filter(p => isExecutable(p) && !runIds.has((p as ReviewPlan).agentRunId ?? ''))];
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Everything awaiting the dispatcher's approval (DSP-27's "waits for you" rows, DSP-28, DSP-38). */
export function useReviewPlans() {
  const signedIn = !!useClaims();
  return useQuery<ReviewPlan[]>(signedIn ? 'plans.review' : null, c => reviewPlans(c));
}

/** The plan to review: route param `plan` (a plan id or an agent run id), else the newest one awaiting approval. */
export function usePlan() {
  const param = useParam('plan');
  const plans = useReviewPlans();
  const listed = param ? plans.data?.find(p => p.id === param) : plans.data?.[0];
  const id = param ?? listed?.id;
  const isRun = listed ? !!listed.agentRunId : false;
  // a fresh read: a Plan row, or the run (reading a run re-syncs it from the agent)
  const q = useQuery<ReviewPlan>(id && (listed || !plans.loading) ? `plan.${isRun ? 'run.' : ''}${id}` : null, async c => {
    if (isRun) return runAsPlan(await c.get<AgentRunRow>('AgentRuns', id!));
    try {
      return await c.get<Plan>('Plans', id!);
    } catch (e) {
      // an id from an alert may be an agent run that is not listed any more (approved or rejected meanwhile)
      const run = await c.get<AgentRunRow>('AgentRuns', id!).catch(() => null);
      if (!run) throw e;
      return { ...runAsPlan(run), status: run.status === 'NEEDS_APPROVAL' ? 'NEEDS_APPROVAL' : run.status === 'APPROVED' ? 'APPROVED' : 'REJECTED' } as ReviewPlan;
    }
  });
  const plan = q.data ?? listed ?? null;
  return { ...q, id, plan, plans };
}

/**
 * Approves a plan with the dispatcher's authority: an agent draft through AgentRuns('…')/Lodestar.Resume (planning
 * stores it as a plan version and publishes it), a Plan row through Plans('…')/Lodestar.Approve.
 */
export async function approveReview(p: ReviewPlan, overrideReason?: string): Promise<{ version?: number; planId?: string }> {
  if (p.agentRunId) {
    const run = await client.action<AgentRunRow>(`AgentRuns${key(p.agentRunId)}/Lodestar.Resume`, { decision: 'approve', ...(overrideReason ? { overrideReason } : {}) });
    return { version: p.version || undefined, planId: run?.planId ?? undefined };
  }
  const done = await api.approvePlan(client, p.id, undefined, overrideReason);
  return { version: done?.version, planId: done?.id };
}

export type PlanChange = { title: string; meta: string; code?: string; warn?: boolean };

export type PlanView = {
  /** Orders served / total, when the plan says. */
  served?: number;
  total?: number;
  deferrals: number;
  shortM3?: number;
  trips?: number;
  rulesPassed?: number;
  rulesTotal?: number;
  explanation?: string;
  changes: PlanChange[];
  review: PlanChange[];
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter(x => x && typeof x === 'object') as Obj[]) : []);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const fix1 = (v?: number) => (v === undefined ? undefined : Math.round(v * 10) / 10);

/** Reads Plan.summary / explanation (auto-plan: orders, chilled, suggestions; agent: plan, ruleChecks, deferrals, needsReview). */
export function readPlan(p: Plan | null): PlanView {
  const view: PlanView = { deferrals: 0, changes: [], review: [] };
  if (!p) return view;
  const sum = obj(p.summary) ?? {};
  // explanation: plain text, or the agent's {text, did, checked} as JSON
  let did: string[] = [];
  if (p.explanation) {
    try {
      const e = obj(JSON.parse(p.explanation));
      view.explanation = str(e?.text) ?? p.explanation;
      did = Array.isArray(e?.did) ? (e!.did as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    } catch {
      view.explanation = p.explanation;
    }
  }
  const orders = obj(sum.orders);
  if (orders) {
    view.total = n(orders.total);
    view.served = n(orders.planned);
    view.deferrals = n(orders.deferred) ?? 0;
  }
  const chilled = obj(sum.chilled);
  view.shortM3 = fix1(n(chilled?.shortM3));
  view.trips = n(sum.trips);
  const agentPlan = obj(sum.plan);
  const trips = arr(agentPlan?.trips);
  if (trips.length) {
    const assigned = trips.reduce((k, t) => k + (Array.isArray(t.orderIds) ? t.orderIds.length : 0), 0);
    const unassigned = arr(agentPlan?.unassigned).length;
    view.served = assigned;
    view.total = assigned + unassigned;
    view.trips = trips.length;
  }
  const checks = arr(sum.ruleChecks);
  if (checks.length) {
    view.rulesTotal = checks.length;
    view.rulesPassed = checks.filter(c => c.passed === true).length;
  }
  const suggestions = arr(sum.suggestions);
  const deferrals = arr(sum.deferrals).filter(d => d.suggested !== false);
  if (suggestions.length || deferrals.length) view.deferrals = Math.max(view.deferrals, suggestions.length + deferrals.length);

  // the change list: what the agent says it did, else the trips it drew, else the suggested deferrals
  if (did.length) view.changes = did.map(d => ({ title: d, meta: '' }));
  else if (trips.length)
    view.changes = trips.map(t => ({
      title: `${str(t.vehicleId) ?? 'Vehicle'} Trip ${n(t.tripNo) ?? ''}`.trim(),
      meta: [
        Array.isArray(t.orderIds) ? `${t.orderIds.length} orders` : undefined,
        n(t.m3) !== undefined ? `${fix1(n(t.m3))} m³` : undefined,
        str(t.district),
        n(t.minutes) !== undefined ? `${Math.round(n(t.minutes)!)} min` : undefined,
      ].filter(Boolean).join(' · '),
    }));
  for (const d of [...suggestions, ...deferrals]) {
    view.changes.push({
      title: `Defer ${str(d.orderId) ?? 'order'}`,
      meta: [str(d.reason) ? titleCase(str(d.reason)) : undefined, n(d.score) !== undefined ? `score ${n(d.score)}` : undefined, str(d.notes)].filter(Boolean).join(' · '),
      code: str(d.outletId),
      warn: true,
    });
  }
  view.review = arr(sum.needsReview).map(r => ({
    title: str(r.orderId) ?? 'Order',
    meta: [str(r.outletId), str(r.reason), n(r.score) !== undefined ? `score ${n(r.score)}` : undefined].filter(Boolean).join(' · ') || 'Needs your call',
  }));
  if (!view.review.length && orders && (n(orders.needsReview) ?? 0) > 0) {
    view.review = [{ title: `${n(orders.needsReview)} orders not yet planned`, meta: 'Open on desktop to place them' }];
  }
  return view;
}

/** Trip progress for the live list. */
export function tripProgress(t: Trip) {
  const stops = [...(t.stops ?? [])].sort((a, b) => a.stopSeq - b.stopSeq);
  const done = stops.filter(s => s.status === 'DELIVERED').length;
  const next = stops.find(s => s.status !== 'DELIVERED') ?? null;
  const risk = Math.max(0, ...stops.filter(s => s.status !== 'DELIVERED').map(s => s.lateRiskPct ?? 0));
  const exception = stops.some(s => s.status === 'EXCEPTION');
  return { stops, done, next, risk, exception };
}

// ---------------------------------------------------------------- DSP-32 plans (read-only on phone)

/** Depot names come from the Depots registry (model/depots); screens use useDepots() so they update on load. */
export { depotName } from './depots';

/** CAP_REEFER → CAP-REEFER (the reason code as the design prints it). */
export const reasonCode = (r: string) => r.replace(/_/g, '-');

/** The 4:00 PM (Colombo) order cut-off for a run date: 16:00 on the day before. */
export function orderCutoff(runDate: string): number {
  return Date.parse(`${addDays(runDate, -1)}T16:00:00+05:30`);
}

export type RunningPlan = {
  depot: string;
  /** The plan in effect (newest approved / published version), if any. */
  plan: Plan | null;
  /** The first approved version of the day when a later one replaced it (a re-plan). */
  base: Plan | null;
  orders: number;
  vehicles: number;
  delivered: number;
};

export type MovedOrder = Deferral & { order?: Order; outlet?: Outlet };

/** Per depot: the plan in effect for the run day and how far its trips are. */
export function runningPlans(depots: string[], plans: Plan[], trips: Trip[]): RunningPlan[] {
  return depots.map(depot => {
    const approved = plans
      .filter(p => p.depot === depot && (p.status === 'APPROVED' || p.status === 'PUBLISHED' || (p.status === 'SUPERSEDED' && !!p.approvedAt)))
      .sort((a, b) => a.version - b.version);
    const live = approved.filter(p => p.status === 'APPROVED' || p.status === 'PUBLISHED');
    const plan = live.at(-1) ?? null;
    const first = approved[0] ?? null;
    const base = plan && first && first.version < plan.version ? first : null;
    const mine = trips.filter(t => t.depot === depot);
    const stops = mine.flatMap(t => t.stops ?? []);
    return {
      depot,
      plan,
      base,
      orders: stops.length,
      vehicles: new Set(mine.map(t => t.vehicleId)).size,
      delivered: stops.filter(s => s.status === 'DELIVERED').length,
    };
  });
}

/** Orders for a run date per depot (cancelled ones left out). */
export function queueByDepot(depots: string[], orders: Pick<Order, 'status' | 'outlet'>[]): { depot: string; orders: number }[] {
  return depots.map(depot => ({ depot, orders: orders.filter(o => o.status !== 'CANCELLED' && o.outlet?.depot === depot).length }));
}

/** Everything for DSP-32: the plans in effect on the run day, what moved off it, and the queue for the next run. */
export function usePlansBoard() {
  const claims = useClaims();
  const routes = useLiveRoutes();
  const date = routes.data?.date;
  const next = date ? addDays(date, 1) : undefined;
  const signedIn = !!claims;
  const plans = useQuery<Plan[]>(signedIn && date ? `plans.running.${date}` : null, c =>
    c.all<Plan>('Plans', { filter: `${dayFilter('runDate', date!)} and (status eq 'APPROVED' or status eq 'PUBLISHED' or status eq 'SUPERSEDED')`, orderby: 'depot,version' }), { persist: true });
  const moved = useQuery<MovedOrder[]>(signedIn && date ? `deferrals.moved.${date}` : null, async c => {
    const rows = await c.all<MovedOrder>('Deferrals', { filter: `${dayFilter('order/runDate', date!)} and (status eq 'CONFIRMED' or status eq 'SUGGESTED')`, expand: 'order', orderby: 'score' });
    const ids = [...new Set(rows.map(r => r.order?.outletId).filter((x): x is string => !!x))];
    const outlets = ids.length ? await c.all<Outlet>('Outlets', { filter: inList('id', ids), select: ['id', 'name', 'depot'] }) : [];
    const byId = new Map(outlets.map(o => [o.id, o]));
    return rows.map(r => ({ ...r, outlet: byId.get(r.order?.outletId ?? '') }));
  }, { persist: true });
  const queue = useQuery<Order[]>(signedIn && next ? `orders.queue.${next}` : null, c =>
    c.all<Order>('Orders', { filter: dayFilter('runDate', next!), select: ['id', 'outletId', 'status'], expand: 'outlet($select=id,depot)' }), { persist: true });

  const depots = useMemo(() => claims?.depots ?? [], [claims?.depots]);
  const running = useMemo(() => runningPlans(depots, plans.data ?? [], routes.data?.trips ?? []), [depots, plans.data, routes.data]);
  const nextQueue = useMemo(() => (queue.data ? queueByDepot(depots, queue.data) : null), [depots, queue.data]);
  return {
    signedIn,
    date,
    next,
    running,
    moved: moved.data ?? [],
    queue: nextQueue,
    loading: routes.loading || plans.loading,
    error: routes.error ?? plans.error,
    hasData: routes.data !== undefined,
    refresh: () => {
      routes.refresh();
      plans.refresh();
      moved.refresh();
      queue.refresh();
    },
  };
}

// ---------------------------------------------------------------- directory contacts (DSP-30, DSP-31)

export type Contact = { id: string; name: string; phone?: string | null; outletId?: string | null; role?: string };

/** The active store managers of these outlets (name, phone), from the user directory, kept for offline use. */
export function useStoreManagers(outletIds: string[]) {
  const ids = [...new Set(outletIds.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return useQuery<Contact[]>(
    ids.length ? `managers.${ids.join(',')}` : null,
    c => c.all<Contact>('Users', { filter: `role eq 'STORE_MANAGER' and isActive eq true and ${inList('outletId', ids)}`, select: ['id', 'name', 'outletId', 'phone'] }),
    { persist: true },
  );
}

/**
 * "Call depot desk": someone else on the depot's desk with a phone on file (another dispatcher first, else a
 * loader of that depot), from the user directory. Null when nobody is on file.
 */
export function useDepotDesk(depot: string | null | undefined, me: string | null | undefined) {
  return useQuery<Contact | null>(
    depot ? `desk.${depot}` : null,
    async c => {
      const rows = await c.all<Contact>('Users', {
        filter: `depot eq ${lit(depot!)} and isActive eq true and (role eq 'DISPATCHER' or role eq 'LOADER')`,
        select: ['id', 'name', 'phone', 'role'],
        orderby: 'name',
      });
      const withPhone = rows.filter(r => r.id !== me && r.phone?.trim());
      return withPhone.find(r => r.role === 'DISPATCHER') ?? withPhone[0] ?? null;
    },
    { persist: true },
  );
}

/**
 * "Warn stores: possible delay": a Lodestar notice (Notifications/Lodestar.Send) to the store manager of every
 * stop of the trip not yet delivered. Resolves with the number of stores told.
 */
export async function warnStores(
  trip: Pick<Trip, 'id' | 'vehicleId'>,
  stops: Pick<TripStop, 'outletId' | 'orderId' | 'status'>[],
  managers: Contact[],
  c: ODataClient = client,
): Promise<number> {
  const open = stops.filter(s => s.status !== 'DELIVERED');
  let told = 0;
  for (const m of managers) {
    const s = open.find(x => x.outletId === m.outletId);
    if (!s) continue;
    await c.action('Notifications/Lodestar.Send', {
      recipientId: m.id,
      type: 'DISPATCH_NOTICE',
      tripId: trip.id,
      outletId: s.outletId,
      payload: {
        title: 'Order may arrive late',
        message: 'Your delivery may be late today. This is not a cancellation.',
        orderId: s.orderId,
        outletId: s.outletId,
        vehicleId: trip.vehicleId,
      },
    });
    told++;
  }
  return told;
}
