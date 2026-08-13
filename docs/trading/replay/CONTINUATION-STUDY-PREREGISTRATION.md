# Preregistration — stock-level continuation vs failure

**Date:** 2026-08-13 · Written and committed **before** any outcome analysis was run.
**Rule:** nothing in this document may be edited after results are seen. Deviations,
if any become necessary, are recorded as additions in the results artifact and
labelled as deviations.

---

## §0 Reuse audit

| asset | status | use here |
|---|---|---|
| `evaluateBreakoutPullbackCandidate` (Gate 2) | **reuse, unmodified** | defines the sample; returns `breakoutLevel`, `pullbackZoneLow/High`, `stopLevel`, `rankScore`, `quality` |
| `computeAtr` (`stop-feasibility.ts`) | reuse | ATR normalisation |
| `computeMinStopFrac` (`stop-feasibility.ts`) | reuse | §8 stratification into feasible / infeasible stop |
| `computeRsInflection` (`leadership-features.ts`) | reuse | RS20/RS50 and slope, already tested against the repo's own `computeRelativeReturnAtSession` |
| `detectUndercutReclaim`, `computeStructureRecovery`, `computeAbsorptionProxy` | reuse | structural and volume proxies |
| `EXCURSION_HORIZON_SESSIONS` (20), `FORWARD_RETURN_HORIZONS` (5/10/20), `GATE2_RANGE_DAYS` (20), `GATE2_STOP_BUFFER_FRAC` (1%), `MIN_STOP_ATR_MULTIPLE` (1.0) | reuse | every horizon and threshold below is one of these where possible |
| `createPointInTimeGuard`, `resolvePointInTimeUniverse`, `evaluateTradability` | reuse | sample construction and PIT enforcement |
| frozen regime classification (`5699c69`) | reuse **as-is** | §4 stratification only; not re-derived, not re-tuned |
| `replay-engine` outcome channel | reuse | MFE/MAE via `guard.outcomeRows` |

**New code:** one runner that emits per-candidate features and outcomes, plus a
setup-deduplication rule (§1). No strategy logic is copied or re-implemented.

---

## §1 Unit of analysis — frozen

**Unit = one unique setup opportunity**, not a symbol-session.

Deduplication rule, fixed now: two Gate 2 candidates are the **same opportunity**
when they share (a) the same symbol, (b) a `breakoutLevel` within **0.5%** of each
other, and (c) occur within **`GATE2_RANGE_DAYS` (20) sessions**. The **earliest**
occurrence is kept; later re-appearances are counted and discarded.

Required reporting before any outcome is examined: raw candidate rows, unique
setups, unique symbols, unique dates, unique months, setups per year, and the
maximum number of setups sharing one date.

---

## §2 Outcome — frozen before features are examined

R-multiple is **not** the primary outcome; earlier phases showed stop geometry
distorts it. The primary outcome is an ATR-normalised excursion race over
`EXCURSION_HORIZON_SESSIONS` = 20 sessions, measured from the next session's open
(the executable entry established in the v2 baseline).

Let `A` = adverse threshold = **1.0 × ATR** below entry (this is
`MIN_STOP_ATR_MULTIPLE`, an existing repo constant, not a new number).
Let `C` = continuation threshold = **2.0 × ATR** above entry — declared as twice
the adverse threshold, i.e. a symmetric 2:1 structure, not a searched value.

| class | definition |
|---|---|
| `CONTINUATION` | price reaches `+C` **before** it reaches `−A` |
| `FAILURE` | price reaches `−A` **before** it reaches `+C` |
| `AMBIGUOUS` | neither is reached within 20 sessions |

Primary comparison is **CONTINUATION vs FAILURE**. `AMBIGUOUS` is reported in
full and never silently dropped; if excluding it changes the class balance by
more than 10pp, that is disclosed as a sample bias.

**Preregistered sensitivity grid** for the outcome definition: `C` ∈ {1.5, 2.0,
2.5} × ATR and `A` ∈ {0.75, 1.0, 1.5} × ATR — nine combinations, all reported.

---

## §3 Feature families and the ONE primary feature in each

Exploratory features within each family are permitted and will be reported, but
only the primary feature below counts toward the primary hypothesis test. Each is
chosen for a stated mechanism, before any outcome is seen.

| family | **primary feature** | mechanism |
|---|---|---|
| **A. Relative behaviour** | `rs20` — stock 20-session return minus index | does the stock refuse to fall with the index? |
| **B. Structural resilience** | `pullbackDepthAtr` — pullback depth from breakout, in ATR | supply exhausted quickly in volatility terms |
| **C. Volume behaviour** | `pullbackVolumeContraction` — median volume during the pullback ÷ median during the prior advance | supply drying up as price eases |
| **D. Entry geometry** | `distanceToStopAtr` — entry to structural stop, in ATR | is the entry located sensibly relative to its own risk? |
| **E. Volatility / liquidity** | `medianTradedValue` — median close × volume over 20 sessions | thin names behave differently for reasons unrelated to setup quality |

Volume features are **proxies**. This dataset has no bid/ask or aggressor side,
so nothing here may be described as accumulation, distribution, or institutional
activity.

---

## §4 Market context is stratification only

No Gate 1 is designed, proposed or modified. Context is snapshotted at T from
existing artifacts: Gate 1 label, the frozen regime from `5699c69`, and index
above/below MA50.

Preregistered stratified question: **does the primary feature still separate the
classes within Gate 1 WARNING, and within index-below-MA50?** If a feature only
works when Gate 1 already says PASS, it does not address early entry and will be
reported as such.

---

## §5 Early-leader hypothesis

Stated separately, and **not** tested as a composite: within sessions where the
index is below its MA50, do relative resilience (family A) and structural
strength (family B) each separately associate with continuation?

A composite or interaction may be examined **only if at least two families show
independent evidence surviving §9 correction**, and only as clearly-labelled
secondary analysis. No weights are optimised under any circumstances.

---

## §6 Era decomposition

With identical feature definitions, split 2015–2021 vs 2022–2026 and decompose:

1. feature **distribution** shift;
2. feature → **P(continuation)** mapping shift;
3. **conditional MFE given continuation** shift.

This separates "the scanner picks worse stocks now" from "it picks similar stocks
and the market pays less". Both mechanisms are reported separately and never
merged into one number.

---

## §7 Entry-location test

Attempted only if an "earliest structurally valid entry" can be identified from
conditions already present point-in-time, **without inventing a new rule**. If it
cannot be defined without adding a rule, the section is reported
**`NOT EVALUABLE`** and nothing is fitted.

---

## §8 Stop feasibility is a stratification variable

Using `computeMinStopFrac`, split setups into feasible vs infeasible stop
geometry, then test features within each stratum — so that "bad setup" is not
confused with "reasonable setup, unusable stop".

Primary metrics throughout: forward return %, MFE %, MAE %, MFE/ATR, MAE/ATR,
failure rate. **R-multiple is excluded from all primary claims.**

---

## §9 Multiple comparisons — frozen policy

**Primary hypotheses: 5** (one per family, §3), each tested as
CONTINUATION vs FAILURE on the pooled sample.

- Correction: **Bonferroni over 5** → α = 0.010, i.e. 99% intervals.
- A finding is reported as supported **only if the corrected interval excludes
  zero**. Nominal 95% intervals may be shown alongside but never as the headline.
- Everything else — era splits, strata, exploratory features, the nine outcome
  variants — is **secondary**, reported with effect sizes and intervals but
  carrying no significance claim.
- The count of all comparisons actually run will be reported.

Effect size is reported before, and given more weight than, any interval.

---

## §10 Clustering and robustness

Bootstrap resampling units, all reported for every primary test:

1. **setup** (naive);
2. **date block** — all setups sharing a session resample together;
3. **month block**;
4. **symbol**.

The narrowest honest unit governs the verdict. Effective independent n is
reported. If month-block intervals contain zero for every primary feature, the
verdict is at best `UNDERPOWERED`.

Era split 2015–2021 vs 2022–2026 reported for each primary feature.

---

## §11 Negative controls — frozen

Run **before** interpreting any positive result:

1. **Label permutation within month blocks** — shuffle CONTINUATION/FAILURE
   labels inside each calendar month, preserving date clustering, 200 times.
   Record how often each primary feature clears the corrected threshold.
2. **Lagged-irrelevant feature** — a feature from 60 sessions before T, which
   should carry no setup information.

If permutation produces corrected-significant results at a rate materially above
1%, the pipeline is not trustworthy and the verdict is capped at
`NO ROBUST STOCK-LEVEL DISCRIMINATOR` regardless of the primary results.

---

## §12 Case studies

Inspected **after** everything above is complete and frozen. FPT, FRT if data
exists, plus true positives, false positives and missed leaders drawn from the
universe-wide result. No definition may be changed to capture them. FRT is
expected to remain `NOT EVALUABLE`; FPT having zero flags would itself be a
finding.

---

## §13 Independent review

`agy` + Gemini 3.1 Pro on the final artifact, asked to refute at least the 15
listed attack vectors. Valid HIGH/CRITICAL findings are verified and either fixed
and re-run, or the verdict is downgraded. Wording-only fixes are not acceptable
where the inference changes.

---

## §14 Verdict criteria — frozen

Exactly one primary verdict:

| verdict | requires |
|---|---|
| `STOCK-LEVEL CONTINUATION SIGNAL SUPPORTED` | ≥1 primary feature survives Bonferroni **and** month-block clustering, same sign across eras or a demonstrated era difference, clean negative controls, and survives independent review |
| `ENTRY LOCATION IS PRIMARY FAILURE` | family D dominates while A–C are null, i.e. selection is adequate and timing/geometry explains failure |
| `CONTINUATION DECAY DOMINATES` | feature→P(continuation) mapping is stable across eras but conditional MFE given continuation has contracted materially |
| `UNDERPOWERED` | effects look plausible but month-block intervals contain zero and effective n is small |
| `NO ROBUST STOCK-LEVEL DISCRIMINATOR` | no family survives correction and robustness |

---

## §15 Out of scope, unconditionally

No change to the production scanner, Gate 1, Gate 2, RS activation, position
sizing, R:R, or any "strategy v2" backtest — regardless of what is found.

## Known limits, stated in advance

- **Sample.** 765 Gate 2 valid candidates exist across ~11 years before
  deduplication. After §1 dedup the unique-setup count will be lower, and the
  effective independent count lower still. This may well end in `UNDERPOWERED`,
  and that outcome is acceptable.
- **Survivorship.** 1,182 of 1,537 symbols have no stored bars.
- **Post-selection.** This is the eighth phase on one dataset. Preregistration
  constrains this phase's analysis; it cannot undo prior exposure to the data.
