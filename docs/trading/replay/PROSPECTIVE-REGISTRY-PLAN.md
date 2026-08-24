# Prospective feasibility shadow registry — frozen plan

**Date:** 2026-08-24 · Committed **before implementation**, per §12
**Closure baseline:** `d5c9702` · **This phase makes no predictive claim.**

The mechanism exists to give the feasibility hypothesis a fair chance to be
**proven wrong**. Nothing here is optimised for proving it right.

---

## §1 The one frozen hypothesis

> Future setups classified **`FEASIBLE`** will have better forward outcomes than
> setups classified **`NOT_FEASIBLE_NOISE`**, under the already-frozen decision
> logic.

No threshold change. No MA-distance interaction. No regime-specific rule. No
retrospective fitting. The classifier is **exactly** the version already
evaluated.

## §1 Classifier — pinned at content level, not just by commit

Commit-level pinning is not enough: a file can change without the commit label
changing in a working tree. These are `git hash-object` blob hashes, verified by
the registry at write time.

| file | blob SHA |
|---|---|
| `src/lib/decisions/d2-feasibility.ts` | `965d8ebe5dbf1b122e6d2d0ef14d09bc445ff998` |
| `src/lib/decisions/contracts.ts` | `6b9a69d0add2aa081a97840e57e6e2bea634ba8f` |
| `src/lib/scanner/stop-feasibility.ts` | `cfc8adb4a6be756dabccf6350e42a50edfe3d83b` |
| `src/lib/scanner/gate2/breakout-pullback.ts` | `f1c87dd188e35760b2722b272dd09c4ef1d427cc` |

Introducing commit: **`2c9b418`**.

**If any of these hashes changes, the registry refuses to write** and the cohort
must be versioned (§10). Silent mixing of classifier versions is impossible by
construction, not by discipline.

## §2 Prospective boundary — immutable

```
PROSPECTIVE_START_EXCLUSIVE = 2026-08-24
eligible ⇔ decision session date  >  2026-08-24
```

The last settled session at freeze time is **2026-08-21**, and today is
**2026-08-24**. The boundary excludes today's session entirely, so no session that
could have been observed before or during the freeze can enter. **Nothing on or
before 2026-08-24 may ever be added to the prospective result set.**

Historical bars are used **only** to compute trailing features legitimately
required at decision time (MA, ATR, volume medians). Historical *setups* and
historical *outcomes* never enter.

## §3–§4 Schema — frozen, `prospective-registry@1.0.0`

Two **separate append-only files**, which is what makes §4 structural rather than
promised:

```
docs/trading/replay/prospective/decisions.ndjson   written once, never reopened for write
docs/trading/replay/prospective/outcomes.ndjson    appended later, references setupId
```

**Decision-time fields cannot be rewritten by the outcome process because the
outcome process never opens the decisions file for writing.**

### Decision entry

| group | fields |
|---|---|
| identity | `setupId` (deterministic `sha256(symbol\|session\|schemaVersion)`), `symbol`, `session`, `decisionRecordedAt`, `sourceDataCutoff`, `codeSha`, `classifierBlobs`, `schemaVersion` |
| classifier inputs | `entryPriceKVnd`, `structuralStopKVnd`, `riskFrac`, `atrKVnd`, `board`, `avgDailyValueVnd`, `minStopFrac`, `bindingFloor` |
| decisions | `v1Visibility`, `feasibility`, `feasibilityReasons`, `gate1Level`, `quality`, `validity`, `eligible` |
| geometry | `breakoutLevelKVnd`, `stopDistancePct`, `ma20DistPct`, `ma50DistPct`, `volRatioMedian`, `volRatioMean` |
| integrity | `lastInputBarDate`, `inputBarCount`, `entryHash` |

`entryHash` = SHA-256 over every decision-time field. A verifier recomputes it for
every row; **any drift fails CI.**

Nothing experimental is added because it looked interesting in the prior analysis.
MA distances and volume ratios are recorded because they already exist inside the
frozen contracts and the prior review demanded they be observable — **they are
observational fields, not classifier inputs**, and the registry marks them so.

### Outcome entry — `outcomes@1.0.0`

| field | definition |
|---|---|
| `entry` | **open of the first settled session after the decision session** |
| `fwd1`, `fwd3`, `fwd5` | close of T+1 / T+3 / T+5 ÷ `entry` − 1 |
| `win5` | `fwd5 > 0` |
| `mfe5`, `mae5` | max high / min low **through T+5**, ÷ `entry` − 1 |
| `stopFirst` | reaches `entry × (1 − riskFrac)` before `entry × (1 + 2 × riskFrac)` **within T+5** |
| provenance | `barDatesUsed` (exact), `outcomeRecordedAt`, `outcomeVersion` |

**MFE/MAE and stop-first use a T+5 window, matching the primary.** The last
phase's review correctly flagged a 20-session window against a T+5 endpoint as a
mismatch; it is fixed here, before any prospective data exists, rather than
carried forward.

## §5 Eligibility

Recorded: **every** Gate-2-valid setup after the boundary, whatever its verdict or
visibility — richer operational data costs nothing.

**Eligible for the primary** (`eligible: true`) iff the D2 verdict is `FEASIBLE`
or `NOT_FEASIBLE_NOISE`. `NOT_FEASIBLE_LIQUIDITY` and `UNKNOWN_INPUT` are recorded
and excluded, exactly as in the gate preregistration at `f280694`.

## §6 Production isolation

The registry is **not wired into the scan job**. It runs as a standalone recorder
invoked after a session settles.

That is a deliberate choice with the same reasoning M1 used and its reviewer
accepted: **zero production call sites make isolation provable rather than
argued.** The consequences are stated rather than hidden — the recorder must be
scheduled, and a missed run is a missed observation that may never be
reconstructed (§6 forbids fabrication).

The fail-open wrapper is still built and tested, because any future inline wiring
must go through it.

Hard invariants, all tested:

- no setup becomes visible or hidden because of registry logic
- no ordering, alert or scanner output changes
- registry failure cannot fail a scan
- the registry writes nothing to the production database

## §7 Prospective integrity — enforced, not promised

The failure mode that would silently destroy this experiment is running the
recorder **late**, after outcomes already exist. So:

> **The recorder refuses to write an observation for session `T` if any bar dated
> after `T` already exists in the database.**

This makes `decision inputs ≤ decision timestamp < outcome timestamp` a
precondition the machine checks, not a property a human asserts. Also tracked:
duplicate `setupId`, duplicate `(symbol, session)`, missing outcomes, stale input
bars, and post-decision data revisions.

**If history is later revised, originally observed decision-time values are
preserved.** Old prospective decisions are never recomputed on revised history —
the registry stores what was seen, and a separate revision report flags drift.

## §8 Evaluation checkpoints — frozen now

**N = 100 · N = 250 · N = 500** eligible observations with settled outcomes.

Reports are produced at those counts and nowhere else. **A favourable early
checkpoint authorises nothing.**

**Expected wait, computed and disclosed now so it cannot be quietly renegotiated:**
the recent rate is roughly **60–90 eligible setups per year** (2025: 88; 2026
year-to-date: 25). So

| checkpoint | expected elapsed |
|---|---|
| N = 100 | **~1.2–1.7 years** |
| N = 250 | ~3–4 years |
| N = 500 | ~6–8 years |

If accrual is slower, the report states elapsed time and N. **The checkpoint is
never lowered after seeing results.**

## §9 Frozen primary metric

> **mean T+5 return: `FEASIBLE` − `NOT_FEASIBLE_NOISE`**

Reported with both group Ns, both means, the delta, and a 95% interval.

**Temporal clustering method, frozen now** — quarter clustering will not work
early, because N=100 spans roughly six quarters:

- **moving-block bootstrap over non-overlapping 30-session blocks**, longer than
  the 5-session outcome window, 20,000 replicates, percentile interval;
- the **block count is always reported**; below **10 blocks** the interval is
  labelled **indicative** and carries no inferential weight.

Secondary: T+1, T+3, T+5 win rate, stop-first, MFE, MAE. **Secondaries cannot
override a failed primary.** No success threshold is redefined during collection.

## §10 Frozen between checkpoints

No classifier tuning, no stop/noise threshold change, no MA50 interaction, no
regime splitting, no symbol or sector exclusion, no eligibility redefinition.

If a genuine bug is found: **freeze the cohort, version it, start a new cohort
under a new version.** The blob-hash check makes silent version mixing impossible.

## §11 Operational monitoring — continuous, and separate

Observations written · missed · write failures · outcome completion rate ·
stale-data incidents · duplicate attempts · schema and classifier-version
mismatches.

**Operational health may be watched continuously. Predictive performance may not** —
it is evaluated only at the three frozen checkpoints.

## §13 What this phase returns

`PROSPECTIVE SHADOW READY` or `PROSPECTIVE SHADOW NO-GO`, concerning **registry
safety and correctness only**. It will make no statement about whether feasibility
has predictive value, because no prospective observation will exist yet.
