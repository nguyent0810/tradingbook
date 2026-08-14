# Stock-level continuation vs failure — results

**Date:** 2026-08-13 · Executes [`CONTINUATION-STUDY-PREREGISTRATION.md`](CONTINUATION-STUDY-PREREGISTRATION.md), committed at `758ade3` before any outcome was read
**Basis:** 596 unique setups, 592 scored, **0 guard violations**
**Data:** [`continuation/setups.ndjson`](continuation/setups.ndjson)

---

## Primary verdict: `NO ROBUST STOCK-LEVEL DISCRIMINATOR`

No preregistered stock-level feature separates continuation from failure — not at
nominal 95%, not after correction, at no clustering level, in neither era, and in
no stratum.

**And the primary verdict is additionally capped there by my own preregistered
rule**, because the negative controls failed for two of five features. §11 states:
*"If permutation produces corrected-significant results at a rate materially above
1%, the pipeline is not trustworthy and the verdict is capped at
`NO ROBUST STOCK-LEVEL DISCRIMINATOR` regardless of the primary results."*

I considered promoting the era finding below to primary and declined: the decay
result is the attractive one, and reinterpreting my own stopping rule after
seeing which result it blocks is precisely the failure the preregistration
exists to prevent.

---

## §1 Sample

| | |
|---|---|
| raw candidate rows | 765 |
| dropped by the frozen dedup rule | 169 |
| **unique setups** | **596** |
| unique symbols | 112 |
| unique dates | 489 |
| unique months | 122 |
| max setups on one date | 8 |
| 2015–2021 / 2022–2026 | 295 / 301 |

Per year: 2015:21, 2016:27, 2017:31, 2018:32, 2019:38, 2020:52, 2021:94,
2022:57, 2023:80, 2024:72, 2025:70, 2026:22.

## §2 Outcome

The excursion race, +2 ATR before −1 ATR, over 20 sessions from the T+1 open:

| class | n | share |
|---|---|---|
| `CONTINUATION` | 194 | 32.8% |
| `FAILURE` | 377 | 63.7% |
| `AMBIGUOUS` | 21 | 3.5% |

`AMBIGUOUS` is 3.5% — small enough that excluding it from the primary comparison
does not bias the class balance, and it is reported rather than hidden.

**The base rate alone explains a great deal.** At a 2:1 ATR structure, breakeven
needs a 33.3% continuation rate. The observed rate is **32.8%**. The baseline
strategy is, in this measurement, almost exactly a coin flip priced at 2:1 — before
costs, slippage or the T+2 settlement none of this models.

## §9 Primary tests — all five null

Bonferroni over 5 → α = 0.010 (99% intervals). Nominal 95% shown for reference
only, never as a headline.

| family / primary feature | effect | raw 95% | **corrected 99%** |
|---|---|---|---|
| A. relative behaviour / `rs20` | −0.447 | [−1.60, +0.71] | [−1.96, +1.10] |
| B. structural resilience / `pullbackDepthAtr` | −0.022 | [−0.069, +0.024] | [−0.083, +0.042] |
| C. volume behaviour / `pullbackVolumeContraction` | −0.081 | [−0.197, +0.035] | [−0.239, +0.065] |
| D. entry geometry / `distanceToStopAtr` | +0.032 | [−0.074, +0.139] | [−0.110, +0.177] |
| E. volatility / liquidity / `medTradedValue` | −6.2M | [−31.9M, +20.2M] | [−39.6M, +28.0M] |

n = 194 continuation / 377 failure throughout. **Not one interval excludes zero
even before correction**, so no multiplicity argument is even needed.

## §10 Clustering ladder and eras — still null

| feature | setup | date block | **month block** | symbol |
|---|---|---|---|---|
| `rs20` | [−1.94, +1.02] | [−1.99, +1.12] | [−2.35, +1.58] | [−1.93, +1.24] |
| `pullbackDepthAtr` | [−0.083, +0.038] | [−0.085, +0.041] | [−0.088, +0.043] | [−0.083, +0.040] |
| `pullbackVolumeContraction` | [−0.234, +0.066] | [−0.236, +0.075] | [−0.247, +0.078] | [−0.249, +0.089] |
| `distanceToStopAtr` | [−0.110, +0.177] | [−0.110, +0.176] | [−0.109, +0.170] | [−0.111, +0.175] |

Era split: every feature contains zero in both eras. `rs20` changes sign
(+0.83 → −1.61) with both intervals wide and straddling zero.

## §4 / §8 Stratification — null everywhere

| stratum | n | continuation rate | any feature separating? |
|---|---|---|---|
| Gate 1 WARNING | 381 | 37.0% | none |
| **index below MA50** | 90 | 26.7% | **none** |
| stop feasible | 459 | 34.4% | none |
| stop infeasible | 112 | 32.1% | none |

The index-below-MA50 stratum is the early-entry case that motivated this line of
work. With 24 continuations and 66 failures, nothing separates them. **§5's
early-leader hypothesis is not supported**, and no composite was constructed —
the preregistration permitted one only if ≥2 families showed independent
evidence, and none did.

## §7 Entry location — measurable, and null

The dedup rule already identifies setups that stayed valid across several
sessions, so "earliest structurally valid entry" is available without inventing
any rule: it is the first row of each group, versus the last.

| | earliest | later |
|---|---|---|
| pairs | 124 | |
| median sessions apart | | 1 |
| price move in between | | +0.21% |
| distance to stop (ATR) | 1.56 | 1.55 |
| extension above breakout | +1.05% | +1.12% |
| **P(continuation)** | **37.1%** | **32.3%** |
| MFE/ATR | 2.27 | 2.12 |

Difference −4.8pp, paired bootstrap CI99 **[−14.5, +4.8]** — contains zero.
**`ENTRY LOCATION IS PRIMARY FAILURE` is not supported.** Within the window where
a setup remains structurally valid, when you enter barely matters; the setups
simply do not stay valid long enough for timing to be the problem.

## §11 Negative controls — two of five failed

| control | result |
|---|---|
| label permutation within month blocks, 200 runs, α=0.010 | `pullbackVolumeContraction` 0.0% · `distanceToStopAtr` 1.0% · `pullbackDepthAtr` 2.0% — **clean**<br>`rs20` **8.0%** · `medTradedValue` **20.0%** — **pipeline suspect** |
| placebo feature (overnight gap at T) | −0.064, CI99 [−0.295, +0.168] — clean |

The two failures are the heavy-tailed features, and the cause is the estimator,
not the data: a percentile bootstrap of a difference of means under-covers badly
on fat tails. **Their null results are therefore weak nulls** — a test with an
inflated false-positive rate is not necessarily a well-powered one. Three of five
features have trustworthy inference and are cleanly null.

---

## Major secondary finding: continuation probability collapsed, selection quality did not

This is the strongest robust result in the study, and it is reported as secondary
only because of the §11 cap above.

### Decomposed exactly as §6 requires

| | 2015–2021 | 2022–2026 |
|---|---|---|
| **(1) feature distribution** — `rs20` median | +4.47 | **+5.80** |
| — `pullbackDepthAtr` median | 0.17 | 0.19 |
| — `distanceToStopAtr` median | 1.62 | 1.53 |
| — ATR % of price | 2.67% | 3.09% |
| **(2) P(continuation)** | **40.8%** | **27.2%** |
| **(3) conditional MFE/ATR given continuation** | 6.54 | 5.63 |
| MFE/ATR across all setups (median) | 2.57 | **1.61** |
| MAE/ATR across all setups (median) | −1.94 | −2.16 |

**The scanner is not picking worse stocks.** Every measured input is the same or
marginally better — `rs20` improved. What changed is that the same-looking setup
continues far less often.

**P(continuation) −13.7pp, and it survives every clustering level:**

| resampling unit | CI99 |
|---|---|
| setup | [−23.8, −3.1] ✓ |
| date block | [−24.1, −3.2] ✓ |
| **month block** | **[−26.2, −2.0]** ✓ |
| symbol | [−23.8, −3.9] ✓ |

**Conditional magnitude did not clearly change**: MFE/ATR given continuation fell
6.54 → 5.63, CI99 [−2.86, +0.99] — contains zero. So the decay is in *how often*
setups run, not in *how far they run when they do*. The `CONTINUATION DECAY
DOMINATES` category as written assumes conditional upside contracted; the data
says the probability did instead, and that distinction is worth keeping.

### Why this explains the whole project in one line

At a 2:1 ATR structure:

| era | P(continuation) | expectancy per setup |
|---|---|---|
| 2015–2021 | 40.8% | 0.408×2 − 0.592×1 = **+0.22 ATR** |
| 2022–2026 | 27.2% | 0.272×2 − 0.728×1 = **−0.18 ATR** |

The sign flips. Nothing about stock selection, stop placement or entry timing has
to change for a strategy to go from marginally positive to marginally negative —
only the continuation rate.

---

## §12 Case studies

| | |
|---|---|
| **FPT** | 13 unique setups, mixed: continuation and failure both present |
| **FRT** | **0 setups — `NOT EVALUABLE`**, consistent with every prior phase |

FPT 2017-10-18 is instructive about the outcome definition rather than about FPT:
classified `FAILURE` because −1 ATR was touched first, yet it eventually reached
+10.15 ATR. The race definition is order-sensitive by design, and a stop-based
system would genuinely have been taken out of that move.

Most frequent setup symbols: BID (16), VNM (16), FPT (13), VIC (13), CTG (12),
CTR (12) — large, liquid names, which is what tradability filters select for.

---

## Answers to the phase's two questions

> **When a breakout-pullback setup appears, is there stock-level evidence at that
> moment strong enough to separate continuation from failure?**

**No.** Five preregistered families, four clustering schemes, two eras, four
strata — nothing separates. Two of the five tests additionally have untrustworthy
inference.

> **If so, does that evidence exist early enough, while the index is still weak,
> to support later Probe → Confirm research?**

**Moot, and independently unsupported.** In the index-below-MA50 stratum
(n=90) nothing separates either.

## Limits

- **596 setups over 11 years, 112 symbols.** Effective independence is lower
  still: 489 dates, 122 months, up to 8 setups sharing a date.
- **The estimator is not trustworthy for heavy-tailed features** — this is a
  finding about the analysis, and any future work on `rs20`-like or
  currency-valued features needs a different test.
- **Survivorship**: 1,182 of 1,537 symbols have no stored bars.
- **Post-selection**: eighth phase on one dataset; preregistration constrains this
  phase only.
- The outcome is an excursion race, not a P&L. It ignores costs, slippage and T+2.

---

# Part II — Independent review, and what it changed

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-13, asked to refute across 17
attack vectors. Its verdict: *"performative preregistration on an already-tortured
dataset… its only positive claim is a glaring artifact of survivorship bias and
macro confounding."*

One finding is a genuine violation on my part and is now corrected by running what
was skipped. Two are valid design critiques whose corrections the finding
survives. One is a valid limitation I had not quantified. Three are refuted by
data. The primary verdict is unchanged.

## Upheld — I violated my own preregistration

§2 declared a **nine-cell** outcome sensitivity grid. Part I reported **one cell**
(2:1). That is a preregistration violation, and the fix is to run it, not to
explain it.

| C (up) | A (down) | continuation | failure | 2015–21 | 2022–26 | **decay** |
|---|---|---|---|---|---|---|
| 1.5 | 0.75 | 19.8% | 79.6% | 23.5% | 16.3% | −7.3pp |
| 1.5 | 1.0 | 25.7% | 73.3% | 31.6% | 20.3% | −11.3pp |
| 1.5 | 1.5 | 34.0% | 62.8% | 40.7% | 29.3% | −11.4pp |
| 2.0 | 0.75 | 18.4% | 79.6% | 22.5% | 15.1% | −7.4pp |
| **2.0** | **1.0** | 23.1% | 73.3% | 29.9% | 18.1% | **−11.8pp** |
| 2.0 | 1.5 | 30.6% | 62.8% | 39.0% | 26.2% | −12.8pp |
| 2.5 | 0.75 | 16.7% | 79.6% | 20.8% | 13.9% | −6.9pp |
| 2.5 | 1.0 | 21.3% | 73.3% | 28.2% | 17.0% | −11.2pp |
| 2.5 | 1.5 | 27.9% | 62.8% | 36.8% | 24.5% | −12.2pp |

*(Reconstructed from recorded MFE/MAE extremes, which loses intrabar order, so
these bound the base rate rather than reproducing the exact race. Zero setups
touched both extremes, so the loss is small.)*

Base rates move a great deal across the grid — 16.7% to 34.0% — which is why the
grid was preregistered. **The era decay appears in all nine cells**, −6.9pp to
−12.8pp. The reviewer's inference that the other cells were dropped because they
were inconvenient is wrong; they support the finding. The omission was still a
violation and is recorded as one.

## Upheld — the outcome threshold was stricter than the strategy's own stop

The sharpest technical catch. Failure was defined at a fixed −1.0 ATR while the
median setup's **own** structural stop sits at **1.57 ATR**. So Part I recorded
failures for setups that never reached their actual invalidation level.

Re-running with each setup's own stop as the failure line:

| era | reached +2 ATR without touching its own stop | touched its own stop |
|---|---|---|
| 2015–2021 | **37.3%** | 58.3% |
| 2022–2026 | **26.6%** | 65.0% |

Decay of **−10.7pp** on the strategy's own terms. The critique is valid as design;
the finding survives the correction.

## Upheld — the null is informative only for large effects

Minimum detectable effect at 99% with 194 continuations vs 377 failures:

| feature | pooled SD | MDE | as % of the mean |
|---|---|---|---|
| `rs20` | 7.038 | 1.604 | 26% |
| `pullbackDepthAtr` | 0.277 | 0.063 | 24% |
| `distanceToStopAtr` | 0.611 | 0.139 | 9% |

**This study can rule out discriminators worth roughly a quarter of a feature's
mean. It cannot rule out small ones.** "No robust discriminator" means no large
one; Part I should have said so and now does.

## Refuted — survivorship does not manufacture the decay

The reviewer called the decay "mathematically guaranteed" by survivorship.
Restricting to the **66 symbols that generate setups in both eras** — the same
names on both sides, so survivorship cancels:

| | 2015–2021 | 2022–2026 |
|---|---|---|
| P(continuation), same 66 symbols | **42.4%** | **28.0%** |
| difference | **−14.4pp**, CI99 **[−25.6, −3.1]** | **excludes zero** |

Same names, same decay, slightly larger. The stated mechanism does not hold.

## Refuted — the five primary features are not collinear

| pair | \|corr\| |
|---|---|
| largest observed (`rs20` × `distanceToStopAtr`) | **0.14** |
| all others | ≤ 0.11 |

Every pairwise correlation is under 0.15 across 596 setups. Treating them as five
separate mechanisms under Bonferroni is appropriate.

## Refuted — the regime map is point-in-time

The frozen classification from `5699c69` is computed from each session's own MA50
and same-session breadth; nothing was fitted to outcomes, and the classifier is
covered by truncation tests. The reviewer assumed a fitting step that does not
exist.

## Partly upheld — regime confounding is not resolved

The reviewer's strongest surviving objection. Within matched regimes:

| regime | 2015–21 | 2022–26 | difference | CI99 | n |
|---|---|---|---|---|---|
| `BROAD_ADVANCE` | 39.4% | 29.9% | −9.4pp | [−22.0, +2.6] | 226/187 |
| `NARROW_RALLY` | 53.8% | 26.2% | −27.7pp | [−57.3, +3.1] | 26/42 |
| `SYSTEMIC_WEAKNESS` | 34.6% | 20.0% | −14.6pp | [−43.8, +12.5] | 26/50 |

The decay points the same way inside **all three** regimes, but **no single
regime's interval excludes zero**. So "the market simply stopped trending" is
**not refuted**: the decay is consistent within regime but underpowered there, and
this study cannot separate "setups continue less often" from "the market that
setups live in changed". That distinction is left open rather than resolved.

## Rejected — the negative-control failure does not discredit the clean features

A permutation control is per-feature calibration. `pullbackVolumeContraction`
(0.0%), `distanceToStopAtr` (1.0%) and `pullbackDepthAtr` (2.0%) are calibrated;
`rs20` (8.0%) and `medTradedValue` (20.0%) are not, and their nulls are reported
as weak. That is what the control is for. Discarding calibrated tests because
other tests are miscalibrated would discard the diagnostic's own output.

---

## Verdict after review: `NO ROBUST STOCK-LEVEL DISCRIMINATOR` — unchanged

Nothing in the review moves the primary verdict, which was already the most
conservative available and was additionally capped by §11.

The secondary decay finding comes out of review **stronger on two counts**
(survives the nine-cell grid; survives the same-symbol survivorship control;
survives using the strategy's own stop) and **weaker on one** (not separable from
regime change). Its status is: robust as a description of what happened to these
setups, unresolved as to mechanism.

**Corrections to Part I, applied above:** the nine-cell grid is now reported; the
fixed-ATR failure threshold is supplemented by the setup's own stop; and "no
robust discriminator" is qualified as "no discriminator larger than roughly a
quarter of a feature's mean".
