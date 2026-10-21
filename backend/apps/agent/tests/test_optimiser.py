"""The exact allocation (optimiser.py, the Datathon MILP) against the greedy draft, and draft_best's choice."""

from __future__ import annotations

import builtins

from lodestar_agent.domain import planner
from lodestar_agent.domain.context import PlanningContext
from lodestar_agent.domain.optimiser import optimise
from lodestar_agent.domain.rules import check_rules

from . import fixtures as fx


def big_and_small() -> PlanningContext:
    """Two Style orders that each take more than half a vehicle's 480-minute day. A (8 m3) fits either truck; B (25 m3)
    only the big one. Greedy packs A first (earlier window) on the biggest truck, so B fits nowhere."""
    data = fx.raw(
        outlets=[
            fx.outlet("S-A", "STYLE", "Alpha", "REAR_DOCK", "NORMAL", "08:00", "17:00"),
            fx.outlet("S-B", "STYLE", "Beta", "REAR_DOCK", "NORMAL", "09:00", "17:00"),
        ],
        vehicles=[
            fx.vehicle("V-BIG", "TRUCK", "AMBIENT", 5000, 30, 5, 400, 0),
            fx.vehicle("V-SMALL", "TRUCK", "AMBIENT", 2000, 10, 6, 400, 0),
        ],
        orders=[fx.order("O-A", "S-A", "STYLE", "AMBIENT", 300, 8.0), fx.order("O-B", "S-B", "STYLE", "AMBIENT", 900, 25.0)],
        serviceAllowances=[{"brand": "STYLE", "dockType": "REAR_DOCK", "minutes": 250}],
    )
    return PlanningContext.from_raw(data, fx.DEPOT, fx.RUN_DATE)


def test_greedy_defers_what_the_exact_allocation_serves():
    ctx = big_and_small()
    greedy = planner.draft_plan(ctx)
    assert [u["orderId"] for u in greedy["unassigned"]] == ["O-B"]

    best = planner.draft_best(ctx)
    assert best["allocation"]["method"] == "exact"
    assert best["unassigned"] == []
    on = {o: t["vehicleId"] for t in best["trips"] for o in t["orderIds"]}
    assert on == {"O-A": "V-SMALL", "O-B": "V-BIG"}
    assert best["allocation"]["servedExact"] == 2 and best["allocation"]["servedGreedy"] == 1
    assert check_rules(ctx, best)[1] == []


def test_exact_allocation_keeps_every_packing_rule_on_the_base_day():
    ctx = PlanningContext.from_raw(fx.raw(), fx.DEPOT, fx.RUN_DATE)
    out = optimise(ctx, {}, set())
    assert out is not None
    plan = planner.schedule(ctx, {"version": 1, "trips": out["trips"], "unassigned": []})
    for t in plan["trips"]:
        v = ctx.vehicles[t["vehicleId"]]
        assert len({(ctx.brand_of(o), ctx.district_of(o)) for o in t["orderIds"]}) == 1  # one brand, one district
        assert all(v["tempClass"] == "CHILLED" for o in t["orderIds"] if ctx.needs_reefer(o))
        assert all(v["type"] == "VAN" for o in t["orderIds"] if ctx.needs_van(o))
        assert t["kg"] <= v["capacityKg"] and t["m3"] <= v["capacityM3"]
    assert "V-R2" not in {t["vehicleId"] for t in plan["trips"]}  # the workshop vehicle stays out
    assert "O-99" not in out["served"]  # another depot's order is never in scope


def test_avoid_constraints_are_honoured():
    ctx = big_and_small()
    out = optimise(ctx, {"O-B": {"V-BIG": "CAP_TIME"}}, set())
    assert "O-B" not in out["served"]  # V-BIG was the only truck that could carry it


def test_greedy_stands_without_a_solver(monkeypatch):
    real = builtins.__import__

    def no_scipy(name, *a, **k):
        if name.startswith("scipy"):
            raise ImportError("no scipy")
        return real(name, *a, **k)

    monkeypatch.setattr(builtins, "__import__", no_scipy)
    best = planner.draft_best(big_and_small())
    assert best["allocation"]["method"] == "greedy" and "unavailable" in best["allocation"]["note"]
    assert [u["orderId"] for u in best["unassigned"]] == ["O-B"]


def test_greedy_method_skips_the_solver():
    assert planner.draft_best(big_and_small(), method="greedy")["allocation"] == {"method": "greedy"}
