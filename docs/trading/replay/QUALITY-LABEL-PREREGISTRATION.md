# Preregistration — does `quality: A | B` earn its dual role?

**Date:** 2026-08-14 · Phase 14.5 · Committed **before** any new inference on the
label. Not editable afterwards; deviations recorded as deviations.

**The question, and only this:**

> Does `quality` contain enough predictive information to justify simultaneously
> deciding **which candidates are visible** and **how much risk they may take**?

Not "what should quality be instead". §14 of the brief forbids that, and this
document forbids it too.

---

## Disclosure first — this phase is not blind, and does not claim to be

The S1 artifact, already committed at `cf3172d`, publishes the six-cell table this
phase analyses. The pooled A/B rates follow from it by arithmetic:

| | n | continuations | rate |
|---|---|---|---|
| **A** | 338 | 110 | **32.54%** |
| **B** | 236 | 85 | **36.02%** |

**B is 3.48pp above A**, which is the opposite of the direction the architecture
assumes. The per-cell numbers are also published: `PASS × A` 24.39% vs
`PASS × B` 35.82%; `WARNING × A` 37.23% vs `WARNING × B` 36.60%; `FAIL × A`
16.00% vs `FAIL × B` 31.25%.

**So the point estimates are known before this preregistration.** What does not
exist yet, and is what this document freezes: intervals, calibrated inference,
power, the economic-justification criterion, the component decomposition, the
era-stability check, and the verdict rules. A preregistration that claimed
blindness here would be a lie, and the honest version is still worth writing —
the decision rules must be fixed before the intervals are seen, and they are.

---

## §0 Source dependency map

`quality` is produced in exactly one place:
[`breakout-pullback.ts:398`](../../../src/lib/scanner/gate2/breakout-pullback.ts)

```
quality = (volRatio >= GATE2_VOL_RATIO_A) && (close >= ma20)   ->  "A"
        otherwise                                              ->  "B"
```

with `GATE2_VOL_RATIO_A = 1.5`, `volRatio = lastBar.volume / median(prior 20 bars,
evaluation bar excluded)`, and `ma20` the 20-session simple mean of closes at the
evaluation bar. Every input is at or before T.

**The brief says quality has two roles. The source says six.**

| # | consumer | effect | file |
|---|---|---|---|
| 1 | Gate 1 surfacing under `WARNING` | B is hidden entirely | [`collect-candidates.ts:32`](../../../src/lib/scanner/gate2/collect-candidates.ts) · `run-daily-scan-job.ts:310` · `replay-engine.ts:372` |
| 2 | position sizing risk multiplier | **A = 1.0, B = 0.5** | [`position-sizing.ts:33-35`](../../../src/lib/position-sizing.ts) |
| 3 | daily trading stance | `WARNING` + at least one A → `PROBE`; otherwise `NO_TRADE` | [`trading-decision.ts:51`](../../../src/lib/scanner/trading-decision.ts) |
| 4 | paper-lab manager entry gate | `minGate2Quality` hard-rejects | [`evaluate-manager.ts:90-93`](../../../src/lib/paper-lab/dna/evaluate-manager.ts) |
| 5 | paper-lab opportunity score | **largest single term, weight 0.35**; A=1, B=0.6 | [`rotation.ts:44`](../../../src/lib/paper-lab/dna/rotation.ts) |
| 6 | paper-lab confidence basis | `fGate2` A=1, B=0.6 | [`confidence.ts:34`](../../../src/lib/paper-lab/dna/confidence.ts) |

Display-only, not decisions: `displayScanQualityTier`, the setup-quality ladder,
dashboard panels.

**Not a consumer:** `rankScore`. It is computed independently in
[`rank-components.ts:74`](../../../src/lib/scanner/gate2/rank-components.ts) and
never reads `quality` — but both are built from `volRatio`, so they share a
primitive without sharing a definition.

```
volRatio ─┬─► quality A/B ─┬─► visibility under WARNING
          │                ├─► risk multiplier  (A=1.0, B=0.5)
          │                ├─► daily stance PROBE / NO_TRADE
          │                ├─► paper-lab entry gate
          │                ├─► opportunity score (0.35 weight)
          │                └─► confidence basis
          ├─► rankScore volumeTerm
          └─► confidence fVol
close vs MA20 ──► quality A/B (the other half)
```

`volRatio` therefore reaches a decision by **three** independent paths. That is a
finding about the architecture regardless of what the outcome test says.

**Point-in-time:** both components read only bars ≤ T, and Gate 2 refuses to
evaluate unless the last bar equals the expected session
(`breakout-pullback.ts:170-175`). Verified again in §15 below.

---

## §3 Populations — frozen

Primary population: all Gate-2-valid setups with a resolved outcome, the same 574
used by S1, with the same frozen dedup.

| id | comparison | n (A / B) | quarters (A / B) |
|---|---|---|---|
| **P1** | A vs B, all setups | 338 / 236 | 47 / 45 |
| **P2** | A vs B **within `WARNING`** | 231 / 153 | 46 / 42 |
| **P3** | A vs B within `PASS` | 82 / 67 | 32 / 28 |

`FAIL` (25 / 16) is **descriptive only** — too small to test.

**P2 is the architecturally decisive comparison**, because `WARNING` is the only
state where the label directly decides visibility.

**Reconciliation required:** A + B = 574 exactly, with no unexplained loss.

---

## §4 Outcome — frozen, inherited, not invented

Unchanged from the continuation study: entry at next session's open, first-passage
race to **+2.0 ATR** against **−1.0 ATR** over 20 sessions.
`CONTINUATION` / `FAILURE` / `AMBIGUOUS`; primary endpoint **P(continuation)**
among resolved setups.

Secondary, descriptive, no significance claim: failure rate, MFE/ATR, MAE/ATR,
forward-20 return, sessions to resolution.

**Raw R-multiple is not used** — stop-distance pathology, established earlier.

---

## §1 Hypotheses — frozen

| id | claim | test |
|---|---|---|
| **H1 discrimination** | `P(cont \| A) > P(cont \| B)` | P1, P2, P3; two-sided interval, direction read from the point estimate |
| **H2 ordering** | A's secondary outcomes are ordered consistently above B's | descriptive; no test |
| **H3 sizing direction** | the data support `risk(A) > risk(B)` | see §10 |

H3 does **not** ask whether 1.0 / 0.5 is optimal. It asks only whether the
*direction* is supported.

---

## §9 Inference — frozen

- statistic on **quarter** clusters; symbol is not a cluster level (ICC measured
  at exactly 0.0000 in phase 13)
- interval: **cluster bootstrap over quarters**, 20,000 replicates
- test: **stratified permutation of the label within quarter**, 20,000 replicates,
  which conditions on quarter so between-quarter variation cannot masquerade as a
  label effect
- **robustness**: moving-block bootstrap with 30-session blocks, longer than the
  20-session outcome horizon, because 34.8% of forward windows cross a quarter
  boundary (measured in S1)
- **negative controls run before any result is interpreted**: CI coverage on a
  synthetic clustered null at ICC 0.0609, and empirical FPR of the permutation
  test under randomised labels. Failure ⇒ `INFERENCE INVALID`, stop.

**Multiple testing:** three primary comparisons ⇒ Bonferroni **α = 0.0167**.

---

## §12 Power — computed before any interval was produced

| comparison | SE of difference | MDE₈₀ at α=.05 | MDE₈₀ at α=.0167 |
|---|---|---|---|
| **P1 all** | 4.57pp | 12.81pp | **14.79pp** |
| **P2 `WARNING`** | 5.37pp | 15.04pp | **17.38pp** |
| **P3 `PASS`** | 8.10pp | 22.70pp | **26.22pp** |

**P3 is declared underpowered in advance.** Its MDE of 22.70pp is twice the
already-published −11.4pp gap. It may not produce a verdict in either direction.

P1 and P2 can only detect very large differences. **This is the crux and it is
stated before the result:** if A and B differ by a few points, this study cannot
call that a real difference — but it *can* bound how large the difference could
plausibly be, and a bound is what the architecture question needs.

---

## §10 Economic criterion — frozen before the intervals

Statistical significance is not the question. The question is whether the label
does economic work.

**The frozen criterion:** the dual role is economically justified only if the two
labels sit on **opposite sides of the 33.3% break-even** of the frozen 2:1 race —
one fundable, one not — with an interval on the difference that excludes zero.

Rationale, fixed here: if both labels are on the same side of break-even, then
whatever separates them, it is not the thing deciding fund-or-don't-fund. A
label that splits 34% from 36% is splitting two losing populations after costs.

**Anti-post-hoc guard:** 33.3% is inherited from the frozen outcome definition and
was used identically in S1. No new threshold is introduced here, and none may be
chosen after the intervals are seen.

---

## §11 The coupling test — two verdicts, separately

| role | justified only if |
|---|---|
| **visibility** | within `WARNING` (P2), A's rate exceeds B's with an interval excluding zero at α=0.0167 |
| **sizing** | H3's direction holds — A ≥ B — and the economic criterion of §10 is met |

**These may disagree, and are reported separately.** A single blended verdict is
forbidden.

---

## §6 Component decomposition — protocol, with a drift gate

Only after the primary tests. Purely descriptive.

**The stored fields cannot do this safely.** `relVolume` in the setups file is a
near-reconstruction of Gate 2's `volRatio` but not an identical one: the study
computes its median with a different tie rule and over undeduplicated bars, and
**24 of 574 rows (4.2%) contradict the stored label** — `('A', relVolume<1.5)` 22
rows, `('B', relVolume≥1.5)` 2 rows. Using it as if it were `volRatio` is exactly
the definition drift §16 vector 3 warns about.

**Protocol, frozen:** the two components are re-derived using Gate 2's own
primitives — `sortDedupeGate2Bars`, its median convention, and `sma` from
`@/lib/playbook/indicators` — and the decomposition is **reported only if the
recomputed `(volRatio ≥ 1.5) && (close ≥ ma20)` reproduces the stored `quality`
label for 100% of setups.** Anything less and the decomposition is declared **not
identifiable** and omitted. That reproduction check *is* the drift test.

**Forbidden regardless of result:** new volume cutoffs, other moving averages,
optimising 1.5, any composite or score. A component that looks predictive is
written down as `NEW HYPOTHESIS — NOT TESTED` and left alone.

---

## §7 Era stability — descriptive

Report A and B continuation for 2015–2021 and 2022–2026 and the A−B gap in each.
A production label should at minimum not invert severely across eras. **No rule
may be built from this**, and it cannot drive the verdict.

---

## §15 Look-ahead and reconciliation

- `quality` reads only bars ≤ T. **Poison test:** re-evaluating with all bars
  after T replaced by corrupt values must leave every label unchanged.
- Required: **guard violations = 0**, and **A + B = 574** exactly.
- Either failing ⇒ `INFERENCE INVALID`.

---

## §13 Verdict matrix — frozen

Exactly one, from this list:

| verdict | condition |
|---|---|
| `QUALITY DUAL ROLE SUPPORTED` | visibility **and** sizing both justified |
| `QUALITY VISIBILITY ROLE NOT JUSTIFIED` | P2 gives no separation supporting A over B |
| `QUALITY SIZING ROLE NOT JUSTIFIED` | direction unsupported or economic criterion unmet |
| `QUALITY DUAL ROLE NOT JUSTIFIED` | both fail |
| `UNDERPOWERED` | intervals cannot resolve the architectural claim in either direction |
| `INFERENCE INVALID` | calibration, guard or reconciliation fails |

No `promising`, no `maybe useful`, no `could tune`.

**The distinction that decides `NOT JUSTIFIED` versus `UNDERPOWERED`**, fixed
here: `NOT JUSTIFIED` requires the interval on the difference to **exclude the
effect size the architecture needs** — not merely to include zero. A study that
cannot see anything reports `UNDERPOWERED`; a study that can rule out what the
architecture assumes reports `NOT JUSTIFIED`. The architecture assumes A is
sufficiently better than B to be worth double the risk **and** worth hiding B
entirely; the §10 criterion makes that concrete.

---

## §18 Hard stop

No production change. No V2 implementation. **No replacement label is designed,
proposed, or searched for**, whatever the result — that is a separate phase with
its own preregistration. If the dual role is not justified, the output states
precisely which coupling must be severed and stops there.
