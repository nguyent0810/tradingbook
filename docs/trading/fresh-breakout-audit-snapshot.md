# Fresh Breakout Audit Snapshot (Production)

Generated: `2026-05-07T06:17:21.025Z`
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
- Key diagnostics (latest bar `2026-05-06`):
  - close: `114.20`
  - closeAbovePrior20DayHigh: `false` (prior high `114.68`)
  - breakoutExtensionPct: `null`
  - distanceFromMa20Pct: `6.30%`

## 2) Broad audit: `--limit=30 --json`

Broad run note: `universeSource` in this slice ended up being **CORE-only** because the first 30 symbols in the merged universe are alphabetically CORE symbols (TACTICAL symbols like GEX/GEE fall outside the first 30).

### Top label categories (row counts)

1. `FAILED_BREAKOUT_RISK`: 11
2. `RECLAIM_THRUST`: 3
3. `FRESH_BREAKOUT`: 3
4. `MOMENTUM_IGNITION`: 1

### Top risk annotations (row counts)

1. `LOW_LIQUIDITY`: 27
2. `BELOW_MA50`: 19
3. `STOP_FAR`: 2

### Symbols appearing in the requested label set

`FRESH_BREAKOUT` (3): `AAM`, `ADG`, `ADP` — all `CORE`

`MOMENTUM_IGNITION` (1): `ADP` — `CORE`

`EXTENDED_NO_PULLBACK` (0): none in this broad slice

## 3) Comparison: core scanner setups produced = 0

Latest production daily scan (DB inspection):
- `candidateCountSurfaced`: `0`
- `setupCandidatesCreated`: `0`

So, in production, even when momentum-like behavior exists (e.g. GEX/GEE on the targeted run), the **core** Gate2 discipline still results in **no Tier A/B setups surfaced/created** in this latest scan.

## 4) Interpretation (not trade signals)

- GEX looks like a **clean fresh-breakout-style** bar under the audit’s diagnostic definitions, but this lane remains watchlist-only; it does not assert actionability.
- GEE is flagged as **reclaim thrust** without passing the “close above prior N-day high” condition in this latest snapshot.
- In the broad slice, most flagged rows are dominated by risk annotations like **LOW_LIQUIDITY** / **BELOW_MA50**, consistent with the core scanner’s preference for more disciplined structures.

