# AI MVP Operating Playbook

## Goal
1인 개발자가 Codex + OpenCode(Sisyphus)를 함께 사용해, 충돌 없이 MVP 수직 슬라이스를 빠르게 완성한다.

## Operating Principle
- One slice at a time
- One branch per slice
- One file owned by one agent at a time
- Contract-first + tests-first

## Roles
### Sisyphus (OpenCode)
- 대규모/멀티파일 구현
- 수직 슬라이스 진행(스키마, API, 테스트, 계약)
- 변경 범위 통제(allowed/out-of-scope)

### Codex
- 현재 파일/선택 영역 중심 정밀 수정
- 오류/예외/응답 형식 정리
- 최종 마감 리뷰 및 리스크 제거

## Daily Session Start (5 minutes)
```bash
make ai-check
```

If Node mismatch is shown:
```bash
nvm use 20
```

If runtime issue root cause is unclear:
```bash
make runtime-doctor
```

If Docker-dependent work is planned:
```bash
make preflight-docker
```

## Standard Slice Flow
1. OpenCode: `/slice-start <task>`
2. OpenCode: `/slice-build <task>`
3. OpenCode: `/contract-check <focus>`
4. OpenCode: `/handoff-codex <focus>`
5. Codex: handoff 파일만 정밀 수정
6. OpenCode: `/slice-done <task>`
7. PR 생성

## Contract Tracking Rule
- 계약 원본: `docs/openapi.yaml`
- 구현 진척 추적: `docs/CONTRACT_IMPLEMENTATION_STATUS.md`
- 슬라이스 종료 시 위 두 파일의 동기화 상태를 반드시 기록한다.

## Worktree Split (Recommended)
```bash
./scripts/worktree-start.sh feat/sliceX-impl fix/sliceX-polish
```

- `ams-sisyphus`: 구현 전용
- `ams-codex`: 마감/정리 전용

## Guardrails
- pre-push hook enforces gates by change scope.
- Backend/OpenAPI/infra changes:
  - `make test-backend`
  - `make contract-lint`
- Frontend changes:
  - `make test-frontend`

## Prompt Templates
프로젝트 로컬 템플릿:
- `.opencode/commands/test.md`
- `.opencode/commands/contract.md`
- `.opencode/commands/slice-done.md`

### OpenCode (large task)
```
슬라이스 작업: <task>
Allowed: <paths>
Out-of-scope: <paths>
Done criteria: <commands>
```

### Codex (precision task)
```
파일 <path1>[, <path2>]만 수정.
금지 파일: <paths>
검증 명령: <command>
```

## Success Metric
- PR마다 슬라이스가 독립적으로 merge 가능
- 계약(openapi)과 구현의 차이가 누적되지 않음
- pre-push/CI 실패 원인이 예측 가능하고 재현 가능함
