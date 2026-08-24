# The `NOT_FEASIBLE_NOISE` feasibility gate — result

**Date:** 2026-08-24 · Executes
[`FEASIBILITY-GATE-PREREGISTRATION.md`](FEASIBILITY-GATE-PREREGISTRATION.md),
committed at **`f280694`** before any outcome of this gate was computed
**Baseline:** `45b0559` · **CI:** 1264/1264 · **`src/` production diff: test file only**

---

## Verdict: `FEASIBILITY NO-GO`

**The four frozen criteria all passed.** C1 ✓ C2 ✓ C3 ✓ C4 ✓.

**And the gate still returns NO-GO**, because the question it was built to answer
is whether the effect has *reproducible* predictive value — and the
preregistration's own first paragraph states that this dataset cannot establish
reproducibility. A pass was pre-defined there as the narrow claim *"not an
artefact of one year, one symbol, one regime or one stop-distance band"*, with the
explicit instruction that **no sentence may imply the effect is real
out-of-sample.** Returning GO would be exactly that implication.

Three things then damage even the narrow claim, all measured below: the effect is
**absent before 2022**, it is **negative in non-ordinary breadth regimes**, and its
interval's lower bound **does not cover the round-trip cost the repo itself
assumes**.

This is **not** `DATA NO-GO`. Data integrity passed every check.

---

## Dataset and integrity (§8)

| | |
|---|---|
| snapshot | rebuilt population at `abf0e7c`, recomputed from raw bars |
| settled session, both series | **2026-08-21** |
| duplicate `(symbol,date)` · index duplicates · future-dated | **0 · 0 · 0** |
| importer usability-rule violations | **0** |
| equity sessions with no index bar | **0** |
| stricter check: `open`/`close` outside `[low,high]` | 6,844 — pre-existing 2018–2021, **0 in the last 90 days** |
| **outcomes recomputed from raw vs stored** | **0 of 742 differ** — exact reproduction |
| **look-ahead poison test** | **764/764 decisions, 0 outputs changed** |

## Population

| | n |
|---|---|
| **eligible** | **742** |
| `FEASIBLE` | 604 |
| `NOT_FEASIBLE_NOISE` | 138 |
| excluded — `NOT_FEASIBLE_LIQUIDITY` (preregistered) | 21 |
| excluded — window < 5 sessions | 1 |
| quarters spanned | 47 |

---

## Primary endpoint

**Mean forward return at T+5, `FEASIBLE` − `NOT_FEASIBLE_NOISE`:**

| | |
|---|---|
| `FEASIBLE` | **+0.50%** |
| `NOT_FEASIBLE_NOISE` | **−0.69%** |
| **delta** | **+1.19%** |
| 95% quarter-clustered CI, 47 quarters | **[+0.13%, +2.21%]** |

**C1 PASS** (positive) · **C2 PASS** (CI above zero).

## Secondary endpoints — reported, barred from rescuing the primary

| endpoint | `FEASIBLE` | `NOISE` | delta | 95% CI | |
|---|---|---|---|---|---|
| T+1 return | −0.06% | +0.29% | −0.35% | [−0.97, +0.22] | includes zero |
| T+3 return | 0.00% | −0.01% | +0.01% | [−1.07, +1.06] | includes zero |
| MFE (20s) | 8.91% | 9.07% | −0.16% | [−1.77, +1.53] | includes zero |
| MAE (20s) | −6.59% | −9.22% | +2.63% | [+1.12, +4.04] | **excludes zero** |
| stop-first | 51.82% | 66.67% | −14.85% | [−22.79, −5.61] | **excludes zero** |
| T+5 win rate | 49.67% | 42.03% | +7.64% | [−1.57, +15.79] | includes zero |

MFE/MAE use a 20-session window against a T+5 primary — a real mismatch, noted,
and confined to secondaries.

---

## C3 — regime consistency

| cohort | nF | nN | delta | 95% CI | |
|---|---|---|---|---|---|
| era old (<2022) | 303 | 60 | **+0.13%** | **[−1.18, +1.42]** | MAJOR — but interval spans zero |
| era new (≥2022) | 301 | 78 | **+1.88%** | [+0.54, +3.01] | MAJOR |
| breadth ordinary | 232 | 52 | +2.64% | [+0.20, +5.03] | MAJOR |
| breadth strong | 64 | **14** | **−1.54%** | | below 30/arm, excluded by the frozen rule |
| breadth weak | 65 | **14** | +0.48% | | below 30/arm, excluded |

**C3 PASS** on the letter of the rule. It is worth stating plainly what that pass
rests on: **the pre-2022 era contributes +0.13% with an interval spanning zero.**
The effect is essentially confined to the post-2022 half.

### The review's proposed remedy, run

It argued the 30-per-arm rule conveniently excluded the one deeply negative
cohort, and proposed combining strong and weak into "non-ordinary" to clear n≥30:

| cohort | nF | nN | delta |
|---|---|---|---|
| strong | 64 | 14 | −1.54% |
| weak | 65 | 14 | +0.48% |
| **strong + weak** | 129 | **28** | **−0.53%** |

**The combination still does not reach 30 in the noise arm**, so the frozen rule
would exclude it either way — but the honest reading is that **the effect is
negative outside ordinary breadth**, and that is reported here rather than left
behind a threshold.

## C4 — concentration and leave-one-out

| dimension | largest contributor | delta after removal | share of effect |
|---|---|---|---|
| year | 2025 (n=88) | +0.96% | 19.5% |
| quarter | 2026Q1 (n=14) | +0.91% | 23.5% |
| symbol | GEX (n=12) | +1.04% | 12.2% |

No removal flips the sign; none exceeds 50%. **C4 PASS.** The noise arm spans
**77 distinct symbols** with the top 5 carrying 16.7%, so it is not
symbol-concentrated. **Sector remains untestable** — the schema has no sector
field, declared in advance.

**Outlier sensitivity** (the review's finding 10): mean delta +1.19%, **median
delta +0.40%**, 10% trimmed mean +0.99%. The noise arm's tails are wide
(min −27.45%, max +31.13%). The trimmed mean holds, but the mean/median gap shows
the headline number is partly tail-driven.

---

## §2 Mechanical-artefact separation

The primary is `fwd5`, which knows nothing about the stop. Matched stop-distance
bands:

| band | nF | nN | T+5 delta | stop-first F / N |
|---|---|---|---|---|
| riskFrac < 3% | 88 | 82 | **+1.65%** | 55.68% / 67.07% |
| 3–5% | 286 | 43 | **+0.17%** | 52.80% / 65.12% |
| 5–8% | 219 | 13 | +2.34% | 49.77% / 69.23% |
| > 8% | 11 | 0 | — | — |

The stop-first gap survives distance matching, so it is not purely mechanical.
**But the T+5 effect does not survive uniformly**: the densest band (3–5%,
nF=286) shows **+0.17%**, essentially nothing. The headline is carried by the
extremes.

### Is it just "avoid high-ATR stocks"?

`NOT_FEASIBLE_NOISE` fires when `riskFrac < 1.0 × ATR / entry`, so the exposure is
partly an ATR proxy by construction. Median ATR/price: `FEASIBLE` 2.67%,
`NOISE` 3.57%. Within ATR quintiles:

| quintile | nF | nN | delta |
|---|---|---|---|
| 1 (lowest ATR) | 142 | 6 | +0.09% (too few) |
| 2 | 135 | 13 | **−0.79%** |
| 3 | 124 | 25 | +1.11% |
| 4 | 113 | 35 | +0.52% |
| 5 (highest ATR) | 90 | 59 | +1.08% |

The effect persists inside the high-ATR strata where the noise arm actually lives,
so it is **not** merely an ATR restatement — the review reached the same
conclusion independently and could not refute this vector.

## §3 The sign flip the review called fatal

| distance from MA50 | nF | nN | delta |
|---|---|---|---|
| Q1 (closest) | 163 | 22 | **−1.01%** |
| Q2 | 153 | 33 | +0.24% |
| Q3 | 145 | 40 | +1.39% |
| Q4 (furthest) | 143 | 43 | **+2.81%** |

Monotone in distance, and **negative for setups sitting near their MA50** — with
similar median distances in both arms, so this is an interaction, not composition.

The review's framing is hard to dismiss: this is a breakout-**pullback** scanner,
and the feasibility edge disappears precisely where pullbacks resolve. It is
reported as a finding, not explained away.

## §4 Temporal

| | n | delta | 95% CI |
|---|---|---|---|
| earlier half (2015-01-22 → 2022-01-20) | 371 | +0.53% | [−0.92, +2.11] |
| later half (2022-02-10 → 2026-08-07) | 371 | +1.61% | [+0.03, +2.90] |

By year: 2015 +0.99 · 2016 +1.56 · **2017 −0.30** · **2018 −2.94** · 2019 +0.20 ·
2020 +1.48 · **2021 −0.46** · 2022 +1.09 · 2023 +1.77 · 2024 +1.32 · 2025 +2.86 ·
2026 +1.19. **Three of twelve years are negative.**

---

## §6 Visibility invariant — proved

Two automated tests, now in the suite:

1. Every combination of Gate 1 level × tier × **all four feasibility verdicts** is
   driven through the pipeline, asserting V1 visibility **never moves**.
2. V1 visibility is reproduced exactly by `(gate1Level, quality)` alone.

Both pass. **No setup can become shown or hidden because of this gate.**

## §7 Production invariant — proved

```
git diff --stat 45b0559 -- src/
 src/lib/decisions/decisions.test.ts | 42 +++++++++++++++++++++++++++++++++++++
 1 file changed, 42 insertions(+)
```

**Test-only.** No wiring, no flag, no D0–D5 behaviour change, no threshold change,
no dependency upgrade.

---

## §9 Independent review

Gemini 3.1 Pro, 15 vectors. It **could not refute** two: quarter clustering is
adequate for a 5-session outcome window, and the effect is **not** merely
"avoid high-ATR stocks" — it noted that high-ATR setups are unconditionally
*positive* (+1.24%) while the noise cohort is *negative* (−0.69%), so the filter
captures something distinct from volatility.

Its verdict was `DATA NO-GO`. **That token is rejected**: integrity passed every
check, outcomes reproduce exactly from raw, and 764/764 poison tests are clean.
The problem is inferential, not data.

| # | finding | resolution |
|---|---|---|
| 1 | in-sample CI on the hypothesis-generating dataset is invalid | **Upheld, and decisive.** The preregistration disclosed it in its first paragraph; a criterion disclaimed in advance cannot carry a GO |
| 2 | C3 passes vacuously on +0.13% with a CI spanning zero | **Upheld** — reported above rather than defended |
| 3 | the 30-per-arm rule excluded the negative cohort | **Partly upheld.** The rule was fixed before this cell's sign was known, and the proposed remedy still misses 30 — but the combined non-ordinary delta is **−0.53%** and is now in the report |
| 4 | sign flips near MA20/MA50 contradict the pullback thesis | **Upheld**, quantified at quartile resolution |
| 5 | the effect is concentrated at stop-distance extremes | **Upheld**: the densest 3–5% band shows +0.17% |
| 6 | +0.13pp lower bound is meaningless after costs | **Upheld.** The repo's own `ROUND_TRIP_FEE_FRAC` is **0.40%**; the lower bound is **0.13%** and does not cover it. The point estimate (1.19%) does |
| 7 | survivorship in a volatility-selected cohort | **Upheld as unquantifiable.** 16 of 355 symbols end before 2026; the universe is near-total survivors |
| 8 | multiple comparisons across seventeen phases | **Upheld** — one primary was frozen, but the hypothesis emerged from a large exploratory surface |
| 9 | backfill history revision | **Addressed**: outcomes recomputed from raw reproduce stored values exactly, 0 of 742 |
| 10 | small noise arm, outlier-driven mean | **Upheld and quantified**: median delta +0.40% vs mean +1.19% |
| 11 | MFE/MAE 20-session window vs T+5 primary | **Upheld**, secondary only |

---

## Why NO-GO when every criterion passed

Three statements, all true at once:

1. **The frozen criteria fired PASS.** C1–C4. That is recorded, not hidden.
2. **A pass was pre-defined narrowly** — "not an artefact of one year, one symbol,
   one regime or one stop-distance band" — and pre-declared insufficient to claim
   the effect is real out-of-sample.
3. **The gate's question was reproducibility.** In-sample re-analysis of a
   hypothesis drawn from the same 742 setups cannot establish it, and the interval
   that would have to carry the claim is the one the preregistration disclaimed.

Even the narrow claim is weaker than the headline: absent pre-2022, negative
outside ordinary breadth, negative in three of twelve years, ~nil in the densest
stop-distance band, reversed near the MA50, and with a lower bound below the
round-trip cost the codebase already assumes.

**Reporting GO here would require ignoring a limitation I wrote down before
looking.** The binary answer to *"does this provide reproducible predictive
value?"* is **no, not established**.

## §12 What follows

Stop.

No search for another decomposition. No threshold tuning. No mining of the
secondary endpoints for a replacement hypothesis. **Production is unchanged and
stays unchanged** — the diff proof above is the whole of what this phase touched.

The one thing that would change this answer is the one thing the project has never
had: **data the hypothesis was not drawn from.** Phase 12 established that no true
out-of-sample sample exists and that a forward holdout needs roughly a decade. That
constraint governs this result as it governed the last four.
