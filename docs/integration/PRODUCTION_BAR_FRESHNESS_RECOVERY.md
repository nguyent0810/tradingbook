# Production Bar Freshness Recovery

**Executed:** 2026-05-25 (UTC)  
**Environment:** Neon production via `.env.prod.local` (`DATABASE_URL` loaded into shell for import scripts)  
**Prerequisites:** Smoke data cleanup complete; scanner smoke guardrail deployed (`7c43737`).

---

## Root cause

Daily **cron scan was healthy**, but **bar import is manual** and had not been run on production since early May. The scanner only reads existing `index_daily_bars` / `stock_daily_bars`; it does not fetch from vnstock. Stale bars (~2026-05-05/06) produced accurate alignment warnings and zero/low-quality setups.

---

## Pre-run inspection

| Area | File / script / command | Purpose | Risk | Run now? |
|------|-------------------------|---------|------|----------|
| Bar freshness diagnostic | `docs/trading/bar-freshness-diagnostic.md` | Pipeline, `--end-date` alignment, coverage CLI | Low (read) | Yes — reviewed |
| VNINDEX fetch | `npm run fetch:vnindex` → `python scripts/fetch_vnindex.py` | Pull VNINDEX OHLCV → `data/vnindex.json` | Low (local file + network) | Yes |
| VNINDEX import | `npx tsx scripts/import-bars.ts` | Upsert `index_daily_bars` (idempotent) | **DB write** (production) | Yes — after plan |
| Equity fetch | `python scripts/fetch_stock_bars.py` | Pull active symbols → `data/stock-bars.json` | Rate limits / long runtime | Yes |
| Equity import | `npx tsx scripts/import-stock-bars.ts` | Upsert `stock_daily_bars` (idempotent) | **DB write** (production) | Yes |
| Coverage / end-date | `npx tsx scripts/report-bar-coverage.ts` | `expectedLatestSessionDay`, `--end-date` hint | Read-only | Yes |
| Active symbol list | Export `StockSymbol.active` → `data/active-symbol-keys.json` | Drive equity fetch universe | Read from prod | Yes (189 symbols) |
| Daily scan trigger | `GET /api/cron/daily-scan` + `Authorization: Bearer <CRON_SECRET>` | New `DailyScanRun` on fresh bars | Compute / DB write | Yes — after import |
| Alignment runbook | `docs/trading/production-data-alignment-runbook.md` | Ops safety, env handling | Low | Reviewed |
| Verification runbook | `docs/trading/production-verification-runbook.md` | Cron curl pattern | Low | Reviewed |

**Flags:** `fetch_stock_bars.py --end-date YYYY-MM-DD` (match VNINDEX session), `--sleep 3.2`, `--calendar-days 200`.

**Actual table names (not user template):**

- VNINDEX → `index_daily_bars` (`symbol = 'VNINDEX'`)
- Equity → `stock_daily_bars` (join `stock_symbols`)
- Scans → `daily_scan_runs` (`run_at`, `finished_at`, `notes` — no `completed_at` column)

---

## Pre-import DB snapshot

| Check | Value | Query / source |
|-------|-------|----------------|
| VNINDEX latest | `2026-05-05T17:00:00.000Z` (UTC ISO day `2026-05-05`) | `SELECT MAX(date) FROM index_daily_bars WHERE symbol = 'VNINDEX'` |
| Equity max | `2026-05-06T17:00:00.000Z` (55,799 bars) | `SELECT MAX(date) FROM stock_daily_bars` |
| Latest real scan | `cmpjibukl000004jo92x88ylo` · `2026-05-24T01:20:11Z` · COMPLETED · 0 surfaced | `daily_scan_runs` ORDER BY `run_at` DESC |
| Smoke rows | 0 | Post-cleanup probe |

---

## Import plan (executed)

| Step | Command | Idempotent? | Mitigation if partial fail |
|------|---------|-------------|----------------------------|
| 1 VNINDEX fetch | `python scripts/fetch_vnindex.py` | Re-fetch overwrites JSON | Re-run fetch; no DB change until import |
| 2 VNINDEX import | `npx tsx scripts/import-bars.ts` | Upsert by `(symbol, date)` | Re-run import; skips invalid rows |
| 3 Coverage check | `npx tsx scripts/report-bar-coverage.ts` | Read-only | Use `fetchHint` `--end-date` |
| 4 Export active keys | Query 189 `StockSymbol.active` → `data/active-symbol-keys.json` | Local file only | Re-export from DB |
| 5 Equity fetch | `python scripts/fetch_stock_bars.py --sleep 3.2 --end-date 2026-05-25 --calendar-days 200` | Re-fetch JSON | Re-run failed symbols only (manual) |
| 6 Equity import | `npx tsx scripts/import-stock-bars.ts` | Upsert by `(symbolId, date)` | Re-run import (safe) |
| 7 Scan | `curl` production `/api/cron/daily-scan` with Bearer auth | New scan run row | Do not trigger if import failed |

**Expected date range:** ~2024-11-19 .. **2026-05-25** (UTC calendar days in JSON); DB stores session anchors at `17:00:00.000Z` (VN EOD convention).

**Success criteria:** VNINDEX and equity max sessions advance to current week; `report-bar-coverage` `expectedLatestSessionDay` matches fetch end-date; post-scan `benchmarkBackdrop.delayedBackdrop === false`.

---

## Commands run (production)

```bash
# Shell: load .env.prod.local into process env (PowerShell parse)
python scripts/fetch_vnindex.py
npx tsx scripts/import-bars.ts
# → 303 bars, range 2025-03-05 .. 2026-05-25

npx tsx scripts/report-bar-coverage.ts
# → expectedLatestSessionDay: 2026-05-25

# Export 189 active symbols → data/active-symbol-keys.json (one-off TS against prod)

python scripts/fetch_stock_bars.py --sleep 3.2 --end-date 2026-05-25 --calendar-days 200
# → 189 symbols, 27405 bars

npx tsx scripts/import-stock-bars.ts
# → 27405 bars upserted, latest 2026-05-25

curl -H "Authorization: Bearer ***" https://tradingbook-phi.vercel.app/api/cron/daily-scan
# → HTTP 200, scanRunId cmpkpdio9000004lbqy3b9u0k
```

---

## Post-import / post-scan snapshot

| Check | Before | After | Expected? |
|-------|--------|-------|-----------|
| VNINDEX latest (DB) | 2026-05-05 | **2026-05-24** (`17:00Z` = session **2026-05-25** in scanner) | Yes — current session |
| Equity max (DB) | 2026-05-06 | **2026-05-24** (`17:00Z`, bar count **58,288**) | Yes — aligned with import |
| `expectedLatestSessionDay` | ~2026-05-05 | **2026-05-25** | Yes |
| `activeWithLatestSessionBar` | — | **135 / 189** | Partial (provider/universe staleness) |
| `activeStaleOrMissingLatestSession` | — | **54** | Known residual |
| Latest scan `run_at` | 2026-05-24T01:20Z | **2026-05-25T04:25:13Z** | Yes |
| Latest scan id | `cmpjibukl…` | **`cmpkpdio9000004lbqy3b9u0k`** | Yes |
| `benchmarkBackdrop.delayedBackdrop` | true (stale) | **false** | Yes |
| `vnindexSessionDate` / `equityBarsMaxDate` (scan notes) | May 5–6 | **2026-05-25** / **2026-05-25** | Yes |
| Surfaced candidates | 0 | **0** | OK (gate2/tradability; not a freshness failure) |
| Tradability passed | — | **37 / 189** | Improved vs ~34 on stale bars |
| `/api/db-health` | ok | **ok** | Yes |
| P0DEXIT / smoke | absent | absent | Yes |

---

## Scan trigger result

- **HTTP 200**, `ok: true`, `kind: COMPLETED`
- **scanRunId:** `cmpkpdio9000004lbqy3b9u0k`
- **gate1Level:** WARNING
- **expectedLatestSession:** 2026-05-25
- **delayedBackdrop:** false
- **setupCandidatesInserted:** 0 (market/playbook filters — not import failure)

---

## Dashboard alignment banner

| Issue | Before | After |
|-------|--------|-------|
| `benchmark_behind_equity` | Likely yes (May 5 vs May 6) | **No** (same session day in DB) |
| `scan_runtime_after_benchmark_session` | Yes | **May still show** — scan wall-clock UTC day (`2026-05-25`) can exceed `isoDayUtc` of latest bar row (`2026-05-24` from `17:00Z` storage) |
| Stale backdrop copy | Yes | **No** — scan notes `delayedBackdrop: false` |

**Verdict:** Data is **operationally fresh**; banner may show a **mild** scan-vs-EOD calendar mismatch, not stale May 5–6 feeds. Do not fake dates in UI.

---

## Remaining gaps

1. **54 active symbols** still lack bars on the expected session (thin/suspended listings in vnstock).
2. **Bar import not wired to cron** — repeat manual fetch/import or automate (follow-up).
3. **Zero surfaced setups** — scoring/tradability/gate2, not bar pipeline failure.
4. **VNINDEX row UTC display** — banner uses `toISOString().slice(0,10)`; session **2026-05-25** may display as **`2026-05-24`**.

---

## Recommended follow-up

1. **Automate** — implemented in [PRODUCTION_BAR_IMPORT_AUTOMATION.md](./PRODUCTION_BAR_IMPORT_AUTOMATION.md) (GitHub Actions `production-bar-import.yml`).
2. **Universe curation** — reduce structurally stale active symbols (`curate-active-symbols.ts`).
3. **Dashboard FE rebuild** — safe to proceed once alignment behavior is accepted; wire P1 freshness DTO when rebuilding.
4. Optional: document `SMOKE_DATABASE=production` / prod env loader for ops scripts (avoid `.env` localhost mismatch).

---

## Related docs

- `docs/integration/PRODUCTION_DATA_INTEGRITY_INVESTIGATION.md`
- `docs/trading/bar-freshness-diagnostic.md`
- `docs/trading/production-verification-runbook.md`
