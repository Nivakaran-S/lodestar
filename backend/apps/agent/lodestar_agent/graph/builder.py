"""The planning StateGraph (PLATFORM.md section 4; docs/architecture/PLANNER_AGENT.md). Plan -> Execute -> Verify:

load_context -> classify_intent -(EXPLAIN_ONLY | CAPACITY_RISK)-> answer_only -> END
                                -(PLAN_DAY | REPLAN)-> extract_preferences -> draft_plan
draft_plan -> check_rules (+ independent validator) -(errors, <= max_redrafts repairs)-> draft_plan
                                                    -> rank_deferrals -> simulate_plan -> explain -> await_approval
await_approval (interrupt) -> approve -> commit (approval bound to plan/validation/simulation hashes) -> END
                           -> reject -> END
                           -> edit -> apply_edits -> check_rules -> ...
LLM calls go through the router (never a provider): classify_intent, extract_preferences and explain, at most 3
per draft and only the explanation when the run has no request text. Allocation, validation, simulation and commit
are deterministic. The graph has no node that publishes: commit records the bound human approval.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from ..domain import approval as approval_rules
from ..domain import deferral_notes
from ..domain import deferrals as deferral_rules
from ..domain import edits as edit_rules
from ..domain import planner, rules
from ..domain.context import PlanningContext
from ..domain.simulation import simulate_plan as simulate
from ..domain.validator import repair_constraints, validate_plan
from ..llm import tasks as llm_tasks
from ..llm.metrics import METRICS
from ..llm.router import LLMRouter, RouterResult
from ..odata import ODataClient
from ..tools import DATASETS, build_context_tools
from .state import AgentState

log = logging.getLogger("lodestar_agent.graph")

MAX_TOOL_ROUNDS = 3


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_tool_loop(model: BaseChatModel, tools: list[BaseTool], messages: list[BaseMessage], max_rounds: int = MAX_TOOL_ROUNDS) -> list[BaseMessage]:
    """Let the model pick tools, execute them, feed results back; stop when it answers."""
    by_name = {t.name: t for t in tools}
    bound = model.bind_tools(tools)
    for _ in range(max_rounds):
        ai: AIMessage = bound.invoke(messages)  # type: ignore[assignment]
        messages.append(ai)
        if not ai.tool_calls:
            break
        for call in ai.tool_calls:
            tool = by_name.get(call["name"])
            content = tool.invoke(call["args"]) if tool else json.dumps({"error": f"unknown tool {call['name']}"})
            messages.append(ToolMessage(content=str(content), tool_call_id=call["id"], name=call["name"]))
    return messages


def build_graph(
    model: BaseChatModel,
    odata_factory: Callable[[], ODataClient],
    checkpointer: BaseCheckpointSaver,
    *,
    max_redrafts: int = 3,
    first_departure: str = "03:30",
    router: LLMRouter | None = None,
    allocator: str = "exact",
    allocation_time_limit: float = 30.0,
):
    router = router or LLMRouter([])  # no provider: deterministic templates

    def ctx_of(state: AgentState) -> PlanningContext:
        return PlanningContext.from_raw(state.get("raw", {}), state["depot"], state["runDate"], first_departure)

    def llm_update(result: RouterResult | None = None, audit: dict[str, Any] | None = None) -> dict[str, Any]:
        audit = audit or (result.audit() if result else None)
        if not audit:
            return {}
        update: dict[str, Any] = {"llmCalls": [audit]}
        if audit.get("degraded"):
            update["llmDegraded"] = True
        return update

    def compact(ctx: PlanningContext) -> dict[str, Any]:
        """The few numbers the LLM sees: never order / outlet tables."""
        s = ctx.summary()
        return {
            "depot": ctx.depot,
            "runDate": ctx.run_date,
            "orders": s["orders"],
            "vehicles": s["vehicles"],
            "vehiclesDown": len(s["vehiclesDown"]),
            "chilledM3": s["chilledDemand"]["m3"],
            "reeferM3": s["reeferCapacity"]["m3"],
            "previouslyDeferred": sum(1 for o in ctx.orders.values() if o.get("deferredYesterday")),
        }

    # ---------------------------------------------------------------- route + preferences (LLM, enum outputs only)
    def classify_intent(state: AgentState) -> dict[str, Any]:
        request = (state.get("request") or "").strip()
        if not request:
            return {"intent": "PLAN_DAY", "history": [{"node": "classify_intent", "at": _now(), "note": "PLAN_DAY (no request text)"}]}
        result = llm_tasks.classify_intent(router, request, compact(ctx_of(state)), state.get("runId"))
        intent = result.data.intent
        return {"intent": intent, **llm_update(result), "history": [{"node": "classify_intent", "at": _now(), "note": f"{intent} via {result.provider}"}]}

    def route_after_intent(state: AgentState) -> str:
        return "answer_only" if state.get("intent") in ("EXPLAIN_ONLY", "CAPACITY_RISK") else "extract_preferences"

    def extract_preferences(state: AgentState) -> dict[str, Any]:
        request = (state.get("request") or "").strip()
        if not request:
            return {"preferences": {"preferences": [], "focusDistrict": None}, "history": [{"node": "extract_preferences", "at": _now(), "note": "none"}]}
        ctx = ctx_of(state)
        districts = sorted({ctx.district_of(o) for o in ctx.orders})
        result = llm_tasks.extract_preferences(router, request, districts, ctx.run_date, state.get("runId"))
        prefs = result.data.model_dump()
        note = ", ".join(prefs["preferences"]) or "none"
        return {
            "preferences": prefs,
            "constraints": preference_constraints(ctx, prefs),
            **llm_update(result),
            "history": [{"node": "extract_preferences", "at": _now(), "note": f"{note} via {result.provider}"}],
        }

    def answer_only(state: AgentState) -> dict[str, Any]:
        """EXPLAIN_ONLY / CAPACITY_RISK: deterministic facts, phrased; no draft, nothing to approve or commit."""
        ctx = ctx_of(state)
        s = ctx.summary()
        dem, cap = s["chilledDemand"], s["reeferCapacity"]
        short = round(dem["m3"] - cap["m3"], 1)
        lines = [
            f"{s['orders']} open orders for {ctx.depot} on {ctx.run_date}; {s['vehicles'] - len(s['vehiclesDown'])} of {s['vehicles']} vehicles available"
            + (f" ({', '.join(s['vehiclesDown'])} not available)." if s["vehiclesDown"] else "."),
            f"Chilled demand {dem['m3']} m3 against {cap['m3']} m3 of available reefers" + (f": short {short} m3." if short > 0 else ": covered."),
            "No plan was drafted for this request. Start a planning run without it to draft one.",
        ]
        result = llm_tasks.phrase(router, "explain", "\n".join(lines), state.get("request") or "", run_date=ctx.run_date, run_id=state.get("runId"))
        return {
            "status": "ANSWERED",
            "explanation": {"text": result.data.text, "did": lines, "checked": []},
            **llm_update(result),
            "history": [{"node": "answer_only", "at": _now(), "note": state.get("intent", "")}],
        }

    # ---------------------------------------------------------------- nodes
    def load_context(state: AgentState) -> dict[str, Any]:
        raw = dict(state.get("raw") or {})
        missing = [name for name, (_, key) in DATASETS.items() if key not in raw]
        tools, loaded = build_context_tools(odata_factory(), state["depot"], state["runDate"])
        messages: list[BaseMessage] = [
            SystemMessage("[task:load_context]\nYou load planning data for one depot and run date. Call a fetch tool for every missing dataset."),
            HumanMessage(json.dumps({"depot": state["depot"], "run_date": state["runDate"], "missing": missing})),
        ]
        messages = run_tool_loop(model, tools, messages)
        raw.update(loaded)
        still_missing = [name for name, (_, key) in DATASETS.items() if key not in raw]
        if still_missing:
            raise RuntimeError(f"could not load planning data: {', '.join(still_missing)}")
        ctx = PlanningContext.from_raw(raw, state["depot"], state["runDate"], first_departure)
        note = str(messages[-1].content) if messages else ""
        return {
            "raw": raw,
            "status": "DRAFTING",
            "contextSummary": ctx.summary(),
            "constraints": [],
            "redrafts": 0,
            "editMode": False,
            "history": [{"node": "load_context", "at": _now(), "note": note}],
        }

    def draft_plan(state: AgentState) -> dict[str, Any]:
        ctx = ctx_of(state)
        version = int((state.get("plan") or {}).get("version", 0)) + 1
        # the exact solver runs on the first draft only: when it wins its plan is rule-clean (no repair needed), and a
        # repair redraft uses the fast greedy draft, so a run waits for at most one solve
        method = allocator if not int(state.get("redrafts") or 0) else "greedy"
        plan = planner.draft_best(ctx, state.get("constraints") or [], version, method, allocation_time_limit)
        alloc = plan.get("allocation") or {}
        how = "exact allocation" if alloc.get("method") == "exact" else "greedy draft"
        note = f"v{version}: {len(plan['trips'])} trips, {len(plan['unassigned'])} unplaced ({how})"
        return {"plan": plan, "redraftRequested": False, "history": [{"node": "draft_plan", "at": _now(), "note": note}]}

    def check_rules(state: AgentState) -> dict[str, Any]:
        ctx = ctx_of(state)
        checks, violations = rules.check_rules(ctx, state["plan"])
        decided = {d["orderId"] for d in state.get("deferrals") or []} | {n["orderId"] for n in state.get("needsReview") or []}
        validation = validate_plan(ctx, state["plan"], decided)
        update: dict[str, Any] = {"ruleChecks": checks, "violations": violations, "validation": validation, "redraftRequested": False}
        redrafts = int(state.get("redrafts") or 0)
        structural = repair_constraints(validation)
        if (violations or structural) and not state.get("editMode") and redrafts < max_redrafts:
            update["constraints"] = rules.constraints_for(violations, state.get("constraints") or []) + structural
            update["redrafts"] = redrafts + 1
            update["redraftRequested"] = True
            METRICS.incr("repairs")
        failed = sorted({v["rule"] for v in violations} | {e["code"] for e in validation["errors"] if not e["rule"]})
        update["history"] = [{"node": "check_rules", "at": _now(), "note": f"all {len(rules.RULES)} pass" if not failed else "violations: " + ", ".join(failed)}]
        return update

    def route_after_check(state: AgentState) -> str:
        return "draft_plan" if state.get("redraftRequested") else "rank_deferrals"

    def rank_deferrals(state: AgentState) -> dict[str, Any]:
        ctx = ctx_of(state)
        result = deferral_rules.rank_deferrals(ctx, state["plan"], state.get("violations") or [], strip_violations=not state.get("editMode"))
        checks, violations = rules.check_rules(ctx, result["plan"])
        decided = {d["orderId"] for d in result["deferrals"]} | {n["orderId"] for n in result["needsReview"]}
        return {
            "plan": result["plan"],
            "validation": validate_plan(ctx, result["plan"], decided),
            "deferrals": deferral_notes.annotate(ctx, result["deferrals"]),
            "needsReview": result["needsReview"],
            "actions": result["actions"],
            "ruleChecks": checks,
            "violations": violations,
            "history": [{"node": "rank_deferrals", "at": _now(), "note": f"{len(result['deferrals'])} candidates, {len(result['needsReview'])} review"}],
        }

    def simulate_plan(state: AgentState) -> dict[str, Any]:
        sim = simulate(ctx_of(state), state["plan"], state.get("deferrals"), state.get("needsReview"))
        codes = sorted({w["code"] for w in sim["warnings"]})
        note = f"{sim['served']} served, {sim['deferred']} deferred" + (f"; {', '.join(codes)}" if codes else "")
        return {"simulation": sim, "history": [{"node": "simulate_plan", "at": _now(), "note": note}]}

    def explain(state: AgentState) -> dict[str, Any]:
        ctx = ctx_of(state)
        plan = state["plan"]
        summary = ctx.summary()
        vehicles = sorted({t["vehicleId"] for t in plan["trips"]})
        planned = sum(len(t["orderIds"]) for t in plan["trips"])
        dem, cap = summary["chilledDemand"], summary["reeferCapacity"]
        did = [
            f"Read {summary['orders']} open orders, {summary['vehicles']} vehicles and {summary['outlets']} outlets for {state['depot']} through OData.",
        ]
        if summary["vehiclesDown"]:
            did.append(f"Left out vehicles not available today: {', '.join(summary['vehiclesDown'])}.")
        short = round(dem["m3"] - cap["m3"], 1)
        did.append(f"Chilled demand {dem['m3']} m3 against {cap['m3']} m3 of available reefers" + (f" (short {short} m3)." if short > 0 else "."))
        did.append(
            f"Packed {planned} orders onto {len(plan['trips'])} trips on {len(vehicles)} vehicles: chilled on reefers, van_only on vans, "
            "one brand and one district per trip, at most 2 trips per vehicle."
        )
        if state.get("redrafts"):
            fixed = sorted({c.get("rule", "?") for c in state.get("constraints") or [] if c.get("rule") != "preference"})
            did.append(f"Redrafted {state['redrafts']} time(s) to fix {', '.join(fixed)}.")
        if state.get("editMode") and state.get("lastEdits"):
            did.append("Applied your edits: " + "; ".join(state["lastEdits"]) + ".")
        did.extend(state.get("actions") or [])
        deferrals = state.get("deferrals") or []
        if deferrals:
            did.append(f"Ranked {len(deferrals)} deferral candidate(s), lowest score first: " + ", ".join(f"{d['orderId']} {d['reason']}" for d in deferrals) + ".")
        review = state.get("needsReview") or []
        if review:
            did.append("Protected and never deferred, needs your call: " + ", ".join(r["orderId"] for r in review) + ".")
        checked = [f"{'pass' if c['passed'] else 'FAIL'} - {c['label']}" + ("" if c["passed"] else f" ({c['violations']})") for c in state.get("ruleChecks") or []]
        stats = {
            "version": plan.get("version", 1),
            "depot": state["depot"],
            "runDate": state["runDate"],
            "orders": summary["orders"],
            "planned": planned,
            "trips": len(plan["trips"]),
            "vehicles": len(vehicles),
            "deferrals": len(deferrals),
            "needsReview": len(review),
        }
        ai = model.invoke(
            [
                SystemMessage("[task:explain]\nWrite the 'What it did / What it checked' panel for the dispatcher from these facts only."),
                HumanMessage(json.dumps({"did": did, "checked": checked, "stats": stats})),
            ]
        )
        audit = (getattr(ai, "response_metadata", None) or {}).get("llm")
        degraded = bool(state.get("llmDegraded") or (audit or {}).get("degraded"))
        text = str(ai.content)
        if degraded:
            METRICS.incr("degradedRuns")
            text = "LLM_DEGRADED: the language models were unavailable, so this is the deterministic text. The plan is unaffected.\n\n" + text
        explanation: dict[str, Any] = {"text": text, "did": did, "checked": checked}
        if audit:
            explanation["llm"] = {k: audit.get(k) for k in ("provider", "model", "fallbackReason", "degraded")}
        return {
            "explanation": explanation,
            "status": "NEEDS_APPROVAL",
            **llm_update(audit=audit),
            "history": [{"node": "explain", "at": _now()}],
        }

    def await_approval(state: AgentState) -> dict[str, Any]:
        resume = interrupt(
            {
                "runId": state["runId"],
                "status": "NEEDS_APPROVAL",
                "version": state["plan"].get("version", 1),
                "ask": "Approve & go live, edit, or reject. The agent cannot publish.",
            }
        )
        # Defence in depth (the API already checked): a bad or unauthorised resume is
        # recorded and ignored, and the run goes back to waiting for a dispatcher.
        problem = None
        if not isinstance(resume, dict) or resume.get("decision") not in ("approve", "edit", "reject"):
            problem = "invalid resume value"
        elif "dispatcher" not in (resume.get("roles") or []):
            problem = "only a dispatcher can resume a planning run"
        if problem:
            log.warning("resume ignored", extra={"run_id": state["runId"], "reason": problem})
            return {"status": "NEEDS_APPROVAL", "history": [{"node": "await_approval", "at": _now(), "note": f"ignored: {problem}"}]}
        record = {"decision": resume["decision"], "by": resume.get("by"), "at": _now(), "version": state["plan"].get("version", 1)}
        if resume.get("comment"):
            record["comment"] = resume["comment"]
        update: dict[str, Any] = {"decision": record, "decisions": [record], "history": [{"node": "await_approval", "at": _now(), "note": resume["decision"]}]}
        if resume["decision"] == "approve":
            # bound to this exact plan / validation / simulation; commit re-checks the hashes
            update["approval"] = approval_rules.bind(state, resume.get("by"), record["at"])
            update["status"] = "APPROVED"
        elif resume["decision"] == "reject":
            update["status"] = "REJECTED"
        else:
            update["status"] = "DRAFTING"
            update["pendingEdits"] = list(resume.get("edits") or [])
        return update

    def route_after_approval(state: AgentState) -> str:
        status = state.get("status")
        if status == "NEEDS_APPROVAL":
            return "await_approval"
        if status == "APPROVED":
            return "commit"
        return "apply_edits" if status == "DRAFTING" else END

    def commit(state: AgentState) -> dict[str, Any]:
        """Record the approval for this exact plan (idempotent). Publishing stays with the planning service."""
        approval = state.get("approval")
        if not approval_rules.matches(state, approval):
            return {"status": "NEEDS_APPROVAL", "approval": None, "history": [{"node": "commit", "at": _now(), "note": "approval does not match the plan: approve again"}]}
        if (state.get("committed") or {}).get("planHash") == approval["planHash"]:
            return {"history": [{"node": "commit", "at": _now(), "note": "already committed"}]}
        return {"committed": approval, "status": "APPROVED", "history": [{"node": "commit", "at": _now(), "note": f"v{approval['version']} by {approval['by']}"}]}

    def route_after_commit(state: AgentState) -> str:
        return "await_approval" if state.get("status") == "NEEDS_APPROVAL" else END

    def apply_edits(state: AgentState) -> dict[str, Any]:
        ctx = ctx_of(state)
        plan, applied = edit_rules.apply_edits(ctx, state["plan"], state.get("pendingEdits") or [])
        return {"plan": plan, "editMode": True, "lastEdits": applied, "pendingEdits": [], "approval": None, "history": [{"node": "apply_edits", "at": _now(), "note": "; ".join(applied)}]}

    # ---------------------------------------------------------------- wiring
    g = StateGraph(AgentState)
    g.add_node("load_context", load_context)
    g.add_node("classify_intent", classify_intent)
    g.add_node("extract_preferences", extract_preferences)
    g.add_node("answer_only", answer_only)
    g.add_node("draft_plan", draft_plan)
    g.add_node("check_rules", check_rules)
    g.add_node("rank_deferrals", rank_deferrals)
    g.add_node("simulate_plan", simulate_plan)
    g.add_node("explain", explain)
    g.add_node("await_approval", await_approval)
    g.add_node("commit", commit)
    g.add_node("apply_edits", apply_edits)
    g.add_edge(START, "load_context")
    g.add_edge("load_context", "classify_intent")
    g.add_conditional_edges("classify_intent", route_after_intent, ["answer_only", "extract_preferences"])
    g.add_edge("answer_only", END)
    g.add_edge("extract_preferences", "draft_plan")
    g.add_edge("draft_plan", "check_rules")
    g.add_conditional_edges("check_rules", route_after_check, ["draft_plan", "rank_deferrals"])
    g.add_edge("rank_deferrals", "simulate_plan")
    g.add_edge("simulate_plan", "explain")
    g.add_edge("explain", "await_approval")
    g.add_conditional_edges("await_approval", route_after_approval, ["await_approval", "apply_edits", "commit", END])
    g.add_conditional_edges("commit", route_after_commit, ["await_approval", END])
    g.add_edge("apply_edits", "check_rules")
    return g.compile(checkpointer=checkpointer)


def preference_constraints(ctx: PlanningContext, prefs: dict[str, Any]) -> list[dict[str, Any]]:
    """Enum preferences -> the drafter's existing 'prioritise' constraints (which groups it packs first)."""
    chosen = set(prefs.get("preferences") or [])
    picks = {
        "PRIORITISE_CHILLED": lambda o: ctx.needs_reefer(o),
        "PRIORITISE_PREVIOUSLY_DEFERRED": lambda o: bool(ctx.orders[o].get("deferredYesterday")),
        "PRIORITISE_MALL_WINDOWS": lambda o: ctx.is_mall(o),
        "PRIORITISE_VAN_ONLY": lambda o: ctx.needs_van(o),
        "PRIORITISE_DISTRICT": lambda o: ctx.district_of(o) == prefs.get("focusDistrict"),
    }
    out = []
    for name, pick in picks.items():
        if name in chosen:
            oids = sorted(o for o in ctx.orders if pick(o))
            if oids:
                out.append({"type": "prioritise", "orderIds": oids, "reason": name, "rule": "preference"})
    return out
