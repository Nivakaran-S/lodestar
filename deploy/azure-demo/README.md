# The public demo on one Azure VM

One Ubuntu VM runs the same `docker compose` stack as a laptop. Caddy sits in front of it on ports 80 and 443 with a Let's Encrypt certificate for the VM's Azure DNS name (`<label>.<region>.cloudapp.azure.com`). Terraform is in [`infra/terraform/envs/demo`](../../infra/terraform/envs/demo).

| Resource | Size |
|---|---|
| Resource group, VNet, subnet, NSG | 80 and 443 open; 22 only from your address range |
| Static public IP with a DNS label | Standard SKU |
| VM | `Standard_B2als_v2` (2 vCPU, 4 GiB), Ubuntu 24.04, 32 GB Standard SSD, 4 GiB swap (`vm_size`, `os_disk_size_gb`) |
| Budgets on the resource group | **credit**: $100 for the year, alerts at 25/50/75/90% spent and when the forecast says the credit runs out; **monthly**: $45, alerts at 50% and 100% and when the month is forecast above $49.50 |

Not used, on purpose: managed Postgres/Redis, Front Door, an Azure container registry (CI pushes to GHCR), Log Analytics, spot VMs, auto-shutdown, and k3s by default (the GitOps path installs it by hand on this same 4 GiB VM, below; `install_k3s = true` is only for a brand-new VM, because on this one it changes cloud-init and Terraform would replace the VM).

The whole stack idles at about 1.5 GB: Keycloak ~0.6–0.8 GB, Postgres ~0.2 GB, the frontend ~0.16 GB, each of the nine NestJS services ~50 MB. [`compose.prod.yml`](compose.prod.yml) puts a memory ceiling on every container, so a leak restarts that container instead of the VM.

## Cost

Approximate pay-as-you-go list prices (check them in the Azure pricing calculator for your region; they vary by region):

| Item | Per month |
|---|---|
| `Standard_B2als_v2` Linux VM, running all the time | ~$27–35 |
| 32 GB Standard SSD (E4) | ~$2.5 |
| Static Standard public IP | ~$4 |
| Outbound data (judges browsing) | < $1 |
| **Total** | **~$35–42** |

$100 of credit therefore keeps the demo up for about two and a half months. A monthly budget alone would never fire (each month costs less than the credit), so a second budget tracks the total against the $100. Cost data reaches Azure 8–24 hours late. Check it in the portal (Cost Management → Cost analysis, scope `lodestar-demo-rg`) and the remaining credit at https://www.microsoftazuresponsorships.com/Balance.

To pause the cost: `az vm deallocate -g lodestar-demo-rg -n lodestar-demo-vm` (only the disk and IP bill, ~$6/month; `az vm start` resumes, same URL). To stop it for good: `terraform destroy` (everything is in one resource group).

## 1. Create the VM (you run this; it needs your Azure login)

```bash
az login
az account show --query id -o tsv                     # the subscription id
cd infra/terraform/envs/demo
cp terraform.tfvars.example terraform.tfvars          # fill in: subscription_id, location, dns_label,
                                                      # ssh_source_cidr (your IP/32), ssh_public_key_path, budget_alert_emails
terraform init
terraform plan -out demo.tfplan
terraform apply demo.tfplan
terraform output                                      # public_url, fqdn, ssh
```

`terraform.tfvars` and the state stay on your machine (gitignored; the repo is public, so never commit them). cloud-init installs Docker (with rotated container logs), a 4 GiB swap file and a weekly image prune; with `install_k3s = true` also k3s (without Traefik or its load balancer, so nothing in k3s takes 80/443). Give it about 5 minutes after `apply`, then check with `ssh lodestar@<fqdn> 'docker version'`.

SSH is open only to `ssh_source_cidr`. If your public address changes, update it in `terraform.tfvars` and `terraform apply` again.

## 2. Start the stack on the VM

```bash
ssh lodestar@<fqdn>
cd /opt/lodestar
git clone https://github.com/Nivakaran-S/lodestar.git .
# the personas' passwords are published in the README for the judges: choose them here
LODESTAR_DEMO_PASSWORD='<persona password>' LODESTAR_ADMIN_PASSWORD='<admin password>' \
  deploy/azure-demo/make-env.sh <fqdn> <you@example.com>
# optional: the competition CSVs, copied by hand (never committed, never in an image)
#   scp data/*.csv lodestar@<fqdn>:/opt/lodestar/data/
deploy/azure-demo/up.sh
```

`make-env.sh` writes `.env` with random secrets for Postgres, Redis, Keycloak and every service client. `up.sh` refuses to start if any value is missing or still a dev default. It starts the stack with [`compose.prod.yml`](compose.prod.yml) and waits until the start page, the API and Keycloak answer.

Where the images come from:
- **Pulled (preferred, nothing is compiled on the VM):** add `REGISTRY=ghcr.io/nivakaran-s` and `TAG=<commit SHA>` to `.env`. CI (GitHub Actions, `.github/workflows/deploy-demo.yml`) pushes the changed images with that tag on every green `main` build (the `release` job gives the unchanged ones the same tag). The GHCR packages must be public, or run `docker login ghcr.io` on the VM with a `read:packages` token.
- **Built on the VM (no registry):** leave `REGISTRY` empty. `up.sh` builds one image at a time, because parallel Next.js and Nest builds do not fit in 4 GiB; the first build takes a while, later ones reuse the layer cache. Use `os_disk_size_gb = 64` for the build cache.

The production override:
- adds Caddy on 80/443 (Let's Encrypt, HTTP/3)
- publishes nothing else (no 8443, 8080, 8180, 9000)
- runs Keycloak in production mode behind the proxy, with a local cache and a heap sized to its 1 GiB ceiling
- caps the memory of every container

### The ML models (optional)

The `ml` service serves the Adagard datathon models (Task 1: stop service time and late risk; Task 2A: weekly demand). Neither the models nor `dtcore.py` are in the repository or in any image: copy them to the VM by hand and point `.env` at them.

```bash
# from your machine
ssh lodestar@<fqdn> 'mkdir -p /opt/lodestar/models'
scp datathon/Adagard_Datathon/models/task1_model.pkl datathon/Adagard_Datathon/models/task2a_model.pkl     datathon/Adagard_Datathon/dtcore.py lodestar@<fqdn>:/opt/lodestar/models/
ssh lodestar@<fqdn> 'chmod 755 /opt/lodestar/models && chmod 644 /opt/lodestar/models/*'   # the container runs as uid 10001
# on the VM: add to /opt/lodestar/.env, then deploy/azure-demo/up.sh
ML_MODELS_DIR=/opt/lodestar/models
ML_DTCORE=/opt/lodestar/models/dtcore.py
```

Check: `docker compose exec ml python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"` shows `"status":"ok"`. Without the files it says `"degraded"`, and the agent, trips and planning keep their heuristics (as they do whenever the service is slow or down; `ML_URL=` in `.env` switches the models off). The container is capped at 768 MiB ([`compose.prod.yml`](compose.prod.yml)); the first demand forecast of a week takes a minute or two in the background (the outlook shows the heuristic until it is cached).

### Sign-in screens (once, after the first deploy with the new identity image)

Every role signs in on its own designed screen (SM-26/SM-05 store, DSP-06/07 plan, ADM-01 admin, LD-06 dock,
DR-06/07 run); the screens post to Keycloak's token endpoint and the `lodestar-identity` image's extension
(`backend/identity/extension`) checks phone + SMS code, staff ID + PIN, or email + password + a second step.
The VM's realm was imported long ago, so switch it over (idempotent; safe to re-run):

```bash
deploy/azure-demo/up.sh                      # pulls/starts lodestar-identity (Keycloak + extension)
deploy/azure-demo/realm-signin.sh            # flow + client binding + phone/staff_id attributes + demo Dock PINs
```

`.env` knobs: `SMS_PROVIDER=log|twilio|notifylk` (+ `TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM` or
`NOTIFYLK_USER_ID/NOTIFYLK_API_KEY/NOTIFYLK_SENDER_ID`), `DEMO_SHOW_CODES=true` (the app shows "Demo: your code is
123456" instead of a real SMS; set `false` with a real provider), `LODESTAR_DEMO_PIN` (loaders' Dock PIN, default
2468), `LODESTAR_ADMIN_PHONE` (where the admin's second-step code goes). `RESET_PINS=1 realm-signin.sh` resets PINs.
Keycloak's own login page stays only behind the "Waypoint single sign-on" buttons.

## 3. Check it from a phone-sized browser

Open `https://<fqdn>/`, pick each role on the start page and sign in with the README accounts. Driver and loader open the field app at `/field/`.

## Automatic deploys (every push to `main`)

```
push to main ──► GitHub Actions: deploy-demo ──► GHCR ◄── demo VM (timer, every 3 min) ──► docker compose up
                 builds only the changed images          pulls the newest successful run's commit and images
```

- [`.github/workflows/deploy-demo.yml`](../../.github/workflows/deploy-demo.yml) runs when a push changes app code or deploy config (`backend/`, `frontend/`, `mobile/`, `docker-compose.yml`, `deploy/azure-demo/`). Markdown, tests and docs never trigger it. [`changed-images.sh`](changed-images.sh) picks the images to rebuild (a change in `backend/libs` or the Prisma schema rebuilds every NestJS service; a frontend change only the frontend). Images are tagged `:main` and `:<sha>`.
- The VM pulls; nothing pushes to it. [`autodeploy.sh`](autodeploy.sh) asks the GitHub API for the newest successful run, checks that commit out, pulls the images and restarts only what changed. SSH stays closed to everyone but the admin address, and no Azure or SSH secret lives in this public repository.
- Install once on the VM: `deploy/azure-demo/install-autodeploy.sh`. Watch: `journalctl -u lodestar-autodeploy -f`.
- Pause: `touch /opt/lodestar/.deploy-freeze` (remove the file to resume), or `DEPLOY_UNTIL=2026-10-04T23:59:00+05:30` in `.env` to stop deploying after a deadline.
- The GHCR packages must be public, or put `GHCR_USER` and a `read:packages` `GHCR_TOKEN` in the VM's `.env`.
- Cost: GitHub Actions is free for public repositories; pulling images into Azure is free (inbound data).

## Updating by hand

```bash
# images built on your machine, streamed to the VM (no registry)
deploy/azure-demo/ship.sh lodestar@<fqdn>
ssh lodestar@<fqdn> 'cd /opt/lodestar && git pull && deploy/azure-demo/up.sh'
```

With `REGISTRY` and `TAG` in `.env` (set by the automatic deploys), `up.sh` pulls `TAG` from GHCR instead.

The demo day is created once per date (`DEMO_DATE` in `.env`, empty = today in Sri Lanka). To start the day again from scratch: `deploy/azure-demo/up.sh down && docker volume rm lodestar_pgdata && deploy/azure-demo/up.sh`.

## Who owns 80/443: compose or k3s (GitOps with Argo CD core)

The live path is **GitHub Actions → GHCR → this VM**. Today compose serves the public URL and deploys itself (above). The same CI run also commits the new image tags to `deploy/k8s/overlays/demo`, so the app can instead run in k3s on **this same VM**, synced by Argo CD in **core mode** (no UI server, Dex or notifications). Full steps: [`deploy/argocd/README.md`](../argocd/README.md), "Demo on k3s".

**Memory on the current `Standard_B2als_v2` (4 GiB + 4 GiB swap).** k3s ~450 MB + Argo CD core ~300 MB (capped by [`deploy/argocd/core`](../argocd/core/kustomization.yaml)) + cert-manager and ingress-nginx ~200 MB + the app ~1.6 GB ≈ **2.5–2.6 GB**. That fits, but not next to the compose stack (~1.5 GB): running the app in k3s **replaces** compose. The cut-over stops compose; the rollback stops k3s. During the setup (k3s, cert-manager, Argo CD, Secrets) compose keeps serving (~2.4 GB in all). If pods stay `Pending` or the VM swaps hard, roll back and change only `vm_size = "Standard_B2ms"` (8 GiB, an in-place update).

**Do not set `install_k3s = true` for this VM.** It changes `custom_data` (cloud-init), and Terraform then replaces the VM: new disk, the compose data and `.env` gone. Install k3s by hand instead:

```bash
ssh lodestar@<fqdn>
curl -sfL https://get.k3s.io | sudo INSTALL_K3S_EXEC="--disable=traefik --disable=servicelb --write-kubeconfig-mode=600 --kubelet-arg=eviction-hard=memory.available<200Mi,nodefs.available<10%" sh -
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown "$USER" ~/.kube/config && chmod 600 ~/.kube/config
cd /opt/lodestar && git pull
kubectl create namespace argocd
kubectl apply -k deploy/argocd/core --server-side --force-conflicts      # Argo CD core with memory limits
# then cert-manager, registry access and `bash deploy/azure-demo/k3s-secrets.sh`: steps 2, 4 and 5 of the Argo CD README
```

**Ports.** Caddy (compose) and ingress-nginx (k3s, `hostNetwork`) both bind 80 and 443, and ingress-nginx binds them whenever k3s runs. So once ingress-nginx is installed, **k3s runs only while compose is down**.

**Compose → k3s** (cut-over; the first time it also installs ingress-nginx and creates the Application: step 6 of the Argo CD README):

```bash
cd /opt/lodestar && git pull
sudo systemctl disable --now lodestar-autodeploy.timer    # compose must not deploy (start) itself again
bash deploy/azure-demo/up.sh down                          # Caddy and the stack stop; the volumes (pgdata, certificates) stay
sudo systemctl enable --now k3s                            # no-op if already running
kubectl apply -k deploy/argocd/envs/demo                   # first time only (after installing ingress-nginx)
kubectl -n argocd get application lodestar-demo -w         # Synced, Healthy
curl -fsS https://<fqdn>/version; echo                     # the commit Argo CD deployed
```

**k3s → compose** (rollback):

```bash
cd /opt/lodestar
sudo systemctl disable --now k3s && sudo /usr/local/bin/k3s-killall.sh   # every pod stops, 80/443 and the memory are free
bash deploy/azure-demo/up.sh
sudo systemctl enable --now lodestar-autodeploy.timer
```

`disable` keeps k3s from starting again at the next reboot and racing Caddy for the ports (and for the memory). The two sides have separate databases; each seeds its own demo day. Both use the same `.env`, so the passwords are the same on either side.
