#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <sisyphus-branch> <codex-branch>"
  echo "Example: $0 feat/slice1-accounts-api fix/auth-error-polish"
  exit 1
fi

SIS_BRANCH="$1"
COD_BRANCH="$2"

ROOT_DIR="$(git rev-parse --show-toplevel)"
PARENT_DIR="$(dirname "$ROOT_DIR")"
SIS_DIR="$PARENT_DIR/ams-sisyphus"
COD_DIR="$PARENT_DIR/ams-codex"

cd "$ROOT_DIR"
git fetch origin main

add_worktree() {
  local dir="$1"
  local branch="$2"

  if [[ -d "$dir/.git" || -f "$dir/.git" ]]; then
    echo "[worktree] skip existing: $dir"
    return
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "[worktree] add existing branch $branch -> $dir"
    git worktree add "$dir" "$branch"
  else
    echo "[worktree] create branch $branch from origin/main -> $dir"
    git worktree add "$dir" -b "$branch" origin/main
  fi
}

add_worktree "$SIS_DIR" "$SIS_BRANCH"
add_worktree "$COD_DIR" "$COD_BRANCH"

echo "[worktree] done"
echo "  - Sisyphus: $SIS_DIR ($SIS_BRANCH)"
echo "  - Codex:    $COD_DIR ($COD_BRANCH)"
