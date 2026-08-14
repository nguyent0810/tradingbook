# Market follow-through vs pattern decay — results

**Date:** 2026-08-13 · Executes [`FOLLOWTHROUGH-VS-PATTERN-PREREGISTRATION.md`](FOLLOWTHROUGH-VS-PATTERN-PREREGISTRATION.md), committed at `18f562e` before any outcome analysis
**Basis:** 572 setups, 119 months, full 20-session index and equal-weight paths for all

---

> **VERDICT DOWNGRADED after independent review — see Part II.** The final verdict
> is `UNDERPOWERED / POOR OVERLAP`. The power calculation shows this design could
> only detect a market-path effect explaining 43–61% of the decay, so it cannot
> assert that balancing removes little. The section below is retained as written
> for the record.

## Primary verdict (superseded): `DECAY PERSISTS AFTER MARKET-PATH BALANCING`

Balancing on **both** the market state at entry **and** the market path over the
first three sessions removes at most about a fifth of the decay — and that fifth
is not distinguishable from zero, nor from a placebo path taken 20 sessions away.

| | effect | 95% CI |
|---|---|---|
| composition (state + early market path) | −2.88pp | **[−7.50, +3.96]** — contains zero |
| **UNEXPLAINED ERA RESIDUAL** | **−10.88pp** | **[−22.21, −2.26]** — excludes zero |
| total | −13.76pp | |
| composition share of total | 21% (point), median 14% | [−43%, +66%] |

**Neither primary hypothesis clears the corrected threshold:**

| id | hypothesis | effect | p | α=0.0167 |
|---|---|---|---|---|
| P1 | early market path differs between eras | −0.54pp | 0.0465 | **not supported** |
| P3 | stock-relative MFE deteriorated | −2.02pp | 0.0257 | **not supported** |

So neither `H-MARKET` nor `H-PATTERN` is established as *the* mechanism. What is
established is the residual: after conditioning on everything this project can
measure about the market, roughly **11 percentage points of decay remain
unexplained**.

---

## §6 Overlap — adequate, reported before any standardised number

| | |
|---|---|
| cells (4 regimes × 3 tertiles of index return T0→T+3) | 12 |
| tertile cuts, pooled and frozen before outcomes | −0.43pp / +0.86pp |
| new-era setups in cells with fewer than 5 old-era setups | **7 / 288 (2%)** |
| new-era mass covered by cells with old-era data | **99%** |

Overlap is good, so the standardised estimate is reportable rather than an
extrapolation.

## §4–§5 The market path by era and outcome

Median index return from T0 (descriptive; conditions on outcome):

| group | n | T+1 | T+3 | T+5 | T+10 | T+20 |
|---|---|---|---|---|---|---|
| old × winner | 116 | +0.31 | +0.76 | +1.05 | +1.50 | +2.43 |
| old × failure | 168 | +0.06 | +0.17 | +0.39 | +0.98 | **+0.77** |
| new × winner | 78 | +0.24 | +0.65 | +0.73 | +1.86 | +2.27 |
| **new × failure** | 210 | −0.04 | −0.07 | −0.35 | −0.30 | **−0.05** |

The clearest contrast in the study: **old-era failures happened while the market
kept rising** (+0.77% by T+20); **new-era failures happen while it goes nowhere**
(−0.05%). Winners look almost identical across eras.

That is suggestive of `H-MARKET` — but P1 does not clear correction, and the
balancing below shows this difference does not carry the decay.

## §7 Within-cell decay: present almost everywhere

| cell (regime, path tertile) | old n | new n | old win% | new win% |
|---|---|---|---|---|
| BROAD_ADVANCE, low path | 69 | 52 | 26.1 | **13.5** |
| BROAD_ADVANCE, mid | 80 | 74 | 40.0 | **29.7** |
| BROAD_ADVANCE, high | 77 | 61 | 50.6 | 44.3 |
| NARROW_RALLY, low | 5 | 22 | 20.0 | 13.6 |
| NARROW_RALLY, mid | 9 | 12 | 44.4 | 33.3 |
| NARROW_RALLY, high | 12 | 9 | 75.0 | 44.4 |
| SYSTEMIC_WEAKNESS, low | 12 | 25 | 33.3 | **12.0** |
| SYSTEMIC_WEAKNESS, mid | 5 | 9 | 20.0 | 44.4 |
| SYSTEMIC_WEAKNESS, high | 9 | 16 | 44.4 | 18.8 |

**New era is worse in 8 of the 9 cells with ≥5 setups on both sides.** Setups that
started in the same regime *and* saw the same early market path still converted
less often.

## §11 Placebo — the real path barely beats a fake one

| market path used for balancing | composition | residual | share of total |
|---|---|---|---|
| **real** T0→T+3 | −2.88pp | −10.88pp | **21%** |
| placebo, −20 sessions | −1.39pp | −12.37pp | 10% |
| placebo, +20 sessions | +0.72pp | −14.49pp | −5% |

A market path taken from 20 sessions before the setup explains **half** as much
as the real one. Given the real path's composition interval already contains
zero, its explanatory advantage over a placebo is not established. This is the
single strongest argument against reading the market-path story as causal, and it
is why the verdict is `PERSISTS` rather than `PARTLY`.

## §9 Relative excursion — secondary, and mixed

| metric | effect | p |
|---|---|---|
| **relative MFE** (P3, primary) | −2.02pp | 0.0257 — not supported |
| relative MAE (secondary) | −2.71pp | **0.0002** |
| absolute MFE/ATR (secondary) | −1.64 | **0.0007** |

Stocks now fall *further behind the index* on the downside (relative MAE) and
their absolute ATR-normalised upside shrank — but the preregistered relative-MFE
test does not clear. The secondary results point at pattern-level deterioration;
they carry no significance claim and cannot be promoted.

---

## §16 What may and may not be said

Balancing on the T+3 market path is **post-treatment conditioning**. Latent
factors can drive both the market path and the setup outcome, so nothing here
identifies causation. The permitted reading is **"the decay is not associated
with the observed market path to any degree distinguishable from placebo"**.

The residual is named `UNEXPLAINED ERA RESIDUAL` and is **not** evidence for
`H-PATTERN`. It is what is left after the market variables this project can
measure — which is not the same as what is left after *the market*.

## §13 Time gradient — descriptive

Continuation rate by year is reported in the artifact; the phase does not search
for a breakpoint and does not claim 2022 is one. The era split is inherited.

## Answers

> When controlling for market state at entry **and** market trajectory just after
> entry, how much decay remains?

**About 11 of 14 percentage points**, with an interval excluding zero. The
controllable part is ~21% at the point estimate, ~14% at the bootstrap median,
and its interval spans zero.

> After 2022, do stocks fail because the market did not follow through, or because
> the stock itself no longer follows through relative to the market?

**Neither is established.** The market-path story is suggestive in the raw
comparison and collapses under placebo. The stock-relative story fails its
preregistered test while two secondary measures support it. This phase was built
to discriminate between them and it cannot.

## Next direction — proposal only, per §20

Composition, synchronisation and now market-path balancing have each been excluded
as the dominant mechanism. Three options, in order of what the evidence supports:

1. **Accept the residual as unexplained and stop searching within this dataset.**
   Eleven phases have narrowed a 14pp decay to an 11pp residual that no available
   market variable explains. Further slicing of 119 months is unlikely to resolve it.
2. **Exit / profit-retention**, which remains untested as a standalone question and
   where the giveback finding (15.8% → 25.6%) still sits unexplained.
3. **Out-of-sample data** — a different market or pre-2014 history. This is the
   only route that addresses the HARKing limitation carried since phase 8.

Strategy redesign is a legitimate reading of eleven phases of null results, and
should be considered rather than continuing to instrument the same 572 setups.

---

# Part II — Independent review, and a verdict downgrade

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-13, 15 attack vectors. Verdict:
*"the study did not isolate a persistent residual, it simply lacked the statistical
power to detect anything else."*

**On the decisive point the reviewer is right, and the verdict changes.** Two of
its other FATAL claims are refuted by data.

## Upheld — the study cannot detect a realistic market-path effect

Bootstrap standard error of the composition estimate: **3.00pp**.

| | minimum detectable effect | as share of the 13.76pp decay |
|---|---|---|
| 80% power, α=0.0167 | **8.41pp** | **61%** |
| 50% power, α=0.0167 | 5.89pp | 43% |
| observed point estimate | 2.88pp | 21% |

**A market-path effect would have to explain 43–61% of the decay before this
design could see it.** An effect of realistic size — 3 to 5 percentage points —
is below the threshold. The share interval [−43%, +66%] says the same thing: the
data is compatible with the market path explaining two thirds of the decay, or
none of it, or confounding it negatively.

`DECAY PERSISTS AFTER MARKET-PATH BALANCING` asserts that balancing removes
little. **The study cannot support that assertion**, and asserting a null the
design cannot detect is the same error this project has corrected in others.

## Refuted — the placebo is not contaminated

The reviewer called the ±20-session placebo "rigged" and "heavily correlated with
the true local path", and marked it FATAL.

> **corr(real T0→T+3, placebo −20 sessions) = −0.036** over 572 setups.

Essentially zero. A 3-session index return taken a month earlier carries no
information about the real one. The placebo is a fair test, and the finding it
produced — that a fake path explains 10% where the real one explains 21% — stands.

## Refuted in magnitude — the benchmark mismatch is real but small

The reviewer argued that balancing equal-weight stock setups against a
cap-weighted index "guarantees a massive unexplained residual". Re-running the
whole balancing on the **equal-weight market path** instead:

| balancing variable | composition | residual | share |
|---|---|---|---|
| cap-weight VN-Index | −2.88pp | −10.88pp | 21% |
| **equal-weight market** | **−3.61pp** | **−10.15pp** | **26%** |

The concern is legitimate — the equal-weight benchmark does explain more — but it
moves the share from 21% to 26%, not to "massive". The residual barely changes.

## Acknowledged

Post-treatment conditioning and collider risk were stated in the preregistration
before results and are not resolved by anything here. Thin cells (5–9 old-era
setups in five of twelve) are exactly why the composition interval is 11.5pp
wide. The §4–§5 market-path table conditions on outcome and was labelled
diagnostic.

---

## Verdict after review: `UNDERPOWERED / POOR OVERLAP`

Downgraded from `DECAY PERSISTS AFTER MARKET-PATH BALANCING`.

Overlap was adequate (99% coverage, 2% of new-era setups in thin cells) — the
failure is power, not support. With a 3.00pp standard error against a 13.76pp
total, this design can only distinguish "the market path explains most of the
decay" from "it explains none" if the truth is at one of those extremes.

**What still stands, because it does not depend on the decomposition:**

- The **residual itself is non-zero**: −10.88pp, CI [−22.21, −2.26]. Something
  remains after conditioning on regime and early market path.
- **New era is worse in 8 of 9 cells** with ≥5 setups on both sides.
- **Old-era failures happened while the market rose** (+0.77% by T+20); **new-era
  failures happen while it goes nowhere** (−0.05%).
- Neither P1 (p=0.0465) nor P3 (p=0.0257) clears α=0.0167.

**What does not stand:** any claim about *how much* of the decay the market path
accounts for. That number is 21% at the point estimate and undetermined in fact.

## Revised next direction

The reviewer's power calculation changes the recommendation. Eleven phases have
established a robust ~14pp hit-rate decay and failed to attribute it, and this
phase shows why attribution keeps failing: **572 setups over 119 months cannot
partition a 14pp effect into components smaller than ~6–8pp.** More slicing of
this dataset will not resolve the mechanism, whatever is sliced.

That leaves two honest options:

1. **Out-of-sample data** — a different market, or pre-2014 history. This is the
   only route that addresses both the power ceiling and the HARKing limitation
   carried since phase 8.
2. **Accept that the mechanism is unresolvable here** and decide on the strategy
   from what is established: the hit rate fell from 40.8% to 27.1%, which at a
   2:1 structure moves expectancy from +0.22 to −0.18 ATR, and no stock-level or
   market-level variable available in this project explains it.

Continuing to instrument the same 572 setups is the option the evidence argues
against.
