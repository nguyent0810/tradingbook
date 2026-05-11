/**
 * Optional server-side account equity for portfolio capacity UX.
 * When unset, Dashboard shows an exposure snapshot instead of implying full risk metrics.
 *
 * Set `TRADING_ACCOUNT_EQUITY_VND` to a positive number (full VND, no commas required).
 */

function parsePositiveMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Parsed account equity in VND, or null when not configured. */
export function parseTradingAccountEquityVnd(): number | null {
  const raw = process.env.TRADING_ACCOUNT_EQUITY_VND;
  if (raw == null) return null;
  return parsePositiveMoney(String(raw));
}

export function isTradingRiskBudgetConfigured(): boolean {
  return parseTradingAccountEquityVnd() !== null;
}
