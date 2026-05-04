export type RegimeLevel = "PASS" | "WARNING" | "FAIL";

export type RegimePanelProps = {
  symbol: string;
  level: RegimeLevel;
  reasons: string[];
  /** Bars used for Gate 1 (evaluation window). */
  evaluatedBarsCount?: number;
  /** Total rows in DB for the symbol. If omitted, strip omits the “stored” segment. */
  storedBarsCount?: number;
  latestBar?: {
    date: Date | string;
    close: number;
  } | null;
  checkedAt?: Date | string;
};

function formatUtcChecked(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min} UTC`;
}

function formatBarDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function accentForLevel(level: RegimeLevel): string {
  if (level === "PASS") return "var(--success)";
  if (level === "FAIL") return "var(--danger)";
  return "var(--warning)";
}

function formatBarCountLine(
  evaluatedBarsCount: number | undefined,
  storedBarsCount: number | undefined
): string | null {
  if (
    evaluatedBarsCount !== undefined &&
    storedBarsCount !== undefined
  ) {
    return `${evaluatedBarsCount} evaluated · ${storedBarsCount} stored`;
  }
  if (evaluatedBarsCount !== undefined) {
    return `${evaluatedBarsCount} evaluated`;
  }
  if (storedBarsCount !== undefined) {
    return `${storedBarsCount} stored`;
  }
  return null;
}

export function RegimePanel({
  symbol,
  level,
  reasons,
  evaluatedBarsCount,
  storedBarsCount,
  latestBar,
  checkedAt,
}: RegimePanelProps) {
  const accent = accentForLevel(level);
  const shownReasons = reasons.slice(0, 2);
  const extraReasonCount = Math.max(0, reasons.length - 2);
  const barLine = formatBarCountLine(evaluatedBarsCount, storedBarsCount);

  return (
    <div
      className="flex min-h-[52px] flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-lg px-4 py-3 pl-3 text-sm"
      style={{
        background: "var(--bg-primary)",
        boxShadow: `inset 4px 0 0 0 ${accent}`,
      }}
    >
      <div className="min-w-0 flex-1 space-y-2 pl-0.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Market Regime
          </span>
          <span
            className="mono text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-secondary)" }}
          >
            {symbol}
          </span>
          {barLine !== null && (
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              ({barLine})
            </span>
          )}
          <span
            className="shrink-0 text-xs font-semibold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {level}
          </span>
        </div>

        <div className="space-y-0.5" style={{ color: "var(--text-secondary)" }}>
          {shownReasons.map((r, i) => (
            <p key={i} className="text-xs leading-snug sm:text-sm">
              {r}
              {i === shownReasons.length - 1 && extraReasonCount > 0
                ? ` · +${extraReasonCount}`
                : null}
            </p>
          ))}
        </div>

        {latestBar ? (
          <p className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            Last close{" "}
            <span className="mono font-medium text-[var(--text-secondary)]">
              {latestBar.close.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>{" "}
            on {formatBarDate(latestBar.date)} (UTC)
          </p>
        ) : null}
      </div>

      {checkedAt !== undefined ? (
        <div
          className="shrink-0 text-right text-xs sm:pt-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          Updated {formatUtcChecked(checkedAt)}
        </div>
      ) : null}
    </div>
  );
}
