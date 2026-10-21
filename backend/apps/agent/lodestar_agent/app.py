"""FastAPI application factory."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .agent_config import agent_config
from .api.schemas import AskRequest, ResumeRequest, StartRunRequest, StartRunResponse
from .auth import Principal, TokenVerifier, require_depot, require_roles
from .checkpoint import create_checkpointing
from .config import Settings, get_settings
from .domain.edits import EditError
from .domain.planner import NonOperatingDay
from .llm import chat_model_or_mock, router_for
from .logging_setup import configure_logging
from .odata import ODataClient, ODataError, ServiceAuthError, ServiceTokenProvider
from .runtime import AgentRuntime, RunConflict, RunNotFound

log = logging.getLogger("lodestar_agent.api")


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


def build_runtime(settings: Settings) -> tuple[AgentRuntime, list[Any]]:
    """Wire the real dependencies. Returns the runtime and things to close on shutdown."""
    checkpointing = create_checkpointing(settings)
    model = chat_model_or_mock(settings)
    http = httpx.Client(timeout=settings.http_timeout_s, verify=settings.odata_ca_bundle or True, follow_redirects=False)
    tokens = ServiceTokenProvider(http, settings.token_url, settings.oidc_client_id, settings.client_secret(), settings.oidc_scope)

    def odata_factory() -> ODataClient:
        return ODataClient(http, tokens, settings.lodestar_api_url, settings.service_urls, settings.odata_max_pages)

    runtime = AgentRuntime(
        model,
        odata_factory,
        checkpointing,
        max_redrafts=settings.max_redrafts,
        first_departure=settings.first_departure,
        router=router_for(settings, model),
        allocator=settings.allocator,
        allocation_time_limit=settings.allocation_time_limit_s,
    )
    return runtime, [http.close, checkpointing.close]


def create_app(settings: Settings | None = None, runtime: AgentRuntime | None = None, verifier: TokenVerifier | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        closers: list[Any] = []
        if getattr(app.state, "runtime", None) is None:
            app.state.runtime, closers = build_runtime(settings)
        log.info("agent service started", extra={"model": settings.agent_model, "checkpointer": app.state.runtime.checkpointing.kind})
        try:
            yield
        finally:
            for close in closers:
                close()

    app = FastAPI(title="Lodestar planning agent", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.runtime = runtime
    app.state.verifier = verifier or TokenVerifier(settings.oidc_issuer, settings.oidc_audience, settings.jwks_url, settings.jwt_leeway_s)

    # ------------------------------------------------------------ middleware + errors
    @app.middleware("http")
    async def access_log(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["x-request-id"] = rid
        if request.url.path not in ("/health", "/ready"):
            log.info(
                "request",
                extra={
                    "request_id": rid,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "ms": round((time.perf_counter() - started) * 1000, 1),
                    "sub": getattr(request.state, "principal_sub", None),
                },
            )
        return response

    @app.exception_handler(RunNotFound)
    async def _not_found(_: Request, exc: RunNotFound):
        return _error(404, "NotFound", f"run {exc} not found")

    @app.exception_handler(RunConflict)
    async def _conflict(_: Request, exc: RunConflict):
        return _error(409, "Conflict", str(exc))

    @app.exception_handler(EditError)
    async def _bad_edit(_: Request, exc: EditError):
        return _error(422, "InvalidEdit", str(exc))

    @app.exception_handler(NonOperatingDay)
    async def _non_operating(_: Request, exc: NonOperatingDay):
        return _error(422, "NonOperatingDay", str(exc))

    @app.exception_handler(ODataError)
    async def _odata(_: Request, exc: ODataError):
        log.error("odata upstream error", extra={"status": exc.status, "code": exc.code})
        return _error(502, "UpstreamError", f"OData {exc.status} {exc.code}: {exc.message}")

    @app.exception_handler(ServiceAuthError)
    async def _svc_auth(_: Request, exc: ServiceAuthError):
        log.error("service identity error", extra={"detail": str(exc)})
        return _error(502, "ServiceIdentityError", "the agent could not obtain its service token")

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        msgs = "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
        return _error(422, "ValidationError", msgs)

    def rt(request: Request) -> AgentRuntime:
        return request.app.state.runtime

    # ------------------------------------------------------------ health
    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", include_in_schema=False)
    def ready(request: Request):
        runtime_ = request.app.state.runtime
        if runtime_ is None or not runtime_.checkpointing.ready():
            return JSONResponse(status_code=503, content={"status": "unavailable"})
        return {"status": "ready", "checkpointer": runtime_.checkpointing.kind}

    # ------------------------------------------------------------ config (read-only)
    @app.get("/config")
    def config(request: Request, principal: Principal = Depends(require_roles("dispatcher", "admin"))):
        """Model, fallback and guardrails (DSP-16 models and fallbacks, ADM-17 planning agent guardrails)."""
        return agent_config(request.app.state.settings)

    # ------------------------------------------------------------ runs
    @app.post("/runs", status_code=status.HTTP_201_CREATED, response_model=StartRunResponse)
    def start_run(body: StartRunRequest, request: Request, principal: Principal = Depends(require_roles("dispatcher"))):
        require_depot(principal, body.depot)
        run = rt(request).start_run(body.depot, body.runDate.isoformat(), principal.sub, body.request)
        return StartRunResponse(id=run["id"], status=run["status"], version=run.get("version"))

    @app.get("/runs/{run_id}")
    def get_run(run_id: str, request: Request, principal: Principal = Depends(require_roles("dispatcher", "admin"))):
        runtime_ = rt(request)
        require_depot(principal, runtime_.depot_of(run_id))
        return runtime_.get_run(run_id)

    @app.post("/runs/{run_id}/resume")
    def resume(run_id: str, body: ResumeRequest, request: Request, principal: Principal = Depends(require_roles("dispatcher"))):
        runtime_ = rt(request)
        require_depot(principal, runtime_.depot_of(run_id))
        edits = [e.model_dump(exclude_none=True) for e in body.edits or []]
        return runtime_.resume(run_id, body.decision, edits, principal.sub, sorted(principal.roles), body.comment, body.planHash)

    @app.post("/ask")
    def ask(body: AskRequest, request: Request, principal: Principal = Depends(require_roles("dispatcher"))):
        runtime_ = rt(request)
        require_depot(principal, runtime_.depot_of(body.runId))
        return runtime_.ask(body.runId, body.question)

    return app
