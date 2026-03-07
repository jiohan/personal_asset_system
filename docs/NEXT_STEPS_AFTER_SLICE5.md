# Next Steps After Slice 5

This document captures the remaining MVP gaps after enabling Slice 4 (TRANSFER) and Slice 5 (Reports).

## Still Not Implemented (per OpenAPI)

- CSV import: `POST /imports/csv`
- Backup export/import: `GET /backups/export`, `POST /backups/import`

Contract gate note: `bash scripts/contract/spec_impl_drift.sh` currently allows these to remain unimplemented.

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

- Dedicated `/transfers` page (currently a placeholder; transfers can be created via Transactions).
- Reports UX: month preset selector, “last month / this month” shortcuts, and loading skeletons.
- Documentation sync: keep `docs/openapi.yaml` and `docs/MVP_TODO_LIST.md` aligned whenever rules change.
