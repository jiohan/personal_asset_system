# MCP Setup

이 프로젝트는 MCP 서버를 `npx`로 실행합니다.
`~/.npm/_npx/...` 경로는 캐시 경로라 매 실행마다 달라질 수 있으므로 고정 경로로 사용하지 않습니다.

## 1) 로컬 설정 파일 준비
`.codex/config.toml.example`를 기준으로 `.codex/config.toml`을 사용합니다.
MCP 실행 시 `.env.mcp`를 자동 로드하도록 설정되어 있습니다.

## 2) 필수 환경변수 설정
아래 3개 키를 `.env.mcp` 파일에 설정합니다.

```bash
cat > .env.mcp <<'EOF'
CONTEXT7_API_KEY="<your-context7-key>"
GITHUB_PERSONAL_ACCESS_TOKEN="<your-github-pat>"
TESTSPRITE_API_KEY="<your-testsprite-key>"
EOF
```

## 3) 사용되는 MCP 서버
- `@upstash/context7-mcp`
- `@modelcontextprotocol/server-sequential-thinking`
- `mcp-filesystem`
- `@modelcontextprotocol/server-github`
- `@testsprite/testsprite-mcp`
- Remote: `https://mcp.docs.dev/openapi/`

## 4) 보안 원칙
- 토큰은 `config.toml`에 하드코딩하지 않습니다.
- `.codex/config.toml`은 `.gitignore`로 제외합니다.
- `.env.mcp`는 `.gitignore`로 제외합니다.
- 키 노출 이력이 있으면 즉시 폐기/재발급하세요.

## 5) MCP 도구가 안 보일 때
- 이 저장소를 신뢰(trust)한 뒤 Codex 세션을 재시작하세요.
- 재시작 후 MCP 목록이 갱신됩니다. 현재 세션에서는 즉시 반영되지 않을 수 있습니다.
