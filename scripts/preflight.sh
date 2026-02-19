#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_NODE="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
EXPECTED_JAVA="$(tr -d '[:space:]' < "$ROOT_DIR/.java-version")"
REQUIRE_DOCKER=false

for arg in "$@"; do
  if [[ "$arg" == "--require-docker" ]]; then
    REQUIRE_DOCKER=true
  fi
done

errors=0

echo "[preflight] checking runtime versions and docker availability"

if ! command -v node >/dev/null 2>&1; then
  echo "[preflight][ERROR] node is not installed"
  errors=$((errors + 1))
else
  current_node_raw="$(node -v)"
  current_node_major="${current_node_raw#v}"
  current_node_major="${current_node_major%%.*}"

  if [[ "$current_node_major" != "$EXPECTED_NODE" ]]; then
    echo "[preflight][ERROR] node major mismatch: expected $EXPECTED_NODE.x, got $current_node_raw"
    echo "[preflight][HINT] run: nvm use $EXPECTED_NODE"
    errors=$((errors + 1))
  else
    echo "[preflight][OK] node $current_node_raw"
  fi
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[preflight][ERROR] java is not installed"
  errors=$((errors + 1))
else
  current_java_major="$(java -version 2>&1 | awk -F '[\".]' '/version/ {print $2; exit}')"

  if [[ "$current_java_major" != "$EXPECTED_JAVA" ]]; then
    echo "[preflight][ERROR] java major mismatch: expected $EXPECTED_JAVA, got $current_java_major"
    errors=$((errors + 1))
  else
    echo "[preflight][OK] java $current_java_major"
  fi
fi

if docker info >/dev/null 2>&1; then
  echo "[preflight][OK] docker daemon reachable"
else
  if [[ "$REQUIRE_DOCKER" == true ]]; then
    echo "[preflight][ERROR] docker daemon is not reachable but --require-docker was requested"
    errors=$((errors + 1))
  else
    echo "[preflight][WARN] docker daemon is not reachable (required for DB/session/Testcontainers tasks)"
  fi
fi

if (( errors > 0 )); then
  echo "[preflight] failed with $errors error(s)"
  exit 1
fi

echo "[preflight] passed"
