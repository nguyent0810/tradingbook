# Freezing T0: isolating measurement-window sensitivity

**Date:** 2026-08-12 · Narrow verification — no new indicator, no production change, no tuning
**Basis:** the same 43 episodes as [`PROGRESSIVE-CONFIRMATION-STUDY.md`](PROGRESSIVE-CONFIRMATION-STUDY.md), with T0 held fixed
**Data:** `progressive/grid-h{3,5,8,10}-z{20,30,40}/episodes.json` · `progressive/shiftedT0-stab8/episodes.json`

> ### Independent review: **completed** (Gemini 3.1 Pro via `agy`, 2026-08-13)
>
> Codex remained over quota, so the adversarial review was run with a different
> tool and a different model family — deliberately not a Claude model, so it
> would not inherit my blind spots. **It refuted the verdict.** Its findings are
> in §10, the ones I verified are accepted, and the verdict below is downgraded
> accordingly. The original `ROBUST EARLY PROGRESSION SIGNAL` claim is withdrawn.

## Verdict: `NO INCREMENTAL BREADTH SIGNAL` (also `UNDERPOWERED`)

**The answer to the phase's question: no — not at a standard that survives
scrutiny.** Breadth progression at T+1/T+2 looked incremental under an
uncorrected test. It does not survive multiple-comparison correction, and the
control used to establish it is itself methodologically challenged.

The claim rested on two cells. Both die once the 49 tested cells are accounted
for — and not marginally:

| cell | uncorrected 95% | Bonferroni /49 | lenient /10 |
|---|---|---|---|
| `dMa10` @T+2 residual | +4.95 **[+0.34, +9.85]** ✓ | [−2.50, +13.02] | [−1.62, +12.00] |
| `dNewHighRate` @T+2 residual | +0.79 **[+0.13, +1.53]** ✓ | [−0.27, +2.09] | [−0.12, +1.86] |
| `dMa10` @T+1 residual | +3.33 **[+0.80, +5.88]** ✓ | [−1.07, +7.56] | [−0.24, +6.98] |

Even a generous correction for ten effective tests removes every one. I reported
the uncorrected intervals as the headline; that was the error.

### Three further criticisms I accept

**The residual control may not control what I claimed.** Breadth here is
**equal-weighted** across symbols; VN-Index is **capitalisation-weighted**.
Regressing breadth on the index return therefore does not isolate "information
the index lacks" — a large part of the residual is simply the equal-weight
versus cap-weight spread, which widens mechanically whenever smaller names bounce
harder than the index. This was not considered anywhere in the design and it
undercuts the interpretation directly.

**The residual test is a two-stage procedure with a known flaw.** The index
return from T0 to the checkpoint is plausibly a *mediator* of the outcome, not a
confounder. Residualising on a mediator and then testing group differences on the
residuals is not a clean control. Applying OLS to a variable bounded on [0, 100]
compounds it.

**The T+5 hole is not a curiosity.** A structural progression that vanishes at
T+5 and returns at T+8 — where the failure class is down to six episodes — is
better read as noise with two lucky checkpoints than as a progression.

### Where the review overreached

**On `stab=5 → 8` (§2).** The reviewer read the collapse as unequivocal proof of
overfitting. The isolation test shows *why* it collapses — the same 26 declines
with only T0 moved reproduce it — which identifies the mechanism but settles
nothing about interpretation. "A genuinely short-lived signal" and "an artefact
of one initiation window" both predict exactly this result. I previously used
that test to argue for the first reading; that was as unjustified as the
reviewer's argument for the second.

**On survivorship (§3).** 1,182 of 1,537 symbols having no stored bars is severe
and damages absolute breadth levels. But confirmed and failed episodes are
compared **on the same universe at the same calendar dates**, so the missing
names are absent from both arms equally. It biases the level far more than the
between-class difference the study actually tests. "Entirely invalidates any
breadth metric" is too strong for this specific comparison.

---

## 1. T0 is frozen — asserted, not assumed

| | |
|---|---|
| resolution variants generated | 12 (`hold` 3/5/8/10 × `horizon` 20/30/40) |
| episodes in every variant | **43** |
| identical `(episodeId, t0Date, t0Breadth)` across all 12 | **yes** |

Episodes are keyed by the **decline** they came from (`downtrendStartDate`), which
no resolution parameter can move. A unit test now pins this: `holdSessions` and
`horizonSessions` may not change `t0`, `downtrendStart`, `episodeLow` or
`drawdownAtT0`, while `stabilizationSessions` — an *initiation* rule — may and
does ([`recovery-episode.test.ts`](../../../src/lib/research/recovery-episode.test.ts)).

Three concepts, now separated in code and in the grid:

| concept | parameter | varied here |
|---|---|---|
| INITIATION | `stabilizationSessions`, `newLowLookback` | **frozen** (except in §2) |
| CONFIRMATION_WINDOW | `holdSessions` | 3 / 5 / 8 / 10 |
| RESOLUTION_WINDOW | `horizonSessions` | 20 / 30 / 40 |

---

## 2. Why `stab=8` killed the signal — it moved T0, nothing else

The previous phase could not separate three possible causes: T0 shifting, 16
declines dropping out, or the signal being spurious. Matching on the decline
settles it.

- stab=8's declines are a **strict subset** of stab=5's: 26 of 42, none unique.
- T0 is **later in 26 of 26** matched declines — typically by 2–5 sessions.

Measuring at T+2 on the **identical 26 declines**, changing only where T0 sits:

| feature @T+2 | stab=5 T0, all 43 | stab=5 T0, **common 26** | **stab=8 T0, common 26** |
|---|---|---|---|
| `dMa10` | +8.45 ✓ | **+11.31** [+2.8, +21.0] ✓ | **+0.22** [−9.9, +9.7] |
| `dMa20` | +5.37 ✓ | **+6.71** [+1.2, +12.7] ✓ | +0.13 [−7.0, +6.9] |
| `dNewHighRate` | +0.93 ✓ | **+1.24** [+0.3, +2.3] ✓ | +0.10 [−0.8, +1.0] |
| `dNewLowRate` | −1.50 | −1.07 [−4.2, +1.0] | +0.02 [−1.4, +1.5] |

Same episodes, same features, same checkpoint. The only difference is a T0 placed
2–5 sessions later, and the signal is gone.

**The collapse is a measurement-origin effect, not a sample-size effect** — that
much the matched test establishes, and it does supersede the previous phase's
reading that 16 dropped declines caused it.

**It does not establish that the signal is real.** "A genuinely short-lived
window" and "an artefact of this one initiation rule" both predict exactly this
result. An earlier draft used this section to argue for the first; the
independent review argued the second with equal confidence and equally little
proof. The test identifies the mechanism and leaves the interpretation open.

---

## 3. Checkpoint progression, T0 frozen

| ck | conf | fail | `dNewLowRate` | `dMa10` | `dMa20` | `dNewHighRate` |
|---|---|---|---|---|---|---|
| T0 | 22 | 20 | 0 | 0 | 0 | 0 |
| **T+1** | 22 | 18 | −0.57 | **+4.94** ✓ | +2.15 | +0.09 |
| **T+2** | 22 | 17 | −1.50 | **+8.45** ✓ | **+5.37** ✓ | **+0.93** ✓ |
| **T+3** | 22 | 14 | **−1.91** ✓ | **+7.95** ✓ | **+6.34** ✓ | +0.57 |
| T+5 | 22 | 10 | −0.80 | +7.84 | +7.38 | +0.44 |
| T+8 | 22 | 6 | **−2.57** ✓ | **+12.28** ✓ | **+12.77** ✓ | +0.76 |
| T+10 | 20 | 6 | −1.65 | **+11.96** ✓ | **+16.64** ✓ | +1.56 |

Volume breadth, dispersion and leader survival are **not significant at T+1–T+3**;
`dUpVolumeShare` and `leaderSurvival` only clear at T+10, where the failure class
has shrunk to 6 and the comparison is against late failures.

**The T+5 hole is a real caution.** A clean progression should not weaken between
T+3 and T+8. Part of it is sample churn (14 → 10 → 6 failures), but it means the
evidence is not the smooth monotone ramp the architecture hypothesis assumes.

---

## 4. The decisive test: information beyond the index move

`breadth_delta` regressed on the index's own return from T0 to the checkpoint.

**This test is now considered unsound** — see the verdict section. Two reasons:
the index return is plausibly a *mediator* rather than a confounder, so
residualising on it biases rather than controls; and breadth is equal-weighted
while the index is cap-weighted, so the residual contains the equal-weight
versus cap-weight spread by construction. The table is retained because the
phase was designed around it and removing it would hide what was actually run.

| checkpoint | `dMa10` residual | `dNewHighRate` residual | `dMa20` residual | `dNewLowRate` residual |
|---|---|---|---|---|
| T+1 | **+3.33** [+0.79, +5.86] ✓ | +0.05 | +0.99 | −0.34 |
| **T+2** | **+4.95** [+0.35, +9.84] ✓ | **+0.79** [+0.14, +1.53] ✓ | +2.54 [−0.11, +5.28] | −0.78 |
| T+3 | +4.64 [−1.27, +10.64] | +0.45 | +3.33 [−0.46, +7.17] | −1.31 |
| T+5 | +5.26 [−2.83, +13.82] | +0.37 | +4.41 [−2.13, +11.16] | −0.36 |

Roughly 40% of the raw `dMa10` effect tracks the index move (slope +3.76). What
remains is **not** established as incremental information: it does not survive
multiplicity correction, and the residual itself is confounded with the
equal-weight/cap-weight spread.

---

## 5. Temporal robustness (T0 frozen)

| cell | episode bootstrap | **year block** | **quarter block** |
|---|---|---|---|
| `dMa10` @T+2 | +8.45 [+2.2, +15.7] ✓ | +8.45 [+3.7, +15.6] ✓ | +8.45 [+2.0, +16.1] ✓ |
| `dMa20` @T+2 | +5.37 [+1.1, +9.9] ✓ | +5.37 [+1.3, +10.3] ✓ | +5.37 [+0.9, +10.3] ✓ |
| `dNewHighRate` @T+2 | +0.93 [+0.3, +1.7] ✓ | +0.93 [+0.3, +1.7] ✓ | +0.93 [+0.2, +1.7] ✓ |
| `dMa20` @T+3 | +6.34 [+0.5, +11.9] ✓ | +6.34 [+1.1, +11.9] ✓ | +6.34 [+0.8, +12.6] ✓ |
| `dNewLowRate` @T+3 | −1.91 [−3.9, −0.2] ✓ | −1.91 [−3.6, −0.4] ✓ | −1.91 [−4.3, −0.3] ✓ |
| `dNewLowRate` @T+2 | −1.50 [−3.5, +0.0] | −1.50 [−3.3, +0.2] | −1.50 [−3.9, +0.3] |

### Era split — same sign everywhere, insufficient power within each

| cell | 2015–2021 (n=21) | 2022–2026 (n=21) |
|---|---|---|
| `dMa10` @T+2 | +4.26 [−1.9, +10.2] | +14.40 [−0.7, +30.5] |
| `dMa20` @T+2 | +4.07 [−2.0, +11.0] | +7.47 [−0.6, +15.0] |
| `dNewHighRate` @T+2 | **+1.09** [+0.2, +2.0] ✓ | +0.85 [−0.0, +1.9] |
| `dMa20` @T+3 | **+6.09** [+0.4, +12.6] ✓ | +5.46 [−9.2, +17.4] |
| `dNewLowRate` @T+2 | −0.43 [−1.4, +0.5] | **−3.79** [−8.3, −0.3] ✓ |

**No sign flips** — the first phase in this project where that is true. But every
`dMa10`/`dMa20` per-era interval contains zero, and pooling eras whose individual
intervals both contain zero is exactly where a level difference between eras can
masquerade as an episode-level relationship. Same sign across eras is weaker
evidence than an earlier draft of this document implied.

---

## 6. Label sensitivity, with T0 identical in every column

Twelve outcome definitions; T0 never moves.

| cell | columns significant | range of effect |
|---|---|---|
| `dMa10` @T+2 | **12 / 12** | +8.06 … +10.56 |
| `dMa20` @T+2 | **12 / 12** | +4.92 … +7.12 |
| `dNewHighRate` @T+2 | **12 / 12** | +0.86 … +1.23 |
| `dMa20` @T+3 | 8 / 12 | +5.02 … +9.45 |
| `dNewLowRate` @T+3 | 4 / 12 | −1.34 … −1.98 |
| `dNewLowRate` @T+2 | 2 / 12 | −1.47 … −2.07 |

The three T+2 breadth cells hold their sign, size and significance under **every**
outcome definition tested. `dNewLowRate` does not, which is a second reason to
retire it as a candidate.

---

## 7. What Gate 1 costs on these exact episodes

| | |
|---|---|
| episodes reaching a Gate 1 PASS within 120 sessions | 42/42 |
| median sessions T0 → first PASS | **14** (p25 5, p75 24) |
| PASS arriving at or before T+2 | **6 / 42** |
| index move T0 → PASS | **+1.69%** median |
| **PASS episodes that went on to FAIL** | **20 / 42 (48%)** |

T+2 precedes Gate 1 by roughly twelve sessions in the median case, and Gate 1's
own discrimination is close to a coin flip: it fired in 48% of the attempts that
went on to undercut their low. That does not make T+2 a substitute — it means
Gate 1 is not the false-dawn filter the current architecture treats it as.

---

## 8. Leader interaction, episode-clustered

Each episode contributes **one** mean, so a busy episode cannot count as many
observations.

| episodes with leader flags at T0–T+3 | n | episode-mean fwd20 |
|---|---|---|
| inside a confirmed recovery | 20 | **+6.12%** (median +4.77%) |
| inside a failed recovery | 20 | **−5.13%** (median −2.86%) |
| difference | | **+11.25pp**, CI **[+5.57, +17.61]** ✓ |

The interaction survives proper clustering: the same leader flag is worth about
11 points more inside a real recovery. This is conditional on knowing the
outcome, so it motivates gating stock selection on market state — it does not
show the gate can be set early enough to act.

---

## 9. Self-administered adversarial checks

| attack | result |
|---|---|
| **T0 contaminated by resolution params** | refuted — asserted identical across all 12 variants, and unit-tested |
| **stab=8 collapse proves the signal is fake** | refuted — same 26 declines, only T0 moved (§2) |
| **breadth is just the index move** | **partly upheld** — kills `dMa20`, `dNewLowRate`; `dMa10` and `dNewHighRate` survive residualisation |
| **checkpoint cherry-picking** | all seven checkpoints reported; T+5 is weaker than its neighbours and is shown, not hidden |
| **pseudo-replication** | episodes are the unit throughout, including §8 |
| **multiplicity** | 7 features × 7 checkpoints = 49 cells; the claims rest on cells that also survive residualisation, year- and quarter-block bootstrap, and 12/12 label columns — not on raw count |
| **era instability** | no sign flips, but per-era power is insufficient; stated rather than glossed |
| **post-selection across phases** | **unresolved** — this is the sixth phase on one dataset, and `dMa10`/`dNewHighRate` were not pre-registered before the earlier phases were read |

### Limits

- **43 episodes, 21 per era.** Everything here is pooled-sample evidence.
- **The window is narrow.** Incremental content exists at T+1–T+2 and is gone by
  T+3, so any use of it would be timing-sensitive in exactly the way that makes
  live implementation fragile.
- **T+5 hole** breaks the smooth-progression story.
- **Close-of-session timing**; a tradable version acts at the next open.
- **Survivorship**: 1,182 of 1,537 symbols have no stored bars.
- **FPT/FRT unchanged and unused**: FPT still has 0 flags inside any episode, FRT
  is still `NOT EVALUABLE`. Neither influenced any definition here.

### Before this is promoted to a risk-model phase

1. **Run the Codex adversarial review** on this artifact.
2. **Pre-register** `dMa10` and `dNewHighRate` at T+1/T+2, with this exact
   initiation rule, and test on data not used across these six phases.
3. Treat the T+5 hole as a question, not noise.
