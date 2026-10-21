#!/usr/bin/env bash
# Pull-based continuous deployment, run on the demo VM every few minutes by a systemd timer
# (deploy/azure-demo/install-autodeploy.sh). When .github/workflows/deploy-demo.yml has finished a successful run
# for a commit newer than the one deployed, this checks that commit out, pulls the images the run pushed and
# restarts only the containers whose image or settings changed (deploy/azure-demo/up.sh in pull mode).
#
# Stop it:   touch .deploy-freeze             (or DEPLOY_UNTIL=<ISO date> in .env, e.g. a submission deadline)
# Watch it:  journalctl -u lodestar-autodeploy -f
set -euo pipefail
cd "$(dirname "$0")/../.."

exec 9>/tmp/lodestar-autodeploy.lock
flock -n 9 || exit 0   # a deploy is still running

env_val() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }

# the nightly database backup (deploy/azure-demo/backup.sh): once a day, before any deploy check, even when frozen
last=$(cat backups/.last 2>/dev/null || echo 0)
if [ $(( $(date -u +%s) - last )) -ge 86400 ]; then
  mkdir -p backups
  # a failed backup is retried in an hour, not on every 3-minute run
  bash deploy/azure-demo/backup.sh || { echo "backup failed; retrying in an hour"; echo $(( $(date -u +%s) - 86400 + 3600 )) > backups/.last; }
fi

[ -e .deploy-freeze ] && { echo "frozen (.deploy-freeze)"; exit 0; }
until=$(env_val DEPLOY_UNTIL)
if [ -n "$until" ] && [ "$(date -u +%s)" -gt "$(date -u -d "$until" +%s)" ]; then
  echo "frozen (DEPLOY_UNTIL=$until has passed)"; exit 0
fi

repo=$(git remote get-url origin | sed -E 's#^https://github\.com/##; s#\.git$##')
sha=$(curl -fsSL --max-time 20 -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$repo/actions/workflows/deploy-demo.yml/runs?branch=main&status=success&per_page=20" \
  | jq -r '[.workflow_runs[] | select(.event != "pull_request")][0].head_sha // empty')   # PR runs only check, never deploy
[ -n "$sha" ] || exit 0
[ "$sha" = "$(cat .deployed-sha 2>/dev/null || true)" ] && exit 0

echo "deploying $sha"
git fetch -q origin main
git merge-base --is-ancestor "$sha" origin/main || { echo "$sha is not on main; skipped"; exit 1; }
git reset -q --hard "$sha"   # tracked files only: .env, data/ and the deploy markers are untracked

# REGISTRY and TAG switch up.sh to pull mode (the images this workflow pushed)
grep -qE '^REGISTRY=.+' .env || echo "REGISTRY=ghcr.io/$(cut -d/ -f1 <<<"$repo" | tr '[:upper:]' '[:lower:]')" >> .env
grep -qE '^TAG=.+' .env || echo "TAG=main" >> .env
# private GHCR packages: a read:packages token in .env (public packages need none)
token=$(env_val GHCR_TOKEN)
[ -n "$token" ] && echo "$token" | docker login ghcr.io -u "$(env_val GHCR_USER)" --password-stdin >/dev/null

deploy/azure-demo/up.sh
echo "$sha" > .deployed-sha
docker image prune -f >/dev/null
echo "deployed $sha"
