#!/usr/bin/env bash
# Build and (re)deploy ISSATKr with Docker Compose. Safe to re-run: first
# install and every update use the same steps.
#   1. keep the running images as :previous (for scripts/rollback.sh)
#   2. build the images
#   3. back up the database (when one exists)
#   4. apply Prisma migrations (prisma migrate deploy)
#   5. start / replace the app container and wait until it is healthy
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.production
COMPOSE=(docker compose --profile jobs)

if [ ! -f "$ENV_FILE" ]; then
  echo "deploy: $ENV_FILE is missing. Copy .env.production.example and fill it in." >&2
  exit 1
fi
perm=$(stat -c %a "$ENV_FILE")
if [ "$perm" != "600" ] && [ "$perm" != "400" ]; then
  echo "deploy: $ENV_FILE is readable by others (mode $perm). Run: chmod 600 $ENV_FILE" >&2
  exit 1
fi

echo "==> Keeping the current images as :previous"
for image in issatkr-app issatkr-tools; do
  if docker image inspect "$image:latest" >/dev/null 2>&1; then
    docker tag "$image:latest" "$image:previous"
  fi
done

echo "==> Building images"
"${COMPOSE[@]}" build --pull

echo "==> Backing up the database before migrating"
if "${COMPOSE[@]}" run --rm migrate node -e \
  "process.exit(require('fs').existsSync(process.env.DATABASE_URL.replace(/^file:/,''))?0:1)"; then
  "${COMPOSE[@]}" run --rm migrate node scripts/db-backup.mjs --keep "${BACKUP_KEEP:-30}"
else
  echo "    no database yet (first deployment)"
fi

echo "==> Applying database migrations"
"${COMPOSE[@]}" run --rm migrate

echo "==> Starting the application"
docker compose up -d app

echo "==> Waiting for the health check"
bash scripts/healthcheck.sh --wait

cat <<'EOF'
==> Deployed.
    First deployment only: create the first administrator with
      docker compose --profile jobs run --rm migrate node scripts/create-admin.mjs --email ADMIN_EMAIL --name "ADMIN_NAME"
EOF
