/** Display-only formatters for RS Workbench table — no trading logic. */

export const WORKBENCH_COLUMN_TOOLTIPS = {
  target: "Mốc giá mục tiêu kỹ thuật dùng để tính R:R.",
  invalid: "Mức giá khiến thiết lập không còn hợp lệ.",
  earlyScore: "Điểm nghiên cứu đảo chiều sớm — chỉ mang tính quan sát.",
  rr: "Tỷ lệ reward-to-risk ước tính từ nghiên cứu vào lệnh sớm.",
  ma20Dist: "Khoảng cách so với MA20 tính theo phần trăm.",
} as const;

export function formatRiskReward(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}:1`;
}

export function formatMa20DistPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatWorkbenchPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
