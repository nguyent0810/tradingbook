# Early Entry Backtest Evidence

Generated: 2026-06-23

## Status

**Experimental display-only research lane — not decision support.**
`EARLY_ENTRY_V1_ENABLED` remains off by default.

## Cohort

- Symbols: **50**
- Observations: **700**
- Sector anchors included: ACB, CTG, BID, BSR

## Baseline PILOT_BUY performance (current logic)

| Metric | Value |
|--------|-------|
| Pilot signals | 4 |
| False pilot rate (10d < 0) | 50.0% |
| Avg 5d / 10d / 20d return | -3.51% / 4.10% / 8.66% |
| Avg MAE / MFE (10d) | -6.26% / 9.59% |
| EXTENDED_DO_NOT_CHASE blocked | 90 (49 neg 5d) |

## Best calibration variant

**block_dist_ma20_gt_4** — pilots: 4, false rate: 50.0%, avg 10d: 4.10%

## Calibration variant comparison

| Variant | Pilots | False rate | Avg 10d | Avg MAE |
|---------|--------|------------|---------|---------|
| baseline | 4 | 50.0% | 4.10% | -6.26% |
| rr_min_2_5 | 1 | 0.0% | 31.00% | -3.00% |
| rs_improving_3d | 3 | 66.7% | -4.87% | -7.34% |
| next_day_confirmation | 0 | — | — | — |
| close_top_quartile | 0 | — | — | — |
| volume_ratio_1_5 | 3 | 66.7% | -4.87% | -7.34% |
| block_dist_ma20_gt_4 | 4 | 50.0% | 4.10% | -6.26% |
| block_weak_gate1 | 4 | 50.0% | 4.10% | -6.26% |
| two_day_follow_through | 0 | — | — | — |
| demote_weak_regime | 2 | 50.0% | 12.75% | -6.25% |
| combined_tight | 0 | — | — | — |

## State buckets (baseline)

### Blocked (n=357)
- Avg 10d: -0.70% · Win rate: 37.3%

### Watch (n=247)
- Avg 10d: -0.34% · Win rate: 40.9%

### Extended — Do Not Chase (n=90)
- Avg 10d: 0.06% · Win rate: 44.4%

### Pilot Candidate (n=4)
- Avg 10d: 4.10% · Win rate: 50.0%

### Add Zone (n=2)
- Avg 10d: -13.93% · Win rate: 0.0%

## False pilot diagnosis

- **CEO** 2026-01-30 — score 62, R:R 2.23, 10d -5.50%
  - Hypotheses: rr_target_too_optimistic, stop_too_loose, volume_spike_failed, no_follow_through
  - Codes: RECLAIM_MA20, VOLUME_EXPANSION, POCKET_PIVOT, RR_ACCEPTABLE, RS_IMPROVING
- **AAV** 2026-01-23 — score 62, R:R 2.12, 10d -11.48%
  - Hypotheses: market_regime_weak, rr_target_too_optimistic, stop_too_loose, volume_spike_failed, liquidity_issue, resistance_too_near
  - Codes: RECLAIM_MA20, VOLUME_EXPANSION, POCKET_PIVOT, RR_ACCEPTABLE, RS_IMPROVING

## Recommendation

1. Keep early-entry **display-only**; do not enable for staging decision support.
2. Rename UI label **Pilot Buy → Pilot Candidate** (research signal, not a buy).
3. Demote production PILOT_BUY to WATCH until 20+ paper-validated future signals.
4. EXTENDED_DO_NOT_CHASE shows useful defensive value — keep prominently displayed.
5. Test tightened calibration (R:R≥2.5 + Gate1 PASS + volume) in paper trading before any default change.