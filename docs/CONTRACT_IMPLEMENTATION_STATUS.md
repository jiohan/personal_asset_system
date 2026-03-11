# Contract Implementation Status

Source of truth for the API shape is `docs/openapi.yaml`.

This file is a lightweight checklist to track which operations are implemented in the backend.
CI enforces contract-first via `bash scripts/contract/spec_impl_drift.sh`.

## Operations

- [x] POST /auth/signup
- [x] POST /auth/login
- [x] POST /auth/logout
- [x] GET /auth/me
- [x] GET /auth/csrf

- [x] GET /accounts
- [x] POST /accounts
- [x] PATCH /accounts/{id}

- [x] GET /transactions
- [x] POST /transactions
- [x] GET /transactions/{id}
- [x] PATCH /transactions/{id}
- [x] DELETE /transactions/{id}

Note:
- Current backend behavior supports INCOME/EXPENSE/TRANSFER flow for transaction create/update.

- [x] GET /reports/summary
- [x] GET /reports/transfers

- [x] POST /imports/csv

- [ ] GET /backups/export
- [ ] POST /backups/import

- [x] GET /categories
- [x] POST /categories
- [x] PATCH /categories/{id}

## Verification Snapshot (2026-03-11)

- Contract gate: `bash scripts/contract/openapi_lint.sh`
- Drift gate: `bash scripts/contract/spec_impl_drift.sh`
- Backend tests: `cd backend && ./mvnw test`
- Frontend tests: `cd frontend && npm run test -- --run`
- Frontend production build: `cd frontend && npm run build`
- Local smoke: `bash scripts/dev/smoke_local.sh --full`
- Fresh runtime import check: signup -> account create -> `POST /imports/csv` (`201 created=1 skipped=1`) -> invalid CSV (`422`, zero partial rows)
- GUI fallback check: Playwright-driven screenshot review of `/imports` with preview + account mapping visible

Live API flow re-verified against the running local stack:
- signup/login/me/logout
- accounts create/list/patch
- categories create/list/patch
- transactions create/list/get/patch/delete
- transfer create/list/report inclusion
- reports summary/transfers
- csv import create/skip/rollback behavior
