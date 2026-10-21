"""Ported heuristics, the drafter, the hard rules, deferral ranking and edits."""

from __future__ import annotations

import pytest

from lodestar_agent.domain import heuristics as h
from lodestar_agent.domain.context import PlanningContext
from lodestar_agent.domain.deferrals import rank_deferrals
from lodestar_agent.domain.edits import EditError, apply_edits
from lodestar_agent.domain.planner import draft_plan, planned_order_ids, remove_orders, schedule
from lodestar_agent.domain.rules import RULES, check_rules, constraints_for

from . import fixtures as fx


def ctx_for(data=None) -> PlanningContext:
    return PlanningContext.from_raw(data or fx.raw(), fx.DEPOT, fx.RUN_DATE)


# ---------------------------------------------------------------- heuristics (TS ports)
def test_score_matches_typescript_formula():
    base = dict(deferred_yesterday=False, days_since=0, temp_class="AMBIENT", brand="STYLE", window_open="09:00", next_run_within_24h=False)
    assert h.compute_score(**base) == 0
    assert h.compute_score(**{**base, "deferred_yesterday": True, "days_since": 2, "temp_class": "CHILLED", "brand": "FRESH", "window_open": "05:30"}) == 40 + 24 + 15 + 10
    assert h.compute_score(**{**base, "days_since": 3, "next_run_within_24h": True}) == 26
    assert h.compute_score(**{**base, "days_since": 1, "stock_cover_days": 10}) == 0  # clamped at zero, cover term capped at 20
    assert h.is_protected(91) and not h.is_protected(90)
    assert h.is_deferral_candidate(29) and not h.is_deferral_candidate(30)


def test_capacity_and_minutes():
    vehicles = [{"tempClass": "CHILLED", "status": "AVAILABLE", "capacityKg": 10, "capacityM3": 2}, {"tempClass": "CHILLED", "status": "WORKSHOP", "capacityKg": 9, "capacityM3": 9}]
    assert h.reefer_capacity(vehicles) == {"vehicles": 1, "kg": 10.0, "m3": 2.0}
    orders = [{"tempClass": "CHILLED", "status": "RECEIVED", "kg": 1, "m3": 0.5}, {"tempClass": "CHILLED", "status": "DEFERRED", "kg": 9, "m3": 9}]
    assert h.chilled_demand(orders) == {"orders": 1, "kg": 1.0, "m3": 0.5}
    travel = {"depotToDistMin": 20, "interStopMin": 10}
    assert h.trip_minutes(travel, [15, 16, 15]) == 20 + 2 * 10 + 46
    assert h.trip_minutes(travel, []) == 0
    assert h.trip_km(travel, 2) == 2 * 12 + 5  # distance estimated from minutes
    assert h.trip_litres(50, 10) == 5.0 and h.trip_litres(50, None) == 0.0
    assert h.minutes_budget(["STYLE", "FRESH"]) == 270 and h.minutes_budget(["TECH"]) == 480
    # the booklet's two budgets per vehicle: Fresh trips share 270 min, Style and Tech trips 480 min
    fresh_200 = {"brand": "FRESH", "minutes": 200}
    style_300 = {"brand": "STYLE", "minutes": 300}
    assert h.minutes_by_group([fresh_200, style_300]) == {"FRESH": 200, "STYLE_TECH": 300}
    assert h.over_budget([fresh_200, style_300]) == []  # 500 min in all, but each group is within its own budget
    assert h.fits_budget([fresh_200], "TECH", 400) and not h.fits_budget([fresh_200], "FRESH", 80)
    assert h.over_budget([fresh_200, {"brand": "FRESH", "minutes": 90}]) == [("FRESH", 290, 270)]
    assert h.service_minutes({}, "FRESH", "STREET") == h.DEFAULT_SERVICE_MIN
    assert h.fmt_min(h.to_min("03:30") + 95) == "05:05" and h.to_min(None, 7) == 7


@pytest.mark.parametrize(
    ("road", "monsoon", "arrive", "close", "delay", "risk"),
    [
        ("hill", True, h.to_min("05:10"), "08:00", 29, 20),
        ("hill", True, h.to_min("07:10"), "08:00", 42, 83),  # late risk bumped near the window close
        ("urban", False, h.to_min("05:00"), "08:00", 0, 8),
        ("urban", False, h.to_min("06:30"), "08:00", 10, 8),
        ("suburban", True, h.to_min("05:00"), "08:00", 15, 12),
        ("highway", False, h.to_min("05:00"), "08:00", 0, 5),
    ],
)
def test_model_eta_port(road, monsoon, arrive, close, delay, risk):
    eta = h.compute_model_eta(eta_plan_min=arrive, road_class=road, is_monsoon=monsoon, window_close=close)
    assert eta["etaModel"] - arrive == delay and eta["lateRiskPct"] == risk
    assert eta["bandEarly"] < eta["etaModel"] < eta["bandLate"]


# ---------------------------------------------------------------- context
def test_context_scopes_and_scores():
    ctx = ctx_for()
    assert "O-99" not in ctx.orders and "S-99" not in ctx.outlets
    assert ctx.next_run_within_24h() and ctx.is_operating() and not ctx.is_monsoon()
    assert ctx.scores["O-7"] == 40 + 36 + 15 + 10 - 10 and ctx.protected["O-7"]
    assert not ctx.protected["O-1"]
    assert ctx.travel_for("Nowhere")["depotToDistMin"] == 60
    data = fx.raw()
    data["outlets"][0]["protected"] = True
    assert ctx_for(data).protected["O-1"]


# ---------------------------------------------------------------- drafter + rules
def test_drafter_respects_packing_rules():
    ctx = ctx_for()
    plan = draft_plan(ctx)
    checks, violations = check_rules(ctx, plan)
    assert violations == [] and [c["rule"] for c in checks] == [r for r, _ in RULES]
    for t in plan["trips"]:
        v = ctx.vehicles[t["vehicleId"]]
        assert len({ctx.brand_of(o) for o in t["orderIds"]}) == 1 and len({ctx.district_of(o) for o in t["orderIds"]}) == 1
        if t["chilled"]:
            assert v["tempClass"] == "CHILLED"
    assert planned_order_ids(plan) == set(ctx.orders)
    mall = next(t for t in plan["trips"] if "O-5" in t["orderIds"])
    assert [s["orderId"] for s in mall["stops"]] == ["O-6", "O-5"]  # sorted by window
    assert mall["stops"][1]["arrive"] == "10:00"  # waits for the mall to open


def test_reefer_shortfall_leaves_chilled_orders_unplaced():
    data = fx.raw()
    data["vehicles"] = [v for v in data["vehicles"] if v["id"] in ("V-D1", "V-N1")]
    data["vehicles"] = [({**v, "capacityM3": 1.2} if v["id"] == "V-N1" else v) for v in data["vehicles"]]
    ctx = ctx_for(data)
    plan = draft_plan(ctx)
    reasons = {u["orderId"]: u["reason"] for u in plan["unassigned"]}
    assert reasons["O-1"] == "CAP_REEFER"
    assert "O-7" not in reasons  # protected goes first


def test_van_only_without_vans_is_access_or_vehicle_down():
    data = fx.raw()
    data["vehicles"] = [v for v in data["vehicles"] if v["type"] != "VAN"]
    data["orders"] = [({**o, "tempClass": "AMBIENT"} if o["id"] == "O-3" else o) for o in data["orders"]]
    assert {u["orderId"]: u["reason"] for u in draft_plan(ctx_for(data))["unassigned"]}["O-3"] == "ACCESS"
    data = fx.raw()
    data["vehicles"] = [({**v, "status": "WORKSHOP"} if v["type"] == "VAN" else v) for v in data["vehicles"]]
    assert {u["orderId"]: u["reason"] for u in draft_plan(ctx_for(data))["unassigned"]}["O-3"] == "VEH_DOWN"


def test_rule_checker_finds_each_violation():
    ctx = ctx_for()
    base = {"version": 1, "unassigned": []}
    heavy = {**base, "trips": [{"vehicleId": "V-N1", "tripNo": 1, "orderIds": ["O-1", "O-2", "O-3", "O-7"]}]}
    ctx.vehicles["V-N1"] = {**ctx.vehicles["V-N1"], "capacityKg": 100, "capacityM3": 1}
    rules = {v["rule"] for v in check_rules(ctx, schedule(ctx, heavy))[1]}
    assert {"weight", "volume"} <= rules
    wrong = {**base, "trips": [{"vehicleId": "V-R1", "tripNo": n, "orderIds": [o]} for n, o in enumerate(["O-3", "O-1", "O-2"], 1)]}
    found = {v["rule"]: v for v in check_rules(ctx, schedule(ctx, wrong))[1]}
    assert set(found) == {"van_only", "trips"}
    assert found["van_only"]["reason"] == "ACCESS"
    ctx.orders["O-5"]["kg"] = 1
    long = {**base, "trips": [{"vehicleId": "V-D1", "tripNo": 1, "orderIds": ["O-4"]}, {"vehicleId": "V-D1", "tripNo": 2, "orderIds": ["O-6", "O-5"]}]}
    # the Style trip alone runs past the Style and Tech day (480 min): a Fresh trip on the same van does not count
    ctx.allowances[("STYLE", "REAR_DOCK")] = 500
    found = {v["rule"]: v for v in check_rules(ctx, schedule(ctx, long))[1]}
    assert {"time", "mall"} <= set(found)
    assert found["time"]["budgetGroup"] == "STYLE_TECH" and "Style and Tech" in found["time"]["detail"]


def test_constraints_prioritise_then_avoid():
    v = {"rule": "mall", "vehicleId": "V-D1", "orderIds": ["O-5"], "reason": "WINDOW"}
    first = constraints_for([v], [])
    assert first == [{"type": "prioritise", "orderIds": ["O-5"], "reason": "WINDOW", "rule": "mall"}]
    second = constraints_for([v], first)
    assert second[-1]["type"] == "avoid" and second[-1]["vehicleId"] == "V-D1"


def test_avoid_constraint_moves_orders_and_reports_reason():
    ctx = ctx_for()
    plan = draft_plan(ctx, [{"type": "avoid", "vehicleId": "V-N1", "orderIds": ["O-3"], "reason": "FUEL"}])
    assert {u["orderId"]: u["reason"] for u in plan["unassigned"]} == {"O-3": "FUEL"}


# ---------------------------------------------------------------- deferrals
def test_protected_order_bumps_lowest_score_order():
    data = fx.raw()
    data["vehicles"] = [({**v, "capacityM3": 2.5} if v["id"] == "V-R1" else v) for v in data["vehicles"]]
    ctx = ctx_for(data)
    # hand-built draft: the protected O-7 was left out, the Beta reefer trip carries a low-score order
    data_orders = {**ctx.orders["O-1"], "id": "O-8", "outletId": "S-04"}
    ctx.orders["O-8"] = data_orders
    ctx.scores["O-8"], ctx.protected["O-8"] = 5, False
    plan = schedule(ctx, {"version": 1, "trips": [{"vehicleId": "V-R1", "tripNo": 1, "orderIds": ["O-8"]}], "unassigned": [{"orderId": "O-7", "reason": "CAP_REEFER"}]})
    result = rank_deferrals(ctx, plan, [])
    assert "O-7" in planned_order_ids(result["plan"])
    assert {d["orderId"]: d["reason"] for d in result["deferrals"]}["O-8"] == "CAP_REEFER"
    assert any("Kept protected O-7" in a for a in result["actions"])
    assert result["needsReview"] == []


def test_protected_conflict_and_unknown_reason():
    ctx = ctx_for()
    plan = schedule(ctx, {"version": 1, "trips": [{"vehicleId": "V-R1", "tripNo": 1, "orderIds": ["O-7"]}], "unassigned": [{"orderId": "O-4", "reason": "SOMETHING"}]})
    v = [{"rule": "fuel", "vehicleId": "V-R1", "orderIds": ["O-7"], "reason": "FUEL", "detail": "x"}]
    result = rank_deferrals(ctx, plan, v)
    assert result["needsReview"] == [{"orderId": "O-7", "reason": "PROTECTED_RULE_CONFLICT", "detail": "x"}]
    reasons = {d["orderId"]: d["reason"] for d in result["deferrals"]}
    assert reasons["O-4"] == "CAP_TIME"  # unknown codes fall back
    assert set(reasons) == set(ctx.orders) - {"O-7"}  # everything else is accounted for


# ---------------------------------------------------------------- edits
def test_edits():
    ctx = ctx_for()
    plan = draft_plan(ctx)
    moved, applied = apply_edits(ctx, plan, [{"op": "move", "orderId": "O-4", "vehicleId": "V-R1", "tripNo": 2}])
    assert applied == ["Moved O-4 to V-R1 trip 2"] and moved["version"] == 2
    assert "O-4" in next(t for t in moved["trips"] if t["id"] == "V-R1-T2")["orderIds"]
    new_trip, _ = apply_edits(ctx, remove_orders(ctx, plan, {"O-6"}), [{"op": "move", "orderId": "O-6", "vehicleId": "V-N1", "tripNo": 2}])
    assert "V-N1-T2" in {t["id"] for t in new_trip["trips"]}
    for bad, msg in [
        ({"op": "move", "orderId": "O-404", "vehicleId": "V-R1"}, "Unknown order"),
        ({"op": "move", "orderId": "O-1", "vehicleId": "V-X"}, "Unknown vehicle"),
        ({"op": "move", "orderId": "O-1", "vehicleId": "V-D1"}, "not a reefer"),
        ({"op": "move", "orderId": "O-1", "vehicleId": "V-R2"}, "not available"),
        ({"op": "defer", "orderId": "O-1"}, "reason code"),
        ({"op": "swap", "orderId": "O-1"}, "Unknown edit op"),
    ]:
        with pytest.raises(EditError, match=msg):
            apply_edits(ctx, plan, [bad])
