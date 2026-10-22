"""Typed LangGraph state for a planning run (JSON-serialisable for the Postgres checkpointer)."""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict

RunStatus = Literal["DRAFTING", "NEEDS_APPROVAL", "APPROVED", "REJECTED", "FAILED", "ANSWERED"]
Decision = Literal["approve", "edit", "reject"]


class RuleCheck(TypedDict):
    rule: str
    label: str
    passed: bool
    violations: int


class Violation(TypedDict):
    rule: str
    tripId: str
    vehicleId: str
    orderIds: list[str]
    reason: str
    detail: str


class Deferral(TypedDict):
    orderId: str
    outletId: str
    reason: str
    score: int
    suggested: bool
    m3: float
    rank: int


class Explanation(TypedDict):
    text: str
    did: list[str]
    checked: list[str]


class HistoryEntry(TypedDict, total=False):
    node: str
    at: str
    note: str


class AgentState(TypedDict, total=False):
    # identity of the run
    runId: str
    depot: str
    runDate: str
    requestedBy: str
    status: RunStatus
    # the dispatcher's optional request text and what the LLM made of it (enum values only)
    request: str
    intent: str
    preferences: dict[str, Any]
    # load_context
    raw: dict[str, list[dict[str, Any]]]
    contextSummary: dict[str, Any]
    # draft_plan / check_rules loop
    plan: dict[str, Any]
    constraints: list[dict[str, Any]]
    redrafts: int
    redraftRequested: bool
    ruleChecks: list[RuleCheck]
    violations: list[Violation]
    # rank_deferrals
    deferrals: list[Deferral]
    needsReview: list[dict[str, Any]]
    actions: list[str]
    # independent validator (rule codes) and the deterministic dry run
    validation: dict[str, Any]
    simulation: dict[str, Any]
    # explain
    explanation: Explanation
    # LLM audit: provider, model, fallback reason, tokens per call (no prompts, no keys)
    llmCalls: Annotated[list[dict[str, Any]], operator.add]
    llmDegraded: bool
    # a revision of a live plan: {fromRunId, plan, version, edits}; orders and trips it must leave alone
    seed: dict[str, Any]
    revisionOf: str
    locked: dict[str, Any]
    # human in the loop
    editMode: bool
    pendingEdits: list[dict[str, Any]]
    lastEdits: list[str]
    decision: dict[str, Any]
    approval: dict[str, Any] | None
    committed: dict[str, Any]
    decisions: Annotated[list[dict[str, Any]], operator.add]
    history: Annotated[list[HistoryEntry], operator.add]
