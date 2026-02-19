#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[ai-check] start"

if ! ./scripts/preflight.sh; then
  echo "[ai-check][HINT] run: make runtime-doctor"
  ./scripts/runtime-doctor.sh || true
  exit 1
fi

hooks_path="$(git config --get core.hooksPath || true)"
if [[ "$hooks_path" != ".githooks" ]]; then
  echo "[ai-check][WARN] core.hooksPath is '$hooks_path' (recommended: .githooks)"
  echo "[ai-check][HINT] git config core.hooksPath .githooks"
else
  echo "[ai-check][OK] git hooks path: .githooks"
fi

if command -v opencode >/dev/null 2>&1; then
  echo "[ai-check][OK] opencode installed"
else
  echo "[ai-check][ERROR] opencode is not installed"
  exit 1
fi

if gh auth status >/dev/null 2>&1; then
  echo "[ai-check][OK] gh authenticated"
else
  echo "[ai-check][WARN] gh auth is not active"
fi

for path in opencode.json .opencode/oh-my-opencode.json .codex/config.toml; do
  if [[ -f "$path" ]]; then
    echo "[ai-check][OK] $path"
  else
    echo "[ai-check][WARN] missing local config: $path"
  fi
done

for path in docs/CONTRACT_IMPLEMENTATION_STATUS.md .opencode/commands/test.md; do
  if [[ -f "$path" ]]; then
    echo "[ai-check][OK] $path"
  else
    echo "[ai-check][WARN] missing project helper file: $path"
  fi
done

echo "[ai-check] done"
