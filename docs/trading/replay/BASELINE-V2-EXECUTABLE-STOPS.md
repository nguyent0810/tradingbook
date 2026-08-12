# Baseline v2 — executable stops, RS re-measured, Gate 1 left alone

**Date:** 2026-08-12 · Same replay engine, same universe, same metrics as v1
**Runs:** [`baseline.json`](baseline.json) (v1) · [`baseline-v2.json`](baseline-v2.json) (v2)
**Integrity:** 0 guard violations in both

---

## 1. What changed, and what deliberately did not

| Item | Action |
|---|---|
| Gate 1 | **Unchanged.** Marked `SUSPECT — INSUFFICIENT EVIDENCE` in [`gate1-market.ts`](../../../src/lib/playbook/gate1-market.ts) with the evidence and the reason for not acting |
| Stop feasibility | New model: `max(tick floor, fee floor, volatility floor)` |
| Volatility coefficient | Chosen from mechanics **before** measurement, never fitted |
| RS validator | Hard cap removed; re-run on a window that can actually produce a sample |
| Scanner constants | **None changed.** v2 is an option on the replay, not a production edit |

---

## 2. The stop floor ([`stop-feasibility.ts`](../../../src/lib/scanner/stop-feasibility.ts))

Three floors, each answering a different question about whether a stop can exist
at all. The binding maximum wins, and which one bound is reported so a rejection
is explicable.

| Floor | Basis | Value |
|---|---|---|
| **Tick** | A quoted spread is ≥1 tick; entry lifts the offer, the stop crosses the bid. 2 ticks is the minimum separation at which a stop-out is a price move rather than the spread crossed twice. | 2 × tick / price |
| **Fee** | Round-trip brokerage + 0.1% transfer tax. Below this a stop-out is dominated by cost. Deliberately set at the *discounted* end (0.4%) so the floor stays permissive. | 0.4% |
| **Volatility** | ATR is the distance an instrument covers in an ordinary session (Wilder 1978, introduced for exactly this). A stop inside 1×ATR is hit by ordinary movement and carries no information about the thesis. | 1.0 × ATR14 / price |

**Nothing here was fitted to the replay.** The tick table is HOSE's published
schedule, the fee is a documented retail range, and 1.0×ATR follows from what ATR
measures. 1.0 is the *weakest* defensible multiple — Wilder's own volatility stop
used ~3×, and 2× is common practice. This is a feasibility floor, not a proposal
about where stops should sit; a larger multiple would be a strategy claim needing
its own evidence. A test pins the constant at 1.0 so it cannot be quietly raised
to improve a backtest.

**In practice only volatility ever binds:** of 139 decision-time rejections,
**139 were volatility, 0 tick, 0 fee**. The microstructure argument establishes
that the old 0.3% floor is a specification defect — it permits ~1.3 ticks — but
ATR is what does the work. The tick and fee floors are kept because they are the
part that holds when ATR is unavailable.

### 2.1 A floor at the signal close is not a floor

The first v2 run still contained the REE artefact. The cause was a defect in this
design, not in the data:

| | |
|---|---|
| Decision 2020-07-24, close | 15.04 → stop 14.5728 = **3.11% of room**, passes comfortably |
| Entry 2020-07-27, open | **14.58** — gapped down 3.1% overnight |
| Actual distance to the same stop | **0.049%** → 286R |

The floor was checked where the signal was computed, but the trade fills at the
next open. A gap toward the stop collapses the distance and the decision-time
check never sees it. v2 now re-checks at the entry price
([`trade-model.ts`](../../../src/lib/replay/trade-model.ts)); this is not
look-ahead, because the opening price is observable at the moment the order would
be placed, so declining the fill is a decision a trader could actually make.

This is valid **only** under a conditional-entry workflow: observe the open, then
decide. If the live process instead submits an unconditional at-open order after
T's close, the decline is not available and these 19 trades would be taken. The
execution model has to match the workflow, and that is a choice to make
explicitly rather than inherit from a backtest.

**19 entries were declined this way.** In v1 they carried **285.9R** — and a mean
return of **+0.81%**. That gap between R and money is the whole artefact in one
line; §3.1 prices it exactly.

---

## 3. v1 vs v2

A trade-model defect was fixed first, and it affects both variants equally:
`simulateTrade` scanned for stops from the bar *after* entry, so the entry
session — the one most likely to gap through the stop — could never stop a trade
out, and its excursion was excluded from MFE/MAE. Now the scan starts at the
entry bar. v1 numbers below are the corrected ones.

| | n | win | stop | **expR** | **mean ret** | median ret | min stop | sub-1% stops |
|---|---|---|---|---|---|---|---|---|
| v1 | 498 | 35.5% | 58.4% | **0.971** | **+1.34%** | −2.42% | 0.05% | 6 (313.1R) |
| v2 | 403 | 37.7% | 54.8% | **0.334** | **+1.35%** | −2.70% | 1.26% | **0** |

Expectancy in R falls by two-thirds; realised money per trade does not move. That
is the R-denominator defect being removed, and it confirms the v1 headline was
arithmetic rather than profit.

### 3.1 What the floor cost, split by which decision did the removing

"Total P&L fell 18.8%" is an accounting delta across different trade counts, not
a cost attributable to anything. Partitioning the **v1 opportunity set** by what
v2 did to each trade says which decision cost what:

| group | n | v1 P&L | share of v1 total | mean ret | v1 total R |
|---|---|---|---|---|---|
| kept by v2 | 403 | 542.5% | 81.2% | +1.35% | 134.5 |
| **declined at entry** (gap collapsed the stop) | **19** | **15.5%** | **2.3%** | +0.81% | **285.9** |
| rejected at decision (volatility floor) | 76 | 109.9% | 16.5% | **+1.45%** | 63.1 |

The two halves of the floor are not the same trade-off:

- **Artefact removal is nearly free.** 19 entry declines drop **285.9R — 60% of
  v1's gross R — for 2.3% of the money.** This is the part that should exist.
- **The volatility filter is the expensive part.** It removes 16.5% of P&L, and
  the trades it removes had a *positive* mean return (+1.45%). It buys
  executability, not profit, and it is not free.

Conflating them would have made the floor look like a cheap win. It is one cheap
fix and one real cost.

### 3.2 Sensitivity to the ATR multiple

Predeclared sweep, since the volatility term binds every decision-time rejection
and is therefore effectively the whole filter:

| variant | n | expR | mean ret | min stop | sub-1% | in-sample | holdout [95% CI] |
|---|---|---|---|---|---|---|---|
| v1 (0.3% flat) | 498 | 0.971 | +1.34% | 0.05% | 6 | +2.49% | +0.28% [−0.77, +1.41] |
| v2 @0.75×ATR | 462 | 0.384 | +1.41% | 1.26% | 0 | +2.70% | +0.24% [−0.84, +1.42] |
| **v2 @1.00×ATR** | 403 | 0.334 | +1.35% | 1.26% | 0 | +2.81% | −0.04% [−1.15, +1.14] |
| v2 @1.25×ATR | 319 | 0.301 | +1.32% | 1.26% | 0 | +2.35% | +0.34% [−0.94, +1.76] |

**No conclusion in this document depends on the multiple.** All three remove the
R inflation entirely, leave money per trade at ~+1.35%, and show in-sample
positive with holdout indistinguishable from zero. Note also that 1.0 produces
the *worst* holdout figure of the three — if the constant had been chosen to
flatter the result, it would not be 1.0.

The remaining honest caveat: this shows the conclusions are insensitive over
0.75–1.25, not that 1.0 is derivable from first principles alone. The ATR here is
a simple mean of true ranges, not Wilder's smoothed ATR; the code says so, and
the choice removes a warm-up dependency a feasibility floor does not need.

### 3.3 Composition — what kind of setup v2 keeps

The floor does not move stops, so it selects: it keeps setups whose structural
stop already sits ≥1 ATR away. That is a composition change, and it must be
disclosed rather than assumed harmless.

| | n | median stop distance | MFE | MAE | stop rate |
|---|---|---|---|---|---|
| kept by v2 | 403 | 4.82% | 8.41 | −4.59 | 54.8% |
| removed by v2 | 95 | 2.56% | 7.38 | −3.72 | 73.7% |

v2 systematically keeps wider-stop, higher-excursion setups and drops tight
shallow ones. Removal is reasonably uniform across years (12.1%–26.7%), so it
does not fall disproportionately on either side of the holdout split — and the
stratified check in §4 confirms the period contrast survives inside the kept
population alone.

---

## 4. Holdout — the finding that matters

Split at **2022-01-01**. Nothing was fitted on either side.

| | n | mean return | 95% CI | reading |
|---|---|---|---|---|
| v2 in-sample (<2022) | 196 | **+2.81%** | [+1.24, +4.46] | **excludes zero** |
| v1 holdout (≥2022) | 258 | +0.28% | [−0.77, +1.41] | includes zero |
| v2 holdout (≥2022) | 207 | −0.04% | [−1.15, +1.14] | includes zero |

**This is not "v2 made the holdout negative".** Both v1 and v2 holdout means are
statistically indistinguishable from zero — there was never a positive holdout
result for the floor to destroy. The equal-weight totals (+71.1% → −7.5%) are
sums over ~200 noisy trades whose means are both zero, and that framing overstates
the case.

### 4.1 Is 2022 a real break, or a split chosen after the fact?

Comparing two noisy estimates and naming the gap proves nothing on its own. The
test is whether 2022 separates the data better than arbitrary nearby dates. Every
half-year split with ≥40 trades on each side:

| split | pre mean | post mean | gap |
|---|---|---|---|
| 2021-01-01 | +1.84% | +1.09% | +0.75 |
| 2021-07-01 | +2.15% | +0.79% | +1.35 |
| **2022-01-01** | **+2.81%** | **−0.04%** | **+2.84** |
| 2022-07-01 | +2.53% | +0.02% | +2.51 |
| 2023-01-01 | +2.16% | +0.23% | +1.94 |
| 2024-01-01 | +1.70% | +0.41% | +1.29 |

**2022-01-01 ranks 1st of 17 candidate splits.** It is the strongest of the
splits tested. That is corroboration, not proof it was not convenient: the
candidate set itself was chosen after seeing the year table, so this rules out
"an arbitrary nearby date would have done as well", not "the date was picked to
suit the story".

Two honest qualifications: the neighbouring splits (2022-07, 2023-01) are also
large, so this reads as a **decline across 2022–2023 rather than a knife-edge
break**; and the split dates were tested after seeing the year table, so this is
corroboration, not an independent test.

**Stratified within the v2-kept population only.** This removes the objection
that the v1→v2 contrast is a kept-vs-removed composition effect. It does **not**
rule out composition drifting inside the kept set over time — that would need
stratifying by sector, price and volatility per period:

| | n | mean | 95% CI |
|---|---|---|---|
| pre-2022 | 196 | +2.81% | [+1.24, +4.46] |
| post-2022 | 207 | −0.04% | [−1.13, +1.14] |

> With stops that can actually be placed, this strategy earned a measurable
> return before 2022 and has earned nothing since. Median return is negative in
> every holdout year.

---

## 5. RS rank ordering — now a verdict instead of a shrug

The validator's `--lookbackSessions` was hard-capped at 120
([`gate2-rs-rank-comparison.ts`](../../../scripts/gate2-rs-rank-comparison.ts)),
which yielded ~20 candidates and forward-outcome buckets of n≈1–4. A cap that
bounds evidence below the level needed for any verdict is worse than no
diagnostic, because the output still looks like a result. Cap removed.

Re-run over 2,000 sessions: **715 candidates, 373 promoted, 329 demoted.**

| RS20 quintile | median RS20 | fwd20 mean | fwd20 median |
|---|---|---|---|
| Q1 (weakest) | −2.41% | +3.96% | +0.73% |
| Q2 | +1.60% | +1.84% | +0.74% |
| Q3 | +4.36% | +4.77% | +1.70% |
| Q4 | +7.34% | +2.11% | +0.78% |
| **Q5 (strongest)** | **+12.66%** | **−0.59%** | **−1.85%** |

The strongest-RS quintile is the worst on **both** mean and median. The rank term
`clamp(RS20_pp × 25, −250, +250)` adds up to +250 to exactly those names.

Promoted vs demoted on means: +1.43% vs +3.73%, p=0.014 — but the **median**
difference is −0.01pp with CI [−1.14, +1.53], i.e. zero. The mean gap lives
entirely in the tail, so "RS is inverted for the typical trade" is **not**
supported. The quintile table is the load-bearing evidence, and it is post-hoc.

**Verdict: NO-GO on enabling the RS rank term.** `productionRsRankEnabled` is
already `false`, and nothing here argues for turning it on.

**But this is not "RS validated", and the section heading should not be read that
way.** The validator carries the same defects the replay was fixed for:

- it seeds from `where: { active: true }` — today's curation flag, the exact
  survivorship bias removed from the replay in the previous phase;
- it evaluates tradability **once at the anchor session**, not per replay row;
- it is a single anchor (2026-08-11 looking back), not a walk-forward over
  independent anchors;
- the quintile cut is post-hoc, and it was not run on the v2 executable-stop
  population.

So the honest status is: **NO-GO as a risk decision, on evidence that does not
favour the term and is itself contaminated.** Enabling a rank term needs positive
evidence, and there is none; that is enough to keep it off, and not enough to
call the question settled. Fixing the validator's universe seeding is the
prerequisite for any stronger statement.

---

## 6. Where this leaves things

| Question | Answer |
|---|---|
| Does the R-based edge survive executable stops? | **No.** 0.958R → 0.332R with money unchanged |
| Does the strategy have an edge on the holdout? | **No, and neither did v1.** Both indistinguishable from zero |
| Is the stop floor a coefficient-dependent result? | **No.** Conclusions hold at 0.75×, 1.00× and 1.25× ATR |
| Did it ever work? | **Before 2022, yes** — +2.87% per trade, CI excludes zero, with executable stops |
| Is the stop floor a profit lever? | **No.** Artefact removal is nearly free (60% of gross R for 2.3% of P&L); the volatility filter costs 16.5% of P&L and buys executability, not profit |
| Should RS rank be enabled? | **No** — n=715 shows nothing in its favour, though the validator itself is survivorship-contaminated |
| Should Gate 1 change? | **Not yet** — suspect, not demonstrated |

The open question is no longer "is the edge real" but **"what broke in 2022, and
is it the market or the strategy?"** That is answerable with the data now in
place, and it does not require touching a single parameter first.
