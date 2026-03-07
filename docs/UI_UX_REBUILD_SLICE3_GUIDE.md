# UI/UX Rebuild Guide (Slice 3 Baseline)

## 1) 목적
현재 `slice3`까지 완료된 상태를 기준으로, 단일 페이지 UI를 실제 자산관리 대시보드 형태(기능별 페이지 분리 + 보호 라우팅 + 개선된 UX)로 재구성할 때의 실행 기준을 정의한다.

이 문서는 아래를 포함한다.
- 지금 당장 구현 가능한 범위
- 아직 구현하면 안 되는 범위(금지 항목)
- 단계별 UI 리빌드 순서(리스크 최소화)
- 테스트/검증 기준

---

## 2) 기준 상태(가정)
- `slice1~3` 완료:
  - Auth + user scope
  - Accounts CRUD
  - Transactions CRUD(INCOME/EXPENSE) + list/filter
  - Categories list/create/patch
- `slice4~7` 미완료:
  - TRANSFER 생성/수정
  - Reports(summary/transfers)
  - CSV import
  - Backup export/import

관련 문서:
- `docs/MVP_TODO_LIST.md`
- `docs/CONTRACT_IMPLEMENTATION_STATUS.md`
- `docs/openapi.yaml`
- `PERSONAL_ASSET_PWA_GUIDE.md`

Repo 사실(현재 코드 기준):
- 라우터 라이브러리 미사용(현재는 단일 `App`에서 state 기반 조건부 렌더링): `frontend/src/main.tsx`, `frontend/src/App.tsx`
- API 호출은 fetch 래퍼로 고정(상대경로 + 쿠키 인증 + CSRF): `frontend/src/api.ts`
- API base는 현재 하드코딩(`/api/v1...`)이며 `VITE_API_BASE_URL`은 정의만 있고 미사용: `.env.frontend.example`, `frontend/src/api.ts`
- 개발 시 same-origin을 유지하기 위해 Vite proxy(`/api` -> backend)를 사용: `frontend/vite.config.ts`
- React.StrictMode가 켜져 있어 dev에서 effect가 2번 실행될 수 있음: `frontend/src/main.tsx`

---

## 3) 하드 제약(반드시 유지)

### 3.1 인증/보안
- 인증 모델은 세션 쿠키(`JSESSIONID`) 기반을 유지한다.
- 변경 요청(POST/PATCH/DELETE)은 CSRF 흐름(`XSRF-TOKEN` 쿠키 -> `X-XSRF-TOKEN` 헤더)을 반드시 유지한다.
- 프론트 fetch는 `credentials: include`를 유지한다.
- MVP는 same-origin 기준이다. 프론트/백 도메인 분리를 전제로 UI를 설계하지 않는다.

추가(현 repo 구현에 맞춘 제약):
- API 호출은 반드시 `frontend/src/api.ts`를 통해서만 한다(직접 fetch 금지). CSRF/credentials 누락 회귀를 막기 위함.
- 백엔드 URL을 절대경로(`http://localhost:8080/...`)로 박아 넣지 않는다. 쿠키/CSRF/배포시 same-origin 가정이 깨질 수 있다.

### 3.2 API 계약
- OpenAPI를 기준으로 동작해야 한다. 문서와 다른 프론트 가정으로 화면을 먼저 고정하지 않는다.
- 거래 PATCH에서 `type` 변경은 허용되지 않는다(삭제 후 재생성 정책).
- `excludeFromReports`는 `EXPENSE`에서만 의미가 있다.

대시보드/요약 수치에 대한 제약(중요):
- Slice3 단계에서는 `/reports/*`가 없으므로, "기간 전체 합계"(totalIncome/totalExpense/netSaving/transferVolume)를 UI에서 "공식 수치"처럼 보여주지 않는다.
- `GET /transactions`는 페이지네이션이며 `size` 상한이 있어(최대 200) 전체기간 합계를 UI에서 정확히 계산하기 어렵다. (`docs/openapi.yaml` 참고)
- Slice3 대시보드는 "최근 거래", "계좌 수", "활성 계좌 수", "인박스(needsReview)" 같은 안전한 범위의 지표 위주로 구성한다.

### 3.3 도메인/소유권
- user scope를 깨면 안 된다(타 유저 데이터 접근 시도/노출 금지).
- 비활성 계좌/카테고리 정책, soft delete 의미를 UI에서 왜곡하지 않는다.

### 3.4 전달 방식
- 대규모 일괄 개편 대신, 작은 UI 슬라이스 단위로 나눠야 한다.
- 각 슬라이스마다 `UI + 테스트`를 같이 완료한다.

추가(라우팅 도입 시):
- 한 번에 `라우터 도입 + 디자인 대개편 + 모든 페이지 분리`를 같이 하지 않는다. 최소 단위는 "라우팅 뼈대"까지.
- placeholder 페이지는 "API 미구현"을 사용자에게 명확히 알리고, 실제 API 호출을 절대 붙이지 않는다.

---

## 4) 구현 금지 목록(지금 하면 안 됨)

아래는 `slice3` 기준으로 실제 구현/배포 금지:

1. TRANSFER 생성/수정 기능을 동작하는 화면으로 오픈
- 이유: 백엔드가 `409 CONFLICT`로 막혀 있음

2. Reports(summary/transfers) 실제 API 호출 기반 대시보드 오픈
- 이유: 엔드포인트 미구현

3. CSV import/Backup 화면에서 실제 업로드/복원 API 연결
- 이유: 엔드포인트 미구현

4. 인증 방식을 토큰(JWT 등)으로 프론트에서 임의 전환
- 이유: 현재 계약/ADR와 충돌

5. CSRF 헤더 생략 또는 `credentials: include` 제거
- 이유: 로그인/변경 API 실패 가능

6. 타입 제약 무시 UI
- 예: 거래 수정에서 `INCOME -> EXPENSE` 직접 변경

7. OpenAPI 미반영 상태로 프론트 계약을 임의 확장
- 예: 없는 필터/없는 응답 필드를 하드코딩

8. 한 PR에서 라우팅/디자인/도메인/API 동시 대형 변경
- 이유: 회귀 원인 추적 어려움, 테스트 실패 위험 급증

9. (배포/운영 미확정 상태에서) BrowserRouter만 가정하고 새 라우팅을 강제
- 이유: 정적 호스팅/프록시 설정에 SPA fallback(index.html rewrite)이 없으면 `/transactions` 같은 직접 URL 진입/새로고침이 404가 될 수 있음
- 대응: 배포 방식이 확정되기 전엔 HashRouter(예: `/#/transactions`) 고려 또는 서버 fallback 설정을 포함한 작업으로 묶어 진행

---

## 5) 권장 정보구조(IA) - Slice3 기준

아래 구조로 쪼개는 것을 권장한다.

- `/auth` : 로그인/회원가입
- `/dashboard` : 요약 홈(현재 구현 가능한 데이터 기반)
- `/accounts` : 계좌 관리
- `/transactions` : 거래 등록/필터/목록/수정/삭제
- `/categories` : 카테고리 관리
- `/transfers` : 준비중(placeholder)
- `/reports` : 준비중(placeholder)
- `/imports` : 준비중(placeholder)
- `/backups` : 준비중(placeholder)

중요:
- `transfers/reports/imports/backups`는 지금은 "준비중" 상태만 제공하고, 실제 API 호출은 붙이지 않는다.
- 사용자에게는 "Slice4~7 완료 후 활성화 예정"으로 명시한다.

라우팅 구현 선택지(권장):
- 옵션 A) BrowserRouter ("예쁜" URL): 서버/호스팅에서 SPA fallback이 가능한 경우에만.
- 옵션 B) HashRouter (운영 설정 없이 안전): fallback 미확정 단계에서 추천. (URL이 `/#/dashboard` 형태가 됨)

참고(React Router 개념):
- HashRouter는 URL의 hash(`/#/...`)에 location을 저장하므로 서버로 라우트가 전달되지 않는다. 따라서 정적 호스팅/리버스프록시에서 rewrite 설정이 없을 때도 직접 URL 진입/새로고침 404를 피하기 쉽다.

### 5.0 제품 파이프라인을 메뉴로 번역하기(UX가 헷갈리지 않게)

이 서비스는 기능이 "따로따로"가 아니라, 아래 파이프라인으로 연결된다. (왜곡 없는 숫자/흐름이 목표)

1) 입력(Input)
- Transactions: 거래를 넣는다(수동 입력)

2) 정리(Organize)
- Inbox(needsReview): 미분류/불확실 건을 모아서 처리한다
- Categories/Tags: 분류 품질을 올린다

3) 조회/분석(Analyze)
- Dashboard: 빠르게 상태를 본다(현재는 "최근" 중심)
- Reports: 공식 통계를 본다(Slice5 이후)

4) 보호(Protect)
- Backups: 내보내기/복원(Slice7 이후)

메뉴/내비게이션은 이 흐름을 그대로 드러내야 사용자가 덜 헤맨다.

### 5.1 페이지/기능 매핑(현재 구현 기능 기준)

지금 "스크롤 하나에 모든 기능" 상태를 해소하려면, 기능을 아래 4개 축으로 분리하는 게 가장 효율적이다.

1) 입력/조회 축(가장 자주 씀)
- 거래 입력/조회: `GET/POST/PATCH/DELETE /transactions` (INCOME/EXPENSE)

2) 자산/수단 축(카드/통장/현금)
- 계좌(카드) 등록/정리: `GET/POST/PATCH /accounts`

3) 분류 축
- 카테고리 등록/정리: `GET/POST/PATCH /categories`

4) 요약/분석 축(향후)
- 공식 리포트/그래프: `/reports/*` (Slice5 이후)

따라서 화면은 "대시보드(요약) + 거래(메인) + 계좌 + 카테고리"가 기본이고,
`transfers/reports/imports/backups`는 placeholder로만 남겨둔다.

### 5.2 내비게이션(페이지가 적을 때의 최적 해법)

페이지가 많지 않은 지금은 "사이드바/상단바" 하나로 끝내는 게 좋다.

권장(데스크톱)
- 좌측 사이드바(고정): Dashboard / Transactions / Accounts / Categories
- 하단(또는 More): Transfers(준비중) / Reports(준비중) / Imports(준비중) / Backups(준비중)
- 우측 상단 사용자 메뉴: 이메일 표시 + Logout

권장(모바일)
- 하단 탭바 3~4개: Dashboard / Transactions / Accounts / More
- More 화면에 Categories + 준비중 페이지를 모아둔다.

주의
- placeholder 페이지는 내비게이션에는 보여도 되지만, 들어가면 "준비중" + "언제 활성화"만 보여야 한다.
- 현재 계약/보안상 same-origin이 매우 중요하므로, 외부 링크/다른 도메인 이동을 전제로 UX를 설계하지 않는다.

### 5.3 핵심 사용자 흐름(페이지 분리 후 UX가 자연스러워지는 기준)

#### (A) 첫 사용/빈 상태 온보딩
- 로그인 직후 계좌가 없으면: Dashboard/Transactions에서 "계좌(카드/현금) 먼저 등록" CTA를 최우선으로 보여준다.
- 계좌가 생기면: Transactions에서 "거래 1건 입력"을 다음 단계로 안내한다.
- 카테고리가 비어 있거나(또는 원하는 카테고리가 없으면): Categories로 이동 CTA 제공.

#### (B) 거래 입력(메인 플로우)
- Transactions 페이지는 "목록"을 중심으로 두고, 입력은 화면 전환 없이 Drawer/Modal(또는 상단 펼침 패널)로 처리하는 것이 스크롤/레이아웃 붕괴를 막는다.
- 입력 폼은 Slice3 기준으로 `INCOME/EXPENSE`만 활성화하고, `TRANSFER`는 UI에서 명확히 비활성 + 안내 문구(=Slice4)로 처리한다.
- 거래 입력 시 계좌/카테고리가 없어서 선택을 못 하면:
  - 폼에서 막고(Disabled) "Accounts/Categories로 이동" 링크를 제공한다.

#### (C) 카드(계좌) 등록 위치(질문에 대한 결론)
- "카드 등록"은 `/accounts`가 단일 진실(Source of Truth)이다.
- Transactions 입력 폼에서는 "계좌가 없을 때"에만 `/accounts`로 이동시키는 CTA를 제공하고,
  거래 입력 플로우 안에서 계좌 생성까지 같이 넣는 것은(인라인 생성) Slice3 리빌드에서는 피한다.
  - 이유: UI 리빌드 단계에서 복합 플로우가 테스트/회귀를 크게 늘림

#### (D) 그래프/요약(현재 단계에서의 현실적인 처리)
- 너가 말한 "지출/수입 내역과 그래프"는 제품적으로 맞는 방향인데,
  Slice3에서는 공식 집계 API(`/reports/*`)가 없어서 정확한 월간 합계/그래프를 만들기 어렵다.
- 따라서 현재는 아래 중 하나로 처리한다.
  - Dashboard에서 "최근 N건" 기반 미니 요약(반드시 "최근 N건 기준" 라벨 고정)
  - `/reports` 페이지는 placeholder로 두고, Slice5에서 API가 생기면 정식 그래프/지표를 붙인다.

### 5.4 화면 책임(각 페이지가 해야 할 일/하면 안 되는 일)

- `/dashboard`
  - In: 최근 거래, 계좌/활성계좌 수, needsReview(인박스) 진입 CTA
  - Out: 기간 전체 공식 합계/그래프(리포트 API 없으므로)

- `/transactions`
  - In: 입력(드로어/모달), 필터(from/to/accountId/type/categoryId/needsReview/q), 페이지네이션(page/size), 정렬(sort)
  - Out: TRANSFER 입력 활성화, 리포트 수준 그래프

- `/accounts`
  - In: 카드/통장/현금/투자 계좌 등록, 활성/비활성 토글, 정렬(orderIndex)
  - Out: 계좌 도메인 정책 변경(잔액 계산/규칙 변경 등)

- `/categories`
  - In: 타입별(INCOME/EXPENSE) 목록/생성/수정, 시스템 카테고리 수정 제한 메시지 일관
  - Out: 깊이/권한 정책 변경

### 5.5 (권장) Transactions 필터 UX 규격(OpenAPI 기반)

`GET /api/v1/transactions` 쿼리 파라미터 제약:
- `page`: 0-based, default `0`, minimum `0`
- `size`: default `50`, minimum `1`, maximum `200`
- `sort`: default `txDate,desc` (형식: `{field},{asc|desc}`)
- 기타: `from`/`to`(date), `accountId`(int64), `type`(enum), `categoryId`(int64), `needsReview`(boolean), `q`(string)

UI 주의:
- 첫 페이지를 1로 보여주더라도 API에는 `page=0`을 보내야 한다.
- size는 UI에서 200을 초과하지 않도록 캡을 씌운다.
- 필터 상태는 가능하면 URLSearchParams와 동기화(리로드/공유/뒤로가기 안전).

### 5.6 "한 페이지 스크롤 지옥"을 없애는 레이아웃 원칙

지금 문제(스크롤하면 모든 기능이 한 페이지에 다 보임)는 "기능이 많아서"가 아니라
"한 화면에 create/edit/list/filter가 전부 동시에 떠 있음" 때문에 생긴다.

원칙(강제)
- 한 페이지에서 동시에 보여주는 메인 블록은 최대 2개만 유지한다.
  - 예: Transactions는 (1) 목록 (2) 입력 Drawer/Modal
  - 예: Accounts는 (1) 목록 (2) 생성 Modal
- Edit는 인라인 폼을 페이지 안에 계속 펼쳐두지 말고, "상세/편집 패널"로 분리한다.
  - 데스크톱: 오른쪽 패널(2-pane)
  - 모바일: bottom sheet / full-screen form
- Filters는 접어두고(기본 collapsed), "필터 요약 chips"로 현재 조건만 상단에 노출한다.
- 목록은 스크롤의 주인공이다. 폼/필터가 목록을 밀어내지 않게 sticky/overlay로 해결한다.

현 상태(App.tsx)에서 특히 분리해야 하는 결합 상태
- `mode`/`tab`(인증), `editingId`(계좌 편집), `editingCategoryId`(카테고리 편집), `editingTxId`(거래 편집)
  - 이 값들이 루트(App) 레벨에 묶여 있어서, 라우팅 도입 시 "다른 페이지로 갔다가 돌아오면 편집이 남아있는" 문제가 생기기 쉽다.
  - 페이지 단위 컴포넌트로 상태를 내려서(또는 route param으로) 고립시키는 게 안전하다.

### 5.7 입력 UX(거래/장부 페이지) 구체화

Transactions 페이지가 제품의 메인 화면이다. 여기서 UX가 깔끔해야 전체가 정돈된다.

추천 구조(데스크톱)
- 상단: 페이지 타이틀 + "Add"(새 거래) 버튼 + 인박스 배지(needsReview count)
- 중단: 필터 chips(기간/계좌/타입/카테고리/검색/인박스) + "필터 열기" 버튼
- 본문: 거래 목록(리스트) + (선택) 우측 상세/편집 패널
- Add/Edit: Drawer/Modal로 분리(목록은 그대로 유지)

추천 구조(모바일)
- 목록은 full height
- Add는 floating action button(FAB)
- Edit는 bottom sheet/full-screen

폼 필드(최소)
- txDate, type(INCOME/EXPENSE), amount, account, category(optional), description

고급 필드(기본 숨김)
- needsReview(checkbox), excludeFromReports(EXPENSE에서만), tagNames(추가 입력)

Slice3 필수 UX 제약
- type 변경은 수정에서 불가(삭제 후 재생성 정책): 수정 UI에서 type 셀렉터를 숨기거나 disabled
- category가 비어 있으면 서버가 needsReview=true로 보정한다: 저장 후 "인박스로 이동됨" 피드백을 제공
- excludeFromReports는 EXPENSE에서만 의미가 있다: INCOME에서는 토글을 숨기고(또는 disabled + 설명)
- TRANSFER는 create/update가 막혀 있다: type 선택지에서 TRANSFER를 숨기거나 "준비중"으로 비활성 처리

### 5.8 계좌(카드) 등록 UX 구체화

"카드 등록"은 `/accounts`에서만 한다.

권장 표현
- 계좌 타입(AccountType) -> 사용자 용어 매핑
  - CHECKING: 입출금/카드
  - SAVINGS: 저축
  - CASH: 현금
  - INVESTMENT: 투자

Accounts 페이지의 목표
- 계좌를 만들고, 활성/비활성을 관리하고, 정렬(orderIndex)을 정리하는 것

Transactions에서의 계좌 UX
- 계좌가 0개면 입력 폼을 막고 `/accounts`로 유도 CTA
- 계좌가 있지만 모두 inactive면 동일하게 유도

### 5.9 카테고리 UX 구체화(2단계 고정)

MVP 카테고리는 2단계(루트/자식)로 고정이다.

권장 UI
- INCOME/EXPENSE 토글(또는 탭)로 분리
- 루트 카테고리 리스트 + 선택 시 자식 리스트(2-pane) 또는 트리

Slice3 주의
- OpenAPI 상 type enum에 TRANSFER가 포함되어 있어도, Slice3에서는 TRANSFER 카테고리 생성/편집은 숨기거나 "준비중"으로 비활성 처리(혼란 방지)

### 5.10 인박스(needsReview) UX 구체화

인박스는 별도 제품 기능으로 취급한다(단순 필터가 아니라 사용자 행동을 이끈다).

추천
- `/transactions` 상단에 "All / Inbox" segmented control
- Inbox는 항상 `needsReview=true` preset
- Inbox에서 빠르게 할 수 있는 액션(가능한 범위)
  - category 지정
  - needsReview=false로 처리(=검토 완료)
  - 메모 수정
  - 삭제(soft delete)

### 5.11 폼 검증/입력 규칙(필수 - OpenAPI/도메인 기반)

UI 리빌드에서 가장 자주 터지는 건 "화면은 되는데 422/409"다. 아래는 프론트에서 미리 막아야 한다.

Auth
- signup: password minLength=8, email format
- login: password minLength=1, email format

Accounts
- name: maxLength=100
- openingBalance: integer, minimum=0
- type enum: CHECKING/SAVINGS/CASH/INVESTMENT

Transactions (Slice3: INCOME/EXPENSE)
- txDate: date(YYYY-MM-DD)
- amount: integer, minimum=1
- type enum: INCOME/EXPENSE/TRANSFER (Slice3에서는 TRANSFER 비활성)
- INCOME/EXPENSE: accountId 필수, from/to는 null
- categoryId null이면 서버가 needsReview=true로 보정(저장 후 UX 피드백 필요)
- excludeFromReports: EXPENSE에서만 의미 있음(그 외 타입은 false로 보정)
- tagNames: 각 tag maxLength=30
  - (권장) 입력 UX는 칩(chip) 형태 + `#` 입력 편의 제공(저장 시 `#` 제거)

Categories
- name: maxLength=100
- type enum: INCOME/EXPENSE/TRANSFER (Slice3에서는 TRANSFER 비활성)
- parentId: nullable (MVP는 2단계 고정)

오류 응답 UX(공통)
- 401: 세션 만료로 간주 -> `/auth`로 리다이렉트(또는 로그인 안내)
- 422: fieldErrors를 폼 필드 단위로 매핑
- 409: 정책 위반(예: Slice3에서 TRANSFER 시도, 타입 변경 시도) -> 사용자 메시지로 번역

---

## 6) 단계별 실행 계획(UI 슬라이스)

## Slice UI-0: 라우팅 뼈대 + 보호 레이아웃
Story:
- 사용자로서 기능별 페이지로 이동하고 싶다.

In:
- 라우터 도입
- (필수) `react-router-dom` 추가 설치
- 공통 레이아웃(사이드바/탑바/콘텐츠 영역)
- 인증 가드 + 기본 리다이렉트(`/` -> `/dashboard`)

Out:
- 개별 기능 재구현(아직)
- 디자인 디테일 최적화

DoD:
- 로그인/로그아웃 흐름이 기존과 동일하게 동작
- 비인증 시 보호 페이지 접근 차단
- 기존 Auth 테스트가 깨지지 않거나, 구조 변경을 반영해 대체 테스트 통과

추가 DoD(운영 안정성):
- dev에서 React.StrictMode로 인해 effect가 2번 실행되어도 무한 재요청/무한 리다이렉트가 발생하지 않음
- 보호 라우트의 인증 판정은 `getMe()`(세션 확인) 기반으로 일관되게 동작

## Slice UI-1: Accounts 페이지 분리
In:
- 기존 계좌 기능을 `/accounts`로 이동
- show inactive, 생성/수정/활성화/보관 동작 유지

Out:
- 계좌 도메인 정책 변경

DoD:
- 기존 계좌 API 호출 패턴 유지
- 계좌 화면 테스트 통과(행동 기준)

## Slice UI-2: Transactions 페이지 분리
In:
- 거래 생성/수정/삭제/필터/페이지네이션을 `/transactions`로 이동
- URL 쿼리와 필터 동기화(선택)
- (권장) Inbox 프리셋(All/Inbox) 제공: Inbox = `needsReview=true`

Out:
- TRANSFER 입력 활성화

DoD:
- `INCOME/EXPENSE` 플로우 정상
- 필터, 페이지네이션, CRUD 테스트 통과
- Inbox 프리셋이 올바른 쿼리(`needsReview=true`)를 생성하고, 검토 완료 처리(needsReview=false)가 동작

## Slice UI-3: Categories 페이지 분리
In:
- 카테고리 생성/수정/목록 기능 분리

Out:
- 카테고리 깊이/권한 정책 변경

DoD:
- 타입별 카테고리 유지
- 시스템 카테고리 수정 제한 메시지/오류 처리 일관

## Slice UI-4: Dashboard(현행 데이터 기반)
In:
- 현재 구현된 API 범위 내 요약 정보 제공
  - 계좌 개수/활성 계좌 수
  - 최근 거래 목록
  - (선택) 최근 N건 기준 소계/배지("최근 N건 기준"을 명확히 표시)

Out:
- `/reports/*` 기반 공식 통계값 표시
- transferVolume 등 Slice5 의존 지표

DoD:
- 대시보드가 미구현 API를 호출하지 않음
- 성능 문제 없이 첫 진입 렌더 완료

주의(표시 금지):
- `totalIncome/totalExpense/netSaving/transferVolume` 같은 "공식 집계" 카드는 Slice5 전에는 placeholder 또는 "준비중"으로 유지
- 페이지네이션된 거래 목록 일부를 합산해 "월 합계"처럼 오해될 수 있는 UI를 만들지 않음

## Slice UI-5: Placeholder 페이지 정식화
In:
- `/transfers`, `/reports`, `/imports`, `/backups` 준비중 화면
- 각 페이지에 "활성화 조건(해당 slice 완료 후)" 안내

Out:
- 실제 생성/조회 기능

DoD:
- 사용자 혼란 없는 내비게이션 완성
- dead link/404 없음

---

## 7) 테스트 전략(필수)

### 7.1 회귀 위험 포인트
- 현재 테스트는 텍스트/레이블 의존도가 높다.
- 라우팅/레이아웃 분리 시 테스트가 대량 실패할 수 있다.

현재 테스트 현황(참고):
- 단일 통합 테스트가 `App` 전체를 렌더링하는 형태: `frontend/src/App.test.tsx`
- 라우팅 도입 후에는 페이지 단위 테스트로 분리하고, 라우팅/가드 시나리오는 `MemoryRouter` 기반으로 재작성하는 것이 안전하다.

### 7.2 대응 원칙
- UI 텍스트 변경 전, 테스트를 "행동 기준"으로 먼저 재정비
- 기능 단위 테스트를 페이지별로 분리
- 공통 시나리오:
  - 비인증 접근 차단
  - 로그인 후 보호 라우트 접근
  - 거래 CRUD + 필터 + 페이지네이션
  - 계좌 inactive 토글
  - CSRF 헤더 전달 확인

추가 권장:
- 텍스트 기반 셀렉터 대신 role/testid 중심으로 전환(디자인 리빌드 내내 테스트 안정성 확보)
- fetch 전역 stub 대신 MSW 도입을 검토(라우팅 도입 후 테스트 유지보수 비용 감소)

라우팅/가드 테스트 기본 패턴(예시):
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route path="/login" element={<div>Login</div>} />
      <Route path="/dashboard" element={<div>Dashboard</div>} />
    </Routes>
  </MemoryRouter>
);

expect(screen.getByText('Dashboard')).toBeInTheDocument();
```

MSW(Vitest/Node) 기본 패턴(예시):
```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/v1/auth/me', () => HttpResponse.json({ id: 1, email: 'demo@example.com' }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 7.3 검증 명령
```bash
cd frontend && npm run test -- --run
cd frontend && npm run build
cd backend && ./mvnw test
bash scripts/contract/openapi_lint.sh
bash scripts/contract/spec_impl_drift.sh
```

---

## 8) 구현 중 자주 터지는 문제와 예방

1. 문제: 라우트 전환 시 데이터 재조회 루프
- 예방: 페이지 진입 시점/의존성 배열 명확화

2. 문제: 로그아웃 후 보호 상태 잔존
- 예방: auth state 초기화와 라우트 리다이렉트 순서 고정

3. 문제: 필터 상태 유실
- 예방: URLSearchParams 동기화 또는 페이지 상태 저장 전략 선택

4. 문제: 준비중 페이지에서 잘못된 API 호출
- 예방: 미구현 페이지 컴포넌트에는 API 모듈 import 자체를 금지

5. 문제: UI는 되는데 CI 실패
- 예방: 각 슬라이스마다 테스트/빌드/contract gate 즉시 실행

6. 문제: 라우팅 도입 후 직접 URL 진입/새로고침 404
- 예방: HashRouter 사용 또는 배포 서버에서 "모든 non-/api 요청 -> index.html" rewrite 설정을 준비

7. 문제: 대시보드 숫자 신뢰성 붕괴(부분 데이터 합산)
- 예방: Slice3 단계에서 "공식 리포트 숫자"를 UI에서 만들지 않는다(보고서 API가 생길 때까지 placeholder)

---

## 9) 최종 완료 기준(이번 UI 리빌드)
- 단일 `App` 집중 구조를 기능 페이지 중심 구조로 분리 완료
- Auth/CSRF/user scope 규칙 유지
- Slice3 범위 기능(Accounts/Transactions/Categories/Auth) 회귀 없음
- 미구현 기능은 placeholder로 명확히 분리
- 프론트 테스트/빌드, 백엔드 테스트, 계약 게이트 통과

---

## 10) 한 줄 원칙
`지금 없는 백엔드 기능을 UI에서 먼저 "완성형"으로 만들지 말고, Slice3 범위를 안정적으로 분리/고도화한 뒤 Slice4~7을 순서대로 활성화한다.`

---

## 11) 그래프형 메인 대시보드 확장 계획(팩트체크 반영)

이 섹션은 "스크린샷처럼 정보가 많은 그래프형 대시보드"를 현재 프로젝트에서 어떻게 안전하게 구현할지 정의한다.

### 11.1 팩트체크 결론

가능 여부를 현재 계약/구현 기준으로 구분하면 아래와 같다.

| 항목 | 현재 가능 여부 | 근거 | 비고 |
| --- | --- | --- | --- |
| Recent Activity 리스트 | 가능 (Slice3) | `GET /transactions` 구현 완료 | 이미 현재 Dashboard에서 사용 중 |
| Inbox 카운트/리뷰 배지 | 가능 (Slice3) | `needsReview` 필터 지원 | 이미 구현됨 |
| TRANSFER 생성/수정 | 불가 (Slice4 전) | 현재 `409 CONFLICT` | Slice4 완료 전 UI 활성화 금지 |
| 공식 요약 카드(totalIncome/totalExpense/netSaving/transferVolume) | 불가 (Slice5 전) | `/reports/summary` 미구현 | Slice5에서 활성화 |
| 이체 리포트(계좌쌍별) | 불가 (Slice5 전) | `/reports/transfers` 미구현 | Slice5에서 활성화 |
| CSV/Backup 연동 위젯 | 불가 (Slice6/7 전) | 엔드포인트 미구현 | placeholder 유지 |
| "월 달력(일별 입출금)" 뷰 | 계약 미정(추가 필요) | 현재 OpenAPI에 전용 일별 집계 엔드포인트 없음 | Slice5 이후 확장 항목 |

정리:
- "그래프가 많은 대시보드" 자체는 가능하다.
- 다만 데이터 소스는 slice 단계별로 열어야 하며, Slice5 전에는 공식 집계 그래프를 placeholder로 유지해야 한다.

### 11.2 목표 대시보드 구성(위젯 맵)

아래 위젯 조합을 목표로 한다.

| 위젯 | 데이터 소스 | 시작 Slice | 실패 시 처리 |
| --- | --- | --- | --- |
| KPI 카드 4종 (Income/Expense/Net/Transfer) | `GET /reports/summary` | Slice5 | 카드별 skeleton + "준비중" 배지 |
| Inbox 카드 | `GET /transactions?needsReview=true&page=0&size=1` | Slice3 | 0건 처리 |
| Recent Activity 테이블 | `GET /transactions?page=0&size=10&sort=txDate,desc` | Slice3 | empty-state |
| Transfer Pair 차트/표 | `GET /reports/transfers` | Slice5 | 숨김 또는 placeholder |
| Expense Top-N 바차트 | Slice5 확장(계약 추가 또는 백엔드 계산 API) | Slice5+ | placeholder |
| 월간 추이 라인/바 차트 | Slice5 확장(일별/월별 집계 API 필요) | Slice5+ | placeholder |
| 달력(일별 입출금) | Slice5 확장(전용 API 필요) | Slice5+ | fallback: 거래 리스트 링크 |

### 11.3 슬라이스 연동 순서(자연스러운 진행)

1. Slice4 완료
- 목표: `TRANSFER` 입력/조회 정상화
- 대시보드 영향: 내부이동 데이터가 생성되기 시작(아직 공식 그래프는 안 붙임)

2. Slice5 1차(기존 계약 범위)
- 목표: `/reports/summary`, `/reports/transfers` 구현 + 연결
- 대시보드 영향: KPI 카드 + Transfer 리포트 위젯 활성화 가능

3. Slice5 2차(확장 계약)
- 목표: 그래프/달력에 필요한 집계 API 추가
- 예시: 일별 현금흐름, 카테고리 Top-N, 계좌 잔액 추이

4. Slice6/7
- 목표: CSV/Backup 위젯 활성화
- 대시보드 영향: 데이터 품질/복원 상태 위젯 추가 가능

### 11.4 달력형 뷰 요구사항 대응(추가 계약 항목)

"3월 며칠에 얼마 들어오고/나갔는지"를 안정적으로 그리려면, 거래 목록을 프론트에서 억지 집계하지 말고 전용 API를 추가한다.

권장 추가 계약(초안):
- `GET /api/v1/reports/daily-cashflow?from=YYYY-MM-DD&to=YYYY-MM-DD`
- 응답 예시:
```json
{
  "from": "2026-03-01",
  "to": "2026-04-01",
  "items": [
    { "date": "2026-03-01", "income": 500000, "expense": 120000, "net": 380000 },
    { "date": "2026-03-02", "income": 0, "expense": 45000, "net": -45000 }
  ]
}
```

규칙:
- `TRANSFER`는 일별 현금흐름(income/expense/net)에서 제외
- `excludeFromReports=true`인 EXPENSE는 expense 집계에서 제외
- `needsReview=true` 또는 `categoryId=null` 항목은 보조 배지/카운트로 분리(옵션)

### 11.5 백엔드-프론트 연결 오류 방지 체크리스트

대시보드 다중 위젯 연결 시 아래를 지키면 회귀를 크게 줄일 수 있다.

1. API 경계
- 모든 호출은 `frontend/src/api.ts`를 통해서만 수행
- 위젯 컴포넌트에서 직접 fetch 금지

2. 요청 파라미터
- `from/to`는 반드시 명시적으로 전달
- 날짜는 `LocalDate` 기준으로 처리(브라우저 timezone 변환 금지)

3. 위젯 독립 실패 처리
- `Promise.allSettled`로 위젯별 실패 격리
- 한 위젯 실패가 전체 Dashboard blank를 만들지 않게 처리

4. Slice 가드
- Slice5 전에는 `/reports/*` 호출 자체를 하지 않거나, feature flag로 막음
- `transfers/reports/imports/backups` placeholder 정책 유지

5. 숫자 신뢰도 라벨링
- 공식 집계 API 전에는 "최근 N건 기준" 라벨 강제
- 공식 집계 API 이후에만 "월 합계/총계" 명칭 사용

6. 테스트
- 대시보드 위젯별 로딩/에러/empty 상태 테스트 추가
- `reports` 미구현 상태(404/501 가정)에서 UI가 깨지지 않는 회귀 테스트 추가

### 11.6 Dashboard 전용 DoD(확장판)

그래프형 대시보드 작업은 아래를 만족해야 완료로 본다.

- 데이터 출처가 위젯마다 문서화되어 있음(API 또는 placeholder)
- Slice 단계에 맞지 않는 위젯은 숨김/준비중 처리됨
- totalIncome/totalExpense/netSaving/transferVolume은 Slice5 이후에만 노출
- 위젯 단위 에러 핸들링이 동작하고 전체 레이아웃이 유지됨
- 프론트 테스트 + 빌드 + 백엔드 테스트 + contract gate 통과
