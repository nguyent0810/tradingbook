# Scan Coverage Expansion Plan (Pre-Real Usage)

## Why This Plan

Phase 1-5 lifecycle is usable, but setup supply is currently constrained by low scan coverage.  
Objective: increase scanned symbols safely without changing trading lifecycle logic or overloading provider limits.

## Current Architecture Review

### 1) Where scan universe is defined

- **Primary runtime universe:** DB-driven from `StockSymbol` where `active = true`.
- **How it is populated:**
  - `scripts/seed-stock-symbols.ts` loads symbols from:
    1. provider listing (`scripts/list_vn_symbols.py`, vnstock `Listing(source="VCI")`) when available
    2. fallback static file `data/vn-symbols.json`
  - also writes `data/active-symbol-keys.json` for data-fetch scripts.
- **Conclusion:** universe is already centralized and not hardcoded in scanner logic.

### 2) Current scan execution model

- **Trigger model:** manual script (`npx tsx scripts/run-daily-scanner.ts`), typically once per day.
- **Data model:** scanner reads existing DB bars (`StockDailyBar` + `IndexDailyBar`), does not call provider APIs directly.
- **Execution shape:**
  - Tradability pass over all active symbols.
  - Gate 2 candidate evaluation for tradable symbols.
  - Persist one `DailyScanRun` + `SetupCandidate` rows.
- **Current risk areas:**
  - Mostly sequential symbol processing (tradability + Gate 2 loops).
  - No per-symbol try/catch isolation inside loops.
  - One DB/read/eval exception can fail whole run.
  - No explicit run-level `failedCount` per symbol persisted today.

### 3) Current data provider constraints

- Provider fetch path is separate (`scripts/fetch_stock_bars.py` via vnstock/VCI).
- Observed constraints in code:
  - default `--sleep 3.2` seconds between symbol requests (comment notes guest limit around ~20/min).
  - optional `--limit` for capped fetch size.
  - per-symbol exception handling exists in fetch script (failed symbol gets empty bars, process continues).
- **Implication:** provider pressure is mainly in data ingestion, not in scanner runtime itself.

### 4) Current scan result visibility

- User currently sees:
  - total symbols,
  - tradability pass/filter counts,
  - candidate A/B/surfaced counts,
  - rejection diagnostics and failure status text (if run failed).
- Missing today:
  - explicit `scannedCount` vs `failedCount` at symbol execution level,
  - explicit “API/data error symbols” count surfaced as one concise line.

## Safest Implementation Path

### Phase A — Increase universe safely (first)

- Keep universe DB-driven (`StockSymbol.active`) as single source of truth.
- Add a controlled expansion workflow:
  - seed/activate symbols to a **modest target (100-300)** first.
  - use provider fetch `--limit` and conservative sleep for initial ramp.
- Add small operational guardrails:
  - document recommended first ramp (e.g. 100 -> 200 -> 300),
  - verify import coverage before each bump.

### Phase B — Batch scanner hardening (second)

- Add internal batching for symbol loops (fixed chunk size).
- Add per-symbol error isolation so one failure does not abort full run.
- Persist scan summary fields for each run:
  - `totalSymbols`
  - `scannedCount`
  - `failedCount`
  - `setupCandidatesCreated`
  - `startedAt`
  - `finishedAt`
- Keep Gate logic unchanged (no scoring/rule changes).

### Phase C — UI coverage visibility (after A+B)

- Add one simple line on scanner surfaces:
  - `Scanned 184 symbols · 12 setups found · 3 failed`
- Keep this as plain text status (no new analytics page, no charts).

### Phase D — Later only (defer)

- Multi-run per day / intraday scans.
- Sector-specific scans.
- Watchlist-scoped scans.
- Provider optimization/cache layers.

## MVP Safety Notes

- Do not alter trading lifecycle transitions.
- Do not change setup scoring/ranking rules.
- Avoid scheduler complexity for now; keep manual/once-daily operational cadence.
- Respect provider limits during data-fetch expansion.

## Recommendation: Can Phase A+B be implemented now?

**Yes — with low-to-moderate risk, and safe to start now** if done in the sequence above:

1. controlled universe expansion (100-300),
2. scanner error-isolation + summary hardening.

Reason: universe is already centralized in DB, and the biggest current reliability gap is symbol-level fault isolation, which is a contained scanner hardening task that does not require lifecycle or scoring changes.

## Runbook (Ramp Commands)

Use `StockSymbol.active` as the only scanner universe switch.

1. Ramp to 100 active symbols:
   - `npx tsx scripts/seed-stock-symbols.ts --ramp-target=100`
2. Fetch bars cautiously (provider throttle):
   - `python scripts/fetch_stock_bars.py --limit 100 --sleep 3.2`
3. Import bars:
   - `npx tsx scripts/import-stock-bars.ts`
4. Run scanner in capped mode (optional extra safety while validating):
   - PowerShell: `$env:SCAN_SYMBOL_LIMIT=100; npx tsx scripts/run-daily-scanner.ts`

Repeat with 200, then 300.

### Coverage Validation After Each Ramp

- Confirm active universe:
  - check seed summary line: `Active symbols in DB: ...`
- Confirm scan resilience and coverage:
  - scanner line: `Scanned X/Y symbols · Z setups found · F failed`
- Keep `F` low before moving to the next ramp step.

### Provider Caution

- Keep guest-rate pacing from fetch script (`--sleep >= 3.0`).
- Avoid aggressive jumps from 100 to 300+ in one run if fetch failures spike.

## Ramp Execution Results

Execution date: 2026-05-05 (local)

### 100 target

- Command: `npx tsx scripts/seed-stock-symbols.ts --ramp-target=100`
- Seed result:
  - provider listing unavailable, static fallback used
  - active symbols after ramp: `39` (not 100)
- Coverage check:
  - active with any bars: `39/39`
  - active with latest session bar: `39/39`
- Scanner result:
  - `Scanned 39/39 symbols · 0 setups found · 0 failed`
  - `setupCandidatesCreated = 0`
  - `startedAt` and `finishedAt` populated

### 200 target

- Command: `npx tsx scripts/seed-stock-symbols.ts --ramp-target=200`
- Seed result:
  - static fallback used
  - active symbols after ramp: `39` (universe cap unchanged)
- Scanner result:
  - `Scanned 39/39 symbols · 0 setups found · 0 failed`
  - `setupCandidatesCreated = 0`
  - run completed without early abort

### 300 target

- Command: `npx tsx scripts/seed-stock-symbols.ts --ramp-target=300`
- Seed result:
  - static fallback used
  - active symbols after ramp: `39` (universe cap unchanged)
- Scanner result:
  - `Scanned 39/39 symbols · 0 setups found · 0 failed`
  - `setupCandidatesCreated = 0`
  - run completed without early abort

### Observed anomalies

- Universe cap blocker:
  - current symbol source available to seed path yields only `39` symbols
  - because of this, 100/200/300 effective ramps cannot be realized yet
- Setup supply blocker:
  - all runs completed cleanly, but surfaced setup count stayed `0` in this market/regime snapshot
  - this is a market-condition/scanner-output issue, not a runtime stability failure

### Final recommended steady-state ramp (current environment)

1. Keep scanner running on full currently available universe (`39`) while maintaining daily stability checks.
2. Unblock symbol universe expansion first:
   - restore provider listing path or refresh static symbol source to >300 symbols.
3. After universe source is expanded, rerun the same validated ramp sequence:
   - 100 -> 200 -> 300 with identical checks (`scanned`, `failed`, `setupCandidatesCreated`, no early abort).
4. Keep provider fetch throttling conservative during expansion (`--sleep >= 3.0`).

