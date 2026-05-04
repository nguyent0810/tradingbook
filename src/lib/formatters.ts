export function formatVND(value: number | null | undefined, compact: boolean = false): string {
  if (value === null || value === undefined) return "—";

  if (compact && value !== 0) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000_000) {
      return `${sign}${(abs / 1_000_000_000_000).toFixed(2)}T ₫`;
    }
    if (abs >= 1_000_000_000) {
      return `${sign}${(abs / 1_000_000_000).toFixed(2)}B ₫`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${(abs / 1_000_000).toFixed(2)}M ₫`;
    }
    if (abs >= 100_000) { // e.g., 500,000 becomes 500k
      return `${sign}${(abs / 1_000).toFixed(0)}k ₫`;
    }
  }

  // Format with commas and append ₫
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value) + " ₫";
}
