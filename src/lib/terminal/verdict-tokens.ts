import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";

/**
 * Token trình bày cho ba mức phán quyết.
 *
 * Bàn giao §1 — "Phán quyết dẫn dắt": mức NO_TRADE / PROBE / TRADE chi phối màu,
 * phân bổ và khối lượng đề xuất ở **mọi** màn. Mọi nơi cần màu/nhãn/hệ số của
 * phán quyết đều đọc từ đây, không hardcode lại.
 */
export type VerdictTokens = {
  level: VerdictUxLevel;
  /** Mã hiển thị trong ô lớn (NO-TRADE / PROBE / TRADE). */
  code: string;
  /** Màu chủ đạo — dùng cho panel, nút chính, ô PHÁN QUYẾT ở thanh trạng thái. */
  color: string;
  /** Nền tiêu đề panel phán quyết. */
  headBg: string;
  /**
   * Hệ số nhân khối lượng đề xuất so với khối lượng chuẩn.
   * Đây là ràng buộc phán quyết áp lên phiếu ghi lệnh (QA §4), tách khỏi hệ số
   * rủi ro theo hạng của bộ quét (`qualityRiskMultiplier`).
   */
  sizeMultiplier: number;
  /** Nhãn phần trăm khối lượng đi kèm hệ số ("0%" · "30%" · "100%"). */
  sizeLabel: string;
  /** Lý do rút gọn hiển thị cạnh khối lượng đã giảm. */
  sizeReason: string;
  /** Số vạch độ tin cậy được tô (trên tổng 5). */
  confidenceBars: number;
};

const TOKENS: Record<VerdictUxLevel, VerdictTokens> = {
  NO_TRADE: {
    level: "NO_TRADE",
    code: "NO-TRADE",
    color: "var(--tm-down)",
    headBg: "var(--tm-head-no-trade)",
    sizeMultiplier: 0,
    sizeLabel: "0%",
    sizeReason: "Phán quyết NO-TRADE chặn mọi lệnh mới",
    confidenceBars: 4,
  },
  PROBE: {
    level: "PROBE",
    code: "PROBE",
    color: "var(--tm-accent)",
    headBg: "var(--tm-head-probe)",
    sizeMultiplier: 0.3,
    sizeLabel: "30%",
    sizeReason: "Phán quyết PROBE giới hạn khối lượng thăm dò",
    confidenceBars: 3,
  },
  TRADE: {
    level: "TRADE",
    code: "TRADE",
    color: "var(--tm-up)",
    headBg: "var(--tm-head-trade)",
    sizeMultiplier: 1,
    sizeLabel: "100%",
    sizeReason: "Phán quyết TRADE cho phép khối lượng chuẩn",
    confidenceBars: 5,
  },
};

export function verdictTokens(level: VerdictUxLevel): VerdictTokens {
  return TOKENS[level] ?? TOKENS.PROBE;
}

/**
 * Khối lượng sau ràng buộc phán quyết, làm tròn xuống bội số 100 cổ phiếu
 * (lô chẵn HOSE/HNX). Trả về cả phần bị cắt để UI nêu rõ đã giảm bao nhiêu.
 */
export function applyVerdictToShares(
  baseShares: number,
  level: VerdictUxLevel
): { shares: number; baseShares: number; removedShares: number; tokens: VerdictTokens } {
  const tokens = verdictTokens(level);
  const safeBase = Number.isFinite(baseShares) && baseShares > 0 ? Math.floor(baseShares) : 0;
  const scaled = Math.floor((safeBase * tokens.sizeMultiplier) / 100) * 100;
  const shares = Math.max(0, Math.min(safeBase, scaled));
  return { shares, baseShares: safeBase, removedShares: safeBase - shares, tokens };
}

/** Màu cho mức Gate 1 theo quy ước trạng thái (ĐẠT / CẢNH BÁO / FAIL). */
export function gate1Color(level: "PASS" | "WARNING" | "FAIL"): string {
  if (level === "PASS") return "var(--tm-up)";
  if (level === "WARNING") return "var(--tm-accent)";
  return "var(--tm-down)";
}

/** Nhãn tiếng Việt cho mức Gate 1 dùng ở thanh trạng thái và panel. */
export function gate1Label(level: "PASS" | "WARNING" | "FAIL"): string {
  if (level === "PASS") return "ĐẠT";
  if (level === "WARNING") return "CẢNH BÁO";
  return "FAIL";
}
