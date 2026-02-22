#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

openapi_json="$tmp_dir/openapi.bundled.json"
npx -y swagger-cli@4.0.4 bundle -t json -o "$openapi_json" "docs/openapi.yaml" >/dev/null

OPENAPI_JSON="$openapi_json" node "scripts/contract/check_spec_impl_drift.mjs"
