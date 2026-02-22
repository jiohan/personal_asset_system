# ADR-002: Data Ownership

## Context
- User-by-user data separation is required.
- Many queries are user-scoped (accounts, transactions, reports, backups).
- Categories are mixed: system defaults + user custom.

## Decision
- Primary tables require `user_id` and all reads/writes are filtered by it.
- Categories support both:
  - system categories (`user_id` is NULL)
  - user categories (`user_id` is NOT NULL)

## Alternatives
- Introduce a generic `tenant_id` across all tables.
- Make all categories user-owned only.

## Consequences
- Every query must include `user_id` filter (or equivalent authorization check).
- Index/FK design should consider `user_id` access patterns.
- Authorization failures should avoid leaking resource existence (404 vs 403) where appropriate.
