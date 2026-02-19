Run project quality gates for the current slice and summarize only actionable results.

Rules:
- Respect AGENTS.md scope ownership.
- If backend/openapi/infra changed: run `make test-backend` and `make contract-lint`.
- If frontend changed: run `make test-frontend`.
- Include:
  1) Commands executed
  2) Pass/fail
  3) Failing test names and first fix suggestion
