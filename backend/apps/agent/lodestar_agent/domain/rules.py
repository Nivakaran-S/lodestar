"""The booklet hard rules: weight, volume, 270 min, 2 trips, fuel, van_only, mall, plus every stop's window close."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from . import heuristics as h
from .context import PlanningContext
 
RULES: list[tuple[str, str]] = [
    ("weight", "Weight within vehicle capacity (kg)"),
    ("volume", "Volume within vehicle capacity (m3)"),
    ("time", "Daily minutes within budget (270 Fresh / 480 Style-Tech)"),
    ("trips", "At most 2 trips per vehicle"),
    ("fuel", "Weekly fuel quota not exceeded"),
    ("van_only", "van_only outlets served by vans"),
    ("mall", "Mall-dock stops inside the mall window"),
    ("window", "Every stop arrives before its window closes"),
]

REASON_BY_RULE = {
    "weight": "CAP_TIME",
    "volume": "CAP_TIME",
    "time": "CAP_TIME",
    "trips": "CAP_TIME",
    "fuel": "FUEL",
    "van_only": "ACCESS",
    "mall": "WINDOW",
    "window": "WINDOW",
}


def _violation(rule: str, trip: dict[str, Any], order_ids: list[str], detail: str) -> dict[str, Any]:
    reason = REASON_BY_RULE[rule]
    if rule in ("weight", "volume") and trip.get("chilled"):
        reason = "CAP_REEFER"
    return {
        "rule": rule,
        "tripId": trip["id"],
        "vehicleId": trip["vehicleId"],
        "orderIds": order_ids,
        "reason": reason,
        "detail": detail,
    }


def check_rules(ctx: PlanningContext, plan: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (checks, violations). ``checks`` has one entry per rule, in booklet order."""
    violations: list[dict[str, Any]] = []
    by_vehicle: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for trip in plan["trips"]:
        v = ctx.vehicles[trip["vehicleId"]]
        by_vehicle[v["id"]].append(trip)
        if trip["kg"] > float(v.get("capacityKg") or 0):
            violations.append(_violation("weight", trip, trip["orderIds"], f"{trip['kg']} kg on {v['id']} (max {v.get('capacityKg')})"))
        if trip["m3"] > float(v.get("capacityM3") or 0):
            violations.append(_violation("volume", trip, trip["orderIds"], f"{trip['m3']} m3 on {v['id']} (max {v.get('capacityM3')})"))
        for stop in trip["stops"]:
            oid = stop["orderId"]
            if ctx.needs_van(oid) and v.get("type") != "VAN":
                violations.append(_violation("van_only", trip, [oid], f"{stop['outletId']} is van_only but {v['id']} is a {str(v.get('type')).lower()}"))
            close = ctx.window_of(oid)[1]
            if h.to_min(stop["arrive"]) > h.to_min(close):
                if ctx.is_mall(oid):
                    violations.append(_violation("mall", trip, [oid], f"{stop['outletId']} arrival {stop['arrive']} after mall window closes {close}"))
                else:
                    violations.append(_violation("window", trip, [oid], f"{stop['outletId']} arrival {stop['arrive']} after its window closes {close}"))

    for vid, trips in sorted(by_vehicle.items()):
        v = ctx.vehicles[vid]
        trips = sorted(trips, key=lambda t: t["tripNo"])
        last = trips[-1]
        if len(trips) > h.MAX_TRIPS_PER_VEHICLE:
            violations.append(_violation("trips", last, last["orderIds"], f"{vid} has {len(trips)} trips (max {h.MAX_TRIPS_PER_VEHICLE})"))
        for group, minutes, budget in h.over_budget(trips):
            label = "Fresh" if group == "FRESH" else "Style and Tech"
            worst = [t for t in trips if h.budget_group(t["brand"]) == group][-1]
            v_ = _violation("time", worst, worst["orderIds"], f"{vid} uses {minutes} of {budget} min on {label} trips")
            v_["budgetGroup"] = group
            violations.append(v_)
        quota = float(v.get("weeklyLFuel") or 0)
        if quota:
            litres = float(v.get("usedLThisWeek") or 0) + sum(t["litres"] for t in trips)
            if litres > quota:
                violations.append(_violation("fuel", last, last["orderIds"], f"{vid} would reach {litres:.0f} of {quota:.0f} L weekly quota"))

    checks = []
    for rule, label in RULES:
        found = [x for x in violations if x["rule"] == rule]
        checks.append({"rule": rule, "label": label, "passed": not found, "violations": len(found)})
    return checks, violations


def constraints_for(violations: list[dict[str, Any]], existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn violations into drafter constraints (avoid / prioritise)."""
    prioritised = {o for c in existing if c.get("type") == "prioritise" for o in c.get("orderIds", [])}
    new: list[dict[str, Any]] = []
    for v in violations:
        if v["rule"] == "mall" and not set(v["orderIds"]) <= prioritised:
            new.append({"type": "prioritise", "orderIds": v["orderIds"], "reason": v["reason"], "rule": v["rule"]})
        else:
            new.append({"type": "avoid", "vehicleId": v["vehicleId"], "orderIds": v["orderIds"], "reason": v["reason"], "rule": v["rule"]})
    return existing + new
