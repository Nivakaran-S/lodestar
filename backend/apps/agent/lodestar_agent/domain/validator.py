"""Independent plan validator: every hard constraint, as stable rule codes, for any plan (drafted or edited).

It re-derives each check from the context instead of trusting how the plan was built. The eight booklet rules come
from :func:`rules.check_rules` (whose ``rule`` names the DSP screens keep using) and are mapped to codes; the
structural checks (brand/district mixing, chilled on ambient, depot scope, split / duplicate / undecided orders)
are checked here.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from . import heuristics as h
from .context import PlanningContext
from .rules import check_rules

#: legacy rule name (rules.RULES, used by the UI) -> validator code; "time" splits by brand budget below
RULE_CODE_MAP = {
    "weight": "WEIGHT_CAPACITY_EXCEEDED",
    "volume": "VOLUME_CAPACITY_EXCEEDED",
    "time": "FRESH_TIME_BUDGET_EXCEEDED",
    "trips": "TOO_MANY_TRIPS",
    "fuel": "FUEL_QUOTA_EXCEEDED",
    "van_only": "VAN_ONLY_OUTLET_ON_TRUCK",
    "mall": "MALL_ACCESS_CONFLICT",
    "window": "DELIVERY_WINDOW_CONFLICT",
}

CODES = (
    "BRAND_DISTRICT_MISMATCH",
    "CHILLED_ORDER_ON_AMBIENT_VEHICLE",
    "VAN_ONLY_OUTLET_ON_TRUCK",
    "DEPOT_MISMATCH",
    "ORDER_SPLIT",
    "WEIGHT_CAPACITY_EXCEEDED",
    "VOLUME_CAPACITY_EXCEEDED",
    "TOO_MANY_TRIPS",
    "FRESH_TIME_BUDGET_EXCEEDED",
    "STYLE_TECH_TIME_BUDGET_EXCEEDED",
    "DELIVERY_WINDOW_CONFLICT",
    "MALL_ACCESS_CONFLICT",
    "FUEL_QUOTA_EXCEEDED",
    "DUPLICATE_ORDER_ASSIGNMENT",
    "UNASSIGNED_ORDER_WITHOUT_DECISION",
)

REPAIR_HINTS = {
    "BRAND_DISTRICT_MISMATCH": "Split the trip so each carries one brand and one district.",
    "CHILLED_ORDER_ON_AMBIENT_VEHICLE": "Move the chilled order to a reefer or defer it (CAP_REEFER).",
    "VAN_ONLY_OUTLET_ON_TRUCK": "Move the van_only stop to a van or defer it (ACCESS).",
    "DEPOT_MISMATCH": "Remove the order or vehicle that belongs to another depot.",
    "ORDER_SPLIT": "Keep the whole order on one trip.",
    "WEIGHT_CAPACITY_EXCEEDED": "Move orders to a vehicle with free kg or defer the lowest-scored order.",
    "VOLUME_CAPACITY_EXCEEDED": "Move orders to a vehicle with free m3 or defer the lowest-scored order.",
    "TOO_MANY_TRIPS": "Merge into another vehicle's trip; at most 2 trips per vehicle.",
    "FRESH_TIME_BUDGET_EXCEEDED": "Shorten the Fresh day to 270 min: move or defer a stop.",
    "STYLE_TECH_TIME_BUDGET_EXCEEDED": "Shorten the Style/Tech day to 480 min: move or defer a stop.",
    "DELIVERY_WINDOW_CONFLICT": "Serve the stop earlier (another trip or vehicle) or defer it (WINDOW).",
    "MALL_ACCESS_CONFLICT": "Put the mall stop first on an earlier trip or defer it (WINDOW).",
    "FUEL_QUOTA_EXCEEDED": "Use a vehicle with weekly fuel left or defer (FUEL).",
    "DUPLICATE_ORDER_ASSIGNMENT": "Keep the order on exactly one stop.",
    "UNASSIGNED_ORDER_WITHOUT_DECISION": "Place the order or record a deferral with a reason code.",
}


def _err(code: str, message: str, order_ids: list[str], vehicle_id: str | None = None, trip_id: str | None = None, rule: str | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "rule": rule,
        "message": message,
        "order_ids": order_ids,
        "vehicle_id": vehicle_id,
        "trip_id": trip_id,
        "severity": "error",
        "repair_hint": REPAIR_HINTS[code],
    }


def validate_plan(
    ctx: PlanningContext,
    plan: dict[str, Any],
    decided: set[str] | None = None,
) -> dict[str, Any]:
    """{valid, errors, warnings, checked_rules, violated_rule_count}. ``decided`` = order ids with a recorded
    decision off the plan (deferral candidates, needs review); ``plan["unassigned"]`` counts as decided too."""
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    seen: dict[str, list[tuple[str, str]]] = defaultdict(list)  # order -> [(vehicle, trip)]
    clean_trips = []

    for trip in plan.get("trips", []):
        vid, tid = trip.get("vehicleId"), trip.get("id")
        vehicle = ctx.vehicles.get(vid)
        oids = list(trip.get("orderIds", []))
        for oid in oids:
            seen[oid].append((vid, tid))
        foreign = [o for o in oids if o not in ctx.orders]
        if vehicle is None or vehicle.get("depot", ctx.depot) != ctx.depot:
            errors.append(_err("DEPOT_MISMATCH", f"{vid} is not a vehicle of depot {ctx.depot}", oids, vid, tid))
            continue
        if foreign:
            errors.append(_err("DEPOT_MISMATCH", f"{', '.join(foreign)} not open orders of depot {ctx.depot}", foreign, vid, tid))
        known = [o for o in oids if o in ctx.orders]
        if not known:
            continue
        if vehicle.get("status", "AVAILABLE") != "AVAILABLE":
            warnings.append({"code": "VEHICLE_NOT_AVAILABLE", "message": f"{vid} is {vehicle.get('status')}", "vehicle_id": vid, "trip_id": tid, "severity": "warning"})
        brands = {ctx.brand_of(o) for o in known}
        districts = {ctx.district_of(o) for o in known}
        if len(brands) > 1 or len(districts) > 1:
            errors.append(_err("BRAND_DISTRICT_MISMATCH", f"{tid} mixes brands {sorted(brands)} / districts {sorted(districts)}", known, vid, tid))
        if vehicle.get("tempClass") != "CHILLED":
            chilled = [o for o in known if ctx.needs_reefer(o)]
            if chilled:
                errors.append(_err("CHILLED_ORDER_ON_AMBIENT_VEHICLE", f"chilled {', '.join(chilled)} on non-reefer {vid}", chilled, vid, tid))
        if len(known) == len(oids):
            clean_trips.append(trip)

    for oid, places in sorted(seen.items()):
        if len(places) > 1:
            vehicles = {v for v, _ in places}
            code = "ORDER_SPLIT" if len(vehicles) > 1 else "DUPLICATE_ORDER_ASSIGNMENT"
            errors.append(_err(code, f"{oid} is on {len(places)} stops: {', '.join(t or '?' for _, t in places)}", [oid], places[0][0], places[0][1]))

    # the booklet rules, on the trips whose vehicle and orders are in scope
    _, violations = check_rules(ctx, {**plan, "trips": clean_trips})
    for v in violations:
        code = RULE_CODE_MAP[v["rule"]]
        if v["rule"] == "time":
            code = "FRESH_TIME_BUDGET_EXCEEDED" if v.get("budgetGroup") == "FRESH" else "STYLE_TECH_TIME_BUDGET_EXCEEDED"
        errors.append(_err(code, v["detail"], list(v["orderIds"]), v["vehicleId"], v["tripId"], rule=v["rule"]))

    decided = set(decided or set()) | {u["orderId"] for u in plan.get("unassigned", [])}
    missing = sorted(set(ctx.orders) - set(seen) - decided)
    if missing:
        errors.append(_err("UNASSIGNED_ORDER_WITHOUT_DECISION", f"{len(missing)} open order(s) neither planned nor deferred: {', '.join(missing[:10])}", missing))

    violated = sorted({e["code"] for e in errors})
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "checked_rules": list(CODES),
        "violated_rule_count": len(violated),
    }


def repair_constraints(validation: dict[str, Any]) -> list[dict[str, Any]]:
    """Drafter constraints for structural errors the booklet rules do not cover (the rule ones come from
    ``rules.constraints_for``): keep the orders off the vehicle that broke them."""
    reasons = {"CHILLED_ORDER_ON_AMBIENT_VEHICLE": "CAP_REEFER", "BRAND_DISTRICT_MISMATCH": "CAP_TIME"}
    return [
        {"type": "avoid", "vehicleId": e["vehicle_id"], "orderIds": e["order_ids"], "reason": reasons[e["code"]], "rule": e["code"]}
        for e in validation["errors"]
        if e["code"] in reasons and e["vehicle_id"]
    ]
