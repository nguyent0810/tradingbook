/** Display-only formatters for RS Workbench table — no trading logic. */

export const WORKBENCH_COLUMN_TOOLTIPS = {
  target: "Technical upside reference used for R:R.",
  invalid: "Level where setup becomes invalid.",
  earlyScore: "Early reversal research score — observation only.",
  rr: "Estimated reward-to-risk ratio from early-entry research.",
  ma20Dist: "Distance from MA20 as a percentage.",
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
