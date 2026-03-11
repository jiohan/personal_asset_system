# Next Steps After Slice 5

This document captures the remaining MVP gaps after enabling Slice 4 (TRANSFER) and Slice 5 (Reports).

## Still Not Implemented (per OpenAPI)

- CSV import: `POST /imports/csv`
- Backup export/import: `GET /backups/export`, `POST /backups/import`

Contract gate note: `bash scripts/contract/spec_impl_drift.sh` currently allows these to remain unimplemented.

## Pre-Slice-6 Audit Snapshot (2026-03-10)

- Backend tests, frontend tests, OpenAPI lint, drift gate, frontend build, and `smoke_local.sh --full` all passed.
- A live API walkthrough was executed against the local stack:
  `signup -> accounts/category create+patch -> expense create+patch+delete -> transfer create -> reports`.
- `/transfers` no longer points to a placeholder; it now routes into the transfer-filtered transactions workspace.
- Reports now provide `This Month` / `Last Month` quick presets for slice 5 verification.

## Suggested Order

1. Slice 6: CSV one-shot import
   - Parse + validate + dedupe(skip) + save (atomic)
   - UI: upload + mapping + results
   - Tests: rollback on failure, duplicate skip, needsReview/excludeFromReports rules

2. Slice 7: Backup export/import v1
   - Export: accounts/categories/transactions/tags
   - Import: current-user replace-all (with safe validation)
   - Tests: round-trip consistency

## Quality Follow-ups (Optional)

- Reports UX: loading skeletons and richer preset ranges (`최근 30일`, `올해 누적`) if slice 6 scope permits.
- Dedicated transfer-only IA is optional; current entry point is `/transactions?type=TRANSFER`.
- Documentation sync: keep `docs/openapi.yaml` and `docs/MVP_TODO_LIST.md` aligned whenever rules change.
