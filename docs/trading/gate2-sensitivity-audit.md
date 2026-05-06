# Gate 2 sensitivity audit (zero setups under curated universe)

## Purpose

Controlled diagnostic on **why tradable symbols still yield zero `SetupCandidate` rows** after universe curation and full session-aligned bars. **Scanner rules, thresholds, and Gate 1 surfacing are unchanged.** This document summarizes methodology, measured rejection shape, and a single recommendation.

## Context (baseline)

- **208** active symbols after curation; **67** pass tradability.
- Latest-session coverage for actives: **100%**.
- **`setupCandidatesInserted`**: **0**, **`failedCount`**: **0** — failures are **INVALID Gate 2** outcomes, not ingestion errors.

## Methodology

1. Resolve expected session from **VNINDEX** (`getExpectedLatestSessionFromIndexBars`), same as production scan.
2. Resolve **Gate 1** level via `getMarketRegimeFromDb()` (informational for Tier B surfacing).
3. Restrict analysis to symbols that **pass tradability** (`evaluateTradabilityForSymbolId`).
4. Run **`evaluateBreakoutPullbackCandidate`** on each symbol’s daily OHLCV (same Gate 2 entry as `run-daily-scanner.ts`).
5. Aggregate INVALID terminals using existing **`categorizeTerminalReason`** buckets from `gate2-scan-diagnostics.ts`.
6. Emit coarse **audit buckets** (diagnostic labels only; **not** new scanner categories):

| Audit bucket | Terminal categories rolled in |
|--------------|-------------------------------|
| `trend_below_ma50` | `trend_below_ma50` |
| `weak_ma20_ma50` | `trend_ma20_below_ma50` |
| `no_pullback_breakout_recency` | `breakout_recency` |
| `no_pullback_digestion` | `digestion` |
| `pullback_structure_zone` | `breakout_not_holding`, `mid_pullback_below_ma50`, `swept_breakout_weak_close`, `pullback_zone_*` |
| `volatility_participation_volume` | `volume_median_bad`, `volume_ratio` |
| `volatility_range_extension_depth` | `extension_cap`, `depth_cap` |
| `poor_risk_reward_stop_structure` | `stop_structure` |
| `data_or_ma_prereq` | `insufficient_bars`, `stale_or_session_mismatch`, `ma_compute` |
| `other_or_unknown` | `unknown` |

7. **Near-miss** sections in script output:
   - **`tierBQuietBlockedByGate1Warning`**: symbols with Gate 2 quality **B** (would matter when Gate 1 only allows A under WARNING).
   - **`tierAFlat`**: quality **A**.
   - **`invalidSingleReasonLineOnly`**: INVALID with a **single** reason string (early pipeline exit with no prior checklist lines).
   - **`invalidClosestToPassingByPipelineDepth`**: INVALID sorted by **descending `stageRank`** (later-stage failures are “closer” to completing the template).

Per-symbol rows include **`setupType`**: `breakout_pullback_daily`, **`failedReasons`**, **`close`**, **`ma20` / `ma50`**, **`maRelationship`**, **`riskToStopFrac`** / **`distanceToPullbackZoneFrac`** when numeric levels exist; for some INVALID paths Gate 2 clears structured fields — the audit script **parses pullback bounds from the terminal reason text** when needed so zone distance is still computable.

## Command

```bash
npx tsx scripts/audit-gate2-sensitivity.ts
npx tsx scripts/audit-gate2-sensitivity.ts --near-miss-limit=40
```

## Snapshot results (local run, curated universe)

Captured from `audit-gate2-sensitivity.ts` with **67** tradable symbols, **`gate1Level`: `"WARNING"`**:

| Metric | Value |
|--------|--------|
| Tier A among tradable | **0** |
| Tier B among tradable | **0** |
| INVALID among tradable | **67** |
| Surfaced count under current Gate 1 (A-only under WARNING) | **0** |

**Terminal INVALID counts** (`rejectionBucketsTerminal`):

| Category | Count |
|----------|-------|
| `trend_below_ma50` | 41 |
| `breakout_recency` | 9 |
| `trend_ma20_below_ma50` | 6 |
| `breakout_not_holding` | 6 |
| `pullback_zone_interaction` | 4 |
| `digestion` | 1 |

**Coarse audit aggregates** (`rejectionBucketsAuditAggregate`):

| Bucket | Count |
|--------|-------|
| `trend_below_ma50` | 41 |
| `weak_ma20_ma50` | 6 |
| `no_pullback_breakout_recency` | 9 |
| `no_pullback_digestion` | 1 |
| `pullback_structure_zone` | 10 |

No symbols reached volume, extension, depth, or stop-structure failures in this snapshot (**0** in those buckets).

**Near-miss qualitative read**

- **No hidden Tier B**: `tierBQuietBlockedByGate1Warning` is empty — the zero-setup outcome is **not** explained by “valid B blocked by Gate 1 WARNING.”
- **Deepest INVALID rows** (stage rank ~58) include names that passed trend, breakout, and digestion but **failed pullback-box interaction** — price often **above** the box (positive `distanceToPullbackZoneFrac`), i.e. **chasing / no pullback entry**, not a loosenable liquidity typo.
- Early rejects remain dominated by **trend / MA structure** (~70% of INVALID via existing diagnostics summary).

## Non-goals (this audit)

- No scanner scoring or threshold edits.
- No Tier B surfacing.
- No lifecycle or UI changes.
- No automatic behavior in production scans — run the script **explicitly** when investigating sensitivity.

## Recommendation (pick one)

**Keep scanner rules unchanged for now.** Evidence: among **67** cleaned, tradable names there are **zero** Tier **A** or **B** Gate 2 outcomes; rejections concentrate in **trend / MA** and **early template structure**, with deeper-stage failures still consistent with “market not shaped like this playbook,” not bad data. Treat **`audit-gate2-sensitivity.ts`** as the **watchlist-only near-miss diagnostic** until product asks for persisted near-miss entities.

**Defer** “secondary scan mode” until there is a **separate product definition** (different template or timeframe) so it does not blur Gate 2 semantics.

**Universe curation target** is already validated for freshness; further target tweaks won’t fix a **zero A/B** Gate 2 distribution without changing rules or template scope.
