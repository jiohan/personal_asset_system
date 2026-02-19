#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_NODE="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
EXPECTED_JAVA="$(tr -d '[:space:]' < "$ROOT_DIR/.java-version")"

echo "[runtime-doctor] target runtime: node ${EXPECTED_NODE}.x / java ${EXPECTED_JAVA}"

if command -v node >/dev/null 2>&1; then
  current_node_raw="$(node -v)"
  current_node_major="${current_node_raw#v}"
  current_node_major="${current_node_major%%.*}"
  if [[ "$current_node_major" == "$EXPECTED_NODE" ]]; then
    echo "[runtime-doctor][OK] node $current_node_raw"
  else
    echo "[runtime-doctor][WARN] node mismatch: expected ${EXPECTED_NODE}.x, got $current_node_raw"
    if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
      echo "[runtime-doctor][HINT] run:"
      echo "  source \"${NVM_DIR:-$HOME/.nvm}/nvm.sh\" && nvm install $EXPECTED_NODE && nvm use $EXPECTED_NODE"
    else
      echo "[runtime-doctor][HINT] install nvm or use your version manager to switch to node ${EXPECTED_NODE}.x"
    fi
  fi
else
  echo "[runtime-doctor][ERROR] node is not installed"
fi

if [[ -f "$HOME/.npmrc" ]] && grep -Eq '^(prefix|globalconfig)\s*=' "$HOME/.npmrc"; then
  echo "[runtime-doctor][WARN] ~/.npmrc contains prefix/globalconfig which can block nvm"
  echo "[runtime-doctor][HINT] run:"
  echo "  npm config delete prefix"
  echo "  npm config delete globalconfig"
fi

if command -v java >/dev/null 2>&1; then
  current_java_major="$(java -version 2>&1 | awk -F '[\".]' '/version/ {print $2; exit}')"
  if [[ "$current_java_major" == "$EXPECTED_JAVA" ]]; then
    echo "[runtime-doctor][OK] java $current_java_major"
  else
    echo "[runtime-doctor][WARN] java mismatch: expected $EXPECTED_JAVA, got $current_java_major"
  fi
else
  echo "[runtime-doctor][ERROR] java is not installed"
fi

if docker info >/dev/null 2>&1; then
  echo "[runtime-doctor][OK] docker daemon reachable"
else
  echo "[runtime-doctor][WARN] docker daemon is not reachable"
  echo "[runtime-doctor][HINT] DB/session/Testcontainers tasks require Docker"
fi
