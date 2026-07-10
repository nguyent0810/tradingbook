# Trading Algorithm Audit Report

## Executive Summary

The scanner is safer than a momentum-chase system because it has hard freshness, liquidity, market-regime, breakout-hold, pullback-zone, extension, depth, volume, and stop-structure gates. It correctly separates qualified breakout-pullback setups from a diagnostic relative-strength watchlist in most current production paths.

It is not yet safe to rely on for serious position sizing. The main blockers are data provenance gaps around raw versus adjusted prices, no explicit corporate-action model, no hard guard against an upstream incomplete same-day candle, limited validation for actual pass-tier setups, a simple VNINDEX-only market regime, and UI language that can still make a top setup feel more actionable than the evidence supports.

Use it as a conservative EOD watchlist and trade-planning assistant. Do not treat score, tier, or "TRADE/NORMAL" stance as an independently validated buy signal.

## Current Algorithm Map

1. Data import:
   - `scripts/fetch_vnindex.py` fetches VNINDEX daily OHLCV from `vnstock Quote(symbol="VNINDEX", source="VCI")` and writes JSON.
   - `scripts/import-bars.ts` validates and upserts VNINDEX rows into `IndexDailyBar`.
   - `scripts/fetch_stock_bars.py` fetches active symbols from vnstock/VCI and writes grouped JSON.
   - `scripts/import-stock-bars.ts` validates and upserts stock rows into `StockDailyBar`.

2. Expected session:
   - `getExpectedLatestSessionFromIndexBars()` uses the latest `IndexDailyBar.date` for VNINDEX as the expected EOD session (`src/lib/scanner/expected-session.ts:13`).
   - Tradability and Gate 2 reject stock bars whose latest date does not match this session (`src/lib/scanner/tradability.ts:125`, `src/lib/scanner/gate2/breakout-pullback.ts:166`).

3. Universe:
   - `loadEffectiveScanUniverse()` merges active `StockSymbol` rows with active non-expired `TacticalSymbol` rows (`src/lib/tactical-universe.ts:198`).
   - Optional `SCAN_SYMBOL_LIMIT` slices the merged, alphabetically sorted universe (`src/lib/scanner/run-daily-scan-job.ts:131`), which can bias diagnostics toward early tickers.

4. Tradability:
   - `evaluateTradability()` requires 120 bars, 20D average volume/value floors, latest close >= 10,000 VND, current session alignment, and no consecutive calendar gap over 21 days (`src/lib/scanner/tradability.ts:90`).

5. Gate 1 market regime:
   - `evaluateMarketRegime()` uses VNINDEX close versus MA50 plus three-close momentum (`src/lib/playbook/gate1-market.ts:46`).
   - PASS = close > MA50 and last 3 closes rising; FAIL = close < MA50 and last 3 closes falling; otherwise WARNING.

6. Gate 2 setup:
   - `evaluateBreakoutPullbackCandidate()` implements a deterministic daily breakout-pullback template (`src/lib/scanner/gate2/breakout-pullback.ts:146`).
   - Valid outputs are Tier A, Tier B, or INVALID with terminal rejection code.

7. Surfacing and persistence:
   - Gate 1 FAIL surfaces no candidates; WARNING surfaces A only; PASS surfaces A and B (`src/lib/scanner/gate2/collect-candidates.ts:13`, duplicated in `run-daily-scan-job.ts:242`).
   - Surfaced candidates are persisted to `DailyScanRun` and `SetupCandidate` (`src/lib/scanner/run-daily-scan-job.ts:317`).

8. UI:
   - Latest candidates are fetched ordered by `rankScore desc` (`src/lib/scanner/setups-queries.ts:10`).
   - Dashboard then overlays health and execution proximity before showing top setups (`src/lib/setup-health/prepare-surfaced-health-view.ts`, `src/lib/setup-health/sort-candidates.ts:24`).
   - RS near-miss rows are diagnostic and sorted independently by RS20, pipeline progress, zone distance, RS50, volume, and symbol (`src/lib/scanner/gate2/rs-near-miss-watchlist.ts:47`).

## Score Formula Inventory

| Component | Formula / Rule | Evidence |
| --- | --- | --- |
| Tradability min history | >= 120 daily bars | `src/lib/scanner/tradability-constants.ts:1` |
| Tradability liquidity | 20D average volume >= 100,000 shares; 20D average traded value >= 2B VND | `src/lib/scanner/tradability-constants.ts:4` |
| Tradability price floor | latest close >= 10,000 VND after unit conversion | `src/lib/scanner/tradability-constants.ts:13` |
| Tradability stale check | latest stock bar date must equal latest VNINDEX session | `src/lib/scanner/tradability.ts:125` |
| Gate 1 PASS | VNINDEX close > MA50 and last 3 closes strictly rising | `src/lib/playbook/gate1-market.ts:74` |
| Gate 1 FAIL | VNINDEX close < MA50 and last 3 closes strictly falling | `src/lib/playbook/gate1-market.ts:78` |
| Gate 2 trend | close >= MA50 and MA20 >= MA50 | `src/lib/scanner/gate2/breakout-pullback.ts:188` |
| Gate 2 breakout | breakout in last 10 bars, close above prior 20-day range high, excluding breakout day | `src/lib/scanner/gate2/constants.ts:1`, `src/lib/scanner/gate2/breakout-pullback.ts:205` |
| Gate 2 pullback zone | high = breakout level; low = max(breakout * 0.98, MA20) | `src/lib/scanner/gate2/breakout-pullback.ts:245` |
| Gate 2 volume | valid B needs volume / prior 20D median >= 1.2; A needs >= 1.5 and close >= MA20 | `src/lib/scanner/gate2/breakout-pullback.ts:305`, `src/lib/scanner/gate2/breakout-pullback.ts:386` |
| Gate 2 extension cap | close cannot exceed breakout by more than 5% | `src/lib/scanner/gate2/constants.ts:9`, `src/lib/scanner/gate2/breakout-pullback.ts:324` |
| Gate 2 depth cap | min low since breakout cannot be more than 4% below breakout | `src/lib/scanner/gate2/constants.ts:12`, `src/lib/scanner/gate2/breakout-pullback.ts:336` |
| Gate 2 stop | min low since breakout * 0.99; minimum entry-to-stop risk 0.3% | `src/lib/scanner/gate2/breakout-pullback.ts:352`, `src/lib/scanner/gate2/constants.ts:15` |
| Gate 2 rankScore | `1000*min(volRatio,3) + 100*min(max(extensionPct,0),50) + 50*min(max(maDistancePct,0),50) - 200*min(depthFrac,1)` | `src/lib/scanner/gate2/rank-components.ts:34` |
| RS diagnostic | 20/50-session stock return minus VNINDEX return, session-aligned | `src/lib/scanner/gate2/relative-strength.ts:56` |
| RS rank term | off by default; optional `RS20_pp * 25`, capped +/-250 | `src/lib/scanner/gate2/rs-rank-term.ts:4` |
| RS Strength Score v1 | feature-flagged; 35% RS20, 25% RS50, 15% consistency, 10% MA50, 10% liquidity, 5% neutral term, minus drawdown penalty | `src/lib/scanner/gate2/rs-scoring-v1.ts:86` |
| Setup Readiness Score v1 | feature-flagged; 25% stage, 20% zone distance, 15% MA50, 15% terminal boost, 10% regime, 15% neutral term | `src/lib/scanner/gate2/rs-scoring-v1.ts:117` |
| Setup health score | starts 100; subtracts for extension, aging, volume fade, failed pullback, reversal risk, dead setup | `src/lib/setup-health/evaluate-watch-health.ts:65` |
| Trading decision | FAIL -> NO_TRADE 0%; PASS + any A/B -> NORMAL 50-70%; WARNING + A -> PROBE 20-40% | `src/lib/scanner/trading-decision.ts:20` |
| Position sizing | risk budget / per-share risk, capped by remaining portfolio and per-trade exposure; Tier B uses half risk | `src/lib/position-sizing.ts:28` |

## Key Findings

| ID | Severity | Area | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F01 | P0 | Data integrity | Raw vs adjusted prices are not modeled, so splits/dividends can corrupt MA, breakout, RS, stops, and backtests. | `StockDailyBar` has OHLCV and `source`, but no adjustment fields or corporate action table (`prisma/schema.prisma:264`). Imports overwrite OHLCV from vnstock without adjustment metadata (`scripts/import-stock-bars.ts:173`). | Add explicit `priceAdjustmentMode`, adjusted/raw OHLC columns or source contract, and corporate-action audit checks before trusting long-window signals. |
| F02 | P0 | Validation | Production pass-tier evidence is not statistically enough for sizing. Existing memo reports Tier A n=2, Tier B n=0 in walk-forward pass tiers. | `docs/trading/gate2-d1-evidence-decision-memo.md:95` and `:100`. Validation code marks small samples under n=10 as hypothesis only (`src/lib/scanner/gate2/forward-return-validation.ts:20`). | Keep scanner advisory until forward cohorts have enough A/B observations across regimes with costs and slippage. |
| F03 | P0 | Risk | "NORMAL 50-70%" allocation can be produced from only Gate 1 PASS plus any A/B setup, independent of realized strategy expectancy, costs, or broad selloff diagnostics. | `src/lib/scanner/trading-decision.ts:35`; Gate 1 is only VNINDEX MA50 and 3-close momentum (`src/lib/playbook/gate1-market.ts:40`). | Rename to maximum planning envelope, require configured risk budget and validated edge before showing percent exposure. |
| F04 | P1 | Data timing | There is no hard market-close/incomplete-candle guard. If upstream provides a same-date partial bar and VNINDEX import anchors to it, same-date stocks can pass freshness. | VNINDEX fetch uses current UTC date + 1 day (`scripts/fetch_vnindex.py:36`); expected session is simply latest VNINDEX row (`src/lib/scanner/expected-session.ts:13`). | Add exchange calendar and EOD cutoff checks; mark current session provisional until post-close import window and full coverage pass. |
| F05 | P1 | Scoring | Gate 2 rankScore rewards extension above breakout and MA50 distance inside the valid cap, which can rank more extended names higher. | Positive `extensionTerm` and `maDistanceTerm` in `src/lib/scanner/gate2/rank-components.ts:44`. | Use execution readiness/proximity as primary display order; treat extension as penalty or capped context, not a bonus. |
| F06 | P1 | Market risk | Market regime does not include breadth, sector dispersion, limit-down pressure, foreign selling, volatility, or macro shock controls as hard gates. | Gate 1 implementation at `src/lib/playbook/gate1-market.ts:46`; market context computes foreign/volume but scanner Gate 1 does not consume it (`src/lib/market/compute-market-context.ts:99`). | Add a risk-off overlay using breadth/foreign/volatility/large-gap selloff metrics and sector concentration checks. |
| F07 | P1 | Bias | Historical RS evidence has a known anchor-RS limitation in docs; anchor RS on older rows can create look-ahead bias if used for enablement. | Memo says RS overlay loaded at anchor for all historical rows (`docs/trading/gate2-d1-evidence-decision-memo.md:127`); code exposes limitation string (`src/lib/scanner/gate2/rs-rank-evidence.ts:258`). | Only use per-session RS for replay and freeze deprecated evidence files. |
| F08 | P1 | Product | UI still uses "Actionable now", "Best setups", "Log trade", "Go", and exposure percentages, which may encourage action beyond validation. | `src/components/dashboard/dashboard-actionable-setups-zone.tsx:23`, `src/components/dashboard/dashboard-best-setups-panel.tsx:38`, `src/lib/dashboard/build-trade-gate.ts:51`. | Reword to "Qualified for review", "Plan candidate", "Check entry", and gate "Go" behind stronger risk/validation prerequisites. |
| F09 | P1 | Data quality | Import validates finite positive OHLC and duplicates in file, but not adjusted/unadjusted continuity, price limits, impossible gaps, zero-volume suspensions, or symbol-level expected session completeness. | `scripts/import-stock-bars.ts:41`; tradability checks only 21-calendar-day gaps and stale latest bar (`src/lib/scanner/tradability.ts:131`). | Add data-health jobs for continuity, outlier gaps, floor/ceiling sessions, split-like jumps, repeated zero volume, and per-symbol missing sessions. |
| F10 | P2 | Ranking | Persisted candidates are fetched by `rankScore desc`, but dashboard later sorts health/proximity. The meaning of "score" is therefore not the same as "entry readiness". | `src/lib/scanner/setups-queries.ts:13`; `src/lib/setup-health/sort-candidates.ts:24`. | Rename Gate 2 `rankScore` to `setupScore` or `participationScore` and show separate entry-readiness/proximity score. |
| F11 | P2 | Backtest realism | Forward labels use close-to-close returns and high/low excursions, but no transaction costs, slippage, taxes, fill rules, position sizing, or liquidity constraints. | `src/lib/scanner/gate2/forward-returns.ts:42`; no cost model in validation aggregators. | Add executable backtest with next-open/limit-zone fills, fees/taxes, slippage, liquidity caps, stops, and missed-fill accounting. |
| F12 | P2 | Testing | There is strong unit coverage for formulas, but gaps remain for raw/adjusted data, corporate actions, incomplete candles, regime shock days, and UI label consistency across all gates. | Tests exist across scanner modules, but no adjusted/corporate-action model exists to test. | Add the concrete tests listed below before production reliance. |

## Data Integrity Risks

The strongest data protection is session alignment. Stock bars must match the latest VNINDEX session before they pass tradability, and Gate 2 also rejects mismatched latest bars. This is good and directly reduces stale-signal risk.

The main data risk is price provenance. The schema stores one OHLCV series per symbol with `source`, but not whether prices are raw or adjusted. There is no split/dividend/corporate-action table and no continuity logic that can detect split-like jumps. For a breakout/MA/RS system, that is a critical correctness gap because adjusted and raw series can produce different range highs, MA50 states, pullback zones, stops, and forward returns.

Duplicate rows are controlled at two layers: JSON duplicate dates are skipped during import and database uniqueness enforces one `(symbolId, date)` row. Bad basic OHLC rows are skipped if OHLC is not positive, `high < low`, or volume is negative. This is necessary but not sufficient for trading-grade data.

Suspended and illiquid symbols are partly handled by 120-bar history, 20D volume/value floors, latest session match, and max 21-day calendar gap. However, repeated zero-volume days, exchange floor/ceiling mechanics, newly listed behavior, and symbols that are technically "fresh" but barely tradable are not deeply modeled.

## Look-Ahead / Bias Risks

Current scan-time Gate 2 mostly uses information available at EOD: the breakout search stops at `L - 1`, prior range highs exclude the breakout day, volume median excludes the evaluation bar, and forward labels are only diagnostic.

Known bias risks:

- Incomplete candles: if upstream includes a current in-progress daily bar and VNINDEX anchors to that date, the scanner can treat it as complete.
- Historical RS: prior docs call out anchor-loaded RS for historical rows. That can create look-ahead bias in replay if RS is not computed at each historical session.
- Dashboard live regime: dashboard loads live `getMarketRegimeFromDb()` while also consuming latest scan notes. The cockpit prefers scan-run Gate 1 when a scan exists, but live/scan mismatch can confuse users if not made explicit.
- Snapshot persistence from dashboard render: `dashboard/page.tsx` can persist RS watchlist snapshots when feature-flagged (`src/app/(dashboard)/dashboard/page.tsx:245`). That is convenient, but product views should not be the primary backtest data generation path.

## Scoring Logic Review

Gate 2 is explainable and conservative as an entry template. It requires trend support, a fresh breakout, digestion, no failed hold, pullback-zone interaction, participation, extension cap, depth cap, and a valid stop. This strongly supports the user's goal of avoiding FOMO.

However, `rankScore` is not a pure readiness score. It rewards volume, extension above breakout, and distance above MA50. The extension cap prevents extreme chasing, but within the cap the score can still prefer the more extended candidate. This should not be shown as "best" without a separate entry-readiness label.

RS separation is mostly correct:

- `relative-strength.ts` says RS is diagnostic only.
- `rs-near-miss-watchlist.ts` explicitly excludes valid Tier A/B rows and labels the RS list as diagnostic.
- `rs-rank-term.ts` is off by default and limited to a capped ordering nudge.
- `rs-scoring-v1.ts` is feature-flagged and display-oriented.

The newer RS Strength Score and Setup Readiness Score are directionally aligned with the desired separation, but they are not yet validated enough to become production trade gates.

## Risk Management Review

Positive:

- Gate 1 FAIL blocks surfacing.
- WARNING only permits Tier A.
- Gate 2 rejects extension, failed pullbacks, poor volume, and invalid stop structure.
- Position sizing uses stop distance and exposure caps when account equity is configured.
- Trade Gate suppresses "Go" when NO_TRADE, Gate 1 FAIL, missing risk budget, overmax book, critical utilization, or bad setup health.

Concerns:

- The daily decision percentages, especially NORMAL 50-70%, are not supported by enough strategy validation.
- Gate 1 is too narrow for macro/broad selloff protection. A market can be above MA50 and still be distribution-heavy or sector-fragile.
- Sector concentration is not modeled.
- Stop logic gives a level but there is no validated execution model for gaps, limit-down sessions, slippage, or liquidity.
- There is no explicit averaging-down warning in scanner candidate flow. The trade journal may enforce discipline elsewhere, but scanner output should state "no averaging down" near planning/position sizing.

## Backtest / Validation Review

The repository has meaningful validation scaffolding:

- Forward returns: `src/lib/scanner/gate2/forward-returns.ts`
- Forward validation cohorts: `src/lib/scanner/gate2/forward-return-validation.ts`
- Threshold sweeps: `src/lib/scanner/gate2/gate2-threshold-sweep.ts`
- RS rank evidence: `src/lib/scanner/gate2/rs-rank-evidence.ts`
- Snapshot/backtest scripts: `scripts/rs-watchlist-backtest.ts`, `scripts/gate2-forward-return-validation.ts`, `scripts/gate2-threshold-sweep.ts`

The evidence is not yet decision-grade for serious sizing. The strongest existing memo says pass-tier samples are too small, missing 20D forward labels are high for RS invalid cohorts, and threshold changes are not supported. Validation also lacks transaction costs, slippage, taxes, fill logic, liquidity caps, and regime-stratified performance.

## UI / Product Risk Review

The UI has improved risk language for RS: "context only", "not a setup candidate", "does not change today's stance", and blocked/watch labels are present in multiple paths.

Remaining risk is the main setup surface. Terms like "Actionable now", "Best setups", "Go", "TRADE", and "Max exposure 50-70%" can be interpreted as "buy now." Since the validation is not mature enough, the product should lean harder into review language:

- "Qualified for review" instead of "Actionable now"
- "Setup candidates" instead of "Best setups"
- "Entry checklist" instead of "Go"
- "Planning cap" instead of "Max exposure"
- "Wait for pullback" and "Avoid chase" prominently when distance/extension is unfavorable

## Test Coverage Gaps

Existing tests cover many deterministic pieces: tradability, Gate 2, rank components, RS diagnostics, RS rank term, RS scoring, scan coverage, trade decision, dashboard mappers, position sizing, and setup health.

Gaps that matter before real-money reliance:

- No raw/adjusted/corporate-action fixture tests.
- No split/dividend continuity tests.
- No incomplete same-day candle tests.
- No floor/ceiling price or limit-down liquidity tests.
- No sector concentration tests.
- No crash/broad-selloff regime tests.
- No cost/slippage/tax validation tests.
- No validated UI-copy invariant that high RS cannot appear as a buy signal.
- No portfolio-level backtest that uses actual sizing, stops, and fill assumptions.

## Recommended Roadmap

### Immediate fixes

- Add data provenance fields for price adjustment mode and source contract.
- Add hard EOD session-completeness guard using Vietnam exchange calendar and import time window.
- Freeze/deprecate historical evidence files with known anchor-session or anchor-RS limitations.
- Rename or downshift UI language that implies immediate action.
- Hide or qualify NORMAL/PROBE exposure percentages unless account risk config and validation prerequisites are present.

### Short-term improvements

- Add data-health checks for split-like gaps, repeated zero volume, missing sessions, impossible OHLC, and floor/ceiling days.
- Make `rankScore` label explicit: "setup score / participation score", not "buy score".
- Promote entry readiness/proximity as a separate first-class score.
- Add breadth/foreign-flow/volatility/risk-off overlay to Gate 1, initially as a warning then as a hard block after validation.
- Add sector/industry concentration warnings.

### Medium-term research

- Build a proper event-driven backtest with fill rules, stops, next-open/zone-entry assumptions, fees, taxes, slippage, and liquidity caps.
- Validate across bull, bear, sideways, and crash regimes.
- Compare breakout-pullback against simple benchmarks: VNINDEX, equal-weight VN universe, RS-only watchlist, and passive cash/market timing.
- Validate RS Strength and Setup Readiness scores with frozen walk-forward cohorts before enabling production ranking.

### Long-term quant upgrades

- Add corporate-action-adjusted historical dataset and raw execution-price dataset side by side.
- Add breadth models: advance/decline, percentage above MA20/MA50, new highs/lows, distribution days.
- Add volatility regime and gap-risk model.
- Add portfolio optimizer constraints: max sector exposure, max correlated names, and dynamic risk budget by market regime.
- Add post-trade learning loop that updates expectancy by setup subtype, market regime, RS bucket, and execution location.

## Suggested New Tests

- `stock_daily_bar_adjustment_mode_required_for_scanner`: verify scanner refuses or warns when adjustment mode is unknown.
- `split_like_gap_flags_symbol_data_health`: inject a 50% overnight split-like gap and ensure data health blocks ranking until reviewed.
- `incomplete_current_session_does_not_anchor_expected_session`: simulate current-date VNINDEX partial bar before EOD cutoff and ensure it is not accepted as expected session.
- `gate2_uses_only_bars_through_eval_session`: replay historical bars with future bars present and verify Gate 2 ignores future data.
- `relative_strength_replay_uses_per_row_session`: verify RS20/RS50 are computed at each replay session, not a global anchor.
- `rank_score_does_not_claim_entry_readiness`: verify UI labels distinguish setup score from readiness/proximity.
- `market_regime_distribution_day_blocks_new_entries`: simulate VNINDEX above MA50 but broad distribution and ensure risk-off overlay warns or blocks.
- `limit_down_gap_respects_stop_slippage`: verify backtest applies gap/limit-down loss beyond nominal stop.
- `illiquid_zero_volume_series_fails_tradability`: verify repeated zero-volume latest sessions fail even if average volume barely passes.
- `rs_watchlist_context_only_copy_invariant`: verify RS watchlist cards always include context-only/not-qualified language.
- `normal_allocation_hidden_without_risk_budget`: verify 50-70% guidance is not shown as actionable when account equity/risk config is missing.
- `sector_concentration_warning_for_multiple_candidates`: verify multiple same-sector candidates trigger concentration risk warning.

## Final Recommendation

Can this scanner be used as-is? Yes, as an EOD research and watchlist tool. It is conservative enough to help avoid obvious chase entries and stale data.

What should be trusted? Trust the deterministic Gate 2 rejection reasons, freshness checks, pullback/extension/depth/volume gates, and RS diagnostic separation.

What should not be trusted yet? Do not trust rankScore as expected return, do not trust RS scores as production signals, do not trust exposure percentages as validated sizing guidance, and do not trust historical validation files without checking their replay/session-bias status.

What must be fixed before serious position sizing? Price adjustment provenance, incomplete-candle guarding, corporate-action/data-health checks, realistic cost/slippage/fill backtests, adequate pass-tier sample sizes, and stronger market/sector risk controls.

