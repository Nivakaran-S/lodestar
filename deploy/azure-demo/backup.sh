#!/usr/bin/env bash
# Nightly database backup on the demo VM: pg_dumpall of the one Postgres (Lodestar's schemas and Keycloak's database),
# gzipped to backups/ (untracked) and kept for BACKUP_KEEP_DAYS (default 7). Run by autodeploy.sh at most once a day,
# so it needs no timer of its own; run it by hand any time:
#   deploy/azure-demo/backup.sh            restore: gunzip -c backups/<file>.sql.gz | docker compose ... exec -T postgres psql -U lodestar -d postgres
# Off-VM copies: set BACKUP_AZ_CONTAINER_SAS (a container SAS URL) in .env and each dump is also uploaded there.
set -euo pipefail
cd "$(dirname "$0")/../.."

env_val() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }
keep=$(env_val BACKUP_KEEP_DAYS); keep=${keep:-7}
mkdir -p backups
file="backups/lodestar-$(date -u +%Y%m%dT%H%MZ).sql.gz"

# the postgres container of this compose project (no compose files needed to find it)
pg=$(docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}}' | head -1)
[ -n "$pg" ] || { echo "backup: no running postgres container"; exit 1; }

docker exec "$pg" pg_dumpall -U lodestar --clean --if-exists | gzip -9 > "$file.part"
# a dump that ended early is not a backup
[ "$(gunzip -c "$file.part" | tail -c 2000 | grep -c 'PostgreSQL database cluster dump complete')" -ge 1 ] || { rm -f "$file.part"; echo "backup: incomplete dump"; exit 1; }
mv "$file.part" "$file"
echo "backup: $file ($(du -h "$file" | cut -f1))"

sas=$(env_val BACKUP_AZ_CONTAINER_SAS)
if [ -n "$sas" ]; then
  base=${sas%%\?*}; query=${sas#*\?}
  curl -fsS --max-time 600 -X PUT -H 'x-ms-blob-type: BlockBlob' --data-binary @"$file" "$base/$(basename "$file")?$query" >/dev/null \
    && echo "backup: uploaded off the VM" || echo "backup: upload failed (kept on the VM)"
fi

find backups -name 'lodestar-*.sql.gz' -mtime +"$keep" -delete
date -u +%s > backups/.last
