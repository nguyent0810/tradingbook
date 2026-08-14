# Preregistration — market follow-through vs structural pattern decay

**Date:** 2026-08-13 · Committed **before** any outcome analysis.
**Rule:** not editable after results are seen; deviations recorded as deviations.

---

## §0 Gate passed before writing this

Reproduces: **40.8% (n=284) → 27.1% (n=288)**. Join coverage **572/572** for the
frozen regime, the index path and the equal-weight path over a full 20 sessions.

## Reuse

The 596-setup sample and dedup rule, continuation/failure labels, stock
trajectories, VN-Index and breadth series, equal-weight daily returns, the frozen
regime from `5699c69`, the common-symbol cohort, month-cluster permutation
inference and its calibration procedure. Nothing is rewritten.

---

## The two competing hypotheses

| | claim |
|---|---|
| **H-MARKET** | post-entry market follow-through stopped supporting setups |
| **H-PATTERN** | the breakout-pullback itself lost continuation value, even when market behaviour after entry is comparable |

The phase exists to discriminate between them, not to confirm either.

## §2 Market follow-through — families kept separate

**No composite score.** Four families, each reported on its own:

- **A. Index** — return T0→T+1/2/3/5, ATR-normalised, change in distance to MA50
- **B. Breadth** — Δ %>MA10/20/50, Δ new-high rate, Δ new-low rate
- **C. Regime transition** — frozen state at T0 → T+2 and T+5
- **D. Cross-section** — cumulated equal-weight market return, share of stocks positive

## §3 Timing rule — frozen

Market trajectory at T+1/2/3 is **not** available at T0 and is never described as
an entry predictor. It is used only to ask whether confirmation appears *after* a
position exists and *before* the outcome is known. Any result involving it is
**dynamic-risk candidate information**, nothing more.

## §15 Primary hypotheses — exactly three

| id | hypothesis | frozen metric |
|---|---|---|
| **P1** | early post-entry market path differs between eras | index return T0→T+3, all setups pooled |
| **P2** | balancing starting state + early market path attenuates the era decay | direct standardisation over **regime × tertile of index return T0→T+3**, tertiles cut on the pooled distribution before outcomes are read |
| **P3** | stock-relative continuation still deteriorates after accounting for the market | **relative MFE** = max over T+1..T+20 of (stock return − index return), era difference |

**Correction:** Bonferroni over 3 → α = 0.0167.
**Inference:** month-cluster permutation only. Observation-level intervals remain
prohibited. Each estimator recalibrated before its result is read.

Everything else — breadth families, transitions, relative MAE, giveback
mechanism, time gradient, cohort repeats — is **secondary**, descriptive, and may
not be promoted.

## §6–§7 Balancing and decomposition — frozen form

Strata = 4 frozen regimes × 3 tertiles of index return T0→T+3 (12 cells).
Tertile cuts are computed on the **pooled** distribution and fixed before any
outcome is examined. Direct standardisation gives:

```
total era decay
  = starting-state composition
  + early-market-path composition
  + UNEXPLAINED ERA RESIDUAL
```

The residual is named **`UNEXPLAINED ERA RESIDUAL`**, never "pattern decay",
because §16's identification concern forbids that reading.

**Overlap is reported before any standardised number**: cell counts per era, and
the share of new-era setups whose cell has fewer than 5 old-era setups. If overlap
is inadequate the phase reports `UNDERPOWERED / POOR OVERLAP` and does not
extrapolate.

## §11 Placebo — frozen now

The real market path is replaced by the path from **±20 sessions away** and by
month-preserving permuted paths. If placebos explain the decay comparably, the
market explanation fails. The ±20 offset is fixed here and not revisited.

## §14 Negative controls

Permuted era blocks; outcomes shuffled preserving month; synthetic clustered
null; placebo paths; Monte Carlo FPR per primary estimator. Failure to reproduce
nominal α ⇒ `INFERENCE PIPELINE NOT CALIBRATED`, and no result is interpreted.

## §16 Identification limit — stated in advance

Conditioning on T+2/T+3 market path is **post-treatment**. Setups do not cause the
market, but latent factors can drive both the market path and the outcome, so
balancing on it can open a collider path. Permitted language is
**"associated with the observed market path"**. "Market caused" is not available
to this phase.

## §18 Verdict rules — frozen

| verdict | requires |
|---|---|
| `DECAY LARGELY ASSOCIATED WITH MARKET FOLLOW-THROUGH` | balancing removes most of the ~14pp, and P3 null |
| `DECAY PARTLY ASSOCIATED WITH MARKET FOLLOW-THROUGH` | balancing removes a material share, residual still large |
| `DECAY PERSISTS AFTER MARKET-PATH BALANCING` | balancing removes little |
| `STOCK-RELATIVE FOLLOW-THROUGH DETERIORATED` | P3 supported and robust |
| `BOTH MARKET AND PATTERN CHANNELS DETERIORATED` | P1 and P3 both supported independently |
| `UNDERPOWERED / POOR OVERLAP` | inadequate common support |
| `INFERENCE PIPELINE NOT CALIBRATED` | controls fail |

## §20 Hard stop

No production change, no new gate, no filter, no threshold, no exit or sizing
work, no strategy-v2 backtest — whatever the result. The phase may only propose
the next research direction.

## Limits stated up front

- **119 months** is the inferential sample, not 572 setups.
- Eleventh phase on one dataset; the decay was discovered in phase 8. **Not
  out-of-sample validation.**
- 12 balancing cells over 572 setups will leave thin cells; overlap diagnostics
  decide whether the standardised estimate may be reported at all.
- Survivorship: 1,182 of 1,537 symbols have no stored bars.
