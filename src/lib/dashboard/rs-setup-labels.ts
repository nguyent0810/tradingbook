import type { RsNearMissWatchlistEntryDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import { rejectionBucketTraderGuide } from "@/lib/scanner/setups-trader-copy";

/** Reason-first setup state labels — never bare "Blocked". */
export const SETUP_STATE_BY_TERMINAL: Record<string, string> = {
  breakout_recency: "Watch: breakout",
  pullback_zone_interaction: "Blocked: zone",
  volume_ratio: "Watch: volume",
  trend_below_ma50: "Blocked: MA50",
  trend_ma20_below_ma50: "Watch: momentum",
  extension_cap: "Blocked: extended",
  breakout_not_holding: "Watch: hold",
  digestion: "Watch: digestion",
};

const SETUP_REASON_BY_TERMINAL: Record<string, string> = {
  breakout_recency: "Needs fresh breakout",
  pullback_zone_interaction: "Not in pullback entry zone",
  volume_ratio: "Needs volume confirmation",
  trend_below_ma50: "Below 50-day average",
  trend_ma20_below_ma50: "Short-term momentum below long-term trend",
  extension_cap: "Extended above breakout — chase risk",
  breakout_not_holding: "Breakout failed to hold",
  digestion: "Needs post-breakout digestion",
};

function extractTerminalCode(row: RsNearMissWatchlistEntryDto): string | null {
  if (row.terminalCode) return row.terminalCode;
  const match = row.failedGate2Because.match(/\(([a-z0-9_]+)\)/i);
  return match?.[1] ?? null;
}

export function buildSetupStateLabel(terminalCode: string | null): string {
  if (terminalCode && SETUP_STATE_BY_TERMINAL[terminalCode]) {
    return SETUP_STATE_BY_TERMINAL[terminalCode]!;
  }
  return "Watch: monitor";
}

export function buildSetupReason(row: RsNearMissWatchlistEntryDto): string {
  const code = extractTerminalCode(row);
  if (code && SETUP_REASON_BY_TERMINAL[code]) {
    return SETUP_REASON_BY_TERMINAL[code]!;
  }
  if (code) {
    const guide = rejectionBucketTraderGuide(code);
    const meaning = guide.meaning.endsWith(".") ? guide.meaning.slice(0, -1) : guide.meaning;
    return meaning;
  }
  return "Setup filters have not cleared yet";
}

export function rsStrengthLabelFromRs20(rs20: number): string | null {
  if (rs20 >= 15) return "Strong RS";
  if (rs20 >= 5) return "Positive RS";
  if (rs20 > 0) return "Mild RS";
  if (rs20 < 0) return "Weak RS";
  return null;
}

export function formatRsSpreadPp(spread: number): string {
  const sign = spread >= 0 ? "+" : "";
  return `${sign}${spread.toFixed(1)}pp`;
}
