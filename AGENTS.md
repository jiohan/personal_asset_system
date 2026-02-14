# AGENTS.md

## Purpose
이 프로젝트에서 Codex(에이전트)는 코드 변경뿐 아니라, 사용자가 Git/GitHub 실무를 함께 학습하도록 안내한다.

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

## What to Include in AGENTS.md (Reference)
AGENTS.md에는 보통 아래 항목을 넣는다.
- 프로젝트 작업 원칙 (브랜치, 리뷰, 테스트, 커밋)
- 안전 규칙 (파괴적 명령 제한)
- 기술 스택/디렉토리 규칙
- 우선순위 및 품질 기준
