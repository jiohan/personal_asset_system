# Seed Strategy (Current Local Dev State)

## Active Seed Path
- Local profile adds `classpath:db/seed` via [`backend/src/main/resources/application-local.yml`](../backend/src/main/resources/application-local.yml).
- The current dev seed is [`backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql`](../backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql).

## What The Seed Creates
- Demo user: `demo@example.com` (`demo` password for local runtime verification)
- Accounts:
  - `100` `국민 주거래` (`CHECKING`, opening balance `1,000,000`)
  - `101` `카카오 비상금` (`SAVINGS`, opening balance `300,000`)
  - `102` `증권 계좌` (`INVESTMENT`, opening balance `0`)
- System categories:
  - Income: `급여`, `기타수입`
  - Expense: `식비`, `카페/간식`, `교통`
  - Transfer library type: `투자이동`
- Transactions:
  - salary income
  - uncategorized expense (`needsReview=true`)
  - transfer from checking to investment
  - expense excluded from reports (`excludeFromReports=true`)

## Why This Seed Exists
- Verify that `currentBalance` is always computed, never stored.
- Verify that `TRANSFER` affects balance but not cashflow totals.
- Verify that uncategorized transactions surface in inbox flows.
- Verify that `excludeFromReports=true` expenses stay out of expense totals.

## Re-apply Strategy
- Fastest reset path for local Docker DB is to recreate the Postgres volume/container and boot backend again.
- Because the seed uses `ON CONFLICT DO NOTHING`, it is safe for repeated local startup but it does not overwrite edited demo data.

## Related Files
- [`backend/src/main/resources/application-local.yml`](../backend/src/main/resources/application-local.yml)
- [`backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql`](../backend/src/main/resources/db/seed/V9000__dev_seed_demo.sql)
- [`docs/seeds/`](./seeds)
