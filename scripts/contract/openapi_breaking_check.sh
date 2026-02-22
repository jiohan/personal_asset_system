#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

BASE_REF="${BASE_REF:-${GITHUB_BASE_REF:-main}}"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

git fetch --no-tags --prune --depth=1 origin "$BASE_REF" >/dev/null

base_yaml="$tmp_dir/base.openapi.yaml"
head_yaml="$tmp_dir/head.openapi.yaml"
base_json="$tmp_dir/base.openapi.json"
head_json="$tmp_dir/head.openapi.json"

git show "origin/$BASE_REF:docs/openapi.yaml" >"$base_yaml"
cp "docs/openapi.yaml" "$head_yaml"

npx -y swagger-cli@4.0.4 bundle -t json -o "$base_json" "$base_yaml" >/dev/null
npx -y swagger-cli@4.0.4 bundle -t json -o "$head_json" "$head_yaml" >/dev/null

node "scripts/contract/openapi_breaking_check.mjs" "$base_json" "$head_json"
