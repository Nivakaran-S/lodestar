import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lodestar/prisma';
import { assertDepotCode, EntitySet, ODataAction, ODataEntitySet, ODataError, ODataFunction, OperationContext, WriteContext } from '@lodestar/odata';
import { canAccessDepot, HUMAN_ROLES, isPrivileged, Roles } from '@lodestar/security';
import { TripsService, VEHICLE_FAULTS, type VehicleFault } from './trips.service';
import { liveTripEtas, overlayStop, overlayTrip, withKeys } from './live-eta';

/** The clock live ETAs are read against (a seam for tests). */
export const etaClock = { now: () => new Date() };

/**
 * Trips and their stops read with live ETAs: a trip still at the dock past its departure, or en route without a
 * stop reached, shows the times of its real departure (live-eta.ts), not the plan's. Filters and sorting still
 * run on the stored times.
 */
async function liveTrips<T extends Record<string, any>>(prisma: any, rows: T[]): Promise<T[]> {
  const live = await liveTripEtas(prisma, rows.map((r) => r?.id), etaClock.now());
  if (live.size) for (const r of rows) overlayTrip(r, live.get(r?.id));
  return rows;
}

async function liveStops<T extends Record<string, any>>(prisma: any, rows: T[]): Promise<T[]> {
  const live = await liveTripEtas(prisma, rows.map((r) => r?.tripId), etaClock.now());
  if (!live.size) return rows;
  for (const r of rows) {
    const eta = live.get(r?.tripId);
    if (!eta) continue;
    overlayStop(r, eta.stops.get(r.id));
    if (r.trip && typeof r.trip === 'object') overlayTrip(r.trip, eta);
  }
  return rows;
}

const tripDepot = (depots: string[]) => ({ depot: { in: depots } });
const tripVehicle = (vehicleId: string) => ({ vehicleId });

/**
 * Trips: dispatchers/loaders see their depots, a driver the trips of the
 * vehicle in their token, a store manager trips that stop at their outlet.
 */
@Injectable()
@EntitySet({
  name: 'Trips',
  model: 'Trip',
  read: [...HUMAN_ROLES, Roles.Service],
  update: [Roles.Dispatcher, Roles.Admin],
  abac: {
    depot: tripDepot,
    vehicle: tripVehicle,
    outlet: (outletId) => ({ stops: { some: { outletId } } }),
  },
  navigation: ['vehicle', 'driver', 'stops', 'loadRecord', 'plan'],
  expandPaths: ['stops/outlet', 'stops/order', 'stops/pod'],
  search: ['id', 'district', 'vehicleId', 'sealNumber'],
  updatable: ['driverId', 'bay', 'departTime', 'planMinutes', 'tripNumber'],
  defaultOrderBy: 'runDate desc,brand,district,tripNumber',
})
export class TripsSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly trips: TripsService,
  ) {
    super(prisma);
  }

  async findMany(args: { where?: any; select?: any; orderBy?: any; skip?: number; take?: number }) {
    const rows = await super.findMany({ ...args, select: withKeys(args.select, [], ['stops']) });
    return liveTrips(this.prisma, rows ?? []);
  }

  async findFirst(args: { where?: any; select?: any }) {
    const row = await super.findFirst({ ...args, select: withKeys(args.select, [], ['stops']) });
    return row ? (await liveTrips(this.prisma, [row]))[0] : row;
  }

  /** POST Trips('…')/Lodestar.SetStatus {status, departTime?} */
  @ODataAction({
    name: 'SetStatus',
    binding: 'entity',
    roles: [Roles.Dispatcher, Roles.Loader, Roles.Driver, Roles.Admin],
    params: { status: { type: 'Lodestar.TripStatus', required: true }, departTime: 'Edm.DateTimeOffset' },
    returns: 'Lodestar.Trip',
  })
  setStatus(ctx: OperationContext) {
    return this.trips.updateStatus(ctx.entity.id, ctx.entity.status, ctx.params.status, ctx.params.departTime);
  }

  /** POST Trips('…')/Lodestar.ReportVehicleFault {fault, reeferTempC?, note?} — the vehicle can't depart (LD-B1). */
  @ODataAction({
    name: 'ReportVehicleFault',
    binding: 'entity',
    roles: [Roles.Loader, Roles.Dispatcher],
    params: { fault: { type: 'Edm.String', required: true }, reeferTempC: 'Edm.Double', note: 'Edm.String' },
    returns: 'Edm.Untyped',
  })
  reportVehicleFault(ctx: OperationContext) {
    const fault = String(ctx.params.fault ?? '').toUpperCase();
    if (!(VEHICLE_FAULTS as readonly string[]).includes(fault)) {
      throw ODataError.badRequest(`fault must be one of ${VEHICLE_FAULTS.join(', ')}`, 'fault');
    }
    const note = typeof ctx.params.note === 'string' && ctx.params.note.trim() ? ctx.params.note.trim().slice(0, 500) : undefined;
    return this.trips.reportVehicleFault(ctx.entity.id, fault as VehicleFault, ctx.principal.sub, ctx.params.reeferTempC, note);
  }

  /** POST Trips('…')/Lodestar.Release {sealNumber, reeferTempC?} — loader hands the trip to the driver. */
  @ODataAction({
    name: 'Release',
    binding: 'entity',
    roles: [Roles.Loader, Roles.Dispatcher],
    params: { sealNumber: { type: 'Edm.String', required: true }, reeferTempC: 'Edm.Double' },
    returns: 'Lodestar.Trip',
    idempotent: true,
  })
  release(ctx: OperationContext) {
    if (typeof ctx.params.sealNumber !== 'string' || !ctx.params.sealNumber.trim()) {
      throw ODataError.badRequest('sealNumber is required', 'sealNumber');
    }
    return this.trips.release(ctx.entity.id, ctx.params.sealNumber, ctx.params.reeferTempC);
  }

  /** GET Trips/Lodestar.BayQueue(depot='KANDY',runDate=2026-04-07) */
  @ODataFunction({
    name: 'BayQueue',
    binding: 'collection',
    roles: [Roles.Loader, Roles.Dispatcher, Roles.Admin],
    params: { depot: { type: 'Edm.String', required: true }, runDate: { type: 'Edm.Date', required: true } },
    returns: 'Edm.Untyped',
  })
  async bayQueue(ctx: OperationContext) {
    const depot = await assertDepotCode(this.prisma, ctx.params.depot, { active: false });
    if (!canAccessDepot(ctx.principal, depot)) throw ODataError.forbidden(`Not your depot`, 'depot');
    return this.trips.getBayQueue(depot, ctx.params.runDate, ctx.rowFilter);
  }
}

/** Trip stops, scoped through their trip (store managers: their outlet's stops). */
@Injectable()
@EntitySet({
  name: 'TripStops',
  model: 'TripStop',
  read: [...HUMAN_ROLES, Roles.Service],
  abac: {
    depot: (d) => ({ trip: { is: tripDepot(d) } }),
    vehicle: (v) => ({ trip: { is: tripVehicle(v) } }),
    outlet: (outletId) => ({ outletId }),
  },
  navigation: ['trip', 'order', 'outlet', 'pod'],
  defaultOrderBy: 'tripId,stopSeq',
})
export class TripStopsSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly trips: TripsService,
  ) {
    super(prisma);
  }

  async findMany(args: { where?: any; select?: any; orderBy?: any; skip?: number; take?: number }) {
    const rows = await super.findMany({ ...args, select: withKeys(args.select, ['tripId'], ['trip']) });
    return liveStops(this.prisma, rows ?? []);
  }

  async findFirst(args: { where?: any; select?: any }) {
    const row = await super.findFirst({ ...args, select: withKeys(args.select, ['tripId'], ['trip']) });
    return row ? (await liveStops(this.prisma, [row]))[0] : row;
  }

  /** POST TripStops('…')/Lodestar.Arrive {time?} */
  @ODataAction({
    name: 'Arrive',
    binding: 'entity',
    roles: [Roles.Driver, Roles.Dispatcher],
    params: { time: 'Edm.DateTimeOffset' },
    returns: 'Lodestar.TripStop',
  })
  arrive(ctx: OperationContext) {
    return this.trips.arrive(ctx.entity.id, ctx.params.time ?? new Date());
  }

  /** POST TripStops('…')/Lodestar.CompleteStop — POD + delivered (DRV screens). */
  @ODataAction({
    name: 'CompleteStop',
    binding: 'entity',
    roles: [Roles.Driver, Roles.Dispatcher],
    params: {
      unitsDelivered: { type: 'Edm.Int32', required: true },
      unitsOrdered: { type: 'Edm.Int32', required: true },
      receiverName: 'Edm.String',
      photoUrl: 'Edm.String',
      signature: 'Edm.String',
      exceptions: 'Collection(Edm.Untyped)',
      creditNoteId: 'Edm.String',
      savedOffline: 'Edm.Boolean',
      arrivalActual: 'Edm.DateTimeOffset',
      leaveActual: 'Edm.DateTimeOffset',
    },
    returns: 'Lodestar.TripStop',
  })
  completeStop(ctx: OperationContext) {
    return this.trips.completeStop(ctx.entity.id, ctx.entity.orderId, ctx.params as any);
  }

  /** POST TripStops('…')/Lodestar.UpdateLateRisk {lateRiskPct} */
  @ODataAction({
    name: 'UpdateLateRisk',
    binding: 'entity',
    roles: [Roles.Dispatcher, Roles.Service],
    params: { lateRiskPct: { type: 'Edm.Int32', required: true } },
    returns: 'Lodestar.TripStop',
  })
  updateLateRisk(ctx: OperationContext) {
    const pct = ctx.params.lateRiskPct as number;
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw ODataError.badRequest('lateRiskPct must be 0–100', 'lateRiskPct');
    return this.trips.updateLateRisk(ctx.entity.id, pct);
  }
}

/** Proofs of delivery (read-only; written by CompleteStop and offline sync). */
@Injectable()
@EntitySet({
  name: 'PODs',
  model: 'POD',
  read: [...HUMAN_ROLES, Roles.Service],
  abac: {
    depot: (d) => ({ tripStop: { is: { trip: { is: tripDepot(d) } } } }),
    vehicle: (v) => ({ tripStop: { is: { trip: { is: tripVehicle(v) } } } }),
    outlet: (outletId) => ({ tripStop: { is: { outletId } } }),
  },
  navigation: ['tripStop'],
  search: ['receiverName', 'creditNoteId'],
  hidden: ['signature'],
  defaultOrderBy: 'savedAt desc',
})
export class PODsSet extends ODataEntitySet {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}

/** Load records (LDR screens): loaders record the load, shortfalls and release. */
@Injectable()
@EntitySet({
  name: 'LoadRecords',
  model: 'LoadRecord',
  read: [Roles.Loader, Roles.Dispatcher, Roles.Driver, Roles.Admin, Roles.Service],
  create: [Roles.Loader, Roles.Dispatcher],
  abac: {
    depot: (d) => ({ trip: { is: tripDepot(d) } }),
    vehicle: (v) => ({ vehicleId: v }),
  },
  navigation: ['trip', 'vehicle', 'loader'],
  insertable: ['tripId', 'bay', 'reeferTempC', 'shortfalls', 'notes'],
  defaultOrderBy: 'loadedAt desc',
  // The dock tablet replays queued load records after a Wi-Fi drop.
  idempotentCreate: true,
})
export class LoadRecordsSet extends ODataEntitySet {
  constructor(
    prisma: PrismaService,
    private readonly trips: TripsService,
  ) {
    super(prisma);
  }

  /** The loader is the caller; the vehicle comes from the trip; the trip must be in the caller's depots. */
  async beforeCreate(data: Record<string, any>, ctx: WriteContext) {
    if (!data.tripId || !data.bay) throw ODataError.badRequest('tripId and bay are required');
    const trip = await this.prisma.trip.findUnique({ where: { id: data.tripId }, select: { vehicleId: true, depot: true } });
    if (!trip || (!isPrivileged(ctx.principal) && !canAccessDepot(ctx.principal, trip.depot))) {
      throw ODataError.notFound(`Trip ${data.tripId} was not found`);
    }
    return { ...data, vehicleId: trip.vehicleId, loaderId: ctx.principal.sub, loadedAt: new Date() };
  }

  /** A load record created with flags (the field app's first flag of a trip) tells dispatch, store and driver too. */
  async create(data: Record<string, any>, ctx: WriteContext) {
    const created = await super.create(data, ctx);
    await this.trips.announceShortfalls(created.tripId, [], created.shortfalls, created.loaderId);
    return created;
  }

  /** POST LoadRecords('…')/Lodestar.RecordShortfalls {shortfalls: [{item, qtyOrdered, qtyLoaded, reason}]} */
  @ODataAction({
    name: 'RecordShortfalls',
    binding: 'entity',
    roles: [Roles.Loader, Roles.Dispatcher],
    params: { shortfalls: { type: 'Collection(Edm.Untyped)', required: true } },
    returns: 'Lodestar.LoadRecord',
    idempotent: true,
  })
  recordShortfalls(ctx: OperationContext) {
    return this.trips.updateShortfalls(ctx.entity.tripId, ctx.params.shortfalls, ctx.principal.sub);
  }
}
