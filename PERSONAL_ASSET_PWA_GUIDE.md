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
- CSV 업로드: 미리보기 -> 컬럼 매핑 -> 중복 제거 -> 가져오기
- 날짜 파싱 규칙: CSV에 시간이 있어도 최종 저장은 `LocalDate`(date-only). 타임존 변환 드리프트 방지용 기본 타임존을 명시(예: Asia/Seoul).

### 2단계: 분류 시스템 구축 (정리)
- 카테고리: 트리 구조(대/중/소) 또는 2단계
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
  - 저장 방식은 구현 시점에 결정(예: Postgres `text[]` 또는 별도 태그 테이블+매핑 테이블)
  - 추후 확장: 태그 표준화/추천/자동 태깅이 필요해지면 정규화한다.
- 원본(수동/CSV)
- 인박스 플래그: `needsReview` (기본값 false)
- 통계 제외 플래그: `excludeFromReports` (기본값 false)
- 삭제 여부(`deletedAt`)

  필수 도메인 제약(규칙)
  - 금액은 항상 양수: `amount > 0`
  - `TRANSFER`는 `fromAccountId`/`toAccountId`가 모두 있어야 한다.
  - `TRANSFER`는 `fromAccountId != toAccountId`
  - `INCOME`/`EXPENSE`는 `accountId`가 있어야 하고, `toAccountId`는 없어야 한다.
  - `type`이 진실이다: `toAccountId` 존재 여부로 타입을 추론하지 않는다.

3. 카테고리 구조
- 2단계(대/소) 또는 3단계 중 하나 선택
  - DB는 `parentId` 트리로 두고, MVP UI는 2단까지만 써도 된다.
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

### 8.2 에러 규약(통일)
- 422: Validation 실패(필수값 누락/형식 오류/상호배타 규칙 위반 포함)
- 409: 도메인 충돌(예: `fromAccountId == toAccountId`)
- 404: 없는 리소스

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
- `DELETE /api/v1/accounts/{id}` (204, 소프트삭제, 선택)

계좌 삭제/보관 정책(MVP 권장)
- 계좌는 "삭제"보다 `isActive=false`로 보관(archive)하는 방식을 우선한다.
- `DELETE`를 구현한다면 권장 정책:
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
- `needsReview`
  - `categoryId == null`이면 서버는 `needsReview=true`로 저장(요청값이 false여도 보정)
- `excludeFromReports`
  - 의미 있는 타입: `EXPENSE`
  - `type != EXPENSE`면 서버는 `excludeFromReports=false`로 저장(요청값 무시)

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
- `POST /api/v1/imports/csv/preview` (200)
  - Content-Type: `multipart/form-data` (`file=csv`)
  - 목적: 파싱/샘플/컬럼 확인 + 매핑 설정을 위한 미리보기
- `POST /api/v1/imports/csv/commit` (201)
  - Content-Type: `application/json`
  - 권장: preview가 발급한 `importSessionId`로 commit(재업로드/불일치 방지)

MVP 복잡도 경고
- `preview -> importSessionId -> commit` 흐름은 서버에 세션 저장/만료/재시도/중복 커밋 방지까지 필요해서 생각보다 손이 간다.
- 더 단순한 대안(MVP용): `POST /api/v1/imports/csv` 1회 호출로 `multipart/form-data(file=csv + mapping=json)`을 받아 바로 반영하고 요약을 반환한다.

preview 응답 예시(JSON)
```json
{
  "importSessionId": "imp_abc123",
  "detectedColumns": ["date", "amount", "description", "account"],
  "sampleRows": [
    { "date": "2026-02-01", "amount": "12,500", "description": "스타벅스", "account": "국민" }
  ],
  "warnings": []
}
```

commit 요청 예시(JSON)
```json
{
  "importSessionId": "imp_abc123",
  "mapping": {
    "txDate": "date",
    "amount": "amount",
    "description": "description",
    "accountName": "account"
  }
}
```

### 8.8 Backups
- `GET /api/v1/backups/export` (200)
  - Content-Type: `application/json`
  - (선택) 다운로드로 제공 시 `Content-Disposition: attachment`
- `POST /api/v1/backups/import` (200 또는 201)
  - Content-Type: `multipart/form-data` (`file=json`)

### 8.9 Categories (MVP 최소)
- `GET /api/v1/categories` (200)
  - (선택) `type=EXPENSE|INCOME|TRANSFER`로 필터링 지원
  - 목적: 거래 입력 UI에서 카테고리 선택을 안정적으로 제공

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
