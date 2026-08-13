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
