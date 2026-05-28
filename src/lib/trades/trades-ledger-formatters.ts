/** Display formatters for the trades ledger (no business logic). */

export function formatQuantityCell(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(q);
}

export function formatSignedVnd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const s = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    Math.abs(value)
  );
  return `${sign}${s}k ₫`;
}

export function formatRMultiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function formatTradeLedgerDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBarSessionDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
