# Recovery episodes and progressive confirmation

**Date:** 2026-08-12 · Research only — no gate, threshold, stop, sizing or production path touched
**Basis:** 2,981 usable sessions → **43 structurally-defined recovery attempts**
**Data:** [`progressive/episodes.json`](progressive/episodes.json) · reuses [`recovery/internals.ndjson`](recovery/internals.ndjson) and [`leadership/observations.ndjson`](leadership/observations.ndjson)

---

> ### ⚠ The mandatory Codex adversarial review did NOT run
>
> The Codex CLI account hit its usage limit before the review could execute
> (quota resets 2026-08-18). §K of the brief requires that review before a final
> verdict, so **the verdict below is provisional**. In its place I ran the attack
> list myself — circularity, checkpoint-gating selection, effective test count —
> and the results are in §K. Self-review is not a substitute for an adversarial
> one, and one finding below (the circularity stratification) is exactly the kind
> of thing an independent reviewer should re-examine.

## Verdict: `LABEL-SENSITIVE` (provisional)

The evidence is the strongest this project has produced — and it depends on one
definitional choice in a way that disqualifies a stronger verdict.

**What holds.** Breadth progression separates recoveries that hold from ones that
fail **from T+2 onward**, and it survives every robustness test that killed the
previous phases:

| test | result |
|---|---|
| year-block bootstrap (resampling years, not episodes) | **8 of 8 key cells survive** |
| outcome-label variation (hold 5/10/15 × horizon 30/40/60) | survives |
| both eras same direction | yes |
| stratified on T0 strength (is it just a stronger start?) | survives |
| monotone across checkpoints | `dMa20`, `dMa50`, `dR20Median`, `leaderSurvival` |

**What also weakens it.** Breadth and the index price are not independent, and
stratifying on the index's own move from T0 to T+2 leaves the breadth signals
significant only where the index also moved more (§K.1). The point estimates stay
positive in both strata, but at 7–10 episodes per cell the question cannot be
settled here.

**What breaks it.** Requiring 8 sessions of stabilisation before an attempt may
begin — instead of 5 — collapses the T+2 signal to nothing:

| cell | stab=5 (baseline) | stab=8 |
|---|---|---|
| `dMa10` @ T+2 | **+8.45** [+2.0, +15.7] | **+0.22** [−10.0, +9.9] |
| `dMa20` @ T+2 | **+5.37** [+1.1, +9.8] | +0.13 [−6.9, +6.9] |
| `dNewHighRate` @ T+2 | **+0.93** [+0.3, +1.7] | +0.10 [−0.8, +1.0] |

This is not merely a power loss (43 episodes → 27); the point estimates go to
zero. There is a coherent mechanical reading — with a longer stabilisation
requirement, T0 lands later and the first-few-sessions expansion has already
happened before the clock starts — but that reading is a hypothesis, not a
finding. **The conclusion depends on where T0 is placed**, which is exactly the
`LABEL-SENSITIVE` case.

---

## 0. What was reused, what is new

| component | status | why |
|---|---|---|
| per-session internals: breadth MA10/20/50, adv/decl, 52w highs/lows, volume expansion, up-volume share, return dispersion | **reused** as artifact | already computed with the staleness guard and universe floor from the previous phase; recomputing would risk divergence |
| per-symbol leader flags, RS inflection, undercut-reclaim, survival inputs | **reused** as artifact | 147k observations already carry every field needed |
| `rollingMean`, `computeAtr`, `classifyMarketState`, PIT guard, repo constants (`GATE2_RANGE_DAYS`, `GATE2_BREAKOUT_RECENCY_BARS`, `FRESH_RECLAIM_SESSIONS`, `RS_LOOKBACK_20`) | **reused** as code | no new primitive was needed |
| **`recovery-episode.ts`** — the state machine | **new** | the old "contiguous RECOVERING run" definition produced a median 3-session episode; that is what made the last phase underpowered |
| **checkpoint gating + progression deltas** | **new** | the specific disciplines this phase exists to impose |

No index re-run was required: `indexClose` is already in the internals artifact,
and every state-machine transition is an ordinal relation to moving averages and
rolling lows derivable from it.

---

## A. The episode definition

```
DOWNTREND          below MA50, printing new 20-session lows, MA20 falling
   ↓               (all three — one alone is noise)
STABILIZING        5 sessions without a new low, still below MA50
   ↓
RECOVERY_ATTEMPT   reclaims MA10 with a higher low          ← T0
   ↓
CONFIRMED_RECOVERY holds MA50 for 10 sessions   |  FAILED_RECOVERY
                                                |  undercuts the decline's low
```

Every constant is an existing repo constant, used for that reason:
`GATE2_RANGE_DAYS` (20) defines a new low, `FRESH_RECLAIM_SESSIONS` (5) the
stabilisation window, `GATE2_BREAKOUT_RECENCY_BARS` (10) the hold. All
transitions are ordinal — no magnitude threshold exists to tune.

Once an attempt is registered the machine will not emit another until the regime
changes, so one decline cannot manufacture a dozen correlated episodes.

**Result: 43 episodes**, median decline of 10 sessions and **−11.0% drawdown**
before T0, median resolution at 15 sessions.

| era | episodes | confirmed | failed | unresolved |
|---|---|---|---|---|
| pre-2015 | 1 | 1 | 0 | 0 |
| 2015–2021 | 21 | 9 | 12 | 0 |
| 2022–2026 | 21 | 12 | 8 | 1 |

The class balance is roughly even, unlike the previous phase's 69/31 — a sign the
machine is catching genuine attempts rather than MA noise. Outcome labels are
also far more stable: across nine (hold, horizon) combinations the confirmed
share stays near half, where the old definition ranged 43%–90%.

---

## B/E. When does the information emerge?

A checkpoint is evaluated **only if the episode had not already resolved before
it**. An episode that failed at T+2 never appears in the T+5 sample.

| checkpoint | still alive | confirmed | failed | median failure lag among survivors |
|---|---|---|---|---|
| T0 | 42 | 22 | 20 | 6 |
| **T+2** | **39** | **22** | **17** | 6 |
| **T+3** | **36** | **22** | **14** | 8 |
| T+5 | 32 | 22 | 10 | 12 |
| T+10 | 26 | 20 | **6** | 20 |

**T+2 and T+3 are the usable checkpoints.** By T+10 the surviving failures are
only the slow ones (6 of 20), so that column compares confirmed recoveries with
*late* failures — a different question, and its results should not be read as
early evidence.

### Separation by checkpoint (pooled; confirmed − failed)

| feature | T0 | T+2 | T+3 | T+5 | T+10 |
|---|---|---|---|---|---|
| `dMa10` | 0 | **+8.45** ✓ | **+7.95** ✓ | +7.84 | **+11.96** ✓ |
| `dMa20` | 0 | **+5.37** ✓ | **+6.34** ✓ | +7.38 | **+16.64** ✓ |
| `dMa50` | 0 | +1.59 | +2.54 | +3.75 | **+8.63** ✓ |
| `dNewLowRate` | 0 | −1.50 | **−1.91** ✓ | −0.80 | −1.65 |
| `dNewHighRate` | 0 | **+0.93** ✓ | +0.57 | +0.44 | +1.56 |
| `dUpVolumeShare` | 0 | +7.95 | +6.82 | +15.10 | **+26.07** ✓ |
| `dVolumeExpanding` | 0 | +0.32 | +3.89 | −3.03 | +2.78 |
| `dLeaderCount` | 0 | +0.32 | +0.78 | −0.18 | +0.88 |
| `dR20Median` | 0 | +0.65 | +0.80 | **+1.85** ✓ | +1.85 |
| `leaderSurvival` | 0 | +11.22 | +22.15 | +24.56 | **+58.48** ✓ |
| `recoveryProgress` | **+1.53** ✓ | **+2.37** ✓ | **+2.55** ✓ | +2.41 | **+3.93** ✓ |
| `distToMa50` | +0.11 | +1.13 | +1.03 | +0.88 | **+2.83** ✓ |

✓ = 95% episode-bootstrap CI excludes zero. **17 of 60 cells**, against ~3
expected by chance — but the tests are heavily correlated (three breadth measures
of the same thing, nested checkpoints), so the effective count is far below 60.
The stronger argument is not the count; it is that the survivors clear the
year-block bootstrap.

### Robustness of the key cells

| cell | episode CI | **year-block CI** | hold5/hor30 | hold15/hor60 | **stab=8** |
|---|---|---|---|---|---|
| `dMa10` @T+2 | [+1.9, +15.5] ✓ | **[+3.6, +15.4]** ✓ | ✓ | ✓ | **✗ +0.22** |
| `dMa20` @T+2 | [+1.1, +9.8] ✓ | **[+1.5, +10.4]** ✓ | ✓ | ✓ | **✗ +0.13** |
| `dMa20` @T+3 | [+0.5, +11.8] ✓ | **[+1.1, +12.0]** ✓ | ✗ (+5.02) | ✓ | ✗ (+3.71) |
| `dNewHighRate` @T+2 | [+0.3, +1.7] ✓ | **[+0.3, +1.7]** ✓ | ✓ | ✓ | **✗ +0.10** |
| `dNewLowRate` @T+3 | [−3.9, −0.3] ✓ | **[−3.6, −0.4]** ✓ | ✗ (−1.40) | ✓ | ✗ (+1.18) |
| `recoveryProgress` @T+2 | [+0.5, +4.2] ✓ | **[+0.3, +4.2]** ✓ | ✓ | ✓ | ✗ (+1.74) |

### Is it just a stronger start?

`recoveryProgress` already separates at T0 (+1.53), so confirmed attempts begin
marginally further off the low. Stratifying on it:

| cell | T0 progress below median | T0 progress above median |
|---|---|---|
| `dMa10` @T+2 | **+11.23** [+7.1, +15.5] ✓ | +9.09 [−6.7, +25.7] |
| `dMa20` @T+2 | **+5.82** [+0.5, +11.6] ✓ | +5.80 [−2.1, +13.7] |
| `dNewHighRate` @T+2 | **+0.85** [+0.0, +1.8] ✓ | **+0.94** [+0.1, +1.9] ✓ |

Same sign in both strata and largest in the *weaker*-start half. The T+2 signal
is not a restatement of T0 strength.

---

## F. Risk-state research (not a rule)

The data is consistent with — **but does not establish** — a ladder of this shape:

| state | earliest supportable trigger | evidence |
|---|---|---|
| `WATCH` | T0: a recovery attempt exists | the state machine finds it point-in-time |
| `PROBE_ELIGIBLE` | T+2–T+3 with breadth expanding and new lows contracting | `dMa10 +8.45`, `dMa20 +5.37`, `dNewHighRate +0.93`, `dNewLowRate −1.91` |
| `CONFIRMING` | T+5–T+10, progression continuing | monotone in `dMa20`, `dMa50`, `dR20Median` |
| `NORMAL_RISK` | Gate 1 PASS | — |

**No threshold is proposed, and none should be taken from the numbers above.**
Turning any of these into a rule requires the stab-sensitivity to be resolved
first, and then a fresh out-of-sample test.

---

## G. What waiting for Gate 1 costs — and fails to buy

| | 2015–2021 | 2022–2026 |
|---|---|---|
| episodes reaching a Gate 1 PASS within 120 sessions | 21/21 | 20/21 |
| median sessions from T0 to first PASS | **17** | **10** |
| index already up by the time PASS fires | +1.51% | +1.78% |

And the part that matters most:

> **20 of the 42 episodes that reached a Gate 1 PASS were FAILED_RECOVERY.**

Waiting for Gate 1 does not protect against false dawns — it fired in roughly
half of the attempts that went on to undercut their low. Its cost is 10–17
sessions and ~1.5–1.8% of index move; its benefit as a false-dawn filter is not
visible here at all.

---

## H. Case study — nothing to show

Examined only after the universe-wide analysis, as required.

- **FRT: 0 observed sessions. `NOT EVALUABLE`.** It never enters the stored
  point-in-time universe.
- **FPT: 2,349 observed sessions, and 0 early-leader flags inside any of the 43
  episodes.** It is observable and simply never fired. The motivating example
  provides no support for the hypothesis; that is reported rather than worked
  around.

What the universe scan does show is the **interaction** the architecture assumes:

| leader flags at T0/T+2/T+3 | n | mean fwd20 | median | negative |
|---|---|---|---|---|
| inside a **confirmed** recovery | 163 | **+4.90%** | +3.16% | 34% |
| inside a **failed** recovery | 124 | **−6.40%** | −4.88% | 66% |

The same flag is worth +4.9% when the market recovery is real and −6.4% when it
is not — an 11.3pp swing driven entirely by market state. The worst false-dawn
names (API −52.4%, ANV −49.3%, CEO −46.7%, CMX −45.2%) are the same October 2022
cluster identified in the leadership study.

**This is conditional on knowing the outcome**, which nobody does at flag time.
It motivates the architecture; it does not validate it.

---

## K. Adversarial pass (self-administered — see the warning at the top)

### K.1 Circularity: is breadth just restating the index move?

`FAILED` means the index undercut its decline low, and breadth is mechanically
tied to index price. By T+2 the index has already moved differently between the
classes (+0.97% confirmed vs +0.03% failed), so the concern is real. Stratifying
on that move:

| cell @T+2 | index move below median | index move above median |
|---|---|---|
| `dMa10` | +6.41 [−1.5, +15.8] | **+7.79** [+0.3, +14.6] ✓ |
| `dMa20` | +2.46 [−2.0, +7.0] | **+6.44** [+0.9, +12.0] ✓ |
| `dNewHighRate` | +0.39 [−0.3, +1.1] | **+1.42** [+0.3, +2.7] ✓ |
| `dNewLowRate` | **−2.26** [−5.1, −0.2] ✓ | −0.24 [−1.7, +1.2] |

Signs hold in both strata, but significance for the breadth measures concentrates
where the index also rose — consistent with partial entanglement rather than
independent information. **`dNewLowRate` is the exception and behaves the
opposite way**: it separates precisely when the index has *not* moved much, which
makes it the least index-dependent measure in the set and the most interesting
one for further work.

At 7–10 episodes per stratum this cannot be resolved. It is a genuine weakening
of the "breadth adds information" claim, not a refutation of it.

### K.2 Does checkpoint gating bias T+2 the way it biases T+10?

| checkpoint | failures still in sample | dropped |
|---|---|---|
| T+2 | 17/20 | 15% |
| T+3 | 14/20 | 30% |
| T+5 | 10/20 | 50% |
| T+10 | **6/20** | **70%** |

T+2 and T+3 lose the fastest failures only — mild and disclosed. T+10 loses most
of the class and is not usable as early evidence, as already stated.

### K.3 Effective number of tests

"The tests are correlated" needs a number rather than a wave. The 12 features
fall into roughly **six independent families** — breadth (`dMa10/20/50`), new
highs/lows, volume (`dUpVolumeShare`, `dVolumeExpanding`), dispersion, leadership
(`dLeaderCount`, `leaderSurvival`), index structure (`recoveryProgress`,
`distToMa50`) — and the five checkpoints are nested, worth perhaps **2–3
independent looks**. That gives ~15 effective tests and ~0.75 expected false
positives. **17 observed significant cells is well above that**, which is the
strongest single argument that something real is present.

### K.4 Not tested here, and left for the adversarial review

- Whether `stab=5` is principled or a post-hoc justification. Using a repo
  constant removes *my* discretion at the moment of choosing, but the constant
  was written for a different purpose (fresh-reclaim recency), so reusing it is
  convenience as much as principle.
- Whether "20 of 42 Gate 1 PASS episodes were FAILED" compares compatible
  definitions — Gate 1 PASS is a market-regime label, FAILED is an episode
  outcome, and they answer different questions.
- Post-selection effects from five prior phases on the same dataset.

---

## I/J. Discipline and validation

| requirement | status |
|---|---|
| episode as the unit of analysis | yes — no stock is treated as an independent observation |
| checkpoint gating on unresolved episodes | yes — a T+2 failure never reaches the T+5 sample |
| point-in-time features | `feature(data, end)` reads only `[0..end]`; truncation tests at multiple T in `recovery-episode.test.ts` and `leadership-features.test.ts` |
| T0 detection free of look-ahead | tested: segmenting truncated series yields identical T0 indices |
| guard violations | 0 across every upstream run feeding this study |
| stale bars / suspended / pre-listing | excluded upstream — a symbol must have traded that session |
| era split | three buckets, pre-2015 isolated |
| block bootstrap | year blocks, reported alongside episode bootstrap |
| label sensitivity | 9 outcome combinations plus 3 initiation variants |
| multiplicity | 60 cells, 17 significant, disclosed and discounted |
| no checkpoint cherry-picking | all five reported; the earliest robust one is named, not the smallest-p one |

### Limits

- **43 episodes, 21 per era.** Per-era analysis is underpowered on its own; most
  2022–2026 cells at T+10 have 2 failures and are unusable.
- **T+10 is survivorship-contaminated** by construction (20 confirmed vs 6
  failed) and should not be read as early evidence.
- **The stab sensitivity is unresolved.** It is the single reason this is not a
  supporting verdict.
- **Timing convention.** Features are close-of-session; a tradable version acts at
  the next open. Everything here is optimistic by one overnight gap.
- **Survivorship.** 1,182 of 1,537 symbols have no stored bars; all breadth is
  breadth of the stored universe.

### What would settle it

1. **Run the Codex adversarial review** once quota resets. The verdict is
   provisional until then.
2. **Resolve the stabilisation sensitivity**: is the T+2 signal genuinely about
   the first sessions after a reclaim, or an artefact of where T0 is placed? Test
   by holding T0 fixed and varying only the *measurement* window, rather than
   varying both together as `stab` does.
3. **More episodes.** 43 is the binding constraint and only history or a wider
   stored universe raises it.
4. **Pre-register** the episode definition, the checkpoint, and the features
   together, then test on data not used here.
