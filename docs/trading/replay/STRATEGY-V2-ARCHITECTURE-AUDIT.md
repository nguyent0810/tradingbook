# V1 architecture audit — what the current strategy actually does

**Date:** 2026-08-14 · Phase 13 §0 · Read against commit `9738e69`
**Rule:** no code was changed. Every claim below cites the line that makes it true.

---

## The finding, before the detail

The architecture is not missing a risk-budget layer. **It has one, and it is not
wired to the market.**

- `computePositionSizing()` already computes per-trade risk budget, a portfolio
  exposure ceiling, a per-trade notional cap and a liquidity cap.
- `computeDailyTradingDecision()` already emits `NO_TRADE | PROBE | NORMAL` with
  allocation bands.
- Neither knows the other exists. **No call site of `computePositionSizing`
  passes any market-state input**, and no consumer of the `PROBE` decision passes
  it to sizing. `PROBE` is a string rendered on a dashboard.

And one variable does two jobs it should not share:

> **`quality: "A" | "B"` decides both whether a candidate is visible in a
> WARNING market and how much risk it may take.**
>
> — visibility: [`collect-candidates.ts:32`](../../../src/lib/scanner/gate2/collect-candidates.ts)
> — risk: [`position-sizing.ts:34`](../../../src/lib/position-sizing.ts)

`quality` is set by `volRatio >= 1.5 && close >= ma20`
([`breakout-pullback.ts:398`](../../../src/lib/scanner/gate2/breakout-pullback.ts)) —
a stock participation measure. So the market gate expresses itself through a
stock label, which is precisely the conflation §1 of the brief names.

---

## Current flow, as built

```
INDEX BARS (through T)
   │
   ├─ evaluateMarketRegime()            gate1-market.ts:66
   │     close vs MA50  ×  last-3-close momentum
   │     → PASS | WARNING | FAIL
   │
UNIVERSE (point-in-time)                 point-in-time-universe.ts
   │
   ├─ evaluateTradability()              tradability.ts
   │     120 bars · vol20 ≥ 100k · value20 ≥ 2bn ₫ · close ≥ 10k ₫ · gap ≤ 21d
   │
STOCK BARS (through T)
   │
   ├─ evaluateBreakoutPullbackCandidate()   breakout-pullback.ts:146
   │     close ≥ MA50, MA20 ≥ MA50            ← second MA50 gate
   │     breakout within 10 bars of 20d range high
   │     digestion dip, zone interaction, depth ≤ 4%, extension ≤ 5%
   │     volRatio ≥ 1.2
   │     stopLevel = minLowSinceBreakout × 0.99
   │     validateSwingTradeStructure()  → riskFrac ≥ 0.3% or INVALID
   │     rankScore computed here            ← ranking happens INSIDE gate 2
   │     → quality: INVALID | A | B
   │
   ├─ GATE 1 SURFACING FILTER            collect-candidates.ts:99-100
   │     FAIL    → drop everything
   │     WARNING → keep quality A only
   │     PASS    → keep A and B
   │
SURFACED CANDIDATE
   │
   ├─ computeDailyTradingDecision()      trading-decision.ts:20
   │     (gate1Level × A/B counts) → NO_TRADE | PROBE | NORMAL + allocation STRING
   │     ────────── consumed only by dashboards ──────────
   │
   └─ computePositionSizing()            position-sizing.ts:49
         inputs: equity, exposure caps, entry, stop, quality
         NO market-state input
         → share count
```

The dashed line is the architecture's defect: the market-state signal and the
risk-sizing engine are on opposite sides of it and nothing crosses.

---

## The seven §0 questions, answered

### 1. Where does Gate 1 block a candidate?

At **surfacing only**, in three places that share one helper:

| site | line |
|---|---|
| production scan | [`run-daily-scan-job.ts:308-310`](../../../src/lib/scanner/run-daily-scan-job.ts) |
| library path | [`collect-candidates.ts:99-100`](../../../src/lib/scanner/gate2/collect-candidates.ts) |
| replay | [`replay-engine.ts:370-372`](../../../src/lib/replay/replay-engine.ts) |

All three call `deriveGate1SurfacingRule()`, which is the single source of truth
and correctly shared. The block is a **list filter**, not a risk decision.

### 2. What does WARNING do?

`"tier-a-only"` — B candidates are discarded from the surfaced list. It also
routes `computeDailyTradingDecision` to `PROBE` with allocation `"20-40%"` when
at least one A exists, and `NO_TRADE` otherwise
([`trading-decision.ts:51-63`](../../../src/lib/scanner/trading-decision.ts)).

That allocation is a **display string**. Nothing reads it to size anything.

### 3. What does PASS do?

Surfaces A and B, and routes the decision to `NORMAL` / `"50-70%"`. Same string,
same non-effect. PASS also carries the finding from the Gate 1 audit that it
performed **worse** than WARNING on the same tier — recorded in the source itself
at [`gate1-market.ts:46-64`](../../../src/lib/playbook/gate1-market.ts) and left
deliberately unchanged.

### 4. Is Gate 2 run when Gate 1 has not passed?

**Yes — always.** `evaluateBreakoutPullbackCandidate` is called for every tradable
symbol at [`collect-candidates.ts:88`](../../../src/lib/scanner/gate2/collect-candidates.ts),
eleven lines *before* the Gate 1 test. A and B counts are tallied pre-filter
(`:96-97`) and diagnostics are recorded for every symbol including rejected ones.

**This is the most important fact in the audit.** The evaluation a V2 needs in a
hostile market already runs today and is already thrown away. Surfacing a strong
stock in a weak market is not new computation — it is un-discarding a result.

### 5. Does ranking happen before or after the market gate?

**Before.** `rankScore` is computed inside Gate 2 at
[`breakout-pullback.ts:388`](../../../src/lib/scanner/gate2/breakout-pullback.ts),
so it exists for every candidate whether or not Gate 1 later drops it.

It is also **never used to cut anything** — only to order. In the replay, every
surviving candidate becomes a trade ([`replay-engine.ts:384`](../../../src/lib/replay/replay-engine.ts),
`for (const c of kept)`), with no top-N, no concurrency limit and no weighting.
So the measured expectancy is per-trade, equal-weight, unbounded-concurrency.

### 6. Is there a position sizing / risk budget concept?

Yes, and it is better developed than the market side:

| control | where | binds? |
|---|---|---|
| per-trade risk budget = equity × riskPct × qualityMultiplier | [`position-sizing.ts:100-102`](../../../src/lib/position-sizing.ts) | yes |
| portfolio **notional** ceiling | `:97-98` | yes |
| per-trade notional cap | `:105` | yes |
| liquidity cap (% of ADV) | `:106-109` | yes |
| **aggregate open risk** | [`portfolio-service.ts:39`](../../../src/lib/paper-lab/portfolio/portfolio-service.ts) | **no — computed and displayed only** |

Two gaps follow:

- **Market state is not an input.** Verified at all three call sites
  ([`trades.ts:183`](../../../src/app/actions/trades.ts), `trades.ts:414`,
  [`setups-candidate-position-sizing.tsx:70`](../../../src/components/setups-candidate-position-sizing.tsx)):
  the only regime-ish argument is `quality`.
- **The portfolio ceiling is on notional, not on risk.** Ten positions each
  sized to a full risk budget consume ten risk budgets; nothing sums
  `riskAtStopVnd` against a limit. `openRiskVnd` is computed in the paper-lab
  subsystem and rendered in a drawer
  ([`AgentDetailDrawer.tsx:58`](../../../src/components/paper-lab/AgentDetailDrawer.tsx)),
  never compared to anything.

### 7. Can a candidate be surfaced without a full-risk entry?

**Not representable today.** The surfaced list is a flat array of
`SetupCandidate` with no risk annotation, and the position lifecycle is
`PLANNED | OPEN | CLOSED | CANCELLED` (`prisma/schema.prisma:123`) — there is no
state between "not a trade" and "a trade".

The nearest thing is `DailyTradingDecision.level = PROBE`, but it is a
**portfolio-day stance**, not a per-candidate one, and it does not reach sizing.

---

## Failure modes this creates

**F1 — Binary permission where a budget belongs.** A market judged WARNING
removes B candidates entirely rather than funding them smaller. The only
expression of "less confident" is "less visible".

**F2 — One variable, three jobs.** `quality` sets visibility under WARNING, the
risk multiplier, and the daily stance. A change to what "A" means moves all
three at once, and none of them can be studied separately.

**F3 — Trade feasibility kills setup validity.** `validateSwingTradeStructure`
returns INVALID when `riskFrac < 0.3%`
([`breakout-pullback.ts:132-135`](../../../src/lib/scanner/gate2/breakout-pullback.ts)),
so a structurally sound pattern whose stop is too close to be executable is
erased rather than marked unexecutable. The reverse case is worse: there is **no
upper bound on stop distance at all**, so a setup with a very wide structural
stop passes validity and then consumes a full risk budget at whatever size that
implies.

**F4 — Two collinear MA50 gates.** The index must be above its MA50 for PASS
(`gate1-market.ts:33-37`); the stock must be above its MA50 *and* MA20 ≥ MA50
(`breakout-pullback.ts:189-200`). Conditioning on "market state" therefore
removes less independent variation than it appears to — the limitation phases 10
and 11 flagged, visible here as a structural cause rather than a statistical one.

**F5 — Momentum clause fights the setup.** Gate 1 PASS requires the index to have
risen three sessions running, i.e. to be *extended*, at the moment Gate 2 requires
the stock to be *pulled back*. Named as the prime suspect in the source comment
and never acted on.

**F6 — No aggregate risk ceiling.** Nothing prevents N concurrent positions from
summing to N risk budgets. In the replay this is not merely possible, it is what
happens: every surfaced candidate is a trade.

**F7 — Market state has no memory.** `evaluateMarketRegime` is a pure function of
the last 50 closes. It cannot distinguish "first day above MA50 after a
three-month decline" from "fortieth day of an advance", so it cannot express
recovery, extension or deterioration — only position relative to a line.

---

## What is already in place and should be kept

Listing these matters as much as the defects, because a redesign that discards
them would be a rewrite, not a redesign:

- **Gate 2 evaluates unconditionally** — the input a budgeted architecture needs.
- **`rankScore` is decomposed and explainable**
  ([`rank-components.ts:74`](../../../src/lib/scanner/gate2/rank-components.ts)),
  with its known ATR-vs-flat divergence documented in place.
- **Rejection codes are enumerated** (`rejection-codes.ts`), so "why not" is
  already machine-readable — the observability contract of §11 has a foundation.
- **The stop is genuinely structural** — swing low with a 1% cushion, derived
  from price, not from a target R:R.
- **The executable stop floor exists and is separate** — `stop-feasibility.ts`
  computes max(tick, fee, volatility) floors with no fitted coefficients.
- **Point-in-time discipline is enforced** by `createPointInTimeGuard`, and the
  surfacing rule has one implementation shared by production and replay.
- **Sizing already handles liquidity and portfolio caps** — the hard part of a
  risk engine is built.

---

## Scope note

This audit describes V1 as of `9738e69` and changes nothing. The V2 design that
follows is in [`STRATEGY-V2-ARCHITECTURE.md`](STRATEGY-V2-ARCHITECTURE.md); V1
remains the frozen control per §12 of the phase brief.
