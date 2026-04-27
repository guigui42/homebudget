#!/bin/sh
set -eu

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