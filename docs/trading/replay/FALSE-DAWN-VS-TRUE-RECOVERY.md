# False dawn vs true recovery

**Date:** 2026-08-12 · Research only — nothing gated, tuned or wired into production
**Basis:** 2,981 usable sessions → **86 recovering episodes** (37 false dawns in total)
**Data:** [`recovery/internals.ndjson`](recovery/internals.ndjson) · [`recovery/episodes.json`](recovery/episodes.json)

---

## Verdict: `INCONCLUSIVE / UNDERPOWERED`

Not "these internals do not separate the two" — the sample cannot support that
claim either. **Nine false dawns in 2022–2026 and thirteen in 2015–2021** is too
few to establish or refute anything of ordinary size. The narrowest confidence
interval among the leading-indicator tests spans ~25 percentage points.

What the study does support:

| | |
|---|---|
| Measured **at episode start**, no internal separates the classes | breadth level, breadth slope, new lows, advance/decline, volume expansion, up-volume share, leader count, dispersion — all CIs contain zero, in both eras |
| **Early-leader survival** does separate them | but it is measured *inside* the resolution window, so it is coincident, not leading |
| The one apparently-leading result is era-specific and reverses | `newLowsSlope5`: −2.14 in 2015–2021 (CI [−4.35, −0.19]) and **+1.68** in 2022–2026 |

**Two of fourteen comparisons cleared 95%, and both flip sign in the other era.**
Under fourteen independent nulls the expected number of false positives is 0.7
and the chance of seeing at least one is about 51% — so two era-specific,
sign-flipping hits is close to what noise produces. That is a reason to discount
them, not proof they are noise.

---

## Defects found and corrected in this study

Reported because they materially changed the numbers, and the first version of
this document was wrong:

| defect | effect | fix |
|---|---|---|
| **Era mis-bucketing** | everything before 2022 was labelled "2015–2021", sweeping in **39 episodes from 2011–2014** — a third of the sample | three buckets; pre-2015 reported separately |
| **Meaningless early breadth** | the stored universe was **3 symbols in 2012**, 35 in 2014; breadth over three names was being averaged into era statistics | sessions with a universe under 100 symbols are excluded outright (first usable session **2014-09-05**) |
| **Stale-bar contamination** | a symbol's last bar was carried forward onto sessions it did not trade, counting suspended and not-yet-listed names as participants in advance/decline, volume expansion and up-volume share | a symbol must have traded on the exact session to be counted |

Episode count fell from 118 to 86 as a result.

---

## Sample: the binding constraint

| era | episodes | true recovery | false dawn | unresolved | median length |
|---|---|---|---|---|---|
| pre-2015 | 7 | 3 | 4 | 0 | 2 sessions |
| 2015–2021 | 41 | 27 | 13 | 1 | 3 sessions |
| 2022–2026 | 38 | 28 | 9 | 1 | 3 sessions |

**Median episode length is 3 sessions.** A contiguous run of RECOVERING states is
a micro-regime — the index poking above its MA10 for a few days — not what a
trader would call a recovery attempt. This definition can support statements
about "contiguous recovering-state runs"; it does not honestly support
statements about "recovery attempts" without additional structure.

### The labels are not stable

An episode is a true recovery if the index reclaims MA50 within `horizon`
sessions and holds `hold` consecutive sessions; a false dawn if it first drops 3%
below the episode's starting low. Both constants are declared, not searched — and
they move the answer a great deal:

| horizon | hold | true | false | unresolved | true rate |
|---|---|---|---|---|---|
| 30 | 15 | 32 | 34 | 20 | 48% |
| **40** | **10** | **58** | **26** | **2** | **69%** |
| 60 | 5 | 79 | 6 | 1 | 93% |

The "true recovery" rate ranges from **48% to 93%** depending on what "held"
means. Any finding not robust across this table describes the definition rather
than the market.

---

## The eight questions, answered

Medians per class. Positive = higher in true recoveries. **None of the
start-of-episode measures separates the classes** once episodes are the
resampling unit.

| # | Question | era | true | false | diff | CI excludes 0? |
|---|---|---|---|---|---|---|
| 1 | Does breadth keep expanding? (%>MA10 over 5) | 15–21 | 6.01 | 1.64 | +4.37 | no [−0.53, +10.79] |
| | | 22–26 | 9.36 | −1.85 | **+11.21** | no [−5.96, +16.73] |
| 2 | Sequential MA20 expansion? (%>MA20 over 5) | 15–21 | 5.17 | 3.69 | +1.48 | no |
| | | 22–26 | 5.42 | 5.66 | −0.24 | no |
| 3 | Do new lows contract? (change over 5) | 15–21 | −1.00 | +1.00 | **−2.00** | **yes** [−4.35, −0.19] |
| | | 22–26 | 0.00 | +3.00 | −3.00 | no [−3.52, +8.64] — **and the mean reverses** |
| 4 | Does leadership broaden? (distinct leaders) | 15–21 | 3.00 | 4.00 | −1.00 | no |
| | | 22–26 | 7.00 | 6.00 | +1.00 | no |
| 5 | Does volume breadth confirm? (% expanding) | 15–21 | 43.70 | 41.03 | +2.67 | no |
| | | 22–26 | 38.94 | 40.76 | −1.82 | no |
| | up-volume share, first 5 sessions | 15–21 | 57.62 | 48.57 | +9.05 | no [−2.42, +11.56] |
| | | 22–26 | 55.47 | 50.56 | +4.91 | no [−3.93, +12.40] |
| 6 | Does the index reclaim hold? | — | *this is the label, not a predictor* | | | — |
| 7 | Leader survival, 5 sessions | 15–21 | 57.14 | 68.33 | −11.19 | no |
| | | 22–26 | 78.89 | 33.33 | **+45.56** | yes — **but coincident, see below** |
| | Leader survival, 10 sessions | 15–21 | 75.00 | 33.33 | **+41.67** | — |
| | | 22–26 | 60.95 | 20.83 | **+40.12** | — |
| 8 | Dispersion (20d return IQR at start) | 15–21 | 9.77 | 8.69 | +1.08 | no |
| | | 22–26 | 9.28 | 11.26 | −1.98 | no |

Also null: advance/decline at start (1.57 vs 1.73; 1.57 vs 1.15) and the %>MA10
*level* at start (53.31 vs 49.38; 50.06 vs 49.07). **A recovery that holds does
not begin from broader participation than one that fails.**

---

## Leader survival: coincident, not leading — and not worthless

Survival at 10 sessions is the one measure pointing the same way in both eras
(+41.7 and +40.1 median). It is also the most contaminated:

- flags occur throughout an episode; survival is read 5–10 sessions later
- the median episode **resolves at session 12**, and 22% resolve within 5
- so "the leaders were still alive" and "the recovery worked" substantially
  overlap as observations

Restricting to episodes that had **not yet resolved** when survival was measured:

| | all episodes | still unresolved at measurement |
|---|---|---|
| surv5, 2022–2026 | +33.66 [+8.63, +57.23] ✓ | +21.81 **[−4.68, +50.03]** |
| surv10, 2022–2026 | +30.16 [+10.47, +48.51] ✓ | +29.50 **[−0.34, +56.36]** |

Significance goes with the overlap. But **this restriction is not free**: it
conditions on the episode surviving, which removes exactly the fast-failing false
dawns that matter most, and it leaves n=17–27. So the correct reading is:

> Survival cannot be used as a day-one predictor. It may still be a **conditional
> continuation signal** — "on day 10, among recoveries still alive, are the early
> leaders holding?" — and at this sample size that question is open, not closed.

An earlier version of this document called survival worthless. That was an
over-correction; the honest position is that it is not usable for the purpose
asked (deciding risk *before* the fact) and is unresolved for a different purpose
(scaling risk *as* the episode develops).

---

## What this does and does not say

**It does not say false dawns are indistinguishable.** With 9–13 false dawns per
era, a real effect would have to be enormous to clear the noise.

**It does say the obvious candidates are exhausted at this sample size.** Breadth
level, breadth slope, new lows, advance/decline, volume expansion, up-volume
share, leader count and dispersion were the natural first places to look.

**The base rate is the most useful number.** Under the central definition, **69%
of recovering episodes resolved upward**. Any discriminator has to beat that, and
none of the eight does. It is also a reminder that false dawn is the *minority*
class — the case where small samples fail worst.

---

## If this is to be answered properly

1. **More false dawns**, which means more history or the 1,182 symbols with no
   stored bars — not more features.
2. **A stronger episode definition.** Three sessions of poking above MA10 is not
   a recovery attempt. Requiring a minimum length, a minimum prior drawdown, or a
   structural higher-low would produce fewer, more meaningful episodes — at the
   cost of an even smaller sample.
3. **Pre-register the discriminator and the label together.** The sensitivity
   table shows how much freedom exists in "held".
4. **Test at a fixed decision point.** "Day 10, conditional on not having
   resolved" is a well-defined moment a risk rule could act on. That framing is
   what the survival result needs, and at n=17 it cannot yet support it.

---

## Validation

| Requirement | Status |
|---|---|
| Point-in-time features | All internals from bars ≤ T; symbol must have traded that session |
| Ex-post labels isolated | Labels use forward index data by construction, never inputs to a feature |
| Feature/label window overlap | **Found and corrected** — the significant result sits inside the resolution window |
| Label robustness | Reported across 9 (horizon, hold) combinations |
| Resampling unit | Episodes — sessions within an episode are not independent |
| Multiplicity | 14 comparisons, uncorrected, disclosed; expected false positives 0.7, P(≥1) ≈ 51% |
| Universe adequacy | Sessions with fewer than 100 traded symbols excluded |
| Eras reported separately | Three buckets, pre-2015 isolated |

### Limits

- **The episode definition is the weakest part**, and it is definitional rather
  than empirical: `RECOVERING` is the union of three MA-relative states, so a
  contiguous run is a micro-regime, not a trader-recognisable structure.
- **The 3% false-dawn barrier interacts with the start point.** An episode
  starting from a volatile low has a different distance to that barrier than one
  starting from a tight base, so the label partly measures the geometry of the
  start, not only future failure.
- **Volume breadth is a proxy.** Daily OHLCV has no aggressor side; "% trading
  above their own 20-session median volume" says nothing about who was buying.
- **Dispersion is universe-wide**, not leaders-versus-rest within a matched
  sector or size band.
- **Survivorship.** 1,182 of 1,537 symbols have no stored bars, so all breadth is
  breadth of the stored universe.
