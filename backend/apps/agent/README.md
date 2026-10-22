# Lodestar planning agent (`agent`)

Python 3.12 · FastAPI · **LangGraph** · pydantic v2. Contract: `docs/architecture/PLATFORM.md` §2 (zero trust), §3 (OData), §4 (agent), §6 (tests).

The agent **drafts** a delivery plan for one depot and run date, explains *what it did / what it checked*, ranks deferrals and then **stops**. Only a human `dispatcher` can approve, edit or reject. There is no code path that publishes a plan: the OData client is read-only, and an approved run is just a recorded decision that `planning` acts on with the dispatcher's own token.

## Graph

```
START → load_context → draft_plan → check_rules ─(violations, ≤ 3 redrafts)→ draft_plan
                                       └→ rank_deferrals → explain → await_approval (interrupt)
await_approval ── approve / reject → END
               └─ edit → apply_edits → check_rules → rank_deferrals → explain → await_approval
```

| Node | What it does |
|---|---|
| `load_context` | Tool-calling node: the model picks `fetch_*` tools for missing datasets (Orders, Outlets, Vehicles, Calendar, DistrictTravel, ServiceAllowances). Tools read OData with the agent's service token and refuse any depot/date outside the run's scope. |
| `draft_plan` | Capacity and packing heuristics ported from `backend/apps/planning/src`: chilled on reefers, van_only on vans, dry Fresh off reefers, 1 brand + 1 district per trip, max 2 trips per vehicle, weight/volume, minute budget (270 Fresh / 480 Style-Tech), windows. |
| `check_rules` | The 7 booklet rules (weight, volume, 270 min, 2 trips, fuel, van_only, mall, the mall checked against `mallWindow`) plus every stop arriving before its window closes. `draft_plan` already packs around the weekly fuel quota and every stop's window close (mall windows included), simulating the same clock as the schedule, so drafts are normally rule-clean on the first pass (an order no vehicle can take in time or within quota is left out with `WINDOW` / `FUEL`). Violations that still appear become constraints (`prioritise` then `avoid`) and loop back to `draft_plan`, at most `AGENT_MAX_REPAIR_ATTEMPTS` (2) times: the safety net. Human edits are flagged, not redrafted. |
| `rank_deferrals` | Takes leftovers off the plan, keeps protected orders (score ≥ 91 or outlet flag) by bumping the lowest-score order when possible, otherwise sends them to `needsReview`. Ranks the rest, lowest score first, with reason codes `CAP_REEFER, CAP_TIME, ACCESS, WINDOW, FUEL, VEH_DOWN`. |
| `explain` | The model writes the DSP-02 "What it did / What it checked" text from structured facts. |
| `await_approval` | `interrupt()`; resumed with `Command(resume={decision, edits, by, roles})`. A resume without the `dispatcher` role or with a bad value is recorded and ignored (the run keeps waiting). |

"Ask the planning agent" (DSP-39/40) is a second small graph (`agent ⇄ ToolNode`) over a snapshot of the run with lookup tools (`plan_summary`, `rule_checks`, `capacity`, `list_deferrals`, `explain_order`, `lookup_vehicle`, `lookup_outlet`) and `propose_edit`, which previews an edit as a new draft version. It never mutates the run. The dispatcher applies a proposal with `resume {decision: "edit", edits: proposal.edits}`; on an approved run planning sends it to `/runs/{id}/revise` instead, so a change to a live plan is always a new draft version.

## Model

`AGENT_MODEL=gemini` (the compose default) routes every LLM call through `LLMRouter` (`llm/router.py`): Google Gemini (`GEMINI_API_KEY`, REST `generateContent` in JSON mode) first, Groq (`GROQ_API_KEY`, OpenAI-compatible chat completions in JSON mode) second, the deterministic template last. One retry per provider for rate-limit / timeout / network / 5xx errors; auth, daily quota, non-JSON and schema-invalid replies go straight to the next provider. Every reply is validated against a strict pydantic schema before use. If both providers fail the run gets `llmDegraded: true` and the explanation starts with `LLM_DEGRADED`; with no key configured the router answers from the templates only (same output as `mock`). The LLM classifies the optional run request (`intent`), extracts enum preferences (which groups the drafter packs first), picks the "Ask the agent" tools (unknown tools, ids not in the run and bad enums are dropped; the mock's picks are the fallback) and phrases verified text (a reply that drops or adds a number or id is discarded). It never allocates, validates, simulates or commits. Each call logs provider, model, fallback reason, latency, tokens and retries (never keys; prompt and reply text only with `LLM_LOG_PROMPTS` / `LLM_LOG_RESPONSES`), and `GET /config` serves the counters as `llmMetrics`. See `docs/architecture/PLANNER_AGENT.md`.

`AGENT_MODEL=mock` (the settings default) uses `MockChatModel`, a deterministic `BaseChatModel` that emits LangChain tool calls, template explanations and answers grounded in tool results.

`AGENT_MODEL=azure-openai` (with `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`; `langchain-openai` is pinned in `requirements.txt`) wraps `AzureChatOpenAI` in `PhrasingChatModel` (`llm/phrasing.py`). Planning stays deterministic: the mock still chooses the datasets `load_context` fetches, the tools `ask` calls and every fact; the LLM is offered no tools and only rewrites the finished `explain` text and `ask` answer (temperature 0, `AZURE_OPENAI_TIMEOUT_S`, one retry). Any LLM error, timeout or empty reply keeps the mock's text. If a variable is missing the service starts on the mock and `GET /config` reports `configured: false` with the missing names. Tests run the Azure path against a mocked endpoint (`tests/test_azure_model.py`, no key needed). The graph doesn't change.

## API

All routes except health need `Authorization: Bearer <RS256 JWT>` (issuer `OIDC_ISSUER`, audience `lodestar-api`, verified against the JWKS). Roles come from `realm_access.roles`; the `depot` claim (string or list) limits which runs a user may start or see.

| Method | Path | Roles | Body → response |
|---|---|---|---|
| POST | `/runs` | dispatcher | `{depot, runDate, request?}` → `201 {id, status, version}` (runs to `NEEDS_APPROVAL`, or `ANSWERED` when the request only asks for an explanation or a capacity check) |
| GET | `/runs/{id}` | dispatcher, admin | run view: `plan`, `ruleChecks`, `violations`, `validation` (rule codes), `simulation`, `deferrals` (with explanation, limiting constraint, consequence), `needsReview`, `explanation`, `decisions`, `approval`, `committed`, `hashes`, `llmCalls`, `llmDegraded`, `history`, `canPublish: false` |
| POST | `/runs/{id}/resume` | dispatcher | `{decision: approve\|edit\|reject, edits?, comment?, planHash?}` (a `planHash` other than the current plan's is refused with 409; re-sending the approval of the committed plan with its hash returns the run unchanged); edits: `{op: "move", orderId, vehicleId, tripNo?}` or `{op: "defer", orderId, reason}` |
| POST | `/runs/{id}/revise` | dispatcher | A change to an **approved** run: `{edits, version?, lockedOrderIds?, lockedTrips?, comment?}` starts a new run (201) seeded from its plan on fresh data plus the edits (`seed_plan`, no redraft), as version `version + 1`, waiting for approval like any draft. Edits touching `lockedOrderIds` or `lockedTrips` (started trips, sent by planning) are refused with 422, here and in later edits of the new run; a run that is not approved is refused with 409 |
| POST | `/ask` | dispatcher | `{runId, question}` → `{answer, toolCalls, proposal}` |
| GET | `/config` | dispatcher, admin | model (`AGENT_MODEL`, configured?, deployment, provider chain), fallback, max redrafts, hard rules, validator codes, limits, reason codes, what it reads, `llmMetrics` (calls per provider, failures, fallback rate, latency, tokens, cache hits, repairs, degraded runs); no secrets |
| GET | `/health` | none | liveness |
| GET | `/ready` | none | checkpoint DB reachable (503 if not) |

Errors use the OData shape `{"error": {"code", "message"}}`: 401/403 auth, 404 unknown run, 409 not waiting for approval, 422 validation or invalid edit (for example deferring a protected order), 502 upstream OData or service-token failure.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_MODEL` | `mock` | `mock`, `gemini` (router: Gemini → Groq → template) or `azure-openai` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | unset / `gemini-2.5-flash-lite` | primary provider |
| `GEMINI_TIMEOUT_SECONDS` / `GEMINI_MAX_OUTPUT_TOKENS` | `20` / `512` | per call |
| `GROQ_API_KEY` / `GROQ_MODEL` | unset / `llama-3.1-8b-instant` | fallback provider |
| `GROQ_TIMEOUT_SECONDS` / `GROQ_MAX_OUTPUT_TOKENS` | `20` / `512` | per call |
| `LLM_PRIMARY_PROVIDER` / `LLM_FALLBACK_PROVIDER` | `gemini` / `groq` | provider order |
| `LLM_MAX_RETRIES` / `LLM_ENABLE_FALLBACK` / `LLM_TEMPERATURE` | `1` / `true` / `0` | router behaviour |
| `LLM_ENABLE_CACHE` | `true` | in-process cache for intent, preferences and explanations |
| `LLM_LOG_PROMPTS` / `LLM_LOG_RESPONSES` | `false` | debug logging of prompt / reply text |
| `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_DEPLOYMENT` / `AZURE_OPENAI_API_VERSION` | unset | Azure OpenAI for `azure-openai` (all four needed, else the mock runs) |
| `AZURE_OPENAI_TIMEOUT_S` | `20` | one phrasing call; on timeout the mock's text is used |
| `DATABASE_URL` | unset | Postgres checkpoints in schema `agent` (Prisma `?schema=` is ignored). Unset → in-memory `MemorySaver` |
| `AGENT_DB_SCHEMA` | `agent` | checkpoint schema |
| `OIDC_ISSUER` | `http://identity:8080/realms/lodestar` | expected `iss` |
| `OIDC_JWKS_URL` | `<issuer>/protocol/openid-connect/certs` | JWKS to fetch keys from |
| `OIDC_AUDIENCE` | `lodestar-api` | expected `aud` |
| `JWT_LEEWAY_S` | `30` | clock skew |
| `OIDC_TOKEN_URL` | `<issuer>/protocol/openid-connect/token` | client-credentials endpoint |
| `OIDC_CLIENT_ID` | `svc-agent` | service identity |
| `OIDC_CLIENT_SECRET` / `OIDC_CLIENT_SECRET_FILE` | unset | service secret (env or mounted file) |
| `OIDC_SCOPE` | unset | e.g. `orders.read outlets.read fleet.read` |
| `LODESTAR_API_URL` | `http://gateway:8443` | OData base |
| `LODESTAR_SERVICE_URLS` | unset | direct URLs per entity set, e.g. `Orders=http://orders:3002,Vehicles=http://fleet:3004` |
| `ODATA_CA_BUNDLE` | unset | CA bundle for TLS to the gateway |
| `HTTP_TIMEOUT_S` / `ODATA_MAX_PAGES` | `10` / `50` | outbound limits |
| `AGENT_MAX_REPAIR_ATTEMPTS` (older name `AGENT_MAX_REDRAFTS`) | `2` | validate → redraft loop cap |
| `AGENT_FIRST_DEPARTURE` | `03:30` | earliest departure |
| `LOG_LEVEL` | `INFO` | JSON logs to stdout; tokens and secrets are redacted |

## Develop and test

```bash
cd backend/apps/agent
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt     # Windows: .venv\Scripts\pip
.venv/bin/python -m pytest                        # writes coverage.xml
.venv/bin/uvicorn lodestar_agent.main:app --port 8000
```

Tests use pytest + **mockito** (`when / mock / verify / unstub`) with small synthetic fixtures (`tests/fixtures.py`), a locally generated RSA key and a stubbed JWKS. They never call a real LLM, identity provider or API.

## Container

`Dockerfile`: two stages on `python:3.12-slim`, no compilers or pip in the runtime image, runs as uid 10001, `HEALTHCHECK` on `/health`, uvicorn on port 8000. It works with a read-only root filesystem (no bytecode writes).
