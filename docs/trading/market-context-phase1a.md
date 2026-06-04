# Market context Phase 1A — forward-only VCI foreign snapshots

**Status:** Implemented (data layer + ops only). Scanner, rankScore, tiering, and UI unchanged.

## Scope

Phase 1A persists **session-cumulative foreign flow** from `vnstock` **VCI `Trading.price_board`** at each production bar import. It does **not** use `foreign_trade`, KBS, or historical backfill.

### Tables

| Table | Role |
|-------|------|
| `foreign_trade_daily` | Raw EOD foreign snapshot per symbol/session |
| `market_context_daily` | VNINDEX-derived benchmark + market foreign rollups |
| `symbol_market_context_daily` | Per-symbol vol MA20 context + foreign rollups |

### Foreign fields

- **Volume:** share counts (`buyVolume`, `sellVolume`, `netVolume`)
- **Value:** full VND nominal (`buyValueVnd`, `sellValueVnd`, `netValueVnd`) — not thousand-VND/share
- **Source:** `vnstock:VCI`
- **Capture method:** `PRICE_BOARD_EOD_SNAPSHOT`

### Rollups

| Field | When populated |
|-------|----------------|
| `foreignNetValue1d` | Immediately when `dataQuality = OK` |
| `foreignNetValue5d` | After ≥5 forward sessions with OK symbol rows (symbol) or ≥5 built market rows (market) |
| `foreignNetValue10d` | After ≥10 sessions (same rules) |

Market aggregates sum **OK-only** symbol 1d values.

## Pipeline (GHA)

After equity bar import in `production-bar-import.yml`:

1. `print-expected-session-day.ts` → `sessionDate`
2. `fetch_foreign_snapshot.py` (batched `price_board`, `--sleep 3.2`)
3. `import-foreign-flow.ts`
4. `build-market-context.ts`
5. `verify-market-context-health.ts` (non-blocking: `|| true`)

Daily scan trigger is unchanged and **does not read** market context tables.

## Local commands

```bash
# After bars are imported and DATABASE_URL is set:
SESSION=$(npx tsx scripts/print-expected-session-day.ts)
npx tsx scripts/export-active-symbol-keys.ts --out data/active-symbol-keys.json
python scripts/fetch_foreign_snapshot.py \
  --symbols-file data/active-symbol-keys.json \
  --session-date "$SESSION" \
  --output data/foreign-snapshot.json
npx tsx scripts/import-foreign-flow.ts data/foreign-snapshot.json --expect-session "$SESSION"
npx tsx scripts/build-market-context.ts --session-date "$SESSION"
npx tsx scripts/verify-market-context-health.ts --session-date "$SESSION" --json
```

npm shortcuts: `fetch:foreign`, `import:foreign`, `build:market-context`, `ops:verify-market-context`.

## Migration

`20260603120000_market_context_phase1a`

Deploy with existing runbook: `npm run db:migrate:deploy` before first GHA run that imports foreign snapshots.

## Ops risks

1. **Guest rate limit (~20 req/min):** full universe needs batching (`--batch-size 10`) and `--sleep 3.2`. Burst fetch can hard-stop the process.
2. **No historical backfill:** 5D/10D stay null until enough forward captures exist (~5–10 trading sessions).
3. **Session timing:** capture runs post-close in GHA (~19:30 ICT). Intraday re-runs overwrite the same `(symbolId, sessionDate)` row.
4. **VNINDEX excluded:** index foreign fields are always zero via `price_board`; market aggregate is universe sum only.
5. **Foreign failure is non-blocking:** health warnings do not fail the workflow; scan still runs on bars only.
6. **First deploy:** migration must land before import scripts run against production.

## Step 0 reference

See `scripts/spike_foreign_trade.py` and `data/spike-foreign-trade-report.json` for API probe results that led to this design.

## Out of scope (Phase 1A)

- Decision Cockpit / Setups UI chips
- Gate 2 / rankScore / tier changes
- `SetupCandidate.reasons` enrichment
- `vnstock_data` historical foreign API
