"""Allocation invariants: whatever the day looks like, the final draft never breaks a hard constraint.

Each test drafts many seeded synthetic worlds (made-up values only: mixed brands, districts, reefers, vans,
van_only and mall outlets, fuel-starved and workshop vehicles, other-depot vehicles and outlets, and more demand
than the fleet can carry) through the real pipeline, then checks ONE constraint independently of ``check_rules``,
straight from the raw rows. The last test is the over-capacity day: every order is served or deferred with a reason.
"""

from __future__ import annotations

import random
from typing import Any

import pytest

from lodestar_agent.domain import heuristics as h
from lodestar_agent.domain.context import PlanningContext
from lodestar_agent.domain.deferrals import REASON_CODES
from lodestar_agent.domain.planner import planned_order_ids, schedule
from lodestar_agent.domain.rules import check_rules
from lodestar_agent.domain.validator import validate_plan

from . import fixtures as fx
from .test_constraints import TRAVEL, run_pipeline, world

SEEDS = range(25)
DISTRICTS = ["Alpha", "Beta", "Gamma", "Remote"]


def _random_world(seed: int) -> dict[str, list[dict[str, Any]]]:
    rnd = random.Random(seed)
    outlets = []
    for i in range(12):
        brand = rnd.choice(["FRESH", "STYLE"])
        kind = rnd.choice(["NORMAL", "NORMAL", "VAN_ONLY", "MALL"])
        open_h = rnd.randint(4, 10)
        extra: dict[str, Any] = {}
        if kind == "MALL":
            extra["mallWindow"] = f"{open_h + 1:02d}:00-{open_h + 2:02d}:{rnd.choice(['00', '30'])}"
        outlets.append(
            fx.outlet(
                f"O{i}",
                brand,
                rnd.choice(DISTRICTS),
                "MALL_BAY" if kind == "MALL" else rnd.choice(["REAR_DOCK", "STREET"]),
                "MALL_DOCK" if kind == "MALL" else kind,
                f"{open_h:02d}:00",
                f"{open_h + rnd.randint(1, 8):02d}:00",
                **extra,
            )
        )
    away_outlet = {**fx.outlet("OX", "STYLE", "Alpha", "REAR_DOCK", "NORMAL", "05:00", "20:00"), "depot": fx.OTHER_DEPOT}
    vehicles = [
        fx.vehicle("V-C1", "TRUCK", "CHILLED", 900, 3, 6, 400, rnd.randint(0, 380)),
        fx.vehicle("V-C2", "VAN", "CHILLED", 400, 1.5, 9, 300, 0, status=rnd.choice(["AVAILABLE", "WORKSHOP"])),
        fx.vehicle("V-A1", "TRUCK", "AMBIENT", 2000, 10, 5, 500, rnd.randint(0, 480)),
        fx.vehicle("V-A2", "TRUCK", "AMBIENT", 1500, 8, 5, 500, 0),
        fx.vehicle("V-V1", "VAN", "AMBIENT", 500, 2.5, 10, 300, rnd.randint(0, 290)),
        {**fx.vehicle("V-X1", "TRUCK", "CHILLED", 9000, 60, 5, 900, 0), "depot": fx.OTHER_DEPOT},
    ]
    orders = []
    for i in range(40):  # far more than five vehicles x two trips can carry
        o = rnd.choice(outlets)
        orders.append(fx.order(f"R{i:02d}", o["id"], o["brand"], rnd.choice(["CHILLED", "AMBIENT"]), rnd.randint(20, 600), round(rnd.uniform(0.2, 2.5), 1)))
    orders.append(fx.order("RX", "OX", "STYLE", "AMBIENT", 50, 0.5))
    return world(
        outlets=outlets + [away_outlet],
        vehicles=vehicles,
        orders=orders,
        travel=TRAVEL,
        serviceAllowances=[
            {"brand": "FRESH", "dockType": "REAR_DOCK", "minutes": 15},
            {"brand": "FRESH", "dockType": "MALL_BAY", "minutes": 25},
            {"brand": "STYLE", "dockType": "MALL_BAY", "minutes": 30},
            {"brand": "STYLE", "dockType": "REAR_DOCK", "minutes": 35},
        ],
    )


def _solve(seed: int) -> tuple[dict[str, list[dict[str, Any]]], PlanningContext, dict[str, Any]]:
    raw = _random_world(seed)
    ctx = PlanningContext.from_raw(raw, fx.DEPOT, fx.RUN_DATE)
    return raw, ctx, run_pipeline(ctx)


def _rows(raw: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    return ({o["id"]: o for o in raw["orders"]}, {o["id"]: o for o in raw["outlets"]}, {v["id"]: v for v in raw["vehicles"]})


@pytest.mark.parametrize("seed", SEEDS)
def test_never_over_vehicle_weight(seed):
    raw, _, result = _solve(seed)
    orders, _, vehicles = _rows(raw)
    for t in result["plan"]["trips"]:
        assert sum(orders[o]["kg"] for o in t["orderIds"]) <= vehicles[t["vehicleId"]]["capacityKg"]


@pytest.mark.parametrize("seed", SEEDS)
def test_never_over_vehicle_volume(seed):
    raw, _, result = _solve(seed)
    orders, _, vehicles = _rows(raw)
    for t in result["plan"]["trips"]:
        assert sum(orders[o]["m3"] for o in t["orderIds"]) <= vehicles[t["vehicleId"]]["capacityM3"] + 1e-9


@pytest.mark.parametrize("seed", SEEDS)
def test_chilled_orders_only_on_reefers(seed):
    raw, _, result = _solve(seed)
    orders, _, vehicles = _rows(raw)
    for t in result["plan"]["trips"]:
        for o in t["orderIds"]:
            if orders[o]["tempClass"] == "CHILLED":
                assert vehicles[t["vehicleId"]]["tempClass"] == "CHILLED", (o, t["vehicleId"])


@pytest.mark.parametrize("seed", SEEDS)
def test_van_only_outlets_only_on_vans(seed):
    raw, _, result = _solve(seed)
    orders, outlets, vehicles = _rows(raw)
    for t in result["plan"]["trips"]:
        for o in t["orderIds"]:
            if outlets[orders[o]["outletId"]]["parking"] == "VAN_ONLY":
                assert vehicles[t["vehicleId"]]["type"] == "VAN", (o, t["vehicleId"])


@pytest.mark.parametrize("seed", SEEDS)
def test_every_stop_inside_its_delivery_window(seed):
    raw, _, result = _solve(seed)
    orders, outlets, _ = _rows(raw)
    for t in result["plan"]["trips"]:
        for s in t["stops"]:
            outlet = outlets[orders[s["orderId"]]["outletId"]]
            assert h.to_min(s["arrive"]) <= h.to_min(outlet["windowClose"]), (s["orderId"], s["arrive"])


@pytest.mark.parametrize("seed", SEEDS)
def test_mall_stops_inside_the_mall_access_window(seed):
    raw, _, result = _solve(seed)
    orders, outlets, _ = _rows(raw)
    seen = 0
    for t in result["plan"]["trips"]:
        for s in t["stops"]:
            outlet = outlets[orders[s["orderId"]]["outletId"]]
            if outlet.get("mallWindow"):
                m_open, m_close = outlet["mallWindow"].split("-")
                assert h.to_min(m_open) <= h.to_min(s["arrive"]) <= h.to_min(m_close), (s["orderId"], s["arrive"], outlet["mallWindow"])
                seen += 1
    assert seen or not any(o.get("mallWindow") for o in outlets.values()) or result["deferrals"]


@pytest.mark.parametrize("seed", SEEDS)
def test_only_own_depot_vehicles_and_outlets(seed):
    raw, ctx, result = _solve(seed)
    orders, outlets, vehicles = _rows(raw)
    assert "RX" not in ctx.orders and "V-X1" not in ctx.vehicles  # the other depot's rows never enter the run
    for t in result["plan"]["trips"]:
        assert vehicles[t["vehicleId"]]["depot"] == fx.DEPOT
        assert all(outlets[orders[o]["outletId"]]["depot"] == fx.DEPOT for o in t["orderIds"])


@pytest.mark.parametrize("seed", SEEDS)
def test_weekly_fuel_quota_never_exceeded(seed):
    raw, _, result = _solve(seed)
    _, _, vehicles = _rows(raw)
    litres: dict[str, float] = {}
    for t in result["plan"]["trips"]:
        litres[t["vehicleId"]] = litres.get(t["vehicleId"], 0.0) + t["litres"]
    for vid, used in litres.items():
        v = vehicles[vid]
        assert v["usedLThisWeek"] + used <= v["weeklyLFuel"], vid


@pytest.mark.parametrize("seed", SEEDS)
def test_trips_and_daily_minutes_within_limits(seed):
    _, ctx, result = _solve(seed)
    per_vehicle: dict[str, list[dict[str, Any]]] = {}
    for t in result["plan"]["trips"]:
        per_vehicle.setdefault(t["vehicleId"], []).append(t)
        assert ctx.vehicles[t["vehicleId"]]["status"] == "AVAILABLE"
    for trips in per_vehicle.values():
        assert len(trips) <= h.MAX_TRIPS_PER_VEHICLE
        assert not h.over_budget(trips), h.minutes_by_group(trips)


@pytest.mark.parametrize("seed", SEEDS)
def test_over_capacity_day_every_order_served_or_deferred_with_a_reason(seed):
    _, ctx, result = _solve(seed)
    plan = result["plan"]
    served = planned_order_ids(plan)
    deferred = {d["orderId"]: d["reason"] for d in result["deferrals"]}
    review = {r["orderId"] for r in result["needsReview"]}
    assert deferred, "the synthetic day must exceed fleet capacity"
    assert served | set(deferred) | review == set(ctx.orders)
    assert not served & set(deferred) and not set(deferred) & review
    assert all(r in REASON_CODES for r in deferred.values())
    assert {u["orderId"]: u["reason"] for u in plan["unassigned"]} == deferred  # the plan itself carries the deferrals
    checks, violations = check_rules(ctx, plan)
    assert violations == [] and all(c["passed"] for c in checks)
    assert validate_plan(ctx, plan, decided=set(deferred) | review)["errors"] == []  # incl. reefer, depot, mixing


def test_validator_flags_chilled_on_ambient_and_other_depot_vehicle():
    """Reefers and the home depot are enforced up front by the drafter; ``validate_plan`` verifies them on any plan."""
    raw = _random_world(0)
    ctx = PlanningContext.from_raw(raw, fx.DEPOT, fx.RUN_DATE)
    chilled = next(o for o in sorted(ctx.orders) if ctx.needs_reefer(o) and not ctx.needs_van(o))
    bad = schedule(ctx, {"version": 1, "unassigned": [], "trips": [{"vehicleId": "V-A2", "tripNo": 1, "orderIds": [chilled]}]})
    bad["trips"].append({"id": "V-X1-T1", "vehicleId": "V-X1", "tripNo": 1, "orderIds": [chilled]})  # another depot's reefer
    codes = {(e["code"], e["vehicle_id"]) for e in validate_plan(ctx, bad, decided=set(ctx.orders))["errors"]}
    assert ("CHILLED_ORDER_ON_AMBIENT_VEHICLE", "V-A2") in codes
    assert ("DEPOT_MISMATCH", "V-X1") in codes
