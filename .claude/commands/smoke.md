---
description: 로컬 풀스택 스모크 테스트 실행. Docker Postgres, 백엔드, 프론트엔드 모두 실행 중이어야 함.
allowed-tools: Bash
---

`bash scripts/dev/smoke_local.sh --full` 을 실행하고 결과를 분석한다.

- DB 헬스체크 결과
- 백엔드 API 응답 상태
- 프론트엔드 프록시 상태
- 실패 시 어느 계층에서 실패했는지와 원인 추정
