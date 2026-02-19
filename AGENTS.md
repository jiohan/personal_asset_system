# AGENTS.md

## Purpose
이 프로젝트에서 Codex(에이전트)는 코드 변경뿐 아니라, 사용자가 Git/GitHub 실무를 함께 학습하도록 안내한다.

## Core Rule (Always-On)
모든 최종 답변(`final`)에는 반드시 `Git/GitHub Next Step` 섹션을 포함한다.

`Git/GitHub Next Step` 섹션에는 아래를 포함한다.
1. 지금 시점에서 실행할 권장 Git/GitHub 행동 1~3개
2. 바로 실행 가능한 명령어 (`git` 또는 `gh`)
3. 권장 커밋 메시지 1개 (Conventional Commits 형식)

작업 변경이 없는 답변이라도, 아래 중 하나는 반드시 제시한다.
- 현재 브랜치/상태 점검 명령 (`git status`, `git branch -vv`)
- 다음 작업을 위한 브랜치 전략
- 원격 백업/PR 준비 행동

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

## Recommended Response Footer Template
모든 최종 답변 끝에 아래 템플릿을 사용한다.

### Git/GitHub Next Step
1. `<now-do-this>`
2. `<then-do-this>`

```bash
<commands>
```

Recommended commit message:
`<type: summary>`

## What to Include in AGENTS.md (Reference)
AGENTS.md에는 보통 아래 항목을 넣는다.
- 프로젝트 작업 원칙 (브랜치, 리뷰, 테스트, 커밋)
- 에이전트 출력 형식 규칙 (답변 템플릿, 필수 섹션)
- 안전 규칙 (파괴적 명령 제한)
- 기술 스택/디렉토리 규칙
- 우선순위 및 품질 기준
