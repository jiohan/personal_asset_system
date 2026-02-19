Finalize the current slice for Codex handoff.

Checklist:
1. List changed files grouped by backend/frontend/docs/infra.
2. State contract impact (`docs/openapi.yaml`) with yes/no and reason.
3. Summarize executed gates:
   - `make test-backend`
   - `make test-frontend`
   - `make contract-lint`
4. List remaining risks and follow-up tasks.
5. Provide a Codex prompt limited to max 2 files for final polish.
