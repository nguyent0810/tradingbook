# Fresh Breakout Audit CLI (MVP Slice 1)

## Purpose

`scripts/fresh-breakout-audit.ts` provides a **read-only diagnostic/watchlist lane** for fresh breakout and momentum continuation behavior.

It is intentionally separate from the core breakout-pullback scanner.

> Fresh breakout audit is observational only and does not represent validated core setups.

## Relationship to core scanner

- Core scanner (`run-daily-scan-job`) remains the canonical setup engine.
- This audit lane does **not**:
  - modify Gate2 logic,
  - create `SetupCandidate` rows,
  - mutate scanner state,
  - provide trade suggestions.
- It exists to show names the core scanner may intentionally skip (e.g. continuation / no-pullback behavior).

## Commands

Run default table output:

```bash
npx tsx scripts/fresh-breakout-audit.ts
```

JSON output:

```bash
npx tsx scripts/fresh-breakout-audit.ts --json
```

Limit rows:

```bash
npx tsx scripts/fresh-breakout-audit.ts --limit=50
```

Filter symbols:

```bash
npx tsx scripts/fresh-breakout-audit.ts --symbols=GEX,GEE
```

Combine flags:

```bash
npx tsx scripts/fresh-breakout-audit.ts --symbols=GEX,GEE --limit=20 --json
```

Tradability-focused output:

```bash
npx tsx scripts/fresh-breakout-audit.ts --tradable-only --limit=30 --json
```

Include risk-only failed breakout rows:

```bash
npx tsx scripts/fresh-breakout-audit.ts --include-failed-risk --limit=30
```

## Universe scope

The script evaluates the effective scan universe using the same merge concept as production scanner:

- `CORE`
- `TACTICAL`
- `BOTH`

## Default filtering and ranking

The CLI now evaluates the merged universe first, then ranks/filter rows before `--limit` is applied.

Default behavior is intentionally focused:

- hides empty-label rows,
- hides `FAILED_BREAKOUT_RISK`-only rows unless `--include-failed-risk` is set,
- keeps diagnostics read-only and non-executional.

Ranking order (deterministic):

1. Group priority:
   - `ACTIONABLE_WATCH`
   - `EXTENDED_WATCH_ONLY`
   - `AVOID_RISK`
   - `COVERAGE_TRADABILITY_BLOCKED`
2. Tradability pass first
3. Label priority:
   - `FRESH_BREAKOUT`
   - `MOMENTUM_IGNITION`
   - `RECLAIM_THRUST`
   - `EXTENDED_NO_PULLBACK`
   - `FAILED_BREAKOUT_RISK`
4. Lower risk annotation count
5. Higher volume ratio
6. More reasonable extension bucket
7. Symbol as final tie-break

Use `--tradable-only` to suppress coverage/liquidity-blocked rows.

## Current diagnostics (MVP)

Per-symbol latest-session diagnostics include:

- close above prior N-day high (default lookback: 20)
- above MA20 / MA50
- volume expansion vs prior 20-day average volume
- breakout extension %
- distance from MA20 / MA50
- tradability pass/fail + reasons
- stale session flag (vs latest VNINDEX session)

## Labels (diagnostic only)

- `FRESH_BREAKOUT`
- `MOMENTUM_IGNITION`
- `RECLAIM_THRUST`
- `EXTENDED_NO_PULLBACK`
- `FAILED_BREAKOUT_RISK`

## Risk annotations

- `EXTENDED`
- `STOP_FAR`
- `LOW_LIQUIDITY`
- `BELOW_MA50`
- `NO_PULLBACK`
- `STALE_DATA`

## Interpretation guide

- Labels indicate structural/momentum behavior observed by this audit lane.
- Risk annotations highlight why the behavior is not automatically actionable under core setup discipline.
- Rows in this report are **watchlist diagnostics**, not setup approvals.
- Group meanings:
  - `ACTIONABLE_WATCH`: strongest diagnostic watch rows under this lane.
  - `EXTENDED_WATCH_ONLY`: momentum present but extended/no-pullback context.
  - `AVOID_RISK`: mainly defensive/risk labels.
  - `COVERAGE_TRADABILITY_BLOCKED`: stale or tradability-blocked context.

## Guardrails

- No ranking language such as “best picks”.
- No execution advice.
- No persistence to setup tables.
- No replacement of core scanner outputs.
