## Summary
- What changed?
- Why was this needed?

## Scope
- In scope:
- Out of scope:

## Contract-First Checklist
- [ ] `docs/openapi.yaml` was updated, or this PR has no API contract impact.
- [ ] Spec diff was reviewed together with implementation diff.
- [ ] If backend contract-relevant files changed, OpenAPI change is included in this PR.

## Implementation Checklist
- [ ] Backend changes reviewed.
- [ ] Frontend changes reviewed.
- [ ] DB/Flyway changes reviewed (if applicable).

## Test Evidence
- [ ] `cd backend && ./mvnw -B test`
- [ ] `cd frontend && npm run test -- --run`
- [ ] `cd frontend && npm run build`
- [ ] Integration test executed (if this PR affects DB/session/contract behavior).

## Risk / Rollback
- Risk:
- Rollback plan:

## Definition of Done (DoD)
- [ ] End-to-end flow works locally (frontend -> backend -> DB).
- [ ] Domain rules are preserved (`INCOME/EXPENSE/TRANSFER`, soft delete, amount > 0, exclusivity rules).
- [ ] User scope/authorization rules are preserved.
- [ ] At least 1 success test and 1 edge-case test are included or updated.
- [ ] No blocking TODO remains in this PR.
