# M1 — the shadow decision pipeline

**Date:** 2026-08-14 · Executes
[`M1-SHADOW-IMPLEMENTATION-PLAN.md`](M1-SHADOW-IMPLEMENTATION-PLAN.md), committed
at `bc18d0c` **before any code and before the divergence taxonomy could be
influenced by results**
**Baseline:** `c950595` · **CI:** typecheck 0 errors, **1262/1262** tests (was 1234)

---

> **Scope qualifier added after review.** The pipeline is verified **offline**.
> It has never executed in production, and the review is right that this makes it
> an offline reconciliation rather than a live shadow. Live execution is an M2
> prerequisite with its own requirements — see Part II.

## Verdict: `M1 SHADOW PIPELINE READY` — offline scope

The scanner's five decisions now run as six independent, separately-typed
functions, over the same 574 setups, producing a record that says which decision
did what — **and production decided not one bit differently, because production
does not call them.**

M1 adds no signal, no trade and no size change. That is the design, not a
shortfall.

---

## 1. The safety invariant — proved, not argued

```
PRODUCTION_BEHAVIOR_BEFORE  ==  PRODUCTION_BEHAVIOR_AFTER
```

| proof | result |
|---|---|
| `git diff --stat c950595 -- src/` | **empty** — no tracked source file modified |
| `git status --porcelain -- src/` | one new untracked directory, `src/lib/decisions/` |
| imports of `lib/decisions` from outside that directory | **none — zero production call sites** |

Every §15 isolation requirement is therefore true by construction rather than by
argument: shadow disabled, enabled, throwing or diverging are indistinguishable to
a path that never calls it.

The fail-open wrapper is built and tested anyway, because M2 will wire it in and
the semantics must exist and be verified before they are relied on:

```ts
const r = runShadowSafely(poisoned);   // getter throws inside the pipeline
expect(r.ok).toBe(false);              // captured, returned as a value
```

---

## 2. Contract enforcement is compile-time, and it was verified by breaking it

Phase 15's review demanded typed narrowing rather than grep, because grep cannot
catch aliasing, destructuring or transitive reads. Implemented as:

```ts
type Forbidden<T, K extends string> = Extract<keyof T, K> extends never ? true : never;
const _d1_no_quality: Forbidden<VisibilityInput, QualityField> = true;
```

**Verified by deliberately smuggling `quality` into `VisibilityInput`:**

```
src/lib/decisions/contracts.ts(191,7): error TS2322:
  Type 'true' is not assignable to type 'never'.
src/lib/decisions/run-shadow.ts(61,31): error TS2345:
  Property 'quality' is missing in type ... but required in type 'VisibilityInput'.
```

The file was then restored and `tsc` passes. **The mechanism is real, not
documentation of one.** Twenty-five such assertions cover all six contracts.

### The contracts

| decision | input type — exactly these fields | output |
|---|---|---|
| **D0** | `{ gate1Level }` | `NONE \| REDUCED \| NORMAL`, tagged `usage: "SHADOW_ONLY"` in the value |
| **D1** | `{ validity, feasibility }` | `SHOWN \| HIDDEN` — two values, no actionability, no budget |
| **D2** | `{ entryPriceKVnd, structuralStopKVnd, atrKVnd, board, avgDailyValueVnd }` | `FEASIBLE \| NOT_FEASIBLE_NOISE \| NOT_FEASIBLE_LIQUIDITY \| UNKNOWN_INPUT` |
| **D3** | `{ terms: [{ name, value, source }] }` | score, terms, **duplicated sources** |
| **D4** | `{ structuralRiskPerShareKVnd, entryPriceKVnd, marketRiskClass, portfolioOpenRiskVnd, accountEquityVnd }` | eligibility + echoed inputs + `emitsOrder: false` |
| **D5** | `{ marketRiskClass, counts, aggregateOpenRiskVnd }` | `NO_TRADE \| PROBE \| NORMAL` |

Three properties worth naming:

- **`NOT_FEASIBLE_CAPACITY` is not a member of D2's verdict type.** Capacity moved
  to D4, which is what makes D2 a pure function of one candidate.
- **`emitsOrder: false` is a literal type in the return value**, so "M1 emits no
  order" is checkable at runtime, not only promised in a comment.
- **D0's input has no stock field at all**, so invariant I5 is enforced by the
  compiler rather than by a test.

### `quality` appears in no contract

It appears only in `legacy-adapter.ts`, which reconstructs V1 using the real
production functions — `deriveGate1SurfacingRule`, `qualityRiskMultiplier`,
`computeDailyTradingDecision`, `computePositionSizing` — so the comparison is
against reality, not a reimplementation.

A test strips comments from each of the six decision files and asserts the token
`quality` does not occur in their code.

---

## 3. Reconciliation over 574 setups

| | |
|---|---|
| setups in sample | 574 |
| **decisions computed** | **574 / 574 = 100.0%** — D0–D5 evaluated for every record |
| unevaluable | 0 |
| shadow errors | 0 |
| all contract fields populated from real inputs | **0 / 574 = 0.0%** |

### That 0% measures input availability, not decomposition — and it is a finding

Two D4 fields could not be populated for any record:

| field | why |
|---|---|
| `accountEquityVnd` | the replay carries no account state; using today's equity would be anachronistic |
| `portfolioOpenRiskVnd` | **V1 has no aggregate open-risk concept at all** |

The second is the substantive one. Phase 13 found `openRiskVnd` computed inside
the paper-lab subsystem and rendered in a UI drawer, never compared to any limit,
and absent from the main path entirely. **The shadow needed a field production
does not have, and said so.** That is exactly what M1 exists to surface; filling
it with an invented default would have hidden it.

**D0, D1, D2, D3 and D5 are fully populated for every record.** The gap is
confined to D4.

### Divergences — all classified in advance

| code | n | classification |
|---|---|---|
| `MISSING_INPUT` | 574 | UNCLASSIFIED — the two fields above, enumerated |
| `SIZING_DIVERGENCE` | 236 | EXPECTED |
| `VISIBILITY_DIVERGENCE` | 221 | EXPECTED |
| `STANCE_DIVERGENCE` | 133 | EXPECTED |
| `VOLUME_PRIMITIVE_DIVERGENCE` | 129 | EXPECTED |
| `FEASIBILITY_DIVERGENCE` | 125 | EXPECTED |
| **UNEXPECTED** | **0** | **no defect surfaced** |

The classification was frozen in `shadow-record.ts` and in the plan committed at
`bc18d0c`, before the sample was processed. A test asserts the taxonomy has
exactly seven codes and that an invented code returns `UNCLASSIFIED`.

Every divergence answers **what** differed, **where** (which decision) and **why**
(a reason code, never prose alone). For example:

```
code   VISIBILITY_DIVERGENCE   decision D1
legacy HIDDEN                  shadow SHOWN
reason v1_hid_on_gate1_x_quality_shadow_has_neither_input
```

---

## 4. The volume-primitive gate reproduced exactly

| | |
|---|---|
| measurable records | 574 |
| disagree at the shared 1.5 cutoff | **129** |
| rate | **22.5%** |
| phase 15 measured | **22.5% (129/574)** |
| **gate** | **PASS — no data drift** |

Both primitives are exposed separately in every record and never unified:

```
gate2VolRatioMedian    bar.volume ÷ median(prior 20)
contextVolRatioMean    bar.volume ÷ mean(prior 20)
sameSideOf1_5Cutoff    boolean
```

M1 does not choose which is correct, does not collapse them into one field, and
does not move the cutoff.

---

## 5. The visibility delta — observed, and surfaced to nobody

| | n |
|---|---|
| V1 `HIDDEN` total | **194** |
| V1 `SHOWN` total | **380** |
| V1 hidden, shadow would show | **145** ← the M2 question |
| V1 hidden, shadow also hides | 49 — hidden by **feasibility**, not by tier |
| V1 shown, shadow would hide | **76** — V1 surfaces setups whose stop is not executable |

The 194/380 split reconciles **exactly** with the figure S1 computed independently
two phases ago, which is the strongest available check that the legacy adapter
reproduces V1 rather than approximating it.

Two things this table says that nothing before it could:

- The M2 question is **145 setups, not 153 and not 194.** Some of what V1 hides,
  the shadow hides too — for a completely different reason.
- **V1 surfaces 76 setups it cannot execute.** Their stop sits inside the noise
  floor, so V1's own executable-stop model would reject them at trade time; today
  they reach the surfaced list anyway because feasibility is fused into validity.

**M1 surfaces none of them.** Production visibility is byte-identical.

---

## 6. Invariants

All eleven implemented and passing, in `src/lib/decisions/decisions.test.ts`.

| id | invariant | how it is tested |
|---|---|---|
| I1 | ranking ↛ validity or visibility | inflate `volumeTerm` to 999,999; D1 and D2 outputs are deep-equal |
| I2 | sizing inputs ↛ visibility | equity ∈ {null, 1, 10bn}; D1 unchanged |
| I3 | visibility ↛ structural stop | shown vs hidden candidate; identical risk fraction |
| I4 | market risk ↛ validity or feasibility | all three Gate 1 levels; D1 and D2 deep-equal |
| I5 | stock attribute ↛ market budget | enforced by D0's input type having no stock field |
| I6 | `VALID` + `NOT_FEASIBLE` reachable | stop at 19.99 against entry 20 → `NOT_FEASIBLE_NOISE` |
| I7 | `SHOWN` with no budget reachable | `gate1Level: "FAIL"` → `SHOWN` + `NOT_ELIGIBLE_NO_BUDGET` |
| I8 | probe stance without normal class | `REDUCED` + feasible candidates → `PROBE` |
| I9 | duplicate primitive paths reported | a two-term same-source input returns `duplicatedSources` |
| I10 | reporting label is not a control signal | `emitsOrder` is `false` in the value |
| I11 | D2 order-independent | same set evaluated forwards and backwards, deep-equal |

Anti-circularity is enforced by the **module graph**, not by discipline: a test
reads `d5-stance.ts` and asserts it imports none of D0–D4 or the orchestrator.

---

## 7. Known limits, stated rather than discovered later

1. **The shadow has zero production call sites.** That is what makes the safety
   invariant provable, and it means the shadow has only ever seen replay inputs.
   Live production may present shapes the replay never contained — a **M2
   prerequisite**, not something M1 can settle.
2. **D4 is the least exercised decision**, because two of its five inputs are
   unavailable. Its eligibility logic is real; its capacity path has never run
   against a real budget.
3. **`accountEquityVnd` is deliberately null** rather than backfilled. A replay
   using today's equity would be anachronistic in a way that is easy to miss.
4. **D0's mapping is symbolic.** `NONE / REDUCED / NORMAL` restates what
   `computeDailyTradingDecision` already believes. **No fraction, no R multiple
   and no percentage was chosen**, because choosing one needs evidence M1 does not
   have and §3 forbids inventing.

---

## 8. What M1 did not do

Per the hard stop, and verifiable in the diff: no Gate 1 change, no Gate 2 change,
no `quality` removal in production, no rank-weight change, no `volRatio` cutoff
change, no median/mean unification, no production risk ladder, no production
sizing change, **no new setup surfaced**, and **no profitability comparison of any
kind** — the reconciliation script computes no continuation rate, no expectancy
and no P&L, and says so in its own output.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 20 attack vectors.

**Twelve it could not refute**, including the four that matter most: production
behaviour drift ("zero production call sites computationally guarantees zero
production drift"), hidden side effects, `quality` still being an authority
somewhere, and D5 god-object recurrence.

Two CRITICAL findings. **One is adopted in full and changes the verdict's scope.
One is adopted in substance and produced a code change.** Two HIGH findings were
already satisfied and are now locked in by test.

## Adopted in full — this is an offline reconciliation, not a live shadow

> *"With zero production call sites and execution driven exclusively by an offline
> reconciliation script, it is functionally just a backtest. Reclassify from
> SHADOW PIPELINE READY to OFFLINE RECONCILIATION READY."*

**Correct.** The pipeline has never seen a live input, never run inside the scan
job's event loop, and never met a data anomaly the replay does not contain. The
§17 verdict token is kept because the brief defines the vocabulary, but the scope
qualifier is now at the top of this document and the substance of the rename is
accepted without reservation.

This is also the honest tension in M1's own design: **zero call sites is what
makes the safety invariant provable, and it is exactly what makes the shadow
unproven against live data.** Both are true, and the second is an M2 prerequisite.

## Adopted in substance — D4 declares a verdict it can never return

> *"D4 suffers from 100% data starvation… you cannot declare an implementation
> READY when one of its primary decision phases has never been tested against a
> single populated real-world input."*

The review's remedy — inject a mocked equity so the branch executes — is
**rejected**, because a fabricated 1bn VND in the reconciliation artifact is the
kind of invented number fifteen phases have refused to invent, and it would make
the pipeline *look* better tested while testing nothing real.

But the finding underneath is right, and it exposed something worse than data
starvation: **`NOT_FEASIBLE_CAPACITY` is unreachable in M1 by construction.**
Deciding capacity requires converting a budget into shares, which requires a risk
fraction, and choosing one is precisely what §3 and §7 forbid.

So the limit is now explicit and enforced rather than latent:

```ts
export const M1_REACHABLE_ELIGIBILITY  = ["ELIGIBLE", "NOT_ELIGIBLE_NO_BUDGET", "UNKNOWN_INPUT"];
export const M1_UNREACHABLE_ELIGIBILITY = ["NOT_FEASIBLE_CAPACITY"];
```

with a test driving four input shapes — including zero equity, enormous equity and
zero structural risk — and asserting the capacity verdict never fires. **A dead
branch that is documented, tested and dated is a known limitation; the same branch
undocumented is a bug waiting to be discovered in M2.**

## Already satisfied, now locked in by test

| # | finding | status |
|---|---|---|
| 4 (HIGH) | structural typing means a wide object could be passed by reference and leak at runtime | already true — every decision input is built **field-by-field**, no spread anywhere. Now asserted: a test extracts every `decide*({...})` call from the orchestrator and fails on `...`, and a second asserts the retained sizing input has **exactly** its five contract keys and no `quality` or `symbol` |
| 13 (HIGH) | `as SomeContract` casts would make the strictness an illusion | already true — no such cast exists. Now asserted: a test forbids `as <ContractType>` for all six contracts in the orchestrator and the legacy adapter, alongside the existing `as any` / `@ts-ignore` ban |

A third structural property the review did not ask for is now also enforced:
**no decision module imports another** — all six import only `./contracts`, so
only the orchestrator composes them.

## Refuted — the 76 do not violate the safety invariant

Finding 14 argues that because the shadow would hide 76 candidates V1 shows, a
"perfectly replicated shadow" is impossible and `PRODUCTION_BEHAVIOR_BEFORE ==
AFTER` is broken.

**The invariant is about production, and production is untouched** — `git diff`
against `c950595` is empty for every tracked source file. The shadow is not
supposed to replicate V1; it is the new architecture, and the 76 are a
preregistered `FEASIBILITY_DIVERGENCE` classified `EXPECTED` before the run.

What the finding is right about is the *migration*: M2 is a deliberate behaviour
change, not a seamless swap. Phase 15's §10 already says so and quantifies it.
This document now says it too.

## Accepted as M2 prerequisites

- **Finding 11 (MEDIUM)** — `runShadowSafely` catches synchronous throws only. The
  pipeline is fully synchronous today, now asserted by a test that checks the
  return is not a `Promise` and that the orchestrator contains no `async`,
  `await` or `new Promise`. If M2 ever makes it asynchronous, the wrapper needs
  rejection trapping and a timeout **before** that happens.
- **Finding 16 (MEDIUM)** — unbounded divergence telemetry is a memory risk when
  run per-tick over hundreds of candidates. Offline this is irrelevant; in-process
  it is not, and aggregation must land with the wiring.

## Final CI

`tsc --noEmit` 0 errors · **1262/1262 tests, 158 files** (1234 before M1;
28 new tests in `src/lib/decisions/decisions.test.ts`).

---

## M2 prerequisites — exact, and none of them optional

1. **Wire `runShadowSafely` into the scan job behind a flag**, defaulting off, so
   the shadow finally sees live inputs. Until then the pipeline is unproven
   against anything the replay does not contain.
2. **Async safety and a timeout in the wrapper** before any in-process execution.
3. **Bounded telemetry** — aggregate per tick rather than accumulating records.
4. **An equity and open-risk source**, or a written decision that D4 stays
   unexercised. `portfolioOpenRiskVnd` does not exist in V1 at all; supplying it
   is a production capability, not a shadow one.
5. **A written acceptance that M2 changes behaviour** — 145 setups become visible
   and 76 become hidden. Phase 15 quantified it; M2 must sign for it.
6. **A risk fraction with evidence**, or `NOT_FEASIBLE_CAPACITY` stays dead. M1
   deliberately did not choose one.

**M1 does not authorise M2.** It establishes that the decomposition compiles,
runs, reconciles and diverges only where it was predicted to — which is what the
phase asked and the whole of what it claims.
