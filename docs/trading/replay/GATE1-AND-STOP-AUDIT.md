# Gate 1 specification audit + executable stop-risk audit

**Date:** 2026-08-12 · **Basis:** same replay engine, same labels, 4,024 sessions, **0 guard violations**
**Data:** [`baseline.signals.ndjson`](baseline.signals.ndjson) — now carries Gate 1's raw inputs per signal

Two questions, two different answers. The stop floor is a **specification defect**
with a demonstrated mechanical cause. Gate 1 is **insufficient evidence** — the
inversion is real in direction but its cause is not demonstrated, so per the
constraint no replacement gate is proposed.

---

## Part A — Gate 1

### A.1 What Gate 1 actually is

[`gate1-market.ts`](../../../src/lib/playbook/gate1-market.ts) collapses **two**
independent conditions into one three-way label:

| Condition | Definition |
|---|---|
| `trend` | VN-Index close vs its MA50 → bullish / bearish / neutral |
| `momentum` | last 3 closes strictly rising → up; strictly falling → down; else neutral |

`PASS = bullish AND up` · `FAIL = bearish AND down` · `WARNING = everything else`

"momentum up" is equivalent to **an index up-streak of ≥2 sessions**. There is no
volatility, breadth, or participation term. This matters: the label is a proxy
for two things at once, so the label alone can never say which one drives an
outcome. The replay now records `trend`, `momentum`, index extension vs MA50,
up-streak, and the index's own forward return, taken from the same bars the gate
saw.

### A.2 Decomposition (Tier A only, ex-REE, ex-2020)

Comparing PASS with WARNING *as reported* compares different candidate mixes —
PASS surfaces Tier A **and** B, WARNING surfaces Tier A only. Everything below is
Tier A on both sides.

| trend × momentum | label | n | stop% | mean | median | MFE | MAE |
|---|---|---|---|---|---|---|---|
| bullish × **up** | **PASS** | 103 | 61.2 | **−0.38%** | −3.47% | **6.16** | −4.57 |
| bullish × down | WARN | 59 | 54.2 | +0.79% | −2.46% | 7.45 | −3.87 |
| bullish × neutral | WARN | 172 | 60.5 | +1.62% | −2.76% | 8.27 | −4.43 |
| bearish × up | WARN | 11 | 27.3 | +11.08% | +1.59% | 15.32 | −3.21 |
| bearish × neutral | WARN | 28 | 64.3 | +2.84% | −2.92% | 9.08 | −4.86 |

**Holding trend constant at bullish and varying only momentum**, the condition
Gate 1 requires is the worst of the three branches:

| within bullish | n | mean | MFE | rankScore |
|---|---|---|---|---|
| momentum = up (what PASS demands) | 103 | **−0.38%** | 6.16 | 2711.8 |
| momentum ≠ up | 231 | **+1.41%** | 8.06 | 2591.4 |
| difference | | **+1.79pp**, 95% CI **[−0.21, +3.80]**, p = 0.040 | +1.90pp | |

The effect localises to the **momentum condition**, not the MA50 trend
definition. But note the confidence interval: **it crosses zero.**

### A.3 Candidate mechanisms — two ruled out, one not demonstrated

**Market timing — not the explanation on close-to-close index returns.** If PASS
marked bad moments to buy, the index would fall after it. It does not:

- index forward-20 after **PASS: +1.04%**
- index forward-20 after **WARNING: +0.79%**

The market does *better* after PASS while the stocks selected do worse, which
points at selection rather than at calling the market.

> **Limit of this test.** `indexFwdPct` runs T-close → 20th index close, while
> the trade model enters at the **T+1 open** and can exit early on a stop. The
> two clocks differ, so this rules out only the close-to-close index path. It
> does **not** rule out timing effects the executable model would feel: opening
> gaps, entry-day behaviour, stop-path interaction, or dispersion between the
> index and the selected names.

**Index extension — not demonstrated as the explanation.** PASS coincides with
roughly double the index extension above MA50 (+5.26% vs +2.69%), which makes
"PASS buys an extended market" the obvious hypothesis. It does not hold up, but
the cells are small and this is absence of evidence, not evidence of absence:

| index extension | n | mean | MFE |
|---|---|---|---|
| below MA50 | 39 | +5.17% | 10.84 |
| 0–2% | 99 | −0.29% | 6.20 |
| 2–4% | 97 | +1.85% | 7.77 |
| 4–6% | 57 | +3.22% | 10.58 |
| 6–9% | 57 | −0.74% | 5.71 |
| >9% | 24 | −0.24% | 8.35 |

Non-monotonic, and ext<4% vs ≥4% gives **p = 0.321** — with n=57/57/24 in the
high buckets, that is an underpowered test, not a refutation. The stronger point
is that WARNING beats PASS *inside both* extension buckets (ext<4%: +1.68 vs
+0.70; ext≥4%: +2.60 vs −1.18), so extension does not appear to be the mediator.
Establishing that properly would need an interaction model over momentum,
quality, year and symbol clustering; the buckets here are post-hoc and coarse.

**The 3-up-session rule — where the effect sits, not demonstrated as its cause.**
By streak length the pattern is not clean either:

| index up-streak | n | mean | stop% |
|---|---|---|---|
| 0 (index fell) | 173 | +1.08% | 63.6 |
| 1 | 86 | **+2.53%** | 51.2 |
| 2 | 37 | +0.45% | 70.3 |
| 3–4 | 51 | +0.78% | 52.9 |
| 5+ | 26 | +1.02% | 50.0 |

Streak ≥2 (= momentum up) averages +0.73% vs +1.56% for streak <2 — consistent
in direction, but streak 1 outperforming streak 0 breaks any simple
"more extension is worse" story.

### A.4 Year control

| | WARNING beat PASS |
|---|---|
| years with ≥3 Tier A trades on each side | **7 of 10** |

Directionally consistent, not unanimous — PASS won 2016, 2023, 2024.

### A.5 Robustness — and a correction to the previous phase

Last phase I reported the inversion as surviving "every control". Decomposition
shows that was **stated too strongly**. The headline comparison is carried in
part by one small cell:

| comparison | n (WARNING) | diff vs PASS | 95% CI | p |
|---|---|---|---|---|
| WARNING as reported | 270 | +2.33pp | [+0.24, +4.35] | 0.014 |
| WARNING minus 11 bearish×up trades | 259 | +1.94pp | **[−0.09, +3.95]** | 0.030 |

Removing **11 of 270** trades moves the interval across zero. Those 11 are not
one event — 10 distinct symbols across 8 different months — so the effect is not
an artefact of a single episode. But a result whose significance turns on 4% of
the sample is fragile, and p was never corrected for the several breakdowns
searched before this comparison was chosen.

### A.6 Verdict on Gate 1 — **insufficient evidence**

Not a specification defect, not an implementation defect: **not demonstrated**.

What *is* established: PASS Tier A is indistinguishable from zero (n=103), the
effect localises to the momentum condition rather than the trend definition, and
two plausible mechanisms — close-to-close index timing and index extension —
failed to explain it when tested, rather than being dismissed by assertion.

What is **not** established: why. Every surviving test is marginal at n≈100.

**This is not a clean bill of health for the rule.** PASS is defined as bullish
*plus* a 3-close rising streak ([`gate1-market.ts:74`](../../../src/lib/playbook/gate1-market.ts:74)),
and the bullish×up cell is the only negative one in the decomposition while
bullish×non-up is positive. That is not enough to replace Gate 1. It is enough to
name **the momentum clause as the high-priority suspect** and to test it first.

**No new Gate 1 is proposed**, per the constraint. What would settle it:

1. **More PASS Tier A observations.** n=103 over 11 years is the binding limit.
   Nothing statistical fixes that; only data does — the delisted-symbol backfill
   is the cheapest source.
2. **A selection-side test.** MFE is lower under PASS (6.16 vs 8.06) while
   rankScore is *higher* (2711 vs 2591) — the setups PASS surfaces score better
   on the scanner's own ranking yet run less far. If that holds with more data,
   the defect is in what the rank formula rewards during up-streaks, and Gate 1
   is a bystander.
3. **Breadth/participation data**, which Gate 1 does not currently read at all.

---

## Part B — Stop feasibility

### B.1 How the stop is derived

[`breakout-pullback.ts:363`](../../../src/lib/scanner/gate2/breakout-pullback.ts:363):

```
stopLevel = minLowSince × (1 − GATE2_STOP_BUFFER_FRAC)   // buffer = 1%
```

rejected when `(close − stop)/close < GATE2_MIN_RISK_TO_STOP_FRAC` (**0.3%**).

The structural anchor is sound — the stop sits under the swing low. The **floor
is the defect**: it is specified in percent-of-price with no reference to tick
size, spread, or volatility. Because the setup by construction enters near the
pullback low (pullback zone δ = 2%, max depth 4%), shallow pullbacks routinely
produce stops only a few ticks wide, and 0.3% is the only thing standing in the
way.

### B.2 Buckets by entry-to-stop distance

| bucket | n | stop% | median ret | mean ret | MFE | MAE | expR | total R | % of gross R |
|---|---|---|---|---|---|---|---|---|---|
| <0.5% | 1 | 0.0 | +14.13% | +14.13% | 14.13 | +0.27 | **286.1** | 286.1 | **60.0** |
| 0.5–1% | 5 | 80.0 | −0.75% | +3.05% | 6.49 | −1.36 | 5.358 | 26.8 | 5.6 |
| 1–1.5% | 8 | 87.5 | −1.34% | +1.58% | 4.10 | −2.14 | 1.219 | 9.8 | 2.0 |
| 1.5–2% | 18 | 77.8 | −1.73% | −0.45% | 3.33 | −2.95 | −0.255 | −4.6 | −1.0 |
| 2–3% | 74 | 71.6 | −2.39% | +1.43% | 5.83 | −2.75 | 0.550 | 40.7 | 8.5 |
| >3% | 392 | 53.8 | −3.46% | +1.33% | 8.44 | −4.64 | 0.301 | 118.1 | 24.8 |

**Stop rate falls monotonically as the stop widens** — 87.5% at 1–1.5% down to
53.8% above 3%. A single trade in the tightest bucket carries 60% of all gross R.

### B.3 A floor from market mechanics

**What carries the verdict.** The specification defect does not rest on any tick
number. It is that `(close − stopLevel)/close < 0.003`
([`breakout-pullback.ts:132`](../../../src/lib/scanner/gate2/breakout-pullback.ts:132),
[`constants.ts:16`](../../../src/lib/scanner/gate2/constants.ts:16)) is the
**only** viability test on stop distance, and it contains no tick, spread, fee,
slippage or volatility term at all. A global percent floor asserts that market
microstructure does not exist. The figures below size that gap; if the tick table
is wrong they move, and the defect stands regardless.

Derived from the market's own resolution, **not** from what maximises the
backtest. Using HOSE's tick table (the *finest* of the three boards, so this is
the most permissive assumption available) — **from published exchange rules, not
from the repo, and worth verifying before the floor is set**:

| component | value |
|---|---|
| 1 tick, median entry (21.87 kVND) | **0.228%** of entry (p90: 0.439%) |
| quoted spread ≥ 1 tick by construction | 0.228% |
| entry-side + exit-side spread | 0.46% |
| round-trip brokerage (VN retail, both sides) | ~0.20–0.40% |
| **minimum for a stop to mean anything** | **≈0.76%** |

**The current 0.3% floor permits a stop 1.32 ticks from entry.** A stop inside
the bid-ask spread is not a risk control; it is triggered by quote noise
regardless of whether the thesis is right. Only 3.4% of trades sit under 5 ticks,
so the floor rarely binds — but when it does, it dominates the result.

Corroboration from outcomes (**not** the basis of the recommendation): the median
*winning* trade dips **1.97%** below entry before working. A floor under ~2%
systematically converts winners into stopped-out losers.

**Recommendation: floor = max(0.8%, a volatility term such as 1×ATR20/price).**
0.8% is the friction floor below which a stop cannot function; the volatility
term is what makes it instrument-appropriate rather than a single global percent.
The exact volatility multiple is not proposed here — choosing it from this
dataset would be the backtest optimisation the constraint forbids.

### B.4 What the floor is worth — and what it is not

Comparing the *conditional mean of kept trades* across floors would be circular —
a filter removes trades from numerator and denominator alike, so a flat mean
proves only that the survivors resemble each other. The table below instead sums
realised return over **all 498 opportunities**, counting a filtered-out signal as
0 (no position taken), which is what a floor actually does to a portfolio:

| floor | n kept | total return (equal weight) | per opportunity | expR |
|---|---|---|---|---|
| none | 498 | 659.8% | +1.32% | 0.958 |
| 0.3% (current) | 497 | 645.7% | +1.30% | 0.384 |
| 1.0% | 492 | 630.4% | +1.27% | 0.333 |
| 1.5% | 484 | 617.8% | +1.24% | 0.319 |
| 2.0% | 466 | 625.8% | +1.26% | 0.341 |
| 3.0% | 392 | 520.0% | +1.04% | 0.301 |

A floor up to 2% costs about **5% of total realised P&L** (659.8 → 625.8) while
removing most of the R inflation; a 3% floor costs **21%** and is too blunt.
An earlier draft of this document said money was "unchanged" — that was the
circular reading, and it is wrong: the cost is small, not zero.

**The stop floor is primarily a measurement defect, not a profit lever.** The
non-circular part of the claim is arithmetic, not statistical:
`rMultiple = (exit − entry) / riskPerShare`
([`trade-model.ts:131`](../../../src/lib/replay/trade-model.ts:131)) explodes as
`riskPerShare` → 0, so expectancy collapsing from 0.958 to ~0.33 under any floor
shows the headline was denominator-driven. Median return gets *worse* with a
wider stop (−2.47% → −3.46%): a wider stop does not improve the strategy, it
stops the strategy flattering itself.

**Sample disclosure.** The tables in B.2 and B.4 include REE and 2020, unlike
Part A. That is deliberate — the point of B.2 is the degenerate-stop mechanism,
and REE 2020-07-24 is its clearest instance — but it makes the two parts
non-comparable, so B.2 recomputed on Part A's sample:

| bucket (ex-REE, ex-2020) | n | stop% | median ret | mean ret | expR | % of gross R |
|---|---|---|---|---|---|---|
| <0.5% | 0 | — | — | — | — | — |
| 0.5–1% | 5 | 80.0 | −0.75% | +3.05% | 5.358 | 14.6 |
| 1–1.5% | 4 | 75.0 | −1.34% | +4.51% | 3.556 | 7.7 |
| 1.5–2% | 17 | 82.4 | −1.74% | −0.73% | −0.401 | −3.7 |
| 2–3% | 63 | 71.4 | −2.41% | +1.66% | 0.623 | 21.4 |
| >3% | 361 | 54.3 | −3.54% | +1.36% | 0.305 | 60.0 |

n=450, total 183.6R, expectancy 0.408R. Removing REE and 2020 empties the <0.5%
bucket, but **9 trades under 1.5% still carry 22.3% of gross R** — the mechanism
is not one outlier.

### B.5 Verdict on the stop floor — **specification defect**

The rule is implemented exactly as written; the written rule is wrong. It sets a
minimum risk distance without reference to the market's price resolution, so it
admits stops that cannot exist as intended.

---

## Part C — Validation

- **Point-in-time guards preserved.** 0 violations across 4,024 sessions. The new
  index-forward diagnostic is read through the outcome channel
  (`guard.outcomeRows("forward:VNINDEX", …)`), never the decision channel.
- **No strategy or scanner parameter changed.** The diff adds diagnostics to the
  replay and its dump; `GATE2_MIN_RISK_TO_STOP_FRAC`, extension, recency and
  every other constant are untouched.
### C.1 Codex adversarial review

Six questions put adversarially; four found real defects, all corrected above.

| # | Finding | Action |
|---|---|---|
| 1 | "Market timing ruled out" overclaims — `indexFwdPct` runs T-close→T+20 close while the trade enters at the T+1 open and can stop early. Different clocks. | Softened to close-to-close only, with the limit stated in §A.3 |
| 2 | "Extension ruled out" overclaims — p=0.321 on n=57/57/24 is underpowered; absence of evidence read as evidence of absence | Reworded to "not demonstrated"; power limitation stated |
| 3 | The stop verdict does not depend on the tick table; the load-bearing claim is that the floor has **no** microstructure term | Load-bearing claim moved to the front of §B.3; tick figures marked as sizing, and as unverified against an exchange source |
| 4 | "Floor changes R but not money" is circular — filtering removes trades from numerator and denominator. Also Part A excludes REE/2020 while Part B includes them | Replaced with total P&L over all 498 opportunities (a floor at 2% costs ~5%, at 3% costs 21% — **not** "unchanged"); B.2 recomputed on Part A's sample |
| 5 | The verdict is right but under-claims: the momentum clause deserves naming as prime suspect | Added to §A.6 |
| 6 | No future data reaches a decision path in the new diagnostics; index forward return uses `guard.outcomeRows` and is attached only to emitted signals | Confirmed, no change |

Codex's closing position: *the Gate 1 verdict is right; "ruled out" was too strong
on both mechanisms; the stop-floor verdict is right but the money phrasing and
the sample inconsistency needed tightening.* All four are fixed in place rather
than noted as caveats.

### Verdict summary

| Finding | Category |
|---|---|
| Stop-risk floor (0.3% ≈ 1.32 ticks) | **Specification defect** |
| Gate 1 PASS/WARNING inversion | **Insufficient evidence** — direction consistent, cause not demonstrated |
| RS rank ordering (carried over) | **Insufficient evidence** — `--lookbackSessions` is hard-capped at 120, yielding 20 candidates and 6 rank changes; structurally unable to produce a sample |
