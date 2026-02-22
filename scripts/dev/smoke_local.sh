#!/usr/bin/env bash
set -euo pipefail

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
echo "Next (manual): run backend then frontend, and confirm Vite proxy '/api' reaches backend." 
