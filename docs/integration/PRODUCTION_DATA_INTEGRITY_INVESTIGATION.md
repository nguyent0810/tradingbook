# Production Data Integrity Investigation

**Slice:** Smart Large Slice — Production Data Integrity (pre–FE rebuild)  
**Investigated:** 2026-05-25 (UTC probe `2026-05-25T03:19:20Z`)  
**Database:** Neon production (read-only probe via `SMOKE_DATABASE=production`)  
**Probe script:** `scripts/prod-data-integrity-probe.ts`

---

## Executive summary

| Area | Verdict |
|------|---------|
| **Vercel cron / daily scan job** | **Healthy** — `DailyScanRun` rows complete daily (~189 symbols scanned). |
| **Bar import pipeline** | **Not automated** — cron/scanner **do not** fetch or import bars; production bars frozen since ~**2026-05-05/06** (VNINDEX / equity max). |
| **Scanner on stale bars** | **Runs anyway** — uses existing DB bars; logs `benchmark_backdrop_delayed` in scan notes when VNINDEX lags equity. |
| **Dashboard alignment banner** | **Accurate** — reflects real DB timestamps (VNINDEX behind equity; scan wall-clock newer than benchmark session). |
| **`P0DEXIT` in Best Setups** | **Smoke contamination** — P0D verification run is the **latest** `DailyScanRun` by `runAt`, so dashboard surfaces its sole candidate. |

---

## A. Market data freshness

### Findings table

| Check | Result | Source |
|-------|--------|--------|
| 1. Latest VNINDEX bar date in DB | **`2026-05-05T17:00:00.000Z`** (UTC ISO day **`2026-05-05`**; ~18 calendar days behind probe date) | `index_daily_bars` / `scripts/prod-data-integrity-probe.ts` |
| 2. Latest stock/equity bar date in DB (max) | **`2026-05-06T17:00:00.000Z`** (UTC ISO day **`2026-05-06`**); **55,799** rows | `stock_daily_bars` aggregate |
| 3. Latest successful `DailyScanRun` | **`cmpkmn7fb000144szlz2w38p5`** — `COMPLETED`, `run_at` **`2026-05-24T20:08:46.295Z`** (smoke run; see §B) | `daily_scan_runs` |
| 3b. Latest successful **non-smoke** scan | **`cmpjibukl000004jo92x88ylo`** — `COMPLETED`, `run_at` **`2026-05-24T01:20:11.781Z`**, 189 symbols scanned, **0** surfaced candidates | `daily_scan_runs` |
| 4. Latest failed `DailyScanRun` | **None in recent history** (last 10 runs all `COMPLETED`; no non-`COMPLETED` rows in probe) | `daily_scan_runs` |
| 5. Cron route `/api/cron/daily-scan` | Calls **`runDailyScanJob(prisma)`** only — **no bar fetch/import** | `src/app/api/cron/daily-scan/route.ts` |
| 6. Vercel Cron configured? | **`vercel.json`**: `30 7 * * *` → `/api/cron/daily-scan` | Repo + deployed `main` |
| 6b. Cron actually firing? | **Yes** — non-smoke runs ~**24h** cadence at **`~01:20 UTC`** (May 16–24 sample). Schedule in repo (**07:30 UTC**) differs from observed fire time — **verify in Vercel Cron UI**. | Production `daily_scan_runs.run_at` |
| 7. Scan imports new bars? | **No** — comment in job: *"Uses existing bars/regime only"*. Import is **manual**: `npm run data:vnindex`, `npm run import:bars` | `src/lib/scanner/run-daily-scan-job.ts`, `package.json` |
| 8. Scanner blocks on stale bars? | **No hard block** when index session exists; warns via **`benchmarkBackdrop.delayedBackdrop`** in notes | `run-daily-scan-job.ts` + `isBenchmarkStaleVsEquity` |
| 9. UI shows DB truth? | **Yes** for alignment banner — `fetchMarketSessionSnapshot` + `analyzeMarketDataAlignment` | `market-session-snapshot.ts`, `market-data-alignment.ts`, `dashboard/page.tsx` |

### Why bars show May 5/6 while scan “ran” May 24–25

1. **Cron runs the scanner**, not the data pipeline.  
2. **Nobody has imported** VNINDEX/equity bars on production since early May (operational gap, not cron failure).  
3. **Scanner still completes** using stale `IndexDailyBar` / `StockDailyBar` rows and sets `delayedBackdrop: true` when VNINDEX session &lt; equity max.  
4. **Alignment banner is correct** to show: benchmark EOD **`2026-05-05`**, equity max **`2026-05-06`**, scan runtime **`2026-05-24`** (UTC calendar day from `runAt`; smoke run dominates “latest scan” until excluded).

**Note on display vs user report:** Banner uses `toISOString().slice(0, 10)` (UTC). Regime card uses `formatBarDataDateUtcLong` (UTC long date). Session rows stored at **`17:00:00.000Z`** are the project’s VN EOD convention; do not “fix” the banner by faking dates.

### Active universe

- **`190`** active `StockSymbol` rows (probe).

---

## B. `P0DEXIT` contamination (symbol `P0DEXIT`, not `PODEXIT`)

Created by **`scripts/p0d-exit-health-verification-smoke.ts`** (`RUN_P0D_EXIT_HEALTH_SMOKE=1`, `SMOKE_DATABASE=production`) during Backend P0D verification.

### Root mechanism for Best Setups

`getLatestDailyScanRun()` (before guardrail) used **`orderBy: { runAt: "desc" }`**. The smoke run **`cmpkmn7fb000144szlz2w38p5`** is **newer** than real cron runs, so **`P0DEXIT`** was the only candidate in “latest scan.”

### Exact rows (production)

| Table | ID | Marker | Safe to delete? | Dependency |
|-------|-----|--------|-----------------|------------|
| `stock_symbols` | `cmpkmn5rz000044sz1e3bhyts` | symbol **`P0DEXIT`**, name smoke | **Yes** (after children) | Referenced by candidate, trade, watch item if any |
| `daily_scan_runs` | `cmpkmn7fb000144szlz2w38p5` | `notes.p0dExitHealthSmoke: true` | **Yes** | Parent of setup_candidate below |
| `setup_candidates` | `cmpkmn7p0000244szvgujmpux` | reasons **`P0D_EXIT_HEALTH_SMOKE setup candidate`** | **Yes** | Linked trade; may have watch item |
| `trades` | `cmpkmn7vt000344sznauan3yn` | notes **`P0D_EXIT_HEALTH_SMOKE`**, symbol `P0DEXIT`, `setup_id` → candidate | **Yes** | `setup_outcomes`, `trade_health_logs` |
| `trade_health_logs` | `dd45a4f0-d69d-4455-8e23-3b2d2ba90ebd` | `price_vs_zone`: P0D smoke checkpoint | **Yes** | FK `trade_id` |
| `setup_outcomes` | `cmpkmn8za000444szdyj0j1b5` | entry HEALTHY / exit WARNING (verification) | **Yes** | FK `trade_id`, `setup_id` |

**Not found:** symbol `PODEXIT` (typo variant), `demoSeed` scan runs, additional `P0DEXIT` candidates.

**Latest scan candidates (unfiltered):** only **`P0DEXIT`** (rank 1, quality A).

---

## C. Root cause classification

| Issue | Root Cause | Severity | Fix Type |
|-------|------------|----------|----------|
| Stale VNINDEX / equity bars (~May 5–6) | Bar import is **manual CLI**, not wired to cron; no production import since early May | **P1_HIGH** | **IMPORT_PIPELINE** + **DOCS_RUNBOOK** |
| Scan runs on stale backdrop | Scanner intentionally uses DB-only bars; warns but does not block | **P2_MEDIUM** | **SCANNER_GUARD** (optional fail/warn threshold) |
| Alignment banner “stale” | Accurate reflection of DB; not a UI bug | **P3_LOW** | **DOCS_RUNBOOK** (ops: import then re-scan) |
| `P0DEXIT` in Best Setups | P0D smoke `DailyScanRun` is newest by `runAt`; no production filter | **P0_BLOCKER** (operator trust) | **TEST_DATA_CLEANUP** + **guardrail** (implemented) |
| P0D smoke script on production | Verification script creates persistent rows; gated but still runnable | **P1_HIGH** | **DOCS_RUNBOOK** + process |
| Cron schedule vs observed time | Repo `30 7 * * *` vs runs ~`01:20 UTC` | **P3_LOW** | **CRON_CONFIG** (verify in Vercel) |

---

## D. Proposed cleanup plan (do not execute without approval)

**Order (FK-safe):**

1. `DELETE FROM setup_outcomes WHERE trade_id = 'cmpkmn7vt000344sznauan3yn';`
2. `DELETE FROM trade_health_logs WHERE trade_id = 'cmpkmn7vt000344sznauan3yn';`
3. `DELETE FROM trades WHERE id = 'cmpkmn7vt000344sznauan3yn';`
4. `DELETE FROM setup_watch_items WHERE symbol_id = 'cmpkmn5rz000044sz1e3bhyts';` (if any)
5. `DELETE FROM setup_candidates WHERE id = 'cmpkmn7p0000244szvgujmpux';`
6. `DELETE FROM daily_scan_runs WHERE id = 'cmpkmn7fb000144szlz2w38p5';`
7. `DELETE FROM stock_symbols WHERE id = 'cmpkmn5rz000044sz1e3bhyts';` (only if no other FKs)

Also documented in `scripts/p0d-exit-health-verification-smoke.ts` header.

**After cleanup:** Re-run probe; confirm `getLatestDailyScanRun` resolves to **`cmpjibukl000004jo92x88ylo`** (0 surfaced candidates until real setups exist).

---

## E. Proposed guardrails

### Implemented (safe, non-destructive)

- **`src/lib/scanner/production-smoke-markers.ts`** — detects `p0dExitHealthSmoke`, `demoSeed`, symbols `P0DEXIT`/`PODEXIT`/`DEMOSETUP`, reason markers.
- **`getLatestDailyScanRun()`** — skips smoke-tagged runs (30-run lookback); filters smoke candidates.
- **Tests:** `production-smoke-markers.test.ts`

### Recommended follow-up slices

1. **Ops / import slice (P1):** Run `npm run data:vnindex` + equity fetch/import against production with `--end-date` aligned to latest session; document in `production-data-alignment-runbook.md`.
2. **Cleanup slice (P0):** Execute §D deletes after explicit approval.
3. **Scanner guard (P2):** Optional `NO_TRADE` or `FAILED_STALE_BARS` when `delayedBackdrop` and equity max older than N sessions.
4. **Smoke process (P1):** Never run P0D smoke on production; use dedicated staging DB; add CI check blocking `P0DEXIT` in active universe.

---

## F. Recommended fix slice (priority order)

| Priority | Slice | Outcome |
|----------|-------|---------|
| 1 | **Deploy guardrail** (this change) | Dashboard/Setups no longer show `P0DEXIT`; latest scan = last real cron run |
| 2 | **Approved smoke cleanup** | Remove 6 rows; restore trustworthy “latest scan” metadata |
| 3 | **Production bar refresh** | Import VNINDEX + equities through latest session; re-run cron or manual scan |
| 4 | **Optional scanner stale guard** | Prevent silent scans on very old bars |

---

## G. Code references

```73:76:src/lib/scanner/run-daily-scan-job.ts
/**
 * Core persistence path shared by `run-daily-scanner.ts` and `/api/cron/daily-scan`.
 * Uses existing bars/regime only — same semantics as the CLI scanner (rules unchanged).
 */
```

```1:7:vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-scan",
      "schedule": "30 7 * * *"
    }
  ]
}
```

---

## H. Validation (local)

Run after code changes:

```bash
npm run lint
npm test
npm run build
```

---

## I. Approval question for next action

> **Approve production smoke cleanup (§D) and a production bar-import runbook execution (VNINDEX + equities through latest session), or deploy guardrail-only first and schedule import separately?**
