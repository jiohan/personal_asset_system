#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/smoke_local.sh [--full]

--full: verify DB + backend endpoint + frontend proxy endpoint.
        Requires backend and frontend dev servers already running.
USAGE
}

full_check=0
if [ "${1:-}" = "--full" ]; then
  full_check=1
elif [ $# -gt 0 ]; then
  usage
  exit 2
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker Desktop and enable WSL integration." >&2
  exit 1
fi

cd infra
docker compose --env-file .env.example up -d

container_id="$(docker ps -q -f name=asset-postgres)"
if [ -z "$container_id" ]; then
  echo "postgres container not running (asset-postgres)" >&2
  exit 1
fi

status="$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)"
if [ "$status" != "healthy" ]; then
  echo "postgres health is '$status' (expected healthy)" >&2
  exit 1
fi

echo "OK: postgres healthy"

if [ "$full_check" -eq 0 ]; then
  echo "Next (manual): run backend then frontend, and confirm Vite proxy '/api' reaches backend."
  echo "Or run: bash scripts/dev/smoke_local.sh --full"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found. Install curl to run --full check." >&2
  exit 1
fi

backend_url="${BACKEND_SMOKE_URL:-http://localhost:8080/api/v1/auth/me}"
proxy_url="${FRONTEND_PROXY_SMOKE_URL:-http://localhost:5173/api/v1/auth/me}"

http_code() {
  local url="$1"
  curl -sS -o /dev/null -m 5 -w "%{http_code}" "$url" || echo "000"
}

backend_code="$(http_code "$backend_url")"
if [ "$backend_code" = "000" ]; then
  echo "backend is not reachable: $backend_url" >&2
  echo "start backend first (e.g. cd backend && ./mvnw spring-boot:run)" >&2
  exit 1
fi

proxy_code="$(http_code "$proxy_url")"
if [ "$proxy_code" = "000" ]; then
  echo "frontend proxy is not reachable: $proxy_url" >&2
  echo "start frontend first (e.g. cd frontend && npm run dev)" >&2
  exit 1
fi

if [ "$backend_code" != "$proxy_code" ]; then
  echo "proxy mismatch: backend=$backend_code frontend-proxy=$proxy_code" >&2
  exit 1
fi

echo "OK: backend reachable ($backend_code)"
echo "OK: frontend proxy reaches backend ($proxy_code)"
