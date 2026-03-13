# Personal Asset Management System

도메인/설계 기준은 `PERSONAL_ASSET_PWA_GUIDE.md`를 기준으로 한다.
초보자용 해설은 `docs/explain.md`를 참고한다.

## MVP Scope
- 거래/계좌/카테고리/태그 관리
- 리포트(summary/transfers/cashflow/top-expense/balance trend)
- CSV one-shot import
- backup export/import(v1)
- 인증 + user scope

## Repository Layout
```text
frontend/   React + TypeScript + Vite
backend/    Spring Boot + Flyway + Postgres
infra/      docker-compose and infra env
docs/       OpenAPI, seed strategy, fixtures
```

## Prerequisites
- JDK 21
- Node.js 20 (CI baseline)
- npm
- Docker Desktop + WSL integration (for Postgres via `infra/docker-compose.yml`)

## Environment Files
복사해서 로컬 파일을 만든 뒤 값 입력:

| template | 복사 위치 | 용도 |
| --- | --- | --- |
| `.env.example` | `.env` | 로컬 공통 기본값(포트/DB 호스트/타임존) |
| `infra/.env.example` | `infra/.env` 또는 `docker compose --env-file infra/.env.example` | Docker Postgres 컨테이너 환경 |
| `.env.backend.example` | `backend/.env.local` | Spring Boot 런타임 환경 |
| `.env.frontend.example` | `frontend/.env.local` | 프론트 API base override가 필요할 때만 사용 |
| `.env.mcp.example` | `.env.mcp` | GitHub/Jira 등 MCP 도구용 시크릿 |

참고:
- Spring Boot는 `backend/.env.local`을 자동 로드하지 않는다.
- 백엔드 실행 전 `.env.local`을 shell 환경변수로 주입하거나 IDE Run Configuration 환경변수로 설정한다.
- `frontend/.env.local`은 기본값이 `/api/v1`라서, 프록시를 바꾸지 않으면 생략 가능하다.

## Claude Code / MCP
- 공유 가능한 Claude Code 설정은 `.claude/settings.json`, `.claude/commands/`, `.claude/agents/`에 있다.
- 프로젝트 MCP 설정은 `.mcp.json`에 있다.
- 개인 시크릿은 `.claude/settings.local.json`과 `.env.mcp`에만 두고 커밋하지 않는다.

## Local Run

### 1) Postgres
```bash
cd infra
docker compose --env-file .env.example up -d
```

Smoke check (DB health):
```bash
bash scripts/dev/smoke_local.sh
```

Full-stack smoke check (after backend + frontend are running):
```bash
bash scripts/dev/smoke_local.sh --full
```

If `docker` is not found in WSL:
- Enable Docker Desktop -> Settings -> Resources -> WSL Integration for your distro
- Re-open the terminal and re-run the command

### 2) Backend
```bash
cd backend
set -a
source .env.local
set +a
./mvnw spring-boot:run
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```

## Test
```bash
cd backend && ./mvnw test
cd frontend && npm run test -- --run
```

## Slice 1-6 Status
Verified on 2026-03-11:
- Slice 1: auth/session/CSRF flow is implemented and tested
- Slice 2: accounts CRUD + current balance projection is implemented and tested
- Slice 3: income/expense transactions + categories + inbox rules are implemented and tested
- Slice 4: transfer create/update/list flow is implemented; `/transfers` now routes to the transfer-filtered transactions workspace
- Slice 5: reports summary/transfers are implemented; reports page includes `This Month` / `Last Month` presets
- Slice 6: CSV one-shot import is implemented; `/imports` now supports upload, header mapping, account mapping, preview, duplicate skip, and atomic rollback on validation failure

Post-slice-6 verification commands:
```bash
cd backend && ./mvnw test
cd frontend && npm run test -- --run
bash scripts/contract/openapi_lint.sh
bash scripts/contract/spec_impl_drift.sh
cd frontend && npm run build
bash scripts/dev/smoke_local.sh --full
```

Runtime verification notes:
- Fresh backend runtime check passed for `POST /imports/csv`: `201 Created` with `createdCount=1`, `skippedCount=1`
- Invalid CSV runtime check passed: `422 VALIDATION_ERROR`, and no partial rows were saved
- GUI audit fallback used a Playwright screenshot of `/imports` because Figma MCP / Chrome DevTools MCP were unavailable in this session

## MVP Progress Source of Truth
- Single source of truth: `docs/MVP_TODO_LIST.md`
- Rule: update progress only by checking/unchecking boxes in that file; Jira/GitHub boards are reference-only.

## Contract/Drift Gates (P0)
```bash
# OpenAPI validity gate
bash scripts/contract/openapi_lint.sh

# Spec <-> implementation drift gate (contract-first enforcement)
bash scripts/contract/spec_impl_drift.sh

# Breaking change gate (compare against base branch)
BASE_REF=main bash scripts/contract/openapi_breaking_check.sh
```

## API Contract
- MVP skeleton: `docs/openapi.yaml`
- Source of truth: `PERSONAL_ASSET_PWA_GUIDE.md` section 8~14

## Seed/Data Notes
- Seed strategy: `docs/SEED_STRATEGY.md`
- Dev demo seed SQL: `backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql`
- Seed fixture files: `docs/seeds/*`
