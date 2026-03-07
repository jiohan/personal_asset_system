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

- [ ] POST /imports/csv

- [ ] GET /backups/export
- [ ] POST /backups/import

- [x] GET /categories
- [x] POST /categories
- [x] PATCH /categories/{id}
