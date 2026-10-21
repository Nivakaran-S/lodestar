# Waypoint Lodestar · platform architecture (contract)

This is the single source of truth that the backend, the agent service, infrastructure, CI/CD and tests are built against. Change it first, then the code.

## 1. Runtime pieces

| Service | Tech | Port (container) | Owns |
|---|---|---|---|
| `gateway` | NGINX (TLS, rate limits, routing only; no auth decisions) | 8443 → host 8443, 8080 → redirect | edge |
| `identity` | Keycloak 26 (OIDC). Azure: Microsoft Entra ID | 8080 (host **8180**, dev only) | users, roles, tokens |
| `auth` | NestJS | 3001 | session helpers (`/me`), user directory (reads Keycloak), device registry |
| `orders` | NestJS | 3002 | Orders, OrderLineItems |
| `planning` | NestJS | 3003 | Plans, Deferrals, capacity, ETA; calls `agent` |
| `fleet` | NestJS | 3004 | Vehicles |
| `outlets` | NestJS | 3005 | Outlets, Calendar, DistrictTravel, ServiceAllowance |
| `trips` | NestJS | 3006 | Trips, TripStops, POD, LoadRecords |
| `sync` | NestJS | 3007 | OfflineEvents (offline queue replay, conflict detection) |
| `notifications` | NestJS + Socket.IO | 3008 | Notifications, realtime |
| `audit` | NestJS | 3009 | AuditEntries (append-only, hash chained) |
| `agent` | Python 3.12, FastAPI, **LangGraph**, Gemini → Groq → deterministic template (`AGENT_MODEL`, compose default `gemini`; without keys it drafts with the template) | 8000 | planning-agent runs (drafts only, never publishes) |
| `postgres` | PostgreSQL 16 | 5432 (data network only) | all persistence (one schema per service: `orders`, `planning`, …) |
| `frontend` | Next.js (start page `/`, desk faces: Store desk, Plan, Admin) | 3000 | UI |
| `mobile-web` | Expo web export served by NGINX (browser build of the field app, `experiments.baseUrl` `/field`) | 8080, routed by the gateway at `/field/` (no host port) | UI |

On Azure (AKS), the Istio internal ingress gateway takes the NGINX `gateway`'s place: it routes the same paths, and `auth` serves the merged OData service document at `/odata/v4/`. The `svc-*` client secrets become Entra workload identities, and each service gets least-privilege app roles on `lodestar-api`.

Local: `docker compose up --build` starts everything above. Open `https://localhost:8443` (start page: every role), `https://localhost:8443/field/` (field app in the browser), `http://localhost:8180` (Keycloak admin, dev only).
One origin: the gateway serves the desk website (`/`), the field app (`/field/`), the API (`/odata/v4/`), realtime (`/ws/`) and Keycloak (`/auth/`). `PUBLIC_ORIGIN` (default `https://localhost:8443`) is that origin: it sets `KC_HOSTNAME` (`<origin>/auth`), the issuer every service validates (`<origin>/auth/realms/lodestar`) and, through `${PUBLIC_ORIGIN:…}` placeholders in the realm file, the clients' redirect URIs and web origins. The apps derive every URL from the page's origin.
QA extras: `docker compose --profile qa up sonarqube` (SonarQube at host 9000).

## 2. Zero trust (verify explicitly, least privilege, assume breach)

1. **Identity for every call.** Every request to every service carries an OIDC access token (JWT, RS256) issued by `identity`. Each service verifies it itself using the issuer's JWKS (issuer, audience `lodestar-api`, expiry, signature). The gateway never grants access; there are no "trusted internal" calls.
2. **Service identities.** Service-to-service calls use the OAuth2 client-credentials grant: one confidential client per service (`svc-planning`, `svc-agent`, …), and tokens are cached until 60 s before expiry. Service tokens carry the `svc` role plus only the scopes they need (for example `orders.read`).
3. **Least privilege (RBAC + ABAC).**
   - Realm roles: `store_manager`, `dispatcher`, `loader`, `driver`, `admin`, `svc`.
   - Token claims:
     - `depot`: `PELIYAGODA` or `KANDY`, or both for dispatchers.
     - `outlet_id`: store managers only.
     - `vehicle_id`: drivers, on the day's run.
   - Policies are declared per route with `@Allow(roles…)` and `@Scope('depot'|'outlet'|'vehicle')`. Row filters are applied to OData queries automatically, so a store manager can only ever query their own outlet.
4. **Segmentation.** Docker networks `edge` (gateway, identity, frontend, mobile-web), `app` (gateway + services + agent + identity), `data` (services + postgres). Postgres is only on `data`; nothing but the gateway publishes ports (plus Keycloak admin in dev). On Azure: AKS with the Istio add-on, STRICT mTLS `PeerAuthentication`, per-service `AuthorizationPolicy` (who may call whom), private endpoints for Postgres and Key Vault, and Front Door with WAF at the edge.
5. **Assume breach.**
   - Every write goes to the hash-chained audit log (`audit` service): each entry stores `prevHash` and `hash = sha256(prevHash + canonical JSON)`. `GET /odata/v4/AuditEntries/Lodestar.VerifyChain()` recomputes the chain.
   - Containers run non-root with read-only filesystems and no Linux capabilities.
   - Secrets come from env or files locally and from Key Vault (CSI driver plus workload identity) on Azure. Never bake secrets into images.
6. **Device posture (field apps).** Tokens for the `lodestar-field` client are bound to a registered device (`device_id` claim), for every role that uses the field app (store manager, dispatcher, loader, driver). The device must be an ACTIVE `Device` of the token's subject. A lost phone is revoked from ADM-07, which disables the device in `auth` and revokes its Keycloak sessions.
   - The app sends its device id as `X-Device-Id` (Socket.IO: `auth.deviceId`). It must equal the `device_id` claim, else 401 `DeviceMismatch`.
   - `REQUIRE_DEVICE_HEADER` (default `true`): a field call without the header is refused with 401 `DeviceHeaderRequired`. With `false`, a missing header is accepted, but a present one is still checked.
   - Other posture codes: `DeviceNotBound`, `DeviceNotRegistered`, `DeviceInactive`, `DeviceNotOwned`.
   - **Shared demo phones** (judging and demos): the seed marks the four persona phones `sharedDemo` (never settable through the API). After sign-in, a field app whose install id differs from the token's `device_id` reads that row (`GET Devices('id')`, an enrollment route, own rows only) and adopts the id as its install id only when the row is ACTIVE, `sharedDemo` and the caller's own. Every check above still applies to every call; any other user or phone goes through enrollment.
   - **Enrollment** (a new phone, SM-32 → ADM-05):
     - A field user whose token is not bound to the presented phone may only call `POST Devices` (self-enrolment, PENDING), `GET Devices` (own rows) and `Me()`.
     - An admin's `Devices('id')/Lodestar.Activate` binds the phone. It writes the Keycloak `device_id` attribute, revokes the previous phone and ends the user's sessions, so the next sign-in carries the claim.
     - Revoke clears the binding.
     - All steps are audited.

## 3. API: OData v4 for data, OData actions for commands

- Base path per service behind the gateway: `/odata/v4/` (the gateway routes by entity set). Every service also serves `/odata/v4/$metadata` for its own entity sets. The gateway serves the merged service document at `/odata/v4/`.
- Entity sets (PascalCase plural): `Orders`, `OrderLineItems`, `Plans`, `Deferrals`, `Vehicles`, `Outlets`, `Calendar`, `DistrictTravel`, `ServiceAllowances`, `Trips`, `TripStops`, `PODs`, `LoadRecords`, `OfflineEvents`, `Notifications`, `AuditEntries`, `Users`, `Devices`, `AgentRuns`, `DataImports`.
- Supported query options:
  - `$filter`: `eq ne gt ge lt le and or not`, `in`, `contains startswith endswith tolower toupper`, parentheses, null, dates/datetimes, enums as strings.
  - `$select`, `$orderby`, `$top`, `$skip`, `$count=true`, `$expand` (one level, with nested `$select`/`$filter`), `$search` (simple, on configured text fields).
  - Max `$top` is 500; server-driven paging via `@odata.nextLink`.
- Response shape: `{"@odata.context": ".../$metadata#Orders", "@odata.count": 145, "value": [...], "@odata.nextLink": "..."}`; single entity `Orders('ORD0104217')`; errors `{"error": {"code": "...", "message": "...", "target": "...", "details": []}}` with proper HTTP status codes.
- Writes: `POST /Orders`, `PATCH /Orders('id')` with `If-Match` ETags (`@odata.etag` from `updatedAt`). No `DELETE` on business records: cancel with an action.
- Idempotent retries: `POST /Orders`, `POST /LoadRecords`, `Trips('…')/Lodestar.Release`, `LoadRecords('…')/Lodestar.RecordShortfalls` and `Orders('…')/Lodestar.ConfirmReceipt` honour an `Idempotency-Key` header (1–128 of `A-Z a-z 0-9 . _ : -`). Key, caller, route, body hash and response are kept for at least 24 h (`IDEMPOTENCY_TTL_HOURS`) in the owning service's schema (`orders."IdempotencyKey"`, `trips."IdempotencyKey"`). A retry returns the stored response with `Idempotent-Replay: true` and runs nothing; the same key with another body or route is 422 `IdempotencyKeyReused`; a retry while the first call still runs is 409 `IdempotencyRequestInProgress`. Failed calls are not stored.
- Commands are OData actions (namespace `Lodestar`), for example:
  - `POST /odata/v4/Plans('PLG-2026-04-07-v3')/Lodestar.Approve`
  - `POST /odata/v4/Deferrals('…')/Lodestar.Confirm`
  - `POST /odata/v4/Trips('…')/Lodestar.Release`
  - `POST /odata/v4/TripStops('…')/Lodestar.CompleteStop`
  - `POST /odata/v4/Orders('…')/Lodestar.ConfirmReceipt` (store manager, own outlet: `{unitsReceived, unitsExpected, note?, savedAt}`; a short count gets a credit note)
  - `POST /odata/v4/OfflineEvents/Lodestar.PushBatch`
  - `POST /odata/v4/AgentRuns` (start a draft)
  - `POST /odata/v4/AgentRuns('…')/Lodestar.Resume` (human decision)
  - `GET /odata/v4/AuditEntries/Lodestar.VerifyChain()`
- Health endpoints stay plain: `GET /health` (liveness), `GET /ready` (DB reachable). Both are unauthenticated and only reachable on the `app` network (the gateway does not route them).

## 4. Planning agent (LangGraph)

The graph (`backend/apps/agent`), one run per depot and run date:

1. `load_context`: reads Orders, Vehicles, Outlets, Calendar and DistrictTravel via OData with its service token.
2. `draft_plan`: uses the capacity and packing heuristics (chilled on reefers, 1 brand + 1 district per trip, max 2 trips per vehicle, windows).
3. `check_rules`: the 7 booklet hard rules plus window close at every stop. On a violation it loops back to `draft_plan` with constraints, at most `AGENT_MAX_REPAIR_ATTEMPTS` times (default 2). Time budgets are per vehicle and per brand group, as in the booklet: its Fresh trips together ≤ 270 min, its Style and Tech trips together ≤ 480 min.
4. `rank_deferrals`: protected outlets are never deferred, and each deferral gets a reason code.
5. `explain`: the model writes the "What it did / what it checked" text shown on DSP-02.
6. `await_approval`: a LangGraph interrupt. The run stops at status `NEEDS_APPROVAL`. Only a human `dispatcher` can resume it, with `approve`, `edit` or `reject`. **The agent can never publish a plan.**

- **Model:** a `MockChatModel` that implements LangChain's `BaseChatModel` and returns deterministic, template-based text and tool calls. It is chosen by `AGENT_MODEL=mock`, the default. Swapping in Azure OpenAI later means changing `AGENT_MODEL=azure-openai` plus env vars; the graph doesn't change.
- **Checkpoints** are stored in Postgres (schema `agent`), so a run survives restarts.
- **API:**
  - `POST /runs {depot, runDate}` → `{id, status}`
  - `GET /runs/{id}`
  - `POST /runs/{id}/resume {decision, edits?}`
  - `POST /ask {runId, question}`: the "Ask the planning agent" panel (DSP-39/40); it may propose an edit as a new draft.
  - `GET /config` (dispatcher, admin): model, fallback and the guardrails it enforces, read-only (DSP-16, ADM-17; `AgentRuns/Lodestar.AgentConfig()`).
- `planning` exposes these to clients as the OData entity set `AgentRuns`.

## 4b. Order cut-off

An order for a run date must be placed before **4:00 PM Asia/Colombo on the day before**. The orders service enforces this; the apps only mirror it.

- **Store managers:** a new order placed after the cut-off is not refused: it moves to the next run it can make, with a note saying so ("Placed after the 4:00 PM cut-off for …; moved to the … run", `order-cutoff.ts`). Editing an order, or moving it to another run, after the cut-off is refused with 422 `OrderCutoffPassed`. The field app opens SM-23 "Orders closed".
- **Offline stores:** an order saved on the phone before the cut-off still counts if it syncs within `ORDER_OFFLINE_GRACE_HOURS` (default 6). The app sends the time it was saved as `orderedAt`. A phone clock ahead of the server is ignored.
- **Dispatch:** a dispatcher (or admin) may log a late phone order (DSP-10) with a `lateReason`. Without one the order is refused with 422 `LateReasonRequired`. The order is stored with `latePhone = true`.
- **Switch:** `ENFORCE_ORDER_CUTOFF=false` turns the cut-off off, for demos on past scenario dates.

## 5. Data and seeding

- The competition CSVs are **never committed**. The rules forbid redistributing the datasets.
  - Put them in `./data/` locally; it is gitignored and mounted read-only into the `seed` job.
  - The seed loads them when present. Otherwise it creates a small synthetic demo dataset, clearly marked `synthetic`.
- Scenario values (people, the Tue 7 Apr incidents, the plan versions) are ours and live in `backend/prisma/scenario.ts`.

## 6. Tests and quality

| Layer | Tool | Where |
|---|---|---|
| Unit (TS) | **Jest** + **ts-mockito** (Mockito-style `mock / when / verify`) | `backend/**/*.spec.ts`, `frontend/**/*.test.tsx` |
| Unit (Python) | pytest + **mockito** (the Python port of Mockito) | `backend/apps/agent/tests` |
| UI e2e (web screens) | **Cypress** | `frontend/cypress` |
| Full-stack e2e (API + UI + auth, cross-browser) | **Playwright** | `tests/e2e` |
| Static analysis, coverage gate | **SonarQube** | `sonar-project.properties`, compose profile `qa` |

## 7. CI/CD

- **GitHub Actions** (`.github/workflows/deploy-demo.yml`, the live path): on every pull request and on `main`, lint, typecheck, Jest, pytest and integration tests on Postgres; on `main` it then pushes the images to GHCR and bumps the demo overlay for Argo CD.
- **Jenkins** (reference design for AKS, not applied), `main`:
  1. Build.
  2. Run the full `docker compose` stack plus Playwright.
  3. SonarQube analysis with a quality gate.
  4. Build images, run a Trivy scan, sign with cosign, push to ACR.
  5. `terraform plan`, then `apply` after manual approval.
  6. Bump image tags in `deploy/k8s/overlays/*` (a GitOps commit).
- **Argo CD**: continuous delivery from `deploy/k8s` to AKS (app-of-apps, auto-sync with self-heal on `dev`, manual sync on `prod`).

## 8. Azure (Terraform, `infra/terraform`)

- **Network:** VNet with subnets for AKS, Postgres, private endpoints and App Gateway; NSGs.
- **AKS:** Azure CNI overlay, workload identity plus OIDC issuer, Istio add-on, Azure Policy, Defender, Container Insights.
- **ACR:** Premium, private, admin disabled.
- **PostgreSQL Flexible Server:** private access, Entra authentication.
- **Key Vault:** RBAC, private endpoint.
- **Edge:** Front Door Premium with WAF.
- **Monitoring:** Log Analytics.
- **Identity:** Entra ID app registrations (`lodestar-api`, `lodestar-web`, `lodestar-field`, one per service).
- **Delivery:** Argo CD installed with Helm.
- **State:** remote state in a Storage Account.
- **Environments:** `envs/dev`, `envs/prod`.
- **Azure OpenAI:** declared but disabled (`enable_openai = false`) until the real model replaces the mock.

## 9. Scaling (Kubernetes)

Every service except Postgres and Keycloak is stateless and scales horizontally. Manifests live in `deploy/k8s` (`base/` is prod-sized; `overlays/dev`, `overlays/prod` and `overlays/local` adjust it). The cluster side is in `infra/terraform/modules/aks`.

**Pod autoscaling**

- **HPA (`autoscaling/v2`)** for every service except `agent` and `sync`. It scales on CPU (target 65–70 %) and memory (80–85 %, a guard rail) of the app container only (`ContainerResource`), so the Istio sidecar does not skew the ratio.
- **Behaviour** is the same everywhere:
  - Scale-up: no stabilisation window; add 100 % or 4 pods every 15 s, whichever is more.
  - Scale-down: wait 5 minutes of lower load, then remove 20 % (at least 1 pod) per minute. The local overlay waits 60 s instead.
- **Requests are steady-state usage**, so a utilisation target means something. NestJS: 200m / 256Mi (limit 1 CPU / 512Mi, Node heap capped at 384 MB). Agent: 250m / 512Mi. Next.js: 200m / 320Mi. NGINX: 50m / 64Mi.
- **KEDA** (AKS add-on; Helm chart on kind) runs `ScaledObject`s where an event signal leads CPU. CPU and memory stay as triggers, and KEDA's generated HPA is named after the Deployment.
  - `agent`: active LangGraph runs, `COUNT(DISTINCT thread_id) FROM agent.checkpoints` with a checkpoint `ts` in the last 2 minutes. Target: 2 per pod.
    - Every superstep writes a checkpoint, and a run paused at `NEEDS_APPROVAL` stops writing, so this counts runs that are drafting now.
    - We use a Postgres query because the agent exposes no Prometheus metrics, and the checkpoint table already exists.
  - `sync`: `OfflineEvent`s with `syncedAt IS NULL` or replayed in the last minute. Target: 300 per pod.
    - When the signal comes back after a blackout, every driver's queue arrives at once.
    - The `IS NULL` arm counts a real backlog if replay ever becomes asynchronous.
  - The scalers log in as `svc_agent` / `svc_sync`. The password comes from the Key Vault secret `db-password-<svc>`, which the pod's own SecretProviderClass syncs into a Kubernetes Secret.

| Service | prod min–max | dev | local |
|---|---|---|---|
| auth, orders, trips, notifications | 3–12 | 1–3 | 1–4 |
| frontend | 3–10 | 1–3 | 1–4 |
| planning, outlets | 2–8 | 1–3 | 1–4 |
| fleet, audit, mobile-web | 2–6 | 1–3 | 1–4 |
| sync (KEDA) | 3–15 | 1–3 | 1–3 |
| agent (KEDA) | 2–8 | 1–2 | 1–3 |

`audit` scales safely because appends are serialised by a Postgres advisory lock. Argo CD ignores `spec.replicas`, because the HPAs own it.

**Cluster autoscaling (AKS, Terraform)**

- **System pool:** small and tainted `CriticalAddonsOnly`, so it only runs add-ons (dev 1–2 nodes, prod 3–5).
- **User pools** (`lodestar.io/pool=apps`) are autoscaled:
  - prod has one pool per availability zone, 1–4 nodes each, with `balance_similar_node_groups`. The autoscaler adds a node in the zone whose pods are pending, which a hard zone spread needs.
  - dev has one pool across zones, 1–3 nodes.
- **`auto_scaler_profile`:**
  - `least-waste` expander, 10 s scan interval, no scale-up delay for new pods.
  - Scale-down after 10 minutes below 50 % utilisation (dev: 5 minutes, 60 %), and not within 10 minutes of a scale-up.
  - 10-minute graceful termination.
- **Spot pool for the agent** (`agent_spot_pool`, enabled in prod): min 0, tainted `kubernetes.azure.com/scalesetpriority=spot:NoSchedule`. The agent tolerates the taint and prefers spot. A spot eviction only delays a run, because runs are checkpointed.
- **KEDA:** `workload_autoscaler_profile { keda_enabled = true }`. VPA is off so it doesn't fight the HPAs.

**Resilience while scaling**

- **Spread:** `topologySpreadConstraints` across zones (hard, `DoNotSchedule`; best-effort on dev's single pool) and across nodes (soft), with `matchLabelKeys: [pod-template-hash]` so each rollout revision spreads on its own. There is also preferred pod anti-affinity per node.
- **PDBs:** `maxUnavailable: 1` with `unhealthyPodEvictionPolicy: AlwaysAllow`. With every prod minimum at ≥ 2, a drain or scale-in always leaves pods serving. On dev (1 pod) it never blocks a drain.
- **Graceful drain:** a `preStop` sleep of 10 s lets endpoints and Envoy stop sending traffic before SIGTERM, and Nest's shutdown hooks finish in-flight requests. `terminationGracePeriodSeconds` is 45 s (APIs), 60 s (`sync`, `notifications`) and 90 s (`agent`), plus Istio's `terminationDrainDuration` of 20 s.
- **Probes:** a startup probe on `/health`, liveness on `/health`, and readiness on `/ready` (DB reachable; checked every 5 s and removed after 2 failures).
- **Rollouts:** `maxSurge: 25%`, `maxUnavailable: 0`, `minReadySeconds: 5`.
- **PriorityClasses:** `lodestar-api` (100000) is the request path and may preempt. `lodestar-agent` (10000) comes next. `lodestar-batch` (1000, never preempts) is for jobs. The PreSync migrate Job keeps the default priority 0, because hooks run before the classes are synced.
- **Namespace guard rails:** a `ResourceQuota` sized for every HPA at max, plus sidecars and surge (prod: 48 CPU / 80Gi requested, 300 pods, no LoadBalancer or NodePort Services). A `LimitRange` supplies default requests and limits and per-container bounds.

**State that would block scaling**

- **Socket.IO** (`notifications`):
  - With `REDIS_URL` set, `@socket.io/redis-adapter` publishes room emits to Redis, so an event raised on any replica reaches clients connected to any other. With it unset (tests, single-instance compose), the in-memory adapter is used.
  - On Azure, `REDIS_URL` points to Azure Cache for Redis (`infra/terraform/modules/redis`): private endpoint, TLS on port 6380 only, Standard C0 on dev and zone-redundant Premium P1 on prod. The `rediss://` URL is stored in Key Vault as `redis-url`, and only the notifications workload can read it. Only notifications pods may egress to it (NetworkPolicy `allow-redis-egress`).
  - Websocket clients need no session affinity. The notifications DestinationRule keeps a cookie hash only for Engine.IO's long-polling fallback, and it disables the h2 upgrade so the websocket `Upgrade` passes through the sidecars. The VirtualService route `/ws/` has no timeout.
- **Postgres connections** grow with replicas, because every pod opens its own Prisma pool. Local `DATABASE_URL`s cap it with `connection_limit=5`.

**Local (kind)**

`deploy/local/kind/up.sh` builds a kind cluster named `lodestar` that runs the same base with Postgres, Keycloak and Redis in-cluster. `scale-test.sh` drives k6 load at the gateway and shows the HPAs scaling out and back in. See `deploy/k8s/README.md`.
