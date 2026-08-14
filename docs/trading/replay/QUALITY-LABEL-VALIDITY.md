# Does `quality: A | B` earn its dual role?

**Date:** 2026-08-14 · Executes
[`QUALITY-LABEL-PREREGISTRATION.md`](QUALITY-LABEL-PREREGISTRATION.md), committed
at `2c97ca6` **before any interval, calibration or decomposition existed**
**Basis:** 574 resolved setups · 338 A / 236 B · quarter-clustered inference

---

## Verdict: `UNDERPOWERED`

**And the most important finding in this phase is not the verdict.** It is this:

> **The `close >= MA20` half of the quality definition is logically redundant.**
> Gate 2 has already enforced it upstream in 99.3% of cases. `quality` is, in
> practice, `volRatio >= 1.5` and nothing else — a single volume threshold that
> currently decides candidate visibility, the risk multiplier, the daily trading
> stance, a manager entry gate, the largest term of an opportunity score, and a
> confidence basis.

---

## 1. Source dependency map — six decision consumers, not two

`quality` is produced once, at
[`breakout-pullback.ts:398`](../../../src/lib/scanner/gate2/breakout-pullback.ts):

```
quality = (volRatio >= 1.5) && (close >= ma20)  ?  "A"  :  "B"
```

| # | consumer | effect | source |
|---|---|---|---|
| 1 | Gate 1 surfacing under `WARNING` | **B hidden entirely** | `collect-candidates.ts:32` · `run-daily-scan-job.ts:310` · `replay-engine.ts:372` |
| 2 | position sizing risk multiplier | **A = 1.0, B = 0.5** | [`position-sizing.ts:33-35`](../../../src/lib/position-sizing.ts) |
| 3 | daily trading stance | `WARNING` + ≥1 A → `PROBE`, else `NO_TRADE` | `trading-decision.ts:51` |
| 4 | paper-lab manager entry gate | hard reject on `minGate2Quality` | `evaluate-manager.ts:90-93` |
| 5 | paper-lab opportunity score | **largest single term, weight 0.35** (A=1, B=0.6) | `rotation.ts:44` |
| 6 | paper-lab confidence basis | `fGate2` A=1, B=0.6 | `confidence.ts:34` |

`rankScore` is **not** a consumer — but it is built from `volRatio` too, and so is
the confidence score's `fVol` term. So:

```
volRatio ─┬─► quality A/B ──► six decisions above
          ├─► rankScore volumeTerm
          └─► confidence fVol
```

**One primitive reaches a decision by three independent paths**, and that is true
regardless of anything the outcome test says.

## 2. The component decomposition — behind a drift gate that passed

The stored `relVolume` field is a near-but-inexact reconstruction of Gate 2's
`volRatio`: **24 of 574 rows contradict the stored label**. Using it would have
been the definition drift the preregistration warned about. Instead both
components were re-derived with Gate 2's own primitives — its dedup function, its
median convention, its `sma`.

**Drift gate: the recomputed label reproduced the stored label 574/574 = 100.00%.**
Gate passed, decomposition reportable.

| `volRatio ≥ 1.5` | `close ≥ MA20` | n | P(continuation) |
|---|---|---|---|
| **T** | **T** | **338** | **32.54%** ← this cell *is* quality A |
| T | F | 2 | 0.00% |
| F | T | 232 | **36.21%** |
| F | F | 2 | 50.00% |

**570 of 574 setups (99.3%) satisfy the MA20 condition.** That is not a
coincidence, and the source says why:

```
pullbackZoneLow = min( max(breakoutLevel × 0.98, ma20), breakoutLevel )
…
if (close < pullbackZoneLow) → INVALID          breakout-pullback.ts:251, 306
```

Whenever `ma20 ≤ breakoutLevel`, `pullbackZoneLow ≥ ma20`, so surviving the
pullback-zone check **forces** `close ≥ ma20`. The only escape is
`ma20 > breakoutLevel` — a stock that ran so far past its breakout that MA20
climbed above it — which happened in **4 of 574 setups**.

So the two-component label has one live component. Whatever `quality` measures,
it measures volume.

## 3. Primary comparisons

Bonferroni over three comparisons ⇒ **α = 0.0167**; intervals are 98.33%
cluster-bootstrap over quarters; p-values are stratified permutation within
quarter.

| id | stratum | nA | nB | A | B | **A − B** | 98.33% CI on A−B | perm p |
|---|---|---|---|---|---|---|---|---|
| P1 | all | 338 | 236 | 32.54% | 36.02% | **−3.47pp** | [−13.67, +6.86] | 0.4026 |
| **P2** | **`WARNING`** | 231 | 153 | 37.23% | 36.60% | **+0.63pp** | [−13.66, +14.01] | 0.9087 |
| P3 | `PASS` | 82 | 67 | 24.39% | 35.82% | −11.43pp | [−28.17, +6.82] | 0.1405 |

`FAIL`, descriptive only: A n=25 **16.00%**, B n=16 31.25%.

P3 was **declared underpowered in advance** (MDE 26.22pp against an already-known
11.43pp gap) and carries no verdict.

**No stratum separates A from B.** The intervals span roughly ±14pp and exclude
nothing.

## 4. The economic criterion — WITHDRAWN as contaminated

> **This section's criterion is struck from the evidence** on the independent
> review's CRITICAL finding 9, which is correct. See Part II.

The preregistration froze a criterion — that the labels must sit on opposite sides
of the 33.33% break-even — **after already disclosing that A = 32.54% and
B = 36.02% were derivable from the published S1 table.** Knowing both values means
knowing which side of 33.33% each sat on. A criterion designed around absolute
levels the author already knew is post-hoc rationalisation whatever the document
calls it, and disclosing the prior knowledge does not repair it.

The 33.33% *reference* is not contaminated — it is inherited from the frozen
outcome definition and was used identically in S1. The **straddle criterion built
on it** is, and it is withdrawn.

What remains is the underlying arithmetic, reported as description rather than as
a preregistered test:

| stratum | A | B |
|---|---|---|
| P1 all | 32.54% [26.86, 38.69] | 36.02% [29.66, 42.65] |
| **P2 `WARNING`** | 37.23% [30.34, 44.19] | 36.60% [27.41, 46.50] |
| P3 `PASS` | 24.39% [15.71, 34.67] | 35.82% [25.71, 46.38] |

In the one stratum where the label decides visibility, both tiers sit above the
break-even reference and within 0.63pp of each other. That is a fact about the
table. **It is no longer offered as a criterion, and the verdict does not use
it.**

## 5. Robustness, era stability, secondary outcomes

**Moving-block bootstrap** (30-session blocks, longer than the 20-session outcome
horizon, because 34.8% of forward windows cross a quarter boundary):

| | rate | quarter-clustered 95% CI | block-bootstrap 95% CI |
|---|---|---|---|
| A | 32.54% | [26.86, 38.69] | [27.37, 40.96] |
| B | 36.02% | [29.66, 42.65] | [28.83, 43.28] |

Materially identical. The clustering choice is not carrying the result.

**Era stability** (descriptive, §7):

| | nA | nB | A | B | A − B |
|---|---|---|---|---|---|
| old | 158 | 127 | 39.24% | 42.52% | −3.28pp |
| new | 180 | 109 | 26.67% | 28.44% | −1.77pp |
| `WARNING` old | 113 | 86 | 44.25% | 45.35% | −1.10pp |
| `WARNING` new | 118 | 67 | 30.51% | 25.37% | **+5.14pp** |

**The sign inverts inside `WARNING` between eras** — the only stratum where the
label runs the assumed direction is the recent half of the one stratum where it
matters, and it runs the other way in the older half. On 67 and 86 observations,
that is what noise looks like.

**Secondary outcomes (H2 ordering):** not supported. A has the **higher** failure
rate (67.46% vs 63.98%), marginally higher MFE/ATR (2.26 vs 2.16), marginally
better MAE/ATR (−2.11 vs −2.14) and a better forward-20 (0.00% vs −0.38%). Mixed,
with no consistent ordering in either direction.

**Direction across all strata:** A ≤ B in P1, P3, `FAIL`, old era, new era, and
`WARNING` old — 6 of 7. It runs the assumed way only in `WARNING` new. These
strata overlap and are not independent, so this is a description of the table, not
a test, and no test of it is preregistered or permitted.

## 6. Calibration, reconciliation, look-ahead

| check | result |
|---|---|
| NC1 cluster-bootstrap CI coverage, synthetic clustered null at ICC 0.0609, 2,000 runs | **93.0%** (target 95%) |
| NC2 stratified-permutation empirical FPR at nominal 5%, 400 runs | **5.0%** |
| calibration gate | **PASS** |
| reconciliation | 574 = 338 A + 236 B, exact |
| **§15 poison test** — 200 labels re-evaluated with every bar after T corrupted | **0 labels changed** |
| guard violations | 0 |

NC1 under-covers by ~2pp, which means the reported intervals are slightly **too
narrow**. The true intervals are wider, which strengthens rather than weakens the
conclusion that nothing is resolved.

## 7. Power — why the verdict is `UNDERPOWERED` and not `NOT JUSTIFIED`

Committed before any interval:

| comparison | SE of difference | MDE₈₀ at α=0.0167 |
|---|---|---|
| P1 all | 4.57pp | **14.79pp** |
| P2 `WARNING` | 5.37pp | **17.38pp** |
| P3 `PASS` | 8.10pp | 26.22pp |

The preregistration fixed the distinction: **`NOT JUSTIFIED` requires the interval
to exclude the effect size the architecture needs, not merely to include zero.**

It does not. P1 spans [−13.67, +6.86] and P2 spans [−13.66, +14.01]. A difference
of +7pp — comfortably enough to argue for a risk multiplier and a visibility
filter — sits inside both. **This study cannot rule that out**, so it may not
report the coupling as refuted.

Applying that discipline here is the same correction the S1 review forced when a
−0.71pp difference at p=0.92 was nearly labelled `ABANDON`. The rule was written
into this preregistration precisely so it would bind before the numbers arrived,
and it binds.

---

## §11 The coupling test — two verdicts, separately

The preregistration required these to be reported apart, and they come out the
same way for the same reason.

### Visibility role — `UNDERPOWERED`

`WARNING × A` 37.23% vs `WARNING × B` 36.60%, difference **+0.63pp**, p = 0.9087,
CI [−13.66, +14.01]. Hiding B removes 153 resolved setups whose continuation rate
is indistinguishable from the 231 that are kept. **No evidence supports the
filter, and none refutes it.**

### Sizing role — `UNDERPOWERED`

Pooled A 32.54% vs B 36.02%, difference **−3.47pp** against an architecture that
gives A twice the risk. The point estimate runs backwards; the interval
[−13.67, +6.86] contains both the assumed direction and its opposite. **The
direction is unsupported, not refuted.**

---

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 15 attack vectors. **Five it
could not refute**: population leakage (the poison test changed 0 of 200 labels),
definition drift (100% reproduction), outcome leakage, pseudo-replication, and
the clustering choice.

Two CRITICAL findings. **One is correct and a line of evidence is withdrawn. The
other is a category error and the verdict stands.**

## Upheld — the economic criterion was contaminated

> *"Designing a specific numerical threshold around absolute levels that the
> researcher already knows is a severe violation of preregistration principles. It
> is post-hoc rationalization disguised as a priori design."*

**Correct.** The preregistration disclosed that A = 32.54% and B = 36.02% were
derivable from the published S1 table, and then froze a criterion about which side
of 33.33% each label sat on. Disclosure is not decontamination. The straddle
criterion is **struck** (§4 above), and the verdict never depended on it.

Worth being precise about the boundary: the 33.33% *reference* is inherited from
the frozen outcome definition and was used identically in S1, so it is clean. The
criterion built on it is not.

## Refuted — MDE is a property of the study, not of the architecture

The review's other CRITICAL finding argues the verdict should be `NOT JUSTIFIED`:

> *"The pre-calculated MDE is 14.79pp. The P1 interval is [−13.67, +6.86]. This
> interval strictly excludes the +14.79pp required effect size."*

**14.79pp is not a required effect size.** It is this study's minimum *detectable*
effect at 80% power — a statement about the sample, not about what the
architecture demands. Treating the two as the same quantity would let any
underpowered study declare refutation by pointing at its own MDE.

The architecture's actual requirement can be computed, because the frozen outcome
is a first-passage race with fixed magnitudes: expectancy per unit risk is
`E = 2p − (1−p) = 3p − 1`. A 2× risk ratio is warranted, Kelly-style, when
`edge_A = 2 × edge_B`:

| B's rate | edge_B | A must reach | **required gap** |
|---|---|---|---|
| 33.33% | 0.000 | 33.33% | +0.00pp (degenerate) |
| **36.02%** (observed) | +0.081 | 38.71% | **+2.69pp** |
| 36.60% (`WARNING` B) | +0.098 | 39.87% | +3.27pp |
| 40.00% | +0.200 | 46.67% | +6.67pp |

**The required gap is about +2.7pp, and the interval [−13.67, +6.86] contains
it.** The data are compatible with the architecture's claim. They do not support
it — the point estimate is −3.47pp — but "compatible with and unsupported" is
exactly `UNDERPOWERED`, and calling it refutation would repeat the error the S1
review corrected two commits ago.

## Refuted — hit rate is expectancy here, by construction

Finding 10, HIGH: *"Position sizing scales with expectancy, not hit rate alone.
Evaluating a magnitude-based multiplier using a scale-free probability metric is
structurally invalid."*

True in general; **not true for this outcome definition.** The frozen outcome is a
race to exactly +2.0 ATR against exactly −1.0 ATR, so expectancy is `3p − 1` — a
strictly increasing function of the hit rate. For this measurement, ranking by
`P(continuation)` and ranking by expectancy are the same ranking.

The limitation the finding correctly implies is real but different: a *tradable*
strategy does not exit at exactly ±k·ATR, so real expectancy is not a function of
this `p` alone. That is what the secondary MFE/MAE metrics are for, and they show
no ordering either — median MFE/ATR 2.26 vs 2.16, median MAE/ATR −2.11 vs −2.14.

## Refuted — the decomposition was preregistered, not fished

Finding 15, LOW: reporting the 2×2 and the MA20 redundancy is *"exploratory
fishing outside the frozen statistical plan."*

The phase brief's §6 **mandates** the decomposition, and the preregistration froze
its protocol in full, including the drift gate that had to pass at 100% before it
could be reported at all. It is preregistered descriptive analysis, executed after
the primary tests exactly as specified, with every forbidden follow-up named and
not taken.

## Corrected — Bonferroni is conservative here, not invalid

Finding 8 calls Bonferroni across P1, P2 and P3 *"mathematically invalid because
the strata are not independent."* Bonferroni controls the family-wise error rate
under **arbitrary** dependence; non-independence makes it conservative, not
invalid. The review concedes the point does not matter — the smallest permutation
p is 0.1405, which fails even an unadjusted 0.05.

## Accepted and added — survivorship declaration

Finding 13 is right that the universe construction must be declared. It is:
membership is resolved point-in-time from bar evidence, but phase 12 measured that
**only 3 of the 355 symbols with bars are absent from today's listing**, so the
cross-section is very nearly "companies still listed in 2026". The bias is
symmetric across A and B — both are drawn from the same setups — so it does not
distort the A−B contrast, but it is declared rather than assumed away.

## Accepted — the era reversal strengthens the verdict

Finding 12, HIGH: the `WARNING` gap flips from −1.10pp to +5.14pp between eras, so
the pooled +0.63pp is *"mathematically true but empirically useless."* Agreed —
and it points the same way the verdict does. A formal structural-break test on
subsamples of 67 and 86 would resolve nothing; the instability is itself the
evidence that this label's direction is not established.

## §17.16 Architectural implication

`UNDERPOWERED` is a statement about this dataset. It is **not** a neutral finding
about the architecture, and reading it as "no action needed" would be a mistake.
Three things are established regardless of the intervals:

1. **The MA20 component is redundant.** Verified from source and reproduced at
   100% by the drift gate. A two-condition label with one live condition is a
   maintenance liability whatever its predictive power — the code reads as though
   two independent things are being checked, and one of them was already checked
   upstream.
2. **One primitive drives six decisions.** `volRatio` reaches visibility, sizing,
   stance, a manager gate, an opportunity score and a confidence basis. A change
   to the 1.5 cutoff moves all six at once, and none of them can be studied
   separately while that is true. This is the same conflation the phase-13 audit
   named as failure mode F2, now measured rather than asserted.
3. **The coupling has never been supported by evidence, and this dataset cannot
   supply it.** No stratum separates the tiers; the point estimate runs backwards
   in six of seven; the secondary outcomes give no ordering; and the one stratum
   running the assumed direction inverts between eras. That is not proof the label
   is worthless — it is proof that nobody has shown it is worth anything, and that
   this dataset cannot settle it either way.

Per §18, the precise coupling that a later architecture phase must sever, stated
and stopped there:

> **`quality` must not decide visibility and size with the same value.** Whatever
> replaces it, the visibility question and the sizing question must read
> separately-justified inputs, so that each can be falsified on its own.

**What this phase does not do, per §14 and §18:** no replacement label is
proposed, no cutoff is tuned, no component is promoted, no composite is built,
nothing in `src/` is touched.

## `NEW HYPOTHESIS — NOT TESTED`

Recorded and stopped:

- **The live component points the wrong way.** `volRatio ≥ 1.5` gives 32.54%
  against 36.21% for `volRatio < 1.5` — higher volume associating with *lower*
  continuation, by 3.67pp. Untested, unpowered, and explicitly not to be pursued
  in this phase.
- **`PASS × A` is the worst retained cell** (24.39%) while `FAIL × B` is not the
  worst discarded one. Carried forward from S1, still untested.
