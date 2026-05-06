# Universe quality curation

## Why this exists

The daily scanner’s tradability gate assumes **fresh session-aligned bars** and minimum history on **`StockSymbol.active`** tickers. A ramp such as `seed-stock-symbols.ts --ramp-target=300` activates the **first N symbols alphabetically** from the provider/static list. Many of those tickers are **illiquid, stale in vnstock, or thinly covered**, so a large share never gets a bar on the **VNINDEX latest session** date even after a healthy import ([bar-freshness-diagnostic.md](./bar-freshness-diagnostic.md)).

Curation **does not change scanner scoring or thresholds**. It only chooses **which rows are `active`** using reproducible CLI flags, so scans run on a higher-quality subset.

## Non-goals

- No scanner gate loosening (liquidity, value, price, trend, etc.).
- No Tier B surfacing changes.
- No UI or analytics.
- No hidden filtering inside the scanner — eligibility is **explicit** in `curate-active-symbols.ts` and must be run deliberately.

## Scripts

### Report

```bash
npx tsx scripts/report-symbol-universe-quality.ts
npx tsx scripts/report-symbol-universe-quality.ts --sample=60
```

Outputs JSON for **currently active** symbols: counts with bars, latest-session alignment, **staleness buckets** (1 day / 2–5 days / >5 days vs expected VNINDEX session, plus missing bars), and **per-symbol** failure counts aligned with `evaluateTradability` / `TRADABILITY_REASON` (volume, value, price, stale session, gap, insufficient history). Multi-reason failures mean breakdown totals can exceed symbol counts.

### Curation (dry-run by default)

Without **`--apply`**, the script prints a plan only (no `StockSymbol` updates).

```bash
# Plan only
npx tsx scripts/curate-active-symbols.ts --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d

# Persist: set active=true for selected rows, active=false for all others; refresh active-symbol-keys.json
npx tsx scripts/curate-active-symbols.ts --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d --apply
```

Flags:

| Flag | Meaning |
|------|--------|
| `--target=N` | Cap on activated symbols (default `300`). |
| `--require-latest-bar` | Latest stored daily bar’s **UTC calendar day** must equal VNINDEX expected session. |
| `--min-bars=N` | Minimum `StockDailyBar` rows (default **`120`**, same as `TRADABILITY_MIN_BARS`). |
| `--require-tradability` | Keep only symbols that **pass** full `evaluateTradability` (implies freshness + liquidity + gap rules — **stricter**, smaller pool). |
| `--sort=alphabetical` \| `--sort=liquidity20d` | Rank eligible symbols; `liquidity20d` uses mean volume of the last **20** stored bars (descending), tie-break by symbol. |
| `--apply` | Perform DB updates and write `data/active-symbol-keys.json` (ignored by git; used by `fetch_stock_bars.py`). |

If fewer than `target` symbols match filters, **all eligible** symbols are activated and a warning is printed.

### Validation sequence

After `--apply`, optionally refresh bars for the new active list (session-aligned end date from `report-bar-coverage.ts`), then verify:

```bash
npx tsx scripts/report-bar-coverage.ts
npx tsx scripts/report-symbol-universe-quality.ts
npx tsx scripts/run-daily-scanner.ts
```

Record: latest-session coverage among actives, **passedTradability**, **setupCandidatesInserted**, **failedCount** (scanner telemetry).

## Before / after (example run, local DB)

Recorded after prior bar import with expected session **2026-05-05**.

| Metric | Before (300 active, alphabetical ramp) | After curation (`--require-latest-bar`, `--min-bars=120`, `--sort=liquidity20d`, `--apply`) |
|--------|----------------------------------------|--------------------------------------------------------------------------------------------|
| Active symbols | 300 | 208 |
| Latest-session bar coverage (`report-bar-coverage.ts`) | ~59% (178/300) | **100%** (208/208) |
| Tradability pass (`run-daily-scanner.ts`) | 34 | **67** |
| Scanner failed symbols | 0 | 0 |
| `setupCandidatesInserted` | 0 | 0 |

Zero setups here reflects **Gate 2 / market shape**, not ingestion; the bottleneck moved from **stale bars** to **playbook + liquidity gates** on a cleaner universe.

## Recommendation

1. Use **`report-symbol-universe-quality.ts`** before large ramp changes to see staleness vs liquidity failures.
2. Prefer **`curate-active-symbols.ts`** with **`--require-latest-bar`** and **`--min-bars=120`** when you want full session alignment without tightening liquidity beyond the scanner (tradability still filters volume/value on scan).
3. Use **`--require-tradability`** when you want the active list to match **exactly** what can pass Gate 0 — expect **far fewer** than 300 actives.
4. To restore a provider-based alphabetical ramp, run **`npx tsx scripts/seed-stock-symbols.ts --ramp-target=300`** again (that resets activation pattern from seed logic, not curation filters).
