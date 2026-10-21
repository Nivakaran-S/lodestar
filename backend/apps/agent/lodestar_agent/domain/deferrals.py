"""rank_deferrals: protected outlets are never deferred; every deferral gets a reason code."""

from __future__ import annotations

from typing import Any

from . import heuristics as h
from .context import PlanningContext
from .planner import build_trip, schedule
from .rules import check_rules

REASON_CODES = ("CAP_REEFER", "CAP_TIME", "ACCESS", "WINDOW", "FUEL", "VEH_DOWN")


def _vehicle_minutes_ok(ctx: PlanningContext, plan: dict[str, Any], trip: dict[str, Any], new_trip: dict[str, Any]) -> bool:
    others = [t for t in plan["trips"] if t["vehicleId"] == trip["vehicleId"] and t["id"] != trip["id"]]
    return h.fits_budget(others, new_trip["brand"], new_trip["minutes"])


def _try_swap(ctx: PlanningContext, plan: dict[str, Any], pid: str) -> tuple[dict[str, Any], list[str]] | None:
    """Fit protected order ``pid`` into a compatible trip, bumping the lowest-score unprotected orders."""
    for trip in sorted(plan["trips"], key=lambda t: t["id"]):
        v = ctx.vehicles[trip["vehicleId"]]
        if trip["brand"] != ctx.brand_of(pid) or trip["district"] != ctx.district_of(pid):
            continue
        if ctx.needs_reefer(pid) and v.get("tempClass") != "CHILLED":
            continue
        if ctx.needs_van(pid) and v.get("type") != "VAN":
            continue
        bumpable = sorted((o for o in trip["orderIds"] if not ctx.protected.get(o)), key=lambda o: (ctx.scores[o], o))
        for k in range(len(bumpable) + 1):
            bumped = bumpable[:k]
            keep = [o for o in trip["orderIds"] if o not in bumped] + [pid]
            trial = build_trip(ctx, trip["vehicleId"], trip["tripNo"], keep)
            if trial["kg"] > float(v.get("capacityKg") or 0) or trial["m3"] > float(v.get("capacityM3") or 0):
                continue
            if not _vehicle_minutes_ok(ctx, plan, trip, trial):
                continue
            trips = [
                {"vehicleId": t["vehicleId"], "tripNo": t["tripNo"], "orderIds": keep if t["id"] == trip["id"] else t["orderIds"]}
                for t in plan["trips"]
            ]
            candidate = schedule(ctx, {**plan, "trips": trips})
            if any(x["vehicleId"] == trip["vehicleId"] for x in check_rules(ctx, candidate)[1]):
                break  # the swap would break a hard rule (fuel, mall window, ...) on this vehicle
            return candidate, bumped
    return None


def rank_deferrals(
    ctx: PlanningContext,
    plan: dict[str, Any],
    violations: list[dict[str, Any]],
    *,
    strip_violations: bool = True,
) -> dict[str, Any]:
    """Return {plan, deferrals, needsReview, actions}."""
    actions: list[str] = []
    needs_review: list[dict[str, Any]] = []
    unassigned: dict[str, str] = {u["orderId"]: u["reason"] for u in plan.get("unassigned", [])}
    planned = {o for t in plan["trips"] for o in t["orderIds"]}
    for oid in sorted(set(ctx.orders) - planned - set(unassigned)):
        unassigned[oid] = "CAP_TIME"  # every open order is either planned, deferred or up for review

    # 1. Rule conflicts left after the redraft budget: take the orders off the plan.
    if strip_violations and violations:
        stripped: set[str] = set()
        flagged: set[str] = set()
        current = violations
        while current:  # per-vehicle rules (fuel, minutes) can move to the next trip once one is removed
            strip: set[str] = set()
            for v in current:
                for oid in v["orderIds"]:
                    if ctx.protected.get(oid):
                        if oid not in flagged:
                            flagged.add(oid)
                            needs_review.append({"orderId": oid, "reason": "PROTECTED_RULE_CONFLICT", "detail": v["detail"]})
                    elif oid not in strip:
                        strip.add(oid)
                        unassigned[oid] = v["reason"]
            if not strip:
                break
            stripped |= strip
            trips = [
                {"vehicleId": t["vehicleId"], "tripNo": t["tripNo"], "orderIds": [o for o in t["orderIds"] if o not in strip]}
                for t in plan["trips"]
            ]
            plan = schedule(ctx, {**plan, "trips": [t for t in trips if t["orderIds"]]})
            current = check_rules(ctx, plan)[1]
        if stripped:
            actions.append(f"Took {len(stripped)} order(s) off the plan that still broke a hard rule after the redraft limit.")

    # 2. Protected orders are never deferred: try to make room for them.
    for pid in sorted(o for o in unassigned if ctx.protected.get(o)):
        reason = unassigned.pop(pid)
        swapped = _try_swap(ctx, plan, pid)
        if swapped is None:
            needs_review.append({"orderId": pid, "reason": "PROTECTED_UNPLACED", "detail": f"No compatible trip has room ({reason}); dispatcher must place it"})
            continue
        plan, bumped = swapped
        for b in bumped:
            unassigned[b] = reason
        actions.append(f"Kept protected {pid} on the plan" + (f" by moving {', '.join(bumped)} to deferral candidates" if bumped else "") + ".")

    # 3. Rank the rest: lowest score is the best deferral.
    deferrals = []
    for oid, reason in unassigned.items():
        score = ctx.scores[oid]
        deferrals.append(
            {
                "orderId": oid,
                "outletId": ctx.orders[oid]["outletId"],
                "reason": reason if reason in REASON_CODES else "CAP_TIME",
                "score": score,
                "suggested": h.is_deferral_candidate(score),
                "m3": float(ctx.orders[oid].get("m3") or 0),
            }
        )
    deferrals.sort(key=lambda d: (d["score"], d["orderId"]))
    for i, d in enumerate(deferrals, start=1):
        d["rank"] = i

    plan = {**plan, "unassigned": [{"orderId": d["orderId"], "reason": d["reason"]} for d in deferrals]}
    return {"plan": plan, "deferrals": deferrals, "needsReview": needs_review, "actions": actions}
