# Research closure record — the offline branch is closed

**Date:** 2026-08-24 · Closure baseline `6d52485`

## Status: `RESEARCH CLOSED — PROSPECTIVE VALIDATION ONLY`

**After this commit, no further historical analysis may be used to modify, rescue
or re-scope the feasibility hypothesis or the M2 visibility hypothesis.** Both are
settled on the historical record. Only observations whose decisions were recorded
*before their outcomes existed* may serve as confirmatory evidence from here.

---

## What was established

### M1 — the shadow decision pipeline · `2c9b418`

Six decisions (D0–D5) run as independent, separately-typed functions with
compile-time forbidden-read enforcement, verified by deliberately breaking it
(`TS2322` at `contracts.ts:191`). `quality` appears in no D0–D5 contract.

| | |
|---|---|
| decisions computed | 574/574, later **764/764** on the rebuilt population |
| shadow exceptions · UNEXPECTED divergences | **0 · 0** |
| production call sites | **zero** — verified by import grep |
| verdict | `M1 SHADOW PIPELINE READY` — **offline scope**, accepted after review |

Known limit, recorded then and still true: **the pipeline has never executed in
production.** It is an offline reconciliation, not a live shadow.

### M2 — visibility · `45b0559` · **`M2 NO-GO`**

The plan at `0d606bf` froze the failure condition before any number existed: *if
`hidden → visible` setups perform no better than the agreement control, the
decomposition produces more signals rather than better ones.* It fired.

| population | n | mean T+5 | stop-first | win@T+5 |
|---|---|---|---|---|
| hidden → visible | 198 | **−0.13%** | 56.57% | 48.48% |
| control, both SHOWN | 406 | **+0.80%** | 49.51% | 50.25% |

Quarter-clustered, 47 quarters: mean T+5 **−0.93% [−1.84, +0.05]**, win rate
−1.76% [−11.86, +8.80], stop-first +7.06% [−3.96, +17.12]. **Nothing significant,
every point estimate against the change**, and the same direction in all three
breadth regimes (strong 40.00% vs 42.86%; ordinary 45.21% vs 50.94%; weak 34.21%
vs 70.37%).

The 2026-08-21 anchor was a **null experiment**: universe 234, tradable 74, Gate 2
valid **1** — on which V1 and the shadow agreed. 74.4% of tradable symbols were
rejected on the trend prerequisite.

### Feasibility confirmation · `6d52485` · **`FEASIBILITY NO-GO`**

Preregistered at `f280694` before any outcome of that gate was computed.

| | |
|---|---|
| eligible | 742 (604 `FEASIBLE` / 138 `NOT_FEASIBLE_NOISE`) |
| primary: mean T+5 delta | **+1.19%** |
| 95% quarter-clustered CI | **[+0.13%, +2.21%]** |
| frozen criteria | **C1 ✓ C2 ✓ C3 ✓ C4 ✓ — all passed** |

**And the verdict was NO-GO anyway.** The preregistration's first paragraph
disclosed that this dataset cannot establish reproducibility, and pre-defined a
pass as the narrow claim *"not an artefact of one year, one symbol, one regime or
one stop-distance band"* with an explicit instruction that no sentence may imply
the effect is real out-of-sample.

Even the narrow claim came out weaker than the headline:

- **absent before 2022** — +0.13% with CI [−1.18, +1.42]
- **negative outside ordinary breadth** — strong −1.54%, weak +0.48%, combined **−0.53%**
- **negative in 3 of 12 years** — 2017, 2018, 2021
- **≈nil in the densest stop band** — 3–5% shows **+0.17%** on 286 of 604 feasible setups
- **reverses near the MA50** — monotone from **−1.01%** (closest quartile) to **+2.81%** (furthest), on similar median distances in both arms, so an interaction rather than composition
- **lower bound below cost** — CI floor 0.13% against the repo's own `ROUND_TRIP_FEE_FRAC` of **0.40%**

## Confidence intervals, collected

| quantity | estimate | 95% CI |
|---|---|---|
| M2: hidden→visible − control, mean T+5 | −0.93% | [−1.84, +0.05] |
| M2: hidden→visible − control, win rate | −1.76% | [−11.86, +8.80] |
| feasibility: `FEASIBLE` − `NOISE`, mean T+5 | **+1.19%** | **[+0.13, +2.21]** |
| feasibility: same, era old | +0.13% | [−1.18, +1.42] |
| feasibility: same, era new | +1.88% | [+0.54, +3.01] |
| feasibility: stop-first | −14.85% | [−22.79, −5.61] |
| feasibility: MAE | +2.63% | [+1.12, +4.04] |

## Known limitations, carried forward unresolved

1. **No out-of-sample data exists.** Phase 12: pre-2015 is 72% concentrated in
   2009–2010 with 158 projected setups; a forward holdout needs ~10 years.
2. **In-sample inference.** The feasibility hypothesis was drawn from the same 742
   setups used to test it. Its interval is optimistic by construction.
3. **Survivorship.** Only 3 of 355 symbols are absent from today's listing; 16 stop
   before 2026. Absolute rates are inflated; differences less so.
4. **Adjustment basis.** Prices are back-adjusted, volume is raw, so traded value
   mixes bases and the error grows with age.
5. **Multiple comparisons** across seventeen phases of exploration.
6. **D4 capacity is unevaluable** — `portfolioOpenRiskVnd` does not exist in
   production at all.
7. **6,844 rows** have `open`/`close` outside `[low,high]` — pre-existing
   2018–2021, zero in the last 90 days, and they satisfy the importer's contract.

## Commit index

| phase | SHA |
|---|---|
| S1 preregistration / result | `ef870aa` / `cf3172d` |
| quality-label preregistration / result | `2c97ca6` / `aaea35e` |
| decision-coupling decomposition | `c950595` |
| M1 plan / implementation | `bc18d0c` / **`2c9b418`** |
| post-backfill plan / rebuild / verdict | `0d606bf` / `abf0e7c` / **`45b0559`** |
| feasibility preregistration / result | `f280694` / **`6d52485`** |

## Production is unchanged

```
git diff --stat 2c9b418 -- src/ ':!*test*'   →  empty
```

Across every phase since the shadow pipeline landed, **no non-test production
source file has been modified.** No scanner behaviour, no visibility rule, no
threshold, no sizing, no dependency.

---

## What closure means

| | |
|---|---|
| the historical feasibility hypothesis | **CLOSED** — may not be re-tested on history |
| the M2 visibility hypothesis | **CLOSED** — refuted on the frozen criterion |
| further historical slicing to rescue either | **prohibited** |
| the only admissible future evidence | observations recorded **before** their outcomes existed |

The next phase builds the mechanism for that, and nothing else. It makes **no
claim** about whether feasibility has predictive value — it exists to give the
hypothesis a fair chance to be **proven wrong**.
