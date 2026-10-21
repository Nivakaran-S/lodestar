"""Heuristics ported from backend/apps/planning/src (TypeScript).

- deferral-scoring.service.ts -> compute_score / is_protected / is_deferral_candidate
- capacity.service.ts         -> reefer_capacity / chilled_demand
- eta.service.ts              -> service_minutes / compute_model_eta
plus the trip-minute and fuel arithmetic used by the booklet rules.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

PROTECTED_SCORE = 91
DEFERRAL_CANDIDATE_BELOW = 30
DEFAULT_SERVICE_MIN = 15
FRESH_MINUTES_BUDGET = 270
OTHER_MINUTES_BUDGET = 480
MAX_TRIPS_PER_VEHICLE = 2
INTER_STOP_KM_PER_MIN = 0.5  # used when the travel table has no inter-stop distance
DEPOT_KM_PER_MIN = 0.6  # used when the travel table has no distKm


# ---------------------------------------------------------------- time helpers
def to_min(hhmm: str | None, default: int = 0) -> int:
    if not hhmm:
        return default
    h, m = str(hhmm).split(":")[:2]
    return int(h) * 60 + int(m)


def fmt_min(total: int) -> str:
    total = max(0, int(round(total)))
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


# ---------------------------------------------------------------- scoring
def compute_score(
    *,
    deferred_yesterday: bool,
    days_since: int,
    temp_class: str,
    brand: str,
    window_open: str,
    next_run_within_24h: bool,
    stock_cover_days: float | None = None,
) -> int:
    """Port of DeferralScoringService.computeScore."""
    score = 0.0
    if deferred_yesterday:
        score += 40
    score += (days_since or 0) * 12
    if temp_class == "CHILLED":
        score += 15
    if brand == "FRESH" and to_min(window_open, 24 * 60) // 60 < 8:
        score += 10
    if next_run_within_24h:
        score -= 10
    if stock_cover_days is not None:
        score -= min(stock_cover_days * 5, 20)
    return int(max(0, score))


def is_protected(score: int) -> bool:
    return score >= PROTECTED_SCORE


def is_deferral_candidate(score: int) -> bool:
    return score < DEFERRAL_CANDIDATE_BELOW and not is_protected(score)


def order_score(order: Mapping[str, Any], outlet: Mapping[str, Any], next_run_within_24h: bool) -> int:
    return compute_score(
        deferred_yesterday=bool(order.get("deferredYesterday")),
        days_since=int(order.get("daysSince") or 0),
        temp_class=str(order.get("tempClass")),
        brand=str(order.get("brand") or outlet.get("brand")),
        window_open=str(outlet.get("windowOpen") or "23:59"),
        next_run_within_24h=next_run_within_24h,
        stock_cover_days=order.get("stockCoverDays"),
    )


def order_is_protected(order: Mapping[str, Any], outlet: Mapping[str, Any], score: int) -> bool:
    """Never defer an outlet two days running (as PlanningService does): skipped yesterday means protected today."""
    return (
        bool(order.get("deferredYesterday"))
        or is_protected(score)
        or is_protected(int(order.get("deferralScore") or 0))
        or bool(outlet.get("protected"))
    )


# ---------------------------------------------------------------- capacity
def reefer_capacity(vehicles: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    """Port of CapacityService.getReeferCapacity (available chilled vehicles)."""
    reefers = [v for v in vehicles if v.get("tempClass") == "CHILLED" and v.get("status") == "AVAILABLE"]
    return {
        "vehicles": len(reefers),
        "kg": round(sum(float(v.get("capacityKg") or 0) for v in reefers), 1),
        "m3": round(sum(float(v.get("capacityM3") or 0) for v in reefers), 1),
    }


def chilled_demand(orders: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    """Port of CapacityService.getChilledDemand."""
    chilled = [o for o in orders if o.get("tempClass") == "CHILLED" and o.get("status") not in ("DEFERRED", "EXCEPTION")]
    return {
        "orders": len(chilled),
        "kg": round(sum(float(o.get("kg") or 0) for o in chilled), 1),
        "m3": round(sum(float(o.get("m3") or 0) for o in chilled), 1),
    }


# ---------------------------------------------------------------- minutes, fuel, ETA
def service_minutes(allowances: Mapping[tuple[str, str], int], brand: str, dock_type: str) -> int:
    """Port of EtaService.getServiceMin (default 15)."""
    return int(allowances.get((brand, dock_type), DEFAULT_SERVICE_MIN))


def budget_group(brand: str) -> str:
    """The booklet's two daily time budgets per vehicle: Fresh trips share one, Style and Tech trips the other."""
    return "FRESH" if brand == "FRESH" else "STYLE_TECH"


def group_budget(group: str) -> int:
    return FRESH_MINUTES_BUDGET if group == "FRESH" else OTHER_MINUTES_BUDGET


def minutes_by_group(trips: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """A vehicle's minutes per budget group: sum of its Fresh trips, sum of its Style and Tech trips."""
    out: dict[str, int] = {}
    for t in trips:
        g = budget_group(t["brand"])
        out[g] = out.get(g, 0) + int(t.get("minutes") or 0)
    return out


def fits_budget(trips: Iterable[Mapping[str, Any]], brand: str, minutes: int) -> bool:
    """Would a trip of ``brand`` taking ``minutes`` fit the vehicle's budget for that brand's group?"""
    g = budget_group(brand)
    return minutes_by_group(trips).get(g, 0) + minutes <= group_budget(g)


def over_budget(trips: Iterable[Mapping[str, Any]]) -> list[tuple[str, int, int]]:
    """The budget groups a vehicle's trips exceed: (group, minutes used, budget)."""
    return [(g, m, group_budget(g)) for g, m in sorted(minutes_by_group(trips).items()) if m > group_budget(g)]


def minutes_budget(brands: Iterable[str]) -> int:
    """Deprecated single budget (270 if any trip is Fresh): kept for callers outside the planner; use the groups."""
    return FRESH_MINUTES_BUDGET if "FRESH" in set(brands) else OTHER_MINUTES_BUDGET


def trip_minutes(travel: Mapping[str, Any], service_mins: list[int]) -> int:
    """Booklet trip minutes: depot->district + inter-stop x (n-1) + sum(service)."""
    if not service_mins:
        return 0
    return int(travel.get("depotToDistMin") or 0) + int(travel.get("interStopMin") or 0) * (len(service_mins) - 1) + sum(service_mins)


def trip_km(travel: Mapping[str, Any], stops: int) -> float:
    dist = travel.get("distKm")
    if dist is None:
        dist = float(travel.get("depotToDistMin") or 0) * DEPOT_KM_PER_MIN
    inter_km = float(travel.get("interStopMin") or 0) * INTER_STOP_KM_PER_MIN
    return round(2 * float(dist) + inter_km * max(0, stops - 1), 1)


def trip_litres(km: float, km_per_litre: float | None) -> float:
    if not km_per_litre:
        return 0.0
    return round(km / float(km_per_litre), 1)


def compute_model_eta(*, eta_plan_min: int, road_class: str, is_monsoon: bool, window_close: str) -> dict[str, int]:
    """Port of EtaService.computeModelEta, in minutes after midnight."""
    planned_hour = (eta_plan_min // 60) % 24
    delay, band, late = 0, 15, 5
    if road_class == "hill" and is_monsoon:
        speed_index = 64 if planned_hour <= 5 else 58 if planned_hour <= 6 else 48
        delay = round((100 - speed_index) / 100 * 80)
        band = 20
        late = 20 if planned_hour < 6 else 53
    elif road_class == "urban":
        delay = 0 if planned_hour < 6 else 10
        late = 8
    elif road_class == "suburban":
        delay = 15 if is_monsoon else 5
        late = 12
    eta_model = eta_plan_min + delay
    if eta_model > to_min(window_close, 24 * 60) - 30:
        late = min(late + 30, 95)
    return {"etaModel": eta_model, "bandEarly": eta_model - band, "bandLate": eta_model + band, "lateRiskPct": late}
