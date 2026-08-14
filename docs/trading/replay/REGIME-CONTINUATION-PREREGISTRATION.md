# Preregistration — regime-conditioned continuation decay

**Date:** 2026-08-13 · Committed **before** any conditional outcome is examined.
**Rule:** not editable after results are seen; deviations recorded as deviations.

---

## §0 Gate passed before writing this

The frozen sample reproduces: **596 unique setups, 572 scored, P(continuation)
40.8% (n=284) → 27.1% (n=288)**. Every scored setup joins to a frozen regime
label at T0 (572/572). Had it not reproduced, the phase would have stopped.

## Reuse

Unique-setup sample and dedup rule, continuation/failure labels, lifecycle
trajectories, month-cluster permutation inference and its calibration procedure,
the common-symbol cohort, the frozen regime classification from `5699c69`, Gate 1
labels, and the per-session breadth/index artifacts. **No logic is rewritten and
no new market model is built.**

---

## §1 Primary estimand

Not "which feature predicts a winner". The estimand is:

> **ERA EFFECT** = P(continuation | 2022–26) − P(continuation | 2015–21),
> and how much of it survives conditioning on market state at entry.

## §2 Market state at entry — recorded, not searched

At T0, point-in-time: Gate 1 label; frozen regime; index above/below MA50; index
5- and 20-session return; breadth %>MA10/20/50; new-high and new-low rate.

Where binning is needed, bins are the **existing frozen categories** (regime,
Gate 1) or **tertiles of the pooled distribution computed before outcomes are
read**. No cutoff is chosen by looking at continuation rates.

---

## §14 Primary hypotheses — exactly three

| id | hypothesis | statistic |
|---|---|---|
| **P1** | Era decay persists after standardising market-state composition | direct-standardised era difference in P(continuation), regime as the strata |
| **P2** | Market-state composition shifted adversely between eras | era difference in the composition-only counterfactual |
| **P3** | Given a matched T0 state, winners and failures experience different post-entry market trajectories | era-pooled difference in index return T0→T+5, winners vs failures, within regime strata |

**Correction:** Bonferroni over 3 → α = 0.0167.

**Inference:** month-cluster permutation only, as established in phase 9.
Observation-level intervals are prohibited. Each primary estimator is
recalibrated (§12) before its result is interpreted.

Everything else — per-state cells, transition matrices, trajectory tables,
giveback breakdowns, synchronisation counts — is **secondary and descriptive**,
carries no significance claim, and may not be promoted afterwards.

## §11 Decomposition — frozen form

Direct standardisation over the four frozen regimes:

- `observed_old`, `observed_new`
- **composition effect** = (new-era state distribution applied to old-era
  within-state rates) − `observed_old`
- **within-state effect** = `observed_new` − (new-era distribution applied to
  old-era rates)
- the two sum to the total decay by construction

Both directions of standardisation are reported. If they disagree materially,
that disagreement is the headline.

## §5–§8 Post-entry trajectory — diagnostic only

Market trajectory at T+1/2/3/5/10 (index return, distance to MA50, breadth
deltas, regime and Gate 1 transitions) is measured **after** entry and is used
only to describe what happened. It is never treated as information available at
T0 and never enters a predictive claim. Conditioning on winner/failure status is
conditioning on an outcome; every such table is labelled as such.

## §12 Negative controls — before interpretation

Permuted era labels by month block; outcome shuffled preserving month structure;
synthetic clustered null; Monte Carlo FPR for each primary estimator. If any
empirical FPR is incompatible with α under Monte Carlo uncertainty, that
hypothesis carries no significance claim and the phase reports
`INFERENCE PIPELINE NOT CALIBRATED`.

## §13 Same-data limitation — stated up front

This is the **tenth phase on one dataset**, and the hit-rate decay it conditions
on was discovered in phase 8 and tested in phase 9 on this same history. Nothing
here is out-of-sample validation. The permitted language is **explanatory
evidence**. The phrase "validated edge" is not available to this phase whatever
the result.

## §15 Verdict criteria — frozen

| verdict | requires |
|---|---|
| `DECAY MOSTLY EXPLAINED BY MARKET-STATE COMPOSITION` | composition effect accounts for the majority of total decay |
| `DECAY PERSISTS WITHIN MATCHED MARKET STATES` | within-state effect dominates and P1 is supported |
| `DECAY ASSOCIATED WITH POST-ENTRY MARKET DETERIORATION` | matched T0 states, but P3 supported and large |
| `FAILURES ARE MARKET-SYNCHRONIZED` | clustering is the dominant structure |
| `CURRENT REGIME MODEL DOES NOT EXPLAIN DECAY` | neither composition, conditioning nor transitions account materially |
| `UNDERPOWERED` | too few independent market episodes |
| `INFERENCE PIPELINE NOT CALIBRATED` | §12 fails |

## §16 Stop rule

No strategy change of any kind. The phase may only propose the next research
direction.

## Known limits

- **119 months**, not 596 setups, is the inferential sample.
- `RECOVERY_UNDERNEATH` holds ~2–3% of setups and will be too sparse for any
  within-state claim; it is reported and not interpreted.
- Survivorship: 1,182 of 1,537 symbols have no stored bars.
- Regime and Gate 1 partly overlap by construction (both read the index against
  its MA50), so "conditioning on state" removes less independent variation than
  it appears to. This is a known limitation of the frozen model, not fixed here.
