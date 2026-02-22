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

## 실행 방법(로컬)
- 로컬 프로필(`SPRING_PROFILES_ACTIVE=local`)에서는 Flyway가 `classpath:db/seed`를 추가로 포함한다.
- 로컬 DB에 초기 데이터가 필요하면 백엔드 기동 시 1회 적용된다.

관련 파일:
- `backend/src/main/resources/application-local.yml`
- `backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql`

주의:
- Docker Desktop WSL 통합이 꺼져 있으면 `infra/docker-compose.yml`로 DB를 띄울 수 없다.
- seed를 다시 적용하고 싶다면 DB 볼륨을 지우고 다시 띄우는 방식이 가장 단순하다.

## 리포트 검증 포인트
- CHECKING -> INVESTMENT 300000 TRANSFER는 totalExpense에 포함되지 않아야 한다.
- excludeFromReports=true EXPENSE는 totalExpense에서 제외되어야 한다.
