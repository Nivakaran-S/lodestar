"""draft_plan heuristics: capacity + packing.

Packing rules the drafter enforces itself:
  chilled orders only on reefers, van_only outlets only on vans, one brand +
  one district per trip, at most 2 trips per vehicle, weight, volume, the
  daily minutes budget, the weekly fuel quota and every stop's window close
  (mall windows included), simulated with the same clock ``schedule`` uses.
  ``check_rules`` stays the authority: anything it still finds is fed back as
  constraints by the graph's bounded redraft loop (the safety net).
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from . import heuristics as h
from .context import PlanningContext
from .stop_model import apply_stop_model

Plan = dict[str, Any]


# ---------------------------------------------------------------- trip maths
def _stop_sort_key(ctx: PlanningContext, oid: str) -> tuple[int, int, str, str]:
    opens, closes = ctx.window_of(oid)
    return (h.to_min(opens), h.to_min(closes), str(ctx.outlet_of(oid)["id"]), oid)


def build_trip(ctx: PlanningContext, vehicle_id: str, trip_no: int, order_ids: list[str]) -> dict[str, Any]:
    ordered = sorted(order_ids, key=lambda o: _stop_sort_key(ctx, o))
    first = ordered[0]
    district = ctx.district_of(first)
    travel = ctx.travel_for(district)
    vehicle = ctx.vehicles[vehicle_id]
    services = [ctx.service_min(o) for o in ordered]
    km = h.trip_km(travel, len(ordered))
    return {
        "id": f"{vehicle_id}-T{trip_no}",
        "vehicleId": vehicle_id,
        "tripNo": trip_no,
        "brand": ctx.brand_of(first),
        "district": district,
        "chilled": any(ctx.needs_reefer(o) for o in ordered),
        "orderIds": ordered,
        "kg": round(sum(float(ctx.orders[o].get("kg") or 0) for o in ordered), 1),
        "m3": round(sum(float(ctx.orders[o].get("m3") or 0) for o in ordered), 2),
        "minutes": h.trip_minutes(travel, services),
        "km": km,
        "litres": h.trip_litres(km, vehicle.get("kmPerLitre")),
        "stops": [],
        "departs": None,
        "returns": None,
    }


def schedule(ctx: PlanningContext, plan: Plan) -> Plan:
    """Recompute trip metrics and clock times (departure, arrivals, model ETA)."""
    by_vehicle: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for trip in plan["trips"]:
        by_vehicle[trip["vehicleId"]].append(trip)
    trips: list[dict[str, Any]] = []
    first_dep = h.to_min(ctx.first_departure)
    monsoon = ctx.is_monsoon()
    for vid in sorted(by_vehicle):
        prev_return = 0
        for n, old in enumerate(sorted(by_vehicle[vid], key=lambda t: t["tripNo"]), start=1):
            trip = build_trip(ctx, vid, n, old["orderIds"])
            travel = ctx.travel_for(trip["district"])
            to_dist = int(travel.get("depotToDistMin") or 0)
            inter = int(travel.get("interStopMin") or 0)
            earliest_open = min(h.to_min(ctx.window_of(o)[0]) for o in trip["orderIds"])
            depart = max(first_dep, earliest_open - to_dist, prev_return)
            t = depart + to_dist
            stops = []
            for i, oid in enumerate(trip["orderIds"]):
                outlet = ctx.outlet_of(oid)
                opens, closes = ctx.window_of(oid)
                if i:
                    t += inter
                arrive = max(t, h.to_min(opens))
                eta = h.compute_model_eta(
                    eta_plan_min=arrive,
                    road_class=str(travel.get("roadClass") or ""),
                    is_monsoon=monsoon,
                    window_close=closes,
                )
                svc = ctx.service_min(oid)
                stops.append(
                    {
                        "seq": i + 1,
                        "orderId": oid,
                        "outletId": outlet["id"],
                        "dockType": outlet.get("dockType"),
                        "parking": outlet.get("parking"),
                        "window": f"{opens}-{closes}",
                        "serviceMin": svc,
                        "arrive": h.fmt_min(arrive),
                        "etaModel": h.fmt_min(eta["etaModel"]),
                        "lateRiskPct": eta["lateRiskPct"],
                        "protected": ctx.protected.get(oid, False),
                    }
                )
                t = arrive + svc
            trip["stops"] = stops
            trip["departs"] = h.fmt_min(depart)
            trip["returns"] = h.fmt_min(t + to_dist)
            prev_return = t + to_dist
            trips.append(trip)
    # the Task 1 model's service minutes, ETA and late risk per stop, one batch per draft (heuristics stay without it)
    apply_stop_model(ctx, trips)
    plan["trips"] = trips
    return plan


# ---------------------------------------------------------------- constraints
def _index_constraints(constraints: list[dict[str, Any]]) -> tuple[dict[str, dict[str, str]], set[str]]:
    avoid: dict[str, dict[str, str]] = defaultdict(dict)
    prioritise: set[str] = set()
    for c in constraints:
        if c.get("type") == "avoid":
            for oid in c.get("orderIds", []):
                avoid[oid][c["vehicleId"]] = c.get("reason", "CAP_TIME")
        elif c.get("type") == "prioritise":
            prioritise.update(c.get("orderIds", []))
    return avoid, prioritise


def _unplaced_reason(ctx: PlanningContext, oid: str, avoid: dict[str, dict[str, str]], blocked: dict[str, str] | None = None) -> str:
    if avoid.get(oid):
        return sorted(avoid[oid].values())[0]
    if blocked and oid in blocked:
        return blocked[oid]
    needs_reefer, needs_van = ctx.needs_reefer(oid), ctx.needs_van(oid)

    def compatible(v: dict[str, Any]) -> bool:
        return (not needs_reefer or v.get("tempClass") == "CHILLED") and (not needs_van or v.get("type") == "VAN")

    if not any(compatible(v) for v in ctx.available_vehicles()) and any(compatible(v) for v in ctx.vehicles.values()):
        return "VEH_DOWN"
    if needs_reefer:
        return "CAP_REEFER"
    if needs_van:
        return "ACCESS"
    return "CAP_TIME"


# ---------------------------------------------------------------- up-front rule checks while packing
def _trip_clock(ctx: PlanningContext, travel: dict[str, Any], order_ids: list[str], prev_return: int) -> tuple[bool, int]:
    """(every stop arrives by its window close, return to depot) for a tentative trip.

    The same clock as ``schedule``: stops in window order, the van leaves no earlier than the first departure, the
    earliest window less the drive out, or the vehicle's previous return, and waits at a stop until its window opens.
    """
    ordered = sorted(order_ids, key=lambda o: _stop_sort_key(ctx, o))
    to_dist = int(travel.get("depotToDistMin") or 0)
    inter = int(travel.get("interStopMin") or 0)
    earliest_open = min(h.to_min(ctx.window_of(o)[0]) for o in ordered)
    t = max(h.to_min(ctx.first_departure), earliest_open - to_dist, prev_return) + to_dist
    on_time = True
    for i, oid in enumerate(ordered):
        opens, closes = ctx.window_of(oid)
        if i:
            t += inter
        arrive = max(t, h.to_min(opens))
        if arrive > h.to_min(closes):
            on_time = False
        t = arrive + ctx.service_min(oid)
    return on_time, t + to_dist


def _fuel_left(v: dict[str, Any], litres_planned: float) -> float | None:
    """Litres of weekly quota still free after the trips already packed, or None when the vehicle has no quota."""
    quota = float(v.get("weeklyLFuel") or 0)
    if not quota:
        return None
    return quota - float(v.get("usedLThisWeek") or 0) - litres_planned


# ---------------------------------------------------------------- the drafter
class NonOperatingDay(ValueError):
    """The calendar has no run on this date."""


def draft_plan(ctx: PlanningContext, constraints: list[dict[str, Any]] | None = None, version: int = 1) -> Plan:
    if not ctx.is_operating():
        raise NonOperatingDay(f"{ctx.run_date} is not an operating day: there is no run to plan")
    constraints = constraints or []
    avoid, prioritise = _index_constraints(constraints)

    groups: dict[tuple[str, str, bool, bool], list[str]] = defaultdict(list)
    for oid in sorted(ctx.orders):
        groups[(ctx.brand_of(oid), ctx.district_of(oid), ctx.needs_reefer(oid), ctx.needs_van(oid))].append(oid)

    def group_key(item: tuple[tuple[str, str, bool, bool], list[str]]) -> tuple[Any, ...]:
        key, oids = item
        m3 = sum(float(ctx.orders[o].get("m3") or 0) for o in oids)
        earliest = min(h.to_min(ctx.window_of(o)[0]) for o in oids)
        # chilled first (scarce reefers go to chilled orders before anything else may take one), then
        # prioritised, van_only, earliest window, biggest volume
        return (not key[2], not any(o in prioritise for o in oids), not key[3], earliest, -m3, key)

    vehicle_trips: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unassigned: list[dict[str, Any]] = []
    # why an order was last turned away by an up-front rule check (FUEL / WINDOW), for its deferral reason
    blocked: dict[str, str] = {}

    for (brand, district, needs_reefer, needs_van), oids in sorted(groups.items(), key=group_key):
        travel = ctx.travel_for(district)
        remaining = sorted(oids, key=lambda o: (not ctx.protected[o], -ctx.scores[o], o))

        def candidates() -> list[dict[str, Any]]:
            out = [
                v
                for v in ctx.available_vehicles()
                if len(vehicle_trips[v["id"]]) < h.MAX_TRIPS_PER_VEHICLE
                and (not needs_reefer or v.get("tempClass") == "CHILLED")
                and (not needs_van or v.get("type") == "VAN")
            ]
            return sorted(
                out,
                key=lambda v: (
                    v.get("tempClass") == "CHILLED" and not needs_reefer,
                    v.get("type") == "VAN" and not needs_van,
                    len(vehicle_trips[v["id"]]),
                    -float(v.get("capacityM3") or 0),
                    v["id"],
                ),
            )

        while remaining:
            placed: list[str] = []
            for v in candidates():
                vid = v["id"]
                # the booklet's budgets per vehicle: Fresh trips share 270 min, Style and Tech trips 480 min
                used = h.minutes_by_group(vehicle_trips[vid]).get(h.budget_group(brand), 0)
                budget = h.group_budget(h.budget_group(brand))
                fuel_left = _fuel_left(v, sum(t["litres"] for t in vehicle_trips[vid]))
                prev_return = vehicle_trips[vid][-1]["returns"] if vehicle_trips[vid] else 0
                kg = m3 = 0.0
                services: list[int] = []
                returns = prev_return
                for oid in remaining:
                    if vid in avoid.get(oid, {}):
                        continue
                    o = ctx.orders[oid]
                    nkg, nm3 = kg + float(o.get("kg") or 0), m3 + float(o.get("m3") or 0)
                    nsvc = services + [ctx.service_min(oid)]
                    if nkg > float(v.get("capacityKg") or 0) or nm3 > float(v.get("capacityM3") or 0):
                        continue
                    if used + h.trip_minutes(travel, nsvc) > budget:
                        continue
                    # weekly fuel quota: this trip's litres (one more stop) on top of the week and the day so far
                    if fuel_left is not None and h.trip_litres(h.trip_km(travel, len(nsvc)), v.get("kmPerLitre")) > fuel_left:
                        blocked[oid] = "FUEL"
                        continue
                    # every stop of the trip (the earlier ones too) still arrives by its window close
                    on_time, nreturns = _trip_clock(ctx, travel, placed + [oid], prev_return)
                    if not on_time:
                        blocked[oid] = "WINDOW"
                        continue
                    kg, m3, services, returns = nkg, nm3, nsvc, nreturns
                    placed.append(oid)
                if placed:
                    vehicle_trips[vid].append(
                        {
                            "orderIds": placed,
                            "brand": brand,
                            "minutes": h.trip_minutes(travel, services),
                            "litres": h.trip_litres(h.trip_km(travel, len(placed)), v.get("kmPerLitre")),
                            "returns": returns,
                            "tripNo": len(vehicle_trips[vid]) + 1,
                        }
                    )
                    for oid in placed:
                        blocked.pop(oid, None)
                    break
            if not placed:
                unassigned.extend({"orderId": o, "reason": _unplaced_reason(ctx, o, avoid, blocked)} for o in remaining)
                break
            remaining = [o for o in remaining if o not in placed]

    trips = [
        {"vehicleId": vid, "tripNo": t["tripNo"], "orderIds": t["orderIds"]}
        for vid in sorted(vehicle_trips)
        for t in vehicle_trips[vid]
    ]
    plan: Plan = {"version": version, "trips": trips, "unassigned": sorted(unassigned, key=lambda u: u["orderId"])}
    return schedule(ctx, plan)


def planned_order_ids(plan: Plan) -> set[str]:
    return {oid for t in plan["trips"] for oid in t["orderIds"]}


def remove_orders(ctx: PlanningContext, plan: Plan, order_ids: set[str]) -> Plan:
    """Drop orders from trips (empty trips vanish) and reschedule."""
    trips = []
    for t in plan["trips"]:
        keep = [o for o in t["orderIds"] if o not in order_ids]
        if keep:
            trips.append({"vehicleId": t["vehicleId"], "tripNo": t["tripNo"], "orderIds": keep})
    plan = {**plan, "trips": trips}
    return schedule(ctx, plan)


# ---------------------------------------------------------------- greedy draft vs the exact allocation
def draft_best(ctx: PlanningContext, constraints: list[dict[str, Any]] | None = None, version: int = 1,
               method: str = "exact", time_limit: float = 30.0) -> Plan:
    """The greedy draft, replaced by the exact allocation (optimiser.optimise) when that one passes every booklet rule
    and serves at least as much priority. ``plan["allocation"]`` says which was kept and why."""
    from .optimiser import optimise, priority  # scipy is imported lazily, only when the exact method runs
    from .rules import check_rules

    constraints = constraints or []
    greedy = draft_plan(ctx, constraints, version)
    greedy["allocation"] = {"method": "greedy"}
    if method != "exact":
        return greedy
    avoid, prioritise = _index_constraints(constraints)
    exact = optimise(ctx, avoid, prioritise, time_limit)
    if not exact:
        greedy["allocation"]["note"] = "exact allocation unavailable (no answer in time, or no solver)"
        return greedy
    value = lambda ids: sum(priority(ctx, o, prioritise) for o in ids)  # noqa: E731
    served_greedy = planned_order_ids(greedy)
    gain = round(value(exact["served"]) - value(served_greedy), 1)
    unassigned = [{"orderId": o, "reason": _unplaced_reason(ctx, o, avoid)} for o in sorted(set(ctx.orders) - set(exact["served"]))]
    plan = schedule(ctx, {"version": version, "trips": exact["trips"], "unassigned": unassigned})
    _, violations = check_rules(ctx, plan)
    summary = {"servedGreedy": len(served_greedy), "servedExact": len(exact["served"]), "priorityGain": gain, **exact["info"]}
    if violations:
        greedy["allocation"].update(note=f"exact allocation broke {len(violations)} rule check(s) (window or mall times); greedy kept", **summary)
        return greedy
    if gain < 0 or (gain == 0 and len(plan["trips"]) >= len(greedy["trips"])):
        greedy["allocation"].update(note="greedy draft already as good", **summary)
        return greedy
    plan["allocation"] = {"method": "exact", **summary}
    return plan
