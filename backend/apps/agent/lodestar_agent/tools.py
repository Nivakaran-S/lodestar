"""LangChain tools the model can pick.

Context tools read OData with the agent's service token and are pinned to the
run's depot/date: a model (or prompt injection) asking for another depot is refused.
Ask tools read the run snapshot; ``propose_edit`` only *previews* an edit.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from langchain_core.tools import BaseTool, tool

from .domain.context import PlanningContext
from .domain.edits import EditError, apply_edits
from .domain.rules import check_rules
from .odata import ODataClient

# dataset name -> (entity set, key in the raw context)
DATASETS: dict[str, tuple[str, str]] = {
    "orders": ("Orders", "orders"),
    "outlets": ("Outlets", "outlets"),
    "vehicles": ("Vehicles", "vehicles"),
    "calendar": ("Calendar", "calendar"),
    "district_travel": ("DistrictTravel", "districtTravel"),
    "service_allowances": ("ServiceAllowances", "serviceAllowances"),
}


def _q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_context_tools(client: ODataClient, depot: str, run_date: str) -> tuple[list[BaseTool], dict[str, list[dict[str, Any]]]]:
    loaded: dict[str, list[dict[str, Any]]] = {}
    day = date.fromisoformat(run_date)
    nxt = day + timedelta(days=1)

    def _scope_error(asked_depot: str | None = None, asked_date: str | None = None) -> str | None:
        if asked_depot is not None and asked_depot.upper() != depot:
            return f"refused: this run is scoped to depot {depot}"
        if asked_date is not None and asked_date != run_date:
            return f"refused: this run is scoped to {run_date}"
        return None

    def _load(dataset: str, params: dict[str, Any]) -> str:
        entity_set, key = DATASETS[dataset]
        rows = client.get_all(entity_set, params)
        loaded[key] = rows
        return json.dumps({"entitySet": entity_set, "count": len(rows)})

    @tool
    def fetch_orders(depot: str, run_date: str) -> str:
        """Read the open Orders for the depot's run date (OData Orders)."""
        err = _scope_error(depot, run_date)
        if err:
            return json.dumps({"error": err})
        # DEFERRED: orders a previous run deferred and rolled to this day (protected by deferredYesterday)
        flt = f"runDate ge {day.isoformat()}T00:00:00Z and runDate lt {nxt.isoformat()}T00:00:00Z and status in ('RECEIVED','PLANNED','DEFERRED')"
        return _load("orders", {"$filter": flt})

    @tool
    def fetch_outlets(depot: str) -> str:
        """Read the depot's active Outlets (windows, dock type, parking)."""
        err = _scope_error(depot)
        if err:
            return json.dumps({"error": err})
        return _load("outlets", {"$filter": f"depot eq {_q(depot.upper())} and isActive eq true"})

    @tool
    def fetch_vehicles(depot: str) -> str:
        """Read the depot's Vehicles (capacity, reefer/van, fuel quota, status)."""
        err = _scope_error(depot)
        if err:
            return json.dumps({"error": err})
        return _load("vehicles", {"$filter": f"depot eq {_q(depot.upper())}"})

    @tool
    def fetch_calendar(run_date: str) -> str:
        """Read the Calendar rows for the run date and the next day."""
        err = _scope_error(asked_date=run_date)
        if err:
            return json.dumps({"error": err})
        return _load("calendar", {"$filter": f"date ge {day.isoformat()} and date le {nxt.isoformat()}"})

    @tool
    def fetch_district_travel(depot: str) -> str:
        """Read DistrictTravel (depot-to-district and inter-stop minutes, road class)."""
        err = _scope_error(depot)
        if err:
            return json.dumps({"error": err})
        return _load("district_travel", {"$filter": f"depot eq {_q(depot.upper())}"})

    @tool
    def fetch_service_allowances() -> str:
        """Read ServiceAllowances (service minutes per brand and dock type)."""
        return _load("service_allowances", {})

    tools = [fetch_orders, fetch_outlets, fetch_vehicles, fetch_calendar, fetch_district_travel, fetch_service_allowances]
    return tools, loaded


def build_ask_tools(ctx: PlanningContext, run: dict[str, Any]) -> tuple[list[BaseTool], list[dict[str, Any]]]:
    plan: dict[str, Any] = run["plan"]
    proposals: list[dict[str, Any]] = []

    def trip_of(order_id: str) -> dict[str, Any] | None:
        return next((t for t in plan["trips"] if order_id in t["orderIds"]), None)

    @tool
    def plan_summary() -> str:
        """Summarise the current draft: trips, vehicles, deferrals, review items."""
        vehicles = sorted({t["vehicleId"] for t in plan["trips"]})
        planned = sum(len(t["orderIds"]) for t in plan["trips"])
        s = (
            f"{planned} orders planned on {len(plan['trips'])} trips using {len(vehicles)} vehicles; "
            f"{len(run['deferrals'])} deferral candidates; {len(run['needsReview'])} need review; status {run['status']}."
        )
        return json.dumps({"summary": s})

    @tool
    def rule_checks() -> str:
        """Report the hard-rule checks (the 7 booklet rules and window close) for the current draft."""
        failed = [c for c in run["ruleChecks"] if not c["passed"]]
        if not failed:
            s = f"All {len(run['ruleChecks'])} hard rules pass: " + ", ".join(c["rule"] for c in run["ruleChecks"]) + f" (after {run['redrafts']} redraft(s))."
        else:
            s = "Rules with problems: " + "; ".join(v["detail"] for v in run["violations"])
        return json.dumps({"summary": s})

    @tool
    def capacity() -> str:
        """Chilled demand versus available reefer capacity."""
        dem, cap = ctx.summary()["chilledDemand"], ctx.summary()["reeferCapacity"]
        short = max(0.0, round(dem["m3"] - cap["m3"], 1))
        s = f"Chilled demand {dem['m3']} m3 over {dem['orders']} orders; {cap['vehicles']} reefers available with {cap['m3']} m3" + (
            f"; short {short} m3." if short else "; no reefer shortfall."
        )
        return json.dumps({"summary": s})

    @tool
    def list_deferrals() -> str:
        """List ranked deferral candidates with reason codes, and protected orders held for review."""
        if not run["deferrals"] and not run["needsReview"]:
            return json.dumps({"summary": "No deferrals: every open order is on a trip."})
        parts = [f"#{d['rank']} {d['orderId']} ({d['reason']}, score {d['score']})" for d in run["deferrals"]]
        s = "Deferral candidates, best first: " + ", ".join(parts) if parts else "No deferral candidates."
        if run["needsReview"]:
            s += " Protected, never deferred, needs you: " + ", ".join(n["orderId"] for n in run["needsReview"]) + "."
        return json.dumps({"summary": s})

    @tool
    def explain_order(order_id: str) -> str:
        """Explain where an order is in the draft and why."""
        if order_id not in ctx.orders:
            return json.dumps({"summary": f"{order_id} is not an open order in this run."})
        prot = " It is protected (score {}), so it is never deferred.".format(ctx.scores[order_id]) if ctx.protected[order_id] else ""
        trip = trip_of(order_id)
        if trip:
            stop = next(s for s in trip["stops"] if s["orderId"] == order_id)
            s = (
                f"{order_id} is on {trip['vehicleId']} trip {trip['tripNo']} ({trip['brand']}/{trip['district']}), "
                f"stop {stop['seq']}, planned arrival {stop['arrive']}, model ETA {stop['etaModel']}, window {stop['window']}.{prot}"
            )
        else:
            d = next((d for d in run["deferrals"] if d["orderId"] == order_id), None)
            if d:
                s = f"{order_id} is deferral candidate #{d['rank']} with reason {d['reason']} and score {d['score']}."
            else:
                s = f"{order_id} is not placed and is waiting for your review.{prot}"
        return json.dumps({"summary": s})

    @tool
    def lookup_vehicle(vehicle_id: str) -> str:
        """Describe a vehicle's trips, load and minutes in the draft."""
        v = ctx.vehicles.get(vehicle_id)
        if v is None:
            return json.dumps({"summary": f"{vehicle_id} is not a vehicle of depot {ctx.depot}."})
        trips = [t for t in plan["trips"] if t["vehicleId"] == vehicle_id]
        if v.get("status", "AVAILABLE") != "AVAILABLE":
            s = f"{vehicle_id} is {v.get('status')} and has no trips."
        elif not trips:
            s = f"{vehicle_id} is available with no trips in this draft."
        else:
            desc = "; ".join(f"trip {t['tripNo']} {t['brand']}/{t['district']} {len(t['orderIds'])} stops, {t['kg']} kg, {t['m3']} m3, {t['minutes']} min" for t in trips)
            s = f"{vehicle_id} ({str(v.get('type')).lower()}, {str(v.get('tempClass')).lower()}): {desc}; {sum(t['minutes'] for t in trips)} min in total."
        return json.dumps({"summary": s})

    @tool
    def lookup_outlet(outlet_id: str) -> str:
        """Describe an outlet's access, window and orders in the draft."""
        o = ctx.outlets.get(outlet_id)
        if o is None:
            return json.dumps({"summary": f"{outlet_id} is not an outlet of depot {ctx.depot}."})
        orders = sorted(oid for oid, row in ctx.orders.items() if row["outletId"] == outlet_id)
        s = f"{outlet_id} ({o.get('brand')}, {o.get('district')}) {o.get('dockType')}/{o.get('parking')}, window {o.get('windowOpen')}-{o.get('windowClose')}; open orders: {', '.join(orders) or 'none'}."
        return json.dumps({"summary": s})

    @tool
    def propose_edit(op: str, order_id: str, vehicle_id: str | None = None, reason: str | None = None, trip_no: int | None = None) -> str:
        """Preview an edit (op 'move' or 'defer') as a new draft. Never applies or publishes it."""
        edit: dict[str, Any] = {"op": op, "orderId": order_id}
        if vehicle_id:
            edit["vehicleId"] = vehicle_id
        if reason:
            edit["reason"] = reason
        if trip_no:
            edit["tripNo"] = trip_no
        try:
            new_plan, applied = apply_edits(ctx, plan, [edit], run.get("locked"))
        except EditError as exc:
            return json.dumps({"summary": f"I can't propose that: {exc}.", "proposal": False})
        checks, violations = check_rules(ctx, new_plan)
        verdict = f"all {len(checks)} hard rules still pass" if not violations else "it would break: " + "; ".join(v["detail"] for v in violations)
        proposals.append({"edits": [edit], "draftVersion": new_plan["version"], "ruleChecks": checks, "violations": violations})
        return json.dumps({"summary": f"Proposal v{new_plan['version']}: {'; '.join(applied)}; {verdict}.", "proposal": True})

    tools = [plan_summary, rule_checks, capacity, list_deferrals, explain_order, lookup_vehicle, lookup_outlet, propose_edit]
    return tools, proposals
