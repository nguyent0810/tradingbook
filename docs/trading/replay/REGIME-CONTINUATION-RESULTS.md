# Regime-conditioned continuation decay — results

**Date:** 2026-08-13 · Executes [`REGIME-CONTINUATION-PREREGISTRATION.md`](REGIME-CONTINUATION-PREREGISTRATION.md), committed at `5e5cd21` before any conditional outcome was read
**Basis:** 572 scored setups, all joined to a frozen regime label at T0, 119 months

---

## Primary verdict: `DECAY PERSISTS WITHIN MATCHED MARKET STATES`

**The frozen regime model does not explain the decay.** Continuation rates fell in
**every** market state, and standardising away the composition shift removes
essentially none of it.

| id | hypothesis | effect | p | verdict |
|---|---|---|---|---|
| **P1** | within-state era decay persists | **−19.7pp** | **0.0007** | **SUPPORTED** |
| P2 | composition shifted adversely | +1.2pp | 0.2082 | **not supported** |
| **P3** | winners see a better post-entry index path | **+0.60pp** | **0.0025** | **SUPPORTED** |

Bonferroni α = 0.0167. Estimators recalibrated before reading results: empirical
FPR **1.7%** for both P1 and P2 against a nominal 1.67%.

---

## §3–§4 Within-state rates: every state got worse

| regime | old n | old | new n | new | difference |
|---|---|---|---|---|---|
| `BROAD_ADVANCE` | 226 | 39.4% | 187 | 29.9% | **−9.4pp** |
| `NARROW_RALLY` | 26 | 53.8% | 43 | 25.6% | **−28.3pp** |
| `SYSTEMIC_WEAKNESS` | 26 | 34.6% | 50 | 20.0% | **−14.6pp** |
| `RECOVERY_UNDERNEATH` | 6 | 66.7% | 8 | 12.5% | *(too sparse — reported, not interpreted)* |
| **total** | 284 | 40.8% | 288 | 27.1% | −13.8pp |

Same direction in all four. The decay is broader than any state the current model
distinguishes.

A detail worth noting because it contradicts intuition: in the **old** era
`NARROW_RALLY` was the *best* environment for these setups (53.8%), better than
`BROAD_ADVANCE` (39.4%). That is consistent with the much earlier finding that
Gate 1 `WARNING` outperformed `PASS`, and it is why the composition shift below
does not hurt.

## §11 Standardisation: composition explains none of it

| | rate |
|---|---|
| observed old | 40.85% |
| **new composition × old within-state rates** | **41.47%** |
| observed new | 27.08% |

| component | effect | share of total decay |
|---|---|---|
| **composition** | **+0.63pp** | **−5%** |
| **within-state** | **−14.39pp** | **105%** |

Reverse standardisation agrees: composition −1.18pp, within-state −12.58pp.

Setups did shift toward worse-sounding states — `BROAD_ADVANCE` 80% → 65%,
`SYSTEMIC_WEAKNESS` 9% → 17%, `NARROW_RALLY` 9% → 15% — but because
`NARROW_RALLY` carried the *highest* old-era rate, that shift nets to roughly
zero. **The market states the scanner fires in changed; the change did not cost
anything. What cost is that every state stopped paying.**

---

## §5–§7 Post-entry trajectory (diagnostic — conditions on outcome)

Median values, T0 → T+5:

| group | n | index return | Δ %>MA10 | Δ new-low rate |
|---|---|---|---|---|
| old × winner | 116 | +1.05% | **+0.20** | −0.03 |
| old × failure | 168 | +0.39% | **−4.77** | +0.00 |
| new × winner | 78 | +0.73% | **−2.14** | +0.01 |
| new × failure | 210 | **−0.35%** | **−5.32** | +0.01 |

**P3 supported** (+0.60pp, p=0.0025): winners do experience a better index path
in the days after entry. But note what the breadth column says — **new-era
winners now succeed while breadth is contracting** (−2.14), where old-era winners
had it flat (+0.20). This points toward the brief's **case A**: the market
follow-through winners used to get is scarcer, rather than stocks failing to
respond to follow-through that still arrives.

This table conditions on the outcome and is measured after entry. It is not, and
cannot be, a signal available at T0.

## §8 Transitions

| | stayed in the same regime at T+5 |
|---|---|
| old × winner | 82% |
| old × failure | 79% |
| new × winner | 79% |
| **new × failure** | **66%** |

New-era failures are the only group that frequently leaves its starting regime —
they are more often accompanied by the market state deteriorating underneath them.

## §9 Synchronisation: essentially unchanged — this is not the mechanism

| | top 5% of failure dates | top 10% of failure months |
|---|---|---|
| 2015–2021 | 10% of failures | 24% |
| 2022–2026 | 12% of failures | 22% |

Failures are no more clustered after 2022 than before. **`FAILURES ARE
MARKET-SYNCHRONIZED` is refuted** as the dominant structure — the decay is spread
across 170 distinct dates and 51 months, not concentrated in a few episodes.

## §10 Giveback: market-linked in the new era only

Of setups that reached +2 ATR, median index return T0 → T+10:

| era | round-tripped | retained |
|---|---|---|
| 2015–2021 | +1.38% | +1.48% |
| **2022–2026** | **+0.95%** | **+1.86%** |

In the old era, giving the move back had nothing to do with the index. In the new
era it does. Small samples (28 and 33 events), no significance claim — but it
suggests the giveback finding is at least partly a market-path phenomenon rather
than purely a stock-level exit problem.

---

## §13 What this is, and what it is not

**Explanatory evidence, not validation.** This is the tenth phase on one dataset,
and the decay it conditions on was discovered in phase 8 and tested in phase 9 on
the same history. Nothing here is out-of-sample. The phrase "validated edge" does
not apply and is not used.

A limitation flagged in the preregistration and worth repeating: the frozen regime
axis and Gate 1 both read the index against its MA50, so "conditioning on market
state" removes less independent variation than the four-cell table suggests. A
richer market model might absorb more of the within-state decay than this one
does — that possibility is not excluded, only untested.

## What the phase answers

> Is the hit-rate decay an unconditional era effect, or explained by market
> environment at entry?

**Unconditional.** Conditioning on the market state at entry removes ~0% of it.
The decay is present in every state, and the shift in which states occur was
neutral-to-slightly-favourable.

## Next research direction — per §16, a proposal only

Composition is ruled out, and synchronisation is ruled out. Two candidates remain
and they are separable:

1. **The market-follow-through channel.** New-era winners succeed against
   contracting breadth, new-era failures are accompanied by regime deterioration
   (66% vs 79% staying put), and new-era giveback tracks the index where old-era
   giveback did not. This points at exposure/market-risk architecture.
2. **A structural change in what a breakout-pullback is worth**, independent of
   any market state this project can currently measure — the residual after
   composition, synchronisation and state-conditioning are all excluded.

These are different phases, and the brief's rule applies: no tuning until the
mechanism is known.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-13, 15 attack vectors. Verdict:
*"tautological arithmetic and collider bias… explains nothing and merely
redescribes the unconditional decay."*

Two criticisms are correct and change how this must be presented. One is a
misreading refuted by the method. The verdict survives, narrower.

## Upheld — P1 was close to a tautology and should not have been primary

The reviewer's arithmetic is right. With the composition effect near zero, the
within-state effect is the total decay by the decomposition identity:

| | |
|---|---|
| total decay (H1, phase 9) | −13.76pp |
| within-state decay (P1) | −14.39pp |
| **what P1 adds over H1** | **−0.63pp** |

So P1 is not an independent finding. **The informative test in this phase is P2 —
the composition test — and P1 is its arithmetic complement.** Presenting P1 as a
"SUPPORTED hypothesis" alongside P2 overstated what was learned. The correct
reading of the primary table is: *composition is not where the decay lives*, and
everything else follows from that plus phase 9.

## Upheld — the composition estimate is not robust in sign, only in magnitude

The reviewer argued the +0.63pp composition effect is an artefact of
`NARROW_RALLY`'s 53.8% old-era rate on n=26. Month-block bootstrap of the whole
decomposition:

| component | point | 95% CI |
|---|---|---|
| composition | +0.63pp | **[−2.77, +4.85]** — contains zero; 34% of draws negative |
| within-state | −14.39pp | **[−25.16, −4.97]** |

Forcing `NARROW_RALLY`'s old-era rate to alternatives, as the reviewer proposed:

| NARROW old rate | composition | within-state |
|---|---|---|
| 34.6% (= `SYSTEMIC`) | **−2.25pp** | −11.51pp |
| 39.4% (= `BROAD`) | −1.53pp | −12.23pp |
| 45.0% | −0.69pp | −13.07pp |
| **53.8% (observed)** | +0.62pp | −14.38pp |
| 60.0% | +1.54pp | −15.31pp |

**The sign of the composition effect is not established** — the claim that the
state shift was "neutral-to-slightly-favourable" is withdrawn. **Its magnitude is
bounded and small**: even under the reviewer's own most adverse substitution,
composition accounts for −2.25pp of a −13.76pp total, about 16%. Within-state
decay stays between −11.5 and −15.3pp across the entire sensitivity range.

So the conclusion holds in the form that matters — *composition does not explain
the decay* — while the decorative version of it does not.

## Upheld — P3 should never have been a primary hypothesis

P3 compares post-entry market paths between winners and failures. That conditions
on the outcome, so it can only ever be descriptive; making it primary was a design
error in the preregistration, not something the result can repair. It is
reclassified here as diagnostic, and its p-value carries no weight. The same
applies to the transition table and the giveback comparison, which were already
labelled diagnostic.

## Refuted — the analysis does not treat 572 setups as independent

The reviewer's pseudo-replication charge (called FATAL) says magical p-values come
from treating N=572 as independent draws. Every p-value in this phase comes from
permuting era labels across **119 months**, with the statistic computed on month
aggregates — the correction phase 9 introduced precisely because observation-level
inference was miscalibrated. The method section states this; the criticism
misreads it.

## Acknowledged and unresolved

- **Regime/Gate 1 collinearity** — flagged in the preregistration before results.
  Both read the index against its MA50, so this conditioning removes less
  independent variation than four cells suggest. A richer market model might
  absorb more of the within-state decay. Untested, not excluded.
- **Sparse cells** — `RECOVERY_UNDERNEATH` (n=6/8) is reported and explicitly not
  interpreted; `NARROW_RALLY` and `SYSTEMIC_WEAKNESS` at n=26 old are thin, which
  is exactly what the sensitivity table above quantifies.
- **HARKing and era-boundary provenance** — stated in §13 before results and
  unchanged: tenth phase, one dataset, hypothesis discovered in phase 8. Not
  out-of-sample.

---

## Verdict after review: `DECAY PERSISTS WITHIN MATCHED MARKET STATES` — retained, narrowed

Retained because the load-bearing claim survives every quantitative check: under
no tested variation does market-state composition account for more than ~16% of
the decay, and within-state decay remains −11.5 to −15.3pp with a bootstrap
interval excluding zero.

Narrowed in three ways: P1 is the arithmetic complement of a phase-9 result rather
than an independent finding; the composition effect's sign is unestablished, so
only its bounded smallness may be claimed; and P3 is demoted to diagnostic.

The next-direction proposal in Part I is unaffected — composition and
synchronisation are both excluded as the mechanism, which is what determines
where the next phase should look.
