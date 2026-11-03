#!/usr/bin/env bash
# Retries pending/failed notification e-mails. Run from the host's crontab, e.g.
#   */15 * * * * /opt/issatkr/scripts/cron-notifications.sh >> /var/log/issatkr-cron.log 2>&1
# The secret is read from .env.production and passed to curl on stdin, so it
# never appears in the process list or the log.
set -euo pipefail
cd "$(dirname "$0")/.."

secret=$(grep -E '^CRON_SECRET=' .env.production | head -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
if [ -z "$secret" ]; then
  echo "cron-notifications: CRON_SECRET is not set in .env.production" >&2
  exit 1
fi
printf 'Authorization: Bearer %s\n' "$secret" |
  curl -fsS --max-time 60 -X POST -H @- "http://127.0.0.1:${APP_PORT:-3000}/api/cron/notifications"
echo
