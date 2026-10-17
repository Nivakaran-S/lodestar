# QA and CI · Waypoint Lodestar

How the platform is tested and shipped. The binding contract is [architecture/PLATFORM.md](architecture/PLATFORM.md) (§6 tests, §7 CI/CD); tests are written against it, not against a service's current code.

## Which tool covers what

| Layer | Tool | Where | What it proves |
|---|---|---|---|
| Unit, web (TS) | Jest + React Testing Library (`next/jest`) | `frontend/__tests__` | `ScreenShell`: `data-lk` click and keyboard navigation (Enter, Space), `nav` vs `go` (replace vs push), back behaviour (history back only with a same-site referrer), the 1.5 s auto-advance (fake timers), the "Continues in … on the phone" toast. The home page directory matches `frontend/screens` (`FACES`, `FLOWS`). The live layer: the OData client (query options, keys, `@odata.nextLink` paging on the same origin only, If-Match on PATCH, the OData error body, 401 → renew → retry, else sign-in), sign-in (OIDC code + PKCE through `oidc-client-ts`, tokens in sessionStorage only, refresh-token renewal, logout), the route guard and role landing, the hooks (`useEntitySet`, `useEntity`, `useAction`, `useRealtime`), the Socket.IO client, and live screens (DSP-01/02/03/06/12/39, SM-01/27/29, ADM-04/07/16/20) against a mocked API at the HTTP level. |
| Unit, services (TS) | Jest + ts-mockito | `backend/**/*.spec.ts` | owned by the backend team |
| Unit, agent (Python) | pytest + mockito | `backend/apps/agent/tests` | owned by the agent team |
| UI e2e, desk screens | Cypress | `frontend/cypress` | Design preview: every generated desktop screen is visited and every `data-lk` element clicked; it must land on the destination path, or show the cross-device notice for phone-only targets. Auto-advancing screens are checked with a frozen clock. Plus the three demo flows as readable specs. Live mode (`CYPRESS_LIVE=1`, against the stack): signs in through Keycloak per persona (`cy.session`, `cy.origin` when identity is on another origin) and checks the live screens show the seeded scenario. |
| Full stack e2e | Playwright | `tests/e2e` | Zero trust (401, 403, ABAC row filters, expired, tampered and unsigned tokens), OData v4 conformance ($metadata CSDL, query options, paging, errors, ETags), actions (Approve, AgentRuns human-in-the-loop), audit hash chain, and UI smoke on Chromium, Firefox, WebKit and the mobile-web build in a phone viewport. |
| Every screen, every click | Playwright (`clicks` project) | `tests/e2e/specs/clicks` | Every designed screen (desk and field, live and static) opened as its persona: every designed link reaches its destination, every control does something observable, no page/console errors or unexpected 4xx/5xx. Writes mocked, so it runs repeatedly on the demo data. See [Every screen, every click](#every-screen-every-click). |
| Static analysis, coverage gate | SonarQube | `sonar-project.properties`, compose profile `qa` | Frontend, mobile, backend (TS) and the agent (Python). Generated screens, `node_modules` and migrations are excluded. |

The generated screens (`frontend/screens`, `frontend/app/<face>/<screen>/page.tsx`, `mobile/src/screens`) are design output from `tools/screengen`. They are tested through behaviour (Cypress click-through), never edited by hand, and excluded from coverage and duplication.

### How the Cypress click-through finds its links

`frontend/cypress/plugins/screens.ts` builds the link table when Cypress starts:

1. `tools/screengen/out/screens.json` if it exists. It is the generator's output and is gitignored, so this only happens locally after `npm run screens`.
2. Otherwise, the `const nav = {…}` table in every generated `frontend/app/{store,plan,admin}/*/page.tsx`. This is what CI uses.

Set `SCREENS_SOURCE=pages` to force option 2 locally.

### Test users

The personas come from `backend/identity/lodestar-realm.json`. Their passwords are dev-only defaults.

| Persona | Username | Role | Claims |
|---|---|---|---|
| Nilanthi Perera | `nilanthi` | `dispatcher` | `depot` PELIYAGODA + KANDY |
| Fathima Rizwan | `fathima` | `store_manager` | `outlet_id` OUT106, `depot` KANDY |
| Kasun Jayawardena | `kasun` | `loader` | `depot` KANDY, `device_id` |
| Ruwan Bandara | `ruwan` | `driver` | `vehicle_id` VEH057, `device_id` |
| Admin | `admin` | `admin` | |

Tokens come from `tests/e2e/lib/auth.ts`:
- It tries the password grant first. `lodestar-web` ships with direct access grants off, so the helper then falls back to authorization code + PKCE through Keycloak's login form, over HTTP.
- `loginViaUi(page, persona)` drives the same form in a browser.

## Running locally

### Jest (frontend)

```bash
cd frontend
npm test                # watch: npm run test:watch
npm run test:cov        # coverage in frontend/coverage (lcov.info for Sonar)
npm run typecheck       # app, Jest (tsconfig.jest.json) and Cypress (cypress/tsconfig.json) projects
```

### The website: design preview and live mode

Every desk screen (`frontend/app/<store|plan|admin>/<screen>`) can show two things:

- **Live** (the default): the screen signs in through Keycloak and shows real data. A screen with a hand-written `frontend/live/<screen-key>.tsx` renders it (32 screens; `tools/screengen/gen-web.js` wires them); the others show the design. Every face route sits behind a guard (`app/<face>/layout.tsx`): no session → Keycloak; another role → that role's face. Sign-in, reset-access and session-expired screens stay public.
- **Design preview**: the static, clickable prototype, with no sign-in and no API. `?design=1` turns it on for the tab (sessionStorage `lodestar.design`), `?design=0` turns it off. Cypress `openScreen()` and the untagged Playwright web smoke use it. Build with `NEXT_PUBLIC_DESIGN_PREVIEW=off` to disable the switch, or `NEXT_PUBLIC_LODESTAR_MODE=design` for a prototype-only build.

Endpoints come from the page origin (gateway): API `/odata/v4`, Keycloak `/auth/realms/lodestar` (client `lodestar-web`), Socket.IO `/ws/`. Override them at build time with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_OIDC_AUTHORITY`, `NEXT_PUBLIC_OIDC_CLIENT_ID` and `NEXT_PUBLIC_WS_URL` (Docker build args in `frontend/Dockerfile`).

### Cypress (frontend)

Run it against a production build. The base URL comes from `CYPRESS_BASE_URL` (or `BASE_URL`) and defaults to `http://localhost:3000`.

npm 11 does not run dependency install scripts by default, so `npm ci` doesn't download the Cypress binary. Run `npx cypress install` once, after `npm ci`.

```bash
cd frontend
npx cypress install && npx cypress verify
npm run build && npx next start -p 3200 &
CYPRESS_BASE_URL=http://localhost:3200 npm run cy:run            # headless (Electron)
CYPRESS_BASE_URL=http://localhost:3200 npm run cy:open           # interactive
CYPRESS_SCREENS=dsp-0,adm-07 CYPRESS_BASE_URL=http://localhost:3200 npm run cy:run -- --spec cypress/e2e/clickthrough.cy.ts
npm run e2e:ci          # starts next on :3000, waits, runs Cypress, stops the server

# live mode, against the stack (docker compose up): signs in through Keycloak, checks seeded data
CYPRESS_LIVE=1 CYPRESS_BASE_URL=https://localhost:8443 npm run cy:run -- --spec "cypress/e2e/live/**/*.cy.ts"
```

Live-mode settings: `CYPRESS_KEYCLOAK_ORIGIN` (only when identity is not on the app's origin; then the login runs in `cy.origin`), `CYPRESS_LODESTAR_PASSWORD` and `CYPRESS_LODESTAR_ADMIN_PASSWORD` (default: the realm's dev passwords), `CYPRESS_USER_DISPATCHER`, `CYPRESS_USER_STORE`, `CYPRESS_USER_ADMIN` (default `nilanthi`, `fathima`, `admin`). Without `CYPRESS_LIVE` the live specs are skipped.

If Cypress fails to start with `bad option: --smoke-test`, the shell has `ELECTRON_RUN_AS_NODE=1` set (VS Code terminals do this): `env -u ELECTRON_RUN_AS_NODE npm run cy:run`.

Specs:
- `cypress/e2e/clickthrough.cy.ts`: every screen and every link.
- `cypress/e2e/flows/1-happy-path.cy.ts`: SM-01 → DSP-01 → DSP-22 (auto) → DSP-02 → DSP-03 → DSP-12, then the handover to Lodestar Dock.
- `cypress/e2e/flows/2-dead-zone.cy.ts`: DSP-A1 → DSP-A1b.
- `cypress/e2e/flows/3-reefer-down.cy.ts`: DSP-B1, approve & send, or edit manually.
- `cypress/e2e/live/live-screens.cy.ts` (live mode): dispatcher lands on Plan, plan board shows the seeded trip lanes, cutoff queue, live operations (trip `TRP-VEH057-20260407`), deferral log and outlet profile; the store manager sees only OUT106 orders, deliveries and receipts, and can't open Plan; the admin's audit log shows hash-chained entries, VerifyChain is valid, and people, devices and outlets load.

### Playwright (full stack)

```bash
docker compose up -d --build                     # gateway https://localhost:8443, Keycloak http://localhost:8180, field app https://localhost:8443/field/
cd tests/e2e
npm ci && npx playwright install --with-deps chromium firefox webkit
npm test                 # everything; @stack specs skip if the stack is down
npm run test:stack       # only @stack (API, auth, audit, Keycloak login)
npm run test:smoke       # only what needs no backend (web and mobile-web UI smoke)
npm run report           # opens reports/html
E2E_WEB_URL=http://localhost:3200 npm run test:smoke -- --project=web-chromium    # desk UI against a local next start (design preview)
npm run test:stack -- --project=web-chromium specs/ui/web-live.spec.ts              # desk UI signed in, live data
```

`specs/ui/web-live.spec.ts` (@stack): an anonymous visit goes to Keycloak (code + PKCE S256); the dispatcher signs in on DSP-06, lands on Plan, and the plan board shows the real trips; the dispatcher starts a planning-agent run on DSP-01, DSP-22 follows it to NEEDS_APPROVAL, and DSP-12 approves it (`AgentRuns('…')/Lodestar.Resume`), checked through the API; the store manager sees only their outlet's orders and is sent back from Plan; the admin's audit log has entries and VerifyChain is valid; sign-out ends the Keycloak session. Tokens must be in sessionStorage, never localStorage.

| Env | Default | Meaning |
|---|---|---|
| `E2E_BASE_URL` | `https://localhost:8443` | gateway (OData at `/odata/v4`) |
| `E2E_WEB_URL` | `E2E_BASE_URL` | desk website |
| `E2E_MOBILE_URL` | `<E2E_BASE_URL>/field/` | Expo web export (keep the trailing slash) |
| `E2E_KEYCLOAK_URL`, `E2E_REALM`, `E2E_ISSUER` | `http://localhost:8180`, `lodestar`, `<keycloak>/realms/lodestar` | identity |
| `E2E_CLIENT_ID`, `E2E_CLIENT_SECRET`, `E2E_REDIRECT_URI`, `E2E_AUTH_MODE` | `lodestar-web`, none, `https://localhost:8443/`, `auto` | token acquisition (`password`, `code` or `auto`) |
| `E2E_PASSWORD`, `E2E_PASSWORD_ADMIN`, `E2E_USER_<ROLE>` | realm dev defaults | persona credentials |
| `E2E_AGENT_CLIENT_SECRET` | none | enables the "svc-agent cannot publish" test |
| `E2E_EXPIRED_TOKEN` | none | a genuinely expired Keycloak token, so the test isolates the `exp` check (otherwise `exp` is back-dated, which also breaks the signature) |
| `E2E_ORDER_OUTLET_PROP` | `outletId` | Orders property holding the outlet (ABAC test) |
| `E2E_REQUIRE_STACK` | unset | `1` in CI: a missing stack fails instead of skipping |

Tags: full-stack specs carry `@stack` (`--grep @stack` / `--grep-invert @stack`). Reports go to `tests/e2e/reports/html` (HTML) and `reports/junit.xml`.

### Design conformance

```bash
node tools/qa/design-baselines.mjs                    # 1. baselines from Designing/pages P1–P6 (local only; needs Google Fonts)
cd tests/e2e && npx playwright test --project=visual   # 2. live screens vs baselines (needs the stack); report in tests/visual/report/
```

Step 1 renders every screen frame with Playwright's Chromium and writes `tests/visual/baselines/<ID>.png` + `<ID>.json` (ids drawn twice get a suffix, e.g. `SM-02--deliveries-desktop`): the frame's screen area (phone status bar / home indicator and desktop browser bar cropped, as the apps run under real OS and browser chrome) and its key elements, i.e. every element with its own text (boxed by the text) and every control (button, link, input, ARIA role), keyed by `kind|rendered text#occurrence`, with box and computed styles. `tokens.json` holds the style guide's CSS custom properties per role mode and the design palette. Frames without a screen id (component sheets) are listed in `index.json` and in the report as excluded.

Step 2 opens each screen as its persona (one Keycloak sign-in per app, in the same tab) at the baseline's viewport, with the clock frozen at `E2E_DEMO_DATE` 10:00 Asia/Colombo, and checks:

| Check | Threshold |
|---|---|
| every static key element present, box (x, y, w, h) | within **2 px** |
| token-driven styles: text colour, typeface, weight, size; control background, radius, padding, gap | **exactly equal** |
| screenshot vs baseline, masked | at most **1 %** of unmasked pixels differ (a pixel differs when a channel is off by more than **25/255**) |
| style-guide tokens vs desk CSS (computed in the live app); field app colour literals vs the design palette, its fonts vs the design typefaces | **exactly equal** |

Masks: elements whose text has a digit, a weekday or a month name (times, dates, ids, counts, quantities) on either side are painted out of both images (+2 px) and never position-matched. A screen whose route renders the generated static mock (desk page without `LiveSwitch`, field key not in `LIVE`) is **not implemented** and fails; one that differs is **drifted** (live capture + diff image in the report); one that could not be opened (sign-in or navigation failed) is **error** and fails. Results: `tests/visual/report/index.html` and `report.json`. No retries (verdicts are deterministic); thresholds are not to be raised to get green.

### Every screen, every click

Two Playwright specs open every designed screen of the desk website and the field app as its persona and click everything on it, against the running stack. They are meant to be run by hand before a demo, as often as you like: they do not change the demo data.

```bash
# bash (Git Bash on Windows, macOS, Linux), from the repo root; the stack must be up (docker compose up -d --build)
tools/qa/test-screens.sh                  # both specs; waits for the stack first (tools/qa/wait-stack.sh)
tools/qa/test-screens.sh links            # every designed link only
tools/qa/test-screens.sh controls         # every control only
tools/qa/test-screens.sh walkthrough      # only the README judge-walkthrough screens
E2E_BASE_URL=https://<azure-host> tools/qa/test-screens.sh     # the deployed demo (plus E2E_PASSWORD / E2E_PASSWORD_ADMIN if they differ)
```

```powershell
# PowerShell
cd tests\e2e
npm ci; npx playwright install chromium         # once
npm run test:screens                            # refresh clicks/manifest.json, then both specs
npm run test:clicks:links                       # or: test:clicks:controls, test:clicks:walkthrough, test:clicks
npm run test:clicks:list                        # list the tests without running them
$env:E2E_CLICKS_ONLY = "^dsp-0[1-3]"; npm run test:clicks      # some screens only (regex on key or id)
$env:E2E_BASE_URL = "https://<azure-host>"; npm run test:screens
npm run report                                  # open the HTML report
```

Where the screens and links come from: `tests/e2e/lib/clicks/manifest.ts` reads the repo's generated nav tables, the committed copy of the design's links: desk `frontend/app/{store,plan,admin}/<key>/page.tsx` (`const nav`, elements carry `data-lk="CODE"`; sidebar codes N0… come from `frontend/components/live/chrome.tsx`), field `mobile/src/screens/registry.ts` (every `/field/s/<key>` route; `LIVE` = has a live screen) and `mobile/src/screens/<key>.tsx` (on the web a designed tap is `data-testid="lk-CODE"`). The specs build it when they load, so new and newly-live screens are picked up automatically. `npm run clicks:manifest` also writes it to `tests/e2e/clicks/manifest.json` for reading. Today: 186 screens (62 desk, 124 field), 778 designed links.

| Spec | One test per screen; per step | Fails when |
|---|---|---|
| `specs/clicks/designed-links.spec.ts` | each designed link: open the screen fresh, click `data-lk` / `lk-CODE`, check the app reaches the designed path, or shows the "Continues in …" notice for a phone/desk hand-off; `auto` (static screens advance by themselves) and `whole` (tap anywhere) too | the destination is not reached; the link is not on the screen (a live screen whose source names the code only notes it: it shows the link only with data, or follows it after an action); any page error, console error or unexpected 4xx/5xx while opening or clicking |
| `specs/clicks/every-control.spec.ts` | each interactive control (button, link, `role=button/tab/checkbox/…`, `data-lk`, `lk-*`, input, select, textarea, focusable Pressable; on live desk screens also the design's button-looking elements): reload the screen, activate it (click, type, pick, toggle, attach a file) and wait up to 4 s for a navigation, popup, dialog, file chooser, download, API call, DOM change or the value taking | a dead control (nothing observable); a control that cannot be clicked; any page error, console error or unexpected 4xx/5xx |

How it runs:
- Personas: SM → `fathima`, DSP → `nilanthi`, LD → `kasun`, DR → `ruwan`, ADM → `admin`. Desk at 1440×900, phone screens at 390×844 (touch), tablet screens at 1194×834; field screens run as the persona's seeded phone (`DEV-FR-01`, `DEV-NP-01`, `DEV-KJ-01`, `DEV-RB-01`).
- Sign-in: the `clicks-setup` project signs each persona in once, one after another, and saves the Keycloak SSO cookie in `tests/e2e/.auth/clicks-<persona>.json`. Every test reuses it, so the apps' own sign-in completes through SSO without a password and parallel workers never trip Keycloak's brute-force lockout. The runner uses 4 workers (`E2E_CLICKS_WORKERS`).
- Nothing is changed for real: POST/PUT/PATCH/DELETE to the OData API (and Keycloak's admin API) get a mocked 200 and count as the control's effect; Keycloak logout/revoke are mocked so a "Sign out" button cannot end the session the other tests share; `confirm()` dialogs are dismissed. Page errors that follow a mocked write are listed as notes, not failures (the mock is not the backend's real answer). `E2E_CLICKS_WRITES=1` sends writes for real (only on a throwaway stack).
- Dates: `page.clock.setFixedTime` freezes `Date` at the moment each page opens (`E2E_CLICKS_CLOCK=<ISO instant>` pins it; keep it near the real time, tokens are checked against the server's clock). No fixed sleeps: every wait is on a condition.
- Kept short: identical repeats (list rows with the same control id) are clicked twice (`E2E_CLICKS_PER_ID`); the desk sidebar and store top bar are crawled on each face's home screen only (`E2E_CLICKS_FULL=1` for everywhere); at most 200 controls per screen (`E2E_CLICKS_MAX`). Other filters: `E2E_CLICKS_ONLY=<regex>`, `E2E_CLICKS_APP=desk|field`, `E2E_CLICKS_LIVE=1`, and Playwright's `--grep` on the tags `@desk @field @live @static @walkthrough @entry @storeManager @dispatcher @loader @driver @admin`.

Reading the report (`tests/e2e/reports/html`, `npm run report`): one test per screen, titled `<ID> <name> · <path> · …`, tagged as above (`@static` = the route still renders the generated mock, no live screen yet). Open a test to see one step per link or control; a red step has the reason (`expected to reach /plan/dsp-02-plan-board; stayed on /plan/dsp-01-cutoff-queue (write POST /odata/v4/AgentRuns (mocked))`, `dead control — nothing observable after click`, `errors after click: HTTP 500 GET …`). The annotations list what was not a failure: `static mock`, `not shown` (link only shown with data), `redirected` (another role's face sent the persona home), `disabled`, `after mocked write`, `warning` (401s the app renews, Keycloak's own checks). Every-control tests attach `controls.txt` (one line per control: `ok` / `DEAD` / `ERR`, what it did) and `controls.json`. Failures keep a trace and a screenshot (`npx playwright show-trace <zip>`).

The allowlist, `tests/e2e/clicks/inert-allowlist.json`, holds reviewed exceptions, each with a reason:

```json
{
  "inert": { "dsp-20-settings#button:Coming soon": "drawn in the design, not part of the MVP" },
  "links": { "dr-02-stop-arrival#L252": "the live screen reads the stop aloud instead of opening DR-35" },
  "ignoreConsole": [{ "pattern": "ResizeObserver loop", "reason": "browser noise, not an app error" }],
  "ignoreHttp": [{ "pattern": "^404 GET .*/favicon", "reason": "no favicon on the field export" }]
}
```

Keys are `<screen key>#<control id>` (the id printed in the report: `lk:<code>`, `testid:<id>` or `<role>:<name>` with digits shown as `#`) or `<screen key>#<link code>`; `*` matches anything. It ships empty, and it must stay empty for the README judge-walkthrough screens (SM-01, SM-02, SM-27, DSP-01/22/02/03/39/40/12/04/13/17 on the desk; LD-01/02/03/04/15, DR-01/36/02/03/A1/A2/A3, SM-03/18 on the phone): the test `allowlist: judge-walkthrough screens have no exemptions` fails otherwise. Fix the screen instead.

### SonarQube (local)

```bash
docker compose --profile qa up -d sonarqube             # http://localhost:9000, admin/admin on first start
# My Account → Security → generate a token, then:
export SONAR_TOKEN=<token>
SONAR_HOST_URL=http://localhost:9000 tools/qa/sonar-gate.sh   # creates the "Lodestar" gate and selects it
tools/qa/gate.sh --no-stack                             # suites with coverage, then the scan, waiting for the gate
```

Coverage is read from `frontend/coverage/lcov.info`, `mobile/coverage/lcov.info`, `backend/coverage/lcov.info` and `backend/apps/agent/coverage.xml`. Generated screens (`frontend/screens`, the generated `page.tsx` routes, `mobile/src/screens`), `Designing/`, `data/` and every CSV are excluded (`sonar-project.properties`).

## The gate

One command runs everything CI runs, in the same order:

```bash
tools/qa/gate.sh              # lint, typecheck, unit suites, integration, fresh compose stack + Playwright, Sonar
tools/qa/gate.sh --no-stack   # without rebuilding the stack
tools/qa/gate.sh --no-sonar   # without the Sonar stage
```

It prints PASS/FAIL per stage and exits non-zero if any stage failed. The full-stack stage runs `docker compose down -v` first, so the seed is fresh. `tools/qa/wait-stack.sh` waits until the seed has finished, every container is healthy and the gateway serves the start page, `$metadata` and Keycloak.

### Quality gate "Lodestar"

| Condition (new code) | Fails when |
|---|---|
| Bugs | > 0 |
| Vulnerabilities | > 0 |
| Blocker issues | > 0 |
| Critical issues | > 0 |
| Coverage | < 80 % |
| Duplicated lines | > 3 % |

`tools/qa/sonar-gate.sh` creates it on a local SonarQube or on SonarQube Cloud (with `SONAR_ORGANIZATION`).

## CI/CD flow

One pipeline: GitHub Actions, [`.github/workflows/deploy-demo.yml`](../.github/workflows/deploy-demo.yml). **The live path is GitHub Actions → GHCR → the demo VM.**

```
PR to main ──▶ checks: data-model check · lint · typecheck · unit suites · integration (Postgres) · Sonar gate (optional)
                       (no build, no push, no deploy)
push to main ─▶ checks ─▶ changes ─▶ build: only the changed images → ghcr.io (:main and :<sha>)
                                  ─▶ release: every image of overlays/demo at :<sha>, tag bump in
                                     deploy/k8s/overlays/demo/kustomization.yaml, commit [skip ci]
               ├─▶ compose VM (live today): autodeploy.sh polls for the newest green run and deploys that SHA
               └─▶ Argo CD core on the VM's k3s (after the cut-over, deploy/argocd/README.md) syncs the bump
```

Jenkins (`Jenkinsfile`) is not on the live path; it is kept for reference only. The full compose stack with Playwright and the Cypress click-through are not in CI (they need a ~25-minute machine run); they run with `tools/qa/gate.sh` before a release.

### Jobs

| Job | When | What |
|---|---|---|
| `checks` | PRs and `main` | `node tools/docs/erd.mjs --check`; backend lint, typecheck, `jest --ci --coverage`, integration tests against a `postgres:16` service container (`npm run test:int`); frontend lint, typecheck, Jest; mobile `tsc`, Jest; agent pytest (coverage.xml); OCR pytest; coverage uploaded as the `coverage` artifact; SonarQube Cloud scan with `sonar.qualitygate.wait=true` when `SONAR_TOKEN` is set |
| `changes` | `main` | `deploy/azure-demo/changed-images.sh`: which images the push needs rebuilt |
| `build` | `main`, after `checks` | matrix, one image per runner, pushed to `ghcr.io/nivakaran-s/lodestar-<svc>` with tags `main` and the commit SHA |
| `release` | `main`, after `build` | images that were not rebuilt get `:<sha>` as an alias of `:main`; `kustomize edit set image` for every image the demo overlay lists; render guard; commit `deploy: demo → <sha7> [skip ci]` pushed with `GITHUB_TOKEN` |

Loops: the bump commit says `[skip ci]` (GitHub skips it), pushes made with `GITHUB_TOKEN` never start a workflow, and every job also skips a head commit that contains `[skip ci]`. PR runs never count as deployable: `autodeploy.sh` ignores runs whose event is `pull_request`.

Caching: npm per workspace and pip (`actions/setup-node`, `actions/setup-python`), Docker layers per image in the GitHub Actions cache.

### Setting up the credentials (owner only)

1. **GHCR and the tag bump**: nothing to create. Both use the workflow's built-in `GITHUB_TOKEN` (`packages: write`, `contents: write`). The workflow requests these permissions per job, so the repository default may stay read-only (only an organization policy that caps `GITHUB_TOKEN` would block them). If `main` is protected, allow GitHub Actions to push to it (or the `release` job's push is rejected).
2. **SonarQube Cloud (optional)**: sign in at sonarcloud.io with GitHub, import the repository (free for public repositories), turn off "Automatic Analysis" (CI analysis replaces it), and run `SONAR_HOST_URL=https://sonarcloud.io SONAR_TOKEN=<token> SONAR_ORGANIZATION=<org> SONAR_PROJECT_KEY=<key> tools/qa/sonar-gate.sh` once. Then add the repository **secret** `SONAR_TOKEN`; the organization and project key default to `adagard-trios` / `waypoint-lodestar` and can be overridden with the repository **variables** `SONAR_ORGANIZATION` / `SONAR_PROJECT_KEY`. Without the secret the scan step is skipped.
3. **GHCR packages**: make the `lodestar-*` packages public, or give the VM a `read:packages` token (deploy/azure-demo/README.md).
