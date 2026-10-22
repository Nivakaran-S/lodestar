import type { PrismaService } from '@lodestar/prisma';
import { businessMinutesOfDay, hhmmOfMinutes, minutesOfHhmm, MlClient, MlStop, toBusinessDate } from '@lodestar/platform';

const DEFAULT_SERVICE_MIN = 15;

/**
 * The late risk (0–100) the Task 1 model gives a stop on its trip's planned schedule, or null when it cannot
 * (ML disabled or failing, or the trip has no planned times): the caller then keeps the figure it was given.
 *
 * The whole trip is scored in one call (the model reads route totals, the accumulated expected delay and replays
 * the route stop by stop); the planned leg to each stop is rebuilt from the stored plan ETAs: the first leg
 * leaves at the trip's departure, each later one when the previous stop's service allowance is over.
 */
export async function modelLateRiskPct(prisma: PrismaService, ml: MlClient, stopId: string): Promise<number | null> {
  if (!ml.enabled) return null;
  const stop = await prisma.tripStop.findUnique({ where: { id: stopId }, select: { tripId: true } });
  if (!stop) return null;
  const trip = await prisma.trip.findUnique({
    where: { id: stop.tripId },
    select: {
      id: true, depot: true, runDate: true, departTime: true, district: true,
      vehicle: { select: { id: true, type: true, tempClass: true, capacityKg: true, capacityM3: true, kmPerLitre: true, weeklyLFuel: true } },
      stops: {
        orderBy: { stopSeq: 'asc' },
        select: {
          id: true, etaPlan: true, etaModel: true,
          order: { select: { brand: true, tempClass: true, units: true, kg: true, m3: true, orderedAt: true, deferredYesterday: true } },
          outlet: { select: { id: true, brand: true, district: true, dockType: true, parking: true, mallWindow: true, windowOpen: true, windowClose: true } },
        },
      },
    },
  });
  if (!trip?.departTime || !trip.stops.length || trip.stops.some((s) => !s.etaPlan)) return null;
  const [travel, day, allowances] = await Promise.all([
    prisma.districtTravel.findUnique({ where: { district: trip.district } }),
    prisma.calendar.findUnique({ where: { date: trip.runDate } }),
    prisma.serviceAllowance.findMany(),
  ]);
  const allowance = (brand: string, dock: string) => allowances.find((a) => a.brand === brand && a.dockType === dock)?.minutes ?? DEFAULT_SERVICE_MIN;
  const runDate = toBusinessDate(trip.runDate);
  let depart = businessMinutesOfDay(trip.departTime);
  // a van that left after its plan had it at the first stop (a late release moved the stored model ETAs by the
  // delay): the planned legs start from the actual departure, so the schedule scored is the moved one
  const leftLate = new Date(trip.departTime).getTime() >= new Date(trip.stops[0].etaPlan!).getTime();
  const rows: MlStop[] = trip.stops.map((s, i) => {
    const arrive = businessMinutesOfDay(leftLate && s.etaModel ? s.etaModel : s.etaPlan!);
    const svc = allowance(s.outlet.brand, s.outlet.dockType);
    const row: MlStop = {
      stopId: s.id, routeId: trip.id, seq: i, date: runDate,
      orderDate: toBusinessDate(s.order.orderedAt), deferred: s.order.deferredYesterday,
      outletId: s.outlet.id, brand: s.order.brand, district: s.outlet.district, depot: trip.depot,
      dockType: s.outlet.dockType, parking: s.outlet.parking, mallWindow: s.outlet.mallWindow,
      windowOpen: s.outlet.windowOpen, windowClose: s.outlet.windowClose,
      tempRequirement: s.order.tempClass, units: s.order.units, kg: s.order.kg, m3: s.order.m3,
      vehicleId: trip.vehicle.id, vehicleType: trip.vehicle.type, vehicleTemp: trip.vehicle.tempClass,
      capacityKg: trip.vehicle.capacityKg, capacityM3: trip.vehicle.capacityM3, kmPerLitre: trip.vehicle.kmPerLitre,
      weeklyFuelL: trip.vehicle.weeklyLFuel,
      plannedDepart: hhmmOfMinutes(depart), plannedArrive: hhmmOfMinutes(arrive), plannedTravelMin: Math.max(0, arrive - depart),
      roadClass: travel?.roadClass ?? null, depotToDistrictKm: travel?.distKm ?? null,
      depotToDistrictMin: travel?.depotToDistMin ?? null, interStopMin: travel?.interStopMin ?? null,
      serviceAllowanceMin: svc, monsoon: day?.monsoon ? 1 : 0, isPayday: day?.isPayday ?? false, festivalRamp: day?.festivalRamp ?? 0,
    };
    depart = Math.max(arrive, minutesOfHhmm(s.outlet.windowOpen)) + svc;
    return row;
  });
  const preds = await ml.predictStops(rows);
  const p = preds?.get(stopId);
  return p ? Math.round(p.lateProb * 100) : null;
}
