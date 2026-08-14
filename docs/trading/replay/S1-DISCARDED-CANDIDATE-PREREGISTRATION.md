# Preregistration — S1, the discarded-candidate edge test

**Date:** 2026-08-14 · Phase 14 · Written and committed **before** any outcome is
split by population. Not editable afterwards; deviations are recorded as
deviations.

**Question, and only this question:**

> Among setups Gate 2 already found and V1 threw away for market-gate reasons, is
> there enough real continuation to justify building an early-surface / probe
> mechanism at all?

Not "can a profitable subgroup be found inside the discarded population". That is
a different question and it is forbidden here.

---

## §0 Reproduction gate — passed

| check | result |
|---|---|
| commit | `90b7d44` |
| typecheck | 0 errors |
| tests | 1234 / 1234 |
| call chain proven from source | yes, below |

**Gate 2 is computed before Gate 1 discards anything.** Three call sites, one
shared rule:

| site | Gate 2 evaluated | Gate 1 filter applied |
|---|---|---|
| [`collect-candidates.ts`](../../../src/lib/scanner/gate2/collect-candidates.ts) | line 88 | lines 99–100 |
| [`run-daily-scan-job.ts`](../../../src/lib/scanner/run-daily-scan-job.ts) | line 302 | lines 308–310 |
| [`replay-engine.ts`](../../../src/lib/replay/replay-engine.ts) | line 298 | lines 370–372 |

All three call `deriveGate1SurfacingRule()`. **S1 imports that same production
function** to assign populations. Neither Gate 1 nor Gate 2 is reimplemented.

---

## §1 Populations — frozen

Assignment is `deriveGate1SurfacingRule(gate1Level)` applied to each setup's
tier, exactly as production applies it:

| Gate 1 at T | rule | tier A | tier B |
|---|---|---|---|
| `PASS` | `all` | RETAINED | RETAINED |
| `WARNING` | `tier-a-only` | RETAINED | **DISCARDED** |
| `FAIL` | `none` | **DISCARDED** | **DISCARDED** |

`DISCARDED` therefore means one thing only: **Gate 2 found it, and market-gate
logic made it disappear.** It never means Gate 2 invalid, tradability failure,
malformed geometry, or a setup produced by any new rule. No new candidate is
created anywhere in this phase.

**Reconciliation, verified before this document was written:**

```
raw Gate-2-valid 765 = RETAINED 501 + DISCARDED 264      exact, 100% join
```

### Source of the setups

[`docs/trading/replay/continuation/setups.ndjson`](continuation/setups.ndjson),
produced by `run-continuation-study.ts`, which calls `evaluateMarketRegime` and
`evaluateBreakoutPullbackCandidate` directly and **does not apply the Gate 1
surfacing filter** — which is why both populations survive in it.

> **Disclosure that matters more than it first appears.** Because that dataset was
> never Gate-1 filtered, the continuation decay reported by phases 9–12 —
> 40.8% → 27.1% — was measured on **RETAINED ∪ DISCARDED**, not on what V1 would
> actually have traded. Every decay figure this project has quoted includes
> setups V1 discards. That does not invalidate the decay, but it means the
> RETAINED-only rate has never been reported either, and S1 measures both for the
> first time.

### Frozen funnel and information units

| | setups | symbols | dates | months | quarters |
|---|---|---|---|---|---|
| raw Gate-2-valid | 765 | | | | |
| after frozen dedup | 598 | | | | |
| **resolved** (`CONTINUATION`\|`FAILURE`) | **574** | 112 | 472 | 119 | 47 |
| — RETAINED | **380** | 102 | 331 | 108 | 47 |
| — DISCARDED | **194** | 82 | 177 | 89 | 44 |

Era counts: RETAINED old 181 / new 199 · DISCARDED old 104 / new 90.

Dedup is the frozen rule from the continuation-study preregistration: same
symbol, breakout level within 0.5%, within `GATE2_RANGE_DAYS` sessions, earliest
kept.

### §11 sanity — DISCARDED is not a rounding error

**194 of 574 resolved setups, 33.8%, over 89 months and 44 quarters.** V1 throws
away a third of everything Gate 2 finds. The definition is not widened for any
reason, whatever the result.

Composition of DISCARDED, descriptive only (§8): `WARNING × B` 208 raw,
`FAIL × A` 37, `FAIL × B` 19.

---

## §2 Outcome — frozen, reused, not invented

Inherited unchanged from the continuation-study preregistration, which is the
definition used to replicate the decay:

- entry at the **next session's open**
- `A` = adverse threshold = **1.0 × ATR** below entry (`MIN_STOP_ATR_MULTIPLE`)
- `C` = continuation threshold = **2.0 × ATR** above entry
- horizon **20 sessions**
- `CONTINUATION` = reaches `+C` before `−A`; `FAILURE` = reaches `−A` first;
  `AMBIGUOUS` = neither within 20 sessions

**Primary endpoint: `P(continuation)` among resolved setups.**

Secondary, descriptive only, no significance claim: failure rate, MFE/ATR,
MAE/ATR, forward-20 return, time to resolution.

`AMBIGUOUS` (24 of 598 unique) is reported and never silently dropped.

**R-multiple is not used as the primary.** Earlier phases showed stop geometry
distorts it.

---

## §5 Economic floor — audited, and it is a reference, not a threshold

The outcome is a first-passage race to **+2 ATR against −1 ATR**. That is exactly
a 2:1 binary structure, so the arithmetic break-even of **33.3%** does apply to
this outcome definition. The §5 audit therefore passes and 33.3% may be used.

Three limits on what it means, stated before it is used:

1. It is the break-even of **this measurement**, not of a tradable strategy. Real
   exits do not fill at exactly ±k·ATR.
2. It ignores fees, slippage and gap risk, all of which push the true break-even
   **higher**.
3. `AMBIGUOUS` setups are excluded from the denominator, which the arithmetic does
   not account for.

**33.3% is an economic reference used in the decision rule. It is not a
statistical threshold and no test is calibrated against it.**

---

## §3/§4 Hypotheses — frozen

### H1 — primary

> `P(continuation | DISCARDED)`, pooled over the whole date range, against the
> 33.3% economic reference.

One-sided, quarter-cluster permutation. This is the primary because it asks §4's
actual question: does the discarded population contain enough continuation to be
worth surfacing — **not** whether it beats what V1 keeps.

### H2 — secondary, and declared underpowered in advance

> `P(continuation | DISCARDED)` − `P(continuation | RETAINED)`, pooled.

Reported with an interval. **It cannot by itself produce a PROCEED**, because the
power calculation below shows its MDE is roughly twice the smallest difference
that would matter. Declaring this now, before the result, prevents it being
promoted afterwards.

### Not hypotheses

Era breakdowns (§7), discard-reason breakdowns (§8) and all secondary metrics are
**descriptive**. They may not be promoted, and no rule may be built from them.

---

## §6 Power — computed before any outcome was read

ICC measured in phase 13 on the same 574 setups: **month 0.0829, quarter 0.0609,
symbol 0.0000** (symbol is therefore not a cluster level). Governing inference is
quarter-clustered, per the forward protocol frozen at `9738e69`.

| cell | n | quarters | SE (quarter) | MDE₈₀ one-sided |
|---|---|---|---|---|
| **DISCARDED, pooled** | **194** | **44** | **3.72pp** | **9.25pp** |
| DISCARDED old | 104 | 26 | 5.03pp | 12.50pp |
| DISCARDED new | 90 | 18 | 5.54pp | 13.78pp |
| RETAINED, pooled | 380 | 47 | 2.89pp | 7.19pp |

| comparison | SE of difference | MDE₈₀ two-sided |
|---|---|---|
| DISCARDED − RETAINED, pooled | 4.71pp | **13.20pp** |
| DISCARDED − RETAINED, old | 6.45pp | 18.08pp |
| DISCARDED − RETAINED, new | 6.95pp | 19.47pp |

**What H1 can and cannot resolve:**

- it can reject "the rate reaches 33.3%" if the true rate is **at or below 24.1%**
- it can establish "the rate exceeds 33.3%" if the true rate is **at or above 42.6%**
- between those, the 95% interval straddles the reference and H1 resolves nothing

**The dead zone [24.1%, 42.6%] is wide and it is known in advance.** The pooled
union rate across both populations is ~34%, so a DISCARDED rate near the union
would land inside it. This is disclosed now rather than discovered afterwards.

**The smallest difference that would matter for H2** is the ~6.3pp that would
carry the new-era rate from ~27% to the 33.3% reference. The MDE is 13.20pp,
about twice that. **H2 is underpowered for the effect that matters, by
construction.**

**Minimum sample, frozen:** DISCARDED must have ≥150 resolved setups and ≥30
quarters. Met at 194 and 44. If it were not met the verdict would be
`UNDERPOWERED` regardless of the point estimates.

---

## §12 Verdict rules — frozen, and deliberately asymmetric

Evaluated in order; the first that applies is the verdict.

### `INFERENCE INVALID`
Negative-control FPR does not reproduce nominal α · or any point-in-time guard
violation · or population reconciliation is not exact.

### `ABANDON V2 EARLY-SURFACING HYPOTHESIS`
Inference is valid and **either**:
- the 95% CI upper bound for `P(cont | DISCARDED, pooled)` is **below 33.3%** — the
  population cannot pay at the frozen structure even optimistically; **or**
- the DISCARDED point estimate is **below** the RETAINED point estimate, pooled —
  V1 is discarding the worse half, so surfacing it adds nothing.

### `PROCEED TO S2`
Inference is valid **and all** of:
- the 95% CI **lower bound** for `P(cont | DISCARDED, pooled)` is **at or above 33.3%**
- the DISCARDED point estimate is **at or above** the RETAINED point estimate, pooled
- the new-era DISCARDED point estimate is **not below** the new-era RETAINED point
  estimate — §7's requirement that the result is not an old-era artefact
- **no single quarter supplies more than 20%** of DISCARDED continuations

### `UNDERPOWERED`
Inference is valid and neither the abandon nor the proceed conditions are met —
i.e. the interval straddles the reference and the populations are not separated.

**On the asymmetry, declared before the result.** `ABANDON` triggers on a point
estimate; `PROCEED` requires a confidence interval. That is deliberate: **the
burden of proof is on the proposal to build machinery**, and the default is not to
build it. The asymmetry is in the *decision rule only* — both populations receive
identical dedup, identical outcome definition, identical clustering, identical
estimator and identical reporting.

There is no `promising`, no `maybe`, and no `needs tuning`.

---

## §10 Look-ahead

Population assignment uses `gate1` and `quality`, both computed at T from the
decision channel (`run-continuation-study.ts:81` and `:107`). Outcomes are read
only from bars after T through the outcome channel. The source dataset reported
**0 guard violations**; S1 adds no new data access.

Required: **guard violations = 0** and exact reconciliation. Either failing is
`INFERENCE INVALID`.

---

## §13 What may not be touched

No breadth, no market direction, no recovery state, no new RS threshold, no
absorption, no FRT/FPT pattern, no probe sizing, no risk ladder, no ranking, no
composite, no top-N, no exit optimisation. No production change of any kind.

If an interesting subgroup appears inside DISCARDED it is written down as
`NEW HYPOTHESIS — NOT TESTED` and left alone.

---

## Prior knowledge disclosed

A preregistration that claims blindness it does not have is worthless. What is
already known before the split is read:

1. **The union rate**: 40.8% (old) → 27.1% (new) pooled across both populations,
   and roughly 34% overall. Knowing a weighted average does not reveal the split,
   but it constrains it and is disclosed.
2. **A prior Gate 1 comparison exists**: the Gate 1 audit found `WARNING`-retained
   beating `PASS`-retained by about +2.3pp on forward return (n=270 vs 103). That
   is a comparison **inside** RETAINED. The DISCARDED population has never been
   scored by outcome in any phase.
3. **The funnel and all population counts above** were computed before this
   document, because §6 requires power before outcome. No continuation count was
   split by population.
4. **The `stopFeasible` share** differs by population — RETAINED 82.6%,
   DISCARDED 76.3%. This is a population characteristic, not an outcome, and it is
   reported because it is a candidate confounder rather than hidden because it is
   inconvenient.

---

## Hard stop

Whatever the result: no production change, no V2 implementation, no S2 design
unless the verdict is `PROCEED TO S2`. If the verdict is `UNDERPOWERED`, the
output states exactly how many additional information units would be required.
