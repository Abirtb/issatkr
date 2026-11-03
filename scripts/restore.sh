#!/usr/bin/env bash
# Restore the database (and optionally the uploads) from backups stored in the
# volume's /data/backups. A safety backup of the current state is taken first.
#
#   scripts/restore.sh issatkr-20261007-020000.db [uploads-20261007-020000.tar.gz]
#
# To restore a file kept off-server, first copy it into the volume:
#   docker compose cp ./issatkr-20261007-020000.db app:/data/backups/
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose --profile jobs)
db_backup="${1:-}"
uploads_backup="${2:-}"
if [[ ! "$db_backup" =~ ^issatkr-[0-9]{8}-[0-9]{6}\.db$ ]]; then
  echo "usage: scripts/restore.sh issatkr-YYYYMMDD-HHMMSS.db [uploads-YYYYMMDD-HHMMSS.tar.gz]" >&2
  exit 1
fi
if [ -n "$uploads_backup" ] && [[ ! "$uploads_backup" =~ ^uploads-[0-9]{8}-[0-9]{6}\.tar\.gz$ ]]; then
  echo "restore: unexpected uploads archive name" >&2
  exit 1
fi

echo "==> Verifying the backup"
"${COMPOSE[@]}" run --rm migrate node scripts/db-verify.mjs "/data/backups/$db_backup"

read -r -p "This replaces the live database. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "aborted"; exit 1; }

echo "==> Safety backup of the current database"
"${COMPOSE[@]}" run --rm migrate node scripts/db-backup.mjs --keep 0 || echo "    (no current database to back up)"

echo "==> Stopping the application"
docker compose stop app

echo "==> Restoring"
"${COMPOSE[@]}" run --rm -e DB_BACKUP="$db_backup" -e UPLOADS_BACKUP="$uploads_backup" migrate sh -c '
  set -e
  db="${DATABASE_URL#file:}"
  rm -f "$db-wal" "$db-shm"
  cp "/data/backups/$DB_BACKUP" "$db"
  if [ -n "$UPLOADS_BACKUP" ]; then
    rm -rf "$UPLOAD_DIR.before-restore"
    [ -d "$UPLOAD_DIR" ] && mv "$UPLOAD_DIR" "$UPLOAD_DIR.before-restore"
    tar -xzf "/data/backups/$UPLOADS_BACKUP" -C "$(dirname "$UPLOAD_DIR")"
  fi
'

echo "==> Applying migrations (a backup may predate the current code)"
"${COMPOSE[@]}" run --rm migrate

echo "==> Starting the application"
docker compose up -d app
bash scripts/healthcheck.sh --wait
"${COMPOSE[@]}" run --rm migrate node scripts/db-verify.mjs
