# Scanner algorithm map

Authoritative reference for the **current** daily scanner pipeline (as implemented in code). This document describes behavior only — it does not change rules. For operational diagnostics see also `scanner-zero-setup-diagnostic.md` and `scanner-rules-market-comparison-audit.md`.

**Last aligned with code:** Batch A–C (pipeline + coverage + explainability) + Batch F (dashboard copy alignment).

---

## Pipeline diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INGEST (scheduled / manual)                                              │
│  fetch_vnindex.py → import-bars.ts        → IndexDailyBar (VNINDEX)     │
│  fetch_stock_bars.py → import-stock-bars.ts → StockDailyBar             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SESSION ANCHOR                                                           │
│  getExpectedLatestSessionFromIndexBars() → latest VNINDEX bar date (UTC) │
│  (NOT wall-clock "today")                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ UNIVERSE                                                                 │
│  loadEffectiveScanUniverse(): StockSymbol.active ∪ TacticalSymbol       │
│  Deduped, sorted A→Z; optional SCAN_SYMBOL_LIMIT → first N symbols      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TRADABILITY (hard filters, per symbol)                                   │
│  evaluateTradabilityForSymbolId → passed | failed + reasons[]           │
│  → sessionCoverage metrics on scan (stale fraction / weak coverage warn)  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │ passed only
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GATE 2 — breakout-pullback template                                      │
│  evaluateBreakoutPullbackCandidate → A | B | INVALID + rankScore        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GATE 1 SURFACING (market regime, scan-time)                              │
│  FAIL → surface 0 | WARNING → A only | PASS → A + B                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PERSIST + DIAGNOSTICS                                                    │
│  DailyScanRun + SetupCandidate; notes JSON (Gate2 + decision + coverage) │
│  Post-scan: setup-health watch sync                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD / SETUPS (read-only RSC)                                       │
│  parseDailyScanGate2Notes → buildMarketFreshnessDto → buildDecisionCockpitDto │
└─────────────────────────────────────────────────────────────────────────┘
```

**Entry points:** `scripts/run-daily-scanner.ts`, `GET /api/cron/daily-scan` (`src/app/api/cron/daily-scan/route.ts`), GHA `production-bar-import.yml`.

**Core orchestrator:** `runDailyScanJob` in `src/lib/scanner/run-daily-scan-job.ts`.

---

## Session model

| Concept | Implementation |
|--------|----------------|
| Expected session | `getExpectedLatestSessionFromIndexBars(prisma)` — max `IndexDailyBar.date` for `VNINDEX` |
| Equity alignment | Latest `StockDailyBar` per symbol must match expected session for tradability **pass** |
| UTC calendar day | Bars deduped by `YYYY-MM-DD` UTC (`sortDedupeGate2Bars`, `sortAndDedupeBarsByDate`) |
| Delayed backdrop | When max equity bar date **>** VNINDEX session → `benchmarkBackdrop.delayedBackdrop` on scan notes |
| Weak coverage (Batch B) | When ≥35% of evaluated symbols fail `STALE_DATA` (and universe ≥5) → `sessionCoverage.weakCoverage` + UI warnings |

Import order runbook: refresh VNINDEX before trusting Gate 1 / session anchor (`docs/trading/production-data-alignment-runbook.md`).

---

## Universe selection

| Source | Rule |
|--------|------|
| Core | `StockSymbol` where `active = true` |
| Tactical | `TacticalSymbol` active, `activeForScanner`, `expiresAt > now` |
| Merge | `computeEffectiveScanUniverse` — tactical must resolve to `StockSymbol` row |
| Order | Alphabetical by symbol |
| Cap | `SCAN_SYMBOL_LIMIT` env → `symbols.slice(0, N)` **after** merge (biased to A-prefix tickers) |

Files: `src/lib/tactical-universe.ts`, `src/lib/effective-universe-export.ts`.

---

## Tradability hard filters

Applied **before** Gate 2. Constants: `src/lib/scanner/tradability-constants.ts`. Logic: `evaluateTradability` in `src/lib/scanner/tradability.ts`.

| Check | Threshold |
|-------|-----------|
| History depth | ≥ 120 daily bars |
| 20D avg volume | ≥ 100,000 shares |
| 20D avg traded value | ≥ 2,000,000,000 VND (`close × 1000 × volume`) |
| Latest close | ≥ 10,000 VND nominal (`equityPriceToVnd`) |
| Latest bar date | Must equal expected VNINDEX session |
| Calendar gap | No consecutive bar pair > 21 calendar days apart |

Stable reason keys: `TRADABILITY_REASON.*` (used in scan breakdown and coverage).

**Gate 2 never runs** for symbols with `passed: false` (including stale).

---

## Gate 1 — market regime

Sources: `src/lib/playbook/gate1-market.ts`, `getMarketRegimeFromDb`.

Inputs: last 50+ VNINDEX daily closes; MA50; last 3 closes momentum (strict rise/fall).

| Level | Condition |
|-------|-----------|
| **PASS** | Close > MA50 (bullish) **and** 3-bar momentum up |
| **FAIL** | Close < MA50 (bearish) **and** 3-bar momentum down |
| **WARNING** | All other cases (including &lt;50 bars → WARNING with message) |

Gate 1 is evaluated at scan time and stored on `DailyScanRun.gate1Level`. Dashboard may also show **live** regime (`getMarketRegimeFromDb` on page load); cockpit prefers scan-run Gate 1 when a scan exists (`resolveCanonicalGate1`).

---

## Gate 2 — breakout-pullback template

Implementation: `evaluateBreakoutPullbackCandidate` in `src/lib/scanner/gate2/breakout-pullback.ts`. Constants: `src/lib/scanner/gate2/constants.ts`.

### Structure (ordered)

1. ≥ 50 bars; latest bar date = expected session  
2. Close ≥ MA50; MA20 ≥ MA50  
3. Breakout in last **10** bars (`GATE2_BREAKOUT_RECENCY_BARS`), bar index ≤ L−1: close > prior **20**-day range **high** (`GATE2_RANGE_DAYS`)  
4. Digestion: post-breakout low &lt; breakout-day close  
5. No close below breakout level from breakout through today  
6. No mid-pullback close below MA50 (before today)  
7. Swept breakout-day low + close &lt; MA20 → invalid  
8. Two consecutive closes under pullback zone floor → invalid  
9. Current bar must interact with pullback box  
10. Volume: today / median(prior 20 vols) ≥ **1.2** (`GATE2_VOL_RATIO_B`)  
11. Extension above breakout ≤ **5%** (`GATE2_MAX_BREAKOUT_EXTENSION_FRAC`)  
12. Pullback depth below breakout ≤ **4%** (`GATE2_MAX_PULLBACK_DEPTH_FRAC`)  
13. Stop = min low since breakout × (1 − **1%** buffer); structure validation including min risk-to-stop **0.3%** (`GATE2_MIN_RISK_TO_STOP_FRAC`)

### Pullback zone

- High = breakout level (range high)  
- Low = max(breakout × (1 − 2%), MA20) (`GATE2_DELTA_PULLBACK`)

### Quality tiers

| Tier | Rule |
|------|------|
| **A** | vol ratio ≥ **1.5** (`GATE2_VOL_RATIO_A`) and close ≥ MA20 |
| **B** | Valid but not A (still ≥ 1.2× vol) |
| **INVALID** | Fails any check above |

### rankScore formula (summary)

`computeGate2RankScore` (INVALID → 0):

```
rankScore = 1000 × min(volRatio, 3)
          + 100 × min(max(0, extension%), 50)
          +  50 × min(max(0, (close−MA50)/MA50 %), 50)
          − 200 × min(pullback depth fraction, 1)
```

Caps: `GATE2_RANK_VOL_CAP`, `GATE2_RANK_EXT_CAP`, `GATE2_RANK_MA_CAP`, `GATE2_RANK_DEPTH_CAP`.

### Rank explainability (Batch C — behavior unchanged)

`computeGate2RankBreakdown` in `src/lib/scanner/gate2/rank-components.ts` returns the same `rankScore` as `computeGate2RankScore`, plus:

| Field | Meaning |
|-------|---------|
| `volumeTerm` | `1000 × min(volRatio, cap)` |
| `extensionTerm` | Capped extension % above breakout |
| `maDistanceTerm` | Capped % above MA50 |
| `depthPenalty` | Capped pullback depth under breakout |
| `inputs` | Raw vol ratio, extension %, MA distance %, depth fraction |

Persisted on new scans inside `SetupCandidate.reasons` when using v1 JSON:

```json
{ "v": 1, "lines": ["…human reasons…"], "rankComponents": { … } }
```

Legacy rows remain a plain `string[]` of reason lines — parsers accept both (`parseSetupCandidateReasons`).

**UI:** Setups candidate expand shows full breakdown; dashboard opportunity board shows a one-line `rankSummary` when present.

---

## Gate 2 rejection codes (Batch C)

Stable codes are set on every new INVALID evaluation (`terminalCode` on `BreakoutPullbackEvaluation`). Codes match diagnostic bucket keys (`TerminalCategory`).

| Code | Typical terminal message theme |
|------|--------------------------------|
| `insufficient_bars` | &lt; 50 bars |
| `stale_or_session_mismatch` | Latest bar ≠ expected VNINDEX session |
| `ma_compute` | MA20/MA50 unavailable |
| `trend_below_ma50` | Close below MA50 |
| `trend_ma20_below_ma50` | MA20 &lt; MA50 |
| `breakout_recency` | No breakout in recency window |
| `digestion` | No dip below breakout-day close |
| `breakout_not_holding` | Close back under resistance |
| `mid_pullback_below_ma50` | Mid-pullback under MA50 |
| `swept_breakout_weak_close` | Swept breakout low + weak close |
| `pullback_zone_two_closes` | Two closes under zone floor |
| `pullback_zone_interaction` | Not in pullback box |
| `pullback_zone_malformed` | Zone floor &gt; ceiling |
| `volume_median_bad` | Median volume unusable |
| `volume_ratio` | Participation below 1.2× |
| `extension_cap` | Extension above breakout cap |
| `depth_cap` | Pullback depth cap |
| `stop_structure` | Stop/entry structure invalid |

**Backward compatibility:** Old scan notes and evaluations without `terminalCode` still classify via `inferGate2RejectionCodeFromMessage` (same substring rules as before). New scans persist `terminalCode` on closest-symbol rows in `DailyScanRun.notes`.

**Explainability-only:** Codes and rank components do **not** change pass/fail, surfacing, or `rankScore` values.

---

## Gate 1 surfacing matrix

Applied in `runDailyScanJob` after Gate 2 counts (same as `filterCandidatesByGate1Level`):

| Gate 1 | Tier A | Tier B | Surfaced |
|--------|--------|--------|----------|
| FAIL | any | any | **none** |
| WARNING | yes | — | **A only** |
| WARNING | no | yes | **none** (B suppressed) |
| PASS | yes/no | yes/no | **A + B** |

`SetupCandidate` rows are created only for surfaced symbols, ordered by `rankScore` desc.

---

## Daily trading decision (portfolio stance)

`computeDailyTradingDecision` in `src/lib/scanner/trading-decision.ts` uses **pre-surfacing** Gate 2 A/B counts × Gate 1:

| Gate 1 | Gate 2 A/B | Level | Allocation |
|--------|------------|-------|------------|
| FAIL | any | NO_TRADE | 0% |
| PASS | A or B &gt; 0 | NORMAL | 50–70% |
| PASS | none | NO_TRADE | 0% |
| WARNING | A &gt; 0 | PROBE | 20–40% |
| WARNING | no A | NO_TRADE | 0% (even if B &gt; 0) |

Persisted under `DailyScanRun.notes.decision`. UI maps NORMAL → **TRADE** (`mapDecisionLevelToUxVerdict`).

---

## Diagnostics (scan notes)

Built by `buildGate2ScanDiagnosticsSummary` → subset via `toDailyScanGate2Notes`, plus:

| Field | Purpose |
|-------|---------|
| `topRejectionCategories` | INVALID bucket counts |
| `rejectionSymbolsByCategory` | Sample symbols per bucket (capped) |
| `closestToValidSymbols` | Top INVALID rows by proximity / pipeline depth |
| `recommendation` | Dominant bottleneck hint |
| `benchmarkBackdrop` | VNINDEX vs equity max session, `delayedBackdrop` |
| `sessionCoverage` | Stale fraction vs expected session (Batch B) |
| `decision` | Daily stance |

Parsed by `parseDailyScanGate2Notes`.

---

## Dashboard mapping

| Layer | File | Role |
|-------|------|------|
| DB load | `dashboard/page.tsx`, `setups-queries.ts` | Latest `DailyScanRun`, candidates, regime |
| Freshness | `buildMarketFreshnessDto` | Alignment flags + scan `sessionCoverage` warnings |
| Cockpit | `buildDecisionCockpitDto` | Verdict, evidence, opportunity board, blockers, confidence |
| V3 UI | `map-dashboard-v3-view-model.ts` | Trading OS dashboard view model |
| Health | `prepareSurfacedCandidatesHealthView` | Post-scan watch flags (EXTENSION, etc.) |

**Confidence band** (`computeConfidenceBand`): low when benchmark missing, stale flags, delayed backdrop, Gate 1 FAIL, scan age &gt;36h, or **weak session coverage**.

**Near-miss UX:** `closestToValidSymbols` + `computeClosestExecutionStatus` (READY/WAIT/INVALID) — presentation only; not trade signals.

---

## Diagnostic lanes vs canonical setups

| Lane | Creates `SetupCandidate`? | Purpose |
|------|---------------------------|---------|
| **Gate 2 scan (canonical)** | Yes (if surfaced) | Breakout-pullback playbook |
| **Near-miss watchlist** | No | INVALID diagnostics (`near-miss-watchlist.ts`) |
| **RS near-miss watchlist (D2.3)** | No | INVALID + RS20&gt;0 leaders on monitor terminals (`rs-near-miss-watchlist.ts`) — separate sort, not `rankScore` |
| **Fresh breakout audit** | No | Momentum labels (`fresh-breakout-audit.ts`) |
| **Momentum watch UI** | No | Read-only deck |

Disclaimers in UI: near-miss and momentum lanes are observational.

---

## Known limitations

1. **No relative strength vs VNINDEX** — symbol trend only.  
2. **Rank components only on new scans** — legacy `SetupCandidate` rows may lack v1 `reasons` payload.  
3. **Narrow template** — many INVALID at trend filter; zero setups can be normal.  
4. **Data coverage** — stale equity bars dominate at scale; weak coverage warns but does not block scan.  
5. **SCAN_SYMBOL_LIMIT** — alphabetical bias.  
6. **Per-symbol DB reads** in scan loop — scale/perf risk.  
7. **Decision vs evidence** — persisted decision uses pre–Gate 1 qualified counts; dashboard separates pre-regime vs surfaced (Batch F).  
8. **Gate 1 coarse** — 3-bar momentum only.  
9. **Price units** — equity in thousand VND; index in points.  
10. **Min risk-to-stop 0.3%** — may be tight for VN cash market.

---

## Future improvement batches (from audit)

| Batch | Focus |
|-------|--------|
| **A** | This document |
| **B** | Session coverage warnings (implemented) |
| **C** | Explainability — rank components, stable rejection codes (implemented) |
| **D** | Signal quality — RS vs VNINDEX, threshold tuning |
| **E** | Regime + R-multiple sizing |
| **F** | UI copy / label alignment (implemented) |
| **G** | Backtest / validation harness |

**Recommended next slice after A+B+C+F:** Batch D (signal quality / RS vs VNINDEX) when session coverage is consistently high; otherwise extend data-ops / coverage hardening first.

### Batch D — signal quality (proposed; diagnostic started)

Full design: **`docs/trading/batch-d-signal-quality-plan.md`**.

| Deliverable | Status |
|-------------|--------|
| RS return-spread math (20/50 session) | `relative-strength.ts` |
| CLI overlay on Gate 2 | `scripts/rs-gate2-diagnostic.ts` |
| Setups + dashboard RS panels (D1) | On-demand via `load-rs-diagnostics.ts` — **not** in scanner job |
| Threshold sweep CLI (D1.5) | `scripts/gate2-threshold-sweep.ts` — diagnostic only |
| Pass/fail / rankScore production change | **Not started** — requires replay sign-off |

**Recommended RS v1:** stock minus VNINDEX return spread over 20 and 50 sessions; dual MA50 flags for context. **Do not** hard-filter until replay false-positive/negative review.

---

## Batch F — dashboard copy semantics (UX only)

No changes to Gate 2 math, ranking formula, pass/fail thresholds, or scanner persistence rules. Copy/DTO alignment only.

### Persisted decision level vs UI action label

| Persisted (`DailyScanRun.notes.decision.level`) | Dashboard UX headline | Meaning |
|------------------------------------------------|----------------------|---------|
| `NO_TRADE` | NO TRADE | 0% book cap; no new swing entries |
| `PROBE` | PROBE MODE | Reduced book-risk; Gate 1 cautious |
| `NORMAL` | TRADE MODE | Normal book-risk mode when setups exist — **not** an instruction to enter every name |

Implementation: `buildVerdictUxCopy` in `src/lib/dashboard/gate-funnel-copy.ts`; wired in `buildDecisionCockpitDto` → `VerdictDto.headline`, `subtitle`, `persistedLevelNote`.

### Pre-regime vs surfaced counts

| Metric | Source | UI label |
|--------|--------|----------|
| Gate 2 qualified | `candidateCountA` + `candidateCountB` (pre–Gate 1) | “Gate 2 qualified (pre-regime)” |
| Surfaced | `candidateCountSurfaced` split by tier + Gate 1 rules | “Surfaced after Gate 1” |
| Suppressed | qualified − surfaced | “Suppressed by Gate 1” (e.g. Tier B hidden on WARNING) |

`computeGateFunnelSnapshot(scan, gate1Level)` mirrors `filterCandidatesByGate1Level` surfacing: FAIL → 0 surfaced; WARNING → A only; PASS → A then B up to surfaced total.

Evidence chips and empty-state copy use `formatGateFunnelSummaryLine` for backward-compatible scan rows (counts only; no notes schema change).

### Near-miss diagnostic semantics

Closest INVALID rows (`closestToValidSymbols`) are **not** `SetupCandidate` trade signals.

| Internal `ClosestExecutionStatus` | Surfaced setup label | Near-miss diagnostic label |
|----------------------------------|----------------------|------------------------------|
| `READY` | “At entry zone” | “In zone (diagnostic only)” |
| `WAIT` | “Waiting for pullback” | “Near setup, not validated” |
| `INVALID` | “Structure invalid” | “Structure invalid (watch only)” |

Helpers: `displayNearMissDiagnosticStatus`, `nearMissDiagnosticActionHint` in `src/lib/trading-display-labels.ts`.

---

## Key file index

| Area | Path |
|------|------|
| Scan job | `src/lib/scanner/run-daily-scan-job.ts` |
| Session | `src/lib/scanner/expected-session.ts` |
| Coverage | `src/lib/scanner/scan-session-coverage.ts` |
| Tradability | `src/lib/scanner/tradability.ts` |
| Gate 2 | `src/lib/scanner/gate2/breakout-pullback.ts` |
| Rank breakdown | `src/lib/scanner/gate2/rank-components.ts` |
| Rejection codes | `src/lib/scanner/gate2/rejection-codes.ts` |
| Candidate reasons JSON | `src/lib/scanner/setup-candidate-reasons.ts` |
| Gate 1 | `src/lib/playbook/gate1-market.ts` |
| Decision | `src/lib/scanner/trading-decision.ts` |
| Diagnostics | `src/lib/scanner/gate2-scan-diagnostics.ts` |
| Notes parse | `src/lib/scanner/parse-daily-scan-notes.ts` |
| Freshness DTO | `src/lib/market/market-freshness-dto.ts` |
| Cockpit DTO | `src/lib/dashboard/decision-cockpit-dto.ts` |
| Gate funnel copy | `src/lib/dashboard/gate-funnel-copy.ts` |
| RS diagnostic (Batch D0–D1) | `relative-strength.ts`, `rs-diagnostic-format.ts`, `load-rs-diagnostics.ts`, `scripts/rs-gate2-diagnostic.ts`, `RelativeStrengthDiagnosticPanel` |
| Threshold sweep (Batch D1.5) | `gate2-eval-params.ts`, `gate2-threshold-sweep.ts`, `scripts/gate2-threshold-sweep.ts` |
| Forward returns (Batch D1.6) | `forward-returns.ts`, `forward-return-validation.ts`, `scripts/gate2-forward-return-validation.ts` |
| RS rank term preview (Batch D2, default off) | `rs-rank-term.ts`, `rs-rank-evidence.ts`, `scripts/gate2-rs-rank-comparison.ts` |
| Evidence readiness (Batch D2.2) | `gate2-evidence-readiness.ts`, `scripts/gate2-evidence-readiness.ts` |
| RS near-miss watchlist (Batch D2.3) | `rs-near-miss-watchlist.ts`, `scripts/gate2-rs-watchlist.ts` |
| Batch D plan | `docs/trading/batch-d-signal-quality-plan.md` |
| Schema | `prisma/schema.prisma` (`DailyScanRun`, `SetupCandidate`) |
