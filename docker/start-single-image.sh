#!/bin/sh
set -eu

# Wait for Postgres to accept connections before starting the API
if [ -n "${DATABASE_URL:-}" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  echo "Waiting for Postgres at $DB_HOST:$DB_PORT..."
  for i in $(seq 1 30); do
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "Postgres is ready."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "ERROR: Postgres not reachable after 30s" >&2
      exit 1
    fi
    sleep 1
  done
fi

bun run /app/apps/api/src/main.ts &
api_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

cleanup() {
  kill "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap cleanup INT TERM

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

set +e
wait "$api_pid"
api_status=$?
wait "$nginx_pid"
nginx_status=$?
set -e

cleanup

if [ "$api_status" -ne 0 ]; then
  exit "$api_status"
fi

exit "$nginx_status"