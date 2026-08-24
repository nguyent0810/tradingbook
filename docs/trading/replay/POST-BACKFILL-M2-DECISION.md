# Post-backfill diagnostic — the M1 → M2 decision gate

**Date:** 2026-08-24 · Executes
[`POST-BACKFILL-DIAGNOSTIC-PLAN.md`](POST-BACKFILL-DIAGNOSTIC-PLAN.md), committed
at `0d606bf` **before anything was recomputed**
**Baseline:** `2c9b418` · **Anchor:** 2026-08-21 · **CI:** 1262/1262, `src/` untouched

---

## Verdict: `M2 NO-GO`

M2 is the stage that makes **D1 visibility stop reading `quality`**, surfacing the
setups V1 hides. The plan fixed its failure condition before the numbers existed:

> *if `hidden → visible` setups perform no better than the agreement control, the
> decomposition produces more signals rather than better ones.*

**That condition fired.** The 198 extra setups are worse than the control on every
measure, in every regime — mean T+5, win rate, and stop-hit-first — and no
comparison favouring them comes close to excluding zero.

The plan's *second* failure condition — that the decomposed stop model might be
destroying winners — **did not fire**, and the feasibility split turns out to be
the one thing in this study with statistical support. That is a real finding, but
it is **not** the question this phase preregistered, so it does not convert a
NO-GO into a GO. It becomes its own gate, with its own preregistration.

---

## Dataset

| | |
|---|---|
| latest settled session (VNINDEX and equity) | **2026-08-21** |
| VNINDEX bars | 4,082 · 2010-04-15 → 2026-08-21 |
| equity bars | 707,513 · 2011-02-08 → 2026-08-21 |
| symbols with bars | 355 · registry 1,537 (281 active) |
| symbols trading on the anchor | 217 |

## Integrity

| check | result |
|---|---|
| duplicate `(symbol,date)`, index duplicates, future dates | **0 / 0 / 0** |
| equity sessions with no index bar; date or latest-session regression | **0 / none** |
| non-positive prices, negative volume, `high < low` | **0** |
| `open`/`close` outside `[low, high]` | 6,844 — **pre-existing**, 6,544 in 2018–2021, **0 in the last 90 days**, and they satisfy the importer's own usability rule |
| **T+1 entry prices outside their own bar range** | **0 of 763** |
| **T+1 bars with zero volume** | **0 of 763** |

**The backfill revised history rather than extending it**: 41,026 rows written on
2026-08-21 13:52 UTC, touching bars back to **2024-04-04**. Every prior artifact
was therefore recomputed from raw; none was reused.

**Integrity verdict: PASS.** No `DATA NO-GO` condition.

---

## M1 reconciliation — old vs newly recomputed

Like-for-like, applying the same frozen dedup:

| | prior M1 | rebuild | note |
|---|---|---|---|
| raw setups | 765 | **764** | |
| after dedup | 596 | **605** | |
| with a full 20-session forward | 574 | **602** | +28 windows completed since |
| resolved: V1 visible / hidden | 380 / 194 | **393 / 209** | |
| resolved: hidden → visible | 145 | **156** | |
| resolved: visible → hidden | 76 | **80** | |
| volume-primitive disagreement | 22.5% | **21.73%** | |
| shadow exceptions · UNEXPECTED divergences | 0 · 0 | **0 · 0** | |

**Only one setup falls after 2026-08-07**, the prior sample's last date. So the
differences are not new sessions — they are the backfill's revision of 2024–2026
bars, plus forward windows that have since completed. Every difference is
accounted for; none is unexplained.

Agreement matrix on all 764:

| | shadow SHOWN | shadow HIDDEN |
|---|---|---|
| **V1 SHOWN** | 407 | **94** |
| **V1 HIDDEN** | **198** | 65 |

Agreement 61.78%. Feasibility verdicts: `FEASIBLE` 605 (79.19%),
`NOT_FEASIBLE_NOISE` 138 (18.06%), `NOT_FEASIBLE_LIQUIDITY` 21 (2.75%). **Every
noise rejection is bound by the volatility floor** — none by tick or fee.

---

## 2026-08-21 — the anchor

### Measured before D0–D5 was consulted

**Index:** +1.95%, range 2.47%, close at **99.56% of range**, volume 783.5M
(1.19× MA20). Close **above** MA20 but **below MA50**, and MA20 < MA50.

**Breadth (217 symbols, all with non-zero volume):** advancing 128 (**58.99%** —
the **99.1st percentile** of 2,905 sessions since 2015), declining 52, unchanged
37. Excluding unchanged, advancing / (advancing + declining) = **71.11%**. Above
own MA20 55.76%; **above own MA50 only 34.10%**.

**Participation:** advancing-volume share **95.00%** — but only **45.62%** of
stocks traded above their own volume MA20, and the cross-sectional **median volume
ratio was 0.94×, below normal**.

**Concentration:** top 5 = 30.11% of traded value (5/5 advancing), top 10 =
**49.16%** (10/10 advancing), top 20 = **73.64%**. Equal-weight mean return
**0.74%** against an index return of **1.95%**.

**Limit-ups: 6 of 217 (2.76%)** by inferred band; **2 of 39 (5.13%)** among
symbols whose exchange is known. Band inference was validated first — 34 of 39
known exchanges recovered (87.18%) against a pre-set 80% threshold — but at these
counts the statistic is **indicative only**.

> **On the premise.** The session was **broad by count and concentrated by value**.
> 59% advancing at the 99th percentile is genuinely broad. But the index moved
> 2.6× the typical stock, three quarters of the turnover sat in twenty names, the
> median stock traded *below* its normal volume, and **"many limit-up stocks" is
> not supported at either measurement** — 6 or 2, depending on method. Our universe
> is 217 liquid names, so small-cap limit-ups would be systematically missed; that
> caveat cuts in the premise's favour and is stated rather than hidden.

### What the pipeline saw: **one setup**

| | 2026-08-17 | 08-18 | 08-19 | 08-20 | **08-21** |
|---|---|---|---|---|---|
| Gate 1 | FAIL | WARNING | WARNING | WARNING | **WARNING** |
| tradable | 76 | 75 | 75 | 75 | **74** |
| **Gate 2 valid** | 0 | 0 | 0 | 0 | **1** |

The single setup was **BVH**, tier A, volume ratio 1.81, `FEASIBLE`, and **V1 and
the shadow agreed** — both SHOWN. Rejection reasons on the anchor:

| reason | n | % of tradable |
|---|---|---|
| `trend_below_ma50` | 40 | **54.1%** |
| `trend_ma20_below_ma50` | 15 | 20.3% |
| `breakout_recency` | 11 | 14.9% |
| other | 8 | 10.7% |

**The answer to "did M1 recognise the participation, or did its primitives
suppress it?" is neither.** Gate 2's trend prerequisite excluded **74.4% of the
tradable universe** because the market was still below its own MA50 after a
decline — a +1.95% day does not move a stock above its 50-day average. The
decomposition had nothing to decide about.

**The anchor is a null experiment** and cannot discriminate V1 from the shadow.
The *funnel*, however, is an n=74 observation and stands on its own.

---

## Hidden → visible: the M2 question

Forward returns are **outcome labels**, read only from bars after T.

| population | n | med T+5 | mean T+5 | MFE | MAE | stopFirst | win@T+5 |
|---|---|---|---|---|---|---|---|
| **hidden → visible** | 198 | 0.00% | **−0.13%** | 4.94% | −5.33% | **56.57%** | **48.48%** |
| control: both SHOWN | 406 | 0.11% | **+0.80%** | 6.44% | −4.79% | 49.51% | 50.25% |
| visible → hidden | 94 | −0.40% | −0.19% | 5.34% | −7.02% | 65.96% | 41.49% |
| control: both HIDDEN | 65 | −0.09% | −0.77% | 6.29% | −7.09% | 70.77% | 46.15% |

Quarter-clustered bootstrap over 47 quarters, 20,000 replicates, against the
both-shown control:

| comparison | difference | 95% CI | |
|---|---|---|---|
| hidden→visible, mean T+5 | −0.93% | [−1.84%, +0.05%] | includes zero |
| hidden→visible, win@T+5 | −1.76% | [−11.86%, +8.80%] | includes zero |
| hidden→visible, stopFirst | +7.06% | [−3.96%, +17.12%] | includes zero |

**Nothing is significant, and every point estimate runs against the change.** By
regime — and the direction is the same in all three, which is the only reason the
underpowered cells are worth showing at all:

| regime | hidden→visible win | control win |
|---|---|---|
| strong breadth | 40.00% (n=15) | 42.86% (n=49) |
| ordinary | 45.21% (n=73) | 50.94% (n=159) |
| weak breadth | **34.21%** (n=38) | **70.37%** (n=27) |

The weak-breadth cells are far too small to support a conclusion of their own —
the reviewer is right about that, and it is stated rather than argued away. What
survives is the consistency of sign, not any individual cell.

---

## Visible → hidden: the finding that did survive

The plan's second failure condition asked whether the decomposed stop model
destroys winners. It does not: `visible → hidden` setups reach T+5 > +5% in
**12.77%** of cases against the control's **14.78%**.

Instead, the feasibility split is **the only comparison in the study that excludes
zero**:

| comparison | difference | 95% CI | |
|---|---|---|---|
| visible→hidden, stopFirst vs control | **+16.45%** | **[+4.76%, +26.05%]** | **excludes zero** |
| `FEASIBLE` − `NOT_FEASIBLE_NOISE`, **mean T+5** | **+1.19%** | **[+0.10%, +2.20%]** | **excludes zero** |
| `FEASIBLE` − `NOT_FEASIBLE_NOISE`, win@T+5 | +7.64% | [−1.59%, +15.85%] | includes zero |

### It is not the mechanical artifact it looks like

The obvious objection — and the review's lead CRITICAL — is that
`NOT_FEASIBLE_NOISE` means a *tighter* stop, and a tighter stop is mechanically
easier to hit. Three checks say otherwise:

**1. Held at matched stop distance, the gap persists:**

| stop distance | `FEASIBLE` stopFirst | `NOISE` stopFirst | gap |
|---|---|---|---|
| < 3% | 55.68% (n=88) | 67.07% (n=82) | +11.4pp |
| 3–5% | 52.80% (n=286) | 65.12% (n=43) | +12.3pp |
| 5–8% | 49.77% (n=219) | 69.23% (n=13) | +19.5pp |

**2. Mean T+5 knows nothing about the stop** and still differs by +1.19%,
excluding zero.

**3. Normalised excursion shows the mechanism:** rejected setups run
**2.12R** up and **−2.49R** down against the feasible group's 1.33R / −1.08R.
They swing roughly twice as far relative to their own risk — which is exactly what
a noise floor is supposed to catch.

---

## Volume primitive

Disagreement between the two definitions recomputes at **21.73%** (166/764),
against 22.5% on the prior sample — reproduced, no data drift.

What it measures, from session-level correlations: the gate tracks the individual
stock's own volume, **not** market participation. On the anchor — a 99th-percentile
breadth session — the market's median volume ratio was 0.94×, *below* normal, so a
broad advance in *count* is not a broad advance in *volume*. **The gate and market
breadth are answering different questions**, which is a structural mismatch worth
recording and, per the plan, **not fixed here**.

---

## Look-ahead

All **764** real setups were decided twice: once with full history, once with
every bar after T physically deleted from **both** the equity and index series.

> **Outputs that changed: 0.**

An earlier version of this test sampled symbols and sessions at random and landed
on **one decision in 360 pairs** — Gate 2 validity is ~0.35% of evaluations, so a
random sample proves nothing. It was replaced with the real population.

---

## Risks and reviewer findings

Independent review: Gemini 3.1 Pro, 15 vectors. It could not refute the
look-ahead result. Of the rest:

| # | finding | resolution |
|---|---|---|
| **14** | stopFirst is a mechanical artifact of tighter stops — *"destroys the sole piece of evidence"* | **Refuted by measurement**, and the tests were run before the review landed: the gap survives within matched stop-distance bands, mean T+5 excludes zero, and normalised excursion shows the mechanism |
| **15** | reordering the migration is HARKing | **Upheld in part, and it changed the verdict.** Examining the feasibility population was preregistered; *concluding a migration reorder from it* was not. The verdict is therefore NO-GO, and the feasibility result is carried forward as a hypothesis needing its own preregistration |
| **13** | the verdict must be an unqualified NO-GO | **Adopted.** The draft said GO WITH CONDITIONS; that overstated it |
| **8** | concentration masquerading as breadth | **Adopted in substance** — reported as broad by count, concentrated by value, with both numbers |
| **5/12** | hand-picked anchor, n=1, worthless | **Adopted for discrimination**, refined for the funnel: the anchor cannot compare V1 to the shadow, but the 74-symbol rejection histogram is not n=1 |
| **9** | synthetic reference prices corrupt entries | **Refuted by measurement**: 0 of 763 T+1 opens fall outside their bar range; 0 have zero volume |
| **1** | survivorship | **Upheld as a standing limitation.** 16 of 355 symbols stop before 2026. It inflates absolute win rates. It biases the *difference* far less: the two populations draw on overlapping symbols (68 of 73 h→v symbols also appear in the control) |
| **11** | regime cells too small | **Adopted** — stated in the table above |
| **4** | retroactive vendor adjustment | **Upheld, unresolved.** Prices are back-adjusted while volume is raw, so traded value mixes bases. The phase-12 caveat, restated |
| **2** | active-flag drift 242 → 281 | **Refuted**: neither the rebuild nor the universe resolver reads the `active` flag; membership comes from bar evidence at T |
| **6** | 13% limit-band error rate | **Adopted** — the limit-up statistic is marked indicative, with both measurements reported |
| **7** | suspended names in the breadth denominator | **Refuted**: 0 of 217 had zero volume; both denominators are reported anyway |
| **10** | accidental threshold tuning | **Refuted for this phase** — 1.5, the 7/10/15 bands and the 80% validation gate are all inherited or fixed in the committed plan. Inherited thresholds may still be optimistic |

**Capacity remains `UNEVALUABLE`** for all 764 records. No synthetic equity, risk
fraction or portfolio state entered any conclusion.

---

## Decision

**`M2 NO-GO`.**

The evidence does not support making D1 visibility stop reading `quality`. The
setups that change would be worse than the ones V1 already shows, and the anchor
that motivated this phase turned out to be a session on which the scanner produced
a single candidate that both architectures agreed on.

## Next action — the smallest justified step

**Preregister and run a feasibility-only gate.** Not M2, and not an
implementation:

> Does separating trade feasibility from setup validity — `NOT_FEASIBLE_NOISE`
> only, leaving visibility untouched — improve outcomes on a population and an
> interval fixed before the test?

It is the smallest step because it changes one decision, it already has a
directional result to test rather than to discover, and its failure mode is
bounded: at worst the scanner keeps surfacing setups whose stop sits inside a
day's range, which is what it does today.

Three things must be in that preregistration, and none of them may move
afterwards: the population and control, the effect size that would justify the
change, and the fact that **this phase's +1.19% and +16.45pp are the numbers being
tested — not evidence for the thing they would test.**
