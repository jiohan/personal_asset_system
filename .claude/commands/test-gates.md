---
description: 현재 변경 범위를 감지해서 필요한 테스트 게이트만 실행하고 결과를 요약한다
allowed-tools: Bash
---

git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD를 실행해서 변경된 파일 목록을 확인한 뒤:

**백엔드/OpenAPI/인프라 변경 감지 시** (backend/, docs/openapi.yaml, infra/ 포함):
1. `cd backend && ./mvnw test` 실행
2. `bash scripts/contract/openapi_lint.sh` 실행
3. `bash scripts/contract/spec_impl_drift.sh` 실행

**프론트엔드 변경 감지 시** (frontend/ 포함):
1. `cd frontend && npm run test -- --run` 실행

**둘 다 변경된 경우**: 위 두 블록 모두 실행

결과 요약 형식:
- 실행된 명령 목록
- 각 명령 PASS / FAIL
- 실패 시 첫 번째 실패 테스트와 에러 메시지
- 전체 결론: ALL PASS / FAILED
