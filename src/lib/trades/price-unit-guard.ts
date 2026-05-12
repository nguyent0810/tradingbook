/**
 * Detects likely entry vs daily-close unit mismatch (e.g. nominal VND vs thousand-VND bars).
 * Conservative: avoids flagging same-scale pairs (see unit tests).
 */
export const TRADE_ENTRY_PRICE_UNIT_MISMATCH_MESSAGE =
  "Entry price appears to use a different unit than imported closes. Imported VN equity closes are stored in thousand VND per share — align entry with that scale.";

export function detectTradePriceUnitMismatch(
  entryPrice: number,
  latestClose: number | null
): boolean {
  if (latestClose == null || !Number.isFinite(latestClose) || latestClose <= 0) {
    return false;
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return false;
  }

  const hi = Math.max(entryPrice, latestClose);
  const lo = Math.min(entryPrice, latestClose);
  const ratio = hi / lo;
  if (ratio < 100) return false;

  return lo < 50 && hi > 500;
}
