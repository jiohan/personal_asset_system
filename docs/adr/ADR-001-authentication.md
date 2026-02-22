# ADR-001: Authentication

## Context
- Web/PWA based app with multi-user support is in MVP scope.
- Contract-first + vertical slices: frontend/backend must move in lock-step.
- Repo uses session storage via Spring Session JDBC (`backend/src/main/resources/application.yml`).

## Decision
- Use session-cookie based authentication (JSESSIONID).

## Alternatives
- JWT (access/refresh tokens)
- OAuth-only (e.g., Google)

## Consequences
- CSRF protection is required for mutating endpoints.
- Same-origin dev/prod is preferred to keep cookie+CSRF+CORS complexity low.
- Backend must manage session lifecycle (login creates session, logout invalidates).

## Notes
- CSRF token flow (MVP): server sets `XSRF-TOKEN` cookie; client echoes it in `X-XSRF-TOKEN` header.
