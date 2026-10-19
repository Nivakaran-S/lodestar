# Waypoint Lodestar

**Every order, one thread.** A delivery planning and execution system for Waypoint Group's two depots (Peliyagoda and Kandy), built by Team Adagard for Tech-Triathlon 2026.

One system, five faces: four on one URL, and the driver's Android app:

| Face | Who | Where | What they do |
|---|---|---|---|
| Lodestar Store | Store manager | Desktop and phone | Order before 4 PM, follow the ETA, count the delivery, report an issue |
| Lodestar Plan | Dispatcher | Desktop (phone on call) | Plan the day with the planning agent, review deferrals, approve, watch it live |
| Lodestar Dock | Loader | Bay tablet or desktop browser, or phone (390 px) | Load in reverse stop order, flag a shortfall, release the vehicle |
| Lodestar Run | Driver | Android app (not on the website), works offline | Drive the run, arrive, prove each delivery, sync later |
| Lodestar Admin | Admin | Desktop | People, phones, outlets, vehicles, audit log |

## Live demo

**URL:** https://waypoint-lodestar.eastasia.cloudapp.azure.com

**Demo video:** [DEMO VIDEO LINK]

Open the URL and pick a role on the start page: each card opens that role's own sign-in screen, as designed (no shared login page).

| Role | Sign-in screen | Sign in with |
|---|---|---|
| Store manager (OUT106, Nuwara Eliya) | Lodestar Store, desk (SM-26) or phone app (SM-05) | Phone `77 456 7890`, then the 6-digit code |
| Dispatcher (both depots) | Lodestar Plan (DSP-06 → DSP-07) | `nilanthi@waypoint.lk`, password `Waypoint-Judge-2026`, then the 6-digit code |
| Loader (Kandy) | Lodestar Dock (LD-06) | Staff ID `KDY-0427`, PIN `2468` |
| Driver (VEH057, Kandy) | Lodestar Run, Android app (DR-06 → DR-07) | Phone `77 345 6789`, then the 6-digit code |
| Admin | Lodestar Admin (ADM-01) | `admin` — not published: it can approve phones and change accounts. Ask the team (the submission form lists our contact). |

**The 6-digit code:** this demo has no SMS gateway, so the code the SMS would carry is shown on the screen ("Demo: your code is …"). Codes last 5 minutes; a new one can be sent after 30 s.

The judge walkthrough below needs only the four role accounts. Lodestar Run, the driver's app, is an Android app only: it is not on the website (build and install: [Android app](#android-app-lodestar-run)). The loader's screens are designed for a phone: use a phone or a 390 px wide browser window; the Dock also has its bay-tablet screens, which a desktop browser shows.

On a local install (`docker compose up`) the dispatcher's password is `lodestar-dev-only` and the admin's `lodestar-admin-dev-only`; phones, staff ID and PIN are the same as above.

## Run it locally

Needs Docker Desktop with Compose v2 (about 8 GB of memory for Docker).

```bash
cp .env.example .env          # optional: the dev defaults work as they are
docker compose up --build     # first build takes a while; then open https://localhost:8443
```

| Open | What |
|---|---|
| https://localhost:8443 | Start page: pick a role. The browser warns about the dev certificate once. |
| https://localhost:8443/field/ | Field app (loader, store phone, Plan on call) on the same origin; the local stack also keeps the driver's screens here for the e2e suite (`RUN_ON_WEB`) |
| https://localhost:8443/odata/v4/ | OData v4 API (bearer token required) |
| http://localhost:8180/auth | Keycloak admin console (local only) |

- **Data:** with the competition CSVs in `./data/` the seed uses them (120 outlets, 60 vehicles, the calendar); add `task2b_peak_day_scenarios.csv` and `task2b_peak_day_fleet.csv` and the demo day comes from the peak-day scenario. Without them a generated network of the same size is used. The CSVs are never committed. Details: [backend/prisma/DATA.md](backend/prisma/DATA.md).
- **The demo day:** every fresh install has one over-capacity delivery day: 100+ open orders across the three brands and both depots, vehicles in the workshop, outlets skipped yesterday, and no trips yet. It is **today in Sri Lanka** unless `DEMO_DATE=YYYY-MM-DD` is set in `.env`. To start the day again: `docker compose down -v && docker compose up`.
- **Phones:** every phone is bound to its user (zero trust). The four personas' phones are shared demo devices, so they sign in from any browser with no setup; anyone else's phone asks for access and an admin approves it (ADM-05).
- **Hosted database (optional):** put `EXTERNAL_DATABASE_URL=postgres://…?sslmode=require` (e.g. Prisma Postgres) in `.env` and start with `docker compose -f docker-compose.yml -f docker-compose.prisma.yml up -d`; the application data then lives there, Keycloak and the agent's checkpoints stay local.
- **Public address:** `PUBLIC_ORIGIN` in `.env` is the one setting for the URL people open (Keycloak hostname, issuer, redirect URIs, API).

## Android app (Lodestar Run)

The driver's app runs on Android only. It is the same Expo code as the field app, built against the live demo:

```bash
cd mobile
npx expo prebuild -p android
cd android
EXPO_PUBLIC_API_URL=https://waypoint-lodestar.eastasia.cloudapp.azure.com EXPO_PUBLIC_DRIVER_APP=true   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a   # app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

`EXPO_PUBLIC_DRIVER_APP=true` makes it the driver's app only: it opens Lodestar Run, signs in drivers only and has no Store, Plan or Dock screens (those stay on the website). `-PreactNativeArchitectures=arm64-v8a` builds for current phones only; the first build compiles the native code and takes a while. Open **Lodestar** on the phone and sign in with the driver's phone number and the code shown on screen. For a local stack, leave `EXPO_PUBLIC_API_URL` out and use `adb reverse tcp:8443 tcp:8443`.

## Judge walkthrough

Open the start page in a desktop browser. For the loader, use a phone, or the browser's device toolbar at 390 × 844; the driver uses the Android app. Each other role signs in from its card on the start page.

**Store manager: order (desktop)**
1. Pick **Store manager** and sign in with phone `77 456 7890` and the code shown on screen. **Deliveries** (SM-02) opens: today's two orders for OUT106 (chilled and ambient) are waiting to be planned.
2. Open **Order** (SM-27) and press **New order**: SM-01 shows the order form for the next run that is still open, with the 4 PM cut-off countdown.
3. Add a line, change a quantity and press **Submit**. The order appears in the order history with its run date. (After 4 PM it goes to the following run.)

**Dispatcher: plan and approve (desktop)**

4. Sign out, pick **Dispatcher** and sign in as `nilanthi@waypoint.lk` (password, then the code). On the **Cutoff queue** (DSP-01), choose the Kandy depot and today's run; **Close orders** freezes the run, then press **Draft the plan with the agent**. DSP-22 shows the agent's steps and progress, then the draft opens on the **Plan board** (DSP-02). Click any trip card (for example VEH057's) to open its trip drawer (DSP-11) over the board: stops in order, plan and model ETAs, late risk and the rule checks.
5. On **Review deferrals** (DSP-03), the orders the agent could not fit are listed, each with a reason code (for example `CAP-REEFER`, a bulk chilled order no Kandy reefer can carry) and a score, plus the **Protected outlets** kept on the plan because they were skipped yesterday (OUT108). Click one to see why; tick the deferrals to approve. For Peliyagoda the same step shows a larger over-capacity day.
6. On **Ask the planning agent** (DSP-39), ask for a change, for example "Move ORD261005999 to VEH040 trip 1", and accept its proposal (DSP-40). The draft shows the move, and every rule it breaks (weight, volume, van-only…) in red: the agent proposes, the deterministic rule checks decide, and nothing is fixed silently.
7. Press **Approve & go live** (DSP-12). If the draft has violations, DSP-12 lists them and asks for an **Override reason**; it is recorded with the plan and in the audit log. The plan is now in effect: trips and stops exist, deferred orders move to the next operating day with their reason, and each affected store gets a notice.

**Loader: load and release (phone)**

8. Open the **Loader** card and sign in with staff ID `KDY-0427` and PIN `2468`. The dock queue (LD-01) lists today's Kandy trips by bay; in a desktop browser the Dock shows its bay-tablet screens (bay overview LD-21, load sheet LD-02, release checklist LD-22).
9. Open VEH057's load sheet (LD-02): lines in reverse stop order. Tick them off; on one line, **Flag** a shortfall and **Send flag** (LD-03).
10. **Release to driver** (LD-04) with the seal number and the reefer temperature (a temperature above the limit blocks the release). The trip and its orders go en route.

**Driver: deliver with proof (Android app)**

11. Open the **Lodestar** app (Lodestar Run) on the Android phone and sign in with phone `77 345 6789` and the code shown on screen. Today's run (DR-01) shows VEH057's stops with their ETAs. Press **Start trip**.
12. At OUT106: **Arrived**, then **Start delivery** (DR-02), count the units, capture the receiver's name and **signature**, record any exception, then **Complete stop** (DR-03). No signature? **Use store OTP** (DR-16).
13. Offline (the app must have opened once online on that phone): switch the phone to airplane mode before the next stop. Complete it with the proof of delivery and a photo (DR-20); everything waits in the phone's outbox. Reconnect: the outbox sends once, in order, and the records reconcile without duplicates. If the office changed the same stop meanwhile, the dispatcher sees the conflict on the reconcile screen (DSP-A2) and the field evidence wins.

**Store manager: receipt (desktop or phone)**

14. Sign in as the store manager again. Deliveries (SM-02) shows the delivery as arrived. Count it, use **Report an issue** for any short or damaged item, and **Confirm receipt**. A short count creates a credit note.

**Dispatcher: the result**

15. As the dispatcher, **Live operations** (DSP-04) shows the trip's progress and the delivered stops, and the **Deferral log** (DSP-17) lists every deferral with its reason and new date.

**When the day breaks: a reefer cannot depart (optional)**

16. As the loader, on a vehicle's second trip that has not left yet, report **Vehicle can't depart** (LD-B1); the vehicle goes to the workshop and dispatch is alerted.
17. As the dispatcher, the re-plan opens as a difference against the live plan (DSP-B1): which orders move to which vehicle and which must wait. Approve it; the loader's sheet updates (LD-14).

**Admin: audit and devices (desktop)**

18. Pick **Admin** and sign in as `admin` (password from the team). The **Audit log** (ADM-16) records every action, including the dispatcher's override and its reason; **Verify chain** (ADM-20) checks that the hash-chained log has not been altered. Under devices, a lost phone is revoked in one step (ADM-07) and stops working at once.

## Repository

| Folder | Contents |
|---|---|
| `frontend/` | Desk app (Next.js): start page, Lodestar Store desk, Plan, Admin |
| `mobile/` | Field app (Expo): Run on Android; Dock, Store phone and Plan on call also in the browser at `/field/` |
| `backend/` | OData v4 services (NestJS + Prisma): auth, orders, planning, fleet, outlets, trips, sync, notifications, audit; NGINX gateway; Keycloak realm; planning agent (`apps/agent`, Python + LangGraph) |
| `tests/` | Playwright full-stack and cross-role flows, design-conformance baselines (`tests/visual`), k6 load test |
| `tools/qa/` | The quality gate (`gate.sh`), stack readiness, Sonar gate, design baselines |
| `deploy/azure-demo/` | The live demo: one VM, Caddy with Let's Encrypt, production compose override |
| `infra/terraform/envs/demo` | Terraform for that VM. `envs/dev`, `envs/prod`, AKS and Istio are target architecture, not applied: see [infra/README.md](infra/README.md) |
| `docs/` | [Architecture](docs/architecture.md), [planner agent](docs/architecture/PLANNER_AGENT.md), [data model](docs/data-model.md), [platform contract](docs/architecture/PLATFORM.md), [QA and CI](docs/QA.md), [AI disclosure](docs/AI_DISCLOSURE.md) |

## How it is built

- **One origin, zero trust.** An NGINX gateway routes `/`, `/field/`, `/odata/v4/`, `/auth/` and `/ws/`. Every service verifies every token itself against Keycloak; field phones are bound to their user. Services talk to each other with their own client-credentials tokens.
- **OData v4 everywhere.** Each service owns one Postgres schema and exposes it as OData entity sets and bound actions (`Plans('…')/Lodestar.Approve`, `Trips('…')/Lodestar.Release`, `Orders('…')/Lodestar.ConfirmReceipt`).
- **Planning.** A deterministic planner and rule checker (capacity by weight and volume, temperature, van-only access, home depot, every outlet's delivery window, the mall delivery window, the weekly fuel quota and two trips a day; closed days are refused) inside a LangGraph agent with a human approval step; approving a plan that bends a rule needs a stated reason. Fuel used is recorded when a trip completes and resets every Monday. Approving a plan creates the trips and stops, plans the orders, records each deferral with its reason and rolls it to the next operating day, and tells the stores.
- **Offline first.** The field app keeps an outbox; the sync service applies batches idempotently, in the order they were saved, and resolves conflicts (field evidence wins).
- **Quality gate.** Lint, typecheck, unit suites with coverage, integration tests on a real Postgres, Sonar, and the full stack with Playwright (API, both apps, cross-role flows, design conformance). One command: `tools/qa/gate.sh`. CI: GitHub Actions (`.github/workflows/deploy-demo.yml`) runs the checks on every pull request and on `main`; the full stack with Playwright runs with the gate script. See [docs/QA.md](docs/QA.md).
- **Delivery.** The live path is GitHub Actions → GHCR → the VM. On a green `main`, GitHub Actions pushes the changed images to GHCR (tagged `main` and the commit SHA); the demo VM polls for that run and redeploys its compose stack. The same run commits the SHA to `deploy/k8s/overlays/demo` ([skip ci]), so Argo CD (core mode) on the VM's k3s can sync it instead once the cut-over in [deploy/argocd](deploy/argocd/README.md) is done; compose and k3s never run at the same time. The `Jenkinsfile` is not on this path; it is kept for reference only.

## Departures from the Designathon design

The Day 5 Designathon submission is the specification. Where the build differs:

| Area | Design | Build | Why |
|---|---|---|---|
| Computer-vision auto-fill (scan, temperature, seal, damage) | Camera reads and fills the field; the person confirms | Temperatures only: **Read from photo** (LD-09, DR-12) sends the photo to the internal `ocr` service (RapidOCR, PP-OCR mobile on CPU) and pre-fills the value for the person to confirm. Scan, seal and damage are typed or confirmed by hand. | A small CPU model fits the demo VM; the other readers need training data we do not have. |
| Sign-in | One designed sign-in per app (SM-05/06, SM-26, DSP-06/07, LD-06, DR-06/07, ADM-01) | As designed, with no Keycloak login page on the normal path: a Lodestar extension inside Keycloak (`backend/identity/extension`) checks phone + code, staff ID + PIN and email + password + second step, and Keycloak issues the session (no service can sign in as a user). Codes: 5 minutes, 5 tries, 30 s between sends, 5 an hour per number (50 on a demo stack). | Same screens as the design; Keycloak stays the only token issuer. |
| SMS codes | The code arrives by SMS | `SMS_PROVIDER=log` (default) with `DEMO_SHOW_CODES=true`: the code is shown on screen. `twilio` or `notifylk` send real SMS when configured. | No SMS gateway contract for the demo. |
| Downloadable voice packs (Sinhala, Tamil) | Voice settings, pack download, voice unavailable (DR-33–35, LD-28–30, SM-37–39) | Not built. Read-aloud uses the phone's own text-to-speech where the build has it. | Time. |
| Field app on the web | Native phone apps | Lodestar Run is native only: the Android app. The Dock, the store phone app and Plan on call are the same Expo app served in the browser at `/field/`; on a tablet or desktop window the Dock uses its bay-tablet screens and the field sign-ins use the desk layout. The browser build leaves the driver's screens out (`EXPO_PUBLIC_RUN_ON_WEB`, off for the demo; the local stack turns it on so the e2e suite can drive a run). | A driver works from the phone in the cab, offline; the other roles judge from one URL. |
| SMS and phone-call alerts | Settings offer SMS and a call per alert (DSP-20, DSP-33, SM-30) | In-app (WebSocket) always. SMS is behind `SMS_ENABLED` (default off: the SMS switches show "Not available in this deployment"); when on, the recipient's own settings decide, and `SMS_PROVIDER=log` (default) records what would be sent on the notification (`payload.delivery.sms`) and in the audit log, while `SMS_PROVIDER=http` posts `{to, from, body}` to `SMS_API_URL` (see `.env.example`). The call channel is removed. | No SMS gateway contract for the demo; no voice provider at all. |
| Proof-of-delivery photos and signatures | Photo of the drop and the receiver's signature shown with the POD | The phone keeps the photo (JPEG) and the signature (SVG, drawn on DR-03/DR-20) in its outbox until there is signal, then uploads them (`POST /media/pod-photos`, photos at most 3 MB, JPEG/PNG/WebP checked by content; signatures rebuilt on the server from path data only). They are stored in Postgres (`trips.PodPhoto`) and shown to the depot's dispatchers (trip drawer DSP-11, reconcile DSP-A2), the store's manager (SM-02) and the driver's record (DR-22). | One database to back up and secure; photos and signatures are small. |
| Estimators (service time, late risk, demand) | The Datathon models drive ETAs, late-risk alerts and the capacity outlook | The trained Adagard models run in the internal `ml` service (`backend/apps/ml`: `POST /predict/stops`, `POST /forecast/weeks`). The planning agent scores each draft's stops in one call (predicted service minutes, simulated ETA, late risk); `UpdateLateRisk` keeps the model's late risk as the floor; the capacity outlook (DSP-05) uses the weekly demand forecast and stores it, so Plan's model quality shows its WAPE once a week is over. The models and `dtcore.py` are mounted from the host (`ML_MODELS_DIR`, `ML_DTCORE`), never in the repo or an image; without them, or when the service is slow (8 s) or down, every caller keeps its heuristic (booklet allowances, road-class ETA, history median). | Competition terms: the trained models and datathon code are not redistributed. |
| Auto-plan | `Plans/Lodestar.AutoPlan` stored a capacity picture and deferral suggestions as a plan to approve | `AutoPlan` drafts with the planning agent (the same path as "Draft the plan with the agent", dispatchers only) and stores the draft, with its trips, as an `AUTOPLAN` plan version linked to the agent run; approving either one publishes it, and the run is closed when the plan is approved. A plan stored without trips (older capacity-only auto-plans) is never offered for approval (DSP-12 disables the button and says why; the API answers 409 `PlanNotExecutable`). | A plan with no trips cannot go live. |
| Closing orders | Orders close at the 4:00 PM cut-off | Also an explicit dispatcher step: "Close orders" on the cutoff queue (DSP-01) closes the run in view for the depot (`Orders/Lodestar.CloseOrders`, `ReopenOrders`, audited; `orders.OrderClosure`). While closed, the orders service refuses new orders and store edits for that run (422 `OrdersClosed`), and the store apps say "orders closed" (SM-01 on the web, SM-13/SM-23 in the field app). | Dispatch plans a run once its orders are final, without waiting for the clock. |
| Planning-agent model | An LLM drafts and explains | Planning is deterministic (packing, rule checks, validation, simulation, deferrals, approval). With `AGENT_MODEL=gemini` an LLM router (Google Gemini, then Groq, then the deterministic template) classifies the dispatcher's request, picks enum planning preferences, chooses the "Ask the agent" tools and phrases verified text; every edit it proposes is re-checked against the hard rules and a dispatcher approves. Without keys, or when both providers fail (the run is marked `LLM_DEGRADED`), the template text is used. `AGENT_MODEL=mock` is fully deterministic; `azure-openai` remains an optional phrasing model. | The same plan for the same data, and a demo that never depends on an external model. |
| Persona phones | Every phone enrols and an admin approves it | The four seeded personas' phones are shared demo devices, so judges can sign in from any browser | Judging without a devtools step; every other user still enrols. |

## AI disclosure

[docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md): what AI does inside the product (and what it doesn't), and which tools were used to make it.
