# Preregistration — the `NOT_FEASIBLE_NOISE` feasibility gate

**Date:** 2026-08-24 · Committed **before any outcome of this gate is computed**
**Baseline:** `45b0559` · **Dataset snapshot:** the rebuilt population at
`abf0e7c` (764 setups, 2015-01-22 → 2026-08-21, recomputed from raw bars)

**The question, and only this:**

> Does separating `NOT_FEASIBLE_NOISE` from setup validity provide reproducible
> predictive value **without changing setup visibility**?

---

## The limitation that has to be stated first

**This is not an out-of-sample replication, and must not be reported as one.**

The `+1.19%` mean T+5 and `+16.45pp` stop-first observations came from *this same
dataset*. Re-testing them here cannot tell us whether they generalise; a second
pass over the same 764 setups will reproduce the point estimate by construction.

What this gate *can* do, and is designed to do, is subject the effect to
conditions it has never faced — regime consistency, cluster concentration,
leave-one-out, stop-distance matching, and confounder stratification. **Every one
of those can fail.** A pass means the effect is not an artefact of one year, one
symbol, one regime or one stop-distance band. It does not mean the effect is real
out-of-sample, and no sentence in the final report may imply otherwise.

The prior numbers are **hypotheses under test**. They are not success criteria and
may not be re-used as such after the results are seen.

---

## §0 Frozen experiment definition

### Population — exact eligibility

From `docs/trading/replay/postbackfill/setups.ndjson`, a setup is eligible iff:

1. its D2 verdict is **`FEASIBLE`** or **`NOT_FEASIBLE_NOISE`**
   — `NOT_FEASIBLE_LIQUIDITY` (n≈21) is **excluded**: it is a different verdict
   answering a different question, and folding it in would blend two exposures;
2. it has a **complete T+5 forward window** (`fwdBars >= 5`) and a non-null `fwd5`;
3. `riskFrac` is present, so stop-distance stratification is possible.

No other filter. No dedup is applied — the dedup rule was written for a different
question (opportunity counting) and dropping setups here would change the
exposure definition after the fact.

### Exposure — the existing contract, unmodified

Taken verbatim from `src/lib/decisions/d2-feasibility.ts` at `2c9b418`:

```
NOT_FEASIBLE_NOISE  ⇔  riskFrac < computeMinStopFrac(...).minStopFrac
                       where minStopFrac = max(tick, fee, 1.0 × ATR) ÷ entry
```

**No threshold is modified.** `MIN_STOP_ATR_MULTIPLE`, `MIN_STOP_TICKS` and
`ROUND_TRIP_FEE_FRAC` keep their production values.

### Primary endpoint — exactly one

> **`mean forward return at T+5`**, difference `FEASIBLE − NOT_FEASIBLE_NOISE`.

`fwd5` is measured from the **T+1 open** to the **T+5 close**, from bars strictly
after T. It is independent of the stop definition by construction, which is why it
carries the gate (§2).

### Secondary endpoints — predeclared, and cannot rescue a failed primary

stop-first rate · T+1 return · T+3 return · T+5 win rate · MFE · MAE.

**If the primary fails, the verdict is `FEASIBILITY NO-GO` regardless of every
secondary.** They are reported for completeness and for the artefact check, not
for adjudication.

### Statistical unit and interval

- **Quarter-cluster bootstrap**, resampling whole calendar quarters with
  replacement — the method justified in phases 9–15 and used unchanged.
- **20,000 replicates.**
- **95% confidence interval**, percentile method. Frozen now.
- Individual setups are **not** treated as independent.

---

## §1 Frozen pass / fail criteria

`FEASIBILITY GO` requires **all four**:

| # | condition |
|---|---|
| **C1** | the primary point estimate is **positive** |
| **C2** | the 95% quarter-clustered CI is **entirely above zero** |
| **C3** | the point estimate is **positive in every major regime** (defined below) |
| **C4** | **no single year, quarter or symbol accounts for more than 50%** of the aggregate T+5 delta, and leave-one-cluster-out on the largest contributor of each type leaves the point estimate positive |

**Any failure ⇒ `FEASIBILITY NO-GO`.** No implementation follows.

### "Major regime" — defined now, so it cannot be chosen later

A regime cohort counts as **major** only if it holds **≥ 30 eligible setups in
each arm**. Cohorts below that are reported but excluded from C3, because
requiring a sign match on a 13-setup cell would fail the gate on noise rather than
on evidence.

Two regime axes, both already fixed by earlier phases:

1. **Era** — `old` (< 2022-01-01) vs `new` (≥ 2022-01-01), the split inherited
   from phase 9.
2. **Breadth cohort** — strong (top decile of advancing share), ordinary
   (deciles 4–7), weak (bottom decile), cut on all 2,905 sessions as frozen in
   the post-backfill plan at `0d606bf`.

### Concentration — "majority" defined now

Contribution of a cluster `c` to the aggregate delta is the change in the overall
mean-T+5 difference when `c` is removed. "More than 50% of the effect" means
removing it cuts the point estimate by more than half.

**Sector is unavailable**: the schema carries no sector field (`sectorExposure` in
the paper-lab subsystem is hardcoded `UNKNOWN`). Sector concentration is therefore
**declared untestable** rather than silently skipped. Symbol, year and quarter are
tested.

---

## §2 Mechanical-artefact separation

The prior review's central objection: `NOT_FEASIBLE_NOISE` means a *tighter* stop,
and a tighter stop is mechanically easier to hit.

- **The primary endpoint (`fwd5`) knows nothing about the stop.** It cannot be a
  stop artefact. It carries the gate alone.
- Stop-first, R-normalised outcomes and stop distance are **supporting evidence
  only** and may not override a failed primary.
- Stop-first is additionally reported **within matched stop-distance bands**
  (<3%, 3–5%, 5–8%, >8%) so any residual gap can be seen to survive or vanish once
  distance is held fixed.

---

## §3 Confounders — robustness, not feature discovery

The primary is recomputed **stratified** by: stop distance, ATR/volatility, price
level, liquidity (traded value), volume ratio, market regime, year, quarter,
trend strength (distance from MA20 and MA50), and Gate 1 level.

**No model is fitted. No feature is selected.** The only question is whether the
sign survives reasonable stratification.

## §4 Temporal robustness

Full history · earlier half vs later half · the regime cohorts · yearly cohorts
where n permits. **Sample counts are reported for every cohort**, and no period is
excluded after seeing its result.

## §6 Visibility invariant

The feasibility label is **observational only**. For every setup:

```
V1 visibility before  ==  V1 visibility after
```

Proved by an automated test asserting that V1 visibility is a pure function of
`(gate1Level, quality)` and **cannot** be influenced by the feasibility verdict —
so no setup can become shown or hidden because of this gate.

## §7 Production invariant

No wiring, no scanner change, no feature flag, no D0–D5 behaviour change, no
threshold tuning, no dependency upgrade. `git diff` against the baseline over
`src/` is reported as proof, and any change must be test-only.

## §8 Data integrity

The current reconstructed dataset is used and **outcomes are recomputed from raw
bars** — no cached outcome is read. Duplicate check, OHLCV validity policy,
settled-session consistency and the no-look-ahead poison test are re-run. **Any
temporal leakage ⇒ `DATA NO-GO`.**

## §10 Verdict

Exactly one of `FEASIBILITY GO` · `FEASIBILITY NO-GO` · `DATA NO-GO`.
**`GO WITH CONDITIONS` is not available.**

## §11/§12 What follows

If **GO**: nothing is implemented. The only output is a proposal for a *separate*
implementation gate, which needs its own approval.

If **NO-GO**: stop. No search for another decomposition, no threshold tuning, no
mining of secondary metrics for a replacement hypothesis. The negative result is
reported and production is left exactly as it is.
