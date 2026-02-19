#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASE_SHA:-}" || -z "${HEAD_SHA:-}" ]]; then
  echo "BASE_SHA and HEAD_SHA must be provided."
  exit 2
fi

changed_files="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")"

if [[ -z "$changed_files" ]]; then
  echo "No changed files between $BASE_SHA and $HEAD_SHA."
  exit 0
fi

echo "Changed files:"
echo "$changed_files"

# Contract-relevant backend files:
# - controller/api/dto package changes
# - class names ending with Controller/Request/Response/Api/Dto/DTO
contract_relevant_pattern='^backend/src/main/java/.*/(controller|api|dto)/|^backend/src/main/java/.*(Controller|Request|Response|Api|Dto|DTO)\.java$'

if echo "$changed_files" | grep -Eq "$contract_relevant_pattern"; then
  echo "Detected contract-relevant backend changes."

  if ! echo "$changed_files" | grep -q '^docs/openapi.yaml$'; then
    echo "::error::Contract-first check failed: contract-relevant backend files changed, but docs/openapi.yaml was not updated."
    echo "Please update docs/openapi.yaml in the same PR."
    exit 1
  fi
fi

echo "Contract-first guard passed."
