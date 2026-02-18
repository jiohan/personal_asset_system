# 개인 자산 관리 PWA 개발 가이드

## 1. 제품 목표 (핵심 기능)
이 프로젝트의 핵심 가치는 아래 3가지입니다.

1. 계좌별 입출금 거래 기록
- 거래 내역 저장: 언제/얼마/어디/메모/계좌
- 수동 입력 지원
- CSV/엑셀 업로드 지원 (초기 필수)

2. 세부 분류 체계
- 카테고리: 예) 식비 > 배달, 교통 > 대중교통
- 태그: 예) #데이트, #출장, #정기결제
- 분류 규칙 기반 자동 태깅/추천: 키워드/금액/가맹점 기준

3. 흐름 시각화 및 리포트
- 월별 현금 흐름: 수입-지출(이체는 제외)
- 월별 자금 이동: 이체(계좌 간 이동) 합계, 투자계좌로 이동/회수 합계(선택)
- 카테고리별 지출 Top N
- 계좌별 잔액 추이 및 전월 대비 비교 (고정/정기 분리)

---

## 2. 실행 로드맵 (A안)

### 0단계: MVP 기준 설정
- 핵심 기준: 정리되고, 검색되고, 분류되고, 리포트가 나온다.
- 포함 기능: 거래 입력/수정/삭제, 복수 계좌 관리, 카테고리/태그, 월별/카테고리별 리포트
- 제외 기능(초기): 자동 연동, 영수증 OCR, AI 자동 분류
- 제외 기능(초기, 투자): 종목/매수/매도/배당, 평가손익/수익률, 시세 연동(투자 성과 분석)
- 제외 기능(초기): 카드/대출 등 부채 모델링(지출 2번 잡힘 방지 룰 포함)

### 1단계: 데이터 유입 경로 구축 (입력)
- 모바일 빠른 수동 입력: 날짜/금액/수입·지출/카테고리/메모
- CSV 업로드(MVP 고정): 1-shot import(`POST /api/v1/imports/csv`)로 검증/중복처리/저장을 한 번에 수행
  - UI는 업로드 전에 로컬 미리보기를 제공할 수 있다(서버 API 계약은 1-shot으로 단순화).
- 날짜 파싱 규칙: CSV에 시간이 있어도 최종 저장은 `LocalDate`(date-only). 타임존 변환 드리프트 방지용 기본 타임존을 명시(예: Asia/Seoul).

### 2단계: 분류 시스템 구축 (정리)
- 카테고리(MVP 고정): 2단계(대/소)
- 태그: 다중 태그 지원
- 분류 규칙: 키워드/날짜/금액/가맹점 기반 자동 분류
- 검토함(인박스): 자동 분류 불확실 항목 일괄 처리

### 3단계: 대시보드 및 리포트 (시각화)
- 대시보드: 이달 수입/지출/순저축(=수입-지출, 이체 제외), 지출 Top 5, 현금흐름 그래프
- 거래내역 리스트: 기간/계좌/카테고리 필터 + 검색
- 리포트: 월별 비교, 카테고리별 비중(파이/막대), 고정비/변동비 집계

### 4단계: PWA 사용성 고도화
- 설치(홈 화면 추가)
- 반복 거래 자동 생성 (구독/월세)
- 예산/목표 설정
- 백업/복원 (내보내기/가져오기)

### 5단계: 모바일 앱 확장 판단
- 확장 신호: 알림/위젯 필요, 영수증 촬영 필요, 오프라인 동기화 중요성 증가
- 전략: 모바일 앱은 간편 입력+조회 중심, 분석은 웹 유지

---

## 3. 추천 기술 스택

### 프론트엔드 (PWA)
- React + TypeScript
- 이유: PWA 구현 용이, 대시보드/데이터 처리 적합
- 대안: Vue+TS(경량), SvelteKit(속도)

### 백엔드 (API)
- Java + Spring Boot
- 이유: 복잡한 규칙/리포트 계산, 인증/배치 확장 안정성

### 데이터베이스
- PostgreSQL 권장
- 이유: 누적 거래 데이터 + 복잡한 집계 쿼리에 강함
- 참고: 초기 SQLite 가능하지만 운영 확장 고려 시 Postgres 선호

### 기타 인프라
- 인증: 이메일+비밀번호(세션/JWT) 또는 Google OAuth 중 하나
- 파일 관리: CSV 업로드/다운로드 + Zip/JSON 백업

---

## 4. 개발 환경 및 구성

### 필수 설치
- JDK 21 (또는 17)
- Node.js LTS
- Git
- Docker Desktop (DB 컨테이너)
- IDE: IntelliJ(백엔드), VS Code(프론트엔드)

### 로컬 구성
- 프론트: 개발 서버 (Hot Reload)
- 백엔드: 로컬 API 서버
- DB: Docker 기반 실행 (환경 통일)

### 추천 레포 구조
```text
/frontend   # PWA
/backend    # Spring Boot API
/infra      # docker-compose, 설정
/README.md  # 개발 규칙
```

### P0 운영 고정(환경변수/브랜치)
환경변수 로딩(백엔드)
- `backend/.env.local`은 "참고 파일"이며, Spring Boot가 자동으로 읽지 않는다.
- 실행 전에 shell export(또는 IDE Run Configuration 환경변수)로 주입한다.
- 팀/CI/로컬 공통 규칙: `application*.yml + shell env`만 신뢰한다.

브랜치/PR 운영
- `main` 직접 개발 금지, 기능 단위 브랜치에서만 작업
- PR은 "기능 1개 = PR 1개" 원칙
- PR 머지 후 브랜치는 빠르게 정리(오래된 Open PR 방치 금지)

---

## 5. 개발 시작 전 최소 설계 고정
아래 4가지는 시작 전에 확정합니다.

0. 도메인 원칙/용어 (Glossary & Invariants)
- 거래 타입
  - `INCOME`: 외부에서 자산이 유입되는 거래 (급여, 이자 등)
  - `EXPENSE`: 외부로 자산이 유출되는 거래 (식비, 월세 등)
  - `TRANSFER`: 내 계좌 간 이동 (A -> B). 전체 자산 총액 변화 없음
- 계좌 타입(MVP)
  - `CHECKING` | `SAVINGS` | `CASH` | `INVESTMENT` (MVP 고정)
- 금액/부호
  - `amount`는 항상 양수 KRW 정수: `amount > 0`
  - 부호는 `type`으로 결정한다. DB에 음수 금액을 저장하지 않는다.
- 날짜
  - 저장은 `LocalDate`(date-only)로 고정한다.
  - CSV에 시간이 포함되어도 최종 저장은 `LocalDate`이며, 파싱 타임존(예: Asia/Seoul)을 명시한다.
- 소프트 삭제
  - `deletedAt`이 있는 거래는 기본 조회/리포트에서 제외한다.
- 이체(TRANSFER) 원칙
  - 현금흐름(총수입/총지출/순저축) 통계에서 `TRANSFER`는 제외한다.
  - 계좌 잔액/추이 계산에는 `TRANSFER`를 포함한다.
- 거래 필드 상호배타(중요)
  - `type=TRANSFER`: `fromAccountId`/`toAccountId` 필수, `accountId`는 NULL
  - `type in (INCOME, EXPENSE)`: `accountId` 필수, `fromAccountId`/`toAccountId`는 NULL
- 잔액 계산(저장 금지, 계산으로만)
  - `currentBalance`는 저장하지 않고 계산한다.
  - 계산 예시: `openingBalance + sum(signedAmount)` (소프트 삭제 제외)
  - `signedAmount` 정의
    - `INCOME`: `+amount`
    - `EXPENSE`: `-amount`
    - `TRANSFER`: 보내는 계좌(from)는 `-amount`, 받는 계좌(to)는 `+amount`
- 통계 제외 플래그
  - `excludeFromReports=true`인 거래는 "지출 통계"에서 제외한다. (의미 있는 타입: `EXPENSE`)
    - 예: 월별 총지출, 카테고리별 지출 Top N, 고정비/변동비 집계
  - 단, 잔액 계산에는 포함한다. (실제 돈이 빠져나간 것은 사실이므로)
- 인박스(검토함)
  - `needsReview=true`인 거래는 인박스에 모아 일괄 검토/분류한다.
  - `categoryId`가 NULL인 경우 기본적으로 `needsReview=true`로 간주한다.
  - 권장 기본값: 수동 입력은 `needsReview=false`, CSV/자동 분류는 불확실하면 `needsReview=true`

1. Account 필드(최소)
- 이름
- 타입(MVP): `CHECKING` | `SAVINGS` | `CASH` | `INVESTMENT`
- 활성화 여부: `isActive` (사용 안 하는 계좌 숨김)
- 정렬: `orderIndex` (선택)
- 초기 잔액: `openingBalance` (선택)
- 현재 잔액 저장 금지(MVP): `currentBalance`는 저장하지 않고 계산한다.
  - 이유: 과거 거래 수정/삭제, CSV 대량 입력, 재시도/롤백 시 잔액 정합성이 쉽게 깨짐
  - 계산 예시: `openingBalance + sum(signedAmount)` (소프트 삭제 제외)
  - 성능이 필요해지면 추후 캐시/스냅샷/뷰로 최적화

2. Transaction 필드
- 날짜(`LocalDate`, 권장 필드명: `txDate`)
- 금액(정수 KRW, 항상 양수)
- 타입: `INCOME` | `EXPENSE` | `TRANSFER`
- 계좌(수입/지출일 때): `accountId`
- 계좌(이체일 때): `fromAccountId`, `toAccountId` (이체는 1건으로 저장)
- 설명(가맹점/메모)
- 카테고리: `categoryId` (MVP에서는 NULL 허용, 미분류는 인박스로 보낸다)
- 태그(MVP 권장): `tagNames: string[]` 형태의 "자유 텍스트 태그"를 허용한다.
  - 목적: 빠른 필터링/검색(예: `#데이트`, `#출장`)
  - 저장 방식(MVP 고정): `transaction_tags(transaction_id, tag_name)` 조인 테이블
  - 추후 확장: 태그 표준화/추천/자동 태깅이 필요해지면 정규화한다.
- 원본: `source` (`MANUAL` | `CSV`, 서버가 설정)
- 인박스 플래그: `needsReview` (기본값 false)
- 통계 제외 플래그: `excludeFromReports` (기본값 false)
- 삭제 여부(`deletedAt`)

  필수 도메인 제약(규칙)
  - 금액은 항상 양수: `amount > 0`
  - `TRANSFER`는 `fromAccountId`/`toAccountId`가 모두 있어야 한다.
  - `TRANSFER`는 `fromAccountId != toAccountId`
  - `INCOME`/`EXPENSE`는 `accountId`가 있어야 하고, `fromAccountId`/`toAccountId`는 없어야 한다.
  - `type`이 진실이다: `toAccountId` 존재 여부로 타입을 추론하지 않는다.

3. 카테고리 구조
- MVP 고정: 2단계(대/소)
  - DB는 `parentId` 트리 구조를 유지하되, MVP에서는 깊이 1(루트 + 자식)까지만 허용한다.
  - 카테고리는 `TRANSFER`에도 설정 가능하되, "현금흐름"이 아니라 "자금 이동" 분류 용도로만 쓴다.

  MVP 기본 카테고리(예시)
  - 수입: 급여, 부수입, 이자, 기타
  - 지출(고정비): 주거/통신, 보험, 구독료
  - 지출(변동비): 식비, 교통, 카페/간식, 쇼핑, 의료/건강, 경조사
  - 이체(자금이동): 저축/적금, 투자이동, 현금이동
    - 주의: 이체 카테고리는 현금흐름(총수입/총지출)에 포함하지 않고, "자금 이동"에서만 표시/집계

4. 리포트 기준(정의)
- 월별 기본
- 계좌별/카테고리별 집계 포함
- 총수입: `INCOME` 합(소프트 삭제 제외)
- 총지출: `EXPENSE` 합(소프트 삭제 + `excludeFromReports=true` 제외)
- 순저축: `총수입-총지출` (`TRANSFER`는 포함하지 않음)
- 이체: `TRANSFER` 합은 별도 지표로 표시(수입/지출에 섞지 않음)
- 투자이동(선택): `* -> INVESTMENT` 이체 합(회수는 `INVESTMENT -> *` 합)
- 잔액 추이: 계좌 단위로는 이체 포함(입금/출금 + 이체 in/out 모두 반영)

  A. 도메인 결정 체크리스트(구현 전 점검)
  - `INCOME/EXPENSE/TRANSFER` 3분류 + `amount > 0` 확정
  - 저장 날짜는 `LocalDate` + CSV 파싱 타임존 명시
  - 소프트 삭제(`deletedAt`) 기본 필터 적용
  - TRANSFER는 현금흐름에서 제외, 잔액/추이에는 포함
  - 거래 필드 상호배타 규칙(type별 accountId/from/to) 강제
  - `excludeFromReports`는 지출 통계에서만 제외(잔액에는 포함)
  - `needsReview`로 인박스 관리(미분류/불확실 자동분류 처리)

---

## 6. 1인 프로젝트 안전장치 (필수 권장)

### A. 이체(Transfer) 개념 초기 도입
- 거래 타입을 수입/지출/이체 3개로 고정
- 이체는 수입/지출 합계에서 제외해 현금흐름 왜곡 방지
- 계좌 잔액 추이 정확도 확보

### B. 백업/복원 1버전 포함
- JSON 내보내기/가져오기 (버전 정보 포함)
- 이유: 데이터 유실 방지, 구조 변경 시 마이그레이션 용이

### C. 삭제 정책은 소프트 삭제
- 하드 삭제 대신 `deletedAt` 사용
- 리포트 정합성 및 복구 가능성 확보

### D. 돈/날짜 기준 문서화
- 금액: 정수(원 단위) 저장
- 날짜: `LocalDate` 사용
- 통화: 초기 버전 KRW 단일 통화

---

## 7. 권장 초기 구현 우선순위 (실행 체크리스트)
- 거래 CRUD + 복수 계좌
- CSV 업로드(매핑/중복 제거)
- 카테고리/태그 + 기본 규칙
- 월별/카테고리 리포트
- JSON 백업/복원
- 소프트 삭제 + 이체 처리

이 6개가 완성되면 MVP 목표인 “정리, 검색, 분류, 리포트”를 충족할 수 있습니다.

---

## 8. MVP API 계약 (프론트-백 기준선)
코드 작성 전에 "계약"을 먼저 고정해서 프론트/백이 어긋나지 않게 한다.

### 8.1 Base 규칙
- Base Path: `/api/v1`
- Content-Type: 기본 `application/json`
  - 단, 파일 업로드/다운로드 API는 예외(아래 Imports/Backups 참고)
- Money: `amount`는 KRW 원 단위 정수(`long`), 항상 양수
- Date: `txDate`는 `"YYYY-MM-DD"` 문자열(`LocalDate`)
- Soft delete: `deletedAt != null`은 기본 조회/리포트에서 제외
- 인증: 기본적으로 모든 API는 인증 필요(세션 쿠키 기반)
  - 예외: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`

### 8.2 에러 규약(통일)
- 422: Validation 실패(필수값 누락/형식 오류/상호배타 규칙 위반 포함)
- 409: 도메인 충돌(예: `fromAccountId == toAccountId`)
- 404: 없는 리소스
- 401: 인증 필요/인증 실패(세션 없음, 세션 만료, 로그인 실패 등)

에러 응답(JSON)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "txDate is required",
    "fieldErrors": [
      { "field": "txDate", "reason": "required" }
    ]
  }
}
```

### 8.3 목록 API 규칙(쿼리/응답)
- 날짜 범위: `from <= txDate < to` (inclusive start + exclusive end)
  - 예: 2026-02 전체: `from=2026-02-01`, `to=2026-03-01`
- 공통 쿼리 파라미터(거래 목록 기준)
  - 기간: `from`, `to`
  - 필터: `accountId`, `type`, `categoryId`, `needsReview`
    - `accountId` 의미(중요): "해당 계좌가 관여된 거래"
      - `INCOME/EXPENSE`: `accountId == :accountId`
      - `TRANSFER`: `fromAccountId == :accountId` 또는 `toAccountId == :accountId`
  - 검색: `q` (description 단순 검색)
  - 정렬: `sort=txDate,desc`
  - 페이지: `page`, `size`

예)
```
GET /api/v1/transactions?from=2026-02-01&to=2026-03-01&type=EXPENSE&needsReview=true&page=0&size=50&sort=txDate,desc&q=스타벅스
```

페이지 응답(JSON)
```json
{
  "items": [],
  "page": 0,
  "size": 50,
  "totalElements": 0
}
```

### 8.4 Accounts
- `GET /api/v1/accounts` (200)
- `POST /api/v1/accounts` (201)
- `PATCH /api/v1/accounts/{id}` (200)
- (MVP) 계좌 삭제 API는 두지 않는다. 계좌는 `isActive=false`로 보관(archive)한다.

계좌 삭제/보관 정책(MVP 권장)
- 계좌는 "삭제"보다 `isActive=false`로 보관(archive)하는 방식을 우선한다.
- 계좌 삭제가 필요해지면(Later):
  - 계좌에 연결된 거래가 1건 이상이면 `409`로 거부(데이터 정합성/리포트 일관성 보호)
  - 거래가 0건인 계좌만 삭제 허용

계좌 생성 요청(JSON)
```json
{
  "name": "국민 주거래",
  "type": "CHECKING",
  "isActive": true,
  "orderIndex": 10,
  "openingBalance": 1000000
}
```

계좌 응답(JSON, 예시)
```json
{
  "id": 1,
  "name": "국민 주거래",
  "type": "CHECKING",
  "isActive": true,
  "orderIndex": 10,
  "openingBalance": 1000000,
  "currentBalance": 850000
}
```

주의사항(MVP)
- `currentBalance`는 파생값(계산 결과)이며, 요청 바디로 받지 않는다.
- `currentBalance`를 응답에 포함할지 여부는 성능/캐싱 전략에 따라 조정 가능(미포함이어도 프론트는 동작해야 함).

### 8.5 Transactions
- `GET /api/v1/transactions` (200, 페이지 응답)
- `GET /api/v1/transactions/{id}` (200)
- `POST /api/v1/transactions` (201)
- `PATCH /api/v1/transactions/{id}` (200)
- `DELETE /api/v1/transactions/{id}` (204, 소프트삭제)

PATCH 정책(MVP)
- `type` 변경 불가(변경이 필요하면 삭제 후 재생성)
  - 이유: 부분 수정에서 상호배타 필드(accountId vs from/to) 누락으로 정합성 오류가 자주 발생

필수 제약(요약)
- `amount > 0`
- `type=TRANSFER`: `fromAccountId`/`toAccountId` 필수, `accountId`는 NULL
- `type in (INCOME, EXPENSE)`: `accountId` 필수, `fromAccountId`/`toAccountId`는 NULL
- `fromAccountId != toAccountId`
- user scope(필수)
  - `accountId`/`fromAccountId`/`toAccountId`는 모두 "내 user_id 소유"여야 한다.
  - 소유가 아니면 MVP 권장: `404` (리소스 존재 여부를 노출하지 않기 위함)
- `needsReview`
  - `categoryId == null`이면 서버는 `needsReview=true`로 저장(요청값이 false여도 보정)
- `excludeFromReports`
  - 의미 있는 타입: `EXPENSE`
  - `type != EXPENSE`면 서버는 `excludeFromReports=false`로 저장(요청값 무시)
- `source`(서버 관리 필드)
  - 수동 API 생성은 `MANUAL`로 저장
  - CSV import 생성은 `CSV`로 저장

거래 생성 요청(EXPENSE) 예시(JSON)
```json
{
  "txDate": "2026-02-15",
  "type": "EXPENSE",
  "amount": 12500,
  "accountId": 1,
  "description": "스타벅스",
  "categoryId": 10,
  "tagNames": ["데이트"],
  "needsReview": false,
  "excludeFromReports": false
}
```

거래 생성 요청(TRANSFER) 예시(JSON)
```json
{
  "txDate": "2026-02-15",
  "type": "TRANSFER",
  "amount": 300000,
  "fromAccountId": 1,
  "toAccountId": 2,
  "description": "주식계좌로 이동",
  "categoryId": 30,
  "tagNames": [],
  "needsReview": false
}
```

거래 응답 예시(JSON)
```json
{
  "id": 101,
  "txDate": "2026-02-15",
  "type": "EXPENSE",
  "amount": 12500,
  "accountId": 1,
  "fromAccountId": null,
  "toAccountId": null,
  "description": "스타벅스",
  "categoryId": 10,
  "tagNames": ["데이트"],
  "needsReview": false,
  "source": "MANUAL",
  "excludeFromReports": false,
  "deletedAt": null
}
```

거래 단건 조회 응답(JSON, 예시)
```json
{
  "id": 102,
  "txDate": "2026-02-15",
  "type": "TRANSFER",
  "amount": 300000,
  "accountId": null,
  "fromAccountId": 1,
  "toAccountId": 2,
  "description": "주식계좌로 이동",
  "categoryId": 30,
  "tagNames": [],
  "needsReview": false,
  "source": "MANUAL",
  "excludeFromReports": false,
  "deletedAt": null
}
```

### 8.6 Reports
- `GET /api/v1/reports/summary?from=...&to=...` (200)
  - 총수입: `INCOME` 합(소프트 삭제 제외)
  - 총지출: `EXPENSE` 합(소프트 삭제 + `excludeFromReports=true` 제외)
  - 순저축: `총수입-총지출` (`TRANSFER` 제외)
- `GET /api/v1/reports/transfers?from=...&to=...` (200)
  - `TRANSFER` 전용(현금흐름과 분리)

리포트 주의사항
- 대시보드/리포트의 "지출" 값은 `excludeFromReports=true`가 제외된 값이다. (Top N, 고정/변동비도 동일)
  - 즉, 지출 관련 집계(예: totalExpense, category Top N, fixed/variable)에서 `excludeFromReports=true`는 항상 제외 규칙을 적용한다.

요약 리포트 응답 예시(JSON)
```json
{
  "from": "2026-02-01",
  "to": "2026-03-01",
  "totalIncome": 5000000,
  "totalExpense": 2500000,
  "netSaving": 2500000
}
```

이체 리포트 응답 예시(계좌쌍별 집계, MVP 고정 추천)
```json
{
  "from": "2026-02-01",
  "to": "2026-03-01",
  "items": [
    { "fromAccountId": 1, "toAccountId": 2, "amount": 900000 }
  ]
}
```

### 8.7 Imports (CSV)
- `POST /api/v1/imports/csv` (201)
  - Content-Type: `multipart/form-data`
  - form-data
    - `file`: CSV 파일 (필수)
    - `mapping`: JSON 문자열 (필수, 컬럼 매핑/고정값/계좌명 매핑 포함)
  - 서버 동작(MVP 고정)
    - 파싱 -> 검증 -> 중복 판단(skip) -> 저장을 한 트랜잭션으로 실행
    - 에러 행이 1건이라도 있으면 422 + 전체 롤백(부분 성공 금지)
    - warning 행은 저장 가능, 필요 시 `needsReview=true`로 보정

요청 예시(form-data의 `mapping` JSON)
```json
{
  "txDate": "date",
  "amount": "amount",
  "description": "description",
  "accountName": "account",
  "type": "type",
  "accountNameMap": {
    "국민": 1,
    "카카오": 2
  }
}
```

응답 예시(JSON)
```json
{
  "createdCount": 120,
  "skippedCount": 5,
  "warningCount": 2,
  "errorCount": 0,
  "warnings": [
    { "row": 31, "code": "SIGN_TYPE_MISMATCH", "message": "type과 부호가 달라 needsReview=true로 저장됨" }
  ]
}
```

### 8.8 Backups
- `GET /api/v1/backups/export` (200)
  - Content-Type: `application/json`
  - (선택) 다운로드로 제공 시 `Content-Disposition: attachment`
- `POST /api/v1/backups/import` (200 또는 201)
  - Content-Type: `multipart/form-data` (`file=json`)
  - 동작 모드(MVP 고정): 현재 로그인 사용자 데이터 `replace-all` 복원(원자적 처리)
    - 검증 실패 시 전체 롤백
    - import는 파일 내 `userId`를 신뢰하지 않고 현재 로그인 사용자 컨텍스트를 사용

Backup v1 JSON 포맷(고정)
```json
{
  "version": "backup.v1",
  "exportedAt": "2026-02-16T09:30:00Z",
  "currency": "KRW",
  "data": {
    "accounts": [
      { "id": 1, "name": "국민 주거래", "type": "CHECKING", "isActive": true, "orderIndex": 10, "openingBalance": 1000000 }
    ],
    "categories": [
      { "id": 1001, "type": "EXPENSE", "name": "반려동물", "parentId": null, "isActive": true, "orderIndex": 50 }
    ],
    "transactions": [
      { "id": 101, "txDate": "2026-02-15", "type": "EXPENSE", "amount": 12500, "accountId": 1, "fromAccountId": null, "toAccountId": null, "description": "스타벅스", "categoryId": null, "needsReview": true, "excludeFromReports": false, "source": "CSV", "deletedAt": null }
    ],
    "transactionTags": [
      { "transactionId": 101, "tagName": "데이트" }
    ]
  }
}
```

Backup v1 import 검증(고정)
- `version != "backup.v1"`면 422
- `currency != "KRW"`면 422
- 참조 무결성(accounts/categories/transactions/tags) 불일치면 422
- 복원 성공 시 현재 사용자의 기존 데이터는 교체되고, 이후 새 데이터로 일관된 상태를 보장한다.
- MVP 호환 범위: 동일 앱 메이저 버전 + 동일 seed 정책을 기준으로 복원한다.
- ID 처리 정책(MVP 고정)
  - 파일의 `id`는 백업 파일 내부 참조용 키로만 사용한다.
  - import 시 DB PK는 새로 발급하고, 계좌/카테고리/거래/태그 참조는 서버가 내부 매핑으로 재연결한다.

### 8.9 Categories (MVP 최소)
- `GET /api/v1/categories` (200)
  - (선택) `type=EXPENSE|INCOME|TRANSFER`로 필터링 지원
  - 목적: 거래 입력 UI에서 카테고리 선택을 안정적으로 제공
- `POST /api/v1/categories` (201, 사용자 커스텀)
- `PATCH /api/v1/categories/{id}` (200, 사용자 커스텀)

카테고리 소유/권한(MVP)
- 시스템 기본 카테고리: `userId == null` (read-only)
- 사용자 커스텀 카테고리: `userId == me` (생성/수정 가능)

Create/Patch 계약(MVP)
- 필드
  - `type`: `INCOME|EXPENSE|TRANSFER` (필수)
  - `name`: string (필수)
  - `parentId`: number|null (선택)
  - `isActive`: boolean (선택, 기본 true)
  - `orderIndex`: number (선택)
- 제약
  - 시스템 기본 카테고리(`userId=null`)는 수정 불가(요청 시 404 또는 409, MVP 권장: 404)
  - `parentId`를 지정하면, parent는 (시스템 카테고리 또는 내 카테고리)만 허용
  - parent와 자식의 `type`은 동일해야 한다.
  - MVP 깊이 제한: 루트(`parentId=null`) 또는 1단 자식만 허용(손자 depth 금지)
  - 삭제 대신 `isActive=false`로 비활성화(MVP)
  - 이름 유니크(권장)
    - system 카테고리(`userId=null`): `(type, parentId, nameNormalized)` 기준 중복이면 409
    - user 카테고리(`userId=me`): `(userId, type, parentId, nameNormalized)` 기준 중복이면 409

POST 요청 예시(JSON)
```json
{
  "type": "EXPENSE",
  "name": "반려동물",
  "parentId": null,
  "isActive": true,
  "orderIndex": 50
}
```

PATCH 요청 예시(JSON)
```json
{
  "name": "반려동물(병원)",
  "isActive": true
}
```

에러 규칙(MVP)
- 422: 필수값/형식 오류
- 404: 권한 없음(타 유저/시스템 카테고리) 또는 리소스 없음
- 409: 유니크 충돌(동일 parent 아래 name 중복 등)

카테고리 응답 예시(JSON)
```json
{
  "items": [
    { "id": 10, "type": "EXPENSE", "name": "식비", "parentId": null },
    { "id": 11, "type": "EXPENSE", "name": "배달", "parentId": 10 },
    { "id": 30, "type": "TRANSFER", "name": "투자이동", "parentId": null }
  ]
}
```

---

## 9. MVP DB 스키마 제약(반드시 DB에서 강제)
MVP에서도 CSV/대량 입력/버그/수정 흐름이 들어오면 "불가능한 데이터"가 생기기 쉽다.
아래 제약은 앱 레벨 검증만으로는 불안정하므로 DB 제약으로 같이 고정한다.

### 9.1 transactions: 타입별 상호배타 + 금액/날짜 제약 (CHECK)
핵심 목표: `type`과 컬럼 조합이 꼬인 데이터를 DB에 저장하지 못하게 한다.

- `amount > 0`
- `tx_date` NOT NULL (`DATE`)
- `user_id` NOT NULL (계정 기반이면 필수)
- `type=TRANSFER`
  - `from_account_id`/`to_account_id` NOT NULL
  - `account_id` IS NULL
  - `from_account_id <> to_account_id`
- `type in (INCOME, EXPENSE)`
  - `account_id` NOT NULL
  - `from_account_id`/`to_account_id` IS NULL

Postgres CHECK 예시(요약)
```sql
-- amount > 0
CHECK (amount > 0)

-- type별 상호배타
CHECK (
  (type = 'TRANSFER' AND account_id IS NULL AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id <> to_account_id)
  OR
  (type IN ('INCOME','EXPENSE') AND account_id IS NOT NULL AND from_account_id IS NULL AND to_account_id IS NULL)
)
```

### 9.2 exclude_from_reports: EXPENSE에서만 true 허용 (CHECK)
정책: `excludeFromReports=true`는 "지출 통계"에서 제외하기 위한 플래그이며, 의미 있는 타입은 `EXPENSE`뿐이다.

- `exclude_from_reports` NOT NULL DEFAULT false
- `type != 'EXPENSE'`이면 `exclude_from_reports=false`만 허용

Postgres CHECK 예시
```sql
CHECK (type = 'EXPENSE' OR exclude_from_reports = false)
```

### 9.3 soft delete: 기본 조회/리포트 필터 + 인덱스 패턴
정책: 기본 조회/리포트는 항상 `deleted_at IS NULL`을 적용한다.

쿼리 패턴(고정)
- 기간 필터는 index-friendly 하게: `tx_date >= :from AND tx_date < :to`
- 기본 필터: `deleted_at IS NULL`

인덱스(최소 권장, Postgres)
- 리포트/기간 조회: `tx_date` 기준 부분 인덱스
- 계좌별 리스트: `account_id` + `tx_date` 부분 인덱스
- 이체 포함 "계좌 관여" 조회 최적화가 필요해지면(나중):
  - `from_account_id + tx_date` 인덱스와 `to_account_id + tx_date` 인덱스를 별도로 둔다.
  - 계정 기반이면 위 인덱스들 앞에 `user_id`를 붙여서 `(user_id, ...)` 형태로 잡는 것을 권장한다.

Postgres INDEX 예시(요약)
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_date_live
ON transactions (user_id, tx_date)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_account_date_live
ON transactions (user_id, account_id, tx_date)
WHERE deleted_at IS NULL AND type IN ('INCOME','EXPENSE');

-- 필요 시(TRANSFER 포함 accountId 필터 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_from_date_live
ON transactions (user_id, from_account_id, tx_date)
WHERE deleted_at IS NULL AND type = 'TRANSFER';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_to_date_live
ON transactions (user_id, to_account_id, tx_date)
WHERE deleted_at IS NULL AND type = 'TRANSFER';
```

MVP 복잡도 경고
- `CREATE INDEX CONCURRENTLY`는 운영에서 락을 줄이기 위한 옵션이다. MVP 로컬 개발/마이그레이션에서는 `CONCURRENTLY` 없이 시작해도 된다.
- Flyway는 기본적으로 마이그레이션을 트랜잭션으로 실행한다.
  - Postgres의 `CREATE INDEX CONCURRENTLY`는 트랜잭션 안에서 실행할 수 없으므로, 사용하려면 해당 마이그레이션을 "non-transactional"로 분리해야 한다.

### 9.4 (권장) FK/기본값: 참조 무결성과 안전한 기본값
MVP에서도 FK/기본값을 최소로 잡아두면 데이터가 더 안정적이다.

참조 무결성(FK, 권장)
- `accounts.user_id` -> `users.id`
- `transactions.user_id` -> `users.id`
- `transactions.account_id` -> `accounts.id` (INCOME/EXPENSE)
- `transactions.from_account_id`/`to_account_id` -> `accounts.id` (TRANSFER)
- `transactions.category_id` -> `categories.id` (NULL 허용)

기본값(권장)
- `needs_review` NOT NULL DEFAULT false
- `exclude_from_reports` NOT NULL DEFAULT false
- `source` NOT NULL DEFAULT 'MANUAL' (`MANUAL` | `CSV`)
- `deleted_at` DEFAULT NULL

추가 CHECK(선택, 안전장치)
- `category_id IS NULL`이면 `needs_review=true`만 허용
  - 장점: CSV/배치가 category를 비워도 인박스로 자동 유도
  - 단점: "미분류지만 검토 안 함" 같은 상태는 불가(대부분 필요 없음)

### 9.5 (고정) users/sessions/categories/tags: 최소 제약
계정 기반 MVP에서 테이블이 추가되면, 최소 제약을 같이 고정한다.

users(권장 최소)
- `email_normalized` UNIQUE (case-insensitive unique)
- `password_hash` NOT NULL
- `created_at` NOT NULL

sessions(고정)
- Spring Session JDBC 테이블(`spring_session`, `spring_session_attributes`)을 사용한다.
- 세션 테이블은 Flyway 마이그레이션으로 생성/관리한다. (예: `V2__spring_session_jdbc.sql`)
- 모든 프로필에서 `spring.session.jdbc.initialize-schema=never`로 고정한다.
- 세션 TTL을 설정한다(예: 14일).

categories(권장)
- `categories.user_id`는 NULL 가능(system) / NOT NULL(user custom)
- 유니크 인덱스 권장(Postgres, NULL 안전)
  - user 카테고리: `(user_id, type, COALESCE(parent_id, 0), name_normalized)` UNIQUE WHERE `user_id IS NOT NULL`
  - system 카테고리: `(type, COALESCE(parent_id, 0), name_normalized)` UNIQUE WHERE `user_id IS NULL`
  - 참고: Postgres UNIQUE는 NULL을 서로 다른 값으로 보므로, 단일 복합 UNIQUE만으로는 system 중복을 완전히 막기 어렵다.
- MVP 깊이 제한(루트/1단 자식)은 앱 레벨 검증으로 강제한다.
  - 재귀 CHECK는 DB에서 직접 강제하기 어렵기 때문에, Create/Patch 시 parent의 parent가 있으면 422로 거부한다.

transaction_tags(MVP 권장)
- `transaction_tags(transaction_id, tag_name)`
- UNIQUE 권장: `(transaction_id, tag_name)` (중복 태그 방지)

---

## 10. 리포트 정의서(1장): 지표가 곧 제품
리포트 숫자의 "의미"를 프론트/백/DB/테스트에서 동일하게 만들기 위해, 아래 정의를 계약으로 고정한다.
이 정의서가 바뀌면 제품이 바뀐 것으로 간주한다.

### 10.1 공통 규칙(모든 리포트/카드에 적용)
- 기간 필터: `from <= txDate < to` (inclusive start + exclusive end)
- 소프트 삭제 제외: `deletedAt IS NULL`만 집계
- 금액: `amount`는 항상 양수 KRW 정수이며, 부호는 `type`과 맥락(계좌 in/out)으로 해석
- `TRANSFER`는 현금흐름(총수입/총지출/순저축) 집계에서 제외하고, "자금이동" 섹션에서만 집계
- `excludeFromReports=true`는 지출 통계에서 제외하지만, 잔액/추이 계산에는 포함한다.

### 10.2 대시보드 카드 정의(정의/포함/제외)
| 카드 | 정의(수식) | 포함(필터) | 제외(필터) | 비고 |
| --- | --- | --- | --- | --- |
| 총수입 `totalIncome` | `sum(amount)` | `type=INCOME` | `TRANSFER`, `deletedAt!=null` | `excludeFromReports`는 INCOME에서 의미 없음 |
| 총지출 `totalExpense` | `sum(amount)` | `type=EXPENSE` AND `excludeFromReports=false` | `TRANSFER`, `excludeFromReports=true`, `deletedAt!=null` | "지출 통계"의 기준값 |
| 순저축 `netSaving` | `totalIncome - totalExpense` | 위 두 카드 정의 사용 | `TRANSFER` | 내부이동으로 왜곡되지 않게 고정 |
| 자금이동 `transferVolume` | `sum(amount)` | `type=TRANSFER` | `deletedAt!=null` | 현금흐름과 분리된 "이동 규모" |
| 인박스 `inboxCount` | `count(*)` | `needsReview=true` | `deletedAt!=null` | 분류/검토가 필요한 건수 |

선택 카드(나중에 필요하면 추가)
- 투자 유입 `investmentInflow`: `type=TRANSFER` AND `toAccount.type=INVESTMENT` 합
- 투자 회수 `investmentOutflow`: `type=TRANSFER` AND `fromAccount.type=INVESTMENT` 합

### 10.3 카테고리 리포트(지출 Top N) 정의
카테고리별 지출은 "분류가 끝난 지출"만 집계한다.

- 집계 대상: `type=EXPENSE` AND `excludeFromReports=false` AND `categoryId IS NOT NULL` AND `needsReview=false` AND `deletedAt IS NULL`
- 정렬: `sum(amount)` 내림차순
- 미분류 지출: `categoryId IS NULL` 또는 `needsReview=true`는 별도 카드/배지로만 표시(Top N에는 포함하지 않음)

### 10.4 자금이동(TRANSFER) 리포트: MVP 집계 단위 확정
MVP에서는 "계좌쌍별 집계"로 고정한다. (카테고리별은 보조 필터/라벨)

- 집계 단위: `(fromAccountId, toAccountId)` 별 `sum(amount)`
- 포함: `type=TRANSFER` AND `deletedAt IS NULL`
- 표시 추천: from/to 계좌 이름 + 계좌 타입 + 합계 금액
- 카테고리 사용
  - `categoryId`는 TRANSFER에도 설정 가능
  - 단, 현금흐름/지출 통계에는 절대 포함하지 않는다.

API 응답 형태(권장)
```json
{
  "from": "2026-02-01",
  "to": "2026-03-01",
  "items": [
    { "fromAccountId": 1, "toAccountId": 2, "amount": 900000 }
  ]
}
```

### 10.5 리포트 정합성 체크(개발/테스트용)
아래 케이스는 자동 테스트로 고정한다.

1) `CHECKING -> INVESTMENT`로 300,000 TRANSFER
- `totalExpense` 변화 없음
- `transferVolume`은 +300,000

2) EXPENSE 12,500 + `excludeFromReports=true`
- `totalExpense`에는 포함되지 않음
- 계좌 잔액 계산에는 포함(실제 돈은 나감)

---

## 11. CSV Import 규칙(MVP): 파싱/매핑/중복/상태
CSV는 포맷이 제각각이라 초기에 가장 자주 터진다. MVP에서도 아래 규칙은 문서로 고정한다.

실행 모델(MVP 고정)
- API는 `POST /api/v1/imports/csv` 1-shot 방식으로만 제공한다.
- 요청 한 번에서 파싱/검증/중복처리/저장을 끝내며, 에러가 있으면 전체 롤백한다(원자적 import).

### 11.1 지원 범위(MVP)
- 기본 지원: `INCOME`/`EXPENSE` 가져오기
- `TRANSFER` 가져오기(선택): from/to 계좌를 확실히 매핑할 수 있을 때만 지원
  - from/to 정보가 모호하면 TRANSFER는 수동 입력으로 처리(지출 왜곡 방지 우선)

### 11.2 컬럼 매핑 표준(필수/옵션)
CSV 한 행을 Transaction으로 만들기 위한 최소 요건을 고정한다.

필수(최소)
- `txDate` (최종 저장은 `LocalDate`)
- `amount` (KRW 정수)
- `description` (없으면 빈 문자열로 보정)
- 계좌 매핑
  - `INCOME/EXPENSE`: `accountId`를 결정할 수 있어야 한다.
  - `TRANSFER`(지원 시): `fromAccountId`/`toAccountId`를 결정할 수 있어야 한다.

계좌 매핑 정책(MVP 권장)
- CSV에 계좌명이 포함된 경우, 요청의 `mapping`에서 "계좌명 -> accountId" 매핑을 전달해야 한다.
- 매핑되지 않은 계좌명이 남아 있으면 import를 422로 거부한다(원자적 import).
- 자동으로 계좌를 생성하는 기능은 MVP에서 보류(의도치 않은 계좌 난립 방지).
- 권장 필드명: `mapping.accountNameMap` (예: `{ "국민": 1 }`)

옵션
- `type` (없으면 금액 부호 등으로 추론)
- `categoryId` (없으면 인박스)
- `tagNames` (없으면 빈 배열)
- `excludeFromReports` (없으면 false)

### 11.3 날짜 파싱 규칙(LocalDate)
- 저장은 `LocalDate` 고정
- CSV에 시간이 있어도 최종 저장은 날짜만 사용한다.
- 파싱 타임존은 기본 `Asia/Seoul`로 고정한다.
- 실패한 날짜는 import에서 에러로 처리한다. (MVP: 전체 import 거부, 부분 성공 금지)

CSV 파일 기본 가정(MVP)
- 인코딩: UTF-8 (BOM 허용)
- 구분자: `,` (comma)
- 헤더 1행을 기본으로 가정(헤더가 없으면 수동 매핑 모드로 처리)

### 11.4 금액 파싱 규칙(KRW 정수)
허용 입력(예)
- `12500`, `12,500`, `12,500원`, `₩12,500`

입출금 분리 컬럼(자주 나오는 케이스)
- CSV가 `withdrawalAmount`/`depositAmount`처럼 "출금/입금" 컬럼을 따로 제공하면:
  - 둘 중 값이 있는 쪽을 `amount`로 사용하고 `type`을 결정한다.
  - 둘 다 값이 있거나 둘 다 비어 있으면 해당 행은 에러 처리한다.

부호 처리(중요)
- DB에는 `amount > 0`만 저장한다.
- CSV 금액에 `-12500` 또는 `(12500)` 형태가 오면 절대값으로 파싱한다.
- `type`이 없으면 부호로 타입을 추론한다.
  - 음수 표기 -> `EXPENSE`
  - 양수 표기 -> `INCOME`
- `type`이 있는데 부호가 반대면:
  - MVP 권장: 경고(warning)로 표시하고 `needsReview=true`로 저장(조용한 데이터 변형 방지)

### 11.5 타입 결정 규칙
- CSV에 `type` 컬럼이 있으면 그 값을 우선한다.
- 없으면 금액 부호/컬럼 조합으로 추론한다.
- `TRANSFER`는 반드시 from/to가 명확할 때만 생성한다.

### 11.6 중복 판단 키 + 정책(MVP)
중복은 "같은 CSV를 여러 번 import"할 때 반드시 발생한다.

중복 판단 키(추천, 보수적)
- `txDate + type + amount + accountKey + descriptionNormalized`
- `accountKey`
  - `INCOME/EXPENSE`: `accountId`
  - `TRANSFER`: `(fromAccountId,toAccountId)`
- `descriptionNormalized` 최소 규칙
  - trim
  - 연속 공백 1개로 축약
  - 영문은 소문자화(한글은 그대로)

중복 처리 정책(MVP 권장)
- 기본: `skip` (이미 있으면 새 행은 건너뜀)
- `merge`는 MVP에서 금지(조용히 데이터가 바뀌는 사고를 막기 위해)
- 중복 판단은 기본적으로 `deletedAt IS NULL`(살아있는 거래) 기준으로만 수행한다.
  - 이미 소프트삭제된 거래는 재-import로 다시 들어올 수 있다(사용자 복구 시나리오).

### 11.7 import 후 상태/플래그 보정
- `categoryId == null`이면 서버는 `needsReview=true`로 저장(요청값이 false여도 보정)
- `excludeFromReports`는 `EXPENSE`에서만 의미 있음
  - `type != EXPENSE`면 서버는 `excludeFromReports=false`로 저장(요청값 무시)

### 11.8 Import 결과 요약(프론트 표시용)
import 결과에는 아래를 포함한다.
- createdCount
- skippedCount(duplicates)
- warningCount + 대표 warning 샘플
- errorCount + 대표 error 샘플(있으면)

MVP 실행 규칙(고정)
- `errorCount > 0`이면 import는 422로 거부되고 아무것도 저장하지 않는다.
- warning은 저장을 막지 않지만, 해당 행은 `needsReview=true`로 저장될 수 있다.

---

## 12. 태그 정책(MVP): 자유 텍스트 배열로 시작
태그는 제품 핵심(흐름/리포트)보다 구현 복잡도가 커지기 쉬워서, MVP에서는 단순하게 고정한다.

### 12.1 결론(MVP)
- API는 `tagNames: string[]` (자유 텍스트 배열)로 고정한다.
- DB 저장 모델(MVP 권장): `transaction_tags` 조인 테이블로 저장한다.
  - 예: `transaction_tags(transaction_id, tag_name)`
  - 유니크 권장: `(transaction_id, tag_name)`
  - 이유: Spring/JPA에서 배열 타입(`text[]`) 매핑이 까다로울 수 있어, MVP 구현 난이도를 낮춘다.
  - 태그 표준화/자동완성/추천이 필요해지면 `tags` 테이블로 정규화한다(Later).

### 12.2 입력/저장 규칙
- UI에서 `#`는 입력 편의용일 뿐, 저장에는 포함하지 않는다.
  - 예: `#데이트` 입력 -> `"데이트"` 저장
- 저장 전 최소 정규화
  - trim
  - 빈 문자열 제거
  - 중복 제거(대소문자 차이 포함)
- 거래당 태그 개수 제한(예: 10개) 권장
- 태그 길이 제한(예: 1~30자) 권장

### 12.3 검색/필터에서의 위치(MVP)
- 1순위는 계좌/기간/타입/카테고리/인박스(needsReview)
- 태그는 보조 필터로 제공(없어도 MVP 성립)

---

## 13. 멀티유저/인증(계정) 설계: MVP에서 미리 고정할 것
계정을 붙일 계획이면 "누구 데이터인가"가 스키마/API 전반에 퍼지므로, MVP 단계에서 최소한의 결정을 고정한다.

### 13.1 결론(MVP 권장)
- 데이터 소유 모델: `user_id` 기반 단일 사용자 영역(1 user = 1 데이터 영역)
  - 모든 사용자 데이터 테이블은 `user_id`(FK)를 가진다.
  - API는 요청에서 `userId`를 받지 않고, 인증된 사용자 컨텍스트로만 동작한다.
- 인증 방식: 세션 쿠키 기반(auth + httpOnly cookie)
  - 이유: 웹/PWA에서 구현/운영 단순, 토큰 저장/갱신 이슈 감소

### 13.2 테이블/컬럼 원칙(MVP)
필수로 `user_id`를 포함(권장)
- `accounts.user_id` (NOT NULL)
- `transactions.user_id` (NOT NULL)
- `backups.user_id` 또는 export/import 시 사용자 컨텍스트로만 동작(유저별 백업)

카테고리 소유 모델(권장)
- 시스템 기본 카테고리(공용) + 사용자 커스텀 카테고리(개별)
  - `categories.user_id`는 NULL 가능
    - NULL: 시스템 기본 카테고리
    - NOT NULL: 사용자 커스텀 카테고리
  - 장점: 초기에 표준 카테고리를 제공하면서도 개인화 확장 가능

### 13.3 사용자/인증 API 계약(MVP 최소)
아래는 "있어야만" 계정 기반으로 개발이 진행된다.

- `POST /api/v1/auth/signup` (201)
- `POST /api/v1/auth/login` (200)
- `POST /api/v1/auth/logout` (204)
- `GET /api/v1/auth/me` (200)

Request/Response 예시(MVP)

signup 요청(JSON)
```json
{ "email": "me@example.com", "password": "********" }
```

login 요청(JSON)
```json
{ "email": "me@example.com", "password": "********" }
```

me 응답(JSON)
```json
{ "id": 1, "email": "me@example.com" }
```

인증 실패
- `POST /api/v1/auth/login`: 401
- 보호된 API 호출: 401

세션/쿠키 정책(권장)
- 로그인 성공 시 서버가 세션을 생성하고 쿠키를 설정한다.
- 쿠키는 `HttpOnly`로 설정한다(프론트 JS에서 토큰을 다루지 않도록).
- 쿠키 권장 설정: `Secure`(HTTPS), `SameSite=Lax`(또는 Strict), `Path=/`
- 로그아웃은 서버 세션을 무효화한다.

CSRF/CORS(최소 고려)
- 세션 쿠키 기반이면 CSRF 방어가 필요하다.
  - MVP 권장: same-site(동일 도메인)로 먼저 운영 + `SameSite` 쿠키 + Spring Security 기본 CSRF 정책을 따른다.
  - API만 분리 도메인으로 운영하면(CORS) CSRF/쿠키 정책을 더 엄격히 설계해야 한다.

### 13.4 권한/스코프 규칙(반드시 고정)
- 모든 조회/수정/삭제는 "내 user_id의 데이터만" 접근 가능
- `GET /transactions?accountId=...`는 해당 account가 내 소유가 아니면 404 (리소스 존재 여부를 노출하지 않기 위함)
- 리포트/백업도 user scope로만 계산/내보내기

### 13.5 ADR(Architecture Decision Record) 템플릿
아래 2개 ADR을 문서(또는 별도 파일)로 남긴다. 이유/대안/결정/영향만 짧게 적는다.

ADR-001: Authentication
- Context: 웹/PWA 기반, 계정 필요, MVP 빠른 구현
- Decision: 세션 쿠키 기반 인증
- Alternatives: JWT(access/refresh), OAuth-only
- Consequences: CSRF 대응 필요(동일 출처 기준이면 단순), 서버 세션 저장 필요

ADR-002: Data Ownership
- Context: 사용자별 데이터 분리 필요
- Decision: 주요 테이블에 `user_id` 필수 + categories는 (system + user custom) 혼합
- Alternatives: 전 테이블 tenant_id 도입, categories 전부 user 소유
- Consequences: 쿼리에 항상 user_id 필터, FK/인덱스에 user_id 포함 고려

### 13.6 users 스키마/해시 정책(MVP)
users 테이블은 아래 최소 스펙을 고정한다.

필수 컬럼(최소)
- `id` (PK)
- `email` (원문)
- `email_normalized` (lower-case, UNIQUE)
- `password_hash` (평문 저장 금지)
- `created_at`

비밀번호 해시
- Spring `DelegatingPasswordEncoder` 사용(예: bcrypt)
- 저장 형식: `{bcrypt}...` 같은 prefix 포함 형태 권장(알고리즘 마이그레이션 용이)

로그인 실패 규칙
- 자격증명 불일치(이메일/비밀번호 틀림): 401
- 형식 오류/필수값 누락: 422

### 13.7 세션 저장소(MVP)
세션 쿠키 기반이므로 서버가 세션 상태를 저장한다.

MVP 고정
- Spring Session JDBC + Postgres
- 세션 TTL 예: 14일
- 로그아웃: 세션 무효화
- 세션 스키마 생성 방식: Flyway 마이그레이션으로만 관리
  - `spring.session.jdbc.initialize-schema=never` (로컬/운영 공통)

### 13.8 배포 모델 + CSRF/CORS(MVP 고정)
MVP는 same-origin을 기준으로 한다.

same-origin 원칙
- Dev: 프론트 dev-server가 `/api`를 백엔드로 proxy 해서 브라우저 관점 same-origin 유지
- Prod: 백엔드가 프론트 정적 빌드를 서빙하거나(reverse proxy 포함), 동일 origin으로 운영

CSRF(세션 쿠키 기반)
- CSRF 토큰을 쿠키로 내려주고, 프론트는 헤더로 다시 보낸다.
  - 쿠키: `XSRF-TOKEN` (JS에서 읽을 수 있어야 하므로 HttpOnly 아님)
  - 헤더: `X-XSRF-TOKEN`

CORS
- MVP에서는 분리 도메인(CORS+credentials) 운영을 보류한다.
  - 분리 도메인으로 가면 쿠키/CSRF/CORS 설정이 크게 복잡해진다.

---

## 14. 구현 방식: Vertical Slice(세로 기능 단위로 끝내기)
레이어별(DB만/백만/프론트만)로 진행하지 말고, 사용자 기능 1개를 DB->API->UI->Tests까지 얇게 완결한다.

### 14.1 왜 필요한가
- 계약/API/도메인 규칙이 실제 UI에서 맞물리는지 빠르게 검증
- 리포트/이체/soft delete 같은 규칙은 레이어를 가로지르므로, slice로 해야 되돌아가는 비용이 줄어듦

### 14.2 Slice 템플릿(문서에 복붙해서 사용)
```text
Story:
- As a user, I want ..., so that ...

Scope:
- In: ...
- Out: ...

Deliverables:
- DB:
- API:
- UI:
- Tests:

Acceptance checks:
- ...

Edge case to cover:
- ...
```

### 14.3 Definition of Done(DoD, 고정)
- 로컬에서 end-to-end 동작(프론트->백->DB)
- 도메인 규칙 준수(`INCOME/EXPENSE/TRANSFER`, soft delete, amount>0, type 상호배타)
- user scope 준수(다른 user 데이터 접근 불가)
- 테스트 1개 이상(성공 1개 + 엣지 1개)
- 커밋에 남은 "blocking TODO" 없음

### 14.4 MVP 권장 Slice 순서(계정 포함)
1) Auth 기본 + user scope 뼈대
- DB: users, sessions(또는 spring session), user_id 컬럼 추가 방향 확정
- API: signup/login/me/logout
- UI: 로그인/로그아웃 + 보호된 페이지 가드
- Tests: 로그인 성공 + 인증 없이 접근 실패

2) Accounts CRUD (user scope)
- 계좌 생성/목록/수정 + isActive 보관
- Tests: 타 유저 계좌 접근 차단

3) Transactions CRUD (INCOME/EXPENSE) + list 규칙
- from/to 기간, 필터, 페이지, needsReview, excludeFromReports 규칙 적용
- Tests: excludeFromReports가 총지출에서 제외되는지(리포트 전 단계로 단위 테스트 가능)

4) TRANSFER 입력/조회 + 리포트에서 제외 확인
- Tests: TRANSFER가 totalExpense에 영향 없고 transferVolume에만 반영

5) Reports summary(정의서 기준) + transfers(계좌쌍별)

6) CSV Import(1-shot 고정) + dedupe(skip) + needsReview 보정

7) Backup export/import(v1 스키마 고정: version/exportedAt/currency/data)
