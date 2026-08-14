# Continuation decay — decomposition results

**Date:** 2026-08-13 · Executes [`CONTINUATION-DECAY-PREREGISTRATION.md`](CONTINUATION-DECAY-PREREGISTRATION.md), committed at `9e2f7ec` before any era comparison
**Basis:** 572 unique setups with a full forward window, 119 months, **0 guard violations**

---

## Primary verdict: `CONTINUATION DECAY REPLICATED — HIT RATE`

Setups win **less often** after 2022. They do not win **smaller**, and they do not
fail **sooner** — neither of those clears the corrected threshold.

| id | hypothesis | effect | p | verdict |
|---|---|---|---|---|
| **H1** | P(continuation) lower after 2022 | **−18.6pp** | **0.0010** | **SUPPORTED** |
| **H2** | cumulative continuation incidence at T+20 worse | **−18.6pp** | **0.0010** | **SUPPORTED** |
| H3 | conditional MFE/ATR given continuation lower | −1.82 | 0.1175 | not supported |
| H4 | failure arrives earlier | −0.32 sessions | 0.5499 | not supported |

Bonferroni over 4 → α = 0.0125. All tests are cluster-level permutation on month
units, the only inference this phase permits.

---

## §0 The inference correction, and why it mattered

The previous phase blamed its negative-control failure on heavy tails. **That was
wrong.** Kurtosis does not order the failures: `pullbackVolumeContraction` has the
highest excess kurtosis of all five features (48.0) and was among the cleanest;
`distanceToStopAtr` is near-Gaussian and still ran at 3.0%.

The cause is **temporal clustering**. Moving the statistic to month level fixes
every case:

| feature | obs-level FPR | **cluster-level FPR** |
|---|---|---|
| `rs20` | 6.7% | **1.3%** |
| `medTradedValue` | 11.0% | **0.0%** |
| `pullbackVolumeContraction` | 3.3% | **1.0%** |
| `distanceToStopAtr` | 3.0% | **0.3%** |

Swapping the percentile bootstrap for a permutation test does **not** help
(`rs20` stays at 9.2%) — the estimator was never the problem. 596 setups are
~119 months of information, and this phase treats them that way throughout.

**§13 calibration of the exact H1 estimator**, run before results were read:
empirical FPR **1.0%** against nominal 1.25%, Monte Carlo SE 0.56pp over 400
replications. Calibrated.

## §2–§3 Sample and replication gate

| | setups | symbols | months (pre/post) | dates |
|---|---|---|---|---|
| **A.** all valid setups | 572 | 112 | 119 (67/52) | 471 |
| **B.** common-symbol cohort | 467 | 66 | 116 (67/49) | 397 |

| | month-level era difference | p |
|---|---|---|
| **A.** all setups | **−18.6pp** | **0.0007** |
| **B.** common-symbol cohort | **−17.6pp** | **0.0020** |

A and B agree in direction and magnitude, so survivorship-driven composition is
not producing the result. Descriptive observation-level rates (no interval, per
§0): 40.8% → 27.1% (A), 42.4% → 27.8% (B).

---

## §4 The gap opens immediately and widens

Cumulative incidence of each cause, by session after entry:

| k | continuation 15–21 | continuation 22–26 | diff | failure 15–21 | failure 22–26 | diff |
|---|---|---|---|---|---|---|
| 1 | 11.2% | 5.0% | −6.2 | 24.7% | 31.5% | +6.8 |
| 2 | 16.6% | 10.7% | −5.9 | 32.2% | 42.6% | +10.4 |
| 3 | 19.3% | 13.8% | −5.6 | 38.0% | 48.0% | +10.0 |
| 5 | 27.1% | 18.8% | −8.3 | 45.4% | 58.4% | +13.0 |
| 10 | 35.3% | 24.5% | −10.8 | 52.9% | 67.1% | +14.2 |
| 20 | 39.3% | 26.2% | **−13.1** | 56.6% | 70.5% | **+13.9** |

**By the very first session** a setup is already less likely to have run and more
likely to have broken. The gap is not created late in the holding period; it is
present at k=1 and compounds.

## §5 Both hazards moved, in opposite directions

3-session smoothed cause-specific hazards (%, secondary):

| k | h_cont 15–21 | h_cont 22–26 | h_fail 15–21 | h_fail 22–26 |
|---|---|---|---|---|
| 2 | 8.3 | 6.8 | 15.9 | **20.2** |
| 4 | 9.0 | 7.1 | 10.4 | **14.0** |
| 6 | 9.7 | **5.8** | 9.0 | 11.8 |
| 8 | 7.0 | 7.5 | 6.1 | **12.1** |
| 10 | 8.8 | **5.7** | 5.7 | 8.2 |
| 13 | 9.1 | **3.4** | 4.9 | **11.3** |

Continuation hazard is lower at 5 of 6 sampled points; failure hazard is higher at
6 of 6. This is a sustained pattern across the horizon, not a single spike — which
is why it was preregistered as smoothed.

## §6 Decomposition: what changed and what did not

| | 2015–2021 | 2022–2026 |
|---|---|---|
| **A. P(continuation)** | 40.8% | **27.1%** |
| **B. MFE/ATR given continuation** (median) | 4.79 | 4.29 |
| forward-20 given continuation | +7.42% | +5.43% |
| time to reach +2 ATR | 4 sessions | 3 sessions |
| **C. MAE/ATR given failure** (median) | −2.75 | **−2.74** |
| time to failure | 2 sessions | **2 sessions** |
| MFE before failing | 0.21 | 0.13 |

**Failures are identical** — same depth, same speed. Winners are somewhat smaller
but H3 does not clear correction. The whole difference is in how many setups
become winners at all.

## §7 The prior trajectory claim — reproduced in direction, corrected in one part

| k | MFE/ATR 15–21 | MFE/ATR 22–26 | MAE/ATR 15–21 | MAE/ATR 22–26 |
|---|---|---|---|---|
| 1 | 0.61 | 0.36 | −0.37 | −0.61 |
| 5 | 1.31 | 0.84 | −0.93 | −1.23 |
| 10 | 1.80 | 1.19 | −1.27 | −1.58 |
| 20 | **2.57** | **1.60** | **−1.94** | **−2.16** |

Prior claim (`WHY-2022.md`): MFE/ATR 2.03 → 1.50, MAE/ATR 1.60 → 1.63.

- **MFE/ATR reproduces** — 2.57 → 1.60 here, same direction and similar magnitude.
- **"MAE/ATR essentially unchanged" does NOT reproduce.** On this sample adverse
  excursion worsened from 1.94 to 2.16, about +11%. The earlier document's claim
  that only the upside changed is **corrected**: both sides moved, the upside more.

## §12 Not merely a volatility rescaling

| | 2015–2021 | 2022–2026 |
|---|---|---|
| ATR / price | 2.67% | 3.09% |
| realised vol | 1.74% | 1.96% |
| **MFE % at T+20** | 6.91% | **5.03%** |
| **MFE / ATR at T+20** | 2.57 | **1.60** |

Volatility rose ~16%, so a pure scale story predicts percentage excursions
shrinking while ATR-normalised ones hold. **Both shrank**, and the normalised one
shrank harder. Scale is part of it; it is not all of it.

---

## Major secondary finding: profit giveback rose sharply

Of setups that *did* reach a gain, how many kept it to T+20:

| reached | era | n | round-tripped to entry | ended as failure |
|---|---|---|---|---|
| +1.0 ATR | 2015–2021 | 231 | 26.4% | 45.0% |
| | 2022–2026 | 195 | **40.5%** | 54.9% |
| +1.5 ATR | 2015–2021 | 204 | 20.1% | 39.7% |
| | 2022–2026 | 153 | **29.4%** | 43.8% |
| +2.0 ATR | 2015–2021 | 177 | 15.8% | 34.5% |
| | 2022–2026 | 129 | **25.6%** | 39.5% |

**A setup that reaches +2 ATR now gives the whole move back 25.6% of the time,
against 15.8% before.** This is `CASE D` from the brief and it is substantial —
but it is secondary, not primary, because it was not among the four preregistered
hypotheses and carries no significance claim here.

## §10 Synchronisation: modest

| | 2015–2021 | 2022–2026 |
|---|---|---|
| failures / distinct dates | 168 / 148 | 210 / 170 |
| top-decile dates hold | 18% of failures | 21% |
| share of setups on dates with ≥3 setups | 5% | 11% |

More clustered, but not enough to call synchronised failure the mechanism.

---

## Which case does this match?

| case | verdict |
|---|---|
| **A — hit-rate decay** | **YES, and it is the primary finding** |
| B — payoff compression | partly: winners are smaller, but H3 does not clear correction |
| C — early failure | no: time-to-failure is 2 sessions in both eras |
| D — profit giveback | **yes, substantially** — secondary |
| E — market-synchronised failure | weak: 18% → 21% |
| F — no replication | no: H1 replicates under calibrated inference at p=0.0010 |

## What this says for the next phase

The edge did not disappear because entries are mistimed — the previous phase
showed entry location is null. It did not disappear because failures got worse —
they are identical. It disappeared because **the same setup now converts to a
winner 27% of the time instead of 41%**, with the gap visible from the first
session, and because **gains that do appear are given back far more often**.

Those two point at different research directions — market-risk/regime work for
the first, exit behaviour for the second — and this phase deliberately does
neither.

## Limits

- **119 months is the sample**, not 572 setups. Every interval here reflects that.
- Survivorship: 1,182 of 1,537 symbols have no stored bars; cohort B controls
  composition but is itself survivor-selected.
- The era boundary was fixed in an earlier phase and is not re-tested here.
- Ninth phase on one dataset; preregistration constrains this phase only.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-13, 15 attack vectors. Verdict:
*"FATALLY FLAWED… HARKing across 9 phases… payoff compression manufactured through
collider bias."*

Three claims are refuted by arithmetic. Two are valid and unresolved. One changes
what the reader should take away, and is reported in full below even though it
does not change the preregistered verdict.

## The one that matters — payoff compression measured unconditionally

The reviewer's sharpest point: H3 tests MFE **conditional on continuation**, while
§7 shows MFE/ATR across **all** setups falling 2.57 → 1.60. Conditioning on being
a winner is conditioning on a post-treatment outcome, so the argument goes that
payoff compression was partitioned into the hit-rate bucket.

Run — **not preregistered, declared as an addition prompted by review**:

| statistic | effect | p | |
|---|---|---|---|
| **unconditional** MFE/ATR@20, all setups | −1.612 | **0.0007** | **significant** |
| conditional MFE/ATR@20 given continuation (**H3**) | −1.824 | 0.1250 | not significant |
| month-level **p75** of MFE/ATR@20 | −1.287 | **0.0055** | **significant** |

**Both readings are defensible and the reader should have both.** A drop in the
unconditional distribution is exactly what a hit-rate collapse produces
mechanically — if 41% of setups run and then only 27% do, the median and the
upper quartile of the whole distribution fall without any winner shrinking. That
is why §6 of the brief required the *conditional* decomposition, and why H3 was
written conditionally.

**The verdict stays `HIT RATE`** because my frozen criteria say so: HIT RATE
requires H1 supported and H3 not, and that is what happened. Promoting an
unpreregistered unconditional test to primary after seeing that it is significant
is precisely what §14 forbids. A reader who thinks the unconditional framing is
the right one should read this as `BOTH`; I am not entitled to make that switch
after the fact.

## Refuted — H3 is not merely underpowered

The reviewer argued H3 and H4 are Type II errors created by month aggregation.
Minimum detectable effect at 80% power for H3: **1.09 ATR** against an observed
**−1.82 ATR**. The test had power to detect an effect of the observed size and
did not. That makes H3 a reasonably informative null — though "80% power" also
means one miss in five, so it is not a certain one.

## Refuted — the competing-risk arithmetic is correct

The reviewer suspected incidences summing to ~96% indicated a misapplied
1−Kaplan-Meier.

| era | continuation | failure | neither | total |
|---|---|---|---|---|
| 2015–2021 | 39.3% | 56.6% | 4.1% | **100.0%** |
| 2022–2026 | 26.2% | 70.5% | 3.4% | **100.0%** |

The missing few percent is the `AMBIGUOUS` class. Every setup carries a full
20-session window, so there is **no censoring**, and the cumulative incidence is
simply the empirical first-passage proportion. Kaplan-Meier was never used.

## Refuted — censoring is not a bias here

Only **3 of 596** setups lack a full forward window, all in 2026-07/08 at the very
end of the data. That is right-truncation from data availability, not
survivorship, and it cannot move a 119-month comparison.

## Upheld and unresolved — HARKing

Valid, and stated more plainly than Part I did. The decay was **discovered as a
secondary result in phase 8** and is the primary hypothesis here, on the same
data. Preregistering the test and calibrating the estimator fixes the *inference
machinery*; it does not undo the fact that the hypothesis came from this dataset.
The family-wise error rate across nine phases is not something a Bonferroni over
four hypotheses addresses. **The only real remedy is data this project does not
have** — a different market, or history before 2014.

## Upheld and unresolved — regime confounding

The 2022 boundary coincides with a major macro shift. Phase 8's regime
stratification found the decay pointing the same way inside all three regimes but
no single regime's interval excluding zero. So "setups convert less often" and
"long-biased setups do worse in a worse market" remain **inseparable here**.

## Partly upheld — giveback conditioning

The giveback figures condition on reaching +2 ATR, which is conditioning on the
future, and rest on 28 vs 33 events. They are descriptive, carry no significance
claim, and should be read as a prompt for the next phase rather than a result.

## Rejected — cohort B does not "exacerbate" survivorship

Cohort B requires a symbol to produce setups in **both** eras, which holds
composition fixed across the comparison. It is survivor-selected in absolute
terms — stated in the limits — but for a *between-era* contrast it removes the
composition channel rather than adding to it. A and B agreeing at −18.6pp and
−17.6pp is evidence against composition driving the result.

---

## Verdict after review: `CONTINUATION DECAY REPLICATED — HIT RATE` — retained

Retained under the frozen criteria, with two things a reader must carry alongside:

1. **The unconditional payoff test is significant** (p=0.0007). Under a different
   but reasonable framing this study reads as `BOTH`. The conditional framing was
   preregistered and required by the brief; the unconditional result is reported
   here rather than left out.
2. **HARKing and regime confounding are unresolved and unresolvable with this
   dataset.** The decay is robust to every *statistical* objection tested —
   calibration, clustering, cohort, censoring, competing-risk arithmetic — and
   remains vulnerable to the two objections that are about provenance rather than
   arithmetic.
