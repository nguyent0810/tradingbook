# Scanner Zero Setup Candidates — Diagnostic Report

## Executive summary

After universe expansion (300 active symbols, stable scanner execution), **`setupCandidatesCreated` stays `0` because no symbol produces a Gate 2 Tier A or B candidate under current rules, after tradability.** There is **no evidence of a persistence bug**: `candidateCountA`, `candidateCountB`, and `candidateCountSurfaced` are all zero on the latest run, matching inserted rows.

Under **Gate 1 WARNING**, only **Tier A** setups surface (Tier B is suppressed). The latest audit shows **zero Tier A and zero Tier B** among symbols that pass tradability, so surfaced count must be zero.

## 1. Scanner pipeline (what runs)

1. **Expected session** — `getExpectedLatestSessionFromIndexBars` aligns evaluation to the latest **VNINDEX** `IndexDailyBar` date (not wall-clock “today”).
2. **Tradability** — per-symbol filters on history depth, liquidity (20D volume + traded value), minimum price, **latest bar date vs expected session**, and max calendar gap between consecutive bars. See `src/lib/scanner/tradability.ts` and `src/lib/scanner/tradability-constants.ts`.
3. **Gate 2** — `evaluateBreakoutPullbackCandidate` on OHLCV series for tradable symbols only. See `src/lib/scanner/gate2/breakout-pullback.ts`.
4. **Gate 1 surfacing** — WARNING regime surfaces **A only**; PASS surfaces A and B; FAIL surfaces none. Implemented in `filterCandidatesByGate1Level` in `src/lib/scanner/gate2/collect-candidates.ts`.
5. **Persistence** — `SetupCandidate.createMany` runs only for the surfaced list (empty when surfaced count is zero).

## 2. Evidence — latest persisted scan (300-symbol ramp)

Source: most recent `DailyScanRun` row (as of diagnostic).

| Metric | Value |
|--------|------:|
| `symbolCountTotal` | 300 |
| `symbolCountAfterTradability` | 34 |
| `symbolCountFilteredOut` | 266 |
| `candidateCountA` | 0 |
| `candidateCountB` | 0 |
| `candidateCountSurfaced` | 0 |
| `setupCandidatesCreated` | 0 |
| `gate1Level` | WARNING |

**Tradability breakdown** (counts are **per failing reason**; one symbol can increment multiple keys):

| Reason (stable message) | Count |
|-------------------------|------:|
| 20D average traded value below 2,000,000,000 VND | 250 |
| 20D average volume below 100,000 shares | 229 |
| Latest bar date does not match expected last session | 121 |
| Latest close below 10,000 VND | 113 |
| Gap between consecutive bars exceeds 21 calendar days | 66 |
| Insufficient history: need >= 120 daily bars | 5 |

Interpretation:

- **Liquidity / size**: value and volume failures dominate (many symbols are thin vs playbook floors).
- **Data freshness**: **121** stale-session failures — consistent with partial “latest-session bar” coverage observed operationally (~177/300 symbols aligned to expected session in ramp notes); symbols without a bar on the VNINDEX session date fail `STALE_DATA`.
- **Price floor**: 113 hits on minimum nominal close (after unit conversion via `equityPriceToVnd`).
- **Series quality**: 66 gap failures (suspensions or patchy feeds).

## 3. Evidence — Gate 2 on tradable symbols only

Command: `npx tsx scripts/gate2-audit.ts` (current DB state during this diagnostic).

| Metric | Value |
|--------|------:|
| Active symbols (tradability scan) | 300 |
| Passed tradability | 34 |
| Gate 2 Tier A | 0 |
| Gate 2 Tier B | 0 |
| Gate 2 INVALID | 34 |

**INVALID counts by terminal bucket** (`invalidCountByCategory`):

| Category | Count |
|----------|------:|
| `trend_below_ma50` | 23 |
| `breakout_recency` | 4 |
| `trend_ma20_below_ma50` | 4 |
| `breakout_not_holding` | 2 |
| `pullback_zone_interaction` | 1 |

So **every tradable symbol fails Gate 2** on this snapshot. The dominant blocker is **early trend filter** (close vs MA50 / MA20–MA50 structure), not persistence.

## 4. Bucket mapping (requested taxonomy)

| Bucket | Where it appears | Evidence |
|--------|------------------|----------|
| No bars / insufficient depth | Tradability | `Insufficient history: need >= 120 daily bars` → **5** mentions |
| Stale / no latest session | Tradability | `Latest bar date does not match expected last session` → **121** mentions |
| Liquidity filter | Tradability | Volume **229**, value **250** mentions |
| Price floor | Tradability | `Latest close below 10,000 VND` → **113** mentions |
| Gap / bad series | Tradability | Calendar gap **66** mentions |
| Trend / regime (Gate 2) | Gate 2 INVALID | `trend_below_ma50` **23**, `trend_ma20_below_ma50` **4**, plus structure failures |
| Gate 2 template (breakout/pullback/volume/zone) | Gate 2 INVALID | `breakout_recency` **4**, `breakout_not_holding` **2**, `pullback_zone_interaction` **1** |
| Gate 1 surfacing | Post Gate 2 | WARNING → **only Tier A** surfaces; with **0 A and 0 B**, nothing can surface |

There is **no separate “volatility/range” tradability bucket** — range/extension checks live inside Gate 2 after trend gates.

## 5. Top three blockers (ranked)

1. **Tradability funnel** — Only **34 / 300** symbols reach Gate 2. Liquidity/value thresholds and **stale-session alignment** remove most names before any breakout-pullback logic runs.
2. **Gate 2 trend gate** — Among the **34** survivors, **23** fail at **below MA50** (long-bias swing template). No symbol reaches a valid Tier A/B scoring state.
3. **Gate 1 WARNING × Tier A only** — Even if Tier B setups existed, they would **not** surface under WARNING; today **A and B are both zero**, so this is a secondary constraint but important for product expectations.

## 6. Root cause classification

| Hypothesis | Verdict |
|------------|---------|
| Data freshness / bar date mismatch vs VNINDEX session | **Strong contributor** — 121 stale-session failures; ramp noted only **177/300** symbols with a bar on latest session date. |
| Overly strict filters (vs intentional playbook) | **Plausible for supply** — liquidity + value + trend gates are tight by design; they explain near-zero funnel. |
| Market regime / template mismatch | **Strong** — INVALID dominated by trend_below_ma50; market snapshot does not match long breakout-pullback shape. |
| Bug in candidate persistence | **Ruled out** — pre-surface counts `candidateCountA`/`candidateCountB` are zero; nothing to insert. |
| Scoring bug | **Not indicated** — diagnostics consistent with explicit INVALID reasons; no crash or partial write pattern. |

## 7. Recommended next actions (safest order)

1. **Improve data freshness coverage** (no rule change): prioritize fetching/importing so **more active symbols have a daily bar on the same calendar date as latest VNINDEX bar**, then re-run scan. This attacks the **121** stale failures directly.
2. **Keep playbook filters unchanged** until freshness is addressed: loosening liquidity/trend without measurement risks false positives relative to the locked playbook.
3. **Optional diagnostics visibility** (later, non-UI options): e.g. persist aggregated “stale vs liquidity vs Gate2 trend” counts on each run for quicker ops review — **document-only for now** per scope.

If, after freshness improves, tradability passes materially more symbols but Gate 2 INVALID remains trend-dominated, interpret as **genuine “no template-fit” regime** rather than pipeline failure.

## 8. Commands used for this report

- Latest run metrics: Prisma read of newest `DailyScanRun` (`tradabilityBreakdown`, candidate counts).
- Gate 2 breakdown: `npx tsx scripts/gate2-audit.ts`.

## Reference — Gate 1 surfacing rule

```13:21:d:\Tools\Trading\src\lib\scanner\gate2\collect-candidates.ts
export function filterCandidatesByGate1Level(
  gate1Level: Gate1Level,
  candidates: SetupCandidate[]
): SetupCandidate[] {
  if (gate1Level === "FAIL") return [];
  if (gate1Level === "WARNING") {
    return candidates.filter((c) => c.quality === "A");
  }
  return candidates;
}
```
