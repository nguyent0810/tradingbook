import type { RiskSeverity } from "@/lib/trades/trade-suggestion-copy";
import type { SizingUnavailable } from "@/lib/trades/screen-trade-suggestions";

/**
 * Display tokens every screen uses for a Gợi ý lệnh, so F1, F2 and F7 label the
 * evidence status, the risk severities and a missing suggestion the same way
 * (ADR 0003: every suggestion shows its Trạng thái kiểm chứng).
 */

export const ADR_0001_HREF =
  "https://github.com/nguyent0810/tradingbook/blob/main/docs/adr/0001-no-real-money-on-app-signals-before-checkpoint.md";

/** Trạng thái kiểm chứng as a screen shows it: the label and the ADR it links to. */
export type EvidenceStatus = { label: string; href: string };

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

/** The evidence status of a screen's suggestions, from the loader's registry count. */
export function evidenceStatus(prospectiveN: number | null, checkpointN: number): EvidenceStatus {
  return { label: evidenceStatusLabel(prospectiveN, checkpointN), href: ADR_0001_HREF };
}

/**
 * Reason when the setup has a row but the loader has no suggestion for it: the
 * bars/exchange lookup failed (the error panel carries the evidence).
 */
export const SUGGESTION_NOT_LOADED_REASON = "chưa nạp được nến giá của mã này";

/** Reason when the screen has no setup row to build a suggestion from (F1). */
export const SETUP_ROW_MISSING_REASON =
  "không nạp được hàng thiết lập của mã này nên chưa dựng được gợi ý";

/** "Không đủ dữ liệu — <lý do>": what a screen shows instead of numbers (#11 story 29). */
export function suggestionUnavailableText(reason: string): string {
  return `Không đủ dữ liệu — ${reason}`;
}

/** What a screen (F2, the order ticket) says in place of the size, per `SizingUnavailable`. */
export const SIZING_UNAVAILABLE_COPY: Record<SizingUnavailable, string> = {
  NO_EQUITY:
    "Chưa đặt vốn tài khoản trong Cài đặt (F5) nên không tính được khối lượng. Không suy đoán từ giá trị mặc định.",
  OPEN_TRADES_UNREADABLE:
    "Không đọc được giá trị các vị thế đang mở nên không tính được khối lượng. " +
    "Coi như 0 sẽ cho ra khối lượng CAO HƠN trần mà server áp khi ghi lệnh.",
  LIQUIDITY_UNREADABLE:
    "Không đọc được giá trị giao dịch bình quân 20 phiên nên không kiểm được trần thanh khoản: size tham khảo chưa tính được. Server cũng không ghi lệnh khi thiếu số này.",
};
