---
description: 슬라이스 완료 검증: 모든 테스트 + 계약 게이트 실행, 변경 요약, PR 준비. 인수: 슬라이스 이름/번호
allowed-tools: Bash, Read
---

슬라이스: $ARGUMENTS 완료 검증을 진행한다.

**검증 실행**
1. `cd backend && ./mvnw test`
2. `cd frontend && npm run test -- --run`
3. `bash scripts/contract/openapi_lint.sh`
4. `bash scripts/contract/spec_impl_drift.sh`

**변경 요약** (`git diff main --name-only` 기반)
- backend/ 변경 파일 목록
- frontend/ 변경 파일 목록
- docs/ 변경 파일 목록 (openapi.yaml 포함 여부 명시)

**체크리스트**
- [ ] docs/MVP_TODO_LIST.md 해당 슬라이스 체크박스 완료 여부
- [ ] docs/CONTRACT_IMPLEMENTATION_STATUS.md 갱신 여부
- [ ] 새 엔드포인트 있을 경우 openapi.yaml 반영 여부

**PR 제안**
- 제목 (Conventional Commits 형식)
- 요약 (3줄 이내)
- 테스트 방법 체크리스트
