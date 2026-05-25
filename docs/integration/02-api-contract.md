# API Contract (HTTP + Server Actions)

All shapes below are **TRACED** from source unless marked otherwise.

---

## HTTP routes

### `GET /api/db-health`

| | |
|--|--|
| **File** | `src/app/api/db-health/route.ts` |
| **Auth** | None |
| **Dynamic** | `force-dynamic` |

**Trace:**

```
route.ts → prisma.$queryRaw`SELECT 1` → PostgreSQL
```

**Success (200):**

```json
{ "ok": true }
```

**Failure (503):**

```json
{ "ok": false, "error": "<Error.message or database_unreachable>" }
```

**Consumers:** **UNKNOWN** in `src/` (ops/scripts may call externally — `scripts/verify-deployment-health.ts` **INFERRED**).

---

### `GET /api/cron/daily-scan`

| | |
|--|--|
| **File** | `src/app/api/cron/daily-scan/route.ts` |
| **Auth** | Bearer `CRON_SECRET` when set; on Vercel (`VERCEL=1`) secret **required** or 500 |
| **maxDuration** | 300s |

**Trace:**

```
route.ts → authorizeCronRequest → runDailyScanJob(prisma)
  → getExpectedLatestSessionFromIndexBars
  → getMarketRegimeFromDb
  → stockSymbol universe + stockDailyBar reads
  → Gate2 evaluateBreakoutPullbackCandidate
  → prisma transaction: dailyScanRun + setupCandidate.createMany
  → syncWatchItemsFromSurfacedCandidates, evaluateAndPersistHealthForActiveWatchItems
```

**Auth failure (401/500):**

```json
{ "ok": false, "error": "<reason string>" }
```

**Job failure (500):**

```json
{ "ok": false, "error": "<message>" }
```

**Success (200):**

```json
{
  "ok": true,
  "kind": "COMPLETED" | "FAILED_NO_INDEX_SESSION",
  "databaseUrlHint": "<fingerprint>",
  "scanRunId": "<cuid>",
  "runAt": "<ISO>",
  "symbolCountTotal": number,
  "symbolCountScanned": number,
  "symbolCountAfterTradability": number,
  "setupCandidatesInserted": number,
  "...": "additional keys from summaryJson in run-daily-scan-job.ts"
}
```

**Consumers:** Vercel Cron (`vercel.json`). **Not** called from frontend pages.

---

## Server Actions — Auth

Module: `src/app/actions/auth.ts`  
**Transport:** Next.js Server Actions (POST from `<form action={...}>`).  
**No JSON response body** — returns `AuthState` or redirects.

### `login(prevState, formData)`

**Input (FormData):** `email`, `password`  
**Validation:** `LoginSchema` (Zod)

**Trace:**

```
login → prisma.user.findUnique({ email })
     → bcrypt.compare
     → createSession(userId, email)  // src/lib/session.ts
     → redirect("/dashboard")
```

**Return (validation fail):**

```ts
{ errors?: Record<string, string[]> }
{ message?: string }  // "Invalid email or password."
```

**Success:** `redirect("/dashboard")` — no return to client.

**UI:** `src/app/(auth)/login/login-form.tsx`

---

### `register(prevState, formData)`

**Input:** `email`, `password`, `name` (optional)  
**Validation:** `RegisterSchema`

**Trace:**

```
register → prisma.user.findUnique → prisma.user.create (bcrypt hash)
        → createSession → redirect("/dashboard")
```

**Return:** same shape as login; `message` for duplicate email.

**UI:** `src/app/(auth)/register/register-form.tsx`

---

### `logout()`

**Trace:** `deleteSession()` → `redirect("/login")`  
**UI:** `src/components/logout-button.tsx` (form action)

---

## Server Actions — Trades

Module: `src/app/actions/trades.ts`  
**Auth:** `requireUser()` → `getSession()` or `redirect("/login")`

### `checkTradeEntryPriceAlignment(symbol, entryPrice)`

**Callable from client** (`"use server"`).

**Returns:**

```ts
{ status: "skip" }
| { status: "ok" }
| { status: "warn"; message: string }  // TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE
```

**Trace:**

```
→ fetchLatestCloseByTradeSymbols(prisma, [symbol])
→ detectTradePriceUnitMismatch(entryPrice, bar.close)
```

**UI:** `src/components/trade-form.tsx` (on blur entry price)

---

### `createTrade(prevState, formData)` / `updateTrade(tradeId, prevState, formData)`

**Validation:** `TradeFormSchema` (`src/lib/validations.ts`)

**Trace (create):**

```
→ validateEntryPriceVsLatestBars (OPEN/PLANNED only)
→ prisma.trade.create / update
→ if CLOSED: computePnl, computeRMultiple, deriveOutcome
→ if CLOSED: writeSetupOutcomeFromTrade → prisma.setupOutcome.upsert
→ revalidatePath("/trades", "/dashboard")
→ redirect("/trades")
```

**Return (validation / not found):**

```ts
{ errors?: Record<string, string[]> }
{ message?: string }  // update/delete: "Trade not found."
```

**Success:** redirect — no JSON.

**UI:**

- `src/components/trade-form.tsx` — create + edit
- `src/app/(dashboard)/trades/new/page.tsx` — create only
- `src/app/(dashboard)/trades/[id]/page.tsx` — edit via `TradeForm`

**Form fields (TRACED from TradeFormSchema):**  
`setupId`, `symbol`, `direction`, `status`, `entryDate`, `exitDate`, `stopLoss`, `takeProfit`, `positionSize`, `entryReason`, `entryLocationVsZone`, `healthLevelAtEntry`, `healthScoreAtEntry`, `entryPrice`, `exitPrice`, `exitReason`, `exitDiscipline`, `quantity`, `fees`, `entryNote`, `exitNote`, `setupSnapshot`, `notes`

**Side effects on close (TRACED bug-risk):** `writeSetupOutcomeFromTrade` sets `healthLevelAtExit: trade.healthLevelAtEntry` (not recomputed) — `src/app/actions/trades.ts` lines 155–167.

---

### `deleteTrade(tradeId)`

**Trace:** ownership check → `prisma.trade.delete` → revalidate → `redirect("/trades")`  
**Return:** `{ message }` if not found (no redirect).  
**UI:** `src/app/(dashboard)/trades/[id]/delete-button.tsx`

---

### `addTradeHealthCheckpoint(tradeId, formData)`

**Preconditions:** trade `OPEN`, owned by user.

**Form fields (TRACED):**  
`healthLevel` (required enum string), `healthScore`, `priceVsZone`, `structureStatus`, `recommendedAction`, review checklist fields via `reviewChecklistFromFormData`, `reviewOutcome`

**Trace:**

```
→ prisma.$executeRawUnsafe INSERT INTO trade_health_logs (...)
→ revalidatePath → redirect(`/trades/${id}`)
```

**Table not in Prisma schema** — migration `20260506120000_trade_health_logs`.

**UI:** `src/app/(dashboard)/trades/[id]/page.tsx` (form `action={addTradeHealthCheckpoint.bind(...)}`)

---

## Server Actions — Operating snapshot

Module: `src/app/actions/operating-snapshot.ts`

### `persistBookOperatingSnapshot(snapshot: BookOperatingSnapshotV2)`

**Auth:** silent no-op if no session or `snapshot.v !== 2`  
**Trace:** `cookies().set('tl_book_op_v1_${userId}', JSON.stringify(snapshot))`  
**UI:** `src/app/(dashboard)/trades/operating-snapshot-persist.tsx` (client `useEffect`)

---

## Non-HTTP “read APIs” (Server Component data loaders)

These are **not** exposed as REST but are the **actual contract** the UI depends on.

### Latest scan + candidates

| Loader | File |
|--------|------|
| `getLatestDailyScanRun()` | `src/lib/scanner/setups-queries.ts` |
| `toCandidateRows(run)` | adds `symbolKey` |

**Returns:** `DailyScanRun` + nested `SetupCandidate[]` with `symbol.symbol`.

**Used by:** `dashboard/page.tsx`, `setups/*`, `setups-cached-data.ts`

---

### Surfaced candidate health view

| Loader | File |
|--------|------|
| `prepareSurfacedCandidatesHealthView(prisma, candidates, evalBarDate)` | `src/lib/setup-health/prepare-surfaced-health-view.ts` |

**Adds:** `healthFlags`, `healthScore`, `healthLevel`, `lifecycleSortLabel` (`READY` \| `WATCHING` only — computed from close vs zone, **not** DB `SetupLifecycleStatus`).

---

### Market session snapshot

| Loader | File |
|--------|------|
| `fetchMarketSessionSnapshot(prisma)` | `src/lib/market/market-session-snapshot.ts` |

**Returns:**

```ts
{
  benchmarkSessionDate: Date | null;      // VNINDEX latest indexDailyBar
  latestEquityBarSessionDate: Date | null;  // max stockDailyBar.date
  latestScanRunAt: Date | null;
}
```

**Used by:** trades page, trade detail (open), setups overview, dashboard (via regime + alignment).

---

### Open position marks

| Loader | File |
|--------|------|
| `loadOpenPositionMarks(prisma, symbols)` | `src/lib/trades/position-health.ts` |

Feeds unrealized P&L, stale bar detection, review DTOs on trades ledger.

---

### Momentum watch rows

| Loader | File |
|--------|------|
| `getMomentumWatchRowsForPhase1(prisma, opts)` | `src/lib/scanner/momentum-watch.ts` |

**Used by:** `src/components/momentum-watch-section.tsx` (dashboard + setups).

---

### Gate 1 regime

| Loader | File |
|--------|------|
| `getMarketRegimeFromDb("VNINDEX")` | `src/lib/playbook/get-market-regime.ts` |

**Returns:** `{ level: Gate1Level, latestBar?, ... }` — used for dashboard decision + display.

---

### Setup performance aggregate

| Loader | File |
|--------|------|
| Raw SQL on `setup_outcomes` | `src/app/(dashboard)/setups/setups-cached-data.ts` → `loadSetupPerfRowsCached` |

**Returns rows:** `setup_type`, `setup_tier_at_entry`, `trade_count`, `win_count`, `avg_r`

---

## Environment variables (integration contract)

| Variable | Consumed in | Effect if missing |
|----------|-------------|-------------------|
| `DATABASE_URL` | `src/lib/prisma.ts` | App DB failures |
| `SESSION_SECRET` | `session-crypto.ts` | Defaults to dev secret string |
| `CRON_SECRET` | cron route | Local: open cron; Vercel: 500 |
| `SCAN_SYMBOL_LIMIT` | `run-daily-scan-job.ts` | No limit |
| `TRADING_ACCOUNT_EQUITY_VND` | `trading-account-risk-config.ts` | Dashboard exposure labels stay “guidance only” |
| `VERCEL` | cron route | Changes cron auth strictness |

---

## Error shape summary

| Surface | Shape |
|---------|--------|
| HTTP JSON routes | `{ ok: boolean, error?: string, ... }` |
| Server Actions (form) | `AuthState` / `TradeActionState` or redirect |
| RSC loaders | try/catch → user-visible banner string + empty data |
| Raw SQL health logs | catch → empty logs / skip (silent) |

No unified error code enum exists in the codebase.
