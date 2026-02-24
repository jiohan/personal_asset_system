# Contract Implementation Status

Source of truth for the API shape is `docs/openapi.yaml`.

This file is a lightweight checklist to track which operations are implemented in the backend.
CI enforces contract-first via `bash scripts/contract/spec_impl_drift.sh`.

## Operations

- [x] POST /auth/signup
- [x] POST /auth/login
- [x] POST /auth/logout
- [x] GET /auth/me

- [ ] GET /accounts
- [ ] POST /accounts
- [ ] PATCH /accounts/{id}

- [ ] GET /transactions
- [ ] POST /transactions
- [ ] GET /transactions/{id}
- [ ] PATCH /transactions/{id}
- [ ] DELETE /transactions/{id}

- [ ] GET /reports/summary
- [ ] GET /reports/transfers

- [ ] POST /imports/csv

- [ ] GET /backups/export
- [ ] POST /backups/import

- [ ] GET /categories
- [ ] POST /categories
- [ ] PATCH /categories/{id}
