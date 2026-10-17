# deploy/k8s: Kustomize for the demo (k3s), kind (local) and AKS (dev, prod)

> **Applied vs. target.** `overlays/demo` is the GitOps path for the demo VM: Argo CD syncs it on the VM's k3s, and it serves the public URL once the cut-over from compose is done (setup and cut-over in [`deploy/argocd/README.md`](../argocd/README.md)). `overlays/local` runs on kind. `overlays/dev`, `overlays/prod`, `components/azure-wiring` and the AKS-only parts of `base/` (`istio/`, `ingress/`, `network-policies/`, `jobs/`, the Key Vault SecretProviderClasses and workload identity) are **target architecture that was not applied**, like `infra/terraform/envs/dev|prod` (see [`infra/README.md`](../../infra/README.md)).

```
base/                      one copy of every manifest, prod-sized (PLATFORM.md section 9)
  policies/                PriorityClasses (lodestar-api > lodestar-agent > lodestar-batch),
                           ResourceQuota, LimitRange
  services/<svc>/          Deployment, Service, ServiceAccount, ConfigMap, PDB, and either
                           an HPA (CPU + memory) or, for agent and sync, a KEDA ScaledObject
                           + TriggerAuthentication; SecretProviderClass (Key Vault) for DB services
  istio/ ingress/ network-policies/ jobs/   AKS only (mesh, Front Door, Cilium, PreSync migrate)
components/azure-wiring/   fills TENANT_ID, CLIENT_ID_*, hosts, POSTGRES_HOST, ... from azure.env
overlays/dev/              AKS dev: HPAs 1-3, small requests, best-effort zone spread
overlays/prod/             AKS prod: base bounds (min >= 2), ACR images
overlays/local/            kind: no Azure; in-cluster Postgres, Keycloak, Redis, NGINX gateway
overlays/demo/             the demo VM's k3s: overlays/local + no KEDA/HPAs, Secrets and CSVs created on the VM,
                           Keycloak in production mode, Ingress + Let's Encrypt; image tags (CI-bumped) in
                           kustomization.yaml, everything else in platform/
```

Argo CD syncs `overlays/demo` on the demo VM, and would sync `overlays/dev` and `overlays/prod` on AKS (target architecture). See `deploy/argocd/README.md`. `overlays/local` is only for kind and is applied by `deploy/local/kind/up.sh`.

## Scaling, in short

Full detail: `docs/architecture/PLATFORM.md` section 9.

- **HPAs** scale on app-container CPU and memory. They scale up fast (+100 % or +4 pods per 15 s) and scale down slowly (a 5-minute window, then −20 % per minute).
- **KEDA:**
  - `agent` scales on active LangGraph runs (a Postgres query on `agent.checkpoints`).
  - `sync` scales on OfflineEvent replay (a Postgres query on `sync."OfflineEvent"`).
- **Cluster autoscaler:** the AKS user pools are autoscaled, with one pool per zone in prod. The system pool is small. Prod also has an optional spot pool for the agent.
- **Resilience:**
  - Zone and node topology spread, plus preferred pod anti-affinity.
  - PDBs with `maxUnavailable: 1`.
  - A `preStop` sleep plus a grace period for draining.
  - Startup, liveness and readiness probes (readiness on `/ready`).
  - `maxSurge: 25%` and `maxUnavailable: 0` on rollouts.
- **Socket.IO:** `notifications` uses the Redis adapter when `REDIS_URL` is set (Azure Cache for Redis on AKS, in-cluster Redis on kind), so any replica can emit to any client.

## Local cluster (kind)

What it runs: a kind cluster named **`lodestar`** with 1 control plane and 2 workers. The workers are labelled `lodestar.io/pool=apps` and get one zone each, so node selectors and the zone spread work unchanged. It also runs metrics-server (with `--kubelet-insecure-tls`), KEDA from its Helm chart, and the full platform from the compose images.

Prerequisites: Docker, `kind`, `kubectl`, `helm`, and `k6`. If `k6` is not installed, the `grafana/k6` container is used instead.

```bash
docker compose build              # images lodestar-<service>:latest (compose project "lodestar")
docker compose down               # frees host ports 8443/8082/8180 and Docker memory
bash deploy/local/kind/up.sh      # create cluster, load images, metrics-server, KEDA, apply, wait
export KUBECONFIG=~/.kube/kind-lodestar.yaml
kubectl -n lodestar get hpa,scaledobject,pods

bash deploy/local/kind/scale-test.sh   # k6 at the gateway + `kubectl get hpa -w`: scale out, then in
bash deploy/local/kind/down.sh         # deletes the kind cluster "lodestar" and nothing else
```

| URL | What |
|---|---|
| https://localhost:8443 | gateway: web, OData `/odata/v4/`, Keycloak `/auth`, realtime `/ws/` |
| http://localhost:8082 | field app |
| http://localhost:8180/auth | Keycloak admin (dev only) |

Notes:

- **Isolation.** The scripts use their own kubeconfig file (`~/.kube/kind-lodestar.yaml`, set `LODESTAR_KUBECONFIG` to change it) and always pass `--context kind-lodestar`. Your default kubeconfig, its current context and other kind clusters are never touched. `down.sh` takes no arguments and only deletes `lodestar`.
- **Building the overlay.** It reads `backend/identity/lodestar-realm.json` (Keycloak realm, via a `configMapGenerator`) and `deploy/local/postgres/01-keycloak.sh` from outside its folder, so it needs:
  ```bash
  kubectl kustomize --load-restrictor LoadRestrictionsNone deploy/k8s/overlays/local
  ```
  `up.sh` pipes that output into `kubectl apply --server-side`.
- **Secrets.** They are plain Secrets from a `secretGenerator` with the **dev-only** defaults of `docker-compose.yml`. There is no Key Vault, workload identity, Istio or NetworkPolicy locally.
- **Gateway.** It is the compose NGINX gateway image. An init container points its resolver at kube-dns, uses fully qualified upstream names, and raises the per-IP rate limits so a single-host k6 run can reach the services (see `overlays/local/gateway.yaml`).
- **Load test.** `tests/load/gateway-scale.js` fetches a client-credentials token from Keycloak and then requests the OData service document, which the gateway routes to `auth`. `auth`, and with enough load the gateway, scales out to 4 pods (3 for the gateway). After the load stops, both scale back in to 1 within a few minutes (the local scale-down window is 60 s).
  - Tune it with `VUS`, `RAMP`, `HOLD` and `SCALE_IN_WAIT`.
- **Rebuilt images.** Re-running `up.sh` reloads the images and restarts the Deployments, because the `:latest` tags don't change. Use `SKIP_LOAD=1` to skip that.
- **Resource use.** Expect about 3–4 GB of Docker memory at rest. Stop the compose stack first.

## Demo on k3s (`overlays/demo`)

```bash
kubectl kustomize --load-restrictor LoadRestrictionsNone deploy/k8s/overlays/demo   # render, no cluster needed
```

- **Builds on `overlays/local`**, so images arrive renamed to `lodestar-<svc>`. `overlays/demo/kustomization.yaml` maps them to `ghcr.io/nivakaran-s/lodestar-<svc>:<commit sha>`. CI's `gitops-bump` job rewrites only that file, with `kustomize edit set image lodestar-<svc>=...`.
- **No Secret in git.** The dev-only Secrets of `overlays/local` are deleted. `deploy/azure-demo/k3s-secrets.sh` creates the real ones on the VM, with the same names, from the VM's `.env`, plus the optional `lodestar-data` ConfigMap with the competition CSVs.
- **One node, 2 vCPU.** No KEDA ScaledObjects and no HPAs; one replica each; small requests; no node-pool selectors or zone spread. PDBs, PriorityClasses, quota and LimitRange stay.
- **Order of a sync.** Config and accounts (wave -2), then Postgres and the migrate Job (a Sync hook, re-run on every sync; the seed is idempotent), then everything else.
- **Edge.** An Ingress (ingress-nginx, cert-manager `letsencrypt` ClusterIssuer) sends everything to the gateway's TLS port. The gateway init container also maps `/field/` to the `mobile-web` Service and trusts `X-Forwarded-For` from in-cluster addresses, so the per-IP rate limits apply to each visitor rather than to the ingress pod.
- **Host name.** Set only in `overlays/demo/platform/host.env`.
