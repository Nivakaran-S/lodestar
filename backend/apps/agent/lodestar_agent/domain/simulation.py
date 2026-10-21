"""Deterministic dry run of a validated plan: what it serves, how full and long each trip is, fuel, late risk.

No LLM and no side effects. The figures come from the scheduled trips (planner.schedule, plus the Task 1 model's
ETA / late risk where it answered) and the vehicle rows; warnings flag what a dispatcher should look at.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from . import heuristics as h
from .context import PlanningContext

HIGH_LATE_RISK_PCT = 50
NEAR_FULL_PCT = 95
FUEL_LOW_PCT = 90


def _pct(used: float, cap: float) -> float:
    return round(100.0 * used / cap, 1) if cap else 0.0


def simulate_plan(ctx: PlanningContext, plan: dict[str, Any], deferrals: list[dict[str, Any]] | None = None, needs_review: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    deferrals = deferrals or []
    needs_review = needs_review or []
    warnings: list[dict[str, Any]] = []
    trips_out = []
    by_vehicle: dict[str, list[dict[str, Any]]] = defaultdict(list)
    risks: list[int] = []
    for t in plan.get("trips", []):
        v = ctx.vehicles.get(t["vehicleId"], {})
        by_vehicle[t["vehicleId"]].append(t)
        stop_risks = [int(s.get("lateRiskPct") or 0) for s in t.get("stops", [])]
        risks += stop_risks
        row = {
            "tripId": t["id"],
            "vehicleId": t["vehicleId"],
            "weightPct": _pct(t["kg"], float(v.get("capacityKg") or 0)),
            "volumePct": _pct(t["m3"], float(v.get("capacityM3") or 0)),
            "reeferPct": _pct(t["m3"], float(v.get("capacityM3") or 0)) if v.get("tempClass") == "CHILLED" else None,
            "minutes": t["minutes"],
            "departs": t.get("departs"),
            "returns": t.get("returns"),
            "litres": t["litres"],
            "maxLateRiskPct": max(stop_risks, default=0),
        }
        trips_out.append(row)
        late = [s["orderId"] for s in t.get("stops", []) if int(s.get("lateRiskPct") or 0) >= HIGH_LATE_RISK_PCT]
        if late:
            warnings.append({"code": "HIGH_LATE_RISK", "tripId": t["id"], "orderIds": late, "message": f"{t['id']}: {len(late)} stop(s) at >= {HIGH_LATE_RISK_PCT}% late risk"})
        for key, label in (("weightPct", "weight"), ("volumePct", "volume")):
            if row[key] >= NEAR_FULL_PCT:
                warnings.append({"code": "NEAR_CAPACITY", "tripId": t["id"], "message": f"{t['id']} at {row[key]}% {label}"})

    vehicles_out = []
    for vid, trips in sorted(by_vehicle.items()):
        v = ctx.vehicles.get(vid, {})
        by_group = h.minutes_by_group(trips)
        # the vehicle's binding budget: the group closest to its limit (Fresh 270 or Style and Tech 480)
        group = max(by_group, key=lambda g: by_group[g] / h.group_budget(g)) if by_group else "STYLE_TECH"
        minutes, budget = by_group.get(group, 0), h.group_budget(group)
        litres = round(sum(t["litres"] for t in trips), 1)
        quota = float(v.get("weeklyLFuel") or 0)
        week = float(v.get("usedLThisWeek") or 0) + litres
        vehicles_out.append({"vehicleId": vid, "trips": len(trips), "minutes": minutes, "budget": budget, "minutesByGroup": by_group, "litres": litres, "weekFuelPct": _pct(week, quota) if quota else None})
        if minutes >= budget * NEAR_FULL_PCT / 100:
            warnings.append({"code": "NEAR_TIME_BUDGET", "vehicleId": vid, "message": f"{vid} uses {minutes} of {budget} min"})
        if quota and week >= quota * FUEL_LOW_PCT / 100:
            warnings.append({"code": "FUEL_QUOTA_LOW", "vehicleId": vid, "message": f"{vid} reaches {week:.0f} of {quota:.0f} L weekly fuel"})

    summary = ctx.summary()
    dem, cap = summary["chilledDemand"], summary["reeferCapacity"]
    if dem["m3"] > cap["m3"]:
        warnings.append({"code": "REEFER_SHORTFALL", "message": f"chilled demand {dem['m3']} m3 over {cap['m3']} m3 of reefers"})
    if needs_review:
        warnings.append({"code": "PROTECTED_NEEDS_REVIEW", "orderIds": [n["orderId"] for n in needs_review], "message": f"{len(needs_review)} protected order(s) need the dispatcher"})

    served = sum(len(t["orderIds"]) for t in plan.get("trips", []))
    return {
        "served": served,
        "deferred": len(deferrals),
        "needsReview": len(needs_review),
        "openOrders": len(ctx.orders),
        "servedKg": round(sum(t["kg"] for t in plan.get("trips", [])), 1),
        "trips": trips_out,
        "vehicles": vehicles_out,
        "fuelLitres": round(sum(t["litres"] for t in plan.get("trips", [])), 1),
        "lateRisk": {"maxPct": max(risks, default=0), "avgPct": round(sum(risks) / len(risks), 1) if risks else 0.0, "highStops": sum(1 for r in risks if r >= HIGH_LATE_RISK_PCT)},
        "warnings": warnings,
    }
