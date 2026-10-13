#!/usr/bin/env bash
# systemd installs (DEPLOYMENT.md §18): run a maintenance command as the
# "issatkr" service user with the production database settings loaded.
#   sudo bash scripts/as-service.sh npx prisma migrate deploy
#   sudo bash scripts/as-service.sh npx prisma migrate status
#   sudo bash scripts/as-service.sh node scripts/create-admin.mjs --email ADMIN_EMAIL --name "ADMIN_NAME"
#   sudo bash scripts/as-service.sh node scripts/db-backup.mjs
#   sudo bash scripts/as-service.sh node scripts/db-verify.mjs
# Only the variables these tools need are passed on; nothing is printed.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(id -u)" != "0" ]; then
  echo "as-service: run with sudo" >&2
  exit 1
fi
if [ ! -f .env.production ]; then
  echo "as-service: .env.production not found in $(pwd)" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.production
set +a

exec runuser -u issatkr -- env -i \
  PATH="$PATH" \
  HOME=/var/lib/issatkr \
  NODE_ENV=production \
  CHECKPOINT_DISABLE=1 \
  PRISMA_HIDE_UPDATE_MESSAGE=1 \
  DATABASE_URL="$DATABASE_URL" \
  UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/issatkr/uploads}" \
  BACKUP_DIR="${BACKUP_DIR:-/var/lib/issatkr/backups}" \
  "$@"
