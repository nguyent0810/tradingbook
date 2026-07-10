/**
 * Phase 4 — Deterministic trailing-stop + excursion maintenance (pure).
 *
 * Uses ONLY the current session bar (no lookahead). Trailing raises to at least
 * breakeven once `breakevenAtR` is reached, then trails a deterministic 1R below
 * the high-water mark; it never lowers. MFE/MAE accumulate the max favorable /
 * adverse per-share excursion (in kVND) across sessions. The engine persists the
 * result; this function computes it so it can be unit-tested without a database.
 *
 * Ref-specific trails (MA20 / ATR chandelier / prior swing low) are deferred:
 * the mark step has only the OHLC bar, not per-symbol indicators. The high-water
 * − 1R trail is used as a deterministic, indicator-free proxy for v1.
 */
export interface TrailingInput {
  avgEntryKvnd: number;
  stopLossKvnd: number;
  initialRiskPerShareKvnd: number | null;
  highWaterMarkKvnd: number | null;
  trailingStopKvnd: number | null;
  maxFavorableExcursionKvnd: number;
  maxAdverseExcursionKvnd: number;
  bar: { low: number; high: number; close: number };
  trailingEnabled: boolean;
  breakevenAtR: number | null;
}

export interface TrailingUpdate {
  highWaterMarkKvnd: number;
  maxFavorableExcursionKvnd: number;
  maxAdverseExcursionKvnd: number;
  trailingStopKvnd: number;
  /** Stop used for exit detection this session: max(static stop, trailing stop). */
  effectiveStopKvnd: number;
  raisedToBreakeven: boolean;
}

export function computeTrailingUpdate(i: TrailingInput): TrailingUpdate {
  const priorTrail = i.trailingStopKvnd ?? i.stopLossKvnd;
  const hwm = Math.max(i.highWaterMarkKvnd ?? i.avgEntryKvnd, i.bar.high);
  const mfe = Math.max(i.maxFavorableExcursionKvnd, i.bar.high - i.avgEntryKvnd, 0);
  const mae = Math.max(i.maxAdverseExcursionKvnd, i.avgEntryKvnd - i.bar.low, 0);

  let trail = priorTrail;
  let raisedToBreakeven = false;
  if (i.trailingEnabled && i.breakevenAtR != null) {
    const R =
      i.initialRiskPerShareKvnd && i.initialRiskPerShareKvnd > 0
        ? i.initialRiskPerShareKvnd
        : Math.max(i.avgEntryKvnd - i.stopLossKvnd, 0);
    if (R > 0 && (hwm - i.avgEntryKvnd) / R >= i.breakevenAtR) {
      const breakeven = i.avgEntryKvnd;
      const giveback = hwm - R; // high-water − 1R
      const candidate = Math.max(breakeven, giveback);
      if (candidate > trail) {
        trail = candidate;
        raisedToBreakeven = true;
      }
    }
  }
  // Never lower the trailing stop.
  trail = Math.max(trail, priorTrail);

  return {
    highWaterMarkKvnd: hwm,
    maxFavorableExcursionKvnd: mfe,
    maxAdverseExcursionKvnd: mae,
    trailingStopKvnd: trail,
    effectiveStopKvnd: Math.max(i.stopLossKvnd, trail),
    raisedToBreakeven,
  };
}
