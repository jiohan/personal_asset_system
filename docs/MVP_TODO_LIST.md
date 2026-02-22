# MVP Development Todo List (Contract-First + Vertical Slice)

## 0) Product Goal (One-line)
- 개인 자산을 빠르게 기록하고, 왜곡 없는 리포트(현금흐름 vs 자금이동 분리)로 확인하는 PWA를 만든다.

## 1) Working Rules (항상 고정)
- [ ] Contract first: 구현 전 `docs/openapi.yaml` 먼저 갱신
- [ ] Vertical slice: DB -> API -> UI -> Tests를 한 번에 완료
- [ ] Walking skeleton: 가장 얇은 end-to-end 경로부터 먼저 통과
- [ ] Tracer bullet: 각 슬라이스마다 happy-path 1개를 끝까지 관통
- [ ] Slice DoD: 성공 테스트 1개 + 엣지 테스트 1개 + user scope 검증

## 2) Backlog Refinement 운영 방식
- [ ] 상단(곧 개발할 1~2개 슬라이스)만 상세화
- [ ] 하단(나중 슬라이스)은 큰 항목으로 유지
- [ ] 우선순위 기준: 사용자 가치 + 리스크 + 선행 의존성
- [ ] 슬라이스 크기 제한: 화면 1개 + API 1~2개 + 핵심 규칙 1세트

---

## 3) MVP Slice Plan (권장 순서 고정)

### Slice 1. Auth + User Scope Skeleton
Scope: signup/login/me/logout + 보호 라우트

- [ ] Contract: Auth 4개 엔드포인트 요청/응답/에러 예시 확정
- [ ] DB: users + session 테이블/설정 검증
- [ ] API: 인증 성공/실패 및 세션 처리 구현
- [ ] UI: 로그인/로그아웃, 보호 페이지 가드 연결
- [ ] Tests: 로그인 성공, 비인증 접근 실패
- [ ] Edge: 타 사용자 데이터 접근 불가 정책(404/401) 반영

### Slice 2. Accounts CRUD (User Scope)
Scope: 계좌 생성/목록/수정(isActive 포함)

- [ ] Contract: `/accounts`, `/accounts/{id}` 예시/검증 규칙 확정
- [ ] DB: account 제약(type/opening_balance/is_active) 검증
- [ ] API: 계좌 CRUD + user scope 필터
- [ ] UI: 계좌 목록/생성/수정 플로우 연결
- [ ] Tests: 본인 계좌 정상, 타 유저 계좌 접근 차단

### Slice 3. Transactions CRUD (INCOME/EXPENSE) + List Rules
Scope: 수입/지출 생성/수정/삭제 + 목록 필터

- [ ] Contract: `/transactions`, `/transactions/{id}` + query(from,to,type,needsReview,page,size,sort)
- [ ] Contract: `/categories`, `/categories/{id}` (MVP 최소: list/create/patch)
- [ ] DB: amount>0, 타입별 필드 상호배타, soft delete 규칙 검증
- [ ] API: 리스트/상세/생성/수정/삭제 구현
- [ ] API: 카테고리 list/create/patch (2단계 깊이 제한, system category 수정 금지)
- [ ] UI: 거래 입력폼 + 목록 필터/검색 연결
- [ ] UI: 카테고리 선택(거래 입력폼)
- [ ] Tests: 성공/검증실패 + soft delete 제외 확인
- [ ] Edge: `excludeFromReports=true`의 의미(지출 통계 제외) 보장

### Slice 4. Transfer + Report Exclusion Rule
Scope: TRANSFER 입력/조회 + 현금흐름 제외 규칙

- [ ] Contract: TRANSFER 필수 필드(fromAccountId,toAccountId) 예시 확정
- [ ] API: TRANSFER 생성/조회 + 필드 검증
- [ ] UI: 이체 입력/목록 표시
- [ ] Tests: transferVolume 반영 + totalExpense 미반영
- [ ] Edge: from==to 금지, 타입 변경 금지 정책 확인

### Slice 5. Reports (Summary + Transfers)
Scope: `/reports/summary`, `/reports/transfers`

- [ ] Contract: 기간 규칙(from <= txDate < to), 응답 필드 확정
- [ ] API: summary 계산/transfer 집계 구현
- [ ] UI: 월별 요약 카드 + 이체 리포트 표시
- [ ] Tests: 샘플 시드 기준 집계값 일치
- [ ] Edge: excludeFromReports/soft delete/TRANSFER 규칙 동시 검증

### Slice 6. CSV Import (One-shot)
Scope: `/imports/csv` 1-shot 검증/저장

- [ ] Contract: 업로드 요청/결과/에러/중복처리 정책 예시 확정
- [ ] API: parse -> validate -> dedupe(skip) -> save(원자 처리)
- [ ] UI: 파일 업로드 + 결과 피드백
- [ ] Tests: 전체 롤백, 중복 skip, needsReview 보정
- [ ] Edge: 부분 성공 금지, 날짜 파싱 실패 처리

### Slice 7. Backup Export/Import (v1)
Scope: `/backups/export`, `/backups/import`

- [ ] Contract: version/exportedAt/currency/data 스키마 고정
- [ ] API: 내보내기/가져오기(현재 사용자 replace-all) 구현
- [ ] UI: 백업 다운로드/복원 플로우
- [ ] Tests: export -> import round-trip 일관성
- [ ] Edge: 버전/호환성 실패 시 안전한 오류 처리

---

## 4) Cross-cutting Checklist (매 슬라이스 공통)
- [ ] OpenAPI 변경 diff 리뷰 완료
- [ ] 에러 포맷(`ApiErrorResponse`) 일관성 유지
- [ ] user scope 누락 없음(조회/수정/삭제 전부)
- [ ] CI 기준 테스트 통과(backend + frontend)
- [ ] 문서 갱신(가이드/README 필요 항목)

## 5) Jira 등록용 이슈 구조(복붙 템플릿)

### Epic
- [ ] EPIC: MVP Contract-First Vertical Slice Delivery

### Stories
- [ ] Story: Slice 1 - Auth + User Scope Skeleton
- [ ] Story: Slice 2 - Accounts CRUD
- [ ] Story: Slice 3 - Transactions CRUD (INCOME/EXPENSE)
- [ ] Story: Slice 4 - Transfer Rule Integration
- [ ] Story: Slice 5 - Reports Summary/Transfers
- [ ] Story: Slice 6 - CSV Import One-shot
- [ ] Story: Slice 7 - Backup Export/Import v1

### Story 공통 Sub-task
- [ ] Contract update (`docs/openapi.yaml`)
- [ ] Backend implementation (DB/API)
- [ ] Frontend integration (UI/route)
- [ ] Tests (success + edge)
- [ ] DoD validation (E2E path + user scope)

## 6) P0 Readiness Checklist (Single Source of Truth)

- [ ] P0-1 작업 추적 Source of Truth 1개 확정: 진행 상태 변경은 `docs/MVP_TODO_LIST.md` 체크박스에서만
- [ ] P0-2 실행 명령 체계 통일: mvnw/npm 기반(README/opencode/CI 명령 일치)
- [ ] P0-3 OpenAPI CI 게이트: lint + breaking change(기본 브랜치 대비)
- [ ] P0-4 스펙<->구현 드리프트 자동 검출 1개 도입 + 실패 조건 고정
- [ ] P0-5 인증 정책 동기화(OpenAPI): 세션 쿠키 + CSRF(`XSRF-TOKEN`/`X-XSRF-TOKEN`)가 계약에 보임
- [ ] P0-6 ADR 2개 문서화: ADR-001 Authentication, ADR-002 Data Ownership
- [ ] P0-7 로컬 인프라 스모크: DB->BE->FE proxy 동작 확인(WSL Docker Desktop 통합 포함)
- [ ] P0-8 Seed 실행 방식 고정: 반복 실행 안전 + 리포트 검증 포인트 재현
- [ ] P0-9 버전 기준 문서 통일: Java 21, Node 20(CI baseline)
