#!/usr/bin/env bash
# Roll the application back to the images that were running before the last
# scripts/deploy.sh (tagged :previous). No rebuild.
#
# Database: migrations only move forward. If the failed release applied a
# migration the previous code cannot use, also restore the backup that
# deploy.sh took just before migrating:  scripts/restore.sh issatkr-<stamp>.db
set -euo pipefail
cd "$(dirname "$0")/.."

for image in issatkr-app issatkr-tools; do
  if ! docker image inspect "$image:previous" >/dev/null 2>&1; then
    echo "rollback: no $image:previous image (nothing to roll back to)" >&2
    exit 1
  fi
done

docker tag issatkr-app:previous issatkr-app:latest
docker tag issatkr-tools:previous issatkr-tools:latest
docker compose up -d --no-build app
bash scripts/healthcheck.sh --wait

echo "Rolled back. Most recent database backups (for scripts/restore.sh if needed):"
docker compose exec app sh -c 'ls -1t /data/backups/issatkr-*.db 2>/dev/null | head -3'
