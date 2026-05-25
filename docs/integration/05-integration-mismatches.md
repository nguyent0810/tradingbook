# Integration Mismatches and Wrong UX Flows

Each item includes **evidence** and a **classification**.

---

## 1. No stable HTTP API contract for the product UI

**Evidence:** Only `src/app/api/db-health/route.ts` and `src/app/api/cron/daily-scan/route.ts`; all product I/O via Server Actions + RSC Prisma.

**Impact:** Any external client, mobile app, or “API-first” rebuild cannot rely on OpenAPI-style endpoints. UI code that assumes `fetch('/api/trades')` patterns does not exist today.

**Classification:** TRACED architectural mismatch vs typical “frontend/backend contract” docs.

---

## 2. `trade_health_logs` outside Prisma schema

**Evidence:**

- Table in `prisma/migrations/20260506120000_trade_health_logs/migration.sql`
- Absent from `prisma/schema.prisma`
- Inserts/selects via `$executeRawUnsafe` / `$queryRaw` in `trades.ts`, `trades/page.tsx`, `trades/[id]/page.tsx`

**UI behavior:**

- Trade detail catch block: “Keep read-only UI resilient if logs table/model isn't present” — `trades/[id]/page.tsx` lines 232–235
- Trades list: failed batch queries log to console and return empty maps

**Impact:** Migrations can drift; Prisma migrate does not type-check queries; UI **silently** drops review history and queue signals.

**Classification:** TRACED — **wrong UX** when table missing (user sees “no checkpoints” not “feature unavailable”).

---

## 3. Two different “lifecycle” concepts for setups

| Source | Values | Where shown |
|--------|--------|-------------|
| DB `SetupWatchItem.lifecycleStatus` | NEW, WATCHING, READY, TRIGGERED, EXPIRED, INVALID | Dashboard watchlist |
| Computed `lifecycleSortLabel` | READY, WATCHING only | Dashboard “Best Setups”, Setups candidates |

**Evidence:**

- `prepare-surfaced-health-view.ts` — `closeInPullbackZone` → READY vs WATCHING
- `dashboard/page.tsx` — watch table uses `w.lifecycleStatus` with `watchActionHint()` client-side strings

**Impact:** Same symbol can show **READY** in Best Setups (price in zone) but **WATCHING** in watchlist DB row — confusing without explanation.

**Classification:** TRACED — UX does not match single backend lifecycle truth.

---

## 4. Dashboard watchlist “Action Hint” is not from backend

**Evidence:** `watchActionHint()` defined inline in `dashboard/page.tsx` (lines 54–71) — switches on `lifecycleStatus` + optional `healthLevelActionHint` from lib copy.

**Impact:** Hints are **presentation fiction** unless documented as derived-only; no API returns `actionHint`.

**Classification:** INFERRED product gap — **NEEDS_BACKEND_CONFIRMATION** if hints must be authoritative.

---

## 5. Exposure / allocation UI vs account truth

**Evidence:**

- `isTradingRiskBudgetConfigured()` — `TRADING_ACCOUNT_EQUITY_VND` env (`trading-account-risk-config.ts`)
- Dashboard explicitly states allocation is “guidance only” and “not remaining capacity math” when equity unset (`dashboard/page.tsx`)

**Frontend assumes:** `decision.allocation` string (e.g. `"20-40%"`) can be parsed to `%` via regex (`pctFromRangeText`).

**Impact:** When env set, UI still does not compute true remaining risk budget — only qualitative copy. **Not a bug** but **mismatch** if UI blueprint implied real portfolio caps.

**Classification:** TRACED — UI must not be rebuilt as “risk enforcement” without new backend.

---

## 6. Momentum Watch price formatting inconsistency

**Evidence:**

- Core setups: `formatEquityThousandVndPerShare` — labels “(1000 ₫)”
- Momentum: `row.latestClose.toFixed(2)` — `momentum-watch-section.tsx` line 116

**Impact:** Same numeric bar scale may **look** like a different unit on one screen.

**Classification:** TRACED display mismatch — likely **wrong UX** for VN thousand-đồng convention.

---

## 7. `SetupOutcome.healthLevelAtExit` copies entry level

**Evidence:** `writeSetupOutcomeFromTrade` in `trades.ts`:

```ts
healthLevelAtExit: trade.healthLevelAtEntry,
```

**Impact:** Setup performance stats (`loadSetupPerfRowsCached` / setups table hints) that depend on exit health are **incorrect** if exit health differed.

**Classification:** TRACED backend write bug — UI learning loop misleading.

---

## 8. Checkpoint “today” uses local server midnight, not labeled TZ

**Evidence:** `trades/page.tsx` — `dayStart`/`dayEnd` via `setHours(0,0,0,0)` on server `Date`; FRD in `docs/trading/trade-page-position-health-frd.md` flags TZ as open.

**Impact:** “Reviewed today” and queue counts may disagree with trader’s calendar.

**Classification:** AMBIGUOUS — **NEEDS_BACKEND_CONFIRMATION** (UTC vs local).

---

## 9. Operating snapshot cookie is client-triggered, not server-authoritative

**Evidence:** `operating-snapshot-persist.tsx` calls `persistBookOperatingSnapshot` from `useEffect` when snapshot changes.

**Impact:**

- No snapshot if JS disabled
- Snapshot is **UX memory**, not audit trail
- Compare “since last visit” is cookie-local, not user DB

**Classification:** TRACED — fine for hints; **wrong** if rebuild treats it as backend state.

---

## 10. New trade from setup: `takeProfit` not prefilled

**Evidence:** `trades/new/page.tsx` sets `takeProfit: undefined` even though candidate has levels.

**Impact:** User may assume scanner provided TP — it did not in form defaults.

**Classification:** TRACED partial prefill — **INFERRED** intentional omission.

---

## 11. Analytics / equity curve not wired

**Evidence:** `computeAdvancedMetrics` only in `analytics.ts`; `EquityPanel` unused (grep).

**Impact:** Blueprints referencing performance dashboard tiles have **no backend read path** today.

**Classification:** TRACED — UI assumption from docs ≠ code.

---

## 12. Tactical symbols: schema comment vs scanner code

**Evidence:**

- Schema: “not merged into scanner yet” (`schema.prisma` TacticalSymbol comment)
- `run-daily-scan-job.ts` imports `computeEffectiveScanUniverse`, `listActiveTacticalSymbols`

**Classification:** AMBIGUOUS — treat tactical universe as **partial** until ops doc and code comment align.

---

## 13. Silent degradation patterns (anti-patterns for rebuild)

| Location | Behavior |
|----------|----------|
| Dashboard | Multiple try/catch → `dbLoadError` banner + empty sections |
| Trades list | `trade_health_logs` failure → empty Sets |
| Trade detail health | catch → empty logs |
| Market snapshot | catch → all null dates |
| Momentum section | catch → “temporarily unavailable” |

**Classification:** TRACED — rebuild should replace with explicit error contracts, not empty states masquerading as truth.

---

## 14. `checkTradeEntryPriceAlignment` vs server form validation

**Evidence:** Client blur calls alignment check; server `createTrade`/`updateTrade` also run `validateEntryPriceVsLatestBars` but catch errors and **skip** with console.error (`trades.ts` lines 57–59).

**Impact:** Client may warn; server may allow submit if bar load fails.

**Classification:** TRACED inconsistency.

---

## Flows that ARE aligned (for rebuild baseline)

| Flow | Why aligned |
|------|-------------|
| Log trade → `trades` table | Single Prisma path + Zod schema |
| Close trade → P&L + `setup_outcomes` | Same action pipeline |
| Daily scan → `daily_scan_runs` + `setup_candidates` | Cron/CLI share `runDailyScanJob` |
| Gate 1 on dashboard/setups | `getMarketRegimeFromDb` + scan notes decision |
| Setup-linked trade | `setupCandidateId` query + FK `setupId` |

---

## Summary table

| ID | Severity for UI rebuild | Type |
|----|-------------------------|------|
| 1 | High | Architecture |
| 2 | High | Schema / silent failure |
| 3 | Medium | Duplicate lifecycle semantics |
| 4 | Low | Copy-only hints |
| 5 | Medium | Risk UX expectations |
| 6 | Medium | Display units |
| 7 | Medium | Analytics integrity |
| 8 | Medium | Time boundaries |
| 9 | Low | Ephemeral state |
| 10 | Low | Form defaults |
| 11 | High | Missing features in code |
| 12 | Low | Docs vs code |
| 13 | High | Error honesty |
| 14 | Medium | Validation parity |
