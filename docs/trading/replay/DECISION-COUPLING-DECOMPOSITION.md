# Decision-coupling decomposition

**Date:** 2026-08-14 · Phase 15 · Design only, audited against `aaea35e`
**Rule:** nothing is implemented, tuned, replaced or backtested. `src/` is untouched.

---

## Verdict: `DECISION COUPLING DECOMPOSITION READY`

Five decisions can be given independent input contracts without changing any
strategy behaviour, because **four of the five are already separable in the source
and only one authority has to be withdrawn**: `quality` must stop controlling
anything.

The audit also found two couplings the phase brief did not anticipate, both
measured rather than asserted:

1. **There are two different volume-expansion primitives**, computed on the same
   window from the same numerator with different central tendencies. At the same
   1.5 cutoff they would disagree on **22.5% of setups**.
2. **Volume information enters the paper-lab opportunity score through three
   paths at once**, totalling ~0.47 of a score whose weights sum to 1.

---

## §0 The decision DAG, with call sites

### Primitives

| primitive | definition | source |
|---|---|---|
| `volRatio` | `bar.volume ÷ **median**(prior 20 volumes, evaluation bar excluded)` | [`breakout-pullback.ts:316-322`](../../../src/lib/scanner/gate2/breakout-pullback.ts) |
| `volRatioMa20` | `bar.volume ÷ **mean**(prior 20 volumes, evaluation bar excluded)` | [`compute-market-context.ts:88-89`](../../../src/lib/market/compute-market-context.ts) |
| `close vs ma20` | `close >= sma(closes, 20)` at the evaluation bar | `breakout-pullback.ts:180, 398` |
| structural stop | `min(low over [breakout bar, eval bar]) × (1 − 0.01)` | `breakout-pullback.ts:333, 363` |

### The graph

```
volRatio ──┬──► quality A|B ──┬──► VISIBILITY   collect-candidates.ts:32
           │   (with          │                 run-daily-scan-job.ts:310
           │    close≥ma20)   │                 replay-engine.ts:372
           │                  ├──► SIZING       position-sizing.ts:33-35   A=1.0 B=0.5
           │                  ├──► STANCE       trading-decision.ts:51
           │                  ├──► PL ENTRY     evaluate-manager.ts:90-93
           │                  ├──► PL OPPTY     rotation.ts:44             weight 0.35
           │                  └──► PL CONF      confidence.ts:34           weight 0.30
           │
           └──► rankScore.volumeTerm ──► ORDERING ONLY   rank-components.ts:84

volRatioMa20 ──► confidence.fVol ──► PL CONF   confidence.ts:41           weight 0.30
             └─► evidence text                 build-market-context-evidence.ts:118

structural stop ──► sizing per-share risk ──► SIZING     position-sizing.ts:94
                └─► setup validity           breakout-pullback.ts:365     ← coupling
```

### What the graph shows

| observation | evidence |
|---|---|
| **`quality` is a six-consumer authority** | the six arrows above |
| **`rankScore` gates nothing** | every consumer is a DTO, a UI cell or a replay diagnostic; `setups-queries.ts:13` orders by it with no limit |
| **the stance reads *pre-filter* counts** | `run-daily-scan-job.ts:340` passes `candidateCountA/B` tallied before the surfacing rule at `:308` |
| **tier B influences the stance under `PASS` but not under `WARNING`** | `trading-decision.ts:36` uses `hasAnyGate2Setup(A,B)`; `:51` uses `candidateCountA > 0` alone |
| **trade feasibility decides setup validity** | `validateSwingTradeStructure` returns INVALID when `riskFrac < 0.003` (`breakout-pullback.ts:132-135`) |
| **two volume primitives** | measured below |

---

## §4 `volRatio` fan-out audit

| path | consumer | classification | why |
|---|---|---|---|
| `volRatio` → `quality` → visibility | Gate 1 surfacing | **UNJUSTIFIED** | phase 14.5: no stratum separates A from B; the label's discriminating power is undemonstrated |
| `volRatio` → `quality` → sizing multiplier | `position-sizing.ts` | **UNJUSTIFIED** | same evidence; point estimate runs backwards |
| `volRatio` → `quality` → stance | `trading-decision.ts` | **DUPLICATED** | the stance re-reads the same label that already decided visibility |
| `volRatio` → `quality` → paper-lab entry gate | `evaluate-manager.ts` | **DUPLICATED** | a third gate on one label |
| `volRatio` → `quality` → opportunity score (0.35) | `rotation.ts` | **DUPLICATED** | see the triple path below |
| `volRatio` → `quality` → confidence `fGate2` (0.30) | `confidence.ts` | **DUPLICATED** | ditto |
| `volRatio` → `rankScore.volumeTerm` | ordering | **JUSTIFIED** | ordering is a comparative question and volume is a legitimate comparative attribute; it gates nothing |
| `volRatioMa20` → confidence `fVol` (0.30) | `confidence.ts` | **UNKNOWN** | a second, differently-defined primitive; see below |
| `volRatioMa20` → evidence text | reporting | **JUSTIFIED** | display only |

### The two primitives are not the same measurement

Measured on all 574 resolved setups, using each subsystem's own convention:

| statistic | p10 | p50 | p90 | denominator |
|---|---|---|---|---|
| Gate 2 `volRatio` | 1.267 | **1.596** | 2.662 | median |
| context `volRatioMa20` | 1.071 | **1.377** | 2.102 | mean |
| ratio (context ÷ Gate 2) | 0.686 | **0.854** | 0.973 | |

`volRatioMa20` is **below** `volRatio` in **94.9%** of setups — necessarily, since
volume is right-skewed so its mean exceeds its median. The offset is systematic,
not noise.

> **Applying the same 1.5 cutoff to both would disagree on 129 of 574 setups
> (22.5%).** Every disagreement is a setup that one subsystem calls high-volume
> and another does not.

Neither is wrong. What is wrong is that **two subsystems believe they are reading
"volume expansion" and are reading different numbers**, with no documented reason
for the difference and no name distinguishing them.

### The triple path into one score

`opportunityScore = 0.35·g2 + 0.25·rs + 0.2·confN + 0.2·regimeFit`
([`rotation.ts:44-50`](../../../src/lib/paper-lab/dna/rotation.ts)), where `g2`
is `quality`, and `confN` is the confidence score, itself
`0.3·fGate2 + 0.2·fRs + 0.3·fVol + …` for a representative DNA
([`manager-configs.ts:107`](../../../src/lib/paper-lab/dna/manager-configs.ts)).

| route | weight into `opportunityScore` |
|---|---|
| `quality` directly as `g2` | 0.35 |
| `quality` again via `confN → fGate2` | 0.2 × 0.3 = 0.06 |
| `volRatioMa20` via `confN → fVol` | 0.2 × 0.3 = 0.06 |
| **volume-derived total** | **≈ 0.47** |

Nearly half of a score whose weights sum to 1 traces to one primitive, measured
two different ways, entering three times. **No consumer documents this**, and a
change to the 1.5 cutoff would move all three at once by different amounts.

### Correction to the phase-14.5 artifact

[`QUALITY-LABEL-VALIDITY.md`](QUALITY-LABEL-VALIDITY.md) states that Gate 2's
`volRatio` reaches a decision through three paths including `confidence.fVol`.
**That is wrong in one particular**: `fVol` reads `volRatioMa20`, a different
statistic. Gate 2's `volRatio` reaches decisions through `quality` and
`rankScore`; the confidence term is fed by the *other* primitive. The corrected
picture is worse rather than milder — the paths are not merely duplicated, they
are **inconsistent**.

---

## §5 The MA20 redundancy, and the invariant that expresses it

Proved from source in phase 14.5 and restated here as a testable invariant.

```
pullbackZoneHigh = breakoutLevel
pullbackZoneLow  = min( max(breakoutLevel × (1 − 0.02), ma20), pullbackZoneHigh )
if (close < pullbackZoneLow) → INVALID
                                       breakout-pullback.ts:245-254, 306-311
```

| case | consequence |
|---|---|
| `ma20 ≤ breakoutLevel` | `pullbackZoneLow ≥ ma20`, so surviving the zone check **forces** `close ≥ ma20` |
| `ma20 > breakoutLevel` | zone floor is clamped to `breakoutLevel < ma20`; `close ≥ ma20` is **not** forced |

Measured: the exception occurs in **4 of 574 setups (0.7%)**.

**Invariant test concept — to be written when the decomposition is implemented,
not now:**

> For every Gate-2-valid evaluation with `ma20 ≤ breakoutLevel`, `close ≥ ma20`
> holds. Constructed counterexamples must be rejected by the pullback-zone check
> before the tier test is reached.

The architectural consequence, which is what this phase needs: **`close ≥ ma20`
may never be presented as independent evidence of setup quality.** It is a
restatement of a check that already ran.

---

## §1 The five decisions

| # | decision | question | current owner |
|---|---|---|---|
| **D1** | **VISIBILITY** | should this candidate be shown at all? | Gate 1 level × `quality` |
| **D2** | **FEASIBILITY** | can this valid setup actually be executed? | fused into Gate 2 validity |
| **D3** | **SIZING** | how much capital-at-risk is permitted? | `quality` multiplier × account caps |
| **D4** | **RANKING** | which of several valid candidates comes first? | `rankScore` — already clean |
| **D5** | **STANCE** | `NO_TRADE` / `PROBE` / `NORMAL` | Gate 1 level × pre-filter A/B counts |

Only **D4** is currently answered by a variable that answers nothing else.

The decomposition adds a sixth, which the brief's list implies but does not name:
**D0 — the market risk budget**, split out of D5 after review because the thing
that *gates* and the thing that *reports* must not share a name (§2).

---

## §2 Input contracts

Each contract lists what a decision **may** read, what it **may not**, its output,
its invariants and its failure semantics. **No feature is selected here** — the
contracts constrain the shape of an answer, not its content.

### D1 — VISIBILITY

Revised after review, which was right that a three-valued output reading the
budget violates acceptance scenario S5.

| | |
|---|---|
| **may read** | setup validity, trade feasibility verdict |
| **may not read** | **anything from the sizing domain, including whether a budget exists**, `rankScore`, any label whose other job is sizing, the stance |
| **output** | `SHOWN` \| `HIDDEN` — **two values** |
| **invariants** | I2: the shown set is byte-identical under every sizing input |
| **failure** | on missing inputs, `SHOWN` with a refusal code; never silently `HIDDEN` |

**Actionability is a separate field, not a visibility value.**

| | |
|---|---|
| **`actionability`** | `ACTIONABLE` \| `WATCH_ONLY` |
| **may read** | whether the market risk budget is non-zero and whether any remains |
| **may not read** | any per-candidate score or label |

The first draft folded these into one three-valued output, which let the budget
decide who is *seen*. Splitting them makes S5 exactly satisfiable: **the budget
changes `actionability` and position size; it can never change the shown set.**

`WATCH_ONLY` is what V1 structurally cannot express — **"seen, and deliberately
not funded"** is different from "not there".

### D2 — FEASIBILITY

Revised after review: the first draft let D2 read "the risk budget available to
this candidate", which imported market state into the stock branch and made
feasibility depend on the order candidates were processed in.

| | |
|---|---|
| **may read** | the structural stop, tick / fee / volatility floors, the symbol's own liquidity |
| **may not read** | market state, **the risk budget**, `quality`, `rankScore`, visibility, any other candidate |
| **output** | `FEASIBLE` \| `FEASIBLE_AT_REDUCED_SIZE` \| `NOT_FEASIBLE_NOISE` \| `NOT_FEASIBLE_LIQUIDITY` |
| **invariants** | **feasibility never changes validity** — the coupling at `breakout-pullback.ts:132-135` that must be severed. And D2 is a **pure function of one candidate**: evaluating candidates in any order gives identical verdicts |
| **failure** | unknown liquidity ⇒ `FEASIBLE_AT_REDUCED_SIZE`, never a validity failure |

`NOT_FEASIBLE_CAPACITY` has moved to D3, where it belongs: whether the budget
affords a lot is an allocation question, not a property of the setup.

### D3 — SIZING

| | |
|---|---|
| **may read** | structural risk per share, the market risk budget, portfolio open risk, per-symbol and liquidity caps |
| **may not read** | `quality`, visibility, `rankScore`, the stance |
| **output** | a quantity, plus the binding constraint that produced it |
| **invariants** | I5 below — no stock-level attribute may raise the *total* portfolio budget, only claim a share of it |
| **failure** | below one board lot ⇒ `NOT_FEASIBLE_CAPACITY`, emitted by D3 itself. It is a sizing outcome, not a property of the setup, and it must never travel back to D2 |

### D4 — RANKING

| | |
|---|---|
| **may read** | comparative attributes of already-valid, already-feasible candidates |
| **may not read** | anything that could make a candidate invalid, infeasible, hidden or unfunded |
| **output** | a total order, plus its decomposed terms |
| **invariants** | I1 — ranking is a permutation; it never removes a candidate from the set. **I9b — each primitive contributes to the total through exactly one term** |
| **failure** | unrankable ⇒ ranked last, still visible |

**Primitive uniqueness, added after review.** Banning the `quality` *label* does
not ban the *primitives* underneath it, and the audit shows why that matters: one
volume measurement currently reaches `opportunityScore` through three terms
totalling ~0.47. So the contract constrains the shape of any score:

> A primitive may enter a scoring function through **exactly one** term. Two terms
> derived from the same underlying measurement — even computed differently — are a
> contract violation, and the fan-out manifest (I9) covers scoring weights, not
> just call sites.

**Which** volume primitive survives is not chosen here; §15 forbids it. The
constraint is that there may be only one, and that the choice must be made and
justified explicitly rather than accumulated.

`rankScore` already satisfies this contract. **It is the only part of V1 that
does**, and it should be left alone.

### D5 — STANCE, split in two after review

The review was right that a stance sitting at the end of the pipeline, able to
return `NO_TRADE`, is a relocated god-object — and right that this reads as a
cycle (stance → budget → visibility → counts → stance). **It is not a cycle in
this design**, because the budget comes from market state and never from the
stance. But the first draft's diagram invited exactly that reading, and the fix is
to stop calling one thing by two names.

| | **D0 — MARKET RISK BUDGET** (computed **first**) | **D5 — STANCE LABEL** (terminal **report**) |
|---|---|---|
| **may read** | market state and its direction | the budget, aggregate open risk, a vector of counts by decision state |
| **may not read** | any candidate, any count, the stance | any individual candidate's label, score or size |
| **output** | a quantity of risk | `NO_TRADE` \| `PROBE` \| `NORMAL` |
| **gates?** | **yes — this is the gate** | **no — it names what the budget already did** |

The graph is strictly acyclic: `market state → D0 → {D1b actionability, D3} → D5`,
with `D1a → D5` supplying counts. Nothing flows back into D0.

**Fixed input arity for D5:** the budget, the aggregate open risk, and the count
vector — **nothing else, ever.** Adding a fourth input is a contract change
requiring the same scrutiny as adding a gate. Its output must be reproducible from
that tuple alone, which is the property that stops it accreting authority.

---

## §3 What happens to `quality`

**Option B: retained as a reporting label only.**

Option A — deletion — is rejected for a reason that has nothing to do with its
predictive power: `quality` is persisted on `SetupCandidate` and `SetupWatchItem`,
rendered in the setups workstation and the quality ladder, and used in Vietnamese
UI copy. Deleting it is a data-model and UI migration, which is not what this
phase is for and would entangle a semantic fix with a schema change.

**The rule, and it is absolute:**

> `quality` becomes a **derived, reporting-only** label. It may be computed,
> stored and displayed. It may not appear in any expression that determines
> visibility, feasibility, sizing, ranking, stance, entry eligibility, an
> opportunity score, or a confidence score.

Six call sites must stop reading it. **No replacement label is designed here** —
§15 forbids it, and the point of the contracts above is that each decision names
what it needs, so no successor authority is required.

---

## §6 Target decision flow

```
MARKET CONTEXT ──► D0  MARKET RISK BUDGET          computed FIRST; this is the gate
   (index, breadth,        (a quantity of risk,
    direction)              not a permission)              │
                                                           │
STOCK BARS ──► SETUP VALIDITY ──► D2 FEASIBILITY           │
   (per stock,      nothing            structural only,    │
    no index)       downstream         order-independent   │
                    may undo it              │             │
                          └──────┬───────────┘             │
                                 ▼                         │
                          D1a  SHOWN | HIDDEN              │
                                 │                         │
                                 ├───────────────────────► D1b  ACTIONABLE | WATCH_ONLY
                                 ▼
                          D4  RANKING            permutation only
                                 │
                                 ▼
                          D3  SIZING  ◄──────────────────── budget share, structural
                                 │                          risk, caps, capacity
                                 ▼
                       PORTFOLIO RISK CHECK   Σ open risk ≤ budget
                                 │
                                 ▼
                          D5  STANCE LABEL     a report, not a gate
```

Three properties V1 does not have:

- **Validity flows forward only.** Nothing downstream of `SETUP VALIDITY` can
  invalidate a setup — which is exactly what feasibility does today.
- **The market enters once**, as D0, and never touches the stock branch. D2 was
  revised to stop reading the budget precisely so this stays true.
- **The gate is at the top, the label at the bottom.** V1's `NO_TRADE` reads like
  a terminal kill switch; here the budget already decided, and D5 only names it.

No threshold and no multiplier is assigned anywhere in this diagram, deliberately.

## §7 Observability contract

Every candidate must be able to answer each field independently. **No field may be
explained by citing `quality`.**

```
D0  marketState        RISK_OFF | EARLY_RECOVERY | RECOVERY | BROAD_ADVANCE | EXTENDED | DETERIORATING
    marketRiskClass    NONE | PROBE | PARTIAL | NORMAL | REDUCE
    budgetRemaining    quantity, and how much of it is already committed

    setupValidity      NOT_A_SETUP | FORMING | VALID | BROKEN
D2  tradeFeasibility   FEASIBLE | FEASIBLE_AT_REDUCED_SIZE | NOT_FEASIBLE_{NOISE,LIQUIDITY}
    feasibilityBasis   which floor bound: tick | fee | volatility | liquidity | none

D1a shown              SHOWN | HIDDEN
    shownReasons       ordered codes; non-empty even when SHOWN
D1b actionability      ACTIONABLE | WATCH_ONLY
    actionabilityReason why, when WATCH_ONLY  (e.g. market_budget_zero)

D4  rankingInputs      the decomposed terms, each with its own value and its source primitive
    rankingResult      position in the order, and the order's size

D3  sizingInputs       structural risk/share, budget share, every binding cap
    riskBudgetResult   quantity, risk-at-stop, which constraint bound
                       — including NOT_FEASIBLE_CAPACITY, which is a sizing outcome

D5  stance             NO_TRADE | PROBE | NORMAL
    stanceReasons      the budget, the aggregate open risk, and the count vector
```

Three shape changes from the first draft, all forced by the revised contracts:
`visibilityDecision` is split into `shown` and `actionability`; `NOT_FEASIBLE_CAPACITY`
moved from D2's output to D3's; and every ranking term must name **which primitive
it came from**, which is what makes I9b checkable.

**Two rules that make this worth having:** reasons are mandatory on positive
outcomes, not only refusals; and every field must be derivable from information
at or before the session it is dated, which the existing point-in-time guard
already enforces for all current inputs.

---

## §8 Invariants and reachability requirements

The review was right that "a candidate **may** be X" is an existential claim, not
an invariant. They are separated here.

### Invariants — must hold always

| id | invariant | testable as |
|---|---|---|
| **I1** | ranking never changes setup validity | permute `rankScore` for all candidates; the validity set is byte-identical |
| **I2** | sizing inputs never change **who is shown** | vary equity / risk % / caps / the entire budget including zero; the `SHOWN` set is byte-identical |
| **I3** | visibility policy never changes the structural stop | swap the visibility rule; every `stopLevel` is unchanged |
| **I4** | market state never changes stock setup validity | evaluate identical bars under all market states; validity identical |
| **I5** | no stock attribute raises the **total** portfolio risk budget | vary every stock attribute; D0's output is unchanged |
| **I9** | no primitive influences one decision twice by an undocumented path | a declared fan-out manifest; CI fails when a consumer or a **scoring term** is added without an entry |
| **I9b** | each primitive enters a scoring function through exactly one term | manifest check over score definitions, not just call sites |
| **I10** | no reporting label is an implicit control signal | **enforced by type, not by grep** — see below |
| **I11** | D2 is order-independent | evaluate the candidate set in randomised orders; verdicts identical |

### Reachability requirements — must be demonstrable at least once

| id | requirement |
|---|---|
| **R6** | `VALID` + `NOT_FEASIBLE` is reachable, with both fields populated |
| **R7** | `SHOWN` + `WATCH_ONLY` is reachable, with a populated refusal reason |
| **R8** | `WATCH_ONLY` and a non-`NORMAL` size class vary independently |

### How I9 and I10 are actually enforced

The review is right that grep cannot catch aliasing, destructuring or transitive
reads. **Enforcement is by narrowed types**: each decision receives a DTO from
which banned fields are *absent*, so reading one is a compile error rather than a
review failure.

| decision | its input DTO must not contain |
|---|---|
| D1a | any sizing field, `rankScore`, `quality`, the budget |
| D2 | market state, the budget, `quality`, `rankScore`, other candidates |
| D3 | `quality`, visibility, `rankScore` |
| D4 | anything that could invalidate, or a second term from one primitive |
| D5 | any per-candidate field at all |

`quality` is therefore stripped from the core trading DTOs entirely and reaches
only the reporting tier. Grep remains as a secondary net, not the mechanism.

## §9 Acceptance scenarios

Behavioural, not historical. None is drawn from a known winner.

| # | situation | required outcome |
|---|---|---|
| **S1** | index weak; stock setup valid and feasible | `VISIBLE` is reachable; the risk decision is taken separately and may be zero |
| **S2** | market healthy; stock setup invalid | `INVALID` — the market may not rescue a setup |
| **S3** | setup valid; stop below the noise floor | `VALID` **and** `NOT_FEASIBLE_NOISE` simultaneously; V1 reports `INVALID` and loses the distinction |
| **S4** | two valid candidates differing only in rank score | identical validity, identical feasibility, identical sizing *eligibility*; only order differs |
| **S5** | market risk budget changed, nothing else | position size and `actionability` change; **the `SHOWN` set does not** |

S3 and S5 are the two V1 provably fails: S3 by `breakout-pullback.ts:132-135`, S5
because visibility and sizing share `quality`.

**Legal state combinations, enumerated** — the review asked for this, and an
enumeration is the answer to "can a candidate end up somewhere nonsensical":

| validity | feasibility | D1a | actionability | legal? |
|---|---|---|---|---|
| `BROKEN` / `NOT_A_SETUP` | — | `HIDDEN` | — | yes |
| `VALID` | `NOT_FEASIBLE_*` | `HIDDEN` | — | yes — nothing to act on |
| `VALID` | `FEASIBLE*` | `SHOWN` | `WATCH_ONLY` | yes — budget is zero or exhausted |
| `VALID` | `FEASIBLE*` | `SHOWN` | `ACTIONABLE` | yes |
| invalid | any | `SHOWN` | any | **impossible** — D1a reads validity |

The combination the review feared, *surfaced but structurally invalid*, is
unreachable by construction: D1a's only inputs are validity and feasibility.

---

## §10 Migration — staged, shadowed, not implemented

**Revised after review.** M1–M6 build a **parallel decision path**. Production
keeps the legacy path throughout, so no stage can change live behaviour by
accident; M7 is the first point where the two are compared.

| stage | change | testable by | expected drift vs legacy |
|---|---|---|---|
| **M1** | emit current decisions as separate observable fields, computed exactly as today. Fields not yet separately computed are emitted as `NOT_YET_SEPARATED`, **never as an invented value** | output-shape tests | **zero, byte-identical** |
| **M2** | visibility reads its own contract; `quality` removed from surfacing | I2, I10 | **intended and quantified** — see below |
| **M3** | feasibility split from validity | R6, S3, I11 | **counts change, trades do not** |
| **M4** | sizing reads structural risk and budget only; the A/B multiplier removed | I5, S5 | sizes change |
| **M5** | ranking contract asserted (already satisfied) | I1, I9b | zero |
| **M6** | D0 and D5 separated; stance composed from budget and counts | fixed-arity check | zero if M2–M4 shadowed |
| **M7** | **only now** a V1-vs-V2 comparison | phase 13 §12.1 metric discipline — risk-weighted, never unweighted mean R | this is the measurement |

### M2 changes the surfaced set by design, and the size is known

The review called this a violation of "no production change". It is not — this
phase changes no code, and M2 is future work whose *entire purpose* is removing a
filter phase 14.5 found unjustified. But it must be stated in advance rather than
discovered:

> Removing the `quality` filter under `WARNING` surfaces the tier-B setups it
> hides — **153 of 574 resolved setups**, a **66% increase** in surfaced
> candidates within that state.

The review's proposed remedy — introduce a `LiquidityNoise` primitive mapping
exactly to `volRatio >= 1.5` so the surfaced sets stay equivalent — is
**rejected**, and the review's own findings say why: its vector-3 answer states
the design cannot be accused of disguising a replacement label because none is
designed. Re-introducing the identical cutoff under a new name is precisely that
disguised replacement, and it would preserve a filter for which no evidence
exists. §3 and §15 both forbid it.

### M3 changes counts, and the review is right that it can reach further

A setup rejected today for a too-tight stop becomes `VALID` + `NOT_FEASIBLE`. No
trade changes — an infeasible setup is still not traded — but every funnel number
does, **and the legacy stance reads candidate counts**
(`run-daily-scan-job.ts:340`). So M3 would move the stance through the count
channel.

That is exactly why M1–M6 are shadowed: **the legacy stance keeps reading legacy
counts until M6 switches the whole path atomically.** Without the shadow, M3 would
silently change live behaviour through a channel nobody was looking at.

## §11 Falsification gates

Each must pass before the next stage is built. A failure stops the expansion; it
does not license a workaround.

| gate | question | fails if |
|---|---|---|
| **F1** | can visibility be separated without changing Gate 2 validity? | the surfaced set after M2 differs from M1 for any reason other than the removal of the `quality` filter |
| **F2** | can sizing run without reading `quality`? | any sizing path still requires a tier, or the removal changes a stop |
| **F3** | can ranking run without affecting feasibility? | **already passes in V1** — `rankScore` gates nothing |
| **F4** | can the stance be composed from independent decisions? | the stance cannot be produced without reading an individual candidate's label |

F3 is worth stating as already-passing: it is the existence proof that this
decomposition is achievable, because one of the five decisions is already built
the way all five should be.

---

## §12 Metric discipline

**No profitability claim is made or implied anywhere in this phase.** No
continuation rate is compared, no R:R is computed, no P&L appears. The only
measurements taken are structural: the divergence between two primitives (22.5%
disagreement at a shared cutoff), the MA20 exception rate (0.7%), and weights read
from configuration.

This decomposition is judged on semantic separation, dependency correctness,
observability, falsifiability and migration feasibility — and on nothing else. It
is **not** an argument that the strategy works. Phases 8–14.5 established that it
does not, on the evidence available, and nothing here revisits that.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 15 attack vectors. Opening
line: *"The design is fatally flawed, rife with semantic contradictions, and
actively violates its own acceptance scenarios."*

**Four it could not refute:** disguised quality replacement, ranking leaking into
validity, observability gaps, and — its own words — that the architecture is not
too complex to falsify.

**Six findings are adopted and have changed the design. One is rejected, and the
review's own answers say why.**

## Adopted — the design changed

| # | finding | change |
|---|---|---|
| 2 | D1 reading "whether a budget exists" violates S5 | **D1 now outputs `SHOWN` \| `HIDDEN` only.** Actionability is a separate field. The budget can never change who is shown |
| 1 / 4 | stance at the end of the pipeline reads as a cycle and as a relocated god-object | **D0 (budget) split from D5 (stance label).** The budget is computed first and is the gate; the stance names what it already did. Input arity fixed at three |
| 5 | banning the label does not ban the primitives; D4 never forbade them | **I9b added** — a primitive may enter a scoring function through exactly one term, and the fan-out manifest covers scoring weights |
| 6 | M3 changes the population the legacy stance counts | **M1–M6 are now a shadow pipeline**; production keeps the legacy path until M7 |
| 7 | I6–I8 are existential claims, not invariants; grep cannot enforce I10 | **Reclassified as reachability requirements R6–R8**; I9/I10 are now **enforced by narrowed DTO types**, so reading a banned field is a compile error |
| 8 | D2 reading the budget breaks "the market enters once", and makes feasibility order-dependent | **D2 is structural only.** `NOT_FEASIBLE_CAPACITY` moved to D3. New invariant I11: D2 is order-independent |

Finding 10 — that a retained `quality` is one mistake from leaking back — is
answered by the same narrowed-DTO mechanism: `quality` is absent from the types
D1–D5 receive, and reaches only the reporting tier.

Finding 9 asked for an enumeration of legal states; §9 now has one, and it shows
the combination the review feared (*surfaced but structurally invalid*) is
unreachable because D1a's only inputs are validity and feasibility.

## Rejected — and the review contradicts itself here

Finding 3, rated CRITICAL: removing `quality` from surfacing changes behaviour, so
M2 must *"introduce an explicit `LiquidityNoise` primitive mapping strictly to the
legacy `volRatio >= 1.5` logic"* to preserve equivalence.

Two problems.

**It is the disguised replacement the review itself says the design avoids.** Its
answer to vector 3 reads: *"I could not refute this because the proposal
explicitly dictates 'no replacement label is designed.'"* The remedy proposed
under finding 3 is a replacement label with a new name and an identical cutoff.
Both cannot stand.

**And the cutoff it would preserve is the one with no evidence behind it.** Phase
14.5 measured `volRatio ≥ 1.5` at 32.54% continuation against 36.21% below it, and
found no stratum where the A/B split separates outcomes. Preserving mathematical
equivalence with an unjustified filter is not conservatism; it is freezing the
defect the decomposition exists to expose.

What the finding is right about, and what the document now says explicitly:
**M2's drift is intended and is quantified in advance** — 153 additional surfaced
setups under `WARNING`, a 66% increase in that state.

## Partly refuted — the circularity

Finding 1 asserts *"In any trading architecture, the aggregate Stance governs the
market risk budget"*, producing stance → budget → visibility → counts → stance.

**That premise is the reviewer's, not this design's.** Here the budget comes from
market state, and the first draft already stated the stance is *"a consequence of
the budget, never an input to it"*. The graph was acyclic.

But the criticism identified a real defect in how it was presented: a diagram with
`ACTION / STANCE` at the terminus invites exactly that reading, and one concept
was carrying two jobs under one name. The D0/D5 split is adopted because the
reviewer was right about the ambiguity even though wrong about the cycle.

---

## §14 Verdict after review: `DECISION COUPLING DECOMPOSITION READY`

Retained, on a design that six findings improved.

| §14 requirement | met? |
|---|---|
| all decision contracts independent | yes — D0, D1a, D1b, D2, D3, D4, D5, each with an explicit may-not-read list enforced by type |
| no hidden `quality` authority | yes — reporting-only, and absent from the DTOs D1–D5 receive |
| `volRatio` fan-out documented | yes — nine paths classified, two primitives measured at 22.5% disagreement, the 0.47 triple path quantified |
| invariants testable | yes — eleven invariants with a stated test, three reachability requirements separated out |
| staged migration possible | yes — seven stages, shadowed, with expected drift stated per stage |

**What this verdict is not.** It is a statement that the scanner *can* be
decomposed, not that decomposing it will make money. Phases 8 through 14.5
established that the strategy does not have a demonstrable edge on the evidence
available, and nothing here revisits that. The value of the decomposition is that
**the next thing to fail will say which decision failed** — which is the one thing
fifteen phases of measurement could never extract from V1.
