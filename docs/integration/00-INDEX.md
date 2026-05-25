# API Contract + Integration Truth — Index

**Audit date:** 2026-05-25  
**Scope:** Read-only source scan. No application code was modified.  
**Stack:** Next.js 16 App Router monolith, Prisma 7 → PostgreSQL, Server Actions + React Server Components (no REST client layer).

## What this package answers

| # | Question | Primary doc |
|---|----------|-------------|
| 1 | What backend APIs actually exist? | [02-api-contract.md](./02-api-contract.md) |
| 2 | Request/response shapes? | [02-api-contract.md](./02-api-contract.md), [03-data-model-and-persistence.md](./03-data-model-and-persistence.md) |
| 3 | Which pages/components call them? | [04-frontend-integration-map.md](./04-frontend-integration-map.md) |
| 4 | Where does the UI assume data the backend does not provide? | [05-integration-mismatches.md](./05-integration-mismatches.md) |
| 5 | Which UX flows are wrong vs backend truth? | [05-integration-mismatches.md](./05-integration-mismatches.md) |
| 6 | Backend gaps before a clean UI rebuild? | [06-backend-gaps.md](./06-backend-gaps.md) |

## Architecture truth (one paragraph)

The “backend” for the product UI is **not** a separate HTTP API service. User-facing reads and writes go through:

1. **Two HTTP route handlers** (`/api/db-health`, `/api/cron/daily-scan`)
2. **Three Server Action modules** (`auth`, `trades`, `operating-snapshot`)
3. **Direct Prisma (and raw SQL)** inside Server Components and `server-only` lib modules

There is **no** `fetch`/`axios`/SWR/tRPC usage under `src/` (verified by grep). Contract documentation must treat Server Actions and RSC data loaders as first-class “APIs.”

## Evidence classification

Throughout this package:

- **TRACED** — conclusion follows a cited file path and data flow.
- **INFERRED** — reasonable from code structure but not exercised in a runtime trace.
- **AMBIGUOUS** — multiple valid interpretations in code.
- **UNKNOWN** — not present in repo; needs runtime or owner confirmation.
- **NEEDS_BACKEND_CONFIRMATION** — product decision required beyond what code states.

## Document list

1. [01-repository-scan-inventory.md](./01-repository-scan-inventory.md) — mandatory scan checklist (routes, services, models, jobs, UI, mocks).
2. [02-api-contract.md](./02-api-contract.md) — every HTTP route and Server Action with trace chains and shapes.
3. [03-data-model-and-persistence.md](./03-data-model-and-persistence.md) — Prisma models, raw tables, enums, external deps.
4. [04-frontend-integration-map.md](./04-frontend-integration-map.md) — pages → data sources → mutations.
5. [05-integration-mismatches.md](./05-integration-mismatches.md) — assumptions, wrong flows, silent fallbacks.
6. [06-backend-gaps.md](./06-backend-gaps.md) — what must exist before UI rebuild.

## Related existing docs (not superseded)

Product/runbook material under `docs/trading/` (e.g. `vercel-cron-daily-scan.md`, `trade-page-position-health-frd.md`) remains authoritative for **intent**; this package is authoritative for **what the repo actually wires today**.
