"""Run orchestration used by the API: start, read, resume and ask."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from typing import Any

from langchain_core.language_models import BaseChatModel
from langgraph.types import Command

from .domain import approval as approval_rules
from .domain.context import PlanningContext
from .domain.edits import EditError, validate_edit
from .graph.ask import answer_question
from .graph.builder import build_graph
from .checkpoint import Checkpointing
from .llm.router import LLMRouter
from .odata import ODataClient

log = logging.getLogger("lodestar_agent.runtime")

VIEW_KEYS = (
    "depot",
    "runDate",
    "requestedBy",
    "contextSummary",
    "plan",
    "ruleChecks",
    "violations",
    "deferrals",
    "needsReview",
    "explanation",
    "decision",
    "decisions",
    "request",
    "intent",
    "preferences",
    "validation",
    "simulation",
    "approval",
    "committed",
    "llmCalls",
    "constraints",
    "redrafts",
    "revisionOf",
    "locked",
    "history",
)


class RunNotFound(LookupError):
    pass


class RunConflict(RuntimeError):
    pass


class AgentRuntime:
    def __init__(
        self,
        model: BaseChatModel,
        odata_factory: Callable[[], ODataClient],
        checkpointing: Checkpointing,
        *,
        max_redrafts: int = 3,
        first_departure: str = "03:30",
        router: LLMRouter | None = None,
        allocator: str = "greedy",
        allocation_time_limit: float = 30.0,
    ):
        self.model = model
        self.checkpointing = checkpointing
        self.first_departure = first_departure
        self.graph = build_graph(model, odata_factory, checkpointing.saver, max_redrafts=max_redrafts, first_departure=first_departure, router=router or getattr(model, "router", None),
                                 allocator=allocator, allocation_time_limit=allocation_time_limit)

    @staticmethod
    def _config(run_id: str) -> dict[str, Any]:
        return {"configurable": {"thread_id": run_id}, "recursion_limit": 50}

    # ---------------------------------------------------------------- reads
    def _snapshot(self, run_id: str):
        snap = self.graph.get_state(self._config(run_id))
        if not snap or not snap.values or "depot" not in snap.values:
            raise RunNotFound(run_id)
        return snap

    def depot_of(self, run_id: str) -> str:
        return str(self._snapshot(run_id).values["depot"])

    def get_run(self, run_id: str) -> dict[str, Any]:
        snap = self._snapshot(run_id)
        values = snap.values
        waiting = "await_approval" in (snap.next or ()) and any(t.interrupts for t in snap.tasks)
        status = "NEEDS_APPROVAL" if waiting else values.get("status", "DRAFTING")
        view: dict[str, Any] = {"id": run_id, "status": status}
        view.update({k: values[k] for k in VIEW_KEYS if k in values})
        view["version"] = (values.get("plan") or {}).get("version")
        view["llmDegraded"] = bool(values.get("llmDegraded"))
        if values.get("plan"):
            view["hashes"] = approval_rules.hashes(values)
        view["canPublish"] = False  # the agent never publishes; planning does, on a human approval
        return view

    # ---------------------------------------------------------------- writes
    def start_run(self, depot: str, run_date: str, requested_by: str, request: str | None = None) -> dict[str, Any]:
        run_id = f"run-{depot.lower()}-{run_date}-{uuid.uuid4().hex[:8]}"
        initial = {"runId": run_id, "depot": depot, "runDate": run_date, "requestedBy": requested_by, "status": "DRAFTING", "raw": {}}
        if request:
            initial["request"] = request
        log.info("run started", extra={"run_id": run_id, "depot": depot, "run_date": run_date, "sub": requested_by})
        self.graph.invoke(initial, self._config(run_id))
        return self.get_run(run_id)

    def _context(self, run_id: str) -> tuple[PlanningContext, dict[str, Any]]:
        snap = self._snapshot(run_id)
        values = snap.values
        ctx = PlanningContext.from_raw(values.get("raw", {}), values["depot"], values["runDate"], self.first_departure)
        return ctx, self.get_run(run_id)

    def resume(
        self,
        run_id: str,
        decision: str,
        edits: list[dict[str, Any]] | None,
        principal_sub: str,
        roles: list[str],
        comment: str | None = None,
        plan_hash: str | None = None,
    ) -> dict[str, Any]:
        ctx, run = self._context(run_id)
        committed = run.get("committed") or {}
        if decision == "approve" and run["status"] == "APPROVED" and committed and plan_hash and plan_hash == committed.get("planHash"):
            return run  # idempotent retry: the dispatcher re-sent the approval of this exact, committed plan
        if run["status"] != "NEEDS_APPROVAL":
            raise RunConflict(f"run {run_id} is {run['status']}, not waiting for approval")
        if plan_hash and plan_hash != (run.get("hashes") or {}).get("planHash"):
            raise RunConflict(f"run {run_id} changed since you reviewed it: reload and review the current draft")
        if decision == "edit":
            if not edits:
                raise EditError("decision 'edit' needs at least one edit")
            plan = run["plan"]
            for e in edits:
                validate_edit(ctx, plan, e, run.get("locked"))
        payload = {"decision": decision, "edits": edits or [], "by": principal_sub, "roles": roles, "comment": comment}
        log.info("run resumed", extra={"run_id": run_id, "decision": decision, "sub": principal_sub})
        self.graph.invoke(Command(resume=payload), self._config(run_id))
        return self.get_run(run_id)

    def revise_run(
        self,
        from_run_id: str,
        edits: list[dict[str, Any]],
        requested_by: str,
        *,
        version: int | None = None,
        locked: dict[str, Any] | None = None,
        comment: str | None = None,
    ) -> dict[str, Any]:
        """The next version of an approved (live) plan: a new run seeded from it plus the edits, on today's data,
        waiting for a dispatcher like any draft (DSP-12: any later change is a new draft that needs approval).
        ``version`` is the live plan's version (planning's Plans row); ``locked`` the orders and trips that started."""
        ctx, src = self._context(from_run_id)
        if src["status"] != "APPROVED" or not src.get("plan"):
            raise RunConflict(f"run {from_run_id} is {src['status']}: only an approved plan is revised as a new draft; edit this draft instead")
        if not edits:
            raise EditError("a revision needs at least one edit")
        for e in edits:
            validate_edit(ctx, src["plan"], e, locked)
        depot, run_date = src["depot"], src["runDate"]
        run_id = f"run-{depot.lower()}-{run_date}-{uuid.uuid4().hex[:8]}"
        seed = {"fromRunId": from_run_id, "plan": src["plan"], "version": int(version or src["plan"].get("version", 1)), "edits": edits}
        initial: dict[str, Any] = {
            "runId": run_id, "depot": depot, "runDate": run_date, "requestedBy": requested_by, "status": "DRAFTING", "raw": {},
            "seed": seed, "revisionOf": from_run_id, "locked": {"orderIds": list((locked or {}).get("orderIds") or []), "trips": list((locked or {}).get("trips") or [])},
        }
        if comment:
            seed["comment"] = comment
        log.info("revision started", extra={"run_id": run_id, "from_run": from_run_id, "sub": requested_by})
        self.graph.invoke(initial, self._config(run_id))
        return self.get_run(run_id)

    def ask(self, run_id: str, question: str) -> dict[str, Any]:
        ctx, run = self._context(run_id)
        if "plan" not in run:
            raise RunConflict(f"run {run_id} has no draft yet")
        result = answer_question(self.model, ctx, run, question)
        log.info("ask answered", extra={"run_id": run_id, "tools": result["toolCalls"]})
        return {"runId": run_id, **result}
