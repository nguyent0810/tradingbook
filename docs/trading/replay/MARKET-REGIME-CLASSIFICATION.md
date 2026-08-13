# Market regime: cap-weighted index × equal-weighted breadth

**Date:** 2026-08-13 · Research/diagnostic — Gate 1 untouched, no rule, no threshold tuned to outcome
**Basis:** 2,982 classifiable sessions (2014-09-05 →), 337 regime runs
**Data:** [`regimes/sessions.ndjson`](regimes/sessions.ndjson) · [`regimes/runs.json`](regimes/runs.json)

> **This document is the FROZEN classification.** It was written and committed
> before any strategy outcome was overlaid, so the regime definition cannot have
> been tuned to a result. Outcome overlay is a separate section added afterwards
> and is not permitted to change anything above it.

---

## 0. Reuse vs new

| component | status |
|---|---|
| per-session breadth (%>MA10/20/50), advance/decline, 52-week highs/lows, volume breadth, dispersion | **reused** artifact — already carries the staleness guard (a symbol must have traded that session) and the ≥100-symbol universe floor |
| Gate 1 label per session, leader flags | **reused** from `leadership/observations.ndjson` |
| `rollingMean`, PIT guard, repo MA/ATR constants | **reused** code |
| **equal-weight daily return + fixed cohort** | **new** — the cross-sectional axis needs a return series the internals run did not emit |
| **`market-regime.ts`** — two-axis classifier, runs, transitions | **new** |

The equal-weight series required re-running the internals script; everything else
was read from existing artifacts.

---

## 1–2. Two axes, four regimes

Both axes split on a **natural boundary**, not a fitted one:

| axis | rule |
|---|---|
| INDEX (cap-weighted) | is VN-Index at or above its own MA50? |
| BREADTH (equal-weighted) | are **more than half** of eligible stocks above their own MA50? |

"More than half" is what a majority of the market being in its own uptrend
means. Nothing here was chosen by looking at a forward return.

| | BREADTH STRONG | BREADTH WEAK |
|---|---|---|
| **INDEX STRONG** | `BROAD_ADVANCE` | `NARROW_RALLY` |
| **INDEX WEAK** | `RECOVERY_UNDERNEATH` | `SYSTEMIC_WEAKNESS` |

Sessions where either axis is unmeasurable — no MA50 yet, or fewer than 100
eligible symbols — are **excluded, never guessed**. That removes 842 of 3,824
sessions, all of them early history where the stored universe was too thin.

| regime | sessions | share |
|---|---|---|
| `BROAD_ADVANCE` | 1,418 | 47.6% |
| `SYSTEMIC_WEAKNESS` | 992 | 33.3% |
| `NARROW_RALLY` | 473 | 15.9% |
| `RECOVERY_UNDERNEATH` | 99 | **3.3%** |

---

## 3. What Gate 1 is lumping together

This is the finding the phase exists to produce, and it needs no forward return.

**Read by regime** — how each market state is labelled:

| regime | PASS | WARNING | FAIL |
|---|---|---|---|
| `BROAD_ADVANCE` | 532 | **886** | 0 |
| `NARROW_RALLY` | 165 | 308 | 0 |
| `RECOVERY_UNDERNEATH` | 0 | 66 | 32 |
| `SYSTEMIC_WEAKNESS` | 0 | **702** | 281 |

**Read by label** — what each Gate 1 verdict actually contains:

| Gate 1 | n | `BROAD_ADVANCE` | `NARROW_RALLY` | `RECOVERY_UNDER` | `SYSTEMIC_WEAK` |
|---|---|---|---|---|---|
| PASS | 697 | 76.3% | **23.7%** | 0% | 0% |
| **WARNING** | **1,962** | **45.2%** | 15.7% | 3.4% | **35.8%** |
| FAIL | 313 | 0% | 0% | 10.2% | 89.8% |

Two things follow directly:

**WARNING is the dominant label (66% of sessions) and it is a mixture of
opposites.** 45.2% of it is the healthiest regime in the matrix; 35.8% is the
worst. Gate 1 assigns the same verdict to a market where most stocks are
advancing above their own MA50 and to one where most are not, in near-equal
proportion.

**Nearly a quarter of PASS sessions are narrow rallies.** In 165 of 697 PASS
sessions the index was above its MA50 while the *majority of stocks were below
theirs*. Gate 1 cannot see this by construction: it reads one cap-weighted
series and has no cross-sectional term.

---

## 4. Is the classification structurally coherent?

**Run-count flip rate is 34.1%, which looks alarming and is misleading.**
Weighted by session — which is what a market participant experiences — the
picture is different:

| | share of sessions |
|---|---|
| in runs of ≥ 2 sessions | 96.1% |
| in runs of ≥ 5 sessions | **87.6%** |
| in runs of ≥ 10 sessions | 77.0% |
| in runs of ≥ 20 sessions | 60.1% |

The one-session flips are brief excursions between long stable stretches, not a
market that reclassifies itself daily.

**But the four regimes are not equally solid:**

| regime | runs | median | mean | max | one-session runs |
|---|---|---|---|---|---|
| `BROAD_ADVANCE` | 100 | 5 | 14.2 | 76 | 23% |
| `SYSTEMIC_WEAKNESS` | 79 | 5 | 12.6 | 77 | 29% |
| `NARROW_RALLY` | 115 | 2 | 4.1 | 37 | 37% |
| `RECOVERY_UNDERNEATH` | 43 | **1** | 2.3 | 12 | **60%** |

The two *agreeing* regimes are persistent states. The two *divergent* ones are
transitional, and `RECOVERY_UNDERNEATH` barely qualifies as a state at all — 60%
of its runs last a single session, and it occupies 3.3% of history.

### Transitions (run → next run)

| from ↓ / to → | `BROAD_ADV` | `NARROW_RALLY` | `RECOVERY_UND` | `SYSTEMIC_W` |
|---|---|---|---|---|
| `BROAD_ADVANCE` | — | **65%** | 24% | 11% |
| `NARROW_RALLY` | **58%** | — | 0% | 42% |
| `RECOVERY_UNDERNEATH` | 47% | 7% | — | 47% |
| `SYSTEMIC_WEAKNESS` | 15% | **60%** | 24% | — |

This is coherent rather than random, and it says something specific:

- **Deterioration narrows first.** `BROAD_ADVANCE` almost never collapses
  straight into `SYSTEMIC_WEAKNESS` (11%); it passes through `NARROW_RALLY` (65%).
- **Recovery is led by the index, not by breadth.** `SYSTEMIC_WEAKNESS` exits
  into `NARROW_RALLY` 60% of the time and into `RECOVERY_UNDERNEATH` only 24%.
  In this market, large caps turn first and the cross-section follows.
- `RECOVERY_UNDERNEATH` is a coin flip — 47% up into `BROAD_ADVANCE`, 47% back
  into `SYSTEMIC_WEAKNESS`.

That last point matters: the "recovery underneath" state that motivated several
earlier phases is both rare and unreliable in this market.

### Cutoff sensitivity

| breadth cutoff | runs | median run | one-session flips |
|---|---|---|---|
| 40% | 323 | 3 | 32.8% |
| 45% | 329 | 3 | 33.4% |
| **50%** | 337 | 3 | 34.1% |
| 55% | 320 | 3 | 26.6% |
| 60% | 326 | 3 | 29.1% |

Structure is stable across the boundary; nothing here depends on choosing 50%.

---

## 5 & 7. Cap-weight versus equal-weight — and a correction

### Regime frequency shifted after 2022

| regime | 2015–2021 | 2022–2026 | change |
|---|---|---|---|
| `BROAD_ADVANCE` | 54.1% | **39.6%** | −14.5pp |
| `NARROW_RALLY` | 13.5% | **20.7%** | **+7.2pp** |
| `SYSTEMIC_WEAKNESS` | 29.8% | 37.8% | +8.0pp |
| `RECOVERY_UNDERNEATH` | 2.6% | 1.9% | −0.7pp |
| **axes disagree** | **16.1%** | **22.6%** | +6.5pp |

Broad health nearly halved in frequency; narrow rallies rose by half.

### The level claim from earlier phases does NOT reproduce as stated

Three different equal-weight statistics over the same sessions:

| construction | 2015–2021 | 2022–2026 |
|---|---|---|
| VN-Index (cap-weighted) | +15.6%/yr | +3.6%/yr |
| compounding the daily **mean** across stocks | +36.0%/yr | +7.3%/yr |
| compounding the daily **median** across stocks | **−4.2%/yr** | **−16.7%/yr** |
| *(prior claim in `WHY-2022.md`: median stock buy-and-hold)* | *+13.7%/yr* | *−4.1%/yr* |

The cross-section is heavily right-skewed every day — the mean daily return
exceeds the median by **+0.14pp/day** in 2015–2021 — so mean-based and
median-based constructions diverge enormously. None of these is wrong; they
measure different things, and **`WHY-2022.md`'s specific numbers are a fourth
construction (per-symbol buy-and-hold, then median) that this daily pipeline does
not reproduce.** That document's numbers should be read as construction-specific,
not as *the* return of the typical stock.

**The correction that matters:** the gap between the index and the median stock
is **19.8pp/yr in 2015–2021 and 20.3pp/yr in 2022–2026** — essentially
unchanged. Earlier phases framed "the index looks healthier than the
cross-section" as something that emerged after 2022. On this construction it is
a **structural feature of this market throughout**, and what actually changed is
the regime mix: fewer broad advances, more narrow rallies.

---

## 6. Data quality and point-in-time

| requirement | status |
|---|---|
| stale bars | excluded — a symbol must have traded on session T to count |
| suspended / pre-listing | excluded by the same rule |
| minimum universe | 100 eligible symbols; 842 sessions dropped |
| forward-fill of non-trading names | **none** |
| guard violations upstream | 0 |
| truncation tests | `market-regime.test.ts`, plus the existing suites |

### Limits

- **Fixed cohort is small.** Only 129 symbols have history spanning 2015→2026, so
  composition-controlled statements rest on a narrow, survivor-selected base.
- **Survivorship.** 1,182 of 1,537 symbols have no stored bars; breadth is
  breadth of the stored universe, and delisted failures are absent.
- **No sector or size metadata.** `exchange` is NULL for 97.5% of symbols, so
  breadth cannot be decomposed by board, sector or capitalisation band — which is
  precisely the decomposition that would sharpen a cap-versus-equal question.
- **`RECOVERY_UNDERNEATH` is thin** (99 sessions, 43 runs, median length 1) and
  no conclusion should rest on it.

---

# PART II — Outcome overlay (added after the freeze above)

Everything above was committed at `5699c69` before any strategy outcome was
read. Nothing above was changed afterwards.

**Preregistered before looking:** primary comparison is mean forward return
between regimes, clustered on **regime runs** (not sessions, not trades, because
trades inside one run are not independent). 12 planned tests → Bonferroni
α = 0.00417. Both raw and corrected intervals are reported.

## 9. Does the baseline strategy behave differently by regime?

All 403 v2 executable-stop trades fall on classifiable sessions.

| regime | n | runs | win% | stop% | mean ret | median ret | expR | MFE | MAE |
|---|---|---|---|---|---|---|---|---|---|
| `BROAD_ADVANCE` | 313 | 52 | 37.1 | 55.9 | **+0.82%** | −2.75% | 0.199 | 7.83 | −4.58 |
| `NARROW_RALLY` | 55 | 35 | 40.0 | 50.9 | +2.20% | −1.74% | 0.738 | 10.15 | −4.53 |
| `SYSTEMIC_WEAKNESS` | 30 | 19 | 36.7 | 53.3 | **+3.19%** | −2.79% | 0.529 | 9.45 | −4.92 |
| `RECOVERY_UNDERNEATH` | 5 | 2 | 60.0 | 40.0 | +13.66% | +1.59% | 3.139 | 19.33 | −3.36 |

| comparison | raw 95% | Bonferroni /12 |
|---|---|---|
| `BROAD_ADVANCE` − `SYSTEMIC_WEAKNESS` | −2.37pp [−7.28, +1.78] | [−10.21, +3.38] |
| `BROAD_ADVANCE` − `NARROW_RALLY` | −1.37pp [−4.40, +1.57] | [−5.70, +2.92] |
| `NARROW_RALLY` − `SYSTEMIC_WEAKNESS` | −1.00pp [−6.38, +4.02] | [−9.48, +5.85] |

**Nothing separates.** No comparison excludes zero even before correction. The
point estimates run *opposite* to intuition — the healthiest regime produced the
lowest mean return — but that ordering is well inside noise and should not be
read as a finding either.

Two structural reasons the test is weak: 313 of 403 trades sit in
`BROAD_ADVANCE` (Gate 1 surfaces most where the index is strong, so the sample is
concentrated in one cell), and `RECOVERY_UNDERNEATH` has 5 trades across 2 runs.

## 10. Leader flags × regime

| regime | flags | runs | mean fwd20 | median | negative |
|---|---|---|---|---|---|
| `BROAD_ADVANCE` | 2,183 | 90 | −0.45% | −0.72% | 53% |
| `NARROW_RALLY` | 1,036 | 94 | +0.68% | −0.57% | 52% |
| `SYSTEMIC_WEAKNESS` | 1,269 | 60 | +0.41% | +0.41% | 48% |
| `RECOVERY_UNDERNEATH` | 70 | 21 | −1.27% | −2.43% | 64% |

| comparison | raw 95% | Bonferroni /12 |
|---|---|---|
| `BROAD_ADVANCE` − `SYSTEMIC_WEAKNESS` | −0.86pp [−3.81, +1.68] | [−5.23, +2.89] |
| `BROAD_ADVANCE` − `NARROW_RALLY` | −1.13pp [−4.97, +2.51] | [−6.69, +3.79] |

**Also null.** Once flags are clustered on regime runs rather than counted as
independent stock-sessions, market regime does not differentiate leader outcomes.

Note this does **not** contradict the earlier +11.25pp leader interaction across
recovery *episodes* — that conditioned on episode outcome, which is a different
and unknowable-at-the-time variable. Conditioning on a regime observable at T
produces nothing.

---

## Verdict: `REGIME MODEL DESCRIPTIVE ONLY`

| criterion | met? |
|---|---|
| point-in-time | **yes** |
| structurally coherent | **yes** — 87.6% of sessions in runs ≥5, structured transition matrix |
| stable to its own cutoff | **yes** — 40%–60% breadth boundary changes nothing material |
| distinguishes index-vs-cross-section divergence | **yes** — and quantifies what Gate 1 conflates |
| independent of outcome | **yes** — frozen and committed first |
| related to strategy outcome | **no** — every comparison contains zero, before correction |

The classification does the descriptive job it was built for: it demonstrates,
without needing a forward return, that Gate 1's dominant label mixes the
healthiest and worst market states in near-equal proportion, and that a quarter
of its PASS sessions are narrow rallies. It does **not** earn a claim that acting
on it would change results.

**Not supported, and explicitly not proposed:** any change to Gate 1, any risk
state, any sizing rule. The next phase's question is whether a better market
representation *helps* — this phase only establishes that a better *description*
exists.

---

# PART III — Independent review, and what it changed

**Reviewer:** Gemini 3.1 Pro via `agy` 1.1.12, 2026-08-13. Deliberately a
different tool and model family. Its verdict was `UNSTABLE AND INVALID`. I
verified each claim rather than accepting or dismissing it; four are upheld, one
is refuted by the data, and the headline finding is substantially narrowed.

## Upheld — the Gate 1 cross-tab is largely definitional

This is the serious one. Gate 1 `PASS` requires close > MA50; my INDEX axis *is*
close ≥ MA50. So `PASS ⊂ INDEX_STRONG` is a tautology, and `FAIL ⊂ INDEX_WEAK`
likewise. Quantified:

| Gate 1 | index axis split | breadth axis split |
|---|---|---|
| PASS (697) | **100% strong** — definitional | 76.3% / 23.7% |
| WARNING (1,962) | **60.9% / 39.1%** — definitional (WARNING spans both by construction) | 48.5% / 51.5% |
| FAIL (313) | **100% weak** — definitional | 10.2% / 89.8% |

And breadth turns out to track the index axis closely:

| within WARNING | n | breadth strong |
|---|---|---|
| ∩ INDEX_STRONG | 1,194 | **74.2%** |
| ∩ INDEX_WEAK | 768 | **8.6%** |

**So the "WARNING mixes the best and worst regimes" headline was overstated.**
Most of that mixture is the index axis — which Gate 1 already partly encodes —
not breadth. The reviewer is right that plotting Gate 1 against a matrix
containing Gate 1 and finding structure is close to circular.

**What survives, narrower but not tautological:** within `PASS` alone — a single
index state, so the index axis is held constant — **23.7% of sessions have the
majority of stocks below their own MA50**. That is pure cross-sectional
information Gate 1 does not have. It is a real finding about one label, not a
general claim that Gate 1 conflates opposites.

## Upheld — MA lookback was never sensitivity-tested

The cutoff table varied the breadth boundary but fixed MA50 on both axes. Filling
the gap, across nine lookback combinations:

| index MA | breadth MA | runs | median run | one-session flips | divergent share |
|---|---|---|---|---|---|
| MA20 | %>MA10 | 612 | 2 | 32.2% | 23.6% |
| MA20 | %>MA50 | 423 | 3 | 32.4% | 27.3% |
| **MA50** | **%>MA50** | 328 | 3 | 34.1% | 18.7% |
| MA50 | %>MA10 | 555 | 3 | 28.3% | 36.0% |
| MA100 | %>MA10 | 518 | 3 | 26.4% | 41.4% |
| MA100 | %>MA50 | 298 | 3 | 33.9% | 25.7% |

Structure is stable — median run 2–3 and flip rate 26–36% everywhere — so no
conclusion rests on MA50. But the **divergent share swings from 18.7% to 41.4%**
depending on the pair, and matched lookbacks minimise it. The frequency of
"the axes disagree" is therefore a property of the lookback pairing as much as of
the market, and §5's divergence percentages should be read that way.

## Upheld — the equal-weight construction, and the naming

Compounding a daily cross-sectional median is not a portfolio return and carries
a path-dependent drag, so the "20pp gap unchanged across eras" correction rests
on a construction no investor experiences. The narrower claim stands — different
constructions give wildly different levels, so `WHY-2022.md`'s figures are
construction-specific — but "the gap was always ~20pp" should be treated as an
artefact of that particular arithmetic, not as a fact about the market.

On naming: `RECOVERY_UNDERNEATH` implies a leading indicator, while the data says
43 runs, median length 1, and a 47/47 coin flip on what follows. The label
imports a conclusion the data refuses. It is kept for continuity with earlier
phases but should be read as "index weak, breadth strong" and nothing more.

## Refuted — the era comparison is not confounded by universe growth

The reviewer called this FATAL: a growing universe supposedly invalidates
comparing regime frequency across eras. The data does not support the mechanism.

> **corr(universe size, % above MA50) = −0.008** across 2,982 sessions.

| era | median universe | median %>MA50 |
|---|---|---|
| 2015–2021 | 221 | 51.9% |
| 2022–2026 | 271 | 44.6% |

Breadth is a percentage and is essentially uncorrelated with how many symbols are
in the denominator. Composition change — *which* symbols, not how many — remains
possible and untested, but the stated mechanism is refuted.

## Unresolved

**Survivorship.** 1,182 of 1,537 symbols have no stored bars, and the specific
mechanism the reviewer describes — weak names delisting out of the denominator
and inflating breadth during drawdowns — is plausible and cannot be tested with
this data. The 129-symbol fixed cohort is itself survivor-selected. This is the
strongest outstanding objection to every breadth number here.

**Post-selection.** Freezing the classification before the outcome overlay
prevents one specific failure and not the general one: the axes were chosen by
someone who had already spent seven phases on this dataset.

---

## Verdict after review: `REGIME MODEL DESCRIPTIVE ONLY` — retained, substantially narrowed

Not upgraded, and not downgraded to `UNSTABLE`: the classification is stable
across both the breadth cutoff and the MA lookback, and 60% of sessions sit in
runs of 20+ sessions. Not `INSUFFICIENT DATA`: 2,982 sessions classify cleanly.

But the descriptive claim is now much smaller than Part I asserted:

| claim | status after review |
|---|---|
| Gate 1 WARNING mixes the best and worst regimes | **withdrawn as headline** — mostly definitional |
| 23.7% of Gate 1 PASS sessions have majority-weak breadth | **stands** — pure cross-sectional information |
| Regime frequency shifted 2015–21 → 2022–26 | **stands** — universe-size confound refuted |
| Transition structure is coherent, not random | **stands** |
| Divergence share (16.1% → 22.6%) | **weakened** — depends on the MA pairing |
| Index-vs-median-stock gap unchanged at ~20pp | **weakened** — construction artefact |
| Strategy behaves differently by regime | **no evidence**, as reported in Part II |

The honest summary: a two-axis description of this market is **stable and
coherent**, it exposes **one** specific thing Gate 1 cannot see, and there is
**no evidence yet** that any of it would change a trading result.
