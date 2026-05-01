#!/bin/sh
set -eu

# Wait for Postgres to accept connections before starting the API
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Waiting for Postgres to accept connections..."
  for i in $(seq 1 30); do
    if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      echo "Postgres is ready."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "ERROR: Postgres not ready after 30s" >&2
      exit 1
    fi
    sleep 1
  done

  # Run idempotent schema migrations
  echo "Running database migrations..."
  for f in /app/sql/*.sql; do
    echo "  Applying $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
  done
  echo "Migrations complete."
fi

bun /app/dist/main.js &
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