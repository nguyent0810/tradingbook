# Gate 2 D1.5 / D1.6 evidence decision memo

**Date:** 2026-05-29 (updated after D1.5.1 / D1.7 replay fix)  
**DB:** Neon production via `.env.prod.local` (not committed)  
**VNINDEX anchor:** 2026-05-28  
**Schema:** `d1.7-replay-fixed`  
**Status:** Draft — do not commit until reviewed  
**Production behavior changed:** No  

---

## 1. Replay-session bug (before vs after)

### What was wrong (pre–D1.5.1)

`runThresholdSweep()` passed the **global anchor** (`2026-05-28`) as `sessionDate` for **every** walk-forward row while `bars` ended on **earlier** sessions. Gate 2 compares the last bar to `expectedLatestSession` → **`stale_or_session_mismatch` on ~97%** of walk-forward D1.5 rows. That JSON is **misleading** for threshold flips.

**Misleading archive:** `gate2-threshold-sweep-2026-05-29.json` (and sanity variant).

### What was fixed (D1.5.1 / D1.7)

- `SymbolBarsInput.sessionDate` — per-row evaluation session.
- `resolveSymbolEvaluationSession()` — walk-forward uses row date; anchor-only omits it.
- `replayMode`, `staleSessionMismatchCount`, `highStaleRateWarning` on sweep reports.
- RS comparison cohorts: `invalid_rs20_negative`, `invalid_rs20_neutral_or_missing`.
- `missingFuture20Pct`, `highMissingFuture20Warning` when &gt;30% lack 20d labels.
- `reportSchemaVersion: d1.7-replay-fixed` on sweep + forward JSON.

**D1.6 forward labeling was already per-row**; cohort logic extended, not rewritten.

### After fix (walk-forward, n=2160)

| Metric | Pre-fix D1.5 | Post-fix D1.5 |
|--------|--------------|---------------|
| `stale_or_session_mismatch` | ~2106 (97%) | **0** |
| Baseline A / B / INVALID | 1 / 0 / 2159 (distorted) | **2 / 0 / 2158** |
| Top terminal | `stale_or_session_mismatch` | `trend_below_ma50` (1357) |

---

## 2. Commands run (this pass)

```powershell
# Load prod DATABASE_URL from .env.prod.local, then:
npx tsx scripts/gate2-threshold-sweep.ts --lookbackSessions=40 --json
npx tsx scripts/gate2-forward-return-validation.ts --lookbackSessions=40 --json --includeSweepRejects
npx vitest run src/lib/scanner/gate2/
```

---

## 3. Evidence files

| File | Role |
|------|------|
| `gate2-threshold-sweep-replay-fixed-2026-05-29.json` | **Trustworthy** D1.5 walk-forward |
| `gate2-forward-return-validation-replay-fixed-2026-05-29.json` | **Trustworthy** D1.6 walk-forward |
| `gate2-threshold-sweep-2026-05-29.json` | **Deprecated** (anchor-session bug) |
| `gate2-forward-return-validation-2026-05-29.json` | D1.6 pre–RS-negative cohorts (still usable for RS+ only) |
| `gate2-threshold-sweep-anchor-2026-05-29.json` | Anchor-only D1.5 (54 rows, valid) |

---

## 4. DB / scan context

| Check | Value |
|--------|--------|
| Active symbols | 206 |
| Tradable @ anchor | 54 |
| Last scan | 1× Tier A, 0× Tier B |
| Walk-forward rows | 2160 (54 × 40 sessions) |

---

## 5. D1.5 threshold sweep (replay-fixed, lookback 40)

- **Stale mismatches:** 0  
- **Baseline:** A=2, B=0, INVALID=2158  
- **Top terminals:** `trend_below_ma50` (1357), `breakout_recency` (283), `trend_ma20_below_ma50` (251)  
- **Newly passing (all arms):** 3 row-flips total (1 per arm: `breakoutRecencyBars×1.2`, `maxPullbackDepthFrac×1.2`, `minVolumeRatioB×0.8`)  
- **ΔA/ΔB at arm level:** at most +1 per arm — **no material threshold unlock**

**Anchor-only (54 rows, prior run):** 0 newly passing/rejected under ±20% — consistent with fixed walk-forward having negligible tier flips.

**Conclusion:** Threshold proposal **not supported** at ±20% on this snapshot.

---

## 6. D1.6 forward-return cohorts (replay-fixed, lookback 40)

Rules: ignore **n &lt; 10** for decisions; note **&gt;30% missing 20d** warnings.

### Baseline pass tiers

| Cohort | n | Fwd 20d | Note |
|--------|--:|---------|------|
| `baseline_tier_a` | 2 | — | Ignore (n&lt;10); 100% missing 20d |
| `baseline_tier_b` | 0 | — | No sample |

Production has **1× A** at anchor; walk-forward pass-tier sample remains too small for forward benchmarking.

### INVALID — RS comparison (decision-grade n)

| Cohort | n | Missing 20d | Fwd 20d (labeled n) | Win 20d | MFE20 | MAE20 | Hit +5 before −3 |
|--------|--:|------------:|---------------------|--------:|------:|------:|------------------|
| `invalid_rs20_positive` | 1118 | 49.9% ⚠ | **+3.08%** (560) | **57.9%** | +9.27% | −5.22% | 39.8% |
| `invalid_rs20_negative` | 1040 | 50.0% ⚠ | **−1.26%** (520) | **28.3%** | +7.64% | −6.62% | 37.8% |

**Spread (RS+ vs RS−):** ~**+4.3 pp** average 20d return; ~**+30 pp** win rate. RS+ INVALID still has **~41%** drawdown worse than −5% within 20d — not risk-free.

`invalid_rs20_neutral_or_missing`: not populated in this run (RS overlay at anchor assigns non-zero spread to most INVALID rows).

### Sweep new-pass forward (all n=1)

Anecdotal only — no arm meets n≥10.

---

## 7. Decision recommendation

### Primary: **D2 capped `rsTerm` proposal slice** (next safe experiment)

RS-positive INVALID **meaningfully outperforms** RS-negative INVALID on adequate labeled samples (560 vs 520 @ 20d), with similar hit/DD profiles. This supports a **diagnostic → proposed rank experiment** (`rsTerm` capped, off by default in prod) — **not** promoting RS to a filter yet.

### Parallel: **Ops / evidence hygiene** (not blocking D2 proposal, but required for cleaner archives)

- **~50% missing 20d** labels in both RS INVALID cohorts — trim walk-forward end (`lookbackSessions` ≤ last_available−20) or extend bar history; re-archive.
- RS overlay still loaded at **anchor** for all historical rows (known D1 limitation).
- Continue **no threshold change** (±20% sweeps do not flip tiers materially).

### Do **not** yet

| Action | Why |
|--------|-----|
| Production RS filter/rank | Proposal only; pass-tier benchmark still n&lt;10 |
| Threshold production change | ≤3 row-flips; no adequate forward cohort per arm |
| Trust pre-fix D1.5 walk-forward JSON | 97% stale artifact |

### If D2 experiment fails on frozen replay

Keep algorithm unchanged; RS remains diagnostic-only.

---

## 8. Code changes (diagnostic only)

| File | Change |
|------|--------|
| `gate2-threshold-sweep.ts` | Per-row `sessionDate`; replay metadata + stale warnings |
| `forward-return-validation.ts` | RS−/neutral cohorts; missing-20d warnings; schema version |
| `scripts/gate2-threshold-sweep.ts` | `buildReplayRowsForSymbol`; pass `sessionDate` |
| `scripts/gate2-forward-return-validation.ts` | JSON `generatedAt` |
| `gate2-threshold-sweep.test.ts` | Walk-forward vs anchor regression tests |
| `forward-return-validation.test.ts` | RS cohort + missing-20d tests |

**Production:** `breakout-pullback.ts` default path unchanged (tests assert explicit params match implicit).

**Tests:** `npx vitest run src/lib/scanner/gate2/` → **67 passed**.

---

## 9. D2 implementation status (rank-only, default off)

Implemented in `rs-rank-term.ts`:

- `rsTerm = clamp(RS20_pp × 25, -250, +250)`
- `rankScoreWithRs = rankScoreBase + rsTerm`
- Production scan ordering **unchanged** unless `GATE2_RS_RANK_TERM_ENABLED=true`
- Setups expanded row shows **RS rank term preview** (labeled preview-only)
- `npx tsx scripts/gate2-rs-rank-comparison.ts --replay --json` for ordering diff

**Still required before enabling production ordering:** trimmed replay window, sign-off, pass-tier benchmark n≥10.

---

## 10. D2.1 RS rank evidence (2026-05-29)

### Commands

```bash
npx tsx scripts/gate2-rs-rank-comparison.ts --replay --lookbackSessions=40 --json
npx tsx scripts/gate2-rs-rank-comparison.ts --replay --lookbackSessions=60 --json
npx tsx scripts/gate2-rs-rank-comparison.ts --replay --lookbackSessions=80 --json
```

### Evidence files (uncommitted)

| File | lookback | A/B n | promoted | demoted |
|------|----------|------:|---------:|--------:|
| `gate2-rs-rank-comparison-replay-d2-2026-05-29.json` | 40 | 2 | 0 | 0 |
| `gate2-rs-rank-comparison-replay-d2-wf60-2026-05-29.json` | 60 | 7 | 1 | 1 |
| `gate2-rs-rank-comparison-replay-d2-wf80-2026-05-29.json` | 80 | 8 | 1 | 1 |

Walk-forward: 54 tradable × lookback eval rows; RS at **each session** (not anchor bias).

### Ordering summary (lookback 60 — best A/B sample)

- **Tier A only** in replay (7 rows); production anchor still 1× CTR Tier A.
- **Promoted:** `BMS@2026-03-06` (rank 7→6) — RS term +250 (RS20 at cap).
- **Demoted:** `CTR@2026-05-28` (rank 6→7) — RS term +94 but lower base score vs peers.
- **No rank changes** at lookback 40 (n=2).

### Promoted vs demoted forward returns (lookback 60)

| Group | n | Missing 20d | Fwd 20d avg | Win 20d |
|-------|--:|------------|------------|--------:|
| promoted | 1 | 0% | **+5.11%** | 100% |
| demoted | 1 | 100% | — | — |
| unchanged | 5 | 20% | **−24.05%** | 0% |

Anecdotal: single promoted row looks better; demoted row has no 20d label (latest session). **Not decision-grade.**

### D2.1 recommendation

**Keep RS preview only** — do **not** enable `GATE2_RS_RANK_TERM_ENABLED`.

| Criterion | Status |
|-----------|--------|
| A/B replay n ≥ 30 | **Fail** (max 8 @ lookback 80) |
| Promoted &gt; demoted forward profile | **Inconclusive** (n=1 each) |
| Acceptable drawdown | **Unknown** on promoted (n=1) |
| Explainable ordering | Partially (RS term nudges mid-pack only) |
| Missing future labels | **High** on demoted anchor row; unchanged cohort negative |

**Next:** collect more historical A/B events (longer history / more symbols passing Gate 2) or accept RS as INVALID-cohort signal only (D1 forward evidence), not production rank yet.

Optional: staging enablement for **manual review only** — not recommended until n≥30 and promoted vs demoted forward comparison is significant.

---

## 11. D2.2 evidence readiness (2026-05-29)

### Command

```bash
npx tsx scripts/gate2-evidence-readiness.ts "--windows=40,60,80,120,160" --json
```

Evidence: `docs/trading/evidence/gate2-evidence-readiness-2026-05-29.json` (uncommitted).

### Universe / freshness

| Metric | Value |
|--------|------:|
| Active symbols | 206 |
| Symbols with ≥50 bars | 206 |
| Symbols with T−20 eval capacity | 206 |
| Tradable @ anchor 2026-05-28 | 54 |
| Stale latest bar vs anchor | 38 |

### Readiness by lookback (walk-forward, tradable universe)

| lookback | replay rows | replay (T−20 eligible) | A/B | A/B (T−20 eligible) | missing 20d % |
|---------:|------------:|-----------------------:|----:|----------------------:|----------------:|
| 40 | 2160 | 1080 | 2 | **0** | 50.0% |
| 60 | 3240 | 2700 | 7 | 5 | 16.7% |
| 80 | 4320 | 3780 | 8 | 6 | 12.5% |
| 120 | 6480 | 5940 | 15 | 13 | 8.3% |
| 160 | 8640 | 8100 | 15 | 13 | 6.3% |

**n≥30 A/B with clean forward-20d:** **Not achievable** on current DB (best **13** @ lookback 120–160). Raw A/B without T−20 peaks at **15** — Gate 2 pass events are rare and plateau with history.

**T−20 insight:** At lookback 40, both anchor A/B sessions sit in the last 20 bars → **zero** forward-20d-eligible A/B. Wider lookback recovers historical A/B rows (e.g. BMS@2026-03-06 in D2.1).

### D2.2 recommendation

| Action | Verdict |
|--------|---------|
| Enable `GATE2_RS_RANK_TERM_ENABLED` | **No** — max 13 T−20-eligible A/B &lt; 30 |
| Rerun D2.1 @ lookback 120 + `--requireForward20d` | **Yes** — best available window for RS ordering + forward join (still underpowered) |
| Near-miss RS watchlist (INVALID RS+) | **Yes** — stronger signal than sparse A/B rank enablement |
| Ops / data first | **Partial** — 38 stale symbols; not the binding constraint vs A/B scarcity |

**Keep RS preview only** for production ordering.

Forward-return scripts: add `--requireForward20d` when archiving cohort evidence.

---

## 11b. D2.3 relative-strength near-miss watchlist (implemented)

Product path from D2.2: **diagnostic RS leader monitor** instead of RS rank enablement.

- **Library:** `src/lib/scanner/gate2/rs-near-miss-watchlist.ts`
- **CLI:** `npx tsx scripts/gate2-rs-watchlist.ts` (no persistence)
- **UI:** Setups tail + dashboard v3 diagnostic zone; copy marks *Diagnostic only · Not a Gate 2 SetupCandidate · Not used in current trading decision*
- **Does not change:** Gate 2 pass/fail, tiers, thresholds, `rankScore`, daily scanner job, or `GATE2_RS_RANK_TERM_ENABLED`

**Ops:** archive CLI `--json` over time; consider formal “RS leader monitor” only after sustained INVALID RS+ forward evidence.

---

## 12. Next actions

1. Review `gate2-evidence-readiness-2026-05-29.json`.  
2. Optional: `gate2-forward-return-validation.ts --lookbackSessions=120 --requireForward20d --json`.  
3. Do **not** enable `GATE2_RS_RANK_TERM_ENABLED` without explicit approval.  
4. Use `gate2-rs-watchlist.ts` / Setups RS panel for INVALID RS+ monitoring — not for trade signals.  
5. Do **not** commit memo/evidence until reviewed; **do not push**.
