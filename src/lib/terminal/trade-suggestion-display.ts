import type { RiskSeverity } from "@/lib/trades/trade-suggestion-copy";

/**
 * Display tokens every screen uses for a Gợi ý lệnh, so F1, F2 and F7 label the
 * evidence status and the risk severities the same way (ADR 0003: every
 * suggestion shows its Trạng thái kiểm chứng).
 */

export const ADR_0001_HREF =
  "https://github.com/nguyent0810/tradingbook/blob/main/docs/adr/0001-no-real-money-on-app-signals-before-checkpoint.md";

export const RISK_SEVERITY_TOKENS: Record<RiskSeverity, { rank: number; label: string; color: string }> = {
  high: { rank: 0, label: "CAO", color: "var(--tm-down)" },
  warn: { rank: 1, label: "CHÚ Ý", color: "var(--tm-accent)" },
  info: { rank: 2, label: "THÔNG TIN", color: "var(--tm-text-dim)" },
};

/** "Chưa kiểm chứng (N/100)"; "N không rõ" when the registry could not be read. */
export function evidenceStatusLabel(prospectiveN: number | null, checkpointN: number): string {
  const n = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  return `Chưa kiểm chứng (${prospectiveN != null ? n(prospectiveN) : "N không rõ"}/${n(checkpointN)})`;
}
