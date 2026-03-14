# 프로젝트 팩트체크 / 현재 구현 상태

기준일: 2026-03-13

이 문서는 계획 문서가 아니라 현재 리포지토리 상태를 정리한 감사 문서다.
`README.md`, `docs/openapi.yaml`, 백엔드/프론트 소스, DB 마이그레이션, 테스트, CI 설정을 기준으로 작성했다.

## 1. 이번 점검에서 직접 확인한 것

- 백엔드 테스트: `cd backend && ./mvnw -B test` 통과
- 프론트 테스트: `cd frontend && npm run test -- --run` 통과
- OpenAPI 유효성: `bash scripts/contract/openapi_lint.sh` 통과
- 계약/구현 드리프트 체크: `bash scripts/contract/spec_impl_drift.sh` 통과
- 프론트 프로덕션 빌드: `cd frontend && npm run build` 통과

이번 점검에서 다시 실행하지 않은 것:

- `bash scripts/dev/smoke_local.sh`
- `bash scripts/dev/smoke_local.sh --full`

즉, 아래 내용은 테스트/빌드/코드 점검으로 확인한 사실이고, 로컬 런타임 스모크는 이번 수정 시점에 재실행하지 않았다.

## 2. 현재 기술 스택

- 프론트엔드: React 18 + TypeScript + Vite 6
- 백엔드: Spring Boot 3.4.2 + Java 21 + Spring Data JPA + Spring Security + Spring Session JDBC + Flyway
- 데이터베이스: PostgreSQL 16
- 테스트/CI 기준 Node 버전: 20

근거:

- `frontend/package.json`
- `backend/pom.xml`
- `infra/docker-compose.yml`
- `.github/workflows/ci.yml`
- `.nvmrc`

## 3. 실제 구현 완료 범위

### 3.1 인증 / 세션

구현됨:

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

확인된 동작:

- 세션 쿠키 이름은 `JSESSIONID`
- CSRF 쿠키 이름은 `XSRF-TOKEN`
- 변경 요청 헤더는 `X-XSRF-TOKEN`
- 인증 실패는 HTML 리다이렉트가 아니라 JSON 에러로 응답
- 로그인 시 세션을 만들고, 로그아웃 시 세션을 제거한다
- 로그인 실패 시 "유저 없음"과 "비밀번호 틀림"을 구분해서 노출하지 않는다

근거:

- `backend/src/main/java/com/jioha/asset/config/SecurityConfig.java`
- `backend/src/main/java/com/jioha/asset/config/SessionCookieConfig.java`
- `backend/src/main/java/com/jioha/asset/auth/AuthController.java`
- `backend/src/main/java/com/jioha/asset/auth/AuthService.java`
- `backend/src/test/java/com/jioha/asset/auth/AuthControllerTest.java`

### 3.2 계좌

구현됨:

- 계좌 목록 조회
- 계좌 생성
- 계좌 수정
- 활성/비활성 전환
- `currentBalance` 계산 응답

확인된 규칙:

- 계좌 타입은 `CHECKING`, `SAVINGS`, `CASH`, `INVESTMENT`
- `openingBalance`는 0 이상 정수
- `currentBalance`는 저장값이 아니라 거래 합산으로 계산
- 현재 API에는 계좌 삭제 엔드포인트가 없다

근거:

- `backend/src/main/java/com/jioha/asset/account/AccountController.java`
- `backend/src/main/java/com/jioha/asset/account/AccountService.java`
- `backend/src/main/resources/db/migration/V1__baseline.sql`
- `frontend/src/pages/AccountsPage.tsx`

### 3.3 거래

구현됨:

- `INCOME`, `EXPENSE`, `TRANSFER` 생성
- 거래 목록 조회
- 거래 단건 조회
- 거래 수정
- 거래 삭제
- 검색/필터/정렬/페이지네이션
- 인박스(`needsReview`) 흐름
- 거래 삭제는 소프트 삭제 방식

확인된 목록 필터:

- `from`
- `to`
- `accountId`
- `type`
- `categoryId`
- `needsReview`
- `q`
- `page`
- `size`
- `sort`

확인된 정렬 필드:

- `txDate`
- `amount`
- `createdAt`
- `id`

확인된 거래 규칙:

- 모든 `amount`는 양수 정수
- `INCOME`/`EXPENSE`는 `accountId`가 필요
- `TRANSFER`는 `fromAccountId`/`toAccountId`가 필요
- `TRANSFER`는 `accountId`를 가질 수 없다
- `TRANSFER`는 `categoryId`를 가질 수 없다
- `fromAccountId`와 `toAccountId`는 같을 수 없다
- 비활성 계좌는 새 거래에 사용할 수 없다
- `excludeFromReports=true`는 `EXPENSE`에서만 허용된다

UI 기준으로 확인된 것:

- `/transfers`는 별도 화면이 아니라 `/transactions?type=TRANSFER`로 리다이렉트된다
- 거래 화면에는 인박스 탭과 일괄 `검토 완료` 처리 기능이 있다
- 프론트는 최근 사용/자주 사용 카테고리 힌트를 `localStorage`에 저장한다

부분 구현:

- 거래 API/DB는 `tagNames`를 지원한다
- 현재 프론트 거래 UI에는 태그 입력/편집 필드가 노출되지 않는다

근거:

- `backend/src/main/java/com/jioha/asset/transaction/TransactionController.java`
- `backend/src/main/java/com/jioha/asset/transaction/TransactionService.java`
- `backend/src/main/resources/db/migration/V1__baseline.sql`
- `frontend/src/pages/TransactionsPage.tsx`
- `frontend/src/App.tsx`

### 3.4 카테고리

구현됨:

- 카테고리 목록 조회
- 카테고리 생성
- 카테고리 수정
- 활성/비활성 전환

백엔드에서 확인된 규칙:

- 카테고리 타입은 `INCOME`, `EXPENSE`, `TRANSFER`
- `parentId`를 통한 2단계 깊이 제한이 있다
- 시스템 카테고리(`user_id IS NULL`)는 수정할 수 없다
- 부모 카테고리와 자식 카테고리의 타입은 같아야 한다

프론트에서 확인된 범위:

- 현재 UI는 `EXPENSE`/`INCOME` 탭만 노출한다
- 현재 UI는 부모 카테고리 지정 기능을 제공하지 않는다
- 현재 UI는 `TRANSFER` 카테고리 관리 기능을 노출하지 않는다

즉, 카테고리 API는 UI보다 더 넓고, 현재 화면은 평면 관리에 가까운 형태다.

근거:

- `backend/src/main/java/com/jioha/asset/category/CategoryController.java`
- `backend/src/main/java/com/jioha/asset/category/CategoryService.java`
- `backend/src/main/resources/db/migration/V1__baseline.sql`
- `frontend/src/pages/CategoriesPage.tsx`

### 3.5 리포트

구현됨:

- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/transfers`
- `GET /api/v1/reports/cashflow`
- `GET /api/v1/reports/categories/top-expense`
- `GET /api/v1/reports/balances`

확인된 규칙:

- 기간 검증은 `from <= to`
- `TRANSFER`는 `summary.transferVolume`에는 포함되고 `totalExpense`에는 포함되지 않는다
- `excludeFromReports=true`인 지출은 지출 집계에서 제외된다
- `top-expense`는 미분류 지출을 `Uncategorized`로 응답한다
- `balances`는 계좌별 일자 시계열을 계산한다

프론트에서 확인된 것:

- 리포트 화면은 `이번 달`, `지난 달` 빠른 범위 버튼이 있다
- 요약 카드, 현금흐름, 상위 지출 카테고리, 계좌 잔액 추이, 이체 매트릭스를 모두 사용한다
- 대시보드도 `summary`와 `cashflow`를 사용한다

근거:

- `backend/src/main/java/com/jioha/asset/report/ReportController.java`
- `backend/src/main/java/com/jioha/asset/report/ReportService.java`
- `backend/src/test/java/com/jioha/asset/report/ReportControllerTest.java`
- `frontend/src/pages/ReportsPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`

### 3.6 CSV Import

구현됨:

- `POST /api/v1/imports/csv`
- 프론트 CSV 미리보기
- 헤더 매핑
- CSV 계좌명 -> 실제 계좌 매핑
- 원자적 저장
- 중복 건 skip

확인된 규칙:

- 현재 구현은 `INCOME`/`EXPENSE` import만 지원
- 한 행이라도 검증 실패하면 전체 롤백
- 성공적으로 들어간 행은 `source=CSV`
- CSV import로 생성된 행은 `needsReview=true`
- 계정 매핑은 활성 계좌 기준으로만 진행된다

프론트에서 확인된 것:

- CSV 파싱과 헤더 추정은 클라이언트에서 먼저 수행한다
- 실제 저장은 서버로 `multipart/form-data` 업로드한다
- 미리보기는 전체가 아니라 앞쪽 일부 행만 보여준다

근거:

- `backend/src/main/java/com/jioha/asset/csvimport/CsvImportController.java`
- `backend/src/main/java/com/jioha/asset/csvimport/CsvImportService.java`
- `backend/src/test/java/com/jioha/asset/csvimport/CsvImportControllerTest.java`
- `frontend/src/pages/ImportsPage.tsx`

### 3.7 대시보드 / 라우팅

구현됨:

- 인증 보호 라우트
- 대시보드
- 거래
- 계좌
- 카테고리
- 리포트
- CSV 가져오기

확인된 사실:

- 라우터는 `BrowserRouter`가 아니라 `HashRouter`
- 실사용 라우트는 `/#/dashboard` 같은 형태다
- 대시보드에는 빠른 입력, 최근 거래, 인박스, 요약 카드, 30일 현금흐름 스파크뷰가 있다

근거:

- `frontend/src/App.tsx`
- `frontend/src/pages/DashboardPage.tsx`

## 4. 아직 미구현이거나 자리만 잡혀 있는 범위

### 4.1 백업

현재 상태:

- OpenAPI에는 `/backups/export`, `/backups/import`가 정의되어 있다
- DB에는 `backups` 테이블이 있다
- 프론트에는 `/backups` 메뉴가 있다
- 하지만 백엔드 컨트롤러/서비스 구현은 없다
- 프론트 `/backups` 화면도 실제 기능이 아니라 placeholder다

즉, 백업은 "계약과 자리만 먼저 있는 상태"다.

근거:

- `docs/openapi.yaml`
- `backend/src/main/resources/db/migration/V1__baseline.sql`
- `frontend/src/App.tsx`
- `frontend/src/pages/PlaceholderPage.tsx`
- `docs/CONTRACT_IMPLEMENTATION_STATUS.md`

### 4.2 계약 연산 수와 실제 구현 수

이번 점검에서 `bash scripts/contract/spec_impl_drift.sh` 결과:

- `specOps=24`
- `implOps=22`

현재 빠진 2개는 백업 export/import로 해석하는 것이 맞다.

근거:

- `docs/CONTRACT_IMPLEMENTATION_STATUS.md`
- `backend/src/main/java/com/jioha/asset/*`

## 5. 환경변수 / 실행 방식 팩트체크

### 5.1 실제로 사용되는 것

- `infra/.env.example`
  - Docker Postgres 실행에 사용된다
  - `scripts/dev/smoke_local.sh`도 이 파일을 사용한다
- `backend/.env.local`
  - 템플릿은 `.env.backend.example`
  - Spring Boot가 자동 로드하지 않기 때문에 shell에서 `source` 하거나 IDE 환경변수로 넣어야 한다
- `SPRING_PROFILES_ACTIVE=local`
  - `application-local.yml`의 seed 경로(`classpath:db/seed`)를 쓰려면 필요하다

### 5.2 현재 문서 대비 과장되거나 미연결인 것

- 루트 `.env.example`
  - 저장소에는 있지만 현재 앱 코드나 스크립트가 직접 읽지 않는다
  - 사람용 참고 템플릿에 가깝다
- `frontend/.env.local`
  - 템플릿은 `.env.frontend.example`
  - 하지만 현재 프론트 코드는 `VITE_API_BASE_URL`을 읽지 않는다
  - API 경로는 `frontend/src/api.ts`에서 `/api/v1`로 하드코딩되어 있다

즉, "프론트 API base override가 현재 동작한다"라고 쓰면 사실과 다르다.

근거:

- `.env.example`
- `.env.backend.example`
- `.env.frontend.example`
- `infra/.env.example`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-local.yml`
- `frontend/src/api.ts`
- `scripts/dev/smoke_local.sh`

## 6. 현재 문서들과 비교했을 때 바로 주의해야 할 점

- `README.md`의 MVP 범위에는 backup export/import가 포함되어 있지만, 실제 구현은 아직 아니다
- `README.md`의 프론트 `.env.local` API base override 설명은 현재 코드와 맞지 않는다
- "태그 관리"를 독립 기능처럼 읽히게 쓰면 과장이다
  - 실제로는 거래 payload와 DB 컬럼 수준 지원만 있고, 전용 UI/API는 없다
- 카테고리는 백엔드가 2단계 구조를 지원하지만, 현재 프론트 UI는 부모 지정 없는 평면 관리다

## 7. 결론

2026-03-13 기준 이 프로젝트는 다음까지는 실제 구현과 검증이 맞물려 있다.

- 인증/세션/CSRF
- 계좌 CRUD
- 거래 CRUD
- 카테고리 CRUD
- 리포트 5종
- CSV one-shot import
- 프론트 보호 라우트와 주요 업무 화면

아직 아닌 것은 명확하다.

- backup export/import
- 백업 UI
- 태그 전용 UI
- 카테고리 계층 편집 UI
- `frontend/.env.local` 기반 API base override

이 문서를 기준으로 보면, 현재 저장소는 "Slice 1~6 구현 완료 + Slice 7 계약 선행" 상태로 보는 것이 가장 정확하다.  
