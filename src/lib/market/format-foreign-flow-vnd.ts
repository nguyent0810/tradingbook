import { formatVND } from "@/lib/formatters";

/**
 * Formats foreign-flow net values stored as **full VND nominal** (price_board pipeline).
 * Adds explicit sign prefix for net flows.
 */
export function formatForeignFlowVnd(
  value: number | null | undefined,
  options?: { compact?: boolean }
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const compact = options?.compact ?? true;
  const formatted = formatVND(Math.abs(value), compact);
  if (value === 0) return formatted;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatted}`;
}

/** Compact net label for evidence chips, e.g. "−458.37B ₫ net". */
export function formatForeignFlowNetLabel(value: number | null | undefined): string | null {
  const formatted = formatForeignFlowVnd(value, { compact: true });
  if (formatted == null) return null;
  return `${formatted} net`;
}
