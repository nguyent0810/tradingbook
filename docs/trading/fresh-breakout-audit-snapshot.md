# Fresh Breakout Audit Snapshot (Production)

Generated: `2026-05-07T06:38:07.813Z`
Expected latest VNINDEX session: `2026-05-06`

## Guardrails

This lane is **observational only** and **does not represent validated core setups**.
No `SetupCandidate` writes, no UI, and no Gate2/scanner logic changes.

## 1) Targeted audit: `--symbols=GEX,GEE --json`

Effective universe merge:
- `CORE`: 189
- `TACTICAL`: 2
- `BOTH` overlap: 0
- `effectiveCount`: 191

### GEX
- `universeSource`: `TACTICAL`
- `tradability`: PASS
- Labels: `FRESH_BREAKOUT`, `MOMENTUM_IGNITION`
- Risk annotations: `STOP_FAR`
- Group: `ACTIONABLE_WATCH`
- Key diagnostics (latest bar `2026-05-06`):
  - close: `29.35`
  - closeAbovePrior20DayHigh: `true` (prior high `28.66`)
  - breakoutExtensionPct: `2.41%`
  - distanceFromMa20Pct: `6.95%`

### GEE
- `universeSource`: `TACTICAL`
- `tradability`: PASS
- Labels: `RECLAIM_THRUST`
- Risk annotations: `STOP_FAR`
- Group: `ACTIONABLE_WATCH`
- Key diagnostics (latest bar `2026-05-06`):
  - close: `114.20`
  - closeAbovePrior20DayHigh: `false` (prior high `114.68`)
  - breakoutExtensionPct: `null`
  - distanceFromMa20Pct: `6.30%`

## 2) Broad audit (tradable-focused): `--tradable-only --limit=30 --json`

This run uses the improved ranking/filtering path:
- evaluates full effective universe first (`totalRowsEvaluated: 191`),
- filters with `tradableOnly=true`,
- excludes failed-risk-only/no-label rows by default (`includeFailedRisk=false`),
- ranks deterministic watch rows before applying `limit`.

Returned rows: `5`
Group summary:
- `ACTIONABLE_WATCH`: 5
- `EXTENDED_WATCH_ONLY`: 0
- `AVOID_RISK`: 0
- `COVERAGE_TRADABILITY_BLOCKED`: 0

### Top label categories (row counts)

1. `FRESH_BREAKOUT`: 4
2. `MOMENTUM_IGNITION`: 2
3. `RECLAIM_THRUST`: 1

### Top risk annotations (row counts)

1. `STOP_FAR`: 2

### Symbols appearing in the requested label set

`FRESH_BREAKOUT` (4): `BMS`, `CTG`, `BWE`, `GEX`
- Sources: `CORE` = 3 (`BMS`, `CTG`, `BWE`), `TACTICAL` = 1 (`GEX`)

`MOMENTUM_IGNITION` (2): `BMS`, `GEX`
- Sources: `CORE` = 1 (`BMS`), `TACTICAL` = 1 (`GEX`)

`EXTENDED_NO_PULLBACK` (0): none in this tradable-focused slice

Top 5 returned rows (ranked):
1. `BMS` (`CORE`) — `FRESH_BREAKOUT`, `MOMENTUM_IGNITION`
2. `CTG` (`CORE`) — `FRESH_BREAKOUT`
3. `BWE` (`CORE`) — `FRESH_BREAKOUT`
4. `GEX` (`TACTICAL`) — `FRESH_BREAKOUT`, `MOMENTUM_IGNITION` + `STOP_FAR`
5. `GEE` (`TACTICAL`) — `RECLAIM_THRUST` + `STOP_FAR`

## 3) Comparison: core scanner setups produced = 0

Latest production daily scan (DB inspection):
- `candidateCountSurfaced`: `0`
- `setupCandidatesCreated`: `0`

So, in production, even when this secondary audit surfaces watch candidates (including tactical names), the **core** Gate2 discipline still results in **no Tier A/B setups surfaced/created** in this latest scan.

## 4) Interpretation (not trade signals)

- GEX looks like a **clean fresh-breakout-style** bar under the audit’s diagnostic definitions, but this lane remains watchlist-only; it does not assert actionability.
- GEE is flagged as **reclaim thrust** without passing the “close above prior N-day high” condition in this latest snapshot.
- The new tradable-focused broad run is materially less noisy than the prior alphabetic slice and surfaces a compact watchlist dominated by tradable fresh-breakout/reclaim rows.

