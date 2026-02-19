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

## API Contract
- MVP skeleton: `docs/openapi.yaml`
- Source of truth: `PERSONAL_ASSET_PWA_GUIDE.md` section 8~14

## Seed/Data Notes
- Seed strategy: `docs/SEED_STRATEGY.md`
- Seed fixture files: `docs/seeds/*`
