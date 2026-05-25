# Data Model and Persistence Truth

Source of truth: `prisma/schema.prisma` + SQL migrations for tables not in Prisma.

---

## Prisma models (TRACED)

### `User` → `users`

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| email | unique | lowercased on write in auth actions |
| password | string | bcrypt hash |
| name | optional | |

### `Trade` → `trades`

| Field | Type | Notes |
|-------|------|-------|
| userId | FK → User | cascade delete |
| setupId | optional FK → SetupCandidate | SetNull on delete |
| symbol, direction, status | enums | `TradeStatus`: PLANNED, OPEN, CLOSED, CANCELLED |
| entryDate, exitDate | DateTime | |
| entryPrice, exitPrice, quantity, fees | Float | **Unit:** thousand VND/share in UI copy |
| realizedPnl, rMultiple, outcome | optional | computed on CLOSED in actions |
| playbook | enum | only `BREAKOUT_PULLBACK` |
| entryReason, entryLocationVsZone, healthLevelAtEntry, healthScoreAtEntry | optional enums/int | |
| stopLoss, takeProfit, positionSize | optional Float | |
| setupSnapshot | Json? | immutable after first set on update |
| exitReason, exitDiscipline, entryNote, exitNote, notes | optional | |

**Relations:** `setupCandidate`, `setupOutcomes[]`

### `IndexDailyBar` → `index_daily_bars`

VNINDEX (and potentially other index symbols). Unique `(symbol, date)`.

### `StockSymbol` → `stock_symbols`

Universe registry; `active` flag.

### `StockDailyBar` → `stock_daily_bars`

EOD OHLCV per symbol. Unique `(symbolId, date)`.

### `TacticalSymbol` → `tactical_symbols`

**Schema comment (TRACED):** “Additive tactical symbol intake (dormant foundation; **not merged into scanner yet**).”  
Scanner job **does** read tactical symbols via `listActiveTacticalSymbols` / `computeEffectiveScanUniverse` in `run-daily-scan-job.ts` — product comment vs code is **AMBIGUOUS**; treat tactical merge as **partially implemented**.

### `DailyScanRun` → `daily_scan_runs`

| Field | Notes |
|-------|-------|
| gate1Level | PASS / WARNING / FAIL |
| status | COMPLETED / FAILED |
| symbolCount* | ints |
| candidateCountA/B/Surfaced | ints |
| tradabilityBreakdown | Json? |
| notes | Json? — Gate2 diagnostics + `decision` + `benchmarkBackdrop` |
| errorSummary | text on failure paths |

### `SetupCandidate` → `setup_candidates`

Per-run surfaced setups: zones, stop, rankScore, reasons (Json), barDate, quality A/B.

### `SetupOutcome` → `setup_outcomes`

Learning loop row per closed trade (1:1 `tradeId`). Written from `writeSetupOutcomeFromTrade`.

### `SetupWatchItem` → `setup_watch_items`

Durable watch row per `(symbolId, setupType)`.

| Field | Notes |
|-------|-------|
| lifecycleStatus | enum NEW, WATCHING, READY, TRIGGERED, EXPIRED, INVALID |
| healthScore, healthLevel, healthFlags | updated by scanner health job |
| breakout/pullback zone fields | may diverge from latest candidate |

**Schema comment:** “health overlay only in this phase (**no lifecycle FSM**).” UI on dashboard still displays `lifecycleStatus` from DB.

---

## Raw SQL table: `trade_health_logs`

**Migration:** `prisma/migrations/20260506120000_trade_health_logs/migration.sql`

| Column | Type |
|--------|------|
| id | UUID PK |
| trade_id | TEXT FK → trades |
| checked_at | TIMESTAMP |
| health_level | TEXT NOT NULL |
| health_score | INTEGER |
| price_vs_zone | TEXT |
| structure_status | TEXT |
| recommended_action | TEXT |
| review_checklist | JSONB (migration `20260511103000`) |

**Not in Prisma client** — all access via `$queryRaw` / `$executeRawUnsafe`:

- `src/app/actions/trades.ts` (INSERT)
- `src/app/(dashboard)/trades/page.tsx` (SELECT aggregates)
- `src/app/(dashboard)/trades/[id]/page.tsx` (SELECT history)

---

## Key JSON payloads

### `DailyScanRun.notes` (parsed by `parseDailyScanGate2Notes`)

**TRACED fields used by UI:**

- `topRejectionCategories: Record<string, number>`
- `closestToValidSymbols: Gate2ClosestSymbolRow[]`
- `recommendation: { likelyBottleneck, summary, note }`
- `decision: { level, allocation, explanation }` (via `parsePersistedDailyDecision`)
- `rejectionSymbolsByCategory` — **INFERRED** from dashboard usage `scanNotes?.rejectionSymbolsByCategory` — parser may partially support; verify in `parse-daily-scan-notes.ts` if symbols list empty in prod

### `trade_health_logs.review_checklist`

**TRACED:** Merges EOD checklist booleans + optional `reviewOutcome` (`src/lib/trades/review-outcome.ts`).

### `Trade.setupSnapshot`

Opaque JSON; seeded from setup candidate on new trade (`trades/new/page.tsx`) or tier-only object in `createTrade`.

### Cookie `tl_book_op_v1_{userId}`

`BookOperatingSnapshotV2` — `src/lib/trades/operating-trend-discipline.ts` (version `v: 2`).

---

## Enum reference (UI-relevant)

Full list in `prisma/schema.prisma`. Critical paths:

- `Direction`: LONG, SHORT
- `SetupHealthLevel`: HEALTHY, WARNING, AT_RISK, DEAD
- `ScanQuality`: A, B
- `Gate1ScanLevel`: PASS, WARNING, FAIL

Display labels decoupled in `src/lib/trading-display-labels.ts` (not 1:1 with DB strings for all surfaces).

---

## External dependencies (data plane)

| Dependency | Access |
|------------|--------|
| PostgreSQL | Prisma + raw SQL |
| vnstock (Python scripts) | `scripts/fetch_*.py` → import pipeline — **outside** request path |
| Vercel Cron | HTTP only |

**TRACED:** No live market data API in Next.js request handlers; all prices from `stock_daily_bars` / `index_daily_bars`.
