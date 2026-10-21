"""Graph paths: happy path, rule-violation loop, reject, edit, ask."""

from __future__ import annotations

import pytest
from langgraph.types import Command
from mockito import verify

from lodestar_agent.domain.edits import EditError
from lodestar_agent.runtime import RunConflict, RunNotFound

from . import fixtures as fx

ROLES = ["dispatcher"]


def nodes(run):
    return [h["node"] for h in run["history"]]


def test_happy_path_stops_at_needs_approval(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")

    assert run["status"] == "NEEDS_APPROVAL"
    assert run["canPublish"] is False
    assert nodes(run) == ["load_context", "classify_intent", "extract_preferences", "draft_plan", "check_rules", "rank_deferrals", "simulate_plan", "explain"]
    assert all(c["passed"] for c in run["ruleChecks"]) and len(run["ruleChecks"]) == 8
    assert run["redrafts"] == 0
    planned = {o for t in run["plan"]["trips"] for o in t["orderIds"]}
    assert planned == {"O-1", "O-2", "O-3", "O-4", "O-5", "O-6", "O-7"}  # other depot's order never loaded into scope
    trips = {t["id"]: t for t in run["plan"]["trips"]}
    van_only = next(t for t in trips.values() if "O-3" in t["orderIds"])
    assert van_only["vehicleId"] == "V-N1"  # van_only on the van
    assert all(t["vehicleId"] != "V-R2" for t in trips.values())  # workshop vehicle unused
    # dry Fresh never takes a reefer for itself: on a reefer only riding along with chilled Fresh of the same district
    # (the exact allocation saves a trip that way; the greedy draft uses the dry truck)
    o4 = next(t for t in trips.values() if "O-4" in t["orderIds"])
    assert o4["vehicleId"] == "V-D1" or any(o["tempClass"] == "CHILLED" for o in fx.raw()["orders"] if o["id"] in o4["orderIds"])
    assert "What it did" in run["explanation"]["text"] and "What it checked" in run["explanation"]["text"]
    assert "V-R2" in run["contextSummary"]["vehiclesDown"]


def test_load_context_reads_every_entity_set_once(make_runtime):
    rt = make_runtime()
    rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    for entity_set in ("Orders", "Outlets", "Vehicles", "Calendar", "DistrictTravel", "ServiceAllowances"):
        verify(rt.odata, times=1).get_all(entity_set, ...)


def test_mall_conflict_is_packed_around_up_front(make_runtime):
    rt = make_runtime(fx.mall_conflict_raw())
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")

    # the long Gamma run would push the mall stop past its window: the drafter sees it while packing
    assert run["redrafts"] == 0 and nodes(run).count("draft_plan") == 1
    assert all(c["passed"] for c in run["ruleChecks"])
    mall_trip = next(t for t in run["plan"]["trips"] if "O-5" in t["orderIds"])
    stop = next(s for s in mall_trip["stops"] if s["orderId"] == "O-5")
    assert stop["arrive"] <= "11:00"


def test_rule_violation_still_loops_back_to_draft_as_a_safety_net(make_runtime, monkeypatch):
    from lodestar_agent.domain import rules

    real = rules.check_rules
    calls = {"n": 0}

    def once(ctx, plan):
        calls["n"] += 1
        checks, violations = real(ctx, plan)
        if calls["n"] == 1:  # something the drafter could not foresee
            trip = plan["trips"][0]
            violations = [{"rule": "mall", "tripId": trip["id"], "vehicleId": trip["vehicleId"], "orderIds": trip["orderIds"][:1], "reason": "WINDOW", "detail": "late"}]
            checks = [{**c, "passed": c["rule"] != "mall", "violations": int(c["rule"] == "mall")} for c in checks]
        return checks, violations

    monkeypatch.setattr(rules, "check_rules", once)
    run = make_runtime(allocator="greedy").start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    assert run["redrafts"] == 1
    assert nodes(run).count("draft_plan") == 2 and nodes(run).count("check_rules") == 2
    assert [h for h in run["history"] if h["node"] == "check_rules"][0]["note"] == "violations: mall"
    assert all(c["passed"] for c in run["ruleChecks"]) and run["plan"]["version"] == 2
    assert any("Redrafted 1 time(s) to fix mall" in d for d in run["explanation"]["did"])


def test_redraft_loop_is_bounded(make_runtime, monkeypatch):
    from lodestar_agent.domain import rules

    real = rules.check_rules

    def always(ctx, plan):
        checks, _ = real(ctx, plan)
        trip = plan["trips"][0]
        return checks, [{"rule": "fuel", "tripId": trip["id"], "vehicleId": trip["vehicleId"], "orderIds": [], "reason": "FUEL", "detail": "x"}]

    monkeypatch.setattr(rules, "check_rules", always)
    run = make_runtime().start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    assert run["redrafts"] == 3 and nodes(run).count("draft_plan") == 4


def test_loop_is_capped_and_leftovers_become_deferrals(make_runtime):
    rt = make_runtime(fx.fuel_starved_raw())
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")

    # every vehicle is at its quota: the first draft already leaves the orders out, with FUEL
    assert run["redrafts"] == 0
    assert nodes(run).count("draft_plan") == 1
    assert all(c["passed"] for c in run["ruleChecks"])
    reasons = {d["reason"] for d in run["deferrals"]}
    assert reasons == {"FUEL"}
    assert "O-7" not in {d["orderId"] for d in run["deferrals"]}  # protected is never deferred
    assert [(n["orderId"], n["reason"]) for n in run["needsReview"]] == [("O-7", "PROTECTED_UNPLACED")]
    ranks = [d["rank"] for d in run["deferrals"]]
    assert ranks == list(range(1, len(ranks) + 1))
    scores = [d["score"] for d in run["deferrals"]]
    assert scores == sorted(scores)


def test_approve_ends_without_publishing(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    done = rt.resume(run["id"], "approve", None, "user-1", ROLES, comment="looks right")
    assert done["status"] == "APPROVED"
    assert done["decision"]["by"] == "user-1" and done["decision"]["comment"] == "looks right"
    assert done["canPublish"] is False
    with pytest.raises(RunConflict):
        rt.resume(run["id"], "approve", None, "user-1", ROLES)


def test_reject_ends_the_run(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    done = rt.resume(run["id"], "reject", None, "user-1", ROLES)
    assert done["status"] == "REJECTED"
    assert nodes(done)[-1] == "await_approval"


def test_edit_applies_rechecks_and_waits_again(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    edits = [{"op": "defer", "orderId": "O-6", "reason": "CAP_TIME"}]
    edited = rt.resume(run["id"], "edit", edits, "user-1", ROLES)

    assert edited["status"] == "NEEDS_APPROVAL"
    assert edited["version"] == run["version"] + 1
    assert nodes(edited)[-6:] == ["await_approval", "apply_edits", "check_rules", "rank_deferrals", "simulate_plan", "explain"]
    assert {"orderId": "O-6"}.items() <= edited["deferrals"][0].items()
    assert any("Applied your edits: Deferred O-6 (CAP_TIME)" in d for d in edited["explanation"]["did"])
    assert [d["decision"] for d in edited["decisions"]] == ["edit"]

    approved = rt.resume(run["id"], "approve", None, "user-1", ROLES)
    assert approved["status"] == "APPROVED"
    assert [d["decision"] for d in approved["decisions"]] == ["edit", "approve"]


def test_edit_that_breaks_a_rule_is_flagged_not_redrafted(make_runtime):
    rt = make_runtime(allocator="greedy")  # the edit targets a trip of the greedy layout
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    edited = rt.resume(run["id"], "edit", [{"op": "move", "orderId": "O-3", "vehicleId": "V-R1", "tripNo": 1}], "user-1", ROLES)
    assert edited["status"] == "NEEDS_APPROVAL"
    assert [v["rule"] for v in edited["violations"]] == ["van_only"]
    assert edited["redrafts"] == 0


def test_edit_validation(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    with pytest.raises(EditError, match="protected"):
        rt.resume(run["id"], "edit", [{"op": "defer", "orderId": "O-7", "reason": "CAP_TIME"}], "user-1", ROLES)
    with pytest.raises(EditError, match="needs at least one edit"):
        rt.resume(run["id"], "edit", [], "user-1", ROLES)
    assert rt.get_run(run["id"])["status"] == "NEEDS_APPROVAL"


def test_resume_node_ignores_non_dispatcher_and_bad_values(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    rt.graph.invoke(Command(resume={"decision": "approve", "roles": ["admin"]}), rt._config(run["id"]))
    rt.graph.invoke(Command(resume={"decision": "publish", "roles": ["dispatcher"]}), rt._config(run["id"]))
    after = rt.get_run(run["id"])
    assert after["status"] == "NEEDS_APPROVAL"
    assert [h["note"] for h in after["history"][-2:]] == ["ignored: only a dispatcher can resume a planning run", "ignored: invalid resume value"]
    assert rt.resume(run["id"], "approve", None, "user-1", ROLES)["status"] == "APPROVED"


def test_ask_is_grounded_and_uses_tools(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")

    res = rt.ask(run["id"], "Where is O-3 and what does V-N1 carry?")
    assert res["toolCalls"] == ["explain_order", "lookup_vehicle"]
    assert "O-3 is on V-N1 trip 1" in res["answer"]
    assert "V-N1 (van, chilled)" in res["answer"]
    assert res["proposal"] is None

    res = rt.ask(run["id"], "Did every rule pass?")
    assert res["toolCalls"] == ["rule_checks"]
    assert "All 8 hard rules pass" in res["answer"]


def test_ask_proposes_an_edit_as_new_draft(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    res = rt.ask(run["id"], "Can we defer O-6 because of the window?")
    assert res["toolCalls"] == ["propose_edit"]
    assert res["proposal"]["edits"] == [{"op": "defer", "orderId": "O-6", "reason": "WINDOW"}]
    assert res["proposal"]["draftVersion"] == run["version"] + 1
    assert "proposal only" in res["answer"]
    # asking never changes the run
    assert rt.get_run(run["id"])["version"] == run["version"]
    # and the dispatcher can apply it
    edited = rt.resume(run["id"], "edit", res["proposal"]["edits"], "user-1", ROLES)
    assert "O-6" in {d["orderId"] for d in edited["deferrals"]}


def test_ask_refuses_to_propose_deferring_a_protected_order(make_runtime):
    rt = make_runtime()
    run = rt.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    res = rt.ask(run["id"], "defer O-7 please")
    assert res["proposal"] is None
    assert "can't propose that" in res["answer"] and "protected" in res["answer"]


def test_unknown_run(make_runtime):
    rt = make_runtime()
    with pytest.raises(RunNotFound):
        rt.get_run("run-nope")


def test_missing_dataset_fails_the_run(make_runtime):
    data = fx.raw()
    rt = make_runtime(data)
    # a scoped tool refuses other depots, so a model asking for them loads nothing
    from lodestar_agent.graph import builder

    original = builder.DATASETS
    try:
        builder.DATASETS = {**original, "extra": ("Extra", "extra")}
        with pytest.raises(RuntimeError, match="could not load planning data: extra"):
            rt2 = make_runtime(data)
            rt2.start_run(fx.DEPOT, fx.RUN_DATE, "user-1")
    finally:
        builder.DATASETS = original
    assert rt  # the first runtime is unaffected


def test_context_tools_query_odata_with_scoped_filters(make_runtime):
    from lodestar_agent.tools import build_context_tools

    from .conftest import odata_mock

    client = odata_mock(fx.raw())
    tools, loaded = build_context_tools(client, fx.DEPOT, fx.RUN_DATE)
    by_name = {t.name: t for t in tools}
    assert "refused" in by_name["fetch_orders"].invoke({"depot": fx.OTHER_DEPOT, "run_date": fx.RUN_DATE})
    assert "refused" in by_name["fetch_calendar"].invoke({"run_date": "2031-01-01"})
    assert "refused" in by_name["fetch_vehicles"].invoke({"depot": fx.OTHER_DEPOT})
    assert "refused" in by_name["fetch_outlets"].invoke({"depot": fx.OTHER_DEPOT})
    assert "refused" in by_name["fetch_district_travel"].invoke({"depot": fx.OTHER_DEPOT})
    assert loaded == {}
    by_name["fetch_orders"].invoke({"depot": fx.DEPOT, "run_date": fx.RUN_DATE})
    by_name["fetch_outlets"].invoke({"depot": fx.DEPOT})
    verify(client).get_all(
        "Orders",
        {"$filter": "runDate ge 2030-01-08T00:00:00Z and runDate lt 2030-01-09T00:00:00Z and status in ('RECEIVED','PLANNED','DEFERRED')"},
    )
    verify(client).get_all("Outlets", {"$filter": "depot eq 'NORTH' and isActive eq true"})
    assert set(loaded) == {"orders", "outlets"}
