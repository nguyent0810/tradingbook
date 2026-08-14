# S1 — the discarded-candidate edge test

**Date:** 2026-08-14 · Executes
[`S1-DISCARDED-CANDIDATE-PREREGISTRATION.md`](S1-DISCARDED-CANDIDATE-PREREGISTRATION.md),
committed at `ef870aa` **before any outcome was split by population**
**Basis:** 574 resolved setups · 380 RETAINED / 194 DISCARDED · 47 / 44 quarters

---

> **VERDICT CHANGED after independent review — see Part II.** The final verdict is
> `UNDERPOWERED`. The section below is retained as written for the record, and the
> reasoning that replaced it is set out in Part II. **The decision is unchanged:
> S2 is not built.**

## Verdict (superseded): `ABANDON V2 EARLY-SURFACING HYPOTHESIS`

The setups V1 throws away are **not better than the ones it keeps**.

| | n | P(continuation) | 95% CI |
|---|---|---|---|
| **RETAINED** — what V1 surfaces | 380 | **34.21%** | [29.22%, 39.48%] |
| **DISCARDED** — what V1 drops | 194 | **33.51%** | [25.77%, 41.83%] |
| difference | | **−0.71pp** | permutation p = **0.9239** |

The frozen rule fires on the second `ABANDON` clause: *the DISCARDED point
estimate is below the RETAINED point estimate, pooled.* It fires by 0.71pp, at
p = 0.92 — which the review correctly identified as a rule that licenses an
inferential label from noise.

---

## Why `PROCEED` fails — this part is not superseded

| `PROCEED` condition | required | observed | |
|---|---|---|---|
| 95% CI lower bound ≥ 33.3% | ≥ 33.33% | **25.77%** | ✗ |
| DISCARDED point ≥ RETAINED point | ≥ 34.21% | **33.51%** | ✗ |
| new-era DISCARDED ≥ new-era RETAINED | ≥ 29.15% | **23.33%** | ✗ |
| no quarter > 20% of DISCARDED continuations | ≤ 20% | 9.2% (2020Q4) | ✓ |

**Three of four fail.** `PROCEED` is unavailable under any reading of the data,
which is what determines whether S2 gets built.

## §7 The era breakdown — descriptive

| population | era | n | P(continuation) | 95% CI |
|---|---|---|---|---|
| RETAINED | old | 181 | 39.78% | [32.22%, 48.80%] |
| RETAINED | new | 199 | **29.15%** | [22.33%, 34.98%] |
| DISCARDED | old | 104 | 42.31% | [30.53%, 55.36%] |
| **DISCARDED** | **new** | 90 | **23.33%** | **[15.00%, 31.31%]** |

Two things here, and the preregistration anticipated both:

- **DISCARDED decayed harder** — −19.0pp against RETAINED's −10.6pp. In the old
  era it was the better population (+2.5pp); in the new era it is the worse one
  (−5.8pp).
- **The new-era DISCARDED interval's upper bound, 31.31%, sits below the 33.3%
  economic reference.** Even read optimistically, that population cannot pay at
  the frozen 2:1 structure.

§7 froze era breakdowns as descriptive, so this cannot drive the verdict. The
preregistration said: *"if discarded is only good in the old era but bad in the
new, that is evidence against V2."* It is only good in the old era.

> **This upper bound does not survive the robustness check.** Under a moving-block
> bootstrap that spans quarter boundaries, the 95% upper bound is 32.35% — still
> below the reference — but at 97.5%, the level needed to absorb the measured
> under-coverage, it is **33.77%** and reaches the reference. The finding is
> suggestive and **not robust**, so it is reported as suggestive. See Part II R2.

## The like-for-like comparison, holding market state fixed

The population contrast is partly a market-state contrast **by construction** —
`PASS` surfaces both tiers, so DISCARDED contains no `PASS` setups at all:

| | PASS | WARNING | FAIL |
|---|---|---|---|
| RETAINED | 149 | 231 | 0 |
| DISCARDED | 0 | 153 | 41 |

Inside `WARNING`, where V1 keeps tier A and drops tier B, market state is held
fixed and the comparison is clean:

| era | WARNING × A (kept) | WARNING × B (dropped) | difference |
|---|---|---|---|
| all | 37.23% (n=231) | 36.60% (n=153) | **−0.63pp** |
| old | 44.25% (n=113) | 45.35% (n=86) | +1.10pp |
| new | 30.51% (n=118) | 25.37% (n=67) | **−5.14pp** |

**The tier label V1 uses to decide who is visible in a mixed market separates
nothing** — 0.63pp over eleven years. Whatever else is true, the A/B distinction
is not carrying the decision it is being asked to carry.

---

## §6 Calibration — run before any result was interpreted

| control | result | target |
|---|---|---|
| NC1 cluster-bootstrap CI coverage, synthetic clustered null (beta-binomial, ICC 0.0609, 2,000 runs) | **93.4%** | 95% |
| NC2 stratified-permutation empirical FPR at nominal 5% (400 runs) | **3.5%** | 5% |

Calibration **PASS** under the frozen gate. But NC1's shortfall is real and worth
stating: with 2,000 runs the standard error on coverage is 0.49pp, so 93.4% sits
about 3 SE below target. **The bootstrap intervals are slightly too narrow.**

Direction matters more than magnitude: too-narrow intervals make H1 *more* likely
to appear resolved, not less. The true interval around 33.51% is a little wider
than [25.77%, 41.83%], which only strengthens "H1 resolves nothing".

NC2's 3.5% carries its own imprecision — SE 1.09pp on 400 runs — so it is
consistent with nominal 5% and not evidence of a conservative test.

## §9 Duplication and clustering

| | setups | symbols | dates | months | quarters |
|---|---|---|---|---|---|
| ALL resolved | 574 | 112 | 472 | 119 | 47 |
| RETAINED | 380 | 102 | 331 | 108 | 47 |
| DISCARDED | 194 | 82 | 177 | 89 | 44 |

Max setups on one date: 8. Dates carrying more than one setup: 82 of 472. Setups
per quarter: min 2, median 11, max 31.

**574 setups are not 574 observations.** Every interval here is quarter-clustered,
and symbol is not used as a cluster level because its ICC was measured at exactly
0 in phase 13.

**Residual overlap, measured and not waved away:** the outcome horizon is 20
sessions and a quarter is ~62, so most overlap is absorbed within a cluster — but
**200 of 574 setups (34.8%) have a forward window crossing a quarter boundary**.
That residual cross-cluster dependence makes the true standard errors *larger*
than reported, which again cuts against resolution, not toward it.

## §10 Look-ahead

Population assignment reads `gate1` and `quality`, both computed at T from the
decision channel. Outcomes are read only from bars after T. The source dataset
reported **0 guard violations** and S1 adds no new data access.

**Reconciliation is exact at every stage:**

```
raw Gate-2-valid 765 = RETAINED 501 + DISCARDED 264
resolved      574 = RETAINED 380 + DISCARDED 194
```

**Internal consistency check.** Recombining the two populations reproduces the
figures published by phases 9–12 exactly: old 116/285 = **40.7%**, new 79/289 =
**27.3%**. The split is a decomposition of a known aggregate, and it decomposes it
without residue.

## §8 Why each setup was discarded — descriptive only

| discard reason | n | P(continuation) |
|---|---|---|
| `WARNING × B` | 153 | 36.60% |
| `FAIL × A` | 25 | **16.00%** |
| `FAIL × B` | 16 | 31.25% |

| retained composition | n | P(continuation) |
|---|---|---|
| `PASS × A` | 82 | **24.39%** |
| `PASS × B` | 67 | 35.82% |
| `WARNING × A` | 231 | 37.23% |

`FAIL × A` at 16% is the worst cell in the study — when the index is falling and
falling, a strong-looking setup is the least likely to continue. Gate 1's `FAIL`
branch is the one part of the market gate these numbers support.

And `PASS × A` at 24.39% is the **worst retained cell**. The configuration V1
treats as its strongest — best market signal, best tier — continues least often of
anything it surfaces. That is the Gate 1 audit's PASS-worse-than-WARNING finding
reappearing on a different outcome measure, in a phase that was not looking for it.

Both are descriptive. No subgroup claim is made and none may be built from them.

## Secondary metrics — descriptive

| | med MFE/ATR | med MAE/ATR | med fwd-20 | med sessions to resolve |
|---|---|---|---|---|
| RETAINED | 2.41 | −2.09 | **+0.39%** | 2 |
| DISCARDED | 1.86 | −2.31 | **−1.32%** | 2 |

DISCARDED runs less far up, further down, and its median 20-session return is
negative. Consistent with the primary, and carrying no significance claim.

Restricting to setups whose stop was executable removes the small feasibility
difference between the populations (82.6% vs 76.3%) and changes nothing:
**RETAINED 34.39% (n=314) vs DISCARDED 34.46% (n=148)**.

---

## Deviation from the preregistration

One, recorded as the preregistration requires.

**H1's estimator.** The document said "one-sided, quarter-cluster permutation".
Permutation is a two-group procedure and does not apply to a one-sample
comparison against a fixed external reference, so H1 was estimated with a
**cluster bootstrap over quarters** instead, calibrated by NC1 before use. H2 kept
the preregistered permutation. The point estimate and the decision rule are
unaffected; only the interval's construction changed.

---

---

# Part II — Independent review, and a changed verdict

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 15 attack vectors. **Eight it
could not refute**: population leakage, Gate 2 reimplementation drift,
retained/discarded misclassification, outcome leakage, pseudo-replication,
survivorship (symmetric across both populations by construction), multiple
comparisons (the `PROCEED` conditions are an AND, which lowers the false-positive
rate rather than inflating it), and subgroup fishing.

**Its CRITICAL finding on the verdict is correct and the verdict changes.**

## Upheld — `ABANDON` was not a defensible label

> *"Triggering a definitive negative verdict based on a noise-dominated point
> estimate from a statistically powerless test is mathematically invalid. It
> conflates the failure to prove superiority with proof of inferiority."*

That is right, and it identifies a **design error in my own preregistration**, not
in the execution. The second `ABANDON` clause — *DISCARDED point estimate below
RETAINED point estimate* — was frozen in advance with a stated justification, and
freezing it in advance does not make it a good rule. It fired on **−0.71pp at
p = 0.9239**, from a comparison the same document had already declared underpowered
by a factor of two. A rule that converts a coin-flip into the word "abandon"
should not have been written.

**The formal verdict changes to `UNDERPOWERED`.**

## And the corroboration I offered does not survive either

The first draft argued the verdict was over-determined because the new-era
DISCARDED interval's upper bound, 31.31%, sat below the 33.3% reference. The
review's finding 3 (quarter boundaries fracture the dependency structure — 34.8%
of forward windows cross one) prompted a moving-block bootstrap with 30-session
blocks, longer than the 20-session outcome horizon. **R2:**

| interval level | new-era DISCARDED upper bound | vs 33.33% reference |
|---|---|---|
| 95.0% | 32.35% | still below |
| **97.5%** | **33.77%** | **reaches it** |
| 99.0% | 35.62% | reaches it |

95% is not the right level here, because NC1 measured the percentile bootstrap
under-covering at 93.4%. Widening to absorb that pushes the bound past the
reference. **The new-era finding is suggestive and not robust**, and the draft
overstated it. It is downgraded in §7 above.

So both the trigger and its corroboration fail, and `UNDERPOWERED` is not a
concession — it is the accurate description.

## Refuted by measurement — the clustering objection changes nothing

Finding 3 was rated HIGH. The moving-block bootstrap it asked for gives:

| cell | quarter-clustered 95% CI | block-bootstrap 95% CI |
|---|---|---|
| RETAINED all | [29.22%, 39.48%] | [29.32%, 41.75%] |
| DISCARDED all | [25.77%, 41.83%] | [25.56%, 42.16%] |
| DISCARDED new | [15.00%, 31.31%] | [15.73%, 32.35%] |

Materially identical. The review said this would not change the verdict and it
does not — but it is now measured rather than asserted, and R2 above shows the
exercise was still worth running, because it is what broke the corroboration.

## Adopted — the stratified contrast should have been primary

Finding 2, CRITICAL: the pooled comparison is structurally confounded, because
`PASS` surfaces both tiers, so RETAINED holds 149 `PASS` and 0 `FAIL` setups while
DISCARDED holds 0 and 41. The review is right that the correct design stratifies
on market state, and right that the like-for-like addendum is that design.

With block-bootstrap intervals, inside `WARNING` only:

| era | A (kept) | B (dropped) | difference |
|---|---|---|---|
| all | 37.23% [32.20, 46.93] | 36.60% [26.47, 47.13] | **−0.63pp** |
| old | 44.25% [39.86, 54.46] | 45.35% [31.91, 60.00] | +1.10pp |
| new | 30.51% [21.90, 42.28] | 25.37% [17.81, 38.71] | −5.14pp |

Nothing separates them. The stratified analysis gives no `PROCEED` signal either,
so the decision is unchanged — but the preregistration should have made this the
primary comparison and did not.

## Adopted — the economic floor was too lenient

Finding 4: 33.3% is the **zero-cost** break-even. Fees, slippage and gap risk push
the true floor higher, so a rule keyed to 33.3% is generous to the proposal.

That cuts one way only. **RETAINED sits at 34.21% and DISCARDED at 33.51%** — both
within one point of a floor that is itself understated. Neither population clears
a realistic economic threshold, whatever their difference.

## Not adopted — nothing

Every finding above is accepted. The two the review rated LOW and MEDIUM
(bootstrap under-coverage, economic floor) were already stated in the draft and
are strengthened rather than contested.

---

## Verdict after review: `UNDERPOWERED`

Under the frozen §12 rules, with the invalid `ABANDON` clause set aside: inference
is valid, calibration passed, reconciliation is exact, and **neither the abandon
nor the proceed conditions are met**. That is the definition of `UNDERPOWERED`.

**The decision is not underpowered.** `PROCEED` requires four conditions and fails
three of them; §16 builds S2 only on `PROCEED`. So:

> **S2 is not designed. The V2 early-surfacing branch stops here.**

## §16 — how much more information would resolve it

Two different questions, two different answers, and the difference matters.

**The pooled question can never be resolved, and does not need to be.** DISCARDED
sits at 33.51% and RETAINED at 34.21% — both *on* the zero-cost break-even. More
data would eventually establish which side of 33.3% each sits, and the answer
would have no decision content, because a rate at the zero-cost break-even is a
loss once costs are counted (review finding 4).

**The new-era question is close to resolved.** At the observed 23.33% against the
33.3% reference — a 10pp effect — a one-sided test at 80% power needs SE ≤ 4.02pp
against the 4.27pp measured. That is n ≈ 102 against the 90 in hand:

> **roughly 12 more new-era DISCARDED setups.** At the observed accrual of about
> 20 per year, **about seven months** of additional data.

That is the honest §16 answer, and it is smaller than anyone would guess. It is
also **not a reason to wait**: the question it would resolve is whether a
population already indistinguishable from the one V1 keeps is *definitively* below
a floor that both populations are already sitting on.

## What this leaves

The V2 early-surfacing branch stops here, for a specific reason worth stating
precisely, because it is not the reason anyone expected:

> V1's market gate is not hiding a better population. It is hiding **a population
> nobody can distinguish from the one it keeps** — 33.51% against 34.21%, p = 0.92,
> and 36.60% against 37.23% when market state is held fixed. Surfacing it earlier
> would surface more of the same, and the same is not viable: both populations sit
> on a zero-cost break-even that costs push above them.

The phase-13 architecture's own §14.1 wrote the consequence before the test ran:
*"If the discarded population is no better, every later stage is irrelevant,
because the ladder can only redistribute capital across a population that does not
pay."* That is now measured rather than assumed.

## `NEW HYPOTHESIS — NOT TESTED`

Recorded and stopped, per §8 and §13:

- **The A/B tier label separates nothing inside `WARNING`** (37.23% vs 36.60%,
  −0.63pp over 11 years) while it simultaneously drives both surfacing and the
  position-sizing risk multiplier. Whether the tier label carries any information
  at all is untested here.
- **`PASS × A` is the worst retained cell** (24.39%) and `FAIL × A` the worst cell
  overall (16.00%). Whether Gate 1's two branches should be split — `FAIL`
  supported, `PASS` inverted — is untested here.

Neither may be tested on this dataset without a new preregistration, and phase 12
established that the dataset cannot support much more.
