"""Exact allocation: the Datathon's mixed-integer program (dtcore.solve_allocation), on the agent's context.

Variables   x[o,v,t] = 1 if order o rides vehicle v on trip t (t = 1, 2)
            y[v,t,g] = 1 if trip (v, t) serves group g = (brand, district)
Rules       one brand and one district per trip            sum_g y[v,t,g] <= 1,  x[o,v,t] <= y[v,t,g(o)]
            chilled only on reefers, van_only only on vans, the dispatcher's "avoid" pairs (pairs never created)
            whole orders                                    sum_{v,t} x[o,v,t] <= 1
            weight and volume per trip                      sum_o kg x <= kg cap,  sum_o m3 x <= m3 cap
            the booklet's budgets per vehicle               Fresh trips <= 270 min, Style and Tech trips <= 480 min
              minutes(v,t,g) = (depot->district - inter-stop) y + sum_o (inter-stop + service) x
            the weekly fuel quota                           sum litres(v,t,g) <= litres left this week
            no empty trips, and trip 2 only after trip 1    y <= sum x,  sum_g y[v,2,g] <= sum_g y[v,1,g]
Objective   maximise sum priority(o) served(o) - TRIP_COST trips opened (the trip cost is below the smallest
            priority, so it never trades an order away; among plans serving the same orders it uses fewer trips)

Window closes depend on the clock (stop order, waits, the previous trip's return), so they are not in the model:
``choose_plan`` keeps the exact plan only when the rule checker passes it and it serves at least as much priority
as the greedy draft; otherwise (or with scipy missing, or no answer in the time limit) the greedy draft stands.
"""

from __future__ import annotations

import logging
from typing import Any

from . import heuristics as h
from .context import PlanningContext

log = logging.getLogger(__name__)

TRIP_COST = 0.5
SPECIALIST_WASTE = 0.1
PROTECTED_BONUS = 1000.0
PRIORITISED_BONUS = 500.0


def priority(ctx: PlanningContext, oid: str, prioritise: set[str]) -> float:
    """What serving the order is worth: its deferral score (higher = keep on this run), far more when protected
    (deferred yesterday, never skipped twice) or prioritised by the repair loop."""
    return (1.0 + max(0.0, float(ctx.scores.get(oid, 0)))
            + (PROTECTED_BONUS if ctx.protected.get(oid) else 0.0)
            + (PRIORITISED_BONUS if oid in prioritise else 0.0))


def _fuel_left(v: dict[str, Any]) -> float | None:
    quota = float(v.get("weeklyLFuel") or 0)
    return None if not quota else quota - float(v.get("usedLThisWeek") or 0)


def optimise(ctx: PlanningContext, avoid: dict[str, dict[str, str]], prioritise: set[str], time_limit: float = 30.0) -> dict[str, Any] | None:
    """The exact allocation as {"trips": [{vehicleId, tripNo, orderIds}], "served": [...], "info": {...}}, or None."""
    try:
        import numpy as np
        from scipy.optimize import Bounds, LinearConstraint, milp
        from scipy.sparse import coo_matrix
    except ImportError:  # the optimiser is optional: the greedy draft stands
        log.warning("scipy is not installed: exact allocation skipped")
        return None

    orders = sorted(ctx.orders)
    vehicles = sorted(ctx.available_vehicles(), key=lambda v: v["id"])
    if not orders or not vehicles:
        return None
    T = (1, 2)[: h.MAX_TRIPS_PER_VEHICLE]
    group_of = {o: (ctx.brand_of(o), ctx.district_of(o)) for o in orders}
    groups = sorted(set(group_of.values()))
    travel = {g[1]: ctx.travel_for(g[1]) for g in groups}

    def compatible(o: str, v: dict[str, Any]) -> bool:
        ok = ((not ctx.needs_reefer(o) or v.get("tempClass") == "CHILLED")
              and (not ctx.needs_van(o) or v.get("type") == "VAN")
              and float(ctx.orders[o].get("kg") or 0) <= float(v.get("capacityKg") or 0)
              and float(ctx.orders[o].get("m3") or 0) <= float(v.get("capacityM3") or 0))
        return ok and v["id"] not in avoid.get(o, {})

    idx: dict[tuple, int] = {}
    for o in orders:
        for v in vehicles:
            if compatible(o, v):
                for t in T:
                    idx[("x", o, v["id"], t)] = len(idx)
    for v in vehicles:
        for t in T:
            for g in groups:
                idx[("y", v["id"], t, g)] = len(idx)
    if len(T) > 1:
        for v in vehicles:
            idx[("s2", v["id"])] = len(idx)  # when the vehicle's trip 2 reaches its district (minutes after midnight)
    n = len(idx)
    rows: list[int] = []
    cols: list[int] = []
    vals: list[float] = []
    lo: list[float] = []
    hi: list[float] = []

    def add(coefs: dict[int, float], lb: float, ub: float) -> None:
        r = len(lo)
        for k, c in coefs.items():
            rows.append(r)
            cols.append(k)
            vals.append(c)
        lo.append(lb)
        hi.append(ub)

    by_order: dict[str, list[int]] = {}
    by_vt: dict[tuple[str, int], list[str]] = {}
    for k, j in idx.items():
        if k[0] == "x":
            by_order.setdefault(k[1], []).append(j)
            by_vt.setdefault((k[2], k[3]), []).append(k[1])
    for o, js in by_order.items():  # whole orders, at most once
        add({j: 1.0 for j in js}, 0.0, 1.0)

    for v in vehicles:
        vid = v["id"]
        budgets: dict[str, dict[int, float]] = {"FRESH": {}, "STYLE_TECH": {}}
        fuel: dict[int, float] = {}
        kpl = float(v.get("kmPerLitre") or 0)
        for t in T:
            add({idx[("y", vid, t, g)]: 1.0 for g in groups}, 0.0, 1.0)  # one brand + district per trip
            members = by_vt.get((vid, t), [])
            add({idx[("x", o, vid, t)]: float(ctx.orders[o].get("m3") or 0) for o in members}, 0.0, float(v.get("capacityM3") or 0))
            add({idx[("x", o, vid, t)]: float(ctx.orders[o].get("kg") or 0) for o in members}, 0.0, float(v.get("capacityKg") or 0))
            for g in groups:
                yk = idx[("y", vid, t, g)]
                mem = [o for o in members if group_of[o] == g]
                if not mem:
                    add({yk: 1.0}, 0.0, 0.0)
                    continue
                for o in mem:
                    add({idx[("x", o, vid, t)]: 1.0, yk: -1.0}, -np.inf, 0.0)  # x <= y
                add({yk: 1.0, **{idx[("x", o, vid, t)]: -1.0 for o in mem}}, -np.inf, 0.0)  # no empty trips
                tr = travel[g[1]]
                to_dist, inter = float(tr.get("depotToDistMin") or 0), float(tr.get("interStopMin") or 0)
                tgt = budgets[h.budget_group(g[0])]
                tgt[yk] = tgt.get(yk, 0.0) + to_dist - inter
                for o in mem:
                    k = idx[("x", o, vid, t)]
                    tgt[k] = tgt.get(k, 0.0) + inter + float(ctx.service_min(o))
                if kpl:
                    dist = tr.get("distKm")
                    dist = float(dist) if dist is not None else to_dist * h.DEPOT_KM_PER_MIN
                    inter_km = inter * h.INTER_STOP_KM_PER_MIN
                    fuel[yk] = fuel.get(yk, 0.0) + (2 * dist - inter_km) / kpl
                    for o in mem:
                        k = idx[("x", o, vid, t)]
                        fuel[k] = fuel.get(k, 0.0) + inter_km / kpl
        for group, coefs in budgets.items():
            if coefs:
                add(coefs, -np.inf, float(h.group_budget(group)))
        left = _fuel_left(v)
        if left is not None and fuel:
            add(fuel, -np.inf, max(0.0, left - 0.2 * len(T)))  # litres are rounded per trip: keep a little slack
        if len(T) > 1:  # trip 2 only after trip 1
            add({**{idx[("y", vid, 2, g)]: 1.0 for g in groups}, **{idx[("y", vid, 1, g)]: -1.0 for g in groups}}, -np.inf, 0.0)

    # ---- delivery windows: a safe upper bound on every stop's arrival (stops in window order, waits included)
    # trip 1 reaches district g by base1[g] = max(first departure + drive out, latest window opening in g) at the
    # latest; any stop is reached by base + all of the trip's (inter-stop + service) minutes, so the district
    # group's earliest window close bounds the whole trip. Trip 2 reaches its district at s2 >= trip 1's return + drive out,
    # and >= its latest opening. Conservative: a plan that passes here passes the planner's clock (check_rules) too.
    first_dep = h.to_min(ctx.first_departure)
    opens = {g: max(h.to_min(ctx.window_of(o)[0]) for o in orders if group_of[o] == g) for g in groups}
    base1 = {g: max(first_dep + float(travel[g[1]].get("depotToDistMin") or 0), opens[g]) for g in groups}
    BIG = 24 * 60.0

    def leg(o: str) -> float:
        return float(travel[group_of[o][1]].get("interStopMin") or 0) + float(ctx.service_min(o))

    closes = {g: min(h.to_min(ctx.window_of(o)[1]) for o in orders if group_of[o] == g) for g in groups}
    for v in vehicles:
        vid = v["id"]
        for t in T:
            members = by_vt.get((vid, t), [])
            for g in groups:
                mem = [o for o in members if group_of[o] == g]
                if not mem:
                    continue
                span = {idx[("x", o, vid, t)]: leg(o) for o in mem}
                # arrival at the last stop = arrival in the district + every earlier stop's (service + the drive to the
                # next stop) = start + span - the last stop's own leg; that leg is at least the group's smallest, so
                # allowing the smallest leg keeps the bound safe without counting the last stop against the close
                slack = min(leg(o) for o in orders if group_of[o] == g)
                if t == 1:
                    # the stops done by the group's earliest close (x <= y, so no big-M is needed)
                    add(span, -np.inf, max(0.0, closes[g] - base1[g] + slack))
                else:
                    yk = idx[("y", vid, 2, g)]
                    add({**span, idx[("s2", vid)]: 1.0, yk: BIG}, -np.inf, closes[g] + slack + BIG)  # s2 + span <= close
        if len(T) > 1:
            # s2 >= trip 1's return + trip 2's drive out:  trip 1 ends by base1 + span1, then drives back
            ret: dict[int, float] = {idx[("s2", vid)]: 1.0}
            for g in groups:
                d1 = float(travel[g[1]].get("depotToDistMin") or 0)
                y1, y2 = idx[("y", vid, 1, g)], idx[("y", vid, 2, g)]
                ret[y1] = ret.get(y1, 0.0) - (base1[g] + d1)
                ret[y2] = ret.get(y2, 0.0) - d1
            for o in by_vt.get((vid, 1), []):
                k = idx[("x", o, vid, 1)]
                ret[k] = ret.get(k, 0.0) - leg(o)
            add(ret, 0.0, np.inf)
            # s2 >= the latest opening of trip 2's district group
            add({idx[("s2", vid)]: 1.0, **{idx[("y", vid, 2, g)]: -opens[g] for g in groups}}, 0.0, np.inf)

    # symmetry: identical vehicles (type, temperature, capacities, km/L, fuel left) are used in id order, so the solver
    # does not explore every relabelling of the same plan (as in dtcore.solve_allocation)
    sig: dict[tuple, list[str]] = {}
    for v in vehicles:
        sig.setdefault((v.get("type"), v.get("tempClass"), v.get("capacityKg"), v.get("capacityM3"), v.get("kmPerLitre"), _fuel_left(v)), []).append(v["id"])
    for same in sig.values():
        for a_, b_ in zip(same, same[1:]):
            add({**{idx[("y", a_, t, g)]: 1.0 for t in T for g in groups}, **{idx[("y", b_, t, g)]: -1.0 for t in T for g in groups}}, 0.0, np.inf)

    # a reefer or a van used for work that doesn't need one costs a little (far below any order's priority, so it
    # never trades an order away): scarce vehicles stay free for the orders only they can carry, as the greedy draft
    vmap = {v["id"]: v for v in vehicles}

    def waste(o: str, vid: str) -> float:
        v = vmap[vid]
        return (SPECIALIST_WASTE if v.get("tempClass") == "CHILLED" and not ctx.needs_reefer(o) else 0.0) +             (SPECIALIST_WASTE if v.get("type") == "VAN" and not ctx.needs_van(o) else 0.0)

    c = np.zeros(n)
    for k, j in idx.items():
        if k[0] == "x":
            c[j] = -priority(ctx, k[1], prioritise) + waste(k[1], k[2])
        elif k[0] == "y":
            c[j] = TRIP_COST  # the trip-2 start times (s2) cost nothing: they only carry the clock
    A = coo_matrix((vals, (rows, cols)), shape=(len(lo), n)).tocsr()
    integral = np.array([0 if k[0] == "s2" else 1 for k in sorted(idx, key=idx.get)])
    upper = np.array([BIG if k[0] == "s2" else 1.0 for k in sorted(idx, key=idx.get)])
    res = milp(c, constraints=LinearConstraint(A, lo, hi), integrality=integral, bounds=Bounds(0, upper),
               options={"time_limit": float(time_limit), "disp": False})
    if res.x is None:
        log.info("exact allocation found no answer: %s", res.message)
        return None
    sol = np.round(res.x).astype(int)
    trips: dict[tuple[str, int], list[str]] = {}
    for k, j in idx.items():
        if k[0] == "x" and sol[j] == 1:
            trips.setdefault((k[2], k[3]), []).append(k[1])
    out = []
    for vid in sorted({v for v, _ in trips}):
        for no, t in enumerate(sorted(t for v, t in trips if v == vid), 1):  # renumber 1, 2 in order
            out.append({"vehicleId": vid, "tripNo": no, "orderIds": sorted(trips[(vid, t)])})
    served = sorted({o for t in out for o in t["orderIds"]})
    return {
        "trips": out,
        "served": served,
        "info": {"status": str(res.message), "objective": round(float(-res.fun), 2),
                 "gap": None if getattr(res, "mip_gap", None) is None else round(float(res.mip_gap), 4), "variables": n},
    }
