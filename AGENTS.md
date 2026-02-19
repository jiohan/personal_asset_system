# AGENTS.md

## Purpose
이 프로젝트에서 Codex(에이전트)는 코드 변경뿐 아니라, 개발자가 일관된 운영 규칙(역할 분리/검증/PR)을 지키도록 돕는다.

## Agent Operating Model
- 기본 전략: `Sisyphus(큰 작업)` + `Codex(정밀 마감)`
- Sisyphus: 멀티파일/수직 슬라이스 구현(스키마 + API + 테스트 + 계약 반영)
- Codex: 현재 파일 중심 빠른 수정, 리뷰, 리스크 점검, 마무리 리팩터
- 같은 파일을 두 에이전트가 동시에 수정하지 않는다.

## Scope Ownership (Default)
### Sisyphus
- `backend/src/main/resources/db/migration/**`
- `backend/src/main/java/com/jioha/asset/domain/**`
- `backend/src/test/**`
- `docs/openapi.yaml`
- `infra/**`

### Codex
- `backend/src/main/java/com/jioha/asset/api/**`
- `backend/src/main/java/com/jioha/asset/config/**`
- `frontend/src/**`
- 현재 IDE에서 열어둔 파일/선택 영역 중심 수정

## Slice Hand-off Protocol
1. 작업 시작 전에 아래를 먼저 선언한다.
- 허용 경로(Allowed paths)
- 금지 경로(Out of scope)
- 완료 조건(통과해야 할 테스트/린트)
2. 작업 종료 시 아래를 함께 남긴다.
- 변경 파일 목록
- 실행한 검증 명령과 결과
- 리스크/후속 작업
3. 범위를 넘는 수정이 필요하면 새 슬라이스(새 브랜치/새 PR)로 분리한다.

## Quality Gates
- `backend/**`, `docs/openapi.yaml`, `backend/src/main/resources/db/migration/**` 변경 시:
  - `make test-backend`
  - `make contract-lint`
- `frontend/**` 변경 시:
  - `make test-frontend`
- 수직 슬라이스 완료 기준:
  - `make test-backend && make test-frontend && make contract-lint`

## Runtime Preflight
- 작업 시작 전 `make preflight` 실행
- MVP 고정 버전:
  - Node.js `20.x`
  - Java `21`
- DB/세션/마이그레이션 관련 작업은 Docker daemon 가용 상태를 먼저 확인한다.

## Git Workflow Standard
- 기본 브랜치: `main`
- 직접 작업 금지: `main`에서 기능 개발하지 않는다.
- 기능 개발: `feat/*`, 버그 수정: `fix/*`, 문서: `docs/*`, 유지보수: `chore/*`
- 1기능 1브랜치 원칙
- 작은 단위로 자주 커밋
- 기능 완료 후 PR 기반으로 `main` 병합

## Commit Convention
커밋 메시지는 Conventional Commits를 사용한다.

예시
- `feat: add transaction create/update/delete API`
- `fix: prevent duplicate imports in csv uploader`
- `docs: add project roadmap and architecture guide`

## Safety Rules
- 위험 명령은 사용자 명시 요청 없이는 금지: `git reset --hard`, `git push --force`
- 커밋 전 `git status` 확인
- 병합 전 `git pull --rebase origin main` 또는 최신 `main` 반영 확인
- 원격 세션/전원 보호:
  - 시스템 전원/세션 파괴 명령 금지: `shutdown`, `poweroff`, `reboot`, `halt`, `init 0/6`, `systemctl poweroff/reboot`, `wsl.exe --shutdown`, `Stop-Computer`, `Restart-Computer`
  - 프로세스 광역 강제 종료 금지: `pkill -9 -f`, `killall -9`, `kill -9 -1`
  - 원격접속/네트워크 인프라 변경 금지: 방화벽/라우팅/SSH/RDP/Guacamole/guacd 설정 변경(사용자 명시 요청 없으면 금지)
  - 광범위 Docker 정리 금지: `docker system prune -a --volumes`
  - `sudo` + 시스템 서비스 제어는 사용자 명시 요청이 있을 때만 허용

## What to Include in AGENTS.md (Reference)
AGENTS.md에는 보통 아래 항목을 넣는다.
- 프로젝트 작업 원칙 (브랜치, 리뷰, 테스트, 커밋)
- 에이전트 운영 규칙 (역할/범위/핸드오프)
- 안전 규칙 (파괴적 명령 제한)
- 기술 스택/디렉토리 규칙
- 우선순위 및 품질 기준
