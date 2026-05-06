# Gate 2 near-miss watchlist (read-only diagnostics)

## What this is

The **near-miss watchlist** lists **tradable** symbols whose Gate 2 breakout-pullback evaluation returned **INVALID**, sorted by **deepest pipeline stage first** (closest to completing the checklist before failing). It reuses the same `evaluateBreakoutPullbackCandidate` logic as the daily scanner but **does not** write `SetupCandidate` rows and **does not** change scoring or thresholds.

## What this is not

- **Not a setup.** Near-miss rows are **diagnostics only**.
- **No trade** should be taken from this list alone. Official setups remain Tier **A** / **B** evaluations that the scanner persists according to existing Gate 1 surfacing rules.
- **Not a loosening** of Gate 2. If a symbol appears here, it **failed** Gate 2 under current rules.

Use the watchlist to **monitor** names that might approach acceptable structure on **future** scans (e.g. price pulling back into the zone after an “above pullback zone” near-miss).

## Diagnostic hint categories

Each row includes a **`watchlistDiagnosticCategory`** string for quick scanning (derived from the terminal INVALID category; informational only):

| Label | Typical meaning |
|-------|-----------------|
| Above pullback zone — wait | `pullback_zone_interaction` with price above the pullback box (positive distance fraction). |
| Near pullback zone — watch confirmation | Same terminal category but not clearly extended above the box (e.g. below zone or ambiguous). |
| Trend not aligned — ignore for now | `trend_below_ma50`. |
| MA weak — watch later | `trend_ma20_below_ma50`. |
| Risk/reward invalid — avoid | `stop_structure`. |
| Other near-miss — review reasons | Remaining terminals (breakout recency, digestion, volume caps, etc.). |

## Commands

**Compact watchlist (table, default top 20):**

```bash
npm run scanner:near-miss
```

**Same data as JSON:**

```bash
npx tsx scripts/scanner-near-miss.ts --json
```

**More rows (table or JSON):**

```bash
npx tsx scripts/scanner-near-miss.ts --limit=40
npx tsx scripts/scanner-near-miss.ts --limit=40 --json
```

**Full Gate 2 audit JSON** (includes `nearMissWatchlist` and sensitivity breakdown):

```bash
npx tsx scripts/audit-gate2-sensitivity.ts
```

**Watchlist-only JSON slice** (smaller payload):

```bash
npx tsx scripts/audit-gate2-sensitivity.ts --watchlist-only --near-miss-limit=20
```

## Output fields (JSON)

For each near-miss row (INVALID only):

- `symbol`, `terminalCategory`, `failedReasons`
- `watchlistDiagnosticCategory`
- `close`, `ma20`, `ma50`, `maRelationship`
- `riskToStopFrac`, `distanceToPullbackZoneFrac` (when computable)
- `breakoutLevel`, `pullbackZoneLow`, `pullbackZoneHigh`, `stopLevel` (Gate 2 may zero some fields on INVALID; zone bounds may be recovered from reason text when applicable)
- `stageRank`, `rankScore`

Constants and mapping live in `src/lib/scanner/near-miss-watchlist.ts`.

## Relation to the daily scanner

The production **`run-daily-scanner.ts`** flow is unchanged. Near-miss tooling is **explicit, offline CLI** for operators and researchers.

See also: [gate2-sensitivity-audit.md](./gate2-sensitivity-audit.md).
