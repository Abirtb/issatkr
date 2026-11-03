#!/usr/bin/env bash
# Backup of the database and the uploaded justificatifs.
#   - database: consistent online copy (VACUUM INTO) + integrity check
#   - uploads : tar.gz of UPLOAD_DIR
# Both land in the volume's /data/backups (last BACKUP_KEEP kept, default 30).
# A backup on the same disk is NOT enough: set BACKUP_EXPORT_DIR to a mounted
# off-server location (NAS, second disk, …) so a copy leaves the volume.
#
#   BACKUP_EXPORT_DIR=/mnt/backup/issatkr scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose --profile jobs)
KEEP="${BACKUP_KEEP:-30}"
stamp=$(date -u +%Y%m%d-%H%M%S)

"${COMPOSE[@]}" run --rm migrate node scripts/db-backup.mjs --keep "$KEEP"

"${COMPOSE[@]}" run --rm migrate sh -c '
  set -e
  archive="/data/backups/uploads-'"$stamp"'.tar.gz"
  mkdir -p "$UPLOAD_DIR"
  tar -czf "$archive" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "uploads backup: $archive"
  ls -1t /data/backups/uploads-*.tar.gz | tail -n +'"$((KEEP + 1))"' | xargs -r rm -f
'

if [ -n "${BACKUP_EXPORT_DIR:-}" ]; then
  mkdir -p "$BACKUP_EXPORT_DIR"
  chmod 700 "$BACKUP_EXPORT_DIR"
  # Copies the volume's backup folder out through the running app container.
  docker compose cp app:/data/backups/. "$BACKUP_EXPORT_DIR/"
  echo "exported to: $BACKUP_EXPORT_DIR"
else
  echo "warning: BACKUP_EXPORT_DIR not set — backups stay on this server only" >&2
fi
