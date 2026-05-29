# Batch D — Signal quality (RS vs VNINDEX + threshold tuning)

**Status:** D0 + **D1 implemented (diagnostic-only UI)** — Gate 2 pass/fail, rankScore, thresholds, and persistence unchanged.

Batches A–F delivered auditability and UX alignment. Batch D is the first slice toward **signal quality**: relative strength vs VNINDEX and evidence-based threshold review. **No Gate 2 pass/fail, rankScore formula, or persistence changes** until a follow-up implementation slice is reviewed.

---

## 1. Current signal quality limitations

| Gap | Evidence in code / ops |
|-----|-------------------------|
| **No relative strength vs benchmark** | Gate 2 uses symbol-only trend (close ≥ MA50, MA20 ≥ MA50). VNINDEX is used for **session anchor** and **Gate 1 regime**, not per-symbol RS. (`breakout-pullback.ts`, `gate1-market.ts`) |
| **rankScore ignores RS** | `computeGate2RankBreakdown` weights volume, extension, MA distance, depth only (`rank-components.ts`). |
| **Symbol trend ≠ market leadership** | `gate2-sensitivity-audit.md` snapshot: ~70% INVALID at `trend_below_ma50` / `trend_ma20_below_ma50` among tradable names; deeper near-misses often fail **pullback_zone_interaction** while trend OK. |
| **Template narrowness** | Breakout in last 10 bars, digestion, zone interaction — documented in `algorithm-map.md` and `gex-gee-breakout-retrospective.md`. RS does not fix template mismatch alone. |
| **Zero A/B in recent curated runs** | Sensitivity audit: 0 Tier A/B among 67 tradable — tuning thresholds without RS may only reshuffle INVALID buckets. |
| **No labeled outcome harness** | `Trade` / `SetupCandidate` exist but there is no automated forward-return label tied to scan history for Gate 2 quality. |

---

## 2. Data available for RS and replay

| Source | Model | Use |
|--------|--------|-----|
| VNINDEX EOD | `IndexDailyBar` | Benchmark closes; same session calendar as equities when imports are aligned |
| Equities EOD | `StockDailyBar` | Gate 2 input; ≥120 bars required for tradability, ≥50 for Gate 2 |
| Session anchor | `getExpectedLatestSessionFromIndexBars` | UTC calendar day of latest VNINDEX bar |
| Gate 1 | `evaluateMarketRegime` on VNINDEX | Coarse PASS/WARNING/FAIL — not symbol RS |
| Historical replay | `scripts/gex-gee-breakout-retrospective.ts` | Walk-forward pattern: bars ≤ `t`, `expectedLatestSession = t` |

**Constraints:** Index and stock prices are comparable as **return ratios** (unitless). Do not mix VNINDEX **points** with stock **thousand-VND** nominal levels in level-based RS; use **returns** or **% above MA50** per series.

**Coverage:** RS requires index bars on both anchor dates for each lookback. Missing index history → RS `null` (fail safe). Weak session coverage (Batch B) should be reviewed before trusting RS on stale symbols.

---

## 3. RS formula candidates (comparison)

| Formula | Definition | Pros | Cons |
|---------|------------|------|------|
| **A. Return spread (recommended v1)** | `RS_N = ret_stock(N) − ret_VNINDEX(N)` over N sessions aligned to stock calendar | Simple, interpretable (pp), uses existing bars, matches audit scripts | Sensitive to N; one spike dominates |
| **B. Normalized trend strength ratio** | e.g. `(close−MA50)/MA50` stock divided by index same | Scale-free trend shape | Noisy when index MA50 flat; harder to threshold |
| **C. Dual MA50 state** | `stockClose > stockMA50` and `indexClose > indexMA50` | Explains “stock strong in weak market” | Binary; not a continuous rank |
| **D. Rolling RS percentile** | Cross-sectional rank of RS20 across universe | Good for rotation days | Needs full-universe pass; heavier |

**Recommendation (v1 diagnostic):** Implement **A** at **N = 20** and **N = 50** plus **C** as boolean context flags. Defer cross-sectional percentile until a universe replay job exists.

**Proposed v1 constants (diagnostic only — not enforced):**

| Constant | Initial probe | Rationale |
|----------|---------------|-----------|
| `RS_LOOKBACK_SHORT` | 20 | Aligns with `GATE2_RANGE_DAYS` |
| `RS_LOOKBACK_LONG` | 50 | Aligns with MA50 window |
| `RS_SPREAD_TIER_A_HINT` | +5 pp over 20d | Leader vs index on short window |
| `RS_SPREAD_INVALID_FILTER_PROBE` | −3 pp over 20d | Hypothetical laggards only in replay |

---

## 4. Where RS should enter the pipeline (phased)

| Phase | Placement | Affects pass/fail? | Affects rankScore? | Risk |
|-------|-----------|-------------------|-------------------|------|
| **D0** | `relative-strength.ts` + `scripts/rs-gate2-diagnostic.ts` | No | No | None — **done** |
| **D1** | Setups + dashboard near-miss/candidate panels (`RelativeStrengthDiagnosticPanel`) | No | No | **Done** — on-demand DB reads, no schema change |
| **D2** | Optional `rsTerm` in `rankComponents` (additive term, capped) | No | Yes (ordering only) | Medium — changes sort order of A/B |
| **D3** | Tier A/B **upgrade/downgrade** (e.g. B→A if RS50 > X) | Soft quality | Indirect | Medium |
| **D4** | **Hard filter** (e.g. INVALID if RS20 < 0) | Yes | Yes | High — false negatives on mean reversion |
| **D5** | Gate 1 fusion | Yes | — | High — confounds market regime |

**Recommendation:** Ship **D0 → D1 → D2** before any hard filter. Use replay to measure false positives/negatives. Keep Gate 1 separate; RS is **symbol vs index**, Gate 1 is **index regime**.

---

## 5. Read-only analysis and replay plan

### 5.1 Existing tooling (reuse)

| Tool | Purpose |
|------|---------|
| `scripts/gate2-audit.ts` | Full-tradable Gate 2 JSON |
| `scripts/audit-gate2-sensitivity.ts` | Rejection buckets + near-miss |
| `scripts/gex-gee-breakout-retrospective.ts` | Walk-forward per symbol |
| `scripts/rs-gate2-diagnostic.ts` | **New** — Gate 2 + RS overlay JSON |

### 5.2 Proposed replay harness (D-next)

1. **Point-in-time scan replay** — For each session `t` in last 60–120 VNINDEX sessions:
   - Tradability at `t` (or skip if bars unavailable historically).
   - `evaluateBreakoutPullbackCandidate` at `t`.
   - `computeRelativeStrengthDiagnostic` at `t`.
2. **Compare arms:**
   - **Baseline:** current Gate 2 quality.
   - **Counterfactual A:** baseline + drop if `RS20 < 0`.
   - **Counterfactual B:** baseline + boost rank by `f(RS20)` only among A/B.
3. **Metrics (no PnL required for v1):**
   - Count A/B/INVALID delta vs baseline.
   - Stability: % sessions a symbol flips quality with/without RS filter.
   - **False positive proxy:** A/B with `RS20 < 0` (would be removed by hard filter).
   - **False negative proxy:** INVALID at `pullback_zone_interaction` / `breakout_recency` with `RS20 > +5pp` (template fail but strong RS).
4. **Outcome extension (optional):** Forward 5/10/20 session return of stock vs index for each A/B event — requires bar store only, not trade DB.

### 5.3 Feasibility

| Approach | Feasible? | Notes |
|----------|-----------|-------|
| CLI replay on DB bars | **Yes** | Pattern proven in `gex-gee-breakout-retrospective.ts` |
| Full-universe walk-forward | **Yes** | CPU/DB bound; batch by symbol |
| True backtest with fills | **No v1** | No slippage/commission model in repo |
| ML tuning | **Out of scope** | Threshold matrix + replay first |

---

## 6. Threshold tuning — sensitivity matrix (no changes yet)

Current constants (`src/lib/scanner/gate2/constants.ts`):

| Constant | Current | Likely effect if loosened | Likely effect if tightened | Audit priority |
|----------|---------|---------------------------|----------------------------|----------------|
| `GATE2_MIN_RISK_TO_STOP_FRAC` | 0.3% | More setups; micro-stops | Fewer; `stop_structure` INVALID | Medium — VN tick size |
| `GATE2_VOL_RATIO_B` / `_A` | 1.2 / 1.5 | More B (and A) | Fewer liquidity passes | Low in recent snapshot (0 volume fails) |
| `GATE2_MAX_BREAKOUT_EXTENSION_FRAC` | 5% | More chase entries | Fewer `extension_cap` | High for near-miss “above zone” |
| `GATE2_MAX_PULLBACK_DEPTH_FRAC` | 4% | Deeper pullbacks allowed | More `depth_cap` | Medium |
| `GATE2_BREAKOUT_RECENCY_BARS` | 10 | More `breakout_recency` passes | Fewer; continuation leaders stay INVALID | **High** (see GEX/GEE doc) |
| `GATE2_RANGE_DAYS` | 20 | Breakout level sensitivity | Breakout definition shift | Medium |
| `GATE2_DELTA_PULLBACK` | 2% | Wider zone | Narrower zone; more `pullback_zone_interaction` | High |
| MA structure rules | hard-coded | — | — | **Highest** (41/67 trend_below_ma50 in snapshot) |

**Proposed sensitivity grid (offline script extension):**

For each parameter `p ∈ {recency, extension, depth, vol_B, delta_pullback}`:

- Values: `{0.8×, 1.0×, 1.2×}` of current (document exact numeric grid in implementation).
- Measure: Δ count A, B, INVALID; top-3 terminal category shifts.
- **Do not** combine multi-parameter sweeps until single-parameter shape is understood.

---

## 7. D1 UI surfaces (implemented)

| Surface | Data flow |
|---------|-----------|
| Setups surfaced candidates | `loadRsDiagnosticsForSetupsCached` → expanded row `RelativeStrengthDiagnosticPanel` |
| Setups closest / near-miss | Same loader keyed by `closestToValidSymbols` symbols |
| Dashboard opportunity / near-miss panels | `dashboard/page.tsx` → `rsDiagnosticsBySymbol` on `DecisionCockpitInput` |
| Cockpit DTO | `OpportunityCandidateDto.rsDiagnostic` / `OpportunityNearMissDto.rsDiagnostic` (nullable) |

Copy helpers: `rs-diagnostic-format.ts` (`formatRelativeStrengthDiagnosticForUi`, `RS_DIAGNOSTIC_DISCLAIMER`).

Old scans without RS: `rsDiagnostic` is `null`; rank breakdown from Batch C still renders.

## 8. Gate 2 threshold sweep (D1.5 — implemented)

**Script:** `npx tsx scripts/gate2-threshold-sweep.ts`

| Flag | Purpose |
|------|---------|
| `--limit=N` | Max tradable symbols to load |
| `--symbols=HPG,FPT` | Restrict symbol list |
| `--lookbackSessions=N` | Walk-forward: evaluate at last N sessions per symbol (default 1) |
| `--asOf=YYYY-MM-DD` | Single evaluation session (overrides walk-forward) |
| `--json` | Full JSON report (arms, terminal counts, changed symbols + RS) |

**Mechanism:** `evaluateBreakoutPullbackCandidate(bars, session, evalParams?)` accepts optional `Gate2EvalParams`; default is `PRODUCTION_GATE2_EVAL_PARAMS` (byte-identical to pre-D1.5). Sweeps vary one field at `{0.8×, 1.2×}` production value per dimension.

**Swept parameters (v1):**

- `GATE2_BREAKOUT_RECENCY_BARS`
- `GATE2_DELTA_PULLBACK`
- `GATE2_MAX_BREAKOUT_EXTENSION_FRAC`
- `GATE2_MAX_PULLBACK_DEPTH_FRAC`
- `GATE2_VOL_RATIO_B` (min volume — labeled `minVolumeRatioB` in reports)
- `GATE2_MIN_RISK_TO_STOP_FRAC`

**Does not:** persist results, change `constants.ts`, or alter the daily scanner job.

### Interpreting dominant terminal codes (baseline)

| High count | Meaning | Sweep lever to probe |
|------------|---------|----------------------|
| `trend_below_ma50` | Symbol below its own MA50 — not RS; template is long-trend only | Not in v1 sweep grid (would need separate experiment) |
| `breakout_recency` | No fresh breakout in last N sessions | ↑ `breakoutRecencyBars` (1.2×) |
| `pullback_zone_interaction` | Price not in pullback box (“zone miss”) | ↑ `deltaPullback` (wider box) or recency |
| `volume_ratio` | Today’s vol below min × median | ↓ `volRatioB` (0.8×) |
| `extension_cap` | Chasing above breakout cap | ↑ `maxBreakoutExtensionFrac` (1.2×) |
| `depth_cap` | Pullback too deep under breakout | ↑ `maxPullbackDepthFrac` (1.2×) |

Compare **ΔA / ΔB / ΔINVALID** and **newly passing / newly rejected** per arm. Use **changedSymbolsRs** in JSON to see whether flips align with strong RS20.

## 9. Replay fix + RS cohorts (D1.5.1 / D1.7 — implemented)

- Threshold sweep uses **per-row `sessionDate`** in walk-forward (fixes anchor-session stale bug).
- Forward cohorts: `invalid_rs20_positive`, `invalid_rs20_negative`, `invalid_rs20_neutral_or_missing`.
- JSON `reportSchemaVersion: d1.7-replay-fixed`; stale-rate and missing-20d warnings.
- Evidence: [gate2-d1-evidence-decision-memo.md](./gate2-d1-evidence-decision-memo.md), `docs/trading/evidence/*replay-fixed*`.

## 10. D2 capped RS rank term (implemented — default off)

**Formula (preview / opt-in only):**

`rsTerm = clamp(RS20_pp × 25, -250, +250)`  
`rankScoreWithRs = rankScoreBase + rsTerm`

- **RS20_pp:** 20-session stock return minus VNINDEX (percentage points).
- **RS50:** context in UI only; not in v1 `rsTerm`.
- **Cap rationale:** typical Tier A `rankScoreBase` ≈ 2,000–3,500; ±250 is ~7–12% nudge — cannot dominate volume/extension/MA/depth terms.
- **Not a filter:** Gate 2 pass/fail, tiers, and thresholds unchanged.
- **Production ordering:** unchanged unless `GATE2_RS_RANK_TERM_ENABLED=true` (env). Setups shows **preview only** labeled “not active in production ranking.”

**Tooling:** `npx tsx scripts/gate2-rs-rank-comparison.ts` (`--json`, `--replay` for all anchor A/B).

**Enable criteria (before production ordering):** replay-fixed evidence, RS+ vs RS− edge holds on trimmed window, sign-off, A/B benchmark n≥30 (`RS_RANK_ENABLE_MIN_AB_SAMPLES`).

## 10b. D2.1 RS rank evidence hardening (implemented)

**Script:** `npx tsx scripts/gate2-rs-rank-comparison.ts --replay --lookbackSessions=60 --json`

Outputs `d2.1-rs-rank-evidence` report: A/B counts, base vs RS-adjusted ranks, promoted/demoted lists, per-row RS20/RS50/`rsTerm`, forward-return join for promoted vs demoted vs unchanged, enablement readiness.

RS computed **per replay session** in walk-forward mode (not anchor-only).

## 10c. D2.2 evidence readiness / coverage (implemented)

**Script:** `npx tsx scripts/gate2-evidence-readiness.ts "--windows=40,60,80,120,160" --json`

Reports per lookback: replay rows, A/B counts, missing 20d rate, A/B after T−20 eligibility (`--requireForward20d` on forward-return / replay builders).

**Flag:** `GATE2_RS_RANK_TERM_ENABLED` stays off until `abCountForward20Eligible ≥ 30` on a fixed window.

**D2.2 prod evidence (2026-05-29):** max raw A/B ≈ 15 @ lookback 120–160; max T−20-eligible A/B ≈ 13 — **n≥30 not achievable** on current DB. Gate 2 A/B is structurally rare; INVALID RS+ vs RS− forward edge remains stronger than RS rank enablement.

## 10d. D2.3 Relative-strength near-miss watchlist (implemented — diagnostic only)

**Chosen path** because A/B replay sample is too sparse for RS-adjusted rank enablement (see D2.2). This lane does **not** change Gate 2 pass/fail, tiers, thresholds, `rankScore`, production scanner persistence, or `GATE2_RS_RANK_TERM_ENABLED` (stays false).

**Universe:** `quality === INVALID`, **RS20 > 0** (computable, session-aligned), terminal in monitor set (`breakout_recency`, `pullback_zone_interaction`, `volume_ratio`, `trend_below_ma50`), excludes **Tier A/B** from latest scan and `stale_or_session_mismatch` / `insufficient_bars`.

**Sort (explicit, not `rankScore`):** RS20 desc → `stageRank` desc → distance-to-pullback-zone asc → RS50 desc → last volume desc → symbol asc. Documented in `rs-near-miss-watchlist.ts` as `RS_NEAR_MISS_WATCHLIST_SORT_DOC`.

**Surfaces:** Setups pipeline tail (`setups-rs-near-miss-watchlist`), dashboard v3 diagnostic zone + secondary intelligence (command-deck). Copy on every row: *Relative-strength watchlist · Diagnostic only · Not a Gate 2 SetupCandidate · Not used in current trading decision · Failed Gate 2 because: …*

**CLI (no persistence):**

```bash
npx tsx scripts/gate2-rs-watchlist.ts
npx tsx scripts/gate2-rs-watchlist.ts --limit=15 --json
npx tsx scripts/gate2-rs-watchlist.ts --forward
```

**Library:** `src/lib/scanner/gate2/rs-near-miss-watchlist.ts`

**Ops:** Archive watchlist JSON periodically for forward evidence; promote to a formal “RS leader monitor” only after sustained INVALID RS+ edge — not before.

## 11. Forward-return validation (D1.6 — implemented)

**Script:** `npx tsx scripts/gate2-forward-return-validation.ts`

| Flag | Purpose |
|------|---------|
| `--limit=N` | Max tradable symbols |
| `--symbols=HPG,FPT` | Symbol filter |
| `--lookbackSessions=N` | Walk-forward evaluation rows per symbol |
| `--asOf=YYYY-MM-DD` | Single evaluation session |
| `--noSweep` | Skip threshold sweep cohorts (faster) |
| `--includeSweepRejects` | Also cohort per sweep arm newly rejected |
| `--json` | Full JSON output |

**Labels (from evaluation close):** forward return 5/10/20 sessions, MFE/MAE over 20 sessions, hit +5% before −3%, hit +10% within 20d, drawdown &lt; −5% within 20d.

**Cohorts:** baseline Tier A/B · INVALID with RS20&gt;0 · `sweep_new_pass:{dimension}×{mult}` (and optional reject).

**Helpers:** `forward-returns.ts`, `forward-return-validation.ts`, `gate2-replay-dataset.ts`.

Use with D1.5 on an aligned DB: archive `--json` from both scripts before proposing threshold or RS rank changes. Treat n&lt;10 per cohort as hypothesis-only.

## 12. Diagnostic script shape (implemented D0)

```bash
npx tsx scripts/rs-gate2-diagnostic.ts
npx tsx scripts/rs-gate2-diagnostic.ts --limit=30
npx tsx scripts/rs-gate2-diagnostic.ts --symbols=HPG,FPT
```

Output: JSON with `gate2Quality`, terminal category, `relativeStrength` (RS20/RS50 spread, dual MA50 flags), and **hypotheticalNotes** (interpretation only).

Library: `src/lib/scanner/gate2/relative-strength.ts` — pure functions, unit-tested.

---

## 13. Risks and tradeoffs

| Risk | Mitigation |
|------|------------|
| RS hard filter removes valid pullbacks in weak index tape | Start with rank-only; measure false negatives in replay |
| Double-counting trend (MA50 rule + RS) | RS measures **relative** performance; document overlap |
| Index/stock session misalignment | Require same calendar keys; report `null` RS when missing |
| Threshold sweep overfitting | Single-parameter sweeps; hold out recent month |
| rankScore change reorders book without validation | Version `rankComponents` v2 in JSON when D2 ships |

---

## 14. Next implementation slice (safe order)

| Step | Files (expected) | Tests |
|------|------------------|-------|
| D0 | `relative-strength.ts`, `relative-strength.test.ts`, `rs-gate2-diagnostic.ts` | **Done** |
| D1 | `rs-diagnostic-format.ts`, `load-rs-diagnostics.ts`, `RelativeStrengthDiagnosticPanel` | **Done** |
| D1.5 | `scripts/gate2-threshold-sweep.ts` | **Done** |
| D1.6 | `forward-returns.ts`, `forward-return-validation.ts`, `scripts/gate2-forward-return-validation.ts` | **Done** |
| D1.5.1 / D1.7 | Per-row sweep session, RS− cohorts, evidence replay-fixed | **Done** — see decision memo |
| D2 | `rs-rank-term.ts`, `gate2-rs-rank-comparison.ts`, Setups RS preview UI | **Done (default off)** |
| D2.1 | `rs-rank-evidence.ts`, walk-forward rank + forward join | **Done** — see decision memo §10 |
| D2.2 | `gate2-evidence-readiness.ts`, `--requireForward20d` on replay | **Done** — see memo §11 |
| D4 | Review hard filter / tier rules | Replay report + sign-off |

**Schema:** No migration required for D0–D2 if RS lives in `reasons` JSON (like Batch C `rankComponents`). New Prisma fields only if query/filter in SQL is required — **stop and propose migration first**.

---

## 15. Tests required before behavior changes

- [ ] `relative-strength.test.ts` — spread math, missing index dates, dual MA50 flags
- [ ] Golden tests: `breakout-pullback.test.ts` — unchanged pass/fail for fixture symbols
- [ ] Golden tests: `rank-components.test.ts` — fixed rankScore when RS term = 0
- [ ] Replay regression: GEX/GEE walk-forward terminal distribution unchanged when RS disabled
- [ ] Integration: `run-daily-scan-job` still persists same A/B count on frozen fixture DB (if available)

---

## Related docs

- `docs/trading/algorithm-map.md` — pipeline truth
- `docs/trading/gate2-sensitivity-audit.md` — rejection shape
- `docs/trading/gex-gee-breakout-retrospective.md` — walk-forward example
- `docs/trading/scanner-rules-market-comparison-audit.md` — rule inventory
