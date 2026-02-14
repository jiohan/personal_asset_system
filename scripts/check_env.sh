#!/usr/bin/env bash
set -euo pipefail

need() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[FAIL] missing: $cmd" >&2
    return 1
  fi
  echo "[OK]   $cmd -> $(command -v "$cmd")"
}

ok=1
need git || ok=0
need java || ok=0
need node || ok=0
need npm || ok=0
need docker || ok=0

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[OK]   docker daemon reachable"
  else
    echo "[WARN] docker installed but daemon not reachable (Docker Desktop/engine not running?)" >&2
  fi

  if docker compose version >/dev/null 2>&1; then
    echo "[OK]   docker compose -> $(docker compose version | head -n 1)"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "[OK]   docker-compose -> $(docker-compose version | head -n 1)"
  else
    echo "[FAIL] missing: docker compose" >&2
    ok=0
  fi
fi

echo
java -version 2>&1 | head -n 2 || true
node -v || true
npm -v || true

echo
if [[ "$ok" -eq 1 ]]; then
  echo "Environment check: PASS"
  exit 0
else
  echo "Environment check: FAIL" >&2
  exit 1
fi
