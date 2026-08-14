# Strategy V2 — risk-budgeted participation

**Date:** 2026-08-14 · Phase 13 §1–§14 · Design only, from commit `9738e69`
**Companion:** [`STRATEGY-V2-ARCHITECTURE-AUDIT.md`](STRATEGY-V2-ARCHITECTURE-AUDIT.md)

**No implementation. No thresholds. No backtest. V1 is untouched and remains the
control.**

---

## 0. What this design does and does not claim

Read this section before the diagrams, because everything after it depends on it.

**V2 does not claim an edge, and it cannot create one.** Eleven phases established
that P(continuation) fell to 27.1%; at the 2:1 structure that is −0.18 ATR per
trade. **No sizing scheme turns a negative expectancy positive** — it changes the
variance and the path, not the sign. Anyone who reads a risk ladder as a fix for
a losing edge has misread it.

What V2 does is narrower, and it is the only thing this evidence supports doing:

> **It makes the strategy falsifiable in parts.** V1 answers "trade or not" with a
> single conflated variable, so when it fails there is nothing to attribute the
> failure to. V2 separates the market question from the stock question from the
> size question, so that each can be tested, and each can be found wrong on its
> own.

Three specific things follow, none of which is a profitability claim:

1. **The permission gate V2 removes is not one the evidence supports keeping.**
   The Gate 1 audit found `PASS` performing *worse* than `WARNING` on the same
   tier, recorded in the source at [`gate1-market.ts:46-64`](../../../src/lib/playbook/gate1-market.ts).
   Replacing a hard filter with a graded budget weakens an unsupported claim
   rather than strengthening a new one.
2. **Sizing is the one lever eleven phases never pulled.** They all tried to raise
   the hit rate and failed. The mapping from outcome to capital was never varied
   because V1 has no such mapping.
3. **The paradox is representational, not statistical.** "Wait for confirmation
   and the entry is late; enter early and market risk is high" is unanswerable in
   V1 because a surfaced candidate has no size field — it is a trade or it is
   invisible. That is a type-system limitation and it can be fixed without any new
   predictive claim.

**The honest failure mode is explicit:** if the eventual replay shows continuation
in probe-eligible states is also ~27%, V2's verdict is *abandon* — reached faster
and with the mechanism attributable, which V1 could never deliver.

---

## 1. V1 architecture, in one line

```
market → PASS/WARNING/FAIL → candidate list filter → trade (unsized) or nothing
```

Full detail and line references are in the audit. Its seven failure modes (F1–F7)
are the design constraints for what follows.

## 2. V2 architecture, in one line

```
market → market STATE → RISK BUDGET ─┐
                                     ├→ ACTION + SIZE CLASS
stock  → stock GRADE  → SETUP + STOP ─┘        bounded by PORTFOLIO OPEN RISK
```

Three questions, three answers, never one variable answering two:

| § | question | answered by | may **not** be answered by |
|---|---|---|---|
| A | is a long absolutely forbidden right now? | market state = `RISK_OFF` | anything stock-level |
| B | how much portfolio risk may be at work? | risk ladder rung + open-risk ceiling | stock grade |
| C | which stock deserves risk from that budget? | stock grade + setup validity + stop feasibility | market state |

`quality: "A" | "B"` is retired as a cross-cutting variable. It survives only as
one input to the stock grade, where it belongs.

---

## 3. Market state machine

### 3.1 Reuse, not reinvention

The market axis is built from the **already-frozen two-axis classifier** in
[`src/lib/research/market-regime.ts`](../../../src/lib/research/market-regime.ts)
(committed at `5699c69`, before any outcome was read): cap-weighted index against
its MA50 × equal-weighted breadth against a 50% majority. V2 adds the one thing
that classifier lacks and V1 lacks even more completely —

> **direction of travel.** V1's market model is a pure function of the last 50
> closes and cannot tell "first day above MA50 after a three-month decline" from
> "fortieth day of an advance" (failure mode F7).

Run lengths and transitions are already computed by `toRuns()` and
`transitionStats()` in the same module. V2 consumes them; it does not add a
second ontology beside the frozen one.

### 3.2 The six states

Level is not enough and direction is not enough; the state is the pair.

| state | meaning | posture |
|---|---|---|
| **`RISK_OFF`** | both axes weak, not repairing | capital preservation — no new long risk at any size |
| **`EARLY_RECOVERY`** | repair visible, unconfirmed, short-lived so far | observe and probe; the false-dawn case lives here |
| **`RECOVERY`** | repair has persisted; participation broadening | participation rises with the budget |
| **`BROAD_ADVANCE`** | index and breadth both constructive | normal participation |
| **`EXTENDED`** | advance intact but stretched, or carried by few names | do **not** automatically add risk; this is where V1's momentum clause bites |
| **`DETERIORATING`** | was advancing, participation now breaking down | freeze new risk, reduce existing |

Mapping to the frozen classifier — conceptual, no cutoffs:

| frozen regime | direction | V2 state |
|---|---|---|
| `SYSTEMIC_WEAKNESS` | flat or worsening | `RISK_OFF` |
| `SYSTEMIC_WEAKNESS` / `RECOVERY_UNDERNEATH` | improving, short run | `EARLY_RECOVERY` |
| `RECOVERY_UNDERNEATH` | improving, sustained run | `RECOVERY` |
| `BROAD_ADVANCE` | not stretched | `BROAD_ADVANCE` |
| `BROAD_ADVANCE` / `NARROW_RALLY` | stretched | `EXTENDED` |
| any constructive regime | breadth turning down | `DETERIORATING` |

`NARROW_RALLY` — index up, majority of stocks down — lands in `EXTENDED` or
`DETERIORATING`, never in `BROAD_ADVANCE`. That is the 2022 diagnostic expressed
as a state rather than as a footnote.

**The breadth axis carries a survivorship limitation that the design cannot fix
and must therefore declare.** Phase 12 measured it: of the 355 symbols with bars,
**only three are absent from today's listing**, so the historical cross-section is
very nearly "companies still listed in 2026". Membership is resolved point-in-time
from bar evidence, so a symbol never enters before it had bars — but companies that
were deregistered were never fetched at all, and no available source restores them.

Two consequences, both binding on Phase 14 rather than on this design:

- historical breadth is computed on a survivor cross-section and is therefore
  **biased upward**, most in exactly the periods where breadth collapsed;
- any V2 result that depends on the breadth axis inherits that bias, and must
  report it rather than treat the axis as clean.

Abandoning breadth is not the answer — it is the axis that separates
`NARROW_RALLY` from `BROAD_ADVANCE`, which is the single most useful distinction
the frozen classifier makes. Declaring the bias is.

**"Short run", "sustained", "stretched" and "turning down" are named unknowns.**
They are listed in §13 and must be frozen in Phase 14 before any replay.

### 3.3 Transitions

```
        ┌──────────────────────── false dawn ───────────────────────┐
        │                                                           │
        ▼                                                           │
   RISK_OFF ──→ EARLY_RECOVERY ──→ RECOVERY ──→ BROAD_ADVANCE ──→ EXTENDED
        ▲              │                │              │              │
        │              └────────────────┴──────────────┴──────────────┤
        │                                                             ▼
        └────────────────────────────────────────────────── DETERIORATING
```

Required properties, all of them architectural rather than numeric:

- **`EARLY_RECOVERY → RISK_OFF` is a first-class edge**, not an exception. False
  dawns are the modal outcome of early recovery and the diagram must say so.
- **Every constructive state has an edge to `DETERIORATING`.** Deterioration is
  not reached by walking back down the ladder one rung at a time.
- **Downgrades may skip rungs; upgrades may not.** Risk can be withdrawn faster
  than it is granted. This asymmetry is deliberate and is not a tunable.
- **The state is a function of information at T only.** No transition may consult
  a bar after the session it is dated.

---

## 4. Stock state machine

Independent of the market. A stock is graded on its own evidence, and the grade
is identical in `RISK_OFF` and in `BROAD_ADVANCE` — only what the grade *buys*
differs.

```
NOT_A_SETUP ──→ FORMING ──→ VALID ──→ ACTIONABLE
                   ▲          │            │
                   └──────────┴────────────┘   (structure degrades)
                              │
                              └──→ BROKEN
```

| stock state | meaning |
|---|---|
| `NOT_A_SETUP` | no breakout-pullback structure present |
| `FORMING` | breakout present, digestion incomplete |
| `VALID` | the full Gate 2 structure holds; a structural stop exists |
| `ACTIONABLE` | `VALID` **and** price is in a location where an entry can be placed |
| `BROKEN` | structure violated — the thesis for this instance is dead |

Grade axes, kept separate and reported separately (never summed into one score
in this phase — a composite is a threshold in disguise):

- relative strength versus the cross-section
- participation (the volume behaviour that today produces the A/B label)
- pullback geometry — depth, location within the zone, extension above breakout
- liquidity and executable size
- structural stop distance in ATR units

**Constraint that fixes failure mode F4:** the stock axis may use the stock's own
moving averages. It may **not** read the index. The market axis may read the index
and the cross-section. It may **not** read any individual candidate. Any variable
appearing on both axes is a design defect and must be assigned to one.

**One coupling survives that rule and must be declared rather than denied.** The
breadth axis is "percent of the eligible universe above its own MA50" — an
aggregate of the same per-stock trend test the stock axis uses, and every `VALID`
candidate is above its MA50 by construction. So a candidate contributes to the
breadth that budgets it, at weight 1/N with N in the hundreds.

This is not fixable by excluding the candidate from the breadth calculation:
that would make the market state candidate-dependent, which breaks the separation
more seriously than the 1/N leak does. **Any breadth measure built from stock
trends has this property.** The design's obligation is to report the dependence,
not to claim orthogonality it does not have — and to make sure the *strong* form
of the leak (the index appearing directly in a stock grade, or a candidate's own
score appearing in the market state) is prohibited, which it is.

---

## 5. Position state machine

The third machine, independent of both.

```
CANDIDATE ──→ PROBE ──→ CONFIRMED ──→ FULL
    │           │           │           │
    │           ▼           ▼           ▼
    └───────→ EXIT ←──── REDUCED ←──────┘
```

| position state | meaning |
|---|---|
| `CANDIDATE` | surfaced and explained; no capital committed |
| `PROBE` | a deliberately small commitment made **before** confirmation is complete |
| `CONFIRMED` | the probe's thesis has been supported by evidence not available at probe time |
| `FULL` | risk at the rung the market budget allows |
| `REDUCED` | risk deliberately cut — by market downgrade, budget pressure, or structure weakening |
| `EXIT` | flat |

### 5.1 What a probe means

> *I accept paying a small, bounded risk to hold a position before market
> confirmation is complete, because the cost of being late is real and the cost of
> being early is bounded by the size.*

The probe is **not** a cheap full position and **not** a first tranche of a
planned pyramid. Its risk is bounded at entry and never increased on adverse
movement.

### 5.2 The averaging-down prohibition

Architectural, absolute, not a parameter:

> **Size may increase only when the structural stop has been raised and price is
> above the probe's entry.** A `PROBE → CONFIRMED → FULL` progression that adds
> risk while price is below the probe entry, or while the structural stop is
> unchanged, is forbidden by construction.

Adding to a losing position is how "probe then scale" strategies fail, and the
prohibition belongs in the type system, not in a discipline rule.

**The obvious way around it must be closed at the same time.** A rule stated over
one position record is evaded by opening a *second* position in the same symbol
while the first is underwater — the same averaging-down, spelled differently. So:

> **At most one open position per symbol.** A new setup in a symbol that already
> holds risk is an *add* to that position and is subject to the rule above, never
> a new position with its own allowance.

Without this, the risk budget is also evaded: one symbol could hold several
"independent" allocations.

### 5.3 Confirmation — what it may and may not be

Confirmation may **not** be "the index finally crossed its MA50". That reads the
same variable that granted the probe and makes the sequence circular — the probe
was granted *because* the market was recovering, so confirming on further market
recovery confirms nothing about the position.

Confirmation is a conjunction of one sufficient condition and two vetoes:

| role | condition |
|---|---|
| **sufficient evidence** | the **stock** followed through in its own risk units — it moved in the direction of the thesis by an amount measured against its own structural risk, not against the index |
| **veto** | the structure still holds: the structural stop is unbreached and the pullback floor is intact |
| **veto** | the market state has not stepped **down** the ladder since the probe |

The granting predicate (state *is* `EARLY_RECOVERY`) and the vetoing predicate
(state *has not stepped down*) are different predicates over the same variable,
which is what keeps this from being circular. The evidence that promotes is
stock-level and was unavailable at probe time.

**"Followed through by an amount" is a named unknown** (§13).

### 5.4 Position states are independent of market states

A market downgrade does not force a position transition, and a position exit does
not change the market state. The two machines are coupled in exactly one place:
**the market budget bounds aggregate open risk**, and a budget contraction can
force `FULL → REDUCED`. Everything else is independent.

`PROBE → EXIT` directly, without waiting for a market-state change, is a
first-class path.

---

## 6. Risk ladder

**Ordering only. No numbers are chosen in this phase, and choosing one here would
be the parameter mining the phase exists to avoid.**

| market state | rung |
|---|---|
| `RISK_OFF` | `NONE` |
| `EARLY_RECOVERY` | `PROBE` |
| `RECOVERY` | `PARTIAL` |
| `BROAD_ADVANCE` | `NORMAL` |
| `EXTENDED` | `NORMAL` or `PARTIAL`, decided by **stock geometry**, never by the market |
| `DETERIORATING` | `REDUCE` — no new risk; existing risk trimmed |

The only relation asserted:

```
NONE  <  PROBE  <  PARTIAL  <  NORMAL
```

and `REDUCE` grants no new risk regardless of where it sits between them.

`EXTENDED` is the one rung where the stock axis modulates the market rung. That
is deliberate, and it is the design's answer to acceptance scenario B: a market
that has just turned constructive is not a reason to buy a stock whose entry is
already extended. It is also the only place the two axes interact, which keeps the
interaction auditable.

---

## 7. Portfolio risk budget

V1 caps **notional**; it never sums risk (audit, failure mode F6). V2 makes the
binding constraint a risk constraint:

```
MARKET_RISK_BUDGET  =  rung(market state) × equity        ← the ladder, in currency

INVARIANT:   Σ over open positions of ( risk-at-stop )  ≤  MARKET_RISK_BUDGET
```

Consequences that follow without any number being chosen:

- **Ten probes cannot become a full position.** They draw from the same budget,
  so the tenth is refused or shrunk. This is the specific leak §9 of the brief
  names, and it is closed by making the budget a stock of risk rather than a
  per-trade allowance.
- **A budget contraction is a real event.** When the market steps down and open
  risk exceeds the new budget, something must give. **What gives is an unknown**
  (§13) — forced reduction sells into weakness and has its own cost; waiting for
  natural decay leaves the invariant violated for a while. This design does not
  pretend to have resolved it.
- **The invariant is an arithmetic bound, not a risk bound, and correlation needs
  its own structural answer.** Ten simultaneous probes in one sector are not ten
  independent risks: in a shock their correlation goes to 1 and the realised loss
  is the full sum, whatever the budget arithmetic said. Naming a "correlation
  haircut" as a future parameter is not sufficient, because a haircut is a number
  and the defence has to be structural. So the architecture requires, as design
  and not as parameter:

  > **A concentration constraint alongside the budget invariant.** Open risk
  > within a correlation group is capped independently of total open risk, and a
  > position that would breach the group cap is refused or shrunk even when the
  > total budget has room.

  What defines a group (sector, or a measured co-movement cluster) and how tight
  the cap is are unknowns (§13). **That the constraint exists is not.** A V2 with
  only the total-budget invariant would satisfy its own arithmetic while holding
  ten copies of one bet.

- **The invariant bounds *planned* risk, not *realized* loss.** Risk-at-stop
  assumes the stop fills at the stop. A gap through it — routine in a market with
  daily price limits, where a limit-down session can leave no fill at all — loses
  more than the budget said. **The invariant is therefore a ceiling on intent, not
  a guarantee**, and any V2 that presents it as a loss cap is lying. Whether the
  budget carries a gap haircut, and how large, is an unknown (§13).

`openRiskVnd` already exists at
[`portfolio-service.ts:39`](../../../src/lib/paper-lab/portfolio/portfolio-service.ts).
V2 promotes it from a displayed number to a binding one.

---

## 8. Stop architecture

The audit's failure mode F3 is that trade feasibility currently kills setup
validity. V2 separates them into two layers that produce two independent outputs.

### 8.1 Layer 1 — structural stop

> The price at which the thesis is wrong.

Derived from structure alone, and — this matters for the look-ahead question —
**strictly causally**: the running minimum low over the closed backward window
from the breakout bar to the evaluation bar, less a fixed cushion. That is
`minLowInRange(sorted, tB, L) × (1 − 0.01)` at
[`breakout-pullback.ts:333, 363`](../../../src/lib/scanner/gate2/breakout-pullback.ts).

It is **not** a pivot-confirmed swing low. A pivot needs subsequent bars to
confirm it and would be look-ahead; a running minimum over bars already seen
needs nothing after T. V2 reuses this definition unchanged, and the word "swing"
should be avoided when describing it because it invites exactly that confusion.

The **cushion is a frozen V1 constant** (`GATE2_STOP_BUFFER_FRAC = 0.01`). It is
inherited at that value and placed on the do-not-tune list (§13), because a
cushion that can be widened is a lever for pushing a stop from
`NOT_FEASIBLE_NOISE` into `FEASIBLE` — rescuing rejected setups by curve-fitting
the one number that decides the rejection.

**The structural stop may never be moved to improve R:R, to fit a risk budget, or
to make a rejected setup pass.** If it is far, the thesis is expensive to test —
that is information, not a problem to engineer away.

### 8.2 Layer 2 — execution feasibility

Given a structural stop, three separate questions:

| check | question | verdict on failure |
|---|---|---|
| **noise floor** | is the stop far enough to survive ordinary movement, spread and cost? | `NOT_FEASIBLE_NOISE` |
| **capacity** | does the budget afford at least one tradable lot at this stop distance? | `NOT_FEASIBLE_CAPACITY` |
| **liquidity** | can that size be traded without moving the market? | `FEASIBLE_AT_REDUCED_SIZE` or `NOT_FEASIBLE_LIQUIDITY` |

The noise floor already exists as
[`stop-feasibility.ts`](../../../src/lib/scanner/stop-feasibility.ts) —
`max(tick, fee, volatility)`, with coefficients derived from market mechanics
rather than fitted. **V2 reuses it unchanged and selects no new coefficient.**

The two outputs are now orthogonal:

```
setup validity      ∈ { NOT_A_SETUP, FORMING, VALID, ACTIONABLE, BROKEN }
trade feasibility   ∈ { FEASIBLE, FEASIBLE_AT_REDUCED_SIZE,
                        NOT_FEASIBLE_NOISE, NOT_FEASIBLE_CAPACITY,
                        NOT_FEASIBLE_LIQUIDITY }
```

A setup can be `VALID` and `NOT_FEASIBLE_NOISE`. Today that combination is
reported as `INVALID`, which destroys the information that the pattern was sound.

**Asymmetry worth stating:** a stop that is too *close* cannot be fixed by sizing —
noise will hit it whatever the size — so it is a hard refusal. A stop that is too
*far* is only a capacity question, and shrinks the size until it cannot. V1 has a
floor and no ceiling; V2 needs neither a ceiling nor a new constant, because the
budget provides the ceiling automatically.

---

## 9. R:R semantics

**R:R is an output, never an input.**

```
risk    = entry − structural stop          (given by structure)
reward  = whatever continuation delivers   (not chosen)
R:R     = a consequence, reported after the fact
```

Forbidden: setting a target at 2R and then designing backwards to it. V1's replay
did exactly that — the 2:1 exit *defined* the outcome label, so "expectancy at
2:1" measures the exit rule as much as the setup. **V2 must not inherit that as a
hidden constant**; the exit rule is a named unknown (§13), not an assumption.

Three quantities that V1 blurs and V2 keeps apart:

| quantity | what it is | who sets it |
|---|---|---|
| **expected R** | unknown, and this project has never estimated it honestly | nobody — it is not an input |
| **realized R** | measured after exit | the market |
| **position size** | risk currency ÷ stop distance | the budget |

The load-bearing consequence: **a setup with a distant stop is not more dangerous
than one with a tight stop.** Risk in currency is bounded by the budget; the stop
distance only decides how many shares that currency buys. V1 cannot express this
because it has no per-candidate size, which is why a wide stop currently looks
like a normal trade and a tight stop looks like an invalid one.

---

## 10. Observability contract

Every decision must be reconstructable from its own record. Contract only — no UI,
no implementation.

```
DecisionRecord {
  sessionDate

  market {
    state           : RISK_OFF | EARLY_RECOVERY | RECOVERY |
                      BROAD_ADVANCE | EXTENDED | DETERIORATING
    frozenRegime    : BROAD_ADVANCE | NARROW_RALLY |
                      RECOVERY_UNDERNEATH | SYSTEMIC_WEAKNESS
    direction       : IMPROVING | STABLE | WORSENING
    rung            : NONE | PROBE | PARTIAL | NORMAL | REDUCE
    budgetUsedFrac  : Σ open risk ÷ market risk budget
  }

  stock {
    state           : NOT_A_SETUP | FORMING | VALID | ACTIONABLE | BROKEN
    grades          : { relativeStrength, participation, geometry,
                        liquidity, stopDistanceAtr }   ← reported separately
  }

  stop {
    structural      : price level
    structuralBasis : which swing low, which cushion
    feasibility     : FEASIBLE | FEASIBLE_AT_REDUCED_SIZE |
                      NOT_FEASIBLE_NOISE | NOT_FEASIBLE_CAPACITY |
                      NOT_FEASIBLE_LIQUIDITY
    bindingFloor    : tick | fee | volatility | none
  }

  action            : NO_ACTION | WATCH_ONLY | PROBE_ELIGIBLE |
                      ENTRY_ELIGIBLE | ADD_ELIGIBLE | REDUCE | EXIT
  sizeClass         : NONE | PROBE | PARTIAL | NORMAL

  reasons           : ordered, machine-readable codes
  refusals          : every check that failed, with its code
}
```

Three rules that make this contract worth having:

- **`refusals` is mandatory even when the action is positive.** "What nearly
  stopped this" is the field that makes a design falsifiable.
- **Every field must be derivable from information at or before `sessionDate`.**
  The point-in-time guard already enforces this for V1's inputs and extends to
  these without change.
- **`budgetUsedFrac` requires a deterministic allocation order.** When several
  candidates fire on one session, the budget left for the third depends on
  whether the first two were funded. The record is therefore taken **at the
  candidate's position in a deterministic queue**, and the ordering rule (rank
  order is the obvious inherited candidate) is preregistered rather than left to
  whatever order the loop happens to run in. Without this the field is not
  reproducible, and a replay and production would disagree on the same session.

V1 already emits enumerated rejection codes
([`rejection-codes.ts`](../../../src/lib/scanner/gate2/rejection-codes.ts)) and a
decomposed rank breakdown, so this contract is an extension of an existing habit,
not a new burden.

### 10.1 Three state machines is not 180 states

The obvious objection: 6 market × 5 stock × 6 position = 180 combinations, which
would be untestable and unfalsifiable. The product is not the testable surface.

| what is actually tested | size |
|---|---|
| **surfacing function** — (market state, stock state) → action + size class | 6 × 5 = **30 inputs**, 7 possible actions |
| **feasibility function** — (structural stop, budget, liquidity) → verdict | 5 verdicts, independent of both state machines |
| **position transitions** — reachable only from `ACTIONABLE`, and each edge has one guard | **6 edges**, not 30 |
| **market transitions** — the diagram in §3.3 | **9 edges** |

The position machine is not crossed with the other two: it is entered only after
an entry exists, and thereafter its transitions are driven by the position's own
evidence plus one coupling to the budget (§5.4). The surfacing table is 30 cells
and can be written out in full and inspected by hand — which is the honest test of
whether an architecture is falsifiable.

**The falsification test is stated in §14.6**: randomise the market state series
and the ladder. If a randomised ladder performs like the real one, the market axis
is decoration. An architecture that cannot fail that test is not worth building.

---

## 11. Acceptance scenarios

Per §13 of the brief these are **acceptance tests for the architecture's
expressiveness**, not evidence and not fitting targets. Neither stock is used to
choose anything.

### 11.1 Scenario A — strong stock, unconfirmed market

Index below its MA50 after a selloff. One stock: relative strength high, volume
confirming, breakout reclaimed, pullback holding structure, structural stop
executable.

| | V1 | V2 |
|---|---|---|
| Gate 1 / state | `FAIL` (bearish + falling) | `EARLY_RECOVERY` or `RISK_OFF` |
| candidate | **dropped — surfacing rule `none`** | surfaced |
| output | *no signal* | `PROBE_ELIGIBLE`, size class `PROBE` — or `WATCH_ONLY` with refusal `market_budget_zero` if the state is `RISK_OFF` |

The distinction V2 must be able to make, and V1 cannot:

> **`WATCH_ONLY` because the budget is zero** is not the same as **`NO SIGNAL`**.
> The first says "this stock is strong and I am choosing not to fund it"; the
> second says "there is nothing here". V1 can only say the second.

Note carefully: under `RISK_OFF`, V2 still funds **nothing**. Visibility is not
permission. Question A keeps its absolute veto.

### 11.2 Scenario B — confirmed market, extended stock

Index has just turned constructive; V1's Gate 1 has just flipped to `PASS`. The
stock's entry is already extended above its breakout.

| | V1 | V2 |
|---|---|---|
| Gate 1 / state | `PASS` → surfaces A and B | `BROAD_ADVANCE` or `EXTENDED` |
| market budget | *(none exists)* | `NORMAL` |
| stock | extended entry, poor location | grade: geometry weak |
| output | surfaced as a normal candidate | `NO_ACTION` / `WAIT`, refusal `entry_extended` |

**A high market budget is not a reason to buy.** The budget says how much risk may
be at work; it says nothing about whether this stock deserves any of it. V1
conflates these, which is why a freshly-passing market surfaces chasable entries —
and it is the same conflation that produces failure mode F5, where Gate 1 `PASS`
demands an extended index at the moment Gate 2 demands a pulled-back stock.

### 11.3 Invariant acceptance criteria — the ones that carry weight

Scenarios A and B test **expressiveness**: can the architecture represent a
distinction V1 collapses. They assert nothing about profitability and neither
stock is used to choose anything.

But two price-action vignettes are a weak acceptance suite, and designing to pass
them is a mild form of fitting to the past. The criteria below are **invariants**,
checkable on any replay without reference to any particular setup, and they are
the ones that should be treated as binding:

| # | invariant | violated if |
|---|---|---|
| I1 | Σ open risk-at-stop ≤ market risk budget, on every session | any session exceeds it |
| I2 | Σ open risk within a correlation group ≤ the group cap | any session exceeds it |
| I3 | no new long risk is opened in `RISK_OFF` | a single funded entry appears |
| I4 | position size never increases while price is below the probe entry | one occurrence |
| I5 | at most one open position per symbol | one occurrence |
| I6 | every action carries a non-empty `refusals` list and a reconstructable record | one missing record |
| I7 | no state, grade or transition reads a bar after its session date | the point-in-time guard reports any violation |
| I8 | the market state never reads an individual candidate; no stock grade reads the index | one occurrence |

I1–I8 can each fail. That is what makes them acceptance criteria rather than
description.

---

## 12. Migration boundaries

**V1 is frozen and stays frozen** (§12 of the brief). It is the control for the
eventual V1-vs-V2 comparison on one replay, and mutating it destroys that
comparison.

| rule | |
|---|---|
| no file under `src/lib/playbook/`, `src/lib/scanner/gate2/`, or `src/lib/scanner/trading-decision.ts` may be edited | V2 lives in new modules |
| V2 may **read** V1 primitives | bars, tradability, ATR, stop-feasibility, the frozen regime classifier |
| V2 may **not** re-tune anything it reads | reuse or replace wholesale; never adjust |
| the replay must run either architecture over identical inputs | one universe, one bar set, one point-in-time guard |
| both must emit the same outcome labels | otherwise the comparison measures the label, not the strategy |

The last row is the trap most likely to be walked into: if V2 changes the exit
rule *and* the entry architecture, a difference in results attributes to neither.
The exit rule must either be held identical to V1's or varied as a separate,
separately-preregistered arm.

### 12.1 The comparison metric must change, or the comparison is invalid

V1's headline expectancy is the **unweighted mean of per-trade R-multiples**
([`replay-metrics.ts:121-123`](../../../src/lib/replay/replay-metrics.ts)). That
statistic silently assumes every trade carries the same risk — true in V1, where
nothing is sized, and **false in V2 by construction**, where a probe carries less
risk than a full position.

So `mean(R)` cannot compare the two. A V2 that probes its losers small and sizes
its winners full would show a worse mean R while making more money, and one that
did the reverse would show a better mean R while losing.

The comparison must be made on a **risk-weighted** basis — Σ(Rᵢ × wᵢ) against the
risk actually deployed — or on the portfolio equity path with the budget invariant
enforced. **Which of the two, and how the equal-weight V1 baseline is expressed in
the same units, must be preregistered** (§14.5). Reporting V2 against V1 on
unweighted mean R would be a measurement error large enough to reverse the sign of
the conclusion.

---

## 13. Unknown parameters — nothing here is chosen

Every item is deliberately unresolved. Choosing any of them in this phase would
be parameter mining on the same dataset the brief forbids.

**The direction-of-travel estimator** — added after review, which correctly
observed that "direction" is a smuggled parameter unless its estimator is named
1a. the lookback over which direction is measured
1b. whether it is measured on the frozen regime label's run length, on the breadth
    series, on the index series, or on more than one
1c. what smoothing, if any, is applied before the direction is read
1d. the dead band that separates `IMPROVING` / `STABLE` / `WORSENING`

**Market state boundaries**
1. what makes a recovery run "short" versus "sustained" (`EARLY_RECOVERY` vs `RECOVERY`)
2. what makes an advance "stretched" (`BROAD_ADVANCE` vs `EXTENDED`)
3. what makes breadth "turning down" (constructive vs `DETERIORATING`)
4. whether `RISK_OFF` needs its own condition or is simply `SYSTEMIC_WEAKNESS` not improving
5. hysteresis — how much confirmation a state change needs before the budget moves

**Risk ladder**
6. the actual fractions behind `PROBE`, `PARTIAL`, `NORMAL`
7. whether `EXTENDED` maps to `NORMAL` or `PARTIAL`, and on which geometry input
8. the size of `REDUCE`

**Portfolio budget**
9. the correlation haircut — form and magnitude
10. what happens when a budget contraction leaves open risk above the new ceiling
11. whether probe risk counts against the budget at full weight
11b. the gap haircut, if any — how much beyond risk-at-stop the budget reserves

**Position lifecycle**
12. how much stock follow-through, in its own risk units, promotes `PROBE → CONFIRMED`
13. the maximum time a probe may stay unconfirmed before it is exited
14. whether `CONFIRMED → FULL` adds in one step or several

**Stock grade**
15. the grade axes' cut points, and whether grades stay separate or combine
16. whether the A/B participation label survives at all inside the grade

**Exit and outcome**
17. **the exit rule** — the largest unknown. V1's fixed 2:1 defined its own results
18. whether the structural stop trails, and on what structural event

**The exit rule is an unknown parameter, not an unknown *form*.** Leaving the form
open would hand an optimiser unlimited freedom to manufacture a favourable reward
distribution — the review's point, and a correct one. So the *class* is constrained
here, in the design, while the parameter stays open:

> The exit must be **structural or time-based**: a stop that moves only on
> structural events, and/or a fixed holding horizon. **A profit target chosen by
> searching over outcomes is prohibited**, and so is any exit whose parameter is
> selected by comparing realised returns across candidate values on this dataset.

A fixed R-multiple target is permitted **only** as an inherited constant held at
V1's value for comparability, never as a value to be chosen.

**Inherited from V1 and frozen — these are NOT unknowns and may not be re-tuned**

Listed here because a parameter that is neither declared open nor declared closed
is the easiest place to hide a fitted number:

- `GATE2_STOP_BUFFER_FRAC = 0.01` — the structural-stop cushion
- the noise floor coefficients in `stop-feasibility.ts` — `ROUND_TRIP_FEE_FRAC`,
  `MIN_STOP_TICKS`, `MIN_STOP_ATR_MULTIPLE`
- the tradability floors, the breakout-pullback geometry constants, and the
  breadth majority boundary of 50%

Re-tuning any of them converts V2 from a re-architecture into a parameter search
on the same dataset twelve phases have exhausted.

**Every unknown above must be frozen in writing before a single V2 replay runs.**

---

## 14. What must be preregistered before any replay

Phase 14 may not begin until this list is written down and committed:

1. **Every unknown in §13**, with the reasoning that chose it, written before any
   V2 outcome is read.
2. **The primary question**, stated as one hypothesis. The obvious candidate:
   *does the setup population that V1 discards — strong stocks in non-`PASS`
   markets — have a continuation rate different from the population V1 keeps?*
   That is a **selection** question and it is the only claim V2 makes that could
   change expectancy.
3. **The inference plan**, inherited unchanged from the corrections eleven phases
   paid for: statistics on quarter and month aggregates, permutation across whole
   clusters, symbol not treated as a cluster level (measured ICC 0.0000),
   estimators recalibrated before results are read.
4. **The power calculation, before the run.** The V2 population is larger than
   V1's by construction, since it stops discarding candidates. How much larger,
   and what that buys in minimum detectable effect, must be computed first.
5. **The comparison design** — V1 and V2 over identical inputs, with the exit rule
   either held constant or varied as its own preregistered arm.
6. **The negative controls** — permuted market states, shuffled ladder rungs, a
   placebo state series. If a randomised ladder performs like the real one, the
   market axis is decoration and must be reported as such.
7. **The abandonment criterion, written first.** What result would say the
   breakout-pullback template should be dropped rather than re-architected. Twelve
   phases have not yet written one down, and that is why the question keeps
   getting asked again in a different form.

### 14.1 Staged build order — the answer to "too complex to falsify"

The strongest objection to this architecture is that with three state machines and
eighteen unknowns, **any failure can be blamed on a different component** — "the
edge is fine, the probe promotion criteria strangled it" — which makes refutation
impossible. That objection is correct about a V2 built all at once, so V2 must not
be built all at once.

Each stage is separately falsifiable and **gated on the one before it**. A failure
at stage N cannot be blamed on stage N+1, because stage N+1 does not exist yet.

| stage | question | what exists | what a failure means |
|---|---|---|---|
| **S1** | does the population V1 **discards** — strong stocks in non-`PASS` markets — continue at a different rate from the population V1 keeps? | surfacing only. No ladder, no probe, no sizing, no position machine. | **Abandon.** If the discarded population is no better, every later stage is irrelevant, because the ladder can only redistribute capital across a population that does not pay. |
| **S2** | does budgeting by market state beat a randomised ladder over the same population? | the ladder and the budget invariant | the market axis is decoration; keep the surfacing change, drop the ladder |
| **S3** | does the probe lifecycle beat entering at full size or not at all? | the position machine | probes are a cost, not an option; drop them |
| **S4** | do the concentration and gap constraints change the equity path materially? | I1–I2 tightened | they are ceremony; simplify |

**S1 is the whole strategy question and it needs none of the machinery.** It is a
selection test on a population, answerable with the inference apparatus twelve
phases already built. Everything else in this document exists only if S1 survives.

That ordering is also the honest reply to the suggestion that V2 should be
stripped down and the "naked edge" tested in isolation instead. The naked edge on
the population V1 *keeps* has already been tested to exhaustion — that is the
−0.18 ATR the last five phases kept re-measuring. S1 tests the naked edge on the
population V1 **throws away**, which is the one part that has never been measured
at all.

---

## 15. Does this solve the paradox?

> *"Waiting for market confirmation makes the entry late; entering early leaves
> market risk high."*

**As a representation problem, yes.** V1 cannot express "seen but not funded"
because a surfaced candidate has no size — it is a trade or it is invisible.
Separating the signal from the size makes the middle position expressible:
`WATCH_ONLY`, `PROBE_ELIGIBLE`, `ENTRY_ELIGIBLE` are distinct outputs with
distinct capital consequences.

**As an economic problem, unproven and possibly not.** If continuation in
probe-eligible states is the same 27%, then probing early loses money more slowly
than trading early and that is all. The architecture makes the question askable;
it does not answer it, and §0 should be re-read by anyone who thinks it does.

What can be said without evidence: the goal is not to buy more. It is that **a
strong stock may be seen early, while the capital permitted to back it depends on
how far the market has confirmed** — and that if this still does not work, the
next phase will be able to say which of the three questions was wrong.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 15 attack vectors. It could
not refute two: **circular confirmation** (vector 4) and **probe averaging-down**
(vector 6), calling the probe rule "mathematically sufficient".

Of the rest: **two are refuted against the source**, **seven are upheld and have
changed this document**, and **two are rejected on substance**.

## Refuted against the source — the structural stop is not look-ahead

The review rated this HIGH: *"A true swing low can only be confirmed
retrospectively… If the architecture relies on identifying a confirmed swing low
at the exact moment of entry, it introduces look-ahead bias."*

The stop is not a confirmed swing low. It is
`minLowInRange(sorted, tB, L) × (1 − 0.01)`
([`breakout-pullback.ts:333, 363`](../../../src/lib/scanner/gate2/breakout-pullback.ts)):
a running minimum over the **closed backward window** from the breakout bar to the
evaluation bar. Nothing after T is consulted, and no pivot is confirmed.

The review's own proposed correction — *"the absolute low of the breakout
structure"* — is a description of what the code already does. **The criticism is
answered by the implementation, not by a change to it.** The word "swing" in the
first draft invited the misreading and has been removed.

## Refuted — the state space is not 180 states

Rated CRITICAL: 6 × 5 × 6 = 180 interacting states, unfalsifiable at this sample
size. The product is not the testable surface, and §10.1 sets out why: the tested
objects are a **30-cell surfacing table**, a 5-verdict feasibility function, 6
position edges and 9 market edges. The position machine is entered only after an
entry exists and is not crossed with the other two.

The review's own correction — *"position states are lifecycle tracking and should
not be treated as alpha states"* — is what the design says. **No transition
probability is estimated from data anywhere in this architecture.**

The valid residue of the objection is about *complexity enabling excuses*, and
that is answered by the staged build order in §14.1, which the review prompted.

## Upheld — and the document changed

| # | finding | change made |
|---|---|---|
| 1 | "direction of travel" is a smuggled parameter — it needs a lookback and a dead band | four new unknowns (1a–1d) naming the estimator explicitly |
| 8 | naming a correlation haircut as "unknown" is an evasion; correlation goes to 1 in a shock | **a concentration constraint is now part of the design**, not a parameter — group cap enforced alongside the budget invariant, with only its magnitude open |
| 9 | the stop cushion is a hidden lever that can push `NOT_FEASIBLE` into `FEASIBLE` | cushion declared as an **inherited frozen V1 constant** (0.01) on an explicit do-not-tune list, alongside the noise-floor coefficients and geometry constants |
| 10 | an open-ended exit rule is unlimited freedom to manufacture a reward distribution | the **class** is now constrained in the design — structural or time-based only, searched profit targets prohibited — while the parameter stays open |
| 11 | breadth on a survivor cross-section invalidates the market state machine | survivorship declared with phase 12's measurement (3 of 355 symbols absent from today's listing), and the upward bias in collapse periods stated as binding on Phase 14 |
| 12 | designing to pass two hand-picked scenarios is qualitative curve-fitting | **eight invariant acceptance criteria (I1–I8)** added, checkable on any replay without reference to any setup; the scenarios are demoted to expressiveness tests |
| 14 | `budgetUsedFrac` is not reproducible without a deterministic allocation order | allocation order made a preregistered, deterministic queue |

Two of these — the gap-risk hole in the budget invariant and the
second-position-in-the-same-symbol route around the averaging-down rule — had
already been closed in the draft the reviewer saw; the review independently
reached the same conclusion on gap risk (vector 7), which is corroboration rather
than a new finding.

## Rejected on substance

**Vector 2 — "`RISK_OFF` = zero budget is V1's `FAIL` in disguise."** It is a hard
veto, and the document says so plainly: *visibility is not permission*, question A
keeps its absolute prohibition. The brief asks for exactly that. What differs from
V1 is everything around it: `RISK_OFF` is defined on two axes plus direction
rather than one MA50 test; the states between `RISK_OFF` and full participation
are graded rather than binary; and — the part that matters — a stock refused in
`RISK_OFF` is **surfaced with a refusal code**, so the cost of the veto is
measurable. V1's `FAIL` leaves no trace, which is why nobody can say what it cost.

The review's alternative, *"maintain a minimal non-zero risk allocation even in
adverse conditions for exceptional setups"*, is a real design choice and a
defensible one. It is rejected here because the brief's question A asks for an
absolute prohibition, and because a floor that never reaches zero cannot be
falsified by observing that it should have.

**Vector 15 — "strip the architecture down and test the naked edge in isolation."**
The naked edge has been tested to exhaustion: it is the −0.18 ATR that phases 8
through 12 kept re-measuring on the population V1 *keeps*. Repeating it is the
one thing twelve phases have established has no further information in it. **S1 in
§14.1 is the naked-edge test the review is asking for** — run on the population V1
*discards*, which has never been measured.

## Not resolved, and left visible

- **Vector 13 (collinearity), MEDIUM.** The review wants the stock axis to use
  relative strength rather than absolute moving averages. RS is already one of
  the grade axes; the absolute MA20/MA50 tests are inherited frozen from V1's
  Gate 2 and changing them is a strategy change, not a design one. The breadth
  coupling is declared in §4 at its true weight of 1/N and is not claimed away.
- **Vector 7's magnitude.** The budget invariant bounds intent, not realised loss.
  A gap haircut is named as unknown 11b; no number is chosen.

---

## §16 Verdict: `ARCHITECTURE READY FOR PREREGISTRATION`

Ready, with the scope explicitly bounded by §0: **this architecture makes no edge
claim and cannot create one.** What it is ready for is Phase 14 writing down every
unknown in §13 and then running **stage S1 only** — the selection question — with
the abandonment criterion written first.

What must be frozen before any replay, in one list:

1. every unknown in §13, including the four direction-estimator unknowns and the
   gap and correlation-group parameters
2. the inherited-frozen constants, restated as not-to-be-tuned
3. the primary hypothesis for S1, as one sentence
4. the inference plan — quarter and month clusters, permutation over whole
   clusters, symbol not a cluster level, estimators recalibrated before results
5. the power calculation, computed **before** the run
6. the comparison metric — risk-weighted or equity-path, never unweighted mean R
   (§12.1)
7. the negative controls, including the randomised ladder of §14 item 6
8. the allocation order for the deterministic budget queue
9. the abandonment criterion

Phase 14 must not implement stages S2–S4. If S1 fails, they are never built.
