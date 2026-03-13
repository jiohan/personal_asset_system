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
