# Scanner Edge — Reality Check on 3 Months of Production Data

**Date:** 2026-08-11 · **Data:** live Neon production, queried read-only
**Period:** 2026-05-04 → 2026-08-10 (~98 trading days, 144 scan runs)
**Reviews:** Codex CLI, two passes (one on the findings, one on the fix in §6)

> **Verdict: not battle-ready.** Not because the strategy is proven bad — because with 6 signals
> it cannot be proven anything. The system currently has no way to measure whether it has an edge.
> That is a more fundamental problem than not having one, and it is fixable in months, not years.

---

## 1. The funnel

```
281 active symbols
  → 281 scanned
  →  75 pass tradability      (206 filtered = 73%)
  → 0–1 Gate 2 candidates per day
  →   6 unique setups in 3 months
  →   0 SetupOutcome rows          ← the feedback loop has never closed once
```

Scan runs by Gate 1 regime:

| Gate 1 | runs | avg candidates surfaced | surfacing rule |
|---|---|---|---|
| WARNING | 98 | 0.12 | Tier A only |
| **PASS** | **30** | **0.00** | **Tier A and B** |
| FAIL | 16 | 0.00 | nothing |

**Zero setups in the healthiest regime, which is also the most permissive one.** Not a surfacing
artifact — Gate 2 genuinely found nothing during PASS. Mechanism in §4.

### Tradability rejections (latest run; reasons overlap)

| reason | symbols |
|---|---|
| 20D avg traded value < 2,000,000,000 VND | 154 |
| 20D avg volume < 100,000 shares | 139 |
| Latest close < 10,000 VND | 60 |
| Insufficient history (need ≥120 bars) | 42 |
| **Latest bar ≠ expected session** | **40** |
| Gap between bars > 21 calendar days | 7 |

Those 40 are rejected for **stale data**, not for being untradeable. A pipeline failure is
currently being counted as a market fact.

---

## 2. What the 6 signals actually did

`ref` = close on the signal bar. `stop` = the scanner's own `stop_level`.

| symbol | signal | ref | stop | risk | max up | max down | ret→30d | stop hit |
|---|---|---|---|---|---|---|---|---|
| DCL | 2026-08-07 | 39.20 | 37.72 | 3.9% | +3.1% | -0.8% | +1.0% | — (1 bar only) |
| VND | 2026-07-08 | 18.70 | 17.82 | 4.9% | -0.5% | -20.3% | **-11.0%** | +5d |
| BVB | 2026-07-03 | 13.50 | 13.07 | 3.3% | +3.0% | -11.9% | **-8.9%** | +19d |
| CSM | 2026-06-25 | 12.80 | 12.38 | 3.4% | +13.7% | -5.1% | **+10.9%** | **+5d, then rallied** |
| DHC | 2026-06-18 | 38.05 | 36.09 | 5.4% | -8.4% | -18.5% | **-16.7%** | **next day** |
| CTR | 2026-05-28 | 90.00 | 86.13 | 4.5% | -9.9% | -20.1% | **-17.6%** | **next day** |

**Respecting the system's own stops, all five judgeable signals lost.** The one name that went up
(CSM, +10.9%) was stopped out on 2026-06-30, two days before it moved. Two signals died the very
next session.

Paper Lab reproduced this independently: CSM **-1.00R** (STOP_LOSS_HIT), VND **-1.14R**. Zero wins.

**This is 6 observations. It is not evidence that the strategy is bad. It is evidence that
nothing can be concluded yet.** See §5.

---

## 3. Relative Strength is not wired into the signal path

`run-daily-scan-job.ts` imports nothing RS-related. `rs-rank-term.ts` is never called outside
tests. `rs-scoring-v1`, `rs-rank-evidence`, `rs-watchlist-snapshot`, `rs-near-miss-watchlist`,
`load-rs-diagnostics` are all diagnostic lanes.

A large, well-tested body of RS work has **zero effect on which symbols get surfaced**. Either
wire it in as a gate or rank term, or stop maintaining it as if it were live.

---

## 4. Why entries are structurally late — and why PASS produces nothing

Both follow from the entry logic, not from bad luck.

**Entry location.** The pullback-zone check (`breakout-pullback.ts:306`) rejects only when
`lastBar.low > pullbackZoneHigh || close < pullbackZoneLow`. So a bar qualifies if it merely
*touches* the zone intraday and closes anywhere above the zone floor — including far above it.
Combined with `GATE2_MAX_BREAKOUT_EXTENSION_FRAC = 0.05`, entry is permitted up to **5% above the
breakout level**.

That is buying strength after a bounce, not buying at the zone. Stop is anchored at
`minLowSinceBreakout × 0.99`, i.e. below the swing low. Buy high, stop low — exactly the shape
that produces next-day stop-outs like DHC and CTR.

**Gate 1 inversion.** `evaluateMarketRegime` returns PASS only when the index closes above MA50
**and the last three closes are strictly rising**. Gate 2 simultaneously requires an individual
stock to be *pulling back*. Those are opposite conditions in time: during a three-day index rally,
fewer stocks sit in a pullback. The two gates are asking for contradictory market states.

`3 rising closes` is also too crude to be a regime model at all.

---

## 5. Can this be measured faster than "wait years"? — Yes, but not by waiting

At the observed rate — roughly **0.0013 signals per tradable-symbol-day** — waiting produces about
2 signals/month. Reaching 100–200 independent events would take **4–8 years**.

**But signal count does not have to accumulate forward in live time.** The constraint is stored
history, and that is an acquisition problem, not a waiting problem.

**Measured this session:** `vnstock` returns **1,987 bars per symbol going back to 2018-08-24 —
eight years** — for FPT, HPG and VNINDEX alike. Production currently stores only ~219 bars/symbol
(~10 months).

| history available | tradable-symbol-days | est. raw signals |
|---|---|---|
| today's stored ~220 bars | ~11,000 | **~14** (≈8–12 independent after de-clustering) |
| 3 years | ~52,000 | ~65–75 |
| **8 years (what vnstock serves)** | **~144,000** | **~185** |

At the current ingest pace (3.2s/symbol), backfilling 8 years for 281 symbols is roughly
**15–25 minutes of fetching**. That converts "wait 4–8 years" into "run a backfill job."

### The traps that would invalidate a naive replay

| trap | severity | correction |
|---|---|---|
| **Survivorship** — universe is `active = true` with no effective dating | **invalidates** performance claims | effective-dated `SymbolListingHistory`; until then label results "current-survivors only" |
| **Mixed adjustment basis** — avg 26.9 bars/symbol not rewritten in 90+ days, 280/281 symbols affected | **invalidates** pattern replay near actions | one consistent full rewrite of OHLC history, or exclude stale windows |
| **Point-in-time tradability** — computed on today's data | look-ahead | recompute per replay session from bars available then |
| **Tactical-universe additions** — included before their real add dates | selection bias | effective-date tactical rows, or exclude from validation |
| Adjusted price × raw volume in traded value | approximate liquidity only | use raw close for traded value |

A full-history refetch fixes the adjustment basis and the depth problem in the same job.

### Parameter changes worth sweeping, with falsification criteria

Pre-register these before running, so the sweep cannot be rationalised after the fact.

1. **Tighten `GATE2_MAX_BREAKOUT_EXTENSION_FRAC` from 5% → 2–3%.**
   *Falsified if* signal count collapses without a material improvement in 5/10/20-day forward
   returns and maximum adverse excursion.
2. **Require the close inside/near the zone**, not just an intraday touch: test
   `close <= pullbackZoneHigh` (or `× 1.01`).
   *Falsified if* it removes winners without reducing adverse excursion or failed breakouts.
3. **Shorten `GATE2_BREAKOUT_RECENCY_BARS` from 10 → 5–7**, or require the first valid zone
   interaction within N sessions of the breakout.
   *Falsified if* later setups show equal or better forward returns than fresh ones.

---

## 6. Fixed in this pass: the scan ran twice every day

`vercel.json` crons `/api/cron/daily-scan` at 14:00 UTC; `production-bar-import.yml` calls the same
endpoint after the import (~12:30 UTC). Neither had a guard.

Production confirms **2 COMPLETED runs on nearly every trading day** (2026-07-30 had 3). So
`setup_candidates` holds 12 rows for 6 setups and `paper_trades` 4 rows for 2 trades — **every
aggregate over those tables was double-counted.** The Arena's reported -8,797,848 VND realised P&L
is really about -4,398,924.

**Fix shipped:** `DailyScanRun.expectedSessionDate` + a guard that skips when that session already
has a COMPLETED run. FAILED runs do not block the backup trigger — that is what the backup is for.
`SCAN_FORCE_RERUN=1` overrides for manual ops. Migration backfills 108 of 144 historical rows from
`notes → sessionCoverage → expectedSessionDate` (authoritative, not a `run_at` heuristic); 36
legacy rows stay NULL and are invisible to the guard, which is correct.

Known limit, deliberately deferred: this is check-then-insert, not a DB constraint. The two
triggers are ~1.5h apart and the route caps at `maxDuration = 300`, so they cannot overlap; a
manual hit landing on a running scan still could. Closing it needs a partial unique index or an
advisory lock, plus a decision on what `SCAN_FORCE_RERUN` should mean.

**Historical duplicates are not deleted.** Analytics must de-duplicate until someone decides
whether to clean them.

---

## 7. What to do, in order

**Make it measurable (nothing below this line is about profit):**

1. ~~Idempotency guard~~ ✅ done in this pass.
2. **Backfill 8 years of OHLCV** for the full universe in one consistent pass. This simultaneously
   fixes history depth *and* the mixed adjustment basis.
3. **Persist `SetupOutcome` automatically** for every signal: forward returns at 5/10/20/30d, stop-hit
   date, MFE/MAE, R-multiple. Without this the loop stays open no matter how many signals arrive.
4. **Separate "untradeable" from "data stale"** in the tradability reasons, so 40 symbols stop being
   misclassified as illiquid.
5. **Effective-date the universe** (`SymbolListingHistory`) so replays are point-in-time.
6. **Point-in-time replay** over the backfilled history → target ~150–200 raw events.

**Only then, make it profitable:**

7. Run the three pre-registered sweeps in §5.
8. Rework entry location (buy at the zone, not after the bounce).
9. Replace Gate 1's "3 rising closes" with a regime model that matches the setup's lifecycle.
10. Wire RS into the signal path or retire it.
11. Shadow-trade for several months to confirm execution, slippage and T+2 reality before real money.

---

## 8. Honest limits of this analysis

- **6 signals cannot support any conclusion about edge.** Everything in §2 is descriptive, not
  inferential. The stop-out pattern is *consistent* with the late-entry diagnosis in §4; it does
  not prove it.
- **Forward returns here are unadjusted for the duplicate-run bug in the source rows** — the
  duplicates are exact copies, so per-signal figures are unaffected, but any count-based aggregate
  in older reports is not.
- **The ~185-signal estimate for 8 years extrapolates today's rate and today's 75 tradable symbols.**
  Historically fewer symbols would have passed tradability, so treat it as an upper bound.
- **`SetupOutcome` being empty means no measured hit-rate exists at all** — not a low one.
