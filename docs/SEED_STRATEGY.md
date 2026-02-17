# Seed Strategy (MVP)

## 목적
개발/테스트 환경에서 리포트 정합성을 빠르게 검증할 수 있도록 최소 seed 데이터를 고정한다.

## 원칙
- 통화는 KRW 정수만 사용
- 날짜는 LocalDate(YYYY-MM-DD)
- TRANSFER는 현금흐름에서 제외
- seed는 "데모용"과 "테스트용"으로 분리

## 파일 구성
- `docs/seeds/categories.system.v1.json`
- `docs/seeds/accounts.sample.v1.json`
- `docs/seeds/transactions.sample.v1.json`

## 적용 순서
1. users 생성
2. categories seed 입력
3. accounts seed 입력
4. transactions seed 입력
5. 리포트 검증(totalExpense, transferVolume)

## 리포트 검증 포인트
- CHECKING -> INVESTMENT 300000 TRANSFER는 totalExpense에 포함되지 않아야 한다.
- excludeFromReports=true EXPENSE는 totalExpense에서 제외되어야 한다.
