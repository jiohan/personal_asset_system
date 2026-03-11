# Next Steps After Slice 6

This document captures the remaining MVP gaps after enabling Slice 4 (TRANSFER), Slice 5 (Reports), and Slice 6 (CSV import).

## Still Not Implemented (per OpenAPI)

- Backup export/import: `GET /backups/export`, `POST /backups/import`

Contract gate note: `bash scripts/contract/spec_impl_drift.sh` currently allows these to remain unimplemented.

## Post-Slice-6 Snapshot (2026-03-11)

- Backend tests, frontend tests, OpenAPI lint, drift gate, frontend build, and `smoke_local.sh --full` all passed.
- A live API walkthrough was executed against the local stack:
  `signup -> account create -> csv import(created/skip) -> invalid csv rollback`.
- `/transfers` no longer points to a placeholder; it now routes into the transfer-filtered transactions workspace.
- Reports now provide `This Month` / `Last Month` quick presets for slice 5 verification.
- `/imports` is now a real workflow with file upload, column mapping, account mapping, preview, and result feedback.
- GUI review used a Playwright screenshot fallback because Figma MCP / Chrome DevTools MCP were not available in this session.

## Suggested Order

1. Slice 7: Backup export/import v1
   - Export: accounts/categories/transactions/tags
   - Import: current-user replace-all (with safe validation)
   - Tests: round-trip consistency

## Quality Follow-ups (Optional)

- Reports UX: loading skeletons and richer preset ranges (`최근 30일`, `올해 누적`) if slice 7 scope permits.
- Dev ergonomics: avoid stale local processes on `8080`/`5173` before verification, or add a configurable frontend proxy target for multi-instance local testing.
- Dedicated transfer-only IA is optional; current entry point is `/transactions?type=TRANSFER`.
- Documentation sync: keep `docs/openapi.yaml` and `docs/MVP_TODO_LIST.md` aligned whenever rules change.
