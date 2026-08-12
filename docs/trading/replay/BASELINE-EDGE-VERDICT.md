# Baseline replay — does the current strategy have an edge, and where does it fail?

**Date:** 2026-08-12 · **Data:** 705,261 equity bars / 1,537 symbols / 4,073 VN-Index bars
**Replay:** 4,024 sessions (2010-04→2026-08), 501 signals surfaced, 498 scored, **0 guard violations**
**Artifacts:** [`baseline.json`](baseline.json), [`baseline.signals.ndjson`](baseline.signals.ndjson)

---

## 1. The answer

**No — the baseline strategy does not have a demonstrated edge.** The headline
`+0.958R` is not a result; it is three outliers wearing a trench coat.

| Cut | Expectancy | What it shows |
|---|---|---|
| As reported | **+0.958R** | the number that looks like an edge |
| Excluding 6 trades with sub-1% stops | **+0.333R** | −65% of gross R came from 6 trades |
| Excluding REE | **+0.390R** | one symbol = 284.4R of 476.9R (59.6%) |
| Excluding 2020 | **+0.400R** | one year = 56.2% of gross R |

R divides by stop distance. Six signals had stops under 1% of entry (min
**0.049%**), so an ordinary move became a colossal R. The worst offender —
REE 2020-07-24, entry 14.58, stop 14.57 — turned a **+14.1%** gain into **286R**.
That is arithmetic, not skill.

**Judged on percent return, which does not divide by a rounding error:**

- Average **+1.32%** per trade, holding ~12 sessions
- Median **−2.47%**
- **35.7%** of trades end positive; **58.0%** stop out
- Removing the 6 degenerate-stop trades moves the average to **+1.28%** — i.e. they added 0.6R of headline per trade and essentially nothing real

A strategy whose median trade loses 2.5% and whose mean is rescued by rare
events has not been shown to work. It has been shown to survive.

**Coded verdict: `INCONCLUSIVE`** (concentration blocks the claim).
Codex argues the harsher reading — `NO_EDGE` for the base process plus rare
rescue events — and on the percent-return evidence that reading is the more
honest one. The distinction matters for what you do next: `INCONCLUSIVE` says
*measure more*; `NO_EDGE` says *change the process*. §4 gives a reason to think
the second is right.

---

## 2. Where the failure concentrates

**By year** — the strategy has been flat-to-negative for four of the last five years:

| Year | n | win% | stop% | expR | avg % | median % |
|---|---|---|---|---|---|---|
| 2020 | 46 | 43.5 | 54.4 | **+6.437** | +1.35 | −1.37 |
| 2021 | 78 | 42.3 | 56.4 | +0.874 | +4.24 | −2.40 |
| 2022 | 48 | 25.0 | 64.6 | +0.042 | −0.69 | −3.92 |
| 2023 | 66 | 36.4 | 57.6 | −0.012 | −0.02 | −2.68 |
| 2024 | 62 | 22.6 | 62.9 | −0.064 | −0.06 | −2.91 |
| 2025 | 67 | 37.3 | 53.7 | +0.935 | +2.37 | −2.38 |
| **2026** | **15** | **6.7** | **93.3** | **−0.943** | **−4.59** | **−5.21** |

2026 is not a replay artefact — it reproduces what production has actually been
doing. That is corroboration the harness is measuring the real strategy.

**Median return is negative in every year except 2016–17.** The typical trade
has always lost money; only the tail ever paid.

**By symbol** — 53.5% of gross R sits in 5 names, 59.6% in REE alone.

---

## 3. The point-in-time work (what was actually fixed)

Three biases, all confirmed present before the fix:

1. **Survivorship** — the replay seeded from `where: { active: true }`, today's
   curation flag. A symbol that traded in 2019 and was curated out since could
   never be selected. Replaced with a resolver that decides membership from
   **bar evidence at T** ([`point-in-time-universe.ts`](../../../src/lib/replay/point-in-time-universe.ts)),
   and the runner now seeds from all 1,537 symbols.
   *Honest note:* measured impact was **nil** — the excluded symbols hold ~9
   bars each, far under the 120-bar window, so they never qualified anyway. The
   mechanism was wrong; the number did not move.

2. **Look-ahead in tradability** — decisions could see bars after T. The engine
   now slices every series at T and routes future bars only to trade scoring
   ([`replay-engine.ts`](../../../src/lib/replay/replay-engine.ts)).

3. **Tactical effective dating** — `buildActiveTacticalSymbolWhere` filtered on
   `expiresAt` but not `addedAt`, so a symbol added in 2026 was treated as
   present in 2019. Fixed in [`tactical-universe.ts`](../../../src/lib/tactical-universe.ts) — **this one was a live production bug**, not
   just a replay bug.

**Proof (requirement #4):** [`replay-engine.test.ts`](../../../src/lib/replay/replay-engine.test.ts)
runs `runReplay` twice over identical history — once truncated at T, once with
every post-T bar poisoned to absurd values — and asserts the decision surface is
byte-identical. It includes a meaningfulness guard (`signals.length > 0`),
because a fixture that surfaces nothing would pass trivially; that guard failed
on the first attempt and forced a real fixture.

**What the proof does not cover**, per Codex and now documented in the test:
poisoning preserves post-T *dates and bar counts*, so a leak keying on the
existence or length of future history would survive it; `tactical: []` means
current-state fields are never exercised; and "0 guard violations" means no
post-dated row reached a decision — **not** that no current-state leak exists.

---

## 4. Gate 1 is inverted — and it survives every control

The reported split (PASS +0.278R vs WARNING +1.422R) was **confounded**: PASS
surfaces Tier A **and** B, WARNING surfaces Tier A only, so the buckets held
different candidate mixes. Codex caught this. Cross-tabulated like-for-like:

| Cut (Tier A only) | PASS | WARNING |
|---|---|---|
| all | −0.088R / −0.29% (n=115) | +1.422R / +1.83% (n=296) |
| ex-REE | −0.088R / −0.29% | +0.467R / +1.85% |
| ex-2020 | −0.106R / −0.38% | +0.482R / +1.87% |
| **ex-REE & ex-2020** | **−0.106R / −0.38%** (n=103) | **+0.496R / +1.95%** (n=270) |

The inversion is not the artefact. Bootstrap on percent return (20k resamples,
Tier A, ex-REE, ex-2020):

- **WARNING +1.95%**, 95% CI **+0.65% .. +3.36%** — excludes zero
- **PASS −0.38%**, 95% CI **−1.87% .. +1.21%** — **includes zero**
- Difference **+2.33pp**, 95% CI +0.26 .. +4.33, **p = 0.014**

**Read this conservatively.** The comparison was chosen *after* seeing the
anomaly, across several breakdowns, and p is uncorrected for that search — so it
is optimistic. The defensible claim is not "PASS loses money" but:

> **Gate 1 PASS — the regime the system treats as permission to trade — produces
> Tier A setups that are statistically indistinguishable from zero. The only
> positive expectancy sits in WARNING, the regime it treats as caution.**

A second inversion sits inside PASS: Tier B (+0.760R, n=87) beats Tier A
(−0.088R, n=115). The quality ranking runs backwards there too.

This is the most actionable finding in the phase, and it is a *specification*
problem, not a parameter problem. No tuning would have found it.

---

## 5. Limitations that bound every number above

- **76.9% of symbols are unreplayable.** 1,182 of 1,537 have no stored bars. The
  supportable claim is *"among symbols with stored history, under this trade
  model"* — **not** "over the historical VN universe". Delisted names are absent,
  so the result remains survivor-conditional at the **data** layer even though
  the **code** no longer assumes survival.
- **The trade model flatters.** No slippage, fees, T+2, price bands, or position
  sizing. Entry at next open, exit at stop-first else 20th close. These are upper
  bounds.
- **The scanner defines no exit.** The 20-session horizon is the repo's existing
  `EXCURSION_HORIZON_SESSIONS`, adopted as a measurement choice — a different
  exit would produce different numbers, and the strategy has never specified one.
- **R is unreliable here** and percent return should be preferred throughout.

---

## 6. Requirements ledger

| # | Requirement | Status |
|---|---|---|
| 1 | Fix 3 biases (survivorship / look-ahead / tactical dating) | Done; #3 was a live production bug |
| 2 | No strategy or scanner logic changed | Held — diff touches replay, metrics, runner, tests only |
| 3 | Full breakdown: setups, win/stop, expectancy, MAE/MFE, by symbol/year/regime/gate | Done — §1, §2, §4 + artifacts |
| 4 | Test proving day-T reads nothing after T | Done, with its limits stated |
| 5 | Codex adversarial review before concluding | Done — 5 findings, 3 acted on |
| — | No parameter tuning before baseline completes | Held |

**Codex findings acted on:** the Gate 1 confound (§4, changed the conclusion),
the overclaimed proof comment (corrected in place), the verdict-precedence and
single-year-concentration bugs in `judgeEdge` (fixed, 1,169 tests green).
**Not acted on:** historical universe membership table, and per-session tactical
snapshots — both need data the database does not currently hold.

---

## 7. What follows — and what does not

**Do not tune parameters.** The baseline says the failure is not in the
thresholds; §4 says it may be in Gate 1's direction, which no threshold sweep
would surface.

Ordered by information gained per unit of work:

1. **Interrogate the Gate 1 inversion.** Is regime classification mislabelled,
   inverted, or proxying something else? Until this is understood, PASS is
   surfacing setups that have never earned anything.
2. **Fix the degenerate-stop floor.** `GATE2_MIN_RISK_TO_STOP_FRAC` = 0.3% admits
   stops that are untradeable after tick size and spread, and they dominate R.
3. **Backfill delisted symbols** to make the survivorship fix mean something in
   the data, not only in the code.
4. **Specify an exit.** The strategy currently has none; every result above
   depends on a horizon this document chose.
