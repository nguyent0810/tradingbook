# Forward out-of-sample protocol — frozen 2026-08-14

**Written because §0 found no true out-of-sample data**
([`OOS-DATA-AUDIT.md`](OOS-DATA-AUDIT.md)). Per §13, the response is not to
recycle old data but to freeze a forward test now, before any of its outcomes
exist.

**This document is not editable after the first forward outcome is read.** Edits
before that date must be recorded as edits, with a reason, and dated.

---

## What is frozen

| item | value |
|---|---|
| strategy commit | **`4762d10`** |
| universe snapshot | [`oos/universe-snapshot-2026-08-13.json`](oos/universe-snapshot-2026-08-13.json) — 355 symbols with bars, 1,537 registry rows |
| holdout starts | **2026-08-14**, the first session after the last stored bar |
| last in-sample setup | 2026-08-07 |
| reference rates | old era 40.8% (n=285) · new era 27.3% (n=289) · breakeven 33.3% |

### Strategy — nothing may move

Gate 1, Gate 2, the breakout-pullback definition, tradability, stop construction,
the executable stop floor, the continuation and failure definitions, ATR, the
horizons, the deduplication rule, the entry convention, the structural stop, and
every threshold, all as of `4762d10`.

If production changes any of them, **the holdout restarts**. It does not
continue with a note. A strategy that has been edited mid-test is not the
strategy being tested.

### Universe — the leak this closes

Two ways a forward test leaks its universe, both closed by the snapshot:

1. **Later curation.** A symbol added to the registry in 2028 arrives already
   selected by how it behaved in 2027. Registry membership therefore confers
   nothing: eligibility comes from the snapshot or from the mechanical admission
   rule below, never from a curation decision.
2. **Backfilled prehistory.** Importing a symbol pulls its full history, so a
   late addition would silently supply pre-holdout bars. No bar dated on or
   before **2026-08-13** may enter a holdout setup's outcome channel.

Point-in-time universe resolution still applies *within* the snapshot — a symbol
that stops trading drops out on bar evidence, exactly as in-sample.

Delisting inside the holdout is a real outcome and must be recorded as one, not
dropped. This is the survivorship hole the historical sample could not close, and
it is the one thing a forward test closes for free.

**New listings — admitted mechanically, never by judgement.** A ten-year holdout
frozen to 355 names would drift away from the market a real trader faces, since
companies that list in 2028 would be permanently invisible. The rule, fixed here:

> A symbol not in the snapshot becomes eligible on the **first session it clears
> the frozen tradability floors**, and only from that session forward. Its earlier
> bars never enter any outcome channel. No symbol is ever admitted, excluded, or
> re-ordered by a human decision, by a tactical-symbol note, or by anything other
> than those floors.

This requires bars to be fetched *broadly* rather than for a curated list — the
admission test cannot be applied to a symbol whose bars were never pulled. If the
pipeline cannot fetch broadly, the holdout runs on the snapshot alone and the
narrowing is reported as a limitation, not hidden.

**On the objection that the snapshot is itself survivorship-biased:** it is not.
Survivorship bias is conditioning on survival *through* the test window. The
snapshot conditions only on being alive at the *start*, which is exactly what any
trader on 2026-08-14 could see. What the snapshot does carry is the curation
history that produced those 355 names — a real selection, but one made entirely
before the holdout begins and therefore blind to its outcomes.

---

## The three questions — frozen, and no others

| id | question | metric |
|---|---|---|
| **F1** | does forward P(continuation) clear the 2:1 breakeven? | P(cont) vs 33.3%, one-sided |
| **F2** | is forward behaviour nearer the old era or the new one? | P(cont) − 40.8% and P(cont) − 27.3% |
| **F3** | does the payoff structure still carry, or is failure hit-rate driven? | conditional MFE/ATR among continuations; MAE/ATR among failures |

**F1 is primary.** F2 and F3 are reported with intervals and carry no verdict of
their own. No fourth question may be added later.

---

## Stopping rule — frozen now

| requirement | value |
|---|---|
| minimum unique setups (post-dedup, resolved) | **753** |
| minimum independent quarters | **39** (≈ 10 years) |
| governing test | one-sided, α = 0.05, **quarter**-cluster permutation |
| secondary, reported alongside | month-cluster permutation |

Both minima must be met. If setups accumulate faster than periods, the test waits
for the periods; the previous phases established that 572 setups over 119 months
is roughly 119 observations, not 572.

### Which cluster level — measured, not assumed

Measured on the 574 scored in-sample setups:

| cluster level | clusters | mean size | ICC | design effect |
|---|---|---|---|---|
| month | 119 | 4.82 | 0.0829 | 1.317 |
| **quarter** | 47 | 12.21 | 0.0609 | **1.683** |
| symbol | 112 | 5.13 | **0.0000** | **1.000** |

**Symbol is not a cluster level.** With 112 symbols contributing up to 16 setups
each, the within-symbol correlation of the continuation outcome measures exactly
zero. The dedup rule already removes same-symbol repeats at the same breakout
level within 20 sessions, and what remains carries no dependence. Two-way
symbol × time clustering would add nothing.

Quarter clustering is **more** conservative than month, and the project's history
is a history of under-correcting for clustering, so the governing test is the
quarter-level one. Month-level is reported alongside; if the two disagree, the
result is reported as cluster-level sensitive, not resolved.

### Why 753

From measured in-sample quantities: quarter ICC **0.0609**, month ICC **0.0829**,
recent rate **~78 unique setups/year**.

| distance from breakeven to detect | n (quarter) | years | n (month) | years |
|---|---|---|---|---|
| 4.00pp | 1,827 | 23.4 | 1,251 | 16.0 |
| 5.00pp | 1,169 | 15.0 | 801 | 10.3 |
| **6.23pp** — new era's shortfall | **753** | **9.7** | 516 | 6.6 |
| 7.52pp — old era's margin | 520 | 6.7 | 356 | 4.6 |
| 10.00pp | 293 | 3.8 | 201 | 2.6 |
| 12.50pp | 187 | 2.4 | 129 | 1.7 |

And what shorter waits buy, one-sided at 80% power:

| years | setups | SE (quarter) | MDE (quarter) | MDE (month) |
|---|---|---|---|---|
| 1 | 78 | 7.78pp | 19.35pp | 16.01pp |
| 2 | 156 | 5.50pp | 13.69pp | 11.32pp |
| 3 | 234 | 4.49pp | 11.17pp | 9.25pp |
| 5 | 390 | 3.48pp | 8.66pp | 7.16pp |
| 8 | 624 | 2.75pp | 6.84pp | 5.66pp |
| **10** | **780** | **2.46pp** | **6.12pp** | 5.06pp |

753 is the smallest sample that can detect a shortfall the size of the new era's
under the governing cluster level. Anything less answers a question nobody asked:
a three-year test rules out only rates below 22% or above 45%, and both eras sit
inside that band.

**Add universe attrition on top.** Of the 355 frozen symbols, 16 have already
stopped trading — 9 last traded in 2024, 7 in 2025 — about **1.7% per year**. Over
a ten-year holdout that removes roughly 15% of the universe and the setup rate
falls with it, so **the realistic wait is 10–11 years, not 9.7.**

### Interim looks — one futility boundary, frozen now

A ten-year single-look design is indefensible if the strategy is losing money
throughout. One interim look is therefore **pre-specified here**, before any data
exists, which is what keeps it from being a fishing expedition:

| when | test | action |
|---|---|---|
| at **234 setups** (~3 years) | one-sided quarter-cluster test of P(cont) ≥ 33.3% | if the upper bound of the 95% one-sided interval falls **below 33.3%**, stop for **futility** |

Futility only. **The interim look cannot stop the test for success**, so no alpha
is spent on the efficacy side and the final α = 0.05 stands unadjusted. If the
interim does not trigger, the test continues to 753 with no re-look and no
further interim analyses. This boundary is not adjustable later.

### Interim reporting

Descriptive counts may be published at any time — setups accumulated, quarters
elapsed, raw rate. **No p-value, no interval, and no verdict** outside the one
pre-specified futility look and the final analysis. A rate that looks decisive at
month 18 is not decisive; the MDE table above is the reason.

---

## Inference — the corrections eleven phases paid for

- Statistics computed on **quarter aggregates** for the governing test and on
  month aggregates for the secondary; labels permuted across whole clusters.
  Observation-level intervals are prohibited.
- Every estimator **recalibrated before its result is read**: block permutation,
  labels shuffled preserving month, synthetic clustered null, repeated Monte
  Carlo, heavy-tail sensitivity. Empirical FPR reported.
- If nominal α does not reproduce: `FORWARD INFERENCE PIPELINE NOT CALIBRATED`,
  and no result is interpreted.

The percentile-bootstrap failure documented earlier in this project was caused by
**temporal clustering, not heavy tails** — cluster-level statistics fix it and
permutation alone does not. That correction carries forward.

---

## Data quality gate — thresholds set now

Reported before any outcome, and failing any of these means
`FORWARD OOS DATA QUALITY FAILURE`:

| check | threshold |
|---|---|
| missing sessions vs the index calendar | < 1% of symbol-sessions |
| bars with high < low, or non-positive OHLC | 0 (importer already drops these) |
| stale bars (close unchanged with zero volume) | reported, and excluded from tradability as today |
| calendar gap between consecutive bars | the frozen 21-day tradability rule |
| adjustment discontinuities | flagged where an unexplained overnight move exceeds the daily limit |
| source | `vnstock:VCI` only — no blending, ever |

The known basis mismatch — adjusted prices against raw share volume — is carried
forward unchanged rather than corrected, because correcting it would change
`medTradedValue` and therefore tradability, which is a strategy change.

---

## What this protocol cannot do

Stated now so it cannot be quietly forgotten later:

- It tests **F1**, whether the strategy clears breakeven going forward. It does
  **not** identify the mechanism of the historical decay. Eleven phases failed at
  that and this one will not succeed at it either.
- A single forward window is one regime draw. A pass does not establish a durable
  edge; a fail does not prove the pattern never works.
- It cannot distinguish "the strategy is broken" from "the market has been
  unfavourable for six years", because those are the same observation.

---

## Decision note — this protocol is not free

Per §16, this is a recommendation and nothing is implemented.

The forward test costs **~10 years** at the current setup rate, and 10–11 once
universe attrition is counted. During that window the strategy's own in-sample
estimate of itself is **−0.18 ATR per trade**. Running it live to find out is not
a neutral measurement; it is a wager that the in-sample estimate is wrong, paid
for at the in-sample rate.

The pre-specified futility look at ~3 years bounds the downside: if the strategy
is decisively below breakeven it can be abandoned then. But three years is the
soonest *any* honest answer arrives, and only for the pessimistic branch.

Two things follow, and they are not in conflict:

1. **Freeze the protocol anyway** — it costs nothing to freeze, it closes the
   survivorship hole the historical data never could, and it means that if the
   strategy is ever run again, the evidence accumulates under rules set before
   anyone saw the answer. This document is that freeze.
2. **Do not wait on it to make the strategy decision.** The decision gate should
   be settled on what is already established: the hit rate fell from 40.8% to
   27.1%, at a 2:1 structure that moves expectancy from +0.22 to −0.18 ATR, and
   no stock-level or market-level variable in this project explains it.

There is also a cheaper, non-exclusive option that this phase's audit surfaced
and that is **not** out-of-sample: **1,174 of 1,526 listed Vietnamese symbols
have never been fetched** — 281 on HOSE, 249 on HNX. Scanning them over the
historical period would raise the setup count in both eras, which is the only
identified route past the power ceiling that blocked the last phase. It is
`CONTAMINATED` for validation and must never be reported as OOS, but it is
legitimate for the attribution question the forward test does not address.
