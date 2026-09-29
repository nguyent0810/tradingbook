import type { Gate2BarInput } from "@/lib/scanner/gate2/types";

/**
 * Entry-zone tightening shared with the Gợi ý lệnh builder (`trade-suggestion.ts`).
 *
 * This module used to derive the order ticket's own levels (midpoint entry,
 * resistance target, midpoint R:R). #17 retired that path: the ticket, the
 * log-trade action and every screen now read one `TradeSuggestion`. What stays
 * is the one piece the builder reuses. Prices in kVND.
 */

export const MIN_BARS_FOR_STRUCTURAL_SCAN = 65; // covers the 60-session resistance lookback + buffer
const ZONE_TIGHTEN_TRUE_RANGE_MULT = 1.5;
const TIGHTENED_HALF_WIDTH_TRUE_RANGE_MULT = 0.5;

/**
 * The setup's pullback zone, tightened around the boundary nearest the last
 * close when it is much wider than that session's true range, so it stays a
 * realistic next-session limit range. Shared with the trade suggestion
 * (`trade-suggestion.ts`), which snaps and band-clips the result.
 */
export function tightenEntryZone(
  zone: { low: number; high: number },
  lastBar: Pick<Gate2BarInput, "high" | "low" | "close">
): { low: number; high: number } {
  const trueRange = lastBar.high - lastBar.low;
  let low = zone.low;
  let high = zone.high;
  if (trueRange > 0 && high - low > trueRange * ZONE_TIGHTEN_TRUE_RANGE_MULT) {
    const nearBoundary =
      Math.abs(lastBar.close - low) <= Math.abs(high - lastBar.close) ? low : high;
    const halfWidth = trueRange * TIGHTENED_HALF_WIDTH_TRUE_RANGE_MULT;
    low = Math.max(low, nearBoundary - halfWidth);
    high = Math.min(high, nearBoundary + halfWidth);
    if (low > high) {
      // Degenerate tightening (shouldn't happen given the guards above) — fall back to the boundary itself.
      low = nearBoundary;
      high = nearBoundary;
    }
  }
  return { low, high };
}
