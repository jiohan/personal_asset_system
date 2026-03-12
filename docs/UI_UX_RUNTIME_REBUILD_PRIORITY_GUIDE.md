# UI/UX Runtime Rebuild Priority Guide

> Verified against the live local service on 2026-03-11.
> Basis:
> - `auth / dashboard / transactions / inbox / detail / accounts / categories / reports / imports / backups`
> - desktop + mobile viewport browser runs
> - `bash scripts/dev/smoke_local.sh --full`
> - API flow check: signup -> auth/me -> accounts -> transactions -> reports
> - DB persistence spot-check on Postgres

## 1. 목적

이 문서는 현재 실행 중인 서비스를 실제 사용자 관점에서 검증한 뒤, 다음 리빌드에서 우선적으로 바꿔야 할 화면 구조와 구현 순서를 정의한다.

핵심 결론은 아래 2가지다.

1. 기능 연결은 이미 충분히 살아 있다.
2. 현재 가장 큰 문제는 백엔드 연동이 아니라 프론트 셸, 정보 구조, 입력 UX다.

이 문서는 아래를 포함한다.

- P0 / P1 / P2 우선순위
- 화면별 재구성안
- 컴포넌트 분해 기준
- 디자인 시스템 방향
- 백엔드 API 확장 필요 지점

## 2. 런타임 검증 요약

### 2.1 확인된 정상 사항

- Postgres 컨테이너가 healthy 상태였다.
- backend `:8080`, frontend `:5173`, postgres `:5432`가 정상 리슨 중이었다.
- full smoke check가 통과했다.
- 브라우저에서 아래 플로우가 실제로 동작했다.
  - 회원가입
  - 계좌 생성
  - 수기 거래 입력
  - reports 반영
  - CSV import 실행
  - inbox 반영
  - dashboard review count 반영
- API 실검증에서 아래가 정상 응답했다.
  - `/auth/signup`
  - `/auth/me`
  - `/accounts`
  - `/transactions`
  - `/reports/summary`
  - `/reports/transfers`
- DB 직접 조회에서 생성 사용자 기준 `accounts=2`, `transactions=2` 반영을 확인했다.
- frontend test `15/15`, backend test `37/37`가 통과했다.

### 2.2 확인된 문제 사항

- 모바일에서 고정 사이드바와 본문이 동시에 노출되어 화면이 잘린다.
- 대시보드는 실제 데이터가 있어도 정보 밀도와 행동 유도력이 낮다.
- Transactions는 가장 낫지만 신규 입력이 빠른 장부 입력 UX는 아니다.
- 운영 화면과 관리 화면이 모두 같은 카드 템플릿 언어를 사용해 제품 톤이 평평하다.
- 폰트 로드는 선언만 있고 실제 import가 없어 일관성 보장이 약하다.
- 영어/한국어가 혼재되어 있고 imports 안내 문구에는 백틱이 그대로 노출된다.

## 3. 제품 구조 재정의

현재 구조의 핵심 문제는 모든 페이지가 비슷한 카드 대시보드처럼 보인다는 점이다.

다음 리빌드에서는 제품을 2개 모드로 나눠야 한다.

### 3.1 Operations Mode

빠른 입력, 정리, 현재 상태 판단에 집중하는 화면이다.

- Dashboard
- Transactions
- Imports

### 3.2 Library / Management Mode

설정, 관리, 탐색에 집중하는 화면이다.

- Accounts
- Categories
- Reports
- Backups

### 3.3 핵심 원칙

- `Transactions`를 메인 워크벤치로 둔다.
- `Dashboard`는 아침 점검용 control center로 둔다.
- 신규 입력은 `Dashboard`가 아니라 `Transactions` 중심으로 설계한다.
- `Reports`는 카드 나열이 아니라 추세와 비교를 보여주는 분석 화면으로 분리한다.

## 4. 우선순위

## 4.1 P0

릴리즈 전에 반드시 바꿔야 하는 항목이다.

### P0-1. 반응형 셸 재설계

- 모바일에서 고정 사이드바를 유지하지 않는다.
- 데스크톱:
  - collapsible left rail
  - content width fluid layout
- 모바일:
  - bottom nav 또는 overlay drawer
  - topbar는 한 줄로 축약

대상 파일:

- `frontend/src/components/Layout.tsx`
- `frontend/src/styles.css`

### P0-2. 페이지 폭 정책 분리

- `Dashboard`, `Transactions`, `Reports`는 `max-width: 1200px` 제한을 제거한다.
- `Accounts`, `Categories`, `Imports`는 관리형 레이아웃이므로 적절한 읽기 폭을 유지한다.
- 공통 `.page-container` 하나로 모든 페이지를 묶지 않는다.

### P0-3. 디자인 토큰 정리

- radius를 `2px ~ 4px` 중심으로 재정의
- 숫자 typography에 `tabular-nums` 적용
- cyan 사용 위치를 제한
  - focus
  - primary CTA 1개
  - active state 일부
- 둥근 chip/toggle 비중 축소
- panel/background 대비 강화

### P0-4. 타이포 / 카피 기준 통일

- 웹폰트 로드를 명시적으로 추가
- 영문/한글 UI 카피 기준 확정
- imports의 백틱 노출 제거
- `review`, `cleared`, `needs review` 등의 용어를 일관화

## 4.2 P1

사용자 체감 품질을 크게 올리는 항목이다.

### P1-1. Dashboard 재설계

현재 `Active Accounts + Inbox + Recent Transactions` 구조는 너무 얕다.

목표 구조:

- hero cashflow number
- 30일 cashflow spark bar
- inbox queue
- quick entry composer
- recent activity lane

### P1-2. Transactions 입력 흐름 재설계

현재 우측 side sheet는 수정 용도로는 괜찮지만, 신규 입력에는 느리다.

목표 구조:

- 신규 입력:
  - `amount -> merchant -> category/account`
  - progressive disclosure composer
- 기존 거래 수정:
  - split-pane detail 또는 side sheet 유지
- 역할 분리:
  - input = composer
  - edit = detail pane

### P1-3. Imports를 3-step wizard로 재구성

현재 import 로직은 좋다. 문제는 표현 방식이다.

목표 구조:

1. Upload
2. Mapping + Validation
3. Preview + Commit

### P1-4. Reports 정보 구조 재설계

현재 summary card 나열은 분석 화면으로서 약하다.

목표 구조:

- 기간 선택 바
- trend lane
- category spend top list
- transfer lane
- summary metric strip

## 4.3 P2

품질 완성도와 유지보수성을 올리는 항목이다.

### P2-1. Accounts / Categories를 utility view로 축소

- card 위주 배치 대신 dense list/table 중심
- inline edit 유지 가능
- 관리 화면답게 스캔 속도를 높인다

### P2-2. 공용 컴포넌트 계층 정리

- 현재 `styles.css` 의존이 너무 크다.
- primitive와 page-level component를 분리한다.

### P2-3. UI 상태/카피 정리

- empty
- loading
- error
- disabled
- success

이 5개 상태의 시각 규칙을 페이지마다 통일한다.

## 5. 화면 구조안

## 5.1 Dashboard

### Desktop

- 상단 좌측:
  - `이번 달 순현금흐름` hero number
  - 전월 대비 delta
- 상단 우측:
  - inbox queue
  - quick entry
- 중단:
  - 30일 cashflow lane
- 하단:
  - recent transactions
  - optional account snapshot

### Mobile

- hero number
- quick entry
- inbox
- recent transactions

차트보다 행동이 먼저 오도록 배치한다.

## 5.2 Transactions

### Desktop

- 상단:
  - compact metric strip
  - filter rail
- 본문 좌측:
  - grouped transaction list
- 본문 우측:
  - edit detail pane
- 신규 입력:
  - 상단 composer 또는 sticky composer

### Mobile

- list-first
- filter는 bottom sheet 또는 collapsible block
- 신규 입력은 full-screen composer
- detail은 독립 route 또는 full-screen sheet

## 5.3 Imports

### Desktop

- 좌측 메인 wizard
- 우측 rules / account mapping summary / import result

### Mobile

- stepper 기반 1열 흐름
- preview table은 가로 스크롤 허용

## 5.4 Accounts

- dense grouped list 또는 compact table
- 잔액 숫자만 크게
- 부가 정보는 약하게

## 5.5 Categories

- type segmented control
- dense list
- 빠른 add row
- edit는 inline 유지

## 5.6 Reports

- 상단 기간 바
- 주요 추세 차트
- category top-N
- transfer summary
- metric strip

## 6. 컴포넌트 분해안

현재는 공용 CSS primitive와 페이지 파일이 강하게 결합되어 있다.

다음 구조로 분해하는 것을 권장한다.

### 6.1 Shell

- `AppShell`
- `PrimaryRail`
- `Topbar`
- `BottomNav`
- `PageFrame`

### 6.2 Operations

- `DashboardHero`
- `DashboardInboxPanel`
- `DashboardQuickEntry`
- `CashflowSparkBar`
- `TransactionComposer`
- `TransactionListPane`
- `TransactionDetailPane`
- `TransactionFilters`
- `ImportWizard`
- `ImportRulesPanel`

### 6.3 Management

- `AccountListView`
- `CategoryListView`
- `ReportsRangeBar`
- `ReportsMetricStrip`
- `ReportsTrendPanel`
- `PlaceholderState`

### 6.4 Foundation

- `MetricCard`
- `SectionHeader`
- `SegmentedControl`
- `CompactTable`
- `EmptyState`
- `InlineEditor`
- `NumberValue`
- `StatusBadge`

## 7. 구현 순서

리스크를 줄이려면 아래 순서가 맞다.

### Phase 0. Foundation

- design tokens
- typography
- responsive shell
- page width policy

### Phase 1. Transactions first

- composer 도입
- detail pane 역할 분리
- mobile transaction flow 정리

### Phase 2. Dashboard

- control center 재구성
- quick entry 연결
- inbox queue 강화

### Phase 3. Imports / Accounts / Categories

- imports wizard화
- accounts dense view
- categories utility view

### Phase 4. Reports

- trend 중심 재설계
- backend API 갭 반영

## 8. 백엔드 API 갭

현재 공식적으로 붙어 있는 리포트 API는 아래뿐이다.

- `GET /reports/summary`
- `GET /reports/transfers`

다음 UI를 제대로 만들려면 API 확장이 필요하다.

### 8.1 필요 API

- category top-N spend
- monthly cashflow trend
- account balance trend
- dashboard snapshot

### 8.2 있으면 좋은 API

- inbox bulk clear
- dashboard combined summary
- saved filters / recent searches

### 8.3 프론트만으로 가능한 범위

- shell 재설계
- typography / copy 정리
- transactions 입력 UX 개선
- imports wizard화
- accounts / categories dense layout

## 9. 완료 기준

다음 조건을 만족해야 리빌드가 성공으로 본다.

### UX

- 모바일에서 가로 잘림이 없어야 한다.
- 거래 1건 입력이 키보드 중심으로 빠르게 끝나야 한다.
- dashboard가 첫 화면으로서 행동 유도력을 가져야 한다.
- accounts / categories / reports / imports가 서로 다른 제품 모드처럼 보여야 한다.

### 기술

- 기존 인증/세션/CSRF 흐름을 유지해야 한다.
- frontend / backend 자동 테스트가 계속 통과해야 한다.
- smoke check가 계속 통과해야 한다.
- page-level redesign가 primitive 남용으로 다시 하나의 카드 템플릿으로 수렴하지 않아야 한다.

## 10. 최종 결정

다음 리빌드의 기준 문장은 아래다.

> `Transactions`를 메인 워크벤치로 재정의하고, `Dashboard`는 아침 점검용 control center로 축소한다.

이 결정을 기준으로 셸, 화면 구조, 컴포넌트, API 우선순위를 정하면 현재 문제를 가장 짧은 경로로 해결할 수 있다.
