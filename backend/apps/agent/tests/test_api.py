"""HTTP API: /runs, /runs/{id}, /runs/{id}/resume, /ask, /health, /ready."""

from __future__ import annotations

from fastapi.testclient import TestClient
from mockito import when

from lodestar_agent.app import create_app
from lodestar_agent.odata import ODataError, ServiceAuthError

from . import fixtures as fx
from .conftest import bearer

START = {"depot": fx.DEPOT.lower(), "runDate": fx.RUN_DATE}


def start(api, make_token) -> str:
    r = api.post("/runs", json=START, headers=bearer(make_token()))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "NEEDS_APPROVAL" and body["version"] == 1
    return body["id"]


def test_health_and_ready_are_open(api):
    assert api.get("/health").json() == {"status": "ok"}
    assert api.get("/ready").json() == {"status": "ready", "checkpointer": "memory"}


def test_ready_503_when_checkpoint_db_down(api):
    runtime = api.app.state.runtime
    when(runtime.checkpointing).ready().thenReturn(False)
    assert api.get("/ready").status_code == 503


def test_full_http_flow_edit_then_approve(api, make_token):
    run_id = start(api, make_token)
    h = bearer(make_token())

    run = api.get(f"/runs/{run_id}", headers=h).json()
    assert run["status"] == "NEEDS_APPROVAL" and run["canPublish"] is False
    assert "raw" not in run and len(run["ruleChecks"]) == 8
    assert run["explanation"]["text"].startswith("Draft v1 for NORTH")

    ask = api.post("/ask", json={"runId": run_id, "question": "move O-6 to V-R1"}, headers=h).json()
    assert ask["toolCalls"] == ["propose_edit"]
    assert ask["proposal"] is None  # O-6 is ambient Style; V-R1 trips are Fresh -> refused with a reason
    assert "one brand and one district per trip" in ask["answer"]

    r = api.post(f"/runs/{run_id}/resume", json={"decision": "edit", "edits": [{"op": "defer", "orderId": "O-5", "reason": "WINDOW"}]}, headers=h)
    assert r.status_code == 200 and r.json()["version"] == 2

    r = api.post(f"/runs/{run_id}/resume", json={"decision": "approve", "comment": "go"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "APPROVED"
    assert r.json()["decision"]["by"] == "user-1"

    r = api.post(f"/runs/{run_id}/resume", json={"decision": "reject"}, headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "Conflict"


def test_validation_errors(api, make_token):
    h = bearer(make_token())
    r = api.post("/runs", json={"depot": "NORTH", "runDate": "not-a-date"}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "ValidationError"
    assert api.post("/runs", json={**START, "extra": 1}, headers=h).status_code == 422
    run_id = start(api, make_token)
    bad = [
        {"decision": "publish"},
        {"decision": "edit", "edits": [{"op": "move", "orderId": "O-1"}]},
        {"decision": "edit", "edits": [{"op": "defer", "orderId": "O-1"}]},
    ]
    for body in bad:
        assert api.post(f"/runs/{run_id}/resume", json=body, headers=h).status_code == 422, body
    r = api.post(f"/runs/{run_id}/resume", json={"decision": "edit", "edits": [{"op": "defer", "orderId": "O-7", "reason": "FUEL"}]}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "InvalidEdit"
    r = api.post(f"/runs/{run_id}/resume", json={"decision": "edit", "edits": [{"op": "move", "orderId": "O-1", "vehicleId": "V-R2"}]}, headers=h)
    assert r.status_code == 422 and "not available" in r.json()["error"]["message"]
    assert api.post("/ask", json={"runId": run_id, "question": ""}, headers=h).status_code == 422


def test_unknown_run_is_404(api, make_token):
    h = bearer(make_token())
    assert api.get("/runs/run-missing", headers=h).status_code == 404
    assert api.post("/ask", json={"runId": "run-missing", "question": "hi"}, headers=h).status_code == 404


def test_upstream_errors_map_to_502(settings, make_runtime, verifier, make_token):
    runtime = make_runtime()
    when(runtime.odata).get_all("Orders", ...).thenRaise(ODataError(503, "Unavailable", "orders down"))
    with TestClient(create_app(settings=settings, runtime=runtime, verifier=verifier)) as api:
        r = api.post("/runs", json=START, headers=bearer(make_token()))
        assert r.status_code == 502 and "orders down" in r.json()["error"]["message"]

    when(runtime.odata).get_all("Orders", ...).thenRaise(ServiceAuthError("no secret"))
    with TestClient(create_app(settings=settings, runtime=runtime, verifier=verifier)) as api:
        r = api.post("/runs", json=START, headers=bearer(make_token()))
        assert r.status_code == 502 and r.json()["error"]["code"] == "ServiceIdentityError"


def test_non_operating_day_is_refused_with_422(settings, make_runtime, verifier, make_token):
    data = fx.raw()
    data["calendar"] = [{**c, "isOperating": c["date"] != fx.RUN_DATE} for c in data["calendar"]]
    with TestClient(create_app(settings=settings, runtime=make_runtime(data), verifier=verifier)) as api:
        r = api.post("/runs", json=START, headers=bearer(make_token()))
        assert r.status_code == 422 and r.json()["error"]["code"] == "NonOperatingDay"
        assert fx.RUN_DATE in r.json()["error"]["message"]


def test_request_id_is_echoed(api, make_token):
    r = api.get("/runs/run-x", headers={**bearer(make_token()), "x-request-id": "abc123"})
    assert r.headers["x-request-id"] == "abc123"


def approve(api, make_token) -> str:
    run_id = start(api, make_token)
    r = api.post(f"/runs/{run_id}/resume", json={"decision": "approve"}, headers=bearer(make_token()))
    assert r.status_code == 200 and r.json()["status"] == "APPROVED"
    return run_id


def test_a_change_to_an_approved_plan_is_a_new_draft_of_the_next_version(api, make_token):
    """DSP-12: any later change to a live plan is a new draft (the next version) that needs approval."""
    run_id = approve(api, make_token)
    h = bearer(make_token())
    live = api.get(f"/runs/{run_id}", headers=h).json()
    # the approved run itself takes no edits
    r = api.post(f"/runs/{run_id}/resume", json={"decision": "edit", "edits": [{"op": "defer", "orderId": "O-5", "reason": "WINDOW"}]}, headers=h)
    assert r.status_code == 409 and "not waiting for approval" in r.json()["error"]["message"]

    r = api.post(f"/runs/{run_id}/revise", json={"edits": [{"op": "defer", "orderId": "O-5", "reason": "WINDOW"}], "version": 1, "comment": "store asked"}, headers=h)
    assert r.status_code == 201, r.text
    v2 = r.json()
    assert v2["id"] != run_id and v2["status"] == "NEEDS_APPROVAL" and v2["version"] == 2 and v2["revisionOf"] == run_id
    assert not any("O-5" in t["orderIds"] for t in v2["plan"]["trips"])
    assert any(n["node"] == "seed_plan" for n in v2["history"]) and not any(n["node"] == "draft_plan" for n in v2["history"])
    # the rest of the live plan is kept as it was
    kept = {(t["vehicleId"], o) for t in live["plan"]["trips"] for o in t["orderIds"] if o != "O-5"}
    assert kept <= {(t["vehicleId"], o) for t in v2["plan"]["trips"] for o in t["orderIds"]}
    assert any("Started from the live plan v1" in d for d in v2["explanation"]["did"])
    # the new draft goes through the normal approval
    r = api.post(f"/runs/{v2['id']}/resume", json={"decision": "approve"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "APPROVED"


def test_a_revision_leaves_started_trips_alone(api, make_token):
    run_id = approve(api, make_token)
    h = bearer(make_token())
    live = api.get(f"/runs/{run_id}", headers=h).json()
    trip = live["plan"]["trips"][0]
    oid = trip["orderIds"][0]
    locked = {"lockedOrderIds": trip["orderIds"], "lockedTrips": [{"vehicleId": trip["vehicleId"], "tripNo": trip["tripNo"]}]}
    r = api.post(f"/runs/{run_id}/revise", json={"edits": [{"op": "defer", "orderId": oid, "reason": "WINDOW"}], **locked}, headers=h)
    assert r.status_code == 422 and "already started" in r.json()["error"]["message"]
    other = next(o for t in live["plan"]["trips"][1:] for o in t["orderIds"] if o not in trip["orderIds"])
    r = api.post(f"/runs/{run_id}/revise", json={"edits": [{"op": "move", "orderId": other, "vehicleId": trip["vehicleId"], "tripNo": trip["tripNo"]}], **locked}, headers=h)
    assert r.status_code == 422 and "already started" in r.json()["error"]["message"]
    # the new draft keeps them locked for later edits too
    free = next((o for o in live["plan"]["unassigned"] if o["orderId"] not in trip["orderIds"]), None) or {"orderId": "O-5"}
    r = api.post(f"/runs/{run_id}/revise", json={"edits": [{"op": "defer", "orderId": free["orderId"], "reason": "WINDOW"}], **locked}, headers=h)
    assert r.status_code == 201, r.text
    v2 = r.json()
    assert v2["locked"]["orderIds"] == trip["orderIds"]
    r = api.post(f"/runs/{v2['id']}/resume", json={"decision": "edit", "edits": [{"op": "defer", "orderId": oid, "reason": "WINDOW"}]}, headers=h)
    assert r.status_code == 422 and "already started" in r.json()["error"]["message"]


def test_only_an_approved_run_is_revised(api, make_token):
    run_id = start(api, make_token)
    h = bearer(make_token())
    r = api.post(f"/runs/{run_id}/revise", json={"edits": [{"op": "defer", "orderId": "O-5", "reason": "WINDOW"}]}, headers=h)
    assert r.status_code == 409 and "edit this draft instead" in r.json()["error"]["message"]
    assert api.post(f"/runs/{run_id}/revise", json={"edits": []}, headers=h).status_code == 422
