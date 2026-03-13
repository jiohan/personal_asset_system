# Claude Code 환경 세팅 계획서

> 작성일: 2026-03-13
> 대상: `asset-management-system` 프로젝트에서 Claude Code를 최대한 활용하기 위한 MCP, Custom Agents, Skills(Slash Commands), Hooks, Settings 설정 계획

---

## 0. 현재 상태 분석

### 현재 구성 (OpenCode용)
`opencode.json`에 이미 아래 MCP 서버들이 **OpenCode CLI 전용**으로 설정되어 있다.

| 서버 | 역할 | 상태 |
|------|------|------|
| `context7` | Upstash 벡터 DB (장기 문서 참조) | 활성 |
| `sequential_thinking` | 단계별 사고 체인 | 활성 |
| `filesystem` | 파일시스템 접근 | 활성 |
| `github` | GitHub PR/이슈 관리 | 활성 |
| `jira` | Jira 티켓 관리 | 활성 |
| `testsprite` | 테스트 자동 생성 | 활성 |

**중요**: 이 설정들은 OpenCode CLI 전용이며, **Claude Code에서는 별도로 설정해야 한다.**
Claude Code의 MCP 설정은 `.mcp.json` (프로젝트 공유용) 또는 `claude mcp add` CLI 명령으로 관리된다.

### 현재 Claude Code 상태
- `~/.claude/settings.json`: `{}` (완전 비어있음)
- `.claude/` 디렉터리: 없음
- `.mcp.json`: 없음
- Custom agents: 없음
- Custom skills/commands: 없음

### 프로젝트 특성 (설정 방향을 결정하는 핵심 요소)
1. **계약 우선(Contract-First)**: `docs/openapi.yaml` ↔ 백엔드 구현 드리프트 감지가 P0 품질 게이트
2. **버티컬 슬라이스**: DB → API → UI → Test를 한 번에 완결하는 개발 방식
3. **도메인 규칙 엄격성**: amount 항상 양수, TRANSFER 분리, 잔액 계산 never stored 등 — 실수 한 번이 데이터 오염
4. **기존 자동화 스크립트**: `scripts/contract/` 3개, `scripts/dev/smoke_local.sh` — Claude Code에서 쉽게 호출할 수 있어야 함
5. **재무 도메인**: DB를 직접 조회해 잔액 계산 검증, 리포트 수치 확인이 자주 필요함
6. **Playwright E2E**: `playwright-checks/` 에 이미 E2E 스펙 존재

---

## 1. MCP 서버 설정 계획

### 1-1. PostgreSQL DB MCP

**추가 이유:**
이 프로젝트의 핵심 비즈니스 로직은 "숫자가 의미상 맞는가"다. `currentBalance`는 트랜잭션에서 계산되고, 리포트는 TRANSFER를 현금흐름에서 제외하는 복잡한 집계를 수행한다. 개발 중에 "내가 만든 API가 정말 맞는 숫자를 내고 있나?"를 확인하려면 DB를 직접 조회해야 한다. 현재는 매번 pgAdmin을 열거나 `psql` 명령을 쳐야 하는데, MCP를 통해 Claude Code 대화 안에서 바로 SQL 실행 및 결과 분석이 가능해진다.

**구체적 활용 시나리오:**
- "이번 달 EXPENSE 합계가 리포트 API 응답과 일치하나 SQL로 검증해줘"
- "needsReview=true인 거래 목록 보여줘"
- "계좌 ID 3번의 currentBalance를 수동 계산해서 API 응답과 비교해줘"
- Flyway 마이그레이션 작성 전 현재 스키마 구조 즉시 확인

**설정 방식:** 프로젝트 scope (`.mcp.json`), 팀 공유 가능하나 credentials는 env var로

```json
// .mcp.json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub"],
      "env": {
        "DATABASE_URL": "${DB_URL:-postgresql://asset:asset@localhost:5432/asset_db}"
      }
    }
  }
}
```

---

### 1-2. GitHub MCP

**추가 이유:**
`AGENTS.md`에 명시된 대로 이 프로젝트는 PR 기반 머지 워크플로를 사용한다. 현재 `feat/ui_ux_rebuild` 브랜치에서 작업 중이며, Slice 7 등 이후 작업도 모두 PR 기반이다. GitHub MCP가 있으면:
- PR 생성/리뷰를 Claude Code 대화 안에서 처리 가능
- 이슈 생성, 브랜치 상태 확인 가능
- OpenCode에서는 이미 GitHub MCP를 쓰고 있으므로 `.env.mcp`에 `GITHUB_TOKEN`이 이미 존재함 → 추가 비용 없음

**설정 방식:** 프로젝트 scope, `GITHUB_TOKEN`은 `.env.mcp`에서 로드

```json
// .mcp.json에 추가
"github": {
  "type": "stdio",
  "command": "bash",
  "args": ["-lc", "source .env.mcp 2>/dev/null; npx -y @modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

---

### 1-3. Fetch/Web MCP

**추가 이유:**
Spring Boot 3.4 + Spring Security 6의 CSRF 설정, Flyway PostgreSQL dialect 문제, Vitest 설정 등 공식 문서 참조가 필요한 경우가 자주 발생한다. 현재 Claude Code는 기본적으로 웹 검색이 제한적이다. `mcp-fetch` 서버를 추가하면 공식 Docs URL을 직접 읽어서 최신 API 확인이 가능해진다.

**구체적 활용 시나리오:**
- Spring Security 6 CSRF 설정 공식 문서 즉시 참조
- React Router v7 API 변경사항 확인 (현재 7.13.1 사용 중)
- OpenAPI 3.1 스펙 형식 확인

```json
// .mcp.json에 추가
"fetch": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"]
}
```

---

### 1-4. Playwright MCP (선택적)

**추가 이유:**
`playwright-checks/runtime-rebuild.spec.js`가 이미 존재하며 회원가입 → 계좌 생성 → 거래 입력 → 리포트 확인까지의 전체 E2E 플로를 검증한다. Playwright MCP를 추가하면 Claude Code 대화 중에 직접 브라우저를 열고 현재 UI 상태를 스크린샷으로 확인하거나, 특정 UI 버그를 재현하는 게 가능해진다.

**단, 조건부 추천**: 로컬 개발 환경에서 `npm run dev` + 백엔드가 실행 중인 경우에만 유용. 항상 실행 중인 환경이 아니라면 효용이 낮다.

```json
// .mcp.json에 추가 (선택)
"playwright": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@playwright/mcp"]
}
```

---

### MCP 설정 우선순위 요약

| 순위 | 서버 | 필수 여부 | 이유 |
|------|------|-----------|------|
| 1 | PostgreSQL | 강력 권장 | 재무 계산 검증, 핵심 |
| 2 | GitHub | 권장 | 이미 토큰 있음, PR 워크플로 |
| 3 | Fetch | 권장 | 공식 문서 참조 |
| 4 | Playwright | 선택 | UI 디버깅, 환경 의존 |

---

## 2. Custom Agents 설정 계획

Custom Agents는 `.claude/agents/` 디렉터리에 `AGENT.md` 파일로 정의한다.

---

### 2-1. `contract-guard` 에이전트

**목적:** OpenAPI 스펙과 백엔드 구현의 드리프트를 감지하는 전문 에이전트

**추가 이유:**
이 프로젝트는 계약 우선(Contract-First) 원칙을 P0 품질 게이트로 운영한다. 새로운 엔드포인트를 추가하거나 DTO를 수정할 때마다 `docs/openapi.yaml`과 `backend/src/main/java/` 구현이 동시에 맞아야 한다. 현재 `opencode.json`에는 `contract-check` 커맨드가 있지만 Claude Code에는 없다. 이 에이전트가 있으면 "지금 드리프트 없어?" 한 마디로 즉시 확인 가능.

```markdown
// .claude/agents/contract-guard/AGENT.md
---
name: contract-guard
description: OpenAPI 스펙과 백엔드 구현의 드리프트를 감지하고 리포트한다. 새 엔드포인트 추가, DTO 수정, 백엔드 구조 변경 후 계약 일치 여부를 검증할 때 사용한다.
tools: Read, Grep, Glob, Bash
model: sonnet
---

당신은 이 프로젝트의 계약 준수 감사관이다.

## 검증 대상
- `docs/openapi.yaml`: API 계약 원본
- `backend/src/main/java/com/jioha/asset/`: 실제 구현

## 검증 절차
1. `docs/openapi.yaml`에서 모든 paths와 operations를 추출한다
2. 각 operation의 requestBody, response schema를 확인한다
3. 백엔드 `*Controller.java` 파일에서 매핑된 엔드포인트와 DTO를 추출한다
4. `bash scripts/contract/spec_impl_drift.sh` 실행 결과를 포함한다
5. 아래 형식으로 리포트한다:

## 리포트 형식
**스펙 있음, 구현 없음**: (누락 목록)
**구현 있음, 스펙 없음**: (초과 목록)
**스키마 불일치**: (구체적 필드 diff)
**결론**: PASS / FAIL + 수정 우선순위
```

---

### 2-2. `slice-architect` 에이전트

**목적:** 새 버티컬 슬라이스의 설계와 범위를 결정하는 에이전트

**추가 이유:**
이 프로젝트의 개발 방식은 버티컬 슬라이스다. Slice 7(백업/복원)을 시작할 때 "어떤 파일을 건드려야 하고, 어떤 파일은 건드리면 안 되고, 완료 기준이 뭔지"를 명확히 정해야 한다. `opencode.json`의 `slice-start` 커맨드에 해당하는 Claude Code 버전이다. DB 스키마 설계 → API 스펙 초안 → 프론트엔드 UI 설계 → 테스트 기준까지 한 번에 정의해준다.

```markdown
// .claude/agents/slice-architect/AGENT.md
---
name: slice-architect
description: 새 버티컬 슬라이스의 범위, 파일 소유권, 완료 기준을 설계한다. 새 기능 슬라이스 시작 전 반드시 사용한다.
tools: Read, Grep, Glob
model: sonnet
---

당신은 이 프로젝트의 버티컬 슬라이스 설계자다.

## 프로젝트 구조 원칙 (반드시 준수)
- 개발 방식: DB → API (openapi.yaml) → Backend → Frontend → Test 순서
- 계약 원본: `docs/openapi.yaml`
- 도메인 규칙: `explain.md`, `PERSONAL_ASSET_PWA_GUIDE.md`
- 기존 슬라이스 1-6 완료 상태: `docs/MVP_TODO_LIST.md` 참조

## 슬라이스 설계 출력 형식

### 1. 허용 파일 경로 (건드려도 되는 것)
- backend/src/... (구체적 파일)
- frontend/src/... (구체적 파일)
- docs/openapi.yaml (어떤 paths 추가)

### 2. 금지 파일 경로 (건드리면 안 되는 것)
- 이유와 함께

### 3. 완료 기준 (DoD)
- 각 검증 명령과 기대 결과 명시

### 4. 도메인 리스크
- 기존 규칙(amount 양수, TRANSFER 분리 등)에 영향을 미치는 요소

### 5. 롤백 계획
```

---

### 2-3. `db-analyst` 에이전트

**목적:** PostgreSQL DB에 직접 접근해서 재무 계산을 검증하는 에이전트

**추가 이유:**
이 프로젝트의 가장 중요한 불변식 중 하나는 "리포트 숫자가 맞아야 한다"는 것이다. `totalExpense`는 EXPENSE 타입만 집계, `excludeFromReports=true`인 것은 제외, TRANSFER는 현금흐름에서 빠져야 한다. API 응답으로 나온 숫자가 실제 DB 데이터와 일치하는지 확인하는 작업이 개발 중 반복적으로 필요하다. PostgreSQL MCP와 연동해서 사용한다.

```markdown
// .claude/agents/db-analyst/AGENT.md
---
name: db-analyst
description: PostgreSQL DB에 직접 SQL을 실행해서 재무 계산을 검증한다. 리포트 수치 검증, 잔액 계산 확인, 데이터 정합성 점검에 사용한다.
tools: Bash, Read
model: sonnet
mcpServers:
  - postgres
---

당신은 이 프로젝트의 재무 데이터 검증 전문가다.

## 이 프로젝트의 핵심 도메인 규칙 (SQL 작성 시 반드시 반영)

### 집계 규칙
- totalIncome: type = 'INCOME' AND deleted_at IS NULL AND needs_review = false
- totalExpense: type = 'EXPENSE' AND deleted_at IS NULL AND needs_review = false AND exclude_from_reports = false
- netSaving: totalIncome - totalExpense
- transferVolume: type = 'TRANSFER' AND deleted_at IS NULL

### currentBalance 계산 (저장 안 함, 항상 계산)
```sql
SELECT
  a.opening_balance
  + COALESCE(SUM(CASE WHEN t.type IN ('INCOME') AND t.account_id = a.id THEN t.amount ELSE 0 END), 0)
  + COALESCE(SUM(CASE WHEN t.type = 'TRANSFER' AND t.to_account_id = a.id THEN t.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type IN ('EXPENSE') AND t.account_id = a.id THEN t.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN t.type = 'TRANSFER' AND t.from_account_id = a.id THEN t.amount ELSE 0 END), 0)
  AS current_balance
FROM accounts a
LEFT JOIN transactions t ON t.deleted_at IS NULL AND t.user_id = a.user_id
WHERE a.id = :accountId
```

### 날짜 범위 규칙
- from <= tx_date < to (상한 exclusive)

## 검증 작업 시 항상 포함할 것
1. API 응답 기대값
2. 실제 SQL 쿼리
3. 쿼리 결과
4. PASS / FAIL 결론
```

---

## 3. Custom Skills (Slash Commands) 설정 계획

Custom Slash Commands는 `.claude/commands/` 디렉터리에 `.md` 파일로 정의한다.
파일명이 커맨드명이 된다: `test-gates.md` → `/test-gates`

---

### 3-1. `/test-gates` — 변경 범위 감지 후 필요한 테스트만 실행

**추가 이유:**
`opencode.json`의 `test-gates` 커맨드와 동일한 역할이다. 프론트엔드만 바꿨을 때 백엔드 테스트까지 다 돌릴 필요가 없고, 백엔드만 바꿨을 때 프론트엔드 테스트만 돌리면 낭비다. `git diff`로 변경 범위를 감지하고 필요한 게이트만 선택적으로 실행하면 피드백 루프가 빨라진다.

```markdown
// .claude/commands/test-gates.md
---
description: 현재 변경 범위를 감지해서 필요한 테스트 게이트만 실행하고 결과를 요약한다
allowed-tools: Bash
---

git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD를 실행해서 변경된 파일 목록을 확인한 뒤:

**백엔드/OpenAPI/인프라 변경 감지 시** (backend/, docs/openapi.yaml, infra/ 포함):
1. `cd backend && ./mvnw test` 실행
2. `bash scripts/contract/openapi_lint.sh` 실행
3. `bash scripts/contract/spec_impl_drift.sh` 실행

**프론트엔드 변경 감지 시** (frontend/ 포함):
1. `cd frontend && npm run test -- --run` 실행

**둘 다 변경된 경우**: 위 두 블록 모두 실행

결과 요약 형식:
- 실행된 명령 목록
- 각 명령 PASS / FAIL
- 실패 시 첫 번째 실패 테스트와 에러 메시지
- 전체 결론: ALL PASS / FAILED
```

---

### 3-2. `/contract-check` — API 계약 드리프트 전체 점검

**추가 이유:**
새 백엔드 기능을 추가하거나 PR을 올리기 전 "스펙과 구현이 일치하나?"를 확인하는 필수 체크다. `opencode.json`의 `contract-check`에 해당한다. 현재 Claude Code에서 이걸 하려면 여러 명령을 수동으로 하나씩 실행해야 하는데, 슬래시 커맨드 하나로 처리 가능해진다.

```markdown
// .claude/commands/contract-check.md
---
description: docs/openapi.yaml과 백엔드 구현의 드리프트를 전체 점검한다. PR 전 반드시 실행.
allowed-tools: Bash, Read, Grep
---

아래 3단계로 계약 드리프트를 점검한다:

**1단계: OpenAPI 유효성**
`bash scripts/contract/openapi_lint.sh` 실행

**2단계: 스펙 ↔ 구현 드리프트**
`bash scripts/contract/spec_impl_drift.sh` 실행

**3단계: 브레이킹 체인지 감지** (main 브랜치 대비)
`BASE_REF=main bash scripts/contract/openapi_breaking_check.sh` 실행

추가 분석: $ARGUMENTS 가 있으면 해당 엔드포인트/모듈에 집중해서 분석

결과 리포트:
- 각 게이트 PASS / FAIL
- 드리프트가 있는 경우 구체적 파일명과 수정 방향
- 전체 결론: READY FOR PR / NEEDS FIX
```

---

### 3-3. `/slice-done` — 슬라이스 완료 검증 및 PR 준비

**추가 이유:**
`opencode.json`의 `slice-done`에 해당한다. 슬라이스 개발을 마친 뒤 "정말 완료됐나?"를 확인하는 최종 체크리스트다. 테스트 + 계약 게이트 + 변경 파일 요약 + PR 타이틀 제안을 한 번에 처리한다. `docs/MVP_TODO_LIST.md` 업데이트 여부도 확인한다.

```markdown
// .claude/commands/slice-done.md
---
description: 슬라이스 완료 검증: 모든 테스트 + 계약 게이트 실행, 변경 요약, PR 준비. 인수: 슬라이스 이름/번호
allowed-tools: Bash, Read
---

슬라이스: $ARGUMENTS 완료 검증을 진행한다.

**검증 실행**
1. `cd backend && ./mvnw test`
2. `cd frontend && npm run test -- --run`
3. `bash scripts/contract/openapi_lint.sh`
4. `bash scripts/contract/spec_impl_drift.sh`

**변경 요약** (`git diff main --name-only` 기반)
- backend/ 변경 파일 목록
- frontend/ 변경 파일 목록
- docs/ 변경 파일 목록 (openapi.yaml 포함 여부 명시)

**체크리스트**
- [ ] docs/MVP_TODO_LIST.md 해당 슬라이스 체크박스 완료 여부
- [ ] docs/CONTRACT_IMPLEMENTATION_STATUS.md 갱신 여부
- [ ] 새 엔드포인트 있을 경우 openapi.yaml 반영 여부

**PR 제안**
- 제목 (Conventional Commits 형식)
- 요약 (3줄 이내)
- 테스트 방법 체크리스트
```

---

### 3-4. `/smoke` — 로컬 풀스택 스모크 테스트

**추가 이유:**
`bash scripts/dev/smoke_local.sh --full` 명령은 DB → 백엔드 → 프론트엔드 전체 스택이 살아있는지 확인하는 중요한 검증이다. Slice 개발 완료 후나 인프라 변경 후 매번 수동으로 입력하기보다 슬래시 커맨드로 빠르게 호출할 수 있으면 편리하다.

```markdown
// .claude/commands/smoke.md
---
description: 로컬 풀스택 스모크 테스트 실행. Docker Postgres, 백엔드, 프론트엔드 모두 실행 중이어야 함.
allowed-tools: Bash
---

`bash scripts/dev/smoke_local.sh --full` 을 실행하고 결과를 분석한다.

- DB 헬스체크 결과
- 백엔드 API 응답 상태
- 프론트엔드 프록시 상태
- 실패 시 어느 계층에서 실패했는지와 원인 추정
```

---

### 3-5. `/new-migration` — Flyway 마이그레이션 파일 생성 가이드

**추가 이유:**
Flyway 마이그레이션 파일은 버전 번호가 겹치면 안 되고, 이미 실행된 파일은 수정하면 안 되며, PostgreSQL 제약 패턴을 정확히 따라야 한다. 이 프로젝트의 DB 제약 패턴(CHECK/FK/soft delete 인덱스)은 `V1__baseline.sql`에서 확립되어 있다. 매번 이 규칙을 기억하기보다 슬래시 커맨드가 안내해주면 실수를 줄일 수 있다.

```markdown
// .claude/commands/new-migration.md
---
description: 새 Flyway DB 마이그레이션 파일 생성. 인수: 마이그레이션 목적 설명
allowed-tools: Read, Bash, Glob
---

새 Flyway 마이그레이션 생성: $ARGUMENTS

**현재 마이그레이션 버전 확인**
`ls backend/src/main/resources/db/migration/` 실행 후 가장 높은 V번호 확인

**이 프로젝트의 마이그레이션 패턴** (V1__baseline.sql 기준)
- amount는 BIGINT (원화 최소 단위)
- user_id 기반 소유권 (모든 테이블에 user_id BIGINT REFERENCES users)
- soft delete: deleted_at TIMESTAMPTZ
- 인덱스: (user_id, deleted_at IS NULL) 패턴 필수
- CHECK 제약: amount > 0, 타입별 필드 상호배타

**생성할 파일명**: `V{다음번호}__{설명}.sql` (공백은 _로)

마이그레이션 SQL 초안을 작성하고, `ddl-auto: validate` 통과 여부를 분석한다.
```

---

## 4. Hooks 설정 계획

Hooks는 `.claude/settings.json`의 `hooks` 섹션에 설정한다.

---

### 4-1. `.env` 파일 수정 차단 Hook

**추가 이유:**
이 프로젝트에는 `.env`, `.env.local`, `backend/.env.local` 등 민감한 환경 파일들이 있다. Claude Code가 실수로 이 파일들을 읽거나 수정하면 credentials가 로그에 노출될 수 있다. `PreToolUse` 훅으로 `.env*` 패턴 파일에 대한 Write/Edit를 차단한다.

```json
"PreToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))\"); if echo \"$FILE\" | grep -qE '\\.env'; then echo \"차단: .env 파일 수정 금지\" >&2; exit 2; fi; exit 0"
    }]
  }
]
```

---

### 4-2. 프론트엔드 TypeScript 타입 체크 Hook

**추가 이유:**
이 프로젝트는 TypeScript를 사용하지만 Vite + Vitest 환경에서는 빌드/테스트 시 타입 에러를 무시하는 경우가 있다. `frontend/src/`의 `.tsx`/`.ts` 파일을 수정하면 `tsc --noEmit`으로 타입 에러를 즉시 확인하는 게 좋다. 다만 너무 느리면 개발 흐름을 방해하므로 수정된 파일에 대해서만 빠르게 체크한다.

```json
"PostToolUse": [
  {
    "matcher": "Edit|Write",
    "hooks": [{
      "type": "command",
      "command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))\"); if echo \"$FILE\" | grep -qE 'frontend/src/.*\\.tsx?$'; then cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20; fi; exit 0"
    }]
  }
]
```

---

### 4-3. 위험 Bash 명령 경고 Hook

**추가 이유:**
`git reset --hard`, `docker compose down -v`(볼륨 삭제), `DROP TABLE` 등은 되돌리기 어렵다. `AGENTS.md`에도 이런 명령들은 사용자 명시 요청 없이 금지라고 명시되어 있다. Claude Code의 `PreToolUse` 훅으로 이런 패턴을 감지하면 실수를 방지할 수 있다.

```json
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [{
      "type": "command",
      "command": "INPUT=$(cat); CMD=$(echo \"$INPUT\" | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))\"); if echo \"$CMD\" | grep -qE 'reset --hard|push --force|drop table|docker.*-v|rm -rf'; then echo \"경고: 위험 명령 감지됨 - 사용자 확인 필요\" >&2; exit 1; fi; exit 0"
    }]
  }
]
```

---

## 5. Settings 설정 계획

### `.claude/settings.json` (프로젝트 공유용)

**추가 이유:**
현재 `~/.claude/settings.json`은 완전히 비어있다. 프로젝트 레벨 설정을 `.claude/settings.json`에 정의하면 팀원 누구나 동일한 권한 프로파일로 Claude Code를 사용할 수 있다.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(cd backend && ./mvnw *)",
      "Bash(cd frontend && npm run *)",
      "Bash(bash scripts/*)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Bash(docker compose *)",
      "Bash(ls *)",
      "Bash(cat *)"
    ],
    "deny": [
      "Bash(git push --force*)",
      "Bash(git reset --hard*)",
      "Bash(docker compose down -v*)",
      "Bash(rm -rf*)",
      "Read(**/.env*)",
      "Write(**/.env*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))\"); if echo \"$FILE\" | grep -qE '\\.env'; then echo '차단: .env 파일 수정 금지' >&2; exit 2; fi; exit 0"
        }]
      }
    ]
  }
}
```

### `.claude/settings.local.json` (개인용, gitignore)

```json
{
  "permissions": {
    "allow": [
      "Bash(psql *)",
      "Bash(npm install *)"
    ]
  },
  "env": {
    "DB_URL": "postgresql://asset:asset@localhost:5432/asset_db"
  }
}
```

---

## 6. 디렉터리 구조 (설정 완료 후)

```
.claude/
├── settings.json              # 프로젝트 공유 설정 (permissions, hooks)
├── settings.local.json        # 개인 설정 (gitignore 대상)
├── agents/
│   ├── contract-guard/
│   │   └── AGENT.md           # OpenAPI 드리프트 감지 에이전트
│   ├── slice-architect/
│   │   └── AGENT.md           # 버티컬 슬라이스 설계 에이전트
│   └── db-analyst/
│       └── AGENT.md           # DB 재무 계산 검증 에이전트
└── commands/
    ├── test-gates.md           # /test-gates - 스코프 기반 테스트 실행
    ├── contract-check.md       # /contract-check - API 계약 전체 점검
    ├── slice-done.md           # /slice-done - 슬라이스 완료 검증 + PR 준비
    ├── smoke.md                # /smoke - 풀스택 스모크 테스트
    └── new-migration.md        # /new-migration - Flyway 마이그레이션 가이드

.mcp.json                      # MCP 서버 설정 (프로젝트 공유)
```

---

## 7. 구현 우선순위

| 순위 | 항목 | 소요 시간 | 즉시 효과 |
|------|------|-----------|-----------|
| 1 | `/test-gates` slash command | 10분 | 매 개발 세션마다 사용 |
| 2 | `/contract-check` slash command | 10분 | PR 전 필수 체크 |
| 3 | `/slice-done` slash command | 15분 | Slice 7 시작 전 필요 |
| 4 | `.mcp.json` PostgreSQL MCP | 20분 | DB 검증 작업 즉시 가능 |
| 5 | `.mcp.json` GitHub MCP | 10분 | 이미 토큰 있어서 설정만 |
| 6 | `contract-guard` agent | 20분 | 계약 드리프트 자동화 |
| 7 | `.claude/settings.json` permissions | 15분 | 안전망 구성 |
| 8 | `.claude/settings.json` hooks | 20분 | .env 보호, 타입 체크 |
| 9 | `db-analyst` agent | 20분 | PostgreSQL MCP 후 효과 |
| 10 | `/new-migration` slash command | 10분 | Slice 7 DB 설계 시 필요 |
| 11 | `slice-architect` agent | 20분 | Slice 7 설계 시 사용 |
| 12 | `/smoke` slash command | 5분 | 가장 단순, 마지막에 |

**1순위 그룹 (지금 바로, 30분 이내)**:
`/test-gates`, `/contract-check` — 매 개발 세션에서 바로 쓸 수 있고 설정이 가장 단순

**2순위 그룹 (Slice 7 시작 전, 1시간)**:
PostgreSQL MCP + `db-analyst` agent + `/slice-done` + `/new-migration`

**3순위 그룹 (장기 안전망)**:
settings.json hooks, `contract-guard` agent, `slice-architect` agent

---

## 8. 주의사항

### opencode.json과의 중복 방지
`opencode.json`의 커맨드들(`slice-start`, `slice-build`, `slice-done`, `contract-check`, `test-gates`)은 Claude Code에서 동작하지 않는다. 위에서 계획한 Claude Code slash commands는 이들과 **역할은 같지만 독립적으로 동작**한다. 두 도구를 병행 사용하는 경우 혼용하지 않도록 주의.

### MCP 서버 credentials 관리
`.mcp.json`을 git에 커밋하는 경우 API 키를 직접 넣지 않고 반드시 `${ENV_VAR}` 환경변수 참조 방식을 사용한다. 실제 값은 `.env.mcp`(이미 gitignore 처리)에서 로드한다.

### Hook 스크립트의 Python 의존성
위에 작성한 훅 스크립트들은 `python3`을 사용한다. WSL 환경에 python3가 없으면 `jq`를 대신 사용하거나 별도 `.claude/hooks/` 쉘 스크립트 파일로 분리한다.

### `.claude/settings.local.json`은 반드시 gitignore
개인 환경 변수(DB 접속 정보 등)가 들어가므로 `.gitignore`에 `.claude/settings.local.json` 추가 필요.
