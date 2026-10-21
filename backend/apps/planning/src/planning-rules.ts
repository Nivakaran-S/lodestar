import type { PrismaService } from '@lodestar/prisma';
import { BUSINESS_TIME_ZONE, BUSINESS_UTC_OFFSET_MIN, minutesOfHhmm, ORDER_CUTOFF_HHMM } from '@lodestar/platform';

/**
 * The planning rules the planning service enforces, in one place, so the desk shows exactly what the code
 * uses (GET Plans/Lodestar.PlanningRules): the deferral score weights and thresholds (DeferralScoringService),
 * the late-risk alert levels, the order cut-off, the default alert rules of a dispatcher who has saved none,
 * and the validation targets of the three estimators. Measured model quality is computed from stored
 * predictions vs what happened (measureModels); nothing here is a measurement.
 */

/** Deferral score: higher = keep (DeferralScoringService.computeScore). */
export const DEFERRAL_WEIGHTS = {
  deferredYesterday: 40,
  perDaySince: 12,
  chilled: 15,
  freshBeforeOpening: 10,
  /** "before the store opens" = the outlet window opens before this hour */
  freshBeforeHour: 8,
  nextRunWithin24h: -10,
  stockCoverPerDay: -5,
  stockCoverCap: 20,
} as const;

/** Score at or above which an order is protected (never deferred). */
export const PROTECTED_SCORE = 91;
/** Score below which an order is suggested for deferral. */
export const DEFERRAL_CANDIDATE_BELOW = 30;

/** Late-risk levels: a stop at alertPct or more raises an alert; highPct or more is shown as high. */
export const LATE_RISK = { alertPct: 30, highPct: 60, thresholdOptions: [20, 30, 40, 50] } as const;

/** A vehicle's minutes, load or weekly fuel at warnPct of its limit or more shows as tight (over 100 = over). */
export const LOAD = { warnPct: 85 } as const;

/** Alert rules of a dispatcher who has not saved their own (DSP-20, DSP-33). */
export const DEFAULT_ALERT_RULES = {
  vehicleFault: { push: true, sms: true },
  lateRisk: { push: true, threshold: LATE_RISK.alertPct, risingOnly: true },
  flags: { push: true },
  silence: { push: true, call: true, minutes: 15 },
  signalZones: { alert: false },
};

/** Validation targets the estimators are held to (Datathon brief). Targets, not measurements. */
export const MODEL_TARGETS = {
  serviceTime: { metric: 'MAE', comparator: '<=', value: 4, unit: 'min a stop' },
  lateness: { metric: 'AUC', comparator: '>=', value: 0.8, unit: null },
  demand: { metric: 'WAPE', comparator: '<=', value: 12, unit: '% a week' },
} as const;

/** Weeks in the capacity outlook (CapacityService.getCapacityOutlook). */
export const OUTLOOK_WEEKS = 10;

export function planningRules() {
  return {
    cutoff: ORDER_CUTOFF_HHMM,
    timeZone: BUSINESS_TIME_ZONE,
    deferral: { weights: DEFERRAL_WEIGHTS, protectedScore: PROTECTED_SCORE, candidateBelow: DEFERRAL_CANDIDATE_BELOW },
    lateRisk: LATE_RISK,
    load: LOAD,
    alertDefaults: DEFAULT_ALERT_RULES,
    modelTargets: MODEL_TARGETS,
    outlookWeeks: OUTLOOK_WEEKS,
  };
}

// ── measured model quality ───────────────────────────────

export interface Measured {
  /** null = not measured yet */
  value: number | null;
  /** rows the figure is computed from */
  n: number;
  /** why there is no figure, when value is null */
  reason?: string;
}

export interface StopOutcome {
  serviceMinPredicted: number | null;
  lateRiskPct: number | null;
  arrivalActual: Date | null;
  leaveActual: Date | null;
  runDate: Date;
  windowClose: string;
}

/** Fewest outcomes a figure is reported from: below it a score is noise (AUC 0 from four stops), so it waits. */
export const MIN_SCORED_STOPS = 10;
export const MIN_AUC_EACH = 3;

/** Mean absolute error of predicted vs actual minutes at the stop (arrival to leave). */
export function serviceTimeMae(rows: StopOutcome[]): Measured {
  const errs = rows
    .filter((r) => r.serviceMinPredicted !== null && r.arrivalActual && r.leaveActual && r.leaveActual >= r.arrivalActual)
    .map((r) => Math.abs(r.serviceMinPredicted! - (r.leaveActual!.getTime() - r.arrivalActual!.getTime()) / 60_000));
  if (!errs.length) return { value: null, n: 0, reason: 'No stop has both a predicted and an actual service time yet' };
  if (errs.length < MIN_SCORED_STOPS) return { value: null, n: errs.length, reason: `${errs.length} stop${errs.length === 1 ? '' : 's'} with an actual service time so far; scored from ${MIN_SCORED_STOPS}` };
  return { value: Math.round((errs.reduce((s, e) => s + e, 0) / errs.length) * 10) / 10, n: errs.length };
}

/** Was the stop reached after its window closed (run date at the outlet's close, Colombo time)? */
export function arrivedLate(r: Pick<StopOutcome, 'arrivalActual' | 'runDate' | 'windowClose'>): boolean {
  const close = r.runDate.getTime() + (minutesOfHhmm(r.windowClose) - BUSINESS_UTC_OFFSET_MIN) * 60_000;
  return r.arrivalActual!.getTime() > close;
}

/** AUC of the stored late risk against whether the stop was actually late (Mann-Whitney, ties count half). */
export function latenessAuc(rows: StopOutcome[]): Measured {
  const scored = rows.filter((r) => r.lateRiskPct !== null && r.arrivalActual).map((r) => ({ p: r.lateRiskPct!, late: arrivedLate(r) }));
  const pos = scored.filter((s) => s.late);
  const neg = scored.filter((s) => !s.late);
  if (pos.length < MIN_AUC_EACH || neg.length < MIN_AUC_EACH) {
    return {
      value: null,
      n: scored.length,
      reason: scored.length ? `Needs at least ${MIN_AUC_EACH} late and ${MIN_AUC_EACH} on-time arrivals (${pos.length} late, ${neg.length} on time so far)` : 'No stop with a late risk has arrived yet',
    };
  }
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;
  return { value: Math.round((wins / (pos.length * neg.length)) * 100) / 100, n: scored.length };
}

export interface WeekOutcome {
  depot: string;
  weekStart: Date;
  forecastM3: number;
  actualM3: number;
}

/** Weighted absolute percentage error of weekly forecasts: Σ|forecast − actual| / Σ actual, in %. */
export function demandWape(rows: WeekOutcome[]): Measured {
  if (!rows.length) return { value: null, n: 0, reason: 'No stored forecast covers a week that is over yet' };
  const actual = rows.reduce((s, r) => s + r.actualM3, 0);
  if (actual <= 0) return { value: null, n: rows.length, reason: 'No volume was delivered in the forecast weeks' };
  const err = rows.reduce((s, r) => s + Math.abs(r.forecastM3 - r.actualM3), 0);
  return { value: Math.round((err / actual) * 1000) / 10, n: rows.length };
}

const WEEK_MS = 7 * 86_400_000;

/**
 * Stored weekly forecasts (DemandForecast) of weeks that are over, against the m³ the depot's orders of that
 * week (cancelled ones left out, as the outlook's history) came to. The demand model's forecasts are scored
 * when there are any; otherwise the heuristic's.
 */
export async function measureDemand(prisma: PrismaService, depots: string[] | null, at: Date = new Date()) {
  if (!prisma.demandForecast) return { source: null, measured: demandWape([]) };
  const done = new Date(at.getTime() - WEEK_MS);
  const stored = await prisma.demandForecast.findMany({
    where: { weekStart: { lte: done }, ...(depots ? { depot: { in: depots } } : {}) },
    select: { depot: true, weekStart: true, source: true, totalM3: true },
  });
  const source = stored.some((f) => f.source === 'model') ? 'model' : stored.length ? 'history-median' : null;
  const rows: WeekOutcome[] = [];
  let partial = 0;
  for (const f of stored.filter((x) => x.source === source)) {
    const runDate = { gte: f.weekStart, lt: new Date(f.weekStart.getTime() + WEEK_MS) };
    const where = { runDate, outlet: { depot: f.depot }, status: { not: 'CANCELLED' as any } };
    // A whole-week forecast is only scored against a whole week of orders: a week whose order history misses some
    // of its operating days (a demo database with a few seeded run dates) would read as a huge error that is not one.
    const [operating, recorded] = await Promise.all([
      prisma.calendar?.count ? prisma.calendar.count({ where: { date: runDate, isOperating: true } }) : Promise.resolve(0),
      prisma.order.groupBy ? prisma.order.groupBy({ by: ['runDate'], where }).then((g) => g.length) : Promise.resolve(0),
    ]);
    if (operating > 0 && recorded < operating) { partial++; continue; }
    const agg = await prisma.order.aggregate({ where, _sum: { m3: true } });
    rows.push({ depot: f.depot, weekStart: f.weekStart, forecastM3: f.totalM3, actualM3: agg._sum.m3 ?? 0 });
  }
  const measured = demandWape(rows);
  if (!rows.length && partial) {
    measured.reason = `No finished week has orders on every operating day yet (${partial} depot-week${partial === 1 ? '' : 's'} only partly recorded)`;
  }
  return { source, measured };
}

/**
 * Measured quality of the estimators over the caller's depots (null depots = all): service-time MAE and
 * lateness AUC from stops that have both a prediction and an outcome; demand WAPE from the stored weekly
 * forecasts of weeks that are over (measureDemand).
 */
export async function measureModels(prisma: PrismaService, depots: string[] | null) {
  const stops = await prisma.tripStop.findMany({
    where: { arrivalActual: { not: null }, ...(depots ? { trip: { is: { depot: { in: depots } } } } : {}) },
    select: {
      serviceMinPredicted: true, lateRiskPct: true, arrivalActual: true, leaveActual: true,
      trip: { select: { runDate: true } }, outlet: { select: { windowClose: true } },
    },
  });
  const rows: StopOutcome[] = stops.map((s) => ({
    serviceMinPredicted: s.serviceMinPredicted, lateRiskPct: s.lateRiskPct, arrivalActual: s.arrivalActual, leaveActual: s.leaveActual,
    runDate: s.trip.runDate, windowClose: s.outlet.windowClose,
  }));
  const demand = await measureDemand(prisma, depots);
  return {
    serviceTime: { target: MODEL_TARGETS.serviceTime, measured: serviceTimeMae(rows) },
    lateness: { target: MODEL_TARGETS.lateness, measured: latenessAuc(rows) },
    demand: { target: MODEL_TARGETS.demand, measured: demand.measured, source: demand.source },
  };
}
