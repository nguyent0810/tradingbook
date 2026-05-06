# Bar freshness diagnostic (latest session vs VNINDEX)

This document records evidence from the data-ingestion path and a controlled re-fetch aligned to the index session day. Scanner scoring and tradability gates were **not** changed.

## Pipeline (inspected)

1. **Fetch**: `scripts/fetch_stock_bars.py` pulls daily equity history via vnstock (VCI path), writes `data/stock-bars.json`. Optional **`--end-date YYYY-MM-DD`** caps the history window end so the provider request matches the **same UTC calendar day** as the latest VNINDEX bar (recommended when the server calendar day is ahead of the last completed session).
2. **Import**: `scripts/import-stock-bars.ts` upserts bars into `StockDailyBar` with source tag `vnstock:VCI`.
3. **Expected session**: `getExpectedLatestSessionFromIndexBars` in `src/lib/scanner/expected-session.ts` uses the latest **`IndexDailyBar`** row for **`VNINDEX`** as the canonical “last completed EOD session” for freshness alignment.
4. **Coverage CLI**: `npx tsx scripts/report-bar-coverage.ts` counts active symbols whose **latest stored bar’s UTC calendar day** equals that expected session day.

## Diagnosis: root cause

- **Persistence / import**: Ruled out. After import, file date range and DB “latest bar date” matched the fetch window through **2026-05-05** (UTC).
- **Fetch end-date vs session**: Aligning fetch with `--end-date 2026-05-05` (matching `expectedLatestSessionDay` from VNINDEX) improved **latest-session coverage only marginally** (177 → 178 of 300). So the dominant issue is **not** “import dropped the last day” or a single global end-date skew.
- **Provider / listing reality**: A large subset of active seeded symbols still have their **last daily bar before** the index session (often **2026-05-04** or much older). That pattern is consistent with **thinly traded, suspended, or otherwise stale listings** in the provider feed—not a scanner bug.

## Metrics (local validation run, 2026-05-06)

| Step | Metric | Value |
|------|--------|--------|
| Seed | Active symbols | 300 |
| Pre aligned-fetch | `activeWithLatestSessionBar` (expected day **2026-05-05**) | **177** (~59%) |
| Post fetch `--end-date 2026-05-05` + import | `activeWithLatestSessionBar` | **178** (~59.3%) |
| Post run | `activeStaleOrMissingLatestSession` | **122** |

**Scanner** (`npx tsx scripts/run-daily-scanner.ts` after the above):

- `expectedLatestSession`: **2026-05-05**
- **Tradability passed**: **34 / 300**
- **Tradability breakdown** included **120** symbols with “Latest bar date does not match expected last session” (multi-reason accounting can exceed 122 stale names).
- **Setups**: `setupCandidatesInserted`: **0** (JSON field name in runner output)

## Recommendations (next steps, still no scanner rule changes)

1. **Operational**: Keep using **`--end-date` = `expectedLatestSessionDay`** from `report-bar-coverage.ts` when refreshing bars so requests are session-aligned; expect **small** coverage gains unless the universe is cleaned up.
2. **Universe quality** (optional, separate from scoring): Reduce active symbols that are structurally stale in vnstock (illiquid / bad codes) via seed or a **prefilter** before scan—without touching tradability thresholds.
3. **Re-scan**: After any universe cleanup, repeat fetch → import → `report-bar-coverage.ts` → `run-daily-scanner.ts` and compare **latest-session coverage** and **tradability pass** again.

## Commands reference

```bash
npx tsx scripts/report-bar-coverage.ts
python scripts/fetch_stock_bars.py --limit 300 --sleep 3.2 --end-date <YYYY-MM-DD-from-report>
npx tsx scripts/import-stock-bars.ts
npx tsx scripts/run-daily-scanner.ts
```
