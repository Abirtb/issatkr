#!/usr/bin/env bash
# Application health check (liveness + database reachability).
#   scripts/healthcheck.sh                       # http://127.0.0.1:${APP_PORT:-3000}/health
#   scripts/healthcheck.sh https://YOUR_DOMAIN/health
#   scripts/healthcheck.sh --wait [URL]          # retry for up to ~60 s (after a deploy)
set -euo pipefail

wait=0
if [ "${1:-}" = "--wait" ]; then
  wait=1
  shift
fi
url="${1:-http://127.0.0.1:${APP_PORT:-3000}/health}"
tries=1
[ "$wait" = 1 ] && tries=30

for attempt in $(seq 1 "$tries"); do
  if body=$(curl -fsS --max-time 5 "$url" 2>/dev/null) && grep -q '"status":"ok"' <<<"$body"; then
    echo "healthy: $url"
    exit 0
  fi
  [ "$attempt" -lt "$tries" ] && sleep 2
done
echo "UNHEALTHY: $url (see: docker compose logs --tail=100 app)" >&2
exit 1
