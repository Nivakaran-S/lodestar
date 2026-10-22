// Realistic ETAs when a trip does not leave on time. The plan stamps each stop's model ETA, the trip's return
// and the stops' late risk for the planned departure; a van that leaves later (or has not left yet although its
// departure has passed) makes those times history. Two rules keep them honest:
//  - at the actual departure (Release, SetStatus ENROUTE) the open stops and the return move by the delay and
//    are stored, so every reader (driver, store, live ops, events) sees the same times;
//  - on read, a trip still at the dock past its departure is projected from max(planned departure, now), and
//    a trip en route with no progress yet never shows a stop before its actual departure. Nothing is written:
//    the projection is a pure function of the stored plan and the clock, so it is the same for every reader.
// Progress on the road (arrivals, departures from stops) is field-progress's job (@lodestar/security).
import { businessDateTime, toBusinessDate } from '@lodestar/platform';
import { CLOSED_STOP_STATUSES, ETA_SHIFT_MIN_MS, type ShiftedStop } from '@lodestar/security';

const MINUTE_MS = 60_000;

/** The shortest drive from the depot to a first stop: no stop is expected sooner after the van leaves. */
export const MIN_FIRST_LEG_MIN = 15;

/** The stop fields an ETA projection reads. */
export interface EtaStop {
  id: string;
  stopSeq?: number;
  orderId?: string;
  outletId?: string;
  status: string;
  etaModel?: Date | string | null;
  etaPlan?: Date | string | null;
  etaModelBandEarly?: Date | string | null;
  etaModelBandLate?: Date | string | null;
  lateRiskPct?: number | null;
  arrivalActual?: Date | string | null;
  outlet?: { windowClose?: string | null } | null;
}

export interface EtaTrip {
  id: string;
  status: string;
  departTime?: Date | string | null;
  returnTime?: Date | string | null;
  runDate: Date | string;
  stops: EtaStop[];
}

export interface StopEta {
  etaModel: Date;
  etaModelBandEarly: Date | null;
  etaModelBandLate: Date | null;
  lateRiskPct: number | null;
}

export interface TripEta {
  shiftMs: number;
  returnTime: Date | null;
  stops: Map<string, StopEta>;
}

const ms = (d: Date | string | null | undefined): number | null => {
  if (d === null || d === undefined) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
};
const plus = (d: Date | string | null | undefined, by: number): Date | null => (ms(d) === null ? null : new Date(ms(d)! + by));

/** A stop the van has still to reach. */
export const isOpenStop = (s: EtaStop) => !(CLOSED_STOP_STATUSES as readonly string[]).includes(s.status) && !s.arrivalActual;

/**
 * Late risk (0–100) of arriving at `eta` for a window closing at `windowClose` (Colombo HH:MM on the run date):
 * past the close it is all but certain, inside the last half hour it is high. A risk already higher is kept (the
 * model may know more); without a window the stored figure stands.
 */
export function windowLateRiskPct(eta: Date, runDate: Date | string, windowClose: string | null | undefined, previous: number | null | undefined): number | null {
  const prev = previous ?? null;
  if (!windowClose) return prev;
  const slackMin = (businessDateTime(toBusinessDate(runDate), windowClose).getTime() - eta.getTime()) / MINUTE_MS;
  const floor = slackMin < 0 ? 95 : slackMin < 15 ? 70 : slackMin < 30 ? 40 : 0;
  if (prev === null && floor === 0) return null;
  return Math.max(prev ?? 0, floor);
}

/**
 * How far a trip's open stops move: by the departure delay, and at least so far that the first of them is
 * MIN_FIRST_LEG_MIN after the van leaves (`start`). Whole minutes; under a minute is noise (0).
 */
export function etaShiftMs(stops: EtaStop[], start: number, delayMs: number): number {
  const etas = stops.filter(isOpenStop).map((s) => ms(s.etaModel) ?? ms(s.etaPlan)).filter((t): t is number => t !== null);
  if (!etas.length) return 0;
  const floor = start + MIN_FIRST_LEG_MIN * MINUTE_MS - Math.min(...etas);
  const shift = Math.floor(Math.max(0, delayMs, floor) / MINUTE_MS) * MINUTE_MS;
  return shift < ETA_SHIFT_MIN_MS ? 0 : shift;
}

/** The open stops and the return moved by `shiftMs`, each stop's late risk measured again against its window. */
export function shiftTrip(trip: Pick<EtaTrip, 'runDate' | 'returnTime' | 'stops'>, shiftMs: number): TripEta {
  const stops = new Map<string, StopEta>();
  if (shiftMs > 0) {
    for (const s of trip.stops.filter(isOpenStop)) {
      const base = ms(s.etaModel) ?? ms(s.etaPlan);
      if (base === null) continue;
      const etaModel = new Date(base + shiftMs);
      stops.set(s.id, {
        etaModel,
        etaModelBandEarly: plus(s.etaModelBandEarly, shiftMs),
        etaModelBandLate: plus(s.etaModelBandLate, shiftMs),
        lateRiskPct: windowLateRiskPct(etaModel, trip.runDate, s.outlet?.windowClose, s.lateRiskPct),
      });
    }
  }
  const back = shiftMs > 0 ? plus(trip.returnTime, shiftMs) : trip.returnTime ? new Date(trip.returnTime) : null;
  return { shiftMs, returnTime: back, stops };
}

/**
 * What a trip's times are at `now`, as readers should see them:
 *  - PLANNED / LOADING past its departure: as if it left now (every open stop and the return later by the wait);
 *  - ENROUTE with no stop reached yet: no stop before the actual departure plus a first leg;
 *  - otherwise (on time, under way, complete): as stored.
 */
export function projectTripEtas(trip: EtaTrip, now: Date): TripEta {
  const depart = ms(trip.departTime);
  const progressed = trip.stops.some((s) => !isOpenStop(s));
  let shift = 0;
  if (depart !== null && (trip.status === 'PLANNED' || trip.status === 'LOADING')) {
    shift = etaShiftMs(trip.stops, Math.max(depart, now.getTime()), now.getTime() - depart);
  } else if (depart !== null && trip.status === 'ENROUTE' && !progressed) {
    shift = etaShiftMs(trip.stops, depart, 0);
  }
  return shiftTrip(trip, shift);
}

/** The shifted stops as field-progress announces them (eta_update). */
export function shiftedStops(trip: Pick<EtaTrip, 'stops'>, eta: TripEta): ShiftedStop[] {
  return trip.stops.flatMap((s) => {
    const e = eta.stops.get(s.id);
    return e ? [{ stopId: s.id, stopSeq: s.stopSeq ?? 0, orderId: s.orderId ?? '', outletId: s.outletId ?? '', ...e, shiftMs: eta.shiftMs }] : [];
  });
}

/** Stop fields an ETA projection needs (Prisma select). */
export const ETA_STOP_SELECT = {
  id: true, stopSeq: true, orderId: true, outletId: true, status: true, etaModel: true, etaPlan: true,
  etaModelBandEarly: true, etaModelBandLate: true, lateRiskPct: true, arrivalActual: true,
  outlet: { select: { windowClose: true } },
} as const;

interface TripReader {
  trip: { findMany(args: any): Promise<any[]> };
}

/**
 * The live times of the given trips at `now`, for the trips whose stored times are not what readers should see
 * (still at the dock past departure, or en route without progress). Trips not in the map read as stored.
 */
export async function liveTripEtas(db: TripReader, tripIds: string[], now: Date): Promise<Map<string, TripEta>> {
  const out = new Map<string, TripEta>();
  const ids = [...new Set(tripIds.filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return out;
  const trips =
    (await db.trip.findMany({
      where: {
        id: { in: ids },
        departTime: { not: null },
        OR: [{ status: { in: ['PLANNED', 'LOADING'] }, departTime: { lt: now } }, { status: 'ENROUTE' }],
      },
      select: { id: true, status: true, departTime: true, returnTime: true, runDate: true, stops: { select: ETA_STOP_SELECT } },
    })) ?? [];
  for (const t of trips) {
    const eta = projectTripEtas(t, now);
    if (eta.shiftMs > 0) out.set(t.id, eta);
  }
  return out;
}

/** Writes a projection onto a stop row (only the fields the row was read with). */
export function overlayStop(row: Record<string, any> | null | undefined, eta: StopEta | undefined) {
  if (!row || !eta) return;
  for (const k of ['etaModel', 'etaModelBandEarly', 'etaModelBandLate', 'lateRiskPct'] as const) {
    if (k in row) row[k] = eta[k];
  }
}

/** Writes a projection onto a trip row and its expanded stops. */
export function overlayTrip(row: Record<string, any> | null | undefined, eta: TripEta | undefined) {
  if (!row || !eta) return;
  if ('returnTime' in row) row.returnTime = eta.returnTime;
  if (Array.isArray(row.stops)) for (const s of row.stops) overlayStop(s, eta.stops.get(s?.id));
}

/** A Prisma select that also reads `id` (and `extra`) at the top and inside the named relations. */
export function withKeys(select: Record<string, any> | undefined, extra: string[], relations: string[]): Record<string, any> | undefined {
  if (!select) return select;
  const out: Record<string, any> = { ...select, id: true };
  for (const k of extra) out[k] = true;
  for (const r of relations) {
    const sub = out[r];
    if (sub && typeof sub === 'object' && sub.select) out[r] = { ...sub, select: { ...sub.select, id: true } };
  }
  return out;
}
