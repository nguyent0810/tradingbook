# Cross-sectional market state + early leadership study

**Date:** 2026-08-12 · Research only — no gate, threshold, flag or production path changed
**Scan:** entire point-in-time universe, 4,024 sessions, **147,088 observations**, **0 guard violations**
**Data:** [`leadership/observations.ndjson`](leadership/observations.ndjson) · [`leadership/sessions.ndjson`](leadership/sessions.ndjson)

---

## Verdict: `NO EVIDENCE` for Probe → Confirm

The question has two parts and they do not get the same answer. Reporting one
combined verdict would hide that, so both are stated:

| claim | verdict |
|---|---|
| An early flag arrives sooner and sits nearer the structural stop | **SUPPORTED** — in both eras |
| Acting on that flag earns more than waiting for Gate 1 | **NO EVIDENCE** |
| Therefore: adopt a Probe → Confirm architecture | **NOT SUPPORTED** |

The hypothesis cohort — *market recovering + early leadership* — looks promising
in 2022–2026 and **harmful in 2015–2021**:

| | leader | control | difference |
|---|---|---|---|
| 2015–2021 recovering | +0.82% (n=270) | +2.04% (n=5,710) | **−1.23pp** |
| 2022–2026 recovering | +1.59% (n=472) | +0.25% (n=10,738) | **+1.34pp**, p=0.034 naive |

> **Timestamp caveat, stated here because it bears on this table:** features are
> computed at T's close and forward returns run from T's close. A tradable
> version would enter at the T+1 open. These figures are therefore optimistic by
> one overnight gap and are **not** directly comparable to the v2 baseline, which
> enters at the open.

Three independent reasons the positive result does not carry:

**1. It reverses sign across eras.** A feature that helps in one half and hurts
in the other is the signature of noise.

**2. The flags are not independent, at any level.** 472 flags occur on only 131
distinct sessions, across 95 symbols and **25 calendar months**. Widening the
resampling unit dismantles the result:

| resampling unit | units | 95% CI on mean fwd20 (2022–2026) |
|---|---|---|
| observations (naive) | 472 | [+0.18, +2.99] — excludes zero |
| sessions | 131 | [−1.17, +4.14] |
| symbols | 95 | [−0.45, +3.50] |
| **calendar months** | **25** | **[−4.08, +6.01]** |
| calendar quarters | 16 | [−2.11, +5.27] |

Only the naive interval excludes zero. The true number of independent market
episodes behind 472 flags is closer to 16–25 than to 472.

**3. ~40 cuts were reported.** At uncorrected α=0.05, two spurious "significant"
results are expected. p=0.034 would need α=0.00125 to survive Bonferroni.

### On "chosen before outcomes"

The leadership definition was fixed before this study's outcome tables were
computed, and the scan covers the whole universe rather than any pre-picked name.
But it is **not preregistered**: it was chosen by me, in this repo, having
already read the 2022 regime diagnostic. Cohort membership uses within-session
quantiles rather than fixed levels — and a quantile is still a choice, and a
five-condition conjunction is still a model. The honest claim is *"not optimised
against outcomes inside this study"*, not *"unfitted"*.

---

## A. Market states — Gate 1 cannot see any of this

Seven states, classified from ordinal relations only (where the index sits
against its own MA10/20/50 and which way MA20 points). No magnitude threshold
exists to fit.

| state | sessions 15–21 | sessions 22–26 | %>MA10 | %>MA20 | new lows | struct improving |
|---|---|---|---|---|---|---|
| DETERIORATING | 403 | 212 | 35.4 / 28.7 | 32.5 / 26.4 | 5 / **15** | 17.6 / 14.1 |
| STABILIZING | 186 | 78 | 42.4 / 37.0 | 39.3 / 35.1 | 3 / 13 | 23.6 / 19.6 |
| EARLY_RECOVERY | 134 | 76 | 52.4 / 54.0 | 39.8 / 35.7 | 2 / 8 | 21.5 / 21.0 |
| APPROACHING_MA50 | 242 | 87 | 56.0 / 59.4 | 51.9 / 53.5 | 3 / 8 | 33.3 / 35.9 |
| FRESH_MA50_RECLAIM | 237 | 157 | 57.4 / 60.1 | 52.3 / 53.4 | 4 / 7 | 31.6 / 34.4 |

Internals separate these cleanly: 35.4% of names above MA10 while deteriorating
versus 56.0% while approaching MA50, and in 2022–2026 new lows run 15 vs 8.

**Gate 1 assigns them all the same label:**

| state | PASS | WARNING | FAIL |
|---|---|---|---|
| DETERIORATING | 0.0% | 61.1% | 38.9% |
| STABILIZING | 0.0% | 54.5% | 45.5% |
| **EARLY_RECOVERY** | **0.0%** | **90.3%** | 9.7% |
| APPROACHING_MA50 | 0.0% | 87.6% | 12.4% |

A market falling apart and a market recovering toward its MA50 are both
"WARNING". PASS is structurally impossible below MA50, because PASS requires
close > MA50. This is the blind spot the 2022 diagnostic inferred, now measured
directly.

---

## B/C. Features and cohorts

Leadership was defined before this study's outcome tables were computed (see the
caveat above on what that does and does not mean), from the three ingredients the
hypothesis names: RS inflecting *from behind* (level < 0, 5-session slope > 0,
and in the session's own top quintile of slope), structure taken back
(undercut-reclaim or a fresh MA10 reclaim), and price above MA10. The RS
component is a within-session rank rather than a fixed level — which removes one
kind of fitting, not all of it.

RS lookbacks (`RS_LOOKBACK_20/50`), forward horizons (5/10/20), the excursion
horizon (20) and the stop buffer are all existing repo constants.

| cohort (fwd20 from signal close) | n | median | mean | 95% CI | MFE/\|MAE\| | stop |
|---|---|---|---|---|---|---|
| **2015–2021** | | | | | | |
| deteriorating + no leadership | 9,547 | +1.11% | +1.71% | [+1.47, +1.97] | 1.08 | 48.2% |
| deteriorating + leadership | 153 | −1.36% | −0.59% | [−2.56, +1.38] | 0.76 | 36.6% |
| recovering + no leadership | 5,710 | +1.76% | +2.04% | [+1.75, +2.33] | 1.72 | 26.2% |
| **recovering + early leadership** | 270 | +1.11% | **+0.82%** | [−0.33, +1.96] | 1.16 | 27.0% |
| **2022–2026** | | | | | | |
| deteriorating + no leadership | 20,378 | +0.34% | −0.06% | [−0.24, +0.12] | 0.96 | 54.3% |
| deteriorating + leadership | 444 | −0.98% | −1.01% | [−2.43, +0.40] | 0.84 | 39.0% |
| recovering + no leadership | 10,738 | +0.50% | +0.25% | [−0.00, +0.51] | 1.28 | 31.1% |
| **recovering + early leadership** | 472 | +1.62% | **+1.59%** | [+0.19, +3.02] | 1.19 | 26.9% |

**Leadership while the market is still deteriorating is negative in both eras**
(−2.31pp and −0.95pp versus control). Only the *recovering* cell is positive, and
only in the second era.

---

## D. Outcomes, and what confirmation actually costs

Paired on the **same symbol**: each early-leader flag matched to that symbol's
next session under Gate 1 PASS.

| | 2015–2021 (n=270) | 2022–2026 (n=466) |
|---|---|---|
| lead time to PASS | 14 sessions (p25 5, p75 21) | 8 sessions (p25 4, p75 21) |
| price move in between (median) | +0.94% | **+2.11%** |
| already up >5% by PASS | 25.6% | **35.2%** |
| already up >10% by PASS | 12.2% | **21.7%** |
| stop distance at flag | 9.79% = **2.95 ATR** | 12.89% = **2.65 ATR** |
| stop distance at PASS | 10.43% = **3.90 ATR** | 13.85% = **3.85 ATR** |
| fwd20 from flag | +0.82% | +1.69% |
| fwd20 from PASS | **+2.04%** | +1.01% |

**The entry-quality claim holds in both eras.** Waiting for Gate 1 costs roughly
one ATR of stop distance (2.65 → 3.85), because price has advanced while the
structural low has not moved. In 2022–2026 the median name is already 2.11%
higher and one in five is up more than 10%.

**The return claim does not.** Entering early was *worse* in 2015–2021 (+0.82%
vs +2.04% from PASS) and better in 2022–2026 (+1.69% vs +1.01%) — the same sign
flip as the cohort table.

| | 2015–2021 | 2022–2026 |
|---|---|---|
| top-decile hit rate, recovering + leader | **5.2%** | **18.4%** |
| top-decile hit rate, recovering + control | 9.3% | 9.9% |
| false start (stopped within 20), leader | 27.0% | 26.9% |
| false start, control | 26.2% | 31.1% |

Leaders stop out no more often than controls — the earlier entry is not more
fragile. But in 2015–2021 the flag was *half as likely* as chance to produce a
top-decile winner, and in 2022–2026 nearly twice as likely. Again, both directions.

---

## E. Case study — found by the scan, not chosen first

FPT and FRT were inspected only after the universe-wide scan, from whatever it
had already flagged.

**FRT: zero observed sessions.** It never entered the point-in-time tradable
universe in this database, so the motivating example cannot be tested at all.

This makes the FPT/FRT question **unanswerable, not answered in the negative.**
Nothing below should be read as "the pattern does not exist" — only as "half of
the pattern that prompted this study is absent from the data, and the other half
produced six flags in eleven years."

**FPT: 6 flags in recovering states**, 4 of 6 positive:

| date | state | close | rs20 | stop dist | fwd20 | lag to PASS |
|---|---|---|---|---|---|---|
| 2022-07-25 | APPROACHING_MA50 | 51.78 | −0.07 | 4.71% | +1.64% | +6d, price −0.5% |
| 2022-07-26 | APPROACHING_MA50 | 51.41 | −2.75 | 4.02% | +2.61% | +5d, price +0.2% |
| 2025-04-14 | EARLY_RECOVERY | 99.74 | −3.43 | 18.29% | +5.49% | +18d, price +0.9% |
| 2025-04-15 | EARLY_RECOVERY | 97.64 | −2.65 | 16.53% | +4.31% | +17d, price +3.0% |
| 2026-04-09 | APPROACHING_MA50 | 77.24 | −0.80 | 9.47% | **−9.84%** | +2d, price −2.9% |
| 2026-07-07 | APPROACHING_MA50 | 73.20 | −3.76 | 5.19% | −2.32% | no PASS in 120d |

Six flags over eleven years is not a strategy; it is an anecdote with a
confidence interval too wide to draw.

### False positives — the mandatory counterweight

**44.1% of all flags had a negative 20-session forward return — in both eras.**

| worst outcomes 2022–2026 | date | state | fwd20 |
|---|---|---|---|
| API | 2022-10-18 | EARLY_RECOVERY | **−57.48%** |
| ANV | 2022-10-18 | EARLY_RECOVERY | −52.77% |
| API | 2022-10-19 | EARLY_RECOVERY | −52.42% |
| CEO | 2022-10-18 | EARLY_RECOVERY | −52.37% |
| ANV | 2022-10-19 | EARLY_RECOVERY | −49.30% |
| CMX | 2022-10-18 | EARLY_RECOVERY | −49.27% |

Every one of the six worst outcomes fired on **the same two sessions**. The flag
did not identify six independent mistakes; it identified one, six times, at the
worst possible moment — a false dawn mid-decline. This is precisely the
correlation that makes the naive confidence interval wrong, and it is the central
risk of a probe that fires when the market looks like it is turning.

---

## F. Answers

| # | Question | Answer |
|---|---|---|
| 1 | Does *market recovering + early leadership* have real predictive value? | **No evidence.** Positive only in 2022–2026, negative in 2015–2021, and every clustering level beyond naive contains zero — month blocks give [−4.08, +6.01] |
| 2 | Does it exist only in 2022–2026? | **Yes — which is the problem.** In 2015–2021 it underperformed its control by 1.23pp |
| 3 | Does it buy an entry nearer the structural stop? | **Yes.** 2.65 vs 3.85 ATR in 2022–2026; 2.95 vs 3.90 in 2015–2021. This is the one claim that holds in both eras |
| 4 | Is the entry advantage worth the false-start rate? | **Cannot be answered** — false-start rates are the *same* (26.9% vs 31.1%), but the return edge that would have to pay for it is not established |
| 5 | Is RS inflection better than RS absolute high? | **No.** 2015–2021: top RS quintile +2.90% with a 10.1% stop rate, versus +1.31% for RS-improving-from-behind. 2022–2026 both are ≈0 |
| 6 | Does absorption/reclaim add value after controlling RS + state? | **No.** With-reclaim beats without in 2022–2026 (+1.43% vs −0.56%) and loses in 2015–2021 (+0.35% vs +1.68%) — another sign flip |
| 7 | Enough to propose Probe → Confirm? | **No — `NO EVIDENCE`** |

### Why the split verdict, and why not a single hedge

The geometry result (#3) is consistent, sizeable and present in both eras, and
leaders do not stop out more often — something real is being measured about
*when* the flag fires. Calling the whole study `INCONCLUSIVE` on the strength of
that would be a hedge, because the thing a Probe → Confirm architecture would
need is a return edge, and there is none: the sign flips between eras, every
honest clustering level contains zero, and the six worst outcomes fired on two
consecutive sessions.

An earlier draft of this document did exactly that — reported `INCONCLUSIVE`
overall. That conflated a supported geometric claim with an unsupported
predictive one, and it is corrected here.

### What would settle it

1. **Cluster-aware power.** 131 distinct flag sessions is the true sample size.
   Increasing it means more history or a broader universe, not more symbols per
   day.
2. **Pre-register the leadership definition** and test it on data not used here.
   Every definition in this document was chosen before outcomes were examined,
   but it was chosen *by me*, on this repo, with the 2022 diagnostic already read.
3. **Separate the two claims.** "Earlier entry sits nearer the stop" is testable
   independently of "early entry earns more", and only the second needs an edge.

---

## G. Validation

| Requirement | Status |
|---|---|
| Point-in-time guards | **0 violations** over 4,024 sessions |
| No future data in any feature | Enforced by construction (`end`-bounded reads) and proven by test: every feature recomputed on truncated input at 6 different end indices returns identical output |
| RS definition matches the repo | Test asserts agreement with `computeRelativeReturnAtSession` to 9 decimals |
| No threshold optimised on outcomes | Correct as stated: nothing was tuned against a result. **Not** the same as unfitted — the top-quintile cut and the five-condition conjunction are both choices |
| Separate eras reported | Throughout |
| Universe composition | Whole point-in-time universe every session; **not** a fixed-symbol cohort — see limits |
| Outcomes via outcome channel only | `guard.outcomeRows` for all forward reads |

### Limits

- **Timestamp convention.** Features are computed at T's close and forward
  returns run from T's close. A tradable version enters at the T+1 open, which
  the replay's trade model does; the figures here are therefore optimistic by one
  overnight gap and are not directly comparable to the v2 baseline.
- **Not a fixed-symbol cohort.** The universe grows across the window, so era
  comparisons carry composition drift. The paired same-symbol confirmation-lag
  analysis (§D) is immune to this; the cohort tables are not.
- **Survivorship.** 1,182 of 1,537 symbols have no stored bars. FRT's total
  absence is the visible face of this.
- **Absorption is a proxy, not order flow.** Daily OHLCV has no bid/ask or
  aggressor side. Lower-wick ratio and close-location value are consistent with
  absorption and equally consistent with several other things.
- **Multiplicity.** ~40 cuts reported; nothing here is corrected for that, and
  the one "significant" result would not survive correction.
- **Effective sample size.** 472 flags rest on ~25 calendar months of market
  episodes. Adding more symbols per day would not help; only more history, or a
  universe reaching the 1,182 symbols with no stored bars, would.
