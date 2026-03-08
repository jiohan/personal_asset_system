# TransactionsPage UX/UI Refactor Guide (V2)

## 1. 목적
`TransactionsPage`를 생산성 중심의 Deep Dark Master-Detail UX로 개선하고, 다음 4가지를 동시에 달성한다.
- 카테고리 선택 속도 개선 (Recent/Frequent + Create)
- 핵심 정보 우선 노출 (SummaryCards)
- Inbox 정리 작업 속도 개선 (벌크 Clear)
- 실수 완화 (지연 삭제 + Undo)

## 2. 범위
### In
- `frontend/src/components/CreatableCombobox.tsx` 신규
- `frontend/src/components/SummaryCards.tsx` 신규
- `frontend/src/pages/TransactionsPage.tsx` 리팩터
- `frontend/src/styles.css` Deep Dark 스타일 확장
- `frontend/src/pages/TransactionsPage.test.tsx` 시나리오 갱신

### Out
- 백엔드 신규 API 추가
- DB 스키마 변경/Flyway migration
- restore API 기반 진짜 서버 Undo

## 3. 핵심 설계

### 3.1 SummaryCards
- 데이터 소스:
  - `getReportSummary({ from, to })`
  - `listTransactions({ from, to, needsReview: true, page: 0, size: 1 })`
- 기본 기간 정책:
  - Transactions 필터 `from/to` 연동
  - 미지정 시 `당월 1일 ~ 오늘`
- 지표:
  - Income, Expense, Net Saving, Transfer, Inbox Needs Review

### 3.2 CreatableCombobox
- 접근성:
  - `role=combobox/listbox/option`
  - `aria-expanded`, `aria-activedescendant`, 키보드 탐색(↑/↓/Enter/Escape)
- 섹션 순서:
  - `Recent(최대 5) -> Frequent(최대 10) -> All Matches`
- 노출 규칙:
  - 활성(`isActive=true`) + 거래 타입 일치 카테고리만
  - 필터 결과가 0개이고 exact match가 없을 때만 `+ Create "{input}"`
- 로컬 usage 저장:
  - 키: `ams.categoryUsage.v1.user.{userId}.type.{INCOME|EXPENSE}`
  - 데이터: `categoryId`, `useCount`, `lastUsedAt`
  - 선택/생성 성공 시 즉시 usage 갱신

### 3.3 Delete Undo (지연 삭제)
- 삭제 클릭 시 즉시 DELETE 호출하지 않음
- 5초 타이머 pending 상태로 전환:
  - 목록에서 즉시 숨김
  - 스낵바: `Deleted · Undo (Ns)` 노출
- `Undo` 클릭:
  - 타이머 취소
  - 목록 복원
- 5초 만료:
  - `deleteTransaction(id)` 실행
- 실패 처리:
  - 숨김 해제(원복)
  - 에러 메시지 노출
- 동시 삭제 정책:
  - pending 1건만 허용
  - 새 삭제 요청 시 기존 pending을 즉시 확정 호출 후 새 건 등록
- unmount 시:
  - pending 있으면 best effort 즉시 확정 호출

### 3.4 Inbox Bulk Clear
- Inbox 탭에서만 체크박스/벌크 바 노출
- 선택 범위: 현재 페이지 행 한정
- 실행 방식:
  - `PATCH /transactions/{id}` 반복 호출
  - 제한 동시성 + `Promise.allSettled`
- 결과 처리:
  - 성공 건 즉시 `needsReview=false` 반영
  - 실패 건 개수 에러 표시
  - 마지막에 목록 재조회로 동기화

### 3.5 Progressive Disclosure Form
- 항상 표시:
  - Amount, Account(or From/To), Category, Date, Description
- More Options 접힘 영역:
  - Needs Review, Exclude from reports
- 강제 규칙:
  - 카테고리 비어 있으면 `needsReview=true` 강제 + 토글 비활성
- TRANSFER 간소화:
  - From/To + Swap 버튼 제공

## 4. 보안/백엔드/DB 연동 기준
- 모든 변경 요청은 `api.ts` 경유 (CSRF + `credentials: include` 유지)
- 서버 도메인 규칙 유지:
  - `categoryId=null`(INCOME/EXPENSE) => 서버도 `needsReview=true` 강제
- 신규 엔드포인트 없음, DB 변경 없음
- 민감 정보는 localStorage 저장 금지 (카테고리 usage 통계만 저장)

## 5. 테스트 기준

### 자동 테스트
- `TransactionsPage.test.tsx` 검증 항목:
  - SummaryCards 렌더링 + Inbox preset
  - Combobox Recent/Frequent/중복 제거
  - Create 옵션 exact match 규칙
  - 카테고리 공란 시 Needs Review 강제
  - Delete Undo 성공/타임아웃 확정/실패 복구
  - Inbox 벌크 Clear 부분 실패 처리

### 수동 테스트
1. `/transactions` 진입 후 Summary 값/기간 확인
2. 신규 거래 폼에서 카테고리 검색 시 Recent/Frequent 노출 확인
3. 새 카테고리 입력 시 `+ Create` 노출/생성 확인
4. 카테고리 비운 상태에서 Needs Review 강제 확인
5. 거래 삭제 후 5초 내 Undo/5초 경과 확정 삭제 확인
6. Inbox 탭에서 다중 선택 후 bulk clear 및 부분 실패 메시지 확인

## 6. 후속 개선 후보
- 다건 정리를 위한 전용 벌크 API 도입
- 공용 Toast/Snackbar 인프라 분리
- Recent/Frequent를 서버 프로필 기반으로 승격(다기기 동기화)
