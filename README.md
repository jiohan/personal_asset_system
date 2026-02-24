# Personal Asset Management System

도메인/설계 기준은 `PERSONAL_ASSET_PWA_GUIDE.md`를 기준으로 한다.
초보자용 해설은 `explain.md`를 참고한다.

## MVP Scope
- 거래/계좌/카테고리/태그 관리
- 리포트(summary/transfers)
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
- `.env.example` -> `.env`
- `.env.backend.example` -> `backend/.env.local` (실행 전에 쉘 env로 export)
- `.env.frontend.example` -> `frontend/.env.local`
- `.env.mcp.example` -> `.env.mcp` (MCP 도구용)

참고:
- Spring Boot는 `backend/.env.local`을 자동 로드하지 않는다.
- 백엔드 실행 전 `.env.local`을 shell 환경변수로 주입하거나 IDE Run Configuration 환경변수로 설정한다.

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
- Seed fixture files: `docs/seeds/*`
