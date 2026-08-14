# Out-of-sample data availability audit

**Date:** 2026-08-14 · Phase 12 §0 · Frozen strategy SHA `4762d10`
**Rule:** written before any out-of-sample outcome exists, and before any
preregistration. Nothing here reads a label.

---

## Verdict: `NO TRUE OUT-OF-SAMPLE DATA AVAILABLE`

No candidate reaches `TRUE_OOS`. The phase stops at §0 and produces a forward
holdout protocol instead ([`FORWARD-OOS-PROTOCOL.md`](FORWARD-OOS-PROTOCOL.md)),
as §13 requires.

| candidate | classification | why |
|---|---|---|
| **A. Pre-2015 Vietnam history** | `UNUSABLE` | 158 setups, 72% of them from 2009–2010 and none from 2012–2013; MDE 11.0pp against a 6.2–7.5pp question and 14.4pp against a 13.8pp one; survivorship hole of unknown size pointing toward false confirmation |
| **B. Vietnam data after the research cutoff** | `UNUSABLE` (empty) | the cutoff is today; 4 sessions exist beyond the last setup |
| **C. A different market** | `UNUSABLE` | no data, no adapter, and porting the HOSE tick table and the VND liquidity floor would be strategy changes forbidden by §1/§17 |
| **D. Never-fetched Vietnam symbols, same period** | `CONTAMINATED` | 1,174 listed symbols were never fetched, but their history sits inside the era the hypothesis was discovered in |

Candidate A is the only real contender, and it fails on two grounds that were
**measured, not assumed** — after an independent review argued the first draft had
projected where it should have measured (Part II):

1. **A pre-2015 study would in practice be a 2009–2010 study.** Applying the
   frozen liquidity floor to real fetched bars for a random sample of today's
   listing, 72% of the eligible universe in 2009–2014 falls in those two years and
   2012–2013 come out empty. The frozen strategy has almost nothing to trade in
   the four years that adjoin the research sample.
2. **Even at its measured size the sample answers neither primary question**, and
   its survivorship hole cannot be sized, only shown to point toward confirming
   the edge — the one direction a validation sample must not lean.

---

## What the research sample actually is

| | |
|---|---|
| stock bars | 706,022 · 2011-02-08 → 2026-08-13 · 355 symbols |
| VNINDEX bars | 4,076 · 2010-04-15 → 2026-08-13 |
| source | `vnstock:VCI`, single source for every bar and every year |
| setups | 765 raw · 598 unique · 574 scored · 2015-01-22 → 2026-08-07 [^dedup] |
| symbol registry | 1,537 rows, 355 with any bars |

The baseline replay was run with **no `minSessionDate`**. Every session the
database holds — back to the MA50 warm-up in mid-2010 — was already scanned by
all eleven prior phases. The scanner produced **zero setups before 2015-01-22**.

[^dedup]: The prior phases report 596 unique and 572 scored. The audit script
reimplements the dedup rule with a calendar-day approximation of its 20-session
window and lands two setups higher. The difference is 0.3% and affects nothing
here — every quantity in this document is a ratio or an order of magnitude.

---

## A. Pre-2015 Vietnam history

### The data is fetchable

Probing the source directly (read-only, no import): **20 of 20** long-listed
symbols return continuous daily history well before the research window, several
from 2006-08-09, which is the source's floor rather than a listing date.

| | |
|---|---|
| VNM, REE, STB, GMD, KDC, PPC, VSH, SAM | 2,091 bars, 2006-08-09 → 2014-12-31 |
| FPT, SSI, PVD, DHG, TDH | ~2,000 bars from 2006-12 |
| HPG, VIC, HAG, VCB, BVH, MSN | 1,286–1,814 bars from 2007–2009 |

So candidate A is not blocked by data depth. It is blocked by four other things.

### Blocker 1 — the frozen liquidity floor excludes the pre-2015 market

`TRADABILITY_MIN_AVG_VALUE_VND_20` is a fixed **2,000,000,000 VND** of 20-session
average traded value, with a 100,000-share volume floor and a 10,000 VND price
floor. Measured against the bars actually stored:

| year | symbols with bars | ever cleared all three floors | share |
|---|---|---|---|
| 2011 | 2 | **0** | 0% |
| 2012 | 10 | **0** | 0% |
| 2013 | 24 | **0** | 0% |
| 2014 | 129 | **15** | 11.6% |
| 2015 | 146 | 18 | 12.3% |
| 2021 | 269 | 135 | 50.2% |
| 2025 | 342 | 108 | 31.6% |

Those early rows rest on 2, 10 and 24 symbols, so they prove nothing on their own
— a database that holds ten symbols cannot show that the eleventh was ineligible.
The floor was therefore **measured market-wide**, by fetching real pre-2015 OHLCV
for a deterministic random sample of **118 of today's 1,526 listed stocks** and
applying the frozen floors directly. No outcome is read; counting eligible symbols
is not scoring setups.

| year | sampled symbols trading | cleared all floors | share | implied market-wide |
|---|---|---|---|---|
| 2009 | 25 | 4 | 3.39% | **52** |
| 2010 | 42 | 9 | 7.63% | **116** |
| 2011 | 44 | 2 | 1.69% | 26 |
| 2012 | 46 | **0** | 0.00% | **0** |
| 2013 | 48 | **0** | 0.00% | **0** |
| 2014 | 51 | 3 | 2.54% | 39 |

**This is the finding that decides candidate A, and it is not the one expected.**
The pre-2015 eligible universe averages **38.8 symbols a year** — four times what
the database-only route implied — but **72% of it (168 of 233
eligible-symbol-years) sits in 2009 and 2010**, and 2012–2013 return zero eligible
symbols in a 118-symbol sample.

A "pre-2015 out-of-sample study" would therefore be, in practice, **a 2009–2010
study**: the post-crisis rebound and the small-cap bubble that followed it. Those
are the two years furthest from the research period, deepest inside the
unrecoverable-delisting window, and least comparable in market structure. The
four years that actually adjoin the research sample contribute almost nothing.

The index series shows why — its volume is market-wide matched volume and it is
complete from 2010:

| year | avg daily matched shares | avg index close | implied value vs 2021 |
|---|---|---|---|
| 2011 | 26,525,904 | 435 | **1.3%** |
| 2012 | 46,537,224 | 413 | 2.1% |
| 2013 | 59,332,443 | 490 | 3.2% |
| 2014 | 114,867,851 | 580 | 7.3% |
| 2015 | 102,201,530 | 580 | 6.5% |
| 2021 | 700,383,872 | 1,312 | 100% |
| 2025 | 945,266,903 | 1,468 | 151% |

In value terms the 2011 market was ~19% the size of 2015, 2012 ~32%, 2013 ~49%,
2014 ~112%. Turnover collapsed after 2010 and did not recover until 2014, which is
exactly where the measured eligibility goes to zero.

Lowering the floor to compensate is a strategy change, forbidden by §1 and §17.
Keeping it means the frozen strategy has almost nothing to trade in 2011–2014, and
what it can trade in 2009–2010 belongs to a different market. That is a property
of the strategy, not of the data.

### Blocker 2 — the measured sample still cannot answer either primary question

§6 requires this before, not after. Four measured inputs:

| input | value | measured from |
|---|---|---|
| month-level ICC of the continuation outcome | **0.0829** | the 574 scored in-sample setups over 119 months |
| symbol-level ICC | **0.0000** | same sample; symbol is not a cluster level |
| setups per eligible-symbol-year | **0.674** | 2015-2025, pooled; 0.45-1.17 by year |
| eligible symbols per year, 2009-2014 | **38.8** | the market-wide sample in blocker 1 |

Sample and minimum detectable effect over a six-year pre-2015 window:

| eligible/yr | setups | design effect | SE | MDE80 vs breakeven | MDE80 vs old era |
|---|---|---|---|---|---|
| 15 | 61 | 0.99 | 6.00pp | 16.80pp | 19.20pp |
| 25 | 101 | 1.03 | 4.77pp | 13.36pp | 16.28pp |
| **38.8 (measured)** | **158** | 1.10 | **3.93pp** | **11.01pp** | **14.42pp** |
| 40 | 162 | 1.10 | 3.89pp | 10.90pp | 14.33pp |
| 60 | 243 | 1.20 | 3.31pp | 9.27pp | 13.13pp |
| 90 | 364 | 1.34 | 2.86pp | 8.00pp | 12.27pp |

The questions being asked are **13.8pp** wide (old era 40.8% vs new era 27.1%)
and **6.2-7.5pp** wide (either era against the 33.3% breakeven).

At the measured universe the study gets **158 setups** - four times what the
database-only route suggested - and still answers neither question. It could not
tell 33% from 44%, which is the entire range the strategy lives in, and its
14.42pp resolution against the old era falls short of the 13.8pp era gap.
**H1 fails outright; H2 fails narrowly.**

Note which way the remaining uncertainty runs. The 0.674 setups per
eligible-symbol-year is measured on the database's own eligible symbols, which are
liquidity-curated and therefore *more* setup-prone than a marginal name that
scrapes past the floor. If anything the rate is generous, so 158 is an upper
estimate rather than a central one.

**And the 158 are not spread across the window.** Seventy-two per cent of the
eligible universe sits in 2009-2010, so roughly 114 of those setups would come
from two years and about 44 from the whole of 2011-2014, of which none at all from
2012-2013. A design that draws nearly three quarters of its evidence from the two
years least like the period under study is not a validation sample, whatever its
total N.

### Blocker 3 — survivorship runs toward false confirmation

The symbol list available today is today's list. `Listing().symbols_by_exchange()`
returns 1,526 stocks: HOSE 404, HNX 299, UPCOM 823.

Companies that left an exchange but were parked on UPCOM are still served —
CAD, VSG, VNH, SBS, HLA, VHG, MTG, BBT, PVX, ATA all return pre-2015 bars and all
carry an `exchange` label of `UPCOM` today, not the board they actually traded on
then. Companies that were **deregistered outright are gone**: of sixteen known
delistings checked by hand, **six (DVD, TRI, BAS, PVA, KSA, KSS) are absent from
the listing and return no history at all**.

This database shows how total that selection already is: of its 355 symbols with
bars, **only three (AVF, CTA, CYC) are absent from today's listing**. The
in-sample research universe is very nearly "companies still listed in 2026".

How large is the recoverable universe? A separate 118-symbol random sample of the
current listing, asked only whether pre-2015 bars exist:

| year | share of today's listing already trading | implied recoverable symbols |
|---|---|---|
| 2009 | 21.2% | 323 |
| 2011 | 37.3% | 569 |
| 2013 | 40.7% | 621 |
| 2014 | 43.2% | 660 |

Those are the survivors. **The denominator — how many were actually listed then —
cannot be recovered from any source this project can reach**, because the
companies that would supply it are precisely the ones the listing no longer
contains. The hand-check gives the only direct evidence of the loss rate, and it
is 6 of 16, but those sixteen were chosen for being memorable delistings and
cannot be treated as a random draw.

For 2015–2026 that was carried as an acknowledged limitation. For 2009–2014 it is
worse in both size and direction. That window contains the aftermath of the 2008
crash and the 2011–2012 credit and banking crisis — precisely when Vietnamese
small caps were deregistered in numbers. Excluding the companies that died
inflates continuation, which is the direction that would **falsely support** the
historical edge. A sample whose bias points at the answer we are trying not to
confirm is not a validation sample.

So the §4 guard *no current-universe leakage* **cannot be certified for candidate
A, and cannot be certified as failing either** — the size of the hole is unknown.
§4 says that an uncertifiable guard stops the phase, and it is right to: a bias of
unknown size pointing at the conclusion you are trying to test is worse than a
known large one.

### Blocker 4 (secondary) — the adjustment basis is era-dependent

Measured from the bars: the share of closes landing on a round 100 VND grid falls
monotonically with age.

| year | on 10 VND grid | on 100 VND grid |
|---|---|---|
| 2014 | 100.0% | **16.7%** |
| 2018 | 100.0% | 18.1% |
| 2022 | 100.0% | 25.0% |
| 2026 | 100.0% | **52.7%** |

Every bar in every year sits on a 10 VND grid, so the source re-grids after
adjusting and the tick table in `stop-feasibility.ts` is at least representable
in all years. But the falling 100-grid share is the adjustment cascade: old bars
have been back-adjusted through many more corporate actions, so they are further
from the prices anyone could actually have transacted at. A pre-2015 sample is
the **most** adjusted part of the series, which is where an executable-stop model
means least.

This is a caveat, not the blocker. Blockers 1–3 decide the question.

### Was pre-2015 ever used?

The bars were **inside the decision channel** of every prior phase — the replay
was run with no start date. No outcome was ever read from them, because no setup
existed.

One partial exception, recorded rather than glossed: the regime classification
phase carries an explicit `pre-2015` era label and classified sessions from
**2014-09-05** onward, so the last four months of 2014 have been described at the
market level. No setup, and therefore no outcome, exists in that window. A
pre-2015 study would need to end before 2014-09-05 or declare the overlap.

Strictly this makes candidate A `PARTIAL_OOS` rather than `CONTAMINATED`; it is
classified `UNUSABLE` on power and survivorship, which are the binding
constraints.

---

## B. Vietnam data after the research cutoff

| | |
|---|---|
| last stored bar | 2026-08-13 |
| last setup in the research sample | 2026-08-07 |
| today | 2026-08-14 |

**There is no unseen forward data.** The research sample runs to the present. A
forward holdout must be created by waiting, which is what §13 provides for.

---

## C. A different market

| | |
|---|---|
| non-Vietnam bars in the database | **0** |
| adapters | `vnstock:VCI` only, Vietnam-only by construction |
| alternative client installed | none (`yfinance` absent) |

Two of the frozen parameters are market-specific and could not survive the port
as adapter work:

- `tickSizeVnd()` in `src/lib/scanner/stop-feasibility.ts` encodes the HOSE tick
  table with an `"HOSE" | "HNX" | "UPCOM"` board type. Any other market needs a
  different table — a change to the stop-feasibility model, which §17 forbids.
- `TRADABILITY_MIN_AVG_VALUE_VND_20` is denominated in VND. Converting it is a
  threshold decision with no frozen answer.

The procedural objection is the weaker one, and it should not carry the decision.
The substantive one is that a cross-market run answers a **different question**.
The finding under test is that *this* strategy's edge decayed in *this* market
after 2022. Running it on Thailand or Taiwan establishes whether breakout-pullback
works there — interesting, and no evidence at all about why a Vietnamese edge
disappeared. §12 recognises this by capping any such result at
`CROSS-MARKET EXTERNAL VALIDATION` rather than validation.

Building a second market's pipeline remains a legitimate future project. It is a
larger undertaking than this phase authorises, and §0 explicitly forbids choosing
a market merely because data could be had.

---

## D. Never-fetched Vietnam symbols — named because it is not OOS

| exchange | listed today | in this database | never fetched | fetched share |
|---|---|---|---|---|
| HOSE | 404 | 123 | **281** | 30.4% |
| HNX | 299 | 50 | **249** | 16.7% |
| UPCOM | 823 | 179 | **644** | 21.7% |
| **total** | **1,526** | **352** | **1,174** | 23.1% |

The 1,174 names are listed in
[`oos/never-fetched-symbols.json`](oos/never-fetched-symbols.json).

Eleven phases ran on under a quarter of the listed market. Fetching the rest
would add setups in the same calendar period — which is the period the era-decay
hypothesis was discovered in, so it is **`CONTAMINATED` for validation**. It
cannot answer the phase's question and must not be presented as if it could.

It is recorded here for one reason: it is the only identified route to more
setups per era, and the previous phase concluded that power, not analysis, is
what blocks attribution. That makes it a candidate for a **future power
extension**, explicitly labelled as in-sample, not for this phase.

---

## Data quality notes carried forward

Applies to any future work on this database, in-sample or not:

- Single source, single adjustment convention, no cross-source blending — good.
- `exchange` is NULL for 1,498 of 1,537 registry rows, and where present it is
  **today's** board. Board-dependent logic falls back to the HOSE tick table,
  which is the finest and therefore the most permissive — an unknown board can
  never reject a setup for a tick reason it would not have faced.
- Volume is raw share count against adjusted prices. Traded value computed as
  `close × 1000 × volume` therefore mixes bases; the error grows with adjustment
  depth, i.e. with age, in the same direction as blocker 4.
- 9 symbols stop at 2024 and 7 at 2025 — dead names retained, correctly, rather
  than pruned.
- Guest API quota on the source is 20 requests/minute, so any universe rebuild is
  a metered job (~1,500 symbols ≈ 75 minutes minimum).

---

## What §0 concludes

The honest reading is not "the data is contaminated". It is narrower:

> **The only sample that could validate this strategy without touching one of its
> parameters is Vietnam, forward, from today.** Backwards, the frozen liquidity
> floor puts 72% of the tradable universe into 2009–2010 and the
> resulting 158 setups resolve nothing at the 6–14pp precision the questions need;
> sideways, into another market, the tick table and the VND thresholds do not
> apply and the question changes.

That is what [`FORWARD-OOS-PROTOCOL.md`](FORWARD-OOS-PROTOCOL.md) freezes — and
what it costs, roughly a decade, is the most consequential number this phase
produced.

---

# Part II — Independent review

**Reviewer:** Gemini 3.1 Pro via `agy`, 2026-08-14, 20 attack vectors. Verdict:
*"a repeated pattern of using theoretical assumptions to avoid empirical work…
you have substituted weak linear extrapolations for ground truth."*

That charge is largely fair, and the response was to go and measure. Three of the
review's findings are refuted by data, four are upheld and have changed this
document or the forward protocol, and two are rejected on substance.

**The verdict survives, but the argument under it is not the one first written.**
The measurement the review demanded produced a pre-2015 eligible universe roughly
four times larger than the extrapolation claimed — and revealed that 72% of it
sits in 2009–2010, which the extrapolation had not shown at all. Power now
carries less of the load and sample composition carries more.

## Refuted — the design effect was never inflated

The review's CRITICAL finding 10 says the pre-2015 standard errors were computed
by "applying a high-N cluster penalty to a low-N environment", inflating SE and
MDE "to justify calling it underpowered".

The design effect is `1 + (m − 1)·ICC` with `m` = setups per cluster. At 61 setups
over 72 months, `m` = 0.85, so:

> **design effect = 0.987.** Clustering *reduced* the standard error, from 6.03pp
> to 6.00pp.

That number — 0.99 — was in the table the reviewer was given. The criticism
contradicts its own input, and the correction it proposes ("recalculate assuming
m ≤ 1, which will drastically shrink your MDE") is what the calculation already
did, to three hundredths of a percentage point.

## Refuted — symbol is not a cluster level

MEDIUM finding 18 asks for two-way symbol × month clustering because overlapping
trades in one symbol are not independent. Measured on the 574 scored setups:

| cluster level | clusters | mean size | ICC | design effect |
|---|---|---|---|---|
| month | 119 | 4.82 | 0.0829 | 1.317 |
| quarter | 47 | 12.21 | 0.0609 | 1.683 |
| **symbol** | 112 | 5.13 | **0.0000** | **1.000** |

112 symbols contribute up to 16 setups each, and the within-symbol correlation of
the continuation outcome is exactly zero. The dedup rule already removes
same-symbol repeats at the same breakout level within 20 sessions; what survives
carries no dependence. Two-way clustering would add nothing.

The same measurement did surface something the reviewer did not ask for:
**quarter clustering is more conservative than month**, and the forward protocol
has been changed to use it.

## Refuted — the forward snapshot is not survivorship-biased

HIGH finding 4 calls the frozen 355-symbol snapshot "massive survivorship bias"
because those companies "are known to have survived until late 2026".

Survivorship bias is conditioning on survival *through* the test window. The
snapshot conditions on being alive at the *start* — which is exactly what a trader
on 2026-08-14 can see, and symbols that die during the holdout stay in and count
as failures. The reviewer's proposed fix (a dynamic universe) would reintroduce
the curation leak the snapshot exists to close.

The reviewer's underlying worry is nonetheless real in a different form: a
ten-year holdout frozen to 355 names drifts away from the market a real trader
faces. The protocol now admits new listings **mechanically**, on the first session
they clear the frozen floors, with no human decision anywhere in the path.

## Upheld and acted on — measure, don't project

CRITICAL findings 8, 12 and 20 all make one point: the eligible-symbol count for
2009–2014 was extrapolated from index turnover under an assumed linear scaling,
using a database that covers 30% of HOSE, and *"you spent more effort calculating
why Candidate A shouldn't be run than it would have taken to simply run it."*

Correct on all three counts. Counting eligible symbols reads no outcome, so it
was never blocked by §17. It has now been measured directly, by fetching real
pre-2015 OHLCV for a random sample of today's listing and applying the frozen
floors — the table in blocker 1 above.

**The measurement moved the number, and the argument.** The eligible universe came
out at ~39 symbols a year rather than the ~9 the extrapolation implied, and the
projected sample at **158 setups rather than 61**. Two of the review's three
CRITICAL findings on this point are therefore upheld: the linear scaling was
wrong, and the database-limited counts were circular.

What the measurement also showed is that the extrapolation was wrong in a way that
does not rescue candidate A. Seventy-two per cent of that universe is in
2009-2010, 2012 and 2013 are empty, and at 158 setups the MDE is 11.0pp against a
6.2-7.5pp question and 14.4pp against a 13.8pp one. **The verdict stands on a measurement
that contradicts the projection it replaced**, which is the only reason it is
worth anything.

## Upheld and acted on — quarter clustering, attrition, and a futility look

- **Cluster level** (from the measurement above): the forward test's governing
  inference is now quarter-level, raising the minimum from 516 setups to **753**
  and the wait from 6.6 years to **9.7**.
- **Attrition** (HIGH 16): measured at **1.7% of symbols per year** — 16 of the
  355 have already stopped trading. Over a decade that is ~15% of the universe,
  putting the realistic wait at **10–11 years**.
- **Single-look design** (HIGH 17): a decade-long single look is indefensible if
  the strategy is losing money throughout. One **futility-only** interim look is
  now pre-specified at 234 setups (~3 years). Futility only, so no alpha is spent
  on the efficacy side.

## Upheld in principle, verdict unchanged

- **HIGH 9 — the setup rate may not transport backwards.** True; 2008–2012 was a
  different volatility regime. The observed rate ranges 0.45 to 1.17 setups per
  eligible-symbol-year across eleven years including the 2022 bear. At the top of
  that range the projected sample still fails both questions, so the conclusion is
  robust across the entire observed range.
- **HIGH 1 — the code was exposed to pre-2015 data.** Fair. Indicator maths and
  filters ran over those bars in every phase. No outcome was read, but the claim
  of a virgin environment is not available, and §0 already records the separate
  2014-09-05 regime-classification overlap.
- **HIGH 15 — candidate D is a valid cross-sectional holdout.** This is what the
  audit already says: `CONTAMINATED` for the era-decay hypothesis, legitimate as a
  power extension. The reviewer's "run it" and the audit's classification are the
  same recommendation with different labels.

## Rejected on substance — relaxing the floor, and porting the market

HIGH 13 and CRITICAL 14 propose adjusting the 2 bn VND liquidity floor for the
smaller pre-2015 market, and converting it plus the tick table for a foreign
exchange, calling the refusal "absurd" and "a technicality".

The review contradicts itself here. Under vector 3 it writes: *"Altering the
liquidity floor … **is** technically a parameter change, and it **does** introduce
researcher degrees of freedom. You correctly identified that freezing the strategy
guarantees no new leakage."* Both cannot hold.

The substantive objection is stronger than the procedural one. The 2 bn VND floor
is not a tuning constant — it is what makes a position executable for a real
account at this project's sizing. A "top 30% of market volume" floor in a market
one-twentieth the size selects names that cannot absorb the position at all, so
relaxing it does not test this strategy; it tests a different one that could never
have been traded. And a cross-market run answers *"does breakout-pullback work in
Thailand"* — a question no one asked — not *"why did this Vietnamese edge decay"*.

§12 anticipated exactly this and caps any such result at
`CROSS-MARKET EXTERNAL VALIDATION`. That remains a legitimate future project. It
is not this phase, and it is not a substitute for out-of-sample validation of the
finding under test.

---

## Verdict after review: `NO TRUE OUT-OF-SAMPLE DATA AVAILABLE` — retained

Retained, on a stronger basis than it was first written. The review's central
charge — that the phase projected where it could have measured — was correct, the
measurement was taken, and it **contradicted the projection by a factor of four**
while leaving the conclusion intact for a different reason than the one first
given.

What changed as a result:

| | first draft | after review |
|---|---|---|
| pre-2015 eligible symbols/yr | ~9 (extrapolated) | **38.8 (measured)** |
| projected pre-2015 setups | 61 | **158** |
| why candidate A fails | power alone | **sample composition** (72% from 2009–2010, 2012–2013 empty) **and** power |
| forward minimum | 516 setups / 6.6 yr, month-clustered | **753 / 9.7 yr, quarter-clustered** |
| forward realistic wait | 6.6 yr | **10–11 yr** with measured attrition |
| forward design | single look | single look **+ pre-specified futility look at ~3 yr** |

## §16 — strategy decision gate

Per the phase brief this is a recommendation. **Nothing is implemented, no
parameter moves, and no strategy v2 is proposed.**

§16 routes `OOS UNDERPOWERED` to "do not open another discovery phase; move to a
forward holdout". `NO TRUE OUT-OF-SAMPLE DATA AVAILABLE` lands in the same place,
and the forward protocol is frozen. But the protocol's own arithmetic is what
should drive the decision:

> A forward test at the current setup rate needs **about a decade** to resolve
> whether the continuation rate clears breakeven, and the earliest any honest
> answer arrives is the ~3-year futility look — which can only tell you the
> strategy is bad, never that it is good.

Ten years of live exposure is not a measurement cost that a −0.18 ATR in-sample
expectancy justifies paying. The decision on the strategy should therefore be made
on what is already established, not deferred to the holdout:

- the continuation rate fell from 40.8% to 27.1%, which at a 2:1 structure moves
  expectancy from +0.22 to −0.18 ATR;
- eleven phases failed to attribute that decay to any stock-level or market-level
  variable available in this project;
- the twelfth phase establishes that no data exists to validate it out-of-sample
  without waiting a decade or changing a frozen parameter.

That combination is a `REDESIGN OR ABANDON` case, and it does not become a
different case by waiting. The forward protocol is worth freezing anyway — it
costs nothing today, and if the strategy is ever run again the evidence will
accumulate under rules written before anyone saw the answer.

## New hypotheses observed, not tested

Per §17, recorded and stopped:

- `NEW HYPOTHESIS — NOT TESTED`: Vietnamese market turnover collapsed after 2010
  and did not regain its 2010 level until 2014, then rose twentyfold by 2021. The
  strategy's eligible universe tracks that curve almost exactly (0 symbols in
  2012–2013, 18 in 2015, 135 in 2021). Whether continuation rates track market
  turnover rather than calendar era is untested, and could not be tested here
  because the eras and the turnover regimes coincide.
- `NEW HYPOTHESIS — NOT TESTED`: the adjustment cascade means older bars sit
  further from transactable prices, monotonically. Whether that biases measured
  MFE/MAE with sample age is untested.
