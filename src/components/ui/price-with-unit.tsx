import { formatEquityThousandVndPerShare } from "@/lib/formatters";

export type PriceUnitMode = "thousand_vnd_per_share";

export type PriceWithUnitProps = {
  value: number | null | undefined;
  /**
   * Equity EOD convention in this app — thousand VND per share (stored numeric scale).
   * @default "thousand_vnd_per_share"
   */
  unit?: PriceUnitMode;
  className?: string;
  /** Show explicit unit suffix separate from formatted value */
  showUnitLabel?: boolean;
  "data-testid"?: string;
};

const UNIT_LABEL: Record<PriceUnitMode, string> = {
  thousand_vnd_per_share: "k ₫",
};

/**
 * Display-only wrapper — delegates to `formatEquityThousandVndPerShare` (no scale conversion).
 */
export function PriceWithUnit({
  value,
  unit = "thousand_vnd_per_share",
  className = "",
  showUnitLabel = false,
  "data-testid": testId,
}: PriceWithUnitProps) {
  const formatted = formatEquityThousandVndPerShare(value);
  const isMissing = formatted === "—";

  if (isMissing) {
    return (
      <span
        className={`price-with-unit ${className}`.trim()}
        style={{ color: "var(--text-muted)" }}
        data-testid={testId}
      >
        —
      </span>
    );
  }

  if (!showUnitLabel || unit !== "thousand_vnd_per_share") {
    return (
      <span className={`price-with-unit mono ${className}`.trim()} data-testid={testId}>
        {formatted}
      </span>
    );
  }

  const numericPart = formatted.replace(/\s*k\s*₫\s*$/i, "").trim();

  return (
    <span className={`price-with-unit ${className}`.trim()} data-testid={testId}>
      <span className="price-with-unit__value mono">{numericPart}</span>
      <span className="price-with-unit__suffix">{UNIT_LABEL[unit]}</span>
    </span>
  );
}

/** @internal Exported for tests — splits formatted equity price string. */
export function splitThousandVndFormatted(formatted: string): {
  numeric: string;
  unit: string;
} | null {
  const m = formatted.match(/^(.+?)\s*(k\s*₫)\s*$/i);
  if (!m) return null;
  return { numeric: m[1]!.trim(), unit: m[2]!.trim() };
}
