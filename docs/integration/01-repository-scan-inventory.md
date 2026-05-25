# Repository Scan Inventory

Evidence: file paths under `d:\Tools\Trading` unless noted.

---

## 1. Backend route / controller files

| Path | Role |
|------|------|
| `src/app/api/db-health/route.ts` | `GET` — Postgres liveness |
| `src/app/api/cron/daily-scan/route.ts` | `GET` — Vercel cron → `runDailyScanJob` |

**TRACED:** No other `src/app/api/**/route.ts` files exist (glob).

There is **no** `middleware.ts` — auth is enforced per layout/page via `getSession()` + `redirect("/login")` (`src/app/(dashboard)/layout.tsx`, individual pages).

---

## 2. Backend service / use-case files (domain logic)

| Area | Key modules |
|------|-------------|
| Daily scanner | `src/lib/scanner/run-daily-scan-job.ts`, `src/lib/scanner/gate2/*`, `src/lib/scanner/tradability.ts`, `src/lib/scanner/setups-queries.ts` |
| Market regime (Gate 1) | `src/lib/playbook/get-market-regime.ts`, `src/lib/playbook/gate1-market.ts` |
| Setup health | `src/lib/setup-health/*` (`evaluate-watch-health`, `persist-watch-health`, `prepare-surfaced-health-view`) |
| Trades / review | `src/lib/trades/*` (position-health, review queues, operating context, unrealized P&L) |
| Momentum watch | `src/lib/scanner/momentum-watch.ts` |
| Tactical universe | `src/lib/tactical-universe.ts`, `src/lib/tactical-universe-ops.ts` |
| Market alignment | `src/lib/market/market-session-snapshot.ts`, `market-data-alignment.ts` |

**Server Actions (mutation boundary):**

| Path | Exports |
|------|---------|
| `src/app/actions/auth.ts` | `login`, `register`, `logout` |
| `src/app/actions/trades.ts` | `createTrade`, `updateTrade`, `deleteTrade`, `addTradeHealthCheckpoint`, `checkTradeEntryPriceAlignment` |
| `src/app/actions/operating-snapshot.ts` | `persistBookOperatingSnapshot` |

---

## 3. Backend DTO / schema / type files

| Path | Role |
|------|------|
| `prisma/schema.prisma` | DB schema + Prisma client enums/models |
| `src/generated/prisma/client` | Generated client (output per schema generator) |
| `src/lib/validations.ts` | `TradeFormSchema`, `computePnl` (Zod) |
| `src/app/actions/auth.ts` | `LoginSchema`, `RegisterSchema`, `AuthState` |
| `src/app/actions/trades.ts` | `TradeActionState` |
| `src/lib/scanner/gate2/types.ts` | Gate2 candidate types |
| `src/lib/scanner/gate2-scan-diagnostics.ts` | `DailyScanGate2Notes` |
| `src/lib/trades/operating-trend-discipline.ts` | `BookOperatingSnapshotV2` |
| `src/lib/trades/review-outcome.ts` | `ReviewOutcomeId`, JSON payload helpers |
| `src/lib/session-crypto.ts` | `SessionPayload` |

**AMBIGUOUS:** `trade_health_logs` is **not** in `prisma/schema.prisma` but is defined in SQL migrations and accessed via raw SQL only.

---

## 4. Database models / tables / entities

**Prisma models** (`prisma/schema.prisma`): `User`, `Trade`, `IndexDailyBar`, `StockSymbol`, `TacticalSymbol`, `StockDailyBar`, `DailyScanRun`, `SetupCandidate`, `SetupOutcome`, `SetupWatchItem`.

**SQL-only table (TRACED):**

- `trade_health_logs` — `prisma/migrations/20260506120000_trade_health_logs/migration.sql`, column `review_checklist` added in `20260511103000_trade_health_review_checklist/migration.sql`

**Migrations directory:** `prisma/migrations/*` (28+ migration folders).

---

## 5. Background jobs, queues, workers, async processors

| Mechanism | Path / config | Trigger |
|-----------|---------------|---------|
| Vercel Cron | `vercel.json` → `/api/cron/daily-scan` at `30 7 * * *` | Scheduled HTTP GET |
| Cron handler | `src/app/api/cron/daily-scan/route.ts` | Calls `runDailyScanJob(prisma)` |
| CLI scanner (same job) | `scripts/run-daily-scanner.ts` | **INFERRED:** manual `npx tsx` (referenced in UI empty states) |
| Data import (ops) | `scripts/import-bars.ts`, `scripts/fetch_vnindex.py`, `scripts/fetch_stock_bars.py` | External to app runtime |
| Python utilities | `scripts/*.py` | Bar fetch / symbol lists |

**TRACED:** No Redis, Bull, SQS, or in-app job queue.

---

## 6. Frontend pages / routes

| Route | File |
|-------|------|
| `/` | `src/app/page.tsx` (marketing) |
| `/login` | `src/app/(auth)/login/page.tsx` + `login-form.tsx` |
| `/register` | `src/app/(auth)/register/page.tsx` + `register-form.tsx` |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` |
| `/setups` | `src/app/(dashboard)/setups/page.tsx` (+ async segments) |
| `/trades` | `src/app/(dashboard)/trades/page.tsx` |
| `/trades/new` | `src/app/(dashboard)/trades/new/page.tsx` |
| `/trades/[id]` | `src/app/(dashboard)/trades/[id]/page.tsx` |

Layouts: `src/app/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(dashboard)/layout.tsx`.

Loading UI: `setups/loading.tsx`, `dashboard/loading.tsx`, `trades/loading.tsx`.

---

## 7. Frontend API clients / hooks / fetch

**TRACED:** Grep for `fetch(`, `axios`, `useSWR`, `useQuery`, `trpc` under `src/` → **no matches**.

Integration patterns:

- Server Components → `prisma` / lib loaders
- Client Components → `useActionState` + Server Actions (`trade-form.tsx`, auth forms)
- One client-side RPC-style call: `checkTradeEntryPriceAlignment` from `trade-form.tsx` (still a Server Action, not HTTP JSON API)

---

## 8. Frontend state stores

**TRACED:** No Zustand, Redux, Jotai, or React Context stores for app data.

| State mechanism | Path | Persistence |
|-----------------|------|-------------|
| Session JWT | `src/lib/session.ts`, `session-crypto.ts` | Cookie `session` |
| Book operating snapshot | `operating-snapshot.ts`, `operating-snapshot-persist.tsx` | Cookie `tl_book_op_v1_{userId}` |
| URL search params | `trades/page.tsx`, `trade-filters.tsx` | Ephemeral |
| React `cache()` | `setups-cached-data.ts` | Per-request dedup only |

---

## 9. Mock / prototype / demo data files

| Path | Notes |
|------|-------|
| `src/lib/playbook/gate1-market.smoke.ts` | **Test/smoke only** — `mockBullishPass()` etc.; not used by app routes |
| `src/app/(dashboard)/setups/setups-stream-fallbacks.tsx` | **UI skeleton placeholders** during Suspense — not business data |
| `src/app/(dashboard)/setups/loading.tsx` | Skeleton placeholders |
| `src/lib/trades/trades-ledger-row-derived.ts` | `fallbackLedgerDerivedFields` — error-path row rendering, not mock API data |

**TRACED:** No `*mock*` data files in `src/` for production pages.

---

## 10. Artifact / output / playback / file-related code

| Path | Role |
|------|------|
| `scripts/import-bars.ts` | CSV/bar import into DB |
| `scripts/export-tactical-symbols.ts` | Export |
| `scripts/gate2-audit.ts`, `scripts/fresh-breakout-audit.ts` | Audit outputs |
| `src/lib/database-url-fingerprint.ts` | Safe DB URL hint in cron logs |
| `playwright.config.ts`, `tests/**` | E2E — out of product contract |

**TRACED:** No user-facing file upload/download API in app routes.

---

## 11. Auth / session-related code

| Path | Role |
|------|------|
| `src/lib/session-crypto.ts` | JWT sign/verify (`jose`), `SESSION_SECRET` env |
| `src/lib/session.ts` | Cookie read/write |
| `src/app/actions/auth.ts` | Login/register + bcrypt |
| `src/app/(dashboard)/layout.tsx` | Gate dashboard routes |

**NEEDS_BACKEND_CONFIRMATION:** Session expiry uses JWT `7d` in crypto (`setExpirationTime("7d")`) while cookie `expires` is also 7 days — align with product policy.

---

## 12. Error handling and notification code

| Pattern | Evidence |
|---------|----------|
| Server Action errors | `AuthState` / `TradeActionState` field errors + `message`; forms render inline (`trade-form.tsx`, login/register forms) |
| DB load degradation | `dbLoadError` strings on dashboard/trades/setups; partial empty arrays |
| Silent catch + continue | `trade_health_logs` queries, health log read on trade detail (`[id]/page.tsx` catch block) |
| Cron/auth errors | JSON `{ ok: false, error }` with 401/500/503 |
| Console logging | `console.error` / `console.warn` throughout — **no** toast/notification library |

**TRACED:** No Sonner, react-hot-toast, or global error boundary component in `src/`.

---

## Orphan / unwired UI building blocks

| Component / lib | Status |
|----------------|--------|
| `src/components/equity-panel.tsx`, `equity-curve-chart.tsx` | **Not imported** by any page (grep) |
| `src/lib/analytics.ts` | **Not imported** by pages — metrics helpers only |

Referenced in `UI_BLUEPRINT.md` / `REFACTOR_PLAN.md` as planned, not integrated.
