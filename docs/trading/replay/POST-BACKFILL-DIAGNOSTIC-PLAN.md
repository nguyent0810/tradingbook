# Post-backfill replay diagnostic — plan

**Date:** 2026-08-24 · Committed **before implementation**, per §0
**Baseline:** `2c9b418` · **Anchor session:** 2026-08-21

This is a diagnostic and decision phase. No production behaviour changes, no M2
wiring, no D0–D5 change, no threshold tuning, no dependency upgrade.

---

## §0 Preflight — measured before this document was written

| | |
|---|---|
| latest settled session, VNINDEX | **2026-08-21** |
| latest settled session, equity | **2026-08-21** |
| VNINDEX bars | **4,082** · 2010-04-15 → 2026-08-21 (was 4,076) |
| equity bars | **707,513** · 2011-02-08 → 2026-08-21 (was 706,022) |
| symbols with bars | **355** (unchanged) |
| registry | 1,537 rows · **281 active** (was 242) |
| symbols trading on 2026-08-21 | **217** |
| symbols trading in the trailing month | 279 |

### Integrity

| check | result |
|---|---|
| duplicate `(symbol_id, date)` | **0** |
| duplicate index `(symbol, date)` | **0** |
| bars dated in the future | **0** |
| equity sessions with no VNINDEX bar | **0** |
| date regression / latest-session regression | none — both series advance to 2026-08-21 |
| OHLCV: non-positive price, negative volume, `high < low` | **0** |
| OHLCV: `open` or `close` outside `[low, high]` | **6,844** — see below |

### The 6,844, and why they do not block

They are **not** backfill damage:

- concentrated in **2018–2021** (6,544 of 6,844); 4 in 2025; **0 in the last 90 days**
- the failing predicates are `high < open` (2,149) and `low > open` (4,326) — the
  signature of `open` carrying a **reference price** rather than a traded open,
  which the repo's own fetcher documents for no-trade sessions
- the importer's usability rule (`fetch_stock_bars.py::_bar_is_usable`) requires
  only positive prices and `high >= low`. **These rows satisfy the system's own
  contract**; the check above was stricter than the system's
- **zero of them fall in the anchor window**, so the 2026-08-21 analysis is untouched

Recorded as a standing data-quality caveat, not a blocker.

### What the backfill actually did — and why nothing may be reused

The write ran **2026-08-21 13:52–13:54 UTC** and touched **41,026 rows dated back
to 2024-04-04**. It did not merely append six sessions; **it revised roughly two
years of history.**

> Every prior artifact — the 574-setup population, the S1 splits, the M1
> reconciliation — was computed on bars that have since been rewritten. All of it
> is recomputed from raw data here, and prior numbers are used only as a
> comparison target, never as an input.

**Preflight verdict: data integrity PASSES.** No STOP condition.

---

## §1 M1 rebuild — from raw, nothing cached

Re-run the M1 shadow pipeline over a **freshly built** setup population: re-scan
sessions with the production Gate 1 and Gate 2 evaluators, re-derive every D0–D5
input, and recompute the reconciliation. Report old versus new side by side and
explain every difference by data or sample composition.

## §2 Anchor — 2026-08-21, measured before D0–D5 is consulted

Market state is reconstructed **independently of the decomposition**:

- **index** — return, intraday range, close location in range, volume, volume vs MA20, MA20/MA50 state
- **breadth** — advancing / declining / unchanged counts and shares, A/D ratio, limit-up and limit-down counts, % above MA20, % above MA50
- **participation** — advancing vs declining volume, advancing-volume share, % of stocks with volume above their own MA20, cross-sectional median volume ratio
- **concentration** — whether the move is broad, sector-led, large-cap-led, or a limit-up cluster

**No regime label is assigned until the measurements justify it.**

### Limit-up detection — method fixed here

`exchange` is NULL for **1,498 of 1,537** registry rows and unknown for **178 of
the 217** symbols that traded on the anchor date, so the band cannot be read from
the registry. It is **inferred per symbol** from that symbol's own history:

1. compute the 99.5th percentile of daily close-to-close return over all bars **strictly before T**
2. snap it to the nearest Vietnamese band in {7%, 10%, 15%}
3. a session is limit-up when its return is within 0.5pp of that band

**Validation, reported before use:** the inference is checked against the 39
symbols whose exchange *is* known. If it does not recover their bands, the
limit-up statistic is reported as unreliable rather than used.

The method reads only bars before T, so it introduces no look-ahead.

## §3 What M1 saw on the anchor

Full decision traces `raw → D0 → D1 → D2 → D3 → D4 → D5` for setups on and around
2026-08-21, then aggregate counts and rejection reasons. The question — *did M1
see the participation the raw data shows, or did its primitives suppress it?* — is
answered with numbers, not inference.

## §4/§5 The two divergence populations, recomputed

Rebuild the `hidden → visible` and `visible → hidden` sets from scratch, then
attach forward outcomes: **T+1, T+3, T+5 returns, MFE, MAE, stop-hit-before-upside**,
and a normalised R only where legitimately computable.

**Control population, fixed now:** setups where V1 and the shadow **agree**, drawn
from the same sessions, so the comparison is not against the whole sample.

## §6 Regime cohorts — algorithmic, not hand-picked

Cohorts are defined by a rule applied to every session in the sample, and
2026-08-21 enters or does not enter on the same rule as every other date:

| cohort | rule, on the tradable universe |
|---|---|
| strong breadth | advancing share in the **top decile** of all sessions |
| ordinary | deciles 4–7 |
| weak | bottom decile |

Reported per cohort: signal count, visible rate, hidden→visible rate,
visible→hidden rate, volume-gate pass rate, and forward T+1/T+3/T+5 behaviour — as
**distributions**, not anecdotes.

## §7 Volume primitive — recomputed, then diagnosed

Recompute the median-vs-mean disagreement rate (previously 22.5%). Then determine
what the primitive is actually measuring — individual-stock confirmation, market
participation, sector participation, or a mixture — by correlating it against
market breadth across sessions. **No fix is applied in this phase.**

## §8 Capacity stays strict

`accountEquityVnd` and `portfolioOpenRiskVnd` remain **UNEVALUABLE**. No synthetic
equity, risk fraction or portfolio state enters any empirical conclusion.
Synthetic values appear only in unit tests already labelled as such.

## §9 Look-ahead

Every decision input must be available at or before T. Forward returns are outcome
labels only. A test is added that poisons all bars after T and asserts no decision
output changes.

## §11 Verdict — exactly one

`M2 GO` · `M2 GO WITH CONDITIONS` · `M2 NO-GO` · `DATA NO-GO`

**The bar this phase must clear**, fixed before the numbers arrive:

> Does the refreshed data provide empirical evidence that D0–D5 improves decision
> quality over V1 **without introducing a worse failure mode**?

Two ways to fail that are not "the numbers look bad":

- if `hidden → visible` setups perform no better than the agreement control, the
  decomposition produces more signals rather than better ones;
- if `visible → hidden` rejections are concentrated in strong winners during broad
  expansion, the decomposed stop model destroys value and that is a **worse
  failure mode**, which blocks M2 regardless of anything else.

Neither is tuned away. The thresholds above are not adjusted to make 2026-08-21
look correct.
