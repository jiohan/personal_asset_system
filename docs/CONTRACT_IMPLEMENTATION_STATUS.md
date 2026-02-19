# Contract Implementation Status (MVP)

Last updated: 2026-02-19

## Policy
- `docs/openapi.yaml` keeps the full MVP target contract.
- This document tracks what is implemented in code now.
- Each vertical slice must update this file with objective evidence.

## Current Coverage

### Implemented
- `POST /auth/signup` -> `backend/src/main/java/com/jioha/asset/api/auth/AuthController.java`
- `POST /auth/login` -> `backend/src/main/java/com/jioha/asset/api/auth/AuthController.java`
- `GET /auth/me` -> `backend/src/main/java/com/jioha/asset/api/auth/AuthController.java`
- `POST /auth/logout` -> `backend/src/main/java/com/jioha/asset/api/auth/AuthController.java`

### Not Implemented Yet
- Accounts: `/accounts`, `/accounts/{id}`
- Transactions: `/transactions`, `/transactions/{id}`
- Reports: `/reports/summary`, `/reports/transfers`
- Imports: `/imports/csv`
- Backups: `/backups/export`, `/backups/import`
- Categories: `/categories`, `/categories/{id}`

## Recommended Slice Order
1. Accounts CRUD (list/create/patch)
2. Transactions CRUD (income/expense first)
3. Transfer rules + transfer report split
4. Reports summary/transfers completion
5. CSV import one-shot
6. Backup export/import
7. Categories list/create/patch

## Verification Commands
```bash
make test-backend
make test-frontend
make contract-lint
```
