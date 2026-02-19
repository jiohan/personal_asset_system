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
- JDK 21 (fixed for MVP)
- Node.js 20 LTS (fixed for MVP)
- npm
- Docker + Docker Compose

## Runtime Version Policy (MVP Fixed)
- Java: `21` (CI and local must match)
- Node.js: `20.x` (CI and local must match)
- Version pin files:
  - `.java-version` -> `21`
  - `.nvmrc` -> `20`

Quick checks:
```bash
java -version
node -v
```

Preflight checks (recommended before coding):
```bash
make preflight
```

If your task touches DB/session/migrations, require Docker in preflight:
```bash
make preflight-docker
```

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

### 1) Fast path (recommended)
```bash
make dev
```

`make dev` does:
- start Postgres via `infra/docker compose`
- run backend (`./mvnw spring-boot:run`)
- run frontend (`npm run dev`)

### 2) Manual split run (optional)
Postgres:
```bash
make postgres-up
```

Backend:
```bash
make dev-backend
```

Frontend:
```bash
make dev-frontend
```

## Local Git Hook (Recommended)
Install the repository hook path once:
```bash
git config core.hooksPath .githooks
```

What the pre-push hook does:
- backend/openapi/infra changes -> `make test-backend` + `make contract-lint`
- frontend changes -> `make test-frontend`
- runs `make preflight` before gate execution

## Dual-Agent Worktree Setup (Recommended)
Create dedicated worktrees for Sisyphus and Codex to avoid same-file concurrent edits:
```bash
./scripts/worktree-start.sh feat/slice1-accounts-api fix/auth-polish
```

## Test
```bash
make test
```

Details:
- `make test-backend`
- `make test-frontend` (`lint + typecheck + test`)

Integration test policy (MVP fixed):
- Backend DB integration test uses Testcontainers(Postgres).
- Purpose: verify app context + Flyway migrations + Spring Session JDBC schema on real Postgres.
- CI: Docker daemon available 상태에서 반드시 실행/통과.
- Local: Docker를 사용할 수 없는 환경에서는 해당 통합테스트가 자동 skip될 수 있음.

## API Contract
- MVP skeleton: `docs/openapi.yaml`
- Source of truth: `PERSONAL_ASSET_PWA_GUIDE.md` section 8~14
- Contract-first CI policy:
  - `make contract-lint` must pass with zero lint problems.
  - PR with contract-relevant backend changes must include `docs/openapi.yaml` update in the same PR.

## Seed/Data Notes
- Seed strategy: `docs/SEED_STRATEGY.md`
- Seed fixture files: `docs/seeds/*`
