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
  breakout_recency: "Cần breakout mới",
  pullback_zone_interaction: "Chưa vào vùng pullback",
  volume_ratio: "Cần khối lượng xác nhận",
  trend_below_ma50: "Dưới đường trung bình 50 ngày",
  trend_ma20_below_ma50: "Động lượng ngắn hạn dưới xu hướng dài hạn",
  extension_cap: "Đã mở rộng khỏi breakout — rủi ro đuổi giá",
  breakout_not_holding: "Breakout không giữ được",
  digestion: "Cần tích lũy sau breakout",
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
  return "Chưa vượt qua bộ lọc thiết lập";
}

export function rsStrengthLabelFromRs20(rs20: number): string | null {
  if (rs20 >= 15) return "RS mạnh";
  if (rs20 >= 5) return "RS dương";
  if (rs20 > 0) return "RS nhẹ";
  if (rs20 < 0) return "RS yếu";
  return null;
}

export function formatRsSpreadPp(spread: number): string {
  const sign = spread >= 0 ? "+" : "";
  return `${sign}${spread.toFixed(1)}pp`;
}
