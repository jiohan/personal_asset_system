# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Start infrastructure (Postgres)
```bash
cd infra && docker compose --env-file .env.example up -d
```

### Run backend
```bash
cd backend
set -a && source .env.local && set +a
./mvnw spring-boot:run
```

### Run frontend
```bash
cd frontend && npm install && npm run dev
```

### Tests
```bash
# Backend all tests
cd backend && ./mvnw test

# Backend single test class
cd backend && ./mvnw test -Dtest=TransactionControllerTest

# Frontend all tests (non-watch)
cd frontend && npm run test -- --run

# Frontend single test file
cd frontend && npm run test -- --run src/pages/TransactionsPage.test.tsx
```

### Build & Contract gates
```bash
# Frontend production build
cd frontend && npm run build

# OpenAPI validity check
bash scripts/contract/openapi_lint.sh

# Spec <-> implementation drift check
bash scripts/contract/spec_impl_drift.sh

# Breaking change check (vs main)
BASE_REF=main bash scripts/contract/openapi_breaking_check.sh

# Full-stack smoke check (requires running backend + frontend)
bash scripts/dev/smoke_local.sh --full
```

## Architecture

### Repository layout
```
frontend/   React 18 + TypeScript + Vite + react-router-dom (HashRouter)
backend/    Spring Boot 3.4 + JPA + Flyway + PostgreSQL + Spring Security + Spring Session JDBC
infra/      docker-compose for local Postgres
docs/       openapi.yaml (API contract), seed strategy, fixture JSON files
scripts/    contract gates and smoke test scripts
```

### Backend package structure (`com.jioha.asset`)
Each domain is a self-contained package with Controller → Service → Repository → Entity:
- `auth/` — session-cookie login/signup/logout, CSRF token endpoint
- `account/` — account CRUD, balance projection (computed, never stored)
- `transaction/` — INCOME/EXPENSE/TRANSFER CRUD, soft-delete, pagination/filtering
- `category/` — 2-level (root + child) categories per transaction type
- `csvimport/` — 1-shot CSV import (all-or-nothing rollback)
- `report/` — summary, transfer, cashflow trend, top expense categories, account balance trend
- `domain/` — pure domain logic: `TransactionRuleValidator`, `ReportCalculator`, `TransactionDraft`, `TransactionSnapshot`
- `api/` — global `ApiExceptionHandler`, `ApiErrorResponse`, `PatchPayload` helper
- `config/` — `SecurityConfig`, `SessionCookieConfig`

DB migrations live in `backend/src/main/resources/db/migration/` (Flyway versioned). `V9000__dev_seed_demo.sql` is the dev seed; it only runs in dev profile.

### Frontend structure (`frontend/src/`)
- `api.ts` — all API types + fetch wrappers; single `apiFetch()` function injects XSRF token for non-GET requests
- `context/AuthContext.tsx` — session state via `useAuth()` hook
- `App.tsx` — HashRouter routes; `ProtectedRoute` wraps all authenticated pages
- `components/` — `Layout` (sidebar nav + page header), `QuickEntryComposer` (3-step transaction entry), `SummaryCards`, `TrendCharts`, `CreatableCombobox`, `StateNotice`, `StatusBadge`
- `pages/` — one file per route: `DashboardPage`, `TransactionsPage`, `AccountsPage`, `CategoriesPage`, `ReportsPage`, `ImportsPage`, `AuthPage`
- `rebuild.css` — custom CSS (no CSS framework)

### Key domain rules (enforced in code and DB)
- `amount` is always positive; sign is derived from transaction type/context
- `TRANSFER` uses `fromAccountId` + `toAccountId`; `INCOME`/`EXPENSE` use `accountId`
- `currentBalance` on accounts is always computed from transactions, never stored
- Reports exclude `TRANSFER` from cash flow; transfers have a separate `/reports/transfers` endpoint
- `excludeFromReports=true` expenses are excluded from expense totals
- `needsReview=true` is set automatically when category is missing (e.g., CSV import without category mapping)
- CSV import is atomic: any validation error rolls back the entire batch; duplicates are skipped, never merged
- Soft delete is used for transactions (`deletedAt` field); all queries filter `deletedAt IS NULL`
- Date range convention: `from <= txDate < to` (exclusive upper bound)

### Auth / security
- Session cookie auth (`HttpOnly`, `SameSite=Lax`). Spring Session JDBC stores sessions in DB.
- CSRF protection: frontend calls `GET /api/v1/auth/csrf` to seed the `XSRF-TOKEN` cookie, then sends `X-XSRF-TOKEN` header on all mutating requests. `ensureXsrfCookie()` in `api.ts` handles this automatically.
- Backend returns 404 (not 403) for resources belonging to another user to minimize information leakage.

### Git workflow
- Main branch: `main`. Feature branches: `feat/*`, bug fixes: `fix/*`, docs: `docs/*`, maintenance: `chore/*`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- PR-based merges into `main`; no direct commits to `main`.

### Environment files
Copy these templates and fill in values before running locally:
- `.env.example` → `.env`
- `.env.backend.example` → `backend/.env.local` (must be exported to shell before running backend)
- `.env.frontend.example` → `frontend/.env.local`

Spring Boot does **not** auto-load `.env.local`; use `set -a && source .env.local && set +a` or configure IDE run settings.

### API contract
- Source of truth: `docs/openapi.yaml`
- All API responses follow `{ error: { code, message, fieldErrors? } }` on failure
- Error codes used: 401, 404, 409, 422
- All protected endpoints are under `/api/v1/`

### Progress tracking
- MVP progress source of truth: `docs/MVP_TODO_LIST.md` (check/uncheck boxes only)
- Slice 1–6 are complete as of 2026-03-11; Slice 7 (backup/restore) is next
