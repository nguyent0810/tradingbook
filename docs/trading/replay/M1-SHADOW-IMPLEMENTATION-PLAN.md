# M1 — shadow decision pipeline: implementation plan

**Date:** 2026-08-14 · Written and committed **before any code**, per §0
**Baseline:** `c950595`

**M1 is deliberately useless as trading.** It adds no signal, no trade and no size
change. Its only product is that the scanner can, for the first time, say *which
decision* produced an outcome.

---

## §1 The safety invariant, and how it is achieved

```
PRODUCTION_BEHAVIOR_BEFORE  ==  PRODUCTION_BEHAVIOR_AFTER
```

**Achieved by construction, not by care: no production file is modified and no
production call site invokes the shadow pipeline.**

The shadow lives in a new module `src/lib/decisions/` consisting of pure
functions, and is driven only by an offline reconciliation script over the replay
sample that §16 specifies. Production imports nothing from it.

That makes every §15 isolation requirement trivially true rather than
argued — shadow disabled, enabled, throwing or diverging are all the same to a
production path that never calls it. The fail-open wrapper is still built and
tested, because M2 will wire it in and the semantics must exist and be verified
before they are needed.

**What "no production file is modified" means concretely:** `git diff` against
`c950595` must show zero changes under `src/lib/scanner/`, `src/lib/playbook/`,
`src/lib/position-sizing.ts`, `src/lib/paper-lab/`, `src/lib/replay/` and
`src/app/`. This is checked and reported in the output artifact.

---

## §0 Reuse versus new

### Reused, called not copied

| production symbol | used by | why not reimplemented |
|---|---|---|
| `evaluateBreakoutPullbackCandidate` | validity input | reimplementation is the definition drift phase 14.5 warned about |
| `computeMinStopFrac`, `computeAtr` | D2 feasibility | the noise floor already exists with unfitted coefficients |
| `computeGate2RankBreakdown` | D3 ranking | §6 forbids redesigning rank |
| `computePositionSizing` | D4 legacy leg only | the legacy size must be the real one to be a valid comparison |
| `deriveGate1SurfacingRule` | legacy adapter only | V1's visibility, from its single source of truth |
| `evaluateMarketRegime` | D0 input only | Gate 1 unchanged |
| `GATE2_*`, `TRADABILITY_*`, `MIN_STOP_*` constants | throughout | no cutoff is chosen or moved |

### New — all under `src/lib/decisions/`

| file | contains |
|---|---|
| `contracts.ts` | the six narrow input types, output types, and **compile-time forbidden-read assertions** |
| `d0-market-risk.ts` | market risk class, `SHADOW_ONLY` |
| `d1-visibility.ts` | `SHOWN \| HIDDEN` from validity + feasibility only |
| `d2-feasibility.ts` | structural feasibility; **no capacity** |
| `d3-ranking.ts` | typed wrapper over the existing rank breakdown |
| `d4-sizing.ts` | shadow eligibility + inputs; legacy size computed separately |
| `d5-stance.ts` | derived report from a fixed three-field tuple |
| `legacy-adapter.ts` | **the only place `quality` is read**, for reconstructing V1 |
| `shadow-record.ts` | `ShadowDecisionRecord` and the divergence taxonomy |
| `run-shadow.ts` | orchestrator plus the fail-open wrapper |

Plus `scripts/replay/run-m1-shadow-reconciliation.ts` and tests.

---

## §2 Contract shapes

Each decision receives a **narrow** object. Forbidden fields are *absent from the
type*, so reading one is a compile error rather than a review failure — the
enforcement mechanism phase 15's review required.

```
D0  MarketRiskInput      { gate1Level }                         → NONE | REDUCED | NORMAL
D1  VisibilityInput      { validity, feasibility }              → SHOWN | HIDDEN
D2  FeasibilityInput     { entryPrice, structuralStop, atr,
                           board, avgDailyValueVnd }            → FEASIBLE | NOT_FEASIBLE_*
D3  RankingInput         { rankComponents }                     → score + terms + sources
D4  SizingInput          { structuralRiskPerShare, marketRiskClass,
                           portfolioOpenRiskVnd, caps }         → eligibility + inputs
D5  StanceInput          { marketRiskClass, counts, openRisk }  → NO_TRADE | PROBE | NORMAL
```

**`quality` appears in none of them.** It appears only in `legacy-adapter.ts`.

`D0` receives `gate1Level` and nothing else — no stock field can reach it, which
is invariant I5 by construction.

---

## §3–§8 Per-decision notes

- **D0** maps the existing `PASS/WARNING/FAIL` to a symbolic class
  `NORMAL/REDUCED/NONE`. **No fraction, no R multiple, no percentage is chosen.**
  Output is tagged `SHADOW_ONLY` in the type itself.
- **D1** cannot be V1-equivalent, because V1's visibility reads `quality` and the
  contract forbids it. This is not a defect: it is the expected architecture
  delta, and it is why the legacy adapter exists. Shadow D1 and legacy visibility
  are computed separately and their disagreement is the headline divergence.
- **D2** returns `FEASIBLE`, `NOT_FEASIBLE_NOISE`, `NOT_FEASIBLE_LIQUIDITY`.
  **`NOT_FEASIBLE_CAPACITY` is not in its output type** — capacity is D4's.
- **D3** wraps the existing score unchanged and records, per term, which primitive
  produced it, so the known fan-out is visible rather than hidden.
- **D4** produces eligibility and inputs only. It emits **no order and no final
  size**. The legacy size is computed by the real `computePositionSizing` in the
  legacy adapter for comparison.
- **D5** takes exactly three fields and can therefore not become an authority.

---

## §10 Divergence taxonomy — preregistered here, before the run

| code | meaning | classification |
|---|---|---|
| `VISIBILITY_DIVERGENCE` | shadow D1 and legacy visibility disagree | **EXPECTED** — D1 does not read `quality` |
| `FEASIBILITY_DIVERGENCE` | D2 verdict differs from V1's implicit accept/reject | **EXPECTED** — V1 folds feasibility into validity |
| `RANKING_INPUT_DIVERGENCE` | a rank term's inputs differ from those recorded | **UNEXPECTED** — D3 wraps the same function |
| `SIZING_DIVERGENCE` | shadow eligibility differs from legacy sizing eligibility | **EXPECTED** — the A/B multiplier is absent from the shadow contract |
| `STANCE_DIVERGENCE` | D5 stance differs from `computeDailyTradingDecision` | **EXPECTED** — D5 reads decision-state counts, V1 reads pre-filter tier counts |
| `VOLUME_PRIMITIVE_DIVERGENCE` | the two volume ratios fall on opposite sides of 1.5 | **EXPECTED** — measured at 22.5% in phase 15 |
| `MISSING_INPUT` | a contract field could not be populated | **UNCLASSIFIED** — must be enumerated |

Anything not on this list at run time is reported as `UNCLASSIFIED` and named. **No
category may be added after seeing results.**

An `EXPECTED` divergence is an architecture delta, not a bug. An `UNEXPECTED` one
is a defect and blocks the verdict.

---

## §11 Volume primitive reproduction gate

The shadow record exposes both primitives separately and never unifies them:

```
gate2VolRatioMedian    bar.volume ÷ median(prior 20)
contextVolRatioMean    bar.volume ÷ mean(prior 20)
sameSideOf1_5Cutoff    boolean
```

**Gate:** the aggregate disagreement rate must reproduce phase 15's **22.5%**
(129/574). A materially different number means data drift, and the run stops for
investigation rather than reporting.

---

## §14 Invariants to implement

I1 ranking ↛ validity · I2 sizing ↛ visibility · I3 visibility ↛ structural stop ·
I4 market risk ↛ validity · I5 stock attribute ↛ market budget ·
I6 `VALID` + `NOT_FEASIBLE` reachable · I7 `SHOWN` + not actionable reachable ·
I8 probe-like stance without normal risk reachable · I9 duplicate input paths
explicit · I10 reporting label is not a control signal.

Any that cannot be implemented is recorded with its reason and downgrades the
verdict.

---

## §17 Success criteria

`M1 SHADOW PIPELINE READY` requires **all** of: production bit-unchanged;
reconciliation at or near 100% with any shortfall enumerated; contracts typed and
compile-enforced; `quality` absent as authority from D0–D5; shadow failure
isolated; invariants passing; every divergence classified; no side effects.

Otherwise `M1 DECOMPOSITION INCOMPLETE`, or `M1 SAFETY FAILURE` and rollback if
production behaviour moved.

## Hard stop

No Gate 1 change, no Gate 2 change, no `quality` removal in production, no rank
weight change, no cutoff change, no median/mean unification, no production risk
ladder, no production sizing change, no new surfaced setups, **and no profitability
comparison of any kind.**
