---
description: docs/openapi.yaml과 백엔드 구현의 드리프트를 전체 점검한다. PR 전 반드시 실행.
allowed-tools: Bash, Read, Grep
---

아래 3단계로 계약 드리프트를 점검한다:

**1단계: OpenAPI 유효성**
`bash scripts/contract/openapi_lint.sh` 실행

**2단계: 스펙 ↔ 구현 드리프트**
`bash scripts/contract/spec_impl_drift.sh` 실행

**3단계: 브레이킹 체인지 감지** (main 브랜치 대비)
`BASE_REF=main bash scripts/contract/openapi_breaking_check.sh` 실행

추가 분석: $ARGUMENTS 가 있으면 해당 엔드포인트/모듈에 집중해서 분석

결과 리포트:
- 각 게이트 PASS / FAIL
- 드리프트가 있는 경우 구체적 파일명과 수정 방향
- 전체 결론: READY FOR PR / NEEDS FIX
