import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { ODataError } from '@lodestar/odata';
import { OrderStatus, Prisma, TempClass, TripStatus } from '@prisma/client';
import { MlClient, REEFER_MAX_C, runDateRange } from '@lodestar/platform';
import {
  announceStopIssue, CLOSED_STOP_STATUSES, depotDispatchers, NOTIFY, NotifyClient, podExceptionsWithStoreCount, podOutcome, recordArrival, recordDeparture,
  linkPodPhotos, publishEtaUpdates, storeManagers,
} from '@lodestar/security';
import { FleetClient } from './fleet.client';
import { modelLateRiskPct } from './ml-late-risk';
import { ETA_STOP_SELECT, etaShiftMs, liveTripEtas, overlayTrip, shiftedStops, shiftTrip, type TripEta } from './live-eta';

/** Stored window [start, end) of a run date (YYYY-MM-DD, or a Date read in Sri Lanka time). */
export function dayRange(runDate: string | Date) {
  return runDateRange(runDate);
}

export interface PodInput {
  unitsDelivered: number;
  unitsOrdered: number;
  photoUrl?: string;
  receiverName?: string;
  signature?: string;
  exceptions?: unknown[];
  creditNoteId?: string;
  savedOffline?: boolean;
  arrivalActual?: Date;
  leaveActual?: Date;
}

/** One dock flag on a load record (LD-03): a line loaded short. */
export interface Shortfall {
  item: string;
  qtyOrdered: number;
  qtyLoaded: number;
  reason?: string;
  orderId?: string;
}

const isShortfall = (x: unknown): x is Shortfall =>
  !!x && typeof x === 'object' && typeof (x as Shortfall).item === 'string' && Number.isFinite((x as Shortfall).qtyOrdered) && Number.isFinite((x as Shortfall).qtyLoaded);

/** Flags in `current` that are new or changed since `previous` (the loader sends the trip's whole list each time). */
export function newShortfalls(previous: unknown, current: unknown): Shortfall[] {
  const key = (s: Shortfall) => `${s.item}|${s.orderId ?? ''}|${s.qtyLoaded}|${s.reason ?? ''}`;
  const seen = new Set((Array.isArray(previous) ? previous : []).filter(isShortfall).map(key));
  return (Array.isArray(current) ? current : []).filter(isShortfall).filter((s) => s.qtyLoaded < s.qtyOrdered && !seen.has(key(s)));
}

/** Used when the travel table has no distance (same constants as the planning agent's trip_km). */
const DEPOT_KM_PER_MIN = 0.6;
const INTER_STOP_KM_PER_MIN = 0.5;

/** Litres a trip burns: depot → district and back, plus the hops between its stops, at the vehicle's km/L. */
export function tripLitres(
  travel: { distKm: number | null; depotToDistMin: number; interStopMin: number } | null,
  stops: number,
  kmPerLitre: number,
): number {
  if (!travel || !(kmPerLitre > 0) || stops < 1) return 0;
  const km = 2 * (travel.distKm ?? travel.depotToDistMin * DEPOT_KM_PER_MIN) + travel.interStopMin * INTER_STOP_KM_PER_MIN * (stops - 1);
  return Math.round((km / kmPerLitre) * 10) / 10;
}

/** Allowed trip status moves: planned → loading → enroute → complete. */
const NEXT_TRIP_STATUS: Record<TripStatus, TripStatus[]> = {
  PLANNED: [TripStatus.LOADING, TripStatus.ENROUTE],
  LOADING: [TripStatus.ENROUTE, TripStatus.PLANNED],
  ENROUTE: [TripStatus.COMPLETE],
  COMPLETE: [],
};

/** What can stop a vehicle at the dock (LD-B1). */
export const VEHICLE_FAULTS = ['NOT_COOLING', 'ENGINE', 'DOOR_SEAL', 'OTHER'] as const;
export type VehicleFault = (typeof VEHICLE_FAULTS)[number];
const FAULT_LABEL: Record<VehicleFault, string> = {
  NOT_COOLING: 'Reefer not cooling', ENGINE: 'Engine fault', DOOR_SEAL: 'Door seal fault', OTHER: 'Vehicle fault',
};

/** CompleteStop's transaction (POD, stop, order): room for a remote, pooled database (Prisma's default is 5 s). */
export const STOP_TX = { timeout: 30_000, maxWait: 10_000 } as const;

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(NOTIFY) private notify: NotifyClient,
    private fleet: FleetClient,
    private ml: MlClient = new MlClient(),
  ) {}

  /** Loader: trips of a depot and run date in bay order (bay queue). */
  async getBayQueue(depot: string, runDate: string, scope?: Prisma.TripWhereInput) {
    const { start, end } = dayRange(runDate);
    const trips = await this.prisma.trip.findMany({
      where: { AND: [{ depot, runDate: { gte: start, lt: end } }, scope ?? {}] },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true } },
        stops: { select: { id: true, stopSeq: true, outletId: true, status: true, etaModel: true } },
        loadRecord: true,
      },
      orderBy: [{ bay: 'asc' }, { departTime: 'asc' }],
    });
    // a trip still at the dock past its departure shows the ETAs of leaving now, not of the plan
    const live = await liveTripEtas(this.prisma, (trips ?? []).map((t) => t.id), new Date());
    for (const t of trips ?? []) overlayTrip(t, live.get(t.id));
    return trips;
  }

  async updateStatus(id: string, current: TripStatus, status: TripStatus, departTime?: Date) {
    if (current !== status && !NEXT_TRIP_STATUS[current].includes(status)) {
      throw ODataError.conflict(`A ${current} trip cannot move to ${status}`);
    }
    // leaving the dock: the actual departure (given, else now) replaces the planned one and moves the open stops
    const departs = status === TripStatus.ENROUTE && current !== TripStatus.ENROUTE;
    const departedAt = departs ? new Date(departTime ?? Date.now()) : undefined;
    const delay = departedAt ? await this.departureDelay(this.prisma, id, departedAt) : null;
    const trip = await this.prisma.trip.update({
      where: { id },
      data: {
        status,
        ...(departedAt ? { departTime: departedAt } : departTime ? { departTime } : {}),
        ...(delay && delay.eta.shiftMs > 0 && delay.eta.returnTime ? { returnTime: delay.eta.returnTime } : {}),
        ...(status === TripStatus.COMPLETE ? { returnTime: new Date() } : {}),
      },
    });
    if (delay && trip) await this.announceDelay(trip, delay);
    if (status === TripStatus.COMPLETE && current !== TripStatus.COMPLETE) await this.consumeFuel(id);
    return trip;
  }

  /**
   * A trip leaving at `departedAt`: its open stops move by the time since the planned departure (and never sit
   * before the van leaves), each stop's late risk is measured again against its window, and the new times are
   * stored. Returns the move (with the trip's new return) for the trip update and eta_update, or null.
   */
  private async departureDelay(db: Pick<Prisma.TransactionClient, 'trip' | 'tripStop'>, tripId: string, departedAt: Date) {
    const before = await db.trip.findUnique({
      where: { id: tripId },
      select: { id: true, departTime: true, returnTime: true, runDate: true, stops: { select: ETA_STOP_SELECT, orderBy: { stopSeq: 'asc' } } },
    });
    if (!before?.stops?.length) return null;
    const planned = before.departTime ? new Date(before.departTime).getTime() : departedAt.getTime();
    const eta: TripEta = shiftTrip(before, etaShiftMs(before.stops, departedAt.getTime(), departedAt.getTime() - planned));
    for (const [stopId, e] of eta.stops) await db.tripStop.update({ where: { id: stopId }, data: e });
    return { eta, stops: shiftedStops(before, eta) };
  }

  /** The stores and live ops hear of the stops a late departure moved (eta_update, cause DEPARTURE_DELAY). */
  private async announceDelay(trip: { id: string; depot: string; vehicleId: string }, delay: { stops: ReturnType<typeof shiftedStops> }) {
    if (!delay.stops.length) return;
    await this.progress(() => publishEtaUpdates(this.notify, { id: trip.id, depot: trip.depot, vehicleId: trip.vehicleId }, delay.stops, 'DEPARTURE_DELAY'));
  }

  /** A completed trip's fuel counts against its vehicle's weekly quota (recorded by fleet, which owns Vehicle). */
  private async consumeFuel(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { vehicleId: true, district: true, vehicle: { select: { kmPerLitre: true } }, _count: { select: { stops: true } } },
    });
    if (!trip) return;
    const travel = await this.prisma.districtTravel.findUnique({ where: { district: trip.district } });
    const litres = tripLitres(travel, trip._count.stops, trip.vehicle.kmPerLitre);
    if (litres > 0) await this.fleet.recordFuel(trip.vehicleId, litres, tripId);
  }

  /**
   * Loader releases a loaded trip: seal, reefer temperature, departure. Its stops and orders go en route,
   * and the driver, the depot and the stores on the trip are told (trip_released).
   */
  async release(tripId: string, sealNumber: string, reeferTempC?: number) {
    const released = await this.prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { status: true } });
      if (!trip || !NEXT_TRIP_STATUS[trip.status].includes(TripStatus.ENROUTE)) {
        throw ODataError.conflict(`A ${trip?.status ?? 'missing'} trip cannot be released`);
      }
      const record = await tx.loadRecord.findUnique({ where: { tripId } });
      if (!record) throw ODataError.conflict('The trip has no load record yet; record the load first');
      // a reefer leaves only cold: the reading sent with the release, else the pre-cool reading on the load record
      const vehicle = await tx.vehicle.findUnique({ where: { id: record.vehicleId }, select: { tempClass: true } });
      if (vehicle?.tempClass === TempClass.CHILLED) {
        const reading = reeferTempC ?? record.reeferTempC ?? undefined;
        if (reading === undefined || reading === null) throw ODataError.conflict(`Read the reefer first: a chilled vehicle needs a reading at or below ${REEFER_MAX_C} °C to leave`);
        if (reading > REEFER_MAX_C) throw ODataError.conflict(`The reefer reads ${reading} °C, above ${REEFER_MAX_C} °C: it can't depart`);
      }
      const now = new Date();
      // left later than planned: the open stops and the return move by the delay before the trip says ENROUTE
      const delay = await this.departureDelay(tx, tripId, now);
      await tx.loadRecord.update({
        where: { tripId },
        data: { sealNumber, releasedAt: now, ...(reeferTempC !== undefined ? { reeferTempC } : {}) },
      });
      const open = { tripId, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.EXCEPTION, OrderStatus.CANCELLED] } };
      const stops = await tx.tripStop.findMany({ where: open, select: { orderId: true } });
      await tx.tripStop.updateMany({ where: open, data: { status: OrderStatus.ENROUTE } });
      await tx.order.updateMany({ where: { id: { in: stops.map((st) => st.orderId) } }, data: { status: OrderStatus.ENROUTE } });
      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: TripStatus.ENROUTE,
          sealNumber,
          departTime: now,
          ...(delay && delay.eta.shiftMs > 0 && delay.eta.returnTime ? { returnTime: delay.eta.returnTime } : {}),
          ...(reeferTempC !== undefined ? { reeferTempC } : {}),
        },
        include: { stops: { select: { outletId: true } } },
      });
      return { updated, delay };
    });
    const { stops, ...trip } = released.updated;
    const outlets = [...new Set(stops.map((st) => st.outletId))];
    const event = { tripId, vehicleId: trip.vehicleId, depot: trip.depot, bay: trip.bay, departTime: trip.departTime, sealNumber, outlets };
    if (trip.driverId) await this.notify.notice({ recipientId: trip.driverId, type: 'TRIP_RELEASED', tripId, depot: trip.depot, payload: event });
    await this.notify.publish('trip_released', [
      `trip:${tripId}`, `dispatcher:${trip.depot}`, `loader:${trip.depot}`,
      ...(trip.driverId ? [`driver:${trip.driverId}`] : []),
      ...outlets.map((o) => `store:${o}`),
    ], event);
    if (released.delay) await this.announceDelay(trip, released.delay);
    return trip;
  }

  /**
   * The loader (or dispatch) reports that a trip's vehicle cannot depart (LD-B1, reefer down): the vehicle goes
   * to the workshop in fleet, and the depot's dispatchers get a VEHICLE_FAULT notice to re-plan (DSP-B1).
   * Only before the trip leaves: a vehicle already en route is the driver's report, not the dock's.
   */
  async reportVehicleFault(tripId: string, fault: VehicleFault, reportedBy: string, reeferTempC?: number, note?: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, status: true, vehicleId: true, depot: true, bay: true, stops: { select: { outletId: true, orderId: true } } },
    });
    if (!trip) throw ODataError.notFound(`Trip ${tripId} was not found`);
    if (trip.status !== TripStatus.PLANNED && trip.status !== TripStatus.LOADING) {
      throw ODataError.conflict(`A ${trip.status} trip has already left the dock; the driver reports faults on the road`);
    }
    const workshopNote = `${FAULT_LABEL[fault]} reported at bay ${trip.bay ?? '?'}${reeferTempC !== undefined ? ` (reefer ${reeferTempC} °C)` : ''}${note ? `: ${note}` : ''}`;
    // fleet can answer late (its write committed after our timeout): the vehicle in the workshop is what counts
    const marked = (await this.fleet.setStatus(trip.vehicleId, 'WORKSHOP', workshopNote, tripId))
      || (await this.prisma.trip.findUnique({ where: { id: tripId }, select: { vehicle: { select: { status: true } } } }))?.vehicle?.status === 'WORKSHOP';
    if (!marked) throw new ODataError(502, 'FleetUnavailable', `Could not mark ${trip.vehicleId} down in fleet; try again or tell dispatch`);
    const payload = {
      tripId, vehicleId: trip.vehicleId, depot: trip.depot, bay: trip.bay, fault, reeferTempC: reeferTempC ?? null, note: note ?? null,
      reportedBy, orderIds: trip.stops.map((st) => st.orderId), outlets: [...new Set(trip.stops.map((st) => st.outletId))],
      title: `${trip.vehicleId} cannot depart: ${FAULT_LABEL[fault].toLowerCase()}`,
    };
    for (const recipientId of await depotDispatchers(this.prisma, trip.depot)) {
      await this.notify.notice({ recipientId, type: 'VEHICLE_FAULT', tripId, depot: trip.depot, payload });
    }
    await this.notify.publish('vehicle_fault', [`dispatcher:${trip.depot}`, `loader:${trip.depot}`, `trip:${tripId}`], payload);
    return { ...payload, vehicleStatus: 'WORKSHOP', workshopNote };
  }

  /**
   * The driver (or dispatch) records the arrival at a stop: the store and live ops are told (stop_arrived) and
   * the stops after it move by the delay (eta_update). A stop already closed keeps its status.
   */
  async arrive(stopId: string, at: Date) {
    const before = await this.prisma.tripStop.findUnique({ where: { id: stopId }, include: { trip: { select: { id: true, depot: true, vehicleId: true } } } });
    if (!before) throw ODataError.notFound(`Stop ${stopId} was not found`);
    const closed = (CLOSED_STOP_STATUSES as readonly string[]).includes(before.status);
    const stop = await this.prisma.tripStop.update({
      where: { id: stopId },
      data: { arrivalActual: at, ...(closed ? {} : { status: OrderStatus.ENROUTE }) },
    });
    await this.progress(() => recordArrival(this.prisma, this.notify, before.trip, before, at));
    return stop;
  }

  /**
   * Driver completes a stop: POD saved; stop and order DELIVERED, or EXCEPTION when nothing was delivered (a
   * failed stop goes to DSP-13). A store count made before the POD existed is kept on it (credit units).
   */
  async completeStop(stopId: string, orderId: string, pod: PodInput) {
    const { arrivalActual, leaveActual, ...podData } = pod;
    if (!Number.isInteger(podData.unitsDelivered) || !Number.isInteger(podData.unitsOrdered) || podData.unitsDelivered < 0 || podData.unitsDelivered > podData.unitsOrdered) {
      throw ODataError.badRequest('unitsDelivered must be between 0 and unitsOrdered', 'unitsDelivered');
    }
    const before = await this.prisma.tripStop.findUnique({
      where: { id: stopId },
      include: {
        trip: { select: { id: true, depot: true, vehicleId: true } },
        pod: { select: { exceptions: true, creditNoteId: true } },
        order: { select: { unitsReceived: true, unitsExpected: true, receiptNote: true, receivedBy: true, receiptSavedAt: true, creditNoteId: true } },
      },
    });
    const status = podOutcome(podData) === 'STOP_FAILED' ? OrderStatus.EXCEPTION : OrderStatus.DELIVERED;
    const left = leaveActual ?? new Date();
    const storeCounted = !before?.pod && !!before?.order && (before.order.unitsExpected ?? 0) > (before.order.unitsReceived ?? Infinity);
    const exceptions = podData.exceptions !== undefined || storeCounted
      ? podExceptionsWithStoreCount(podData.exceptions, before?.pod?.exceptions, before?.order)
      : undefined;
    const creditNoteId = podData.creditNoteId ?? before?.pod?.creditNoteId ?? before?.order?.creditNoteId ?? undefined;
    const data = { ...podData, exceptions: exceptions as Prisma.InputJsonValue, ...(creditNoteId ? { creditNoteId } : {}) };
    const stop = await this.prisma.$transaction(async (tx) => {
      await tx.pOD.upsert({
        where: { tripStopId: stopId },
        update: { ...data, syncedAt: podData.savedOffline ? undefined : new Date() },
        create: { tripStopId: stopId, ...data, savedAt: new Date() },
      });
      await tx.order.update({ where: { id: orderId }, data: { status } });
      return tx.tripStop.update({
        where: { id: stopId },
        data: {
          status,
          ...(arrivalActual ? { arrivalActual } : {}),
          leaveActual: left,
        },
      });
    }, STOP_TX);
    await this.announcePod(stopId, podData);
    // photos the phone uploaded before this POD (POST /media/pod-photos) now count on it
    await this.progress(() => linkPodPhotos(this.prisma, stopId));
    if (before) {
      await this.progress(async () => {
        // an arrival sent with the POD (no Arrive call before) moves the later stops first
        if (arrivalActual && !before.arrivalActual) await recordArrival(this.prisma, this.notify, before.trip, before, arrivalActual);
        await recordDeparture(this.prisma, this.notify, before.trip, { ...before, arrivalActual: before.arrivalActual ?? arrivalActual ?? null }, left, {
          status, unitsDelivered: podData.unitsDelivered, unitsOrdered: podData.unitsOrdered,
        });
      });
    }
    return stop;
  }

  /** Live progress (events and the ETAs of later stops) is best effort: the stop itself has been recorded. */
  private async progress(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`Stop progress not announced: ${(e as Error).message}`);
    }
  }

  /** A failed stop or a POD exception reaches the depot's dispatchers and the store (DSP-13, DSP-04, SM-21). */
  private async announcePod(stopId: string, pod: Omit<PodInput, 'arrivalActual' | 'leaveActual'>) {
    const type = podOutcome(pod);
    if (!type) return;
    const stop = await this.prisma.tripStop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, stopSeq: true, orderId: true, outletId: true, trip: { select: { depot: true, vehicleId: true } } },
    });
    if (!stop) return;
    const short = pod.unitsOrdered - pod.unitsDelivered;
    await announceStopIssue(this.prisma, this.notify, type, {
      tripId: stop.tripId, stopId: stop.id, stopSeq: stop.stopSeq, orderId: stop.orderId, outletId: stop.outletId, depot: stop.trip.depot, vehicleId: stop.trip.vehicleId,
    }, {
      title: type === 'STOP_FAILED' ? `${stop.outletId}: nothing delivered` : `${stop.orderId}: ${pod.unitsDelivered} of ${pod.unitsOrdered} delivered`,
      unitsDelivered: pod.unitsDelivered,
      unitsOrdered: pod.unitsOrdered,
      short,
      exceptions: Array.isArray(pod.exceptions) ? pod.exceptions : [],
      ...(pod.creditNoteId ? { creditNoteId: pod.creditNoteId } : {}),
    });
  }

  /**
   * Blackout: update late risk for a stop (DSP-A1). When the ML service answers, the Task 1 model's late risk of
   * the stop on its planned schedule is the floor: the reported figure (what the road says now) can raise it,
   * never lower it below what the model expects anyway. Without the model the reported figure is stored as given.
   */
  async updateLateRisk(stopId: string, lateRiskPct: number) {
    const modelPct = await modelLateRiskPct(this.prisma, this.ml, stopId).catch((e) => {
      this.logger.warn(`Model late risk not used for ${stopId}: ${(e as Error).message}`);
      return null;
    });
    const pct = modelPct === null ? lateRiskPct : Math.max(lateRiskPct, modelPct);
    return this.prisma.tripStop.update({ where: { id: stopId }, data: { lateRiskPct: pct } });
  }

  async updateShortfalls(tripId: string, shortfalls: unknown[], flaggedBy?: string) {
    const before = await this.prisma.loadRecord.findUnique({ where: { tripId }, select: { shortfalls: true } });
    const record = await this.prisma.loadRecord.update({ where: { tripId }, data: { shortfalls: shortfalls as Prisma.InputJsonValue } });
    await this.announceShortfalls(tripId, before?.shortfalls, shortfalls, flaggedBy ?? record.loaderId);
    return record;
  }

  /**
   * New or changed dock flags (LD-03 "Flag sent to dispatch, store and driver"): a SHORTFALL_FLAGGED notice to
   * the depot's dispatchers (DSP-13, where marking it handled acknowledges it), to the managers of the store
   * whose order is short, and to the trip's driver.
   */
  async announceShortfalls(tripId: string, previous: unknown, current: unknown, loaderId?: string | null) {
    const fresh = newShortfalls(previous, current);
    if (!fresh.length) return;
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { depot: true, vehicleId: true, bay: true, driverId: true, stops: { select: { orderId: true, outletId: true } } },
    });
    if (!trip) return;
    const outletOf = new Map(trip.stops.map((st) => [st.orderId, st.outletId]));
    const dispatchers = await depotDispatchers(this.prisma, trip.depot);
    const managers = await storeManagers(this.prisma, fresh.flatMap((f) => (f.orderId && outletOf.get(f.orderId)) || []));
    for (const f of fresh) {
      const outletId = f.orderId ? outletOf.get(f.orderId) : undefined;
      const payload = {
        tripId, vehicleId: trip.vehicleId, depot: trip.depot, bay: trip.bay, loaderId: loaderId ?? null,
        item: f.item, orderId: f.orderId ?? null, outletId: outletId ?? null,
        qtyOrdered: f.qtyOrdered, qtyLoaded: f.qtyLoaded, short: f.qtyOrdered - f.qtyLoaded, reason: f.reason ?? null,
        title: `Shortfall: ${f.item} ${f.qtyLoaded} of ${f.qtyOrdered}`,
      };
      const notice = { type: 'SHORTFALL_FLAGGED', tripId, payload };
      for (const recipientId of dispatchers) await this.notify.notice({ ...notice, recipientId });
      for (const m of managers.filter((x) => x.outletId === outletId)) await this.notify.notice({ ...notice, recipientId: m.id, outletId: m.outletId });
      if (trip.driverId) await this.notify.notice({ ...notice, recipientId: trip.driverId });
    }
  }
}
