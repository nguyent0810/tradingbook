import type { RsDiagnosticUi, RsTrendLabel } from "@/lib/scanner/gate2/rs-diagnostic-format";

export type RelativeStrengthDiagnosticPanelProps = {
  diagnostic: RsDiagnosticUi | null;
  /** When bars/session cannot compute RS. */
  unavailableMessage?: string;
  compact?: boolean;
  /**
   * Content density, independent of `compact` (which only affects CSS padding).
   * "full" (default) renders the bar/chip summary plus the full sentence-by-sentence
   * breakdown behind a tap-to-expand disclosure — the original detail-view payload,
   * still used by the opt-in "Show technical evidence" panel on /setups.
   * "summary" renders only the bar/chip row — for always-visible dashboard cards
   * where the full breakdown would be redundant clutter.
   */
  detail?: "summary" | "full";
  testId?: string;
};

/** Visual bar scale — a spread at or beyond this magnitude fills the half-bar. */
const BAR_SCALE_PP = 6;

const TREND_CHIP_LABEL: Record<RsTrendLabel, string> = {
  leading: "Leading",
  "dual-uptrend": "Dual uptrend",
  lagging: "Lagging",
  neutral: "Neutral",
};

function formatSpread(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}pp`;
}

function barWidthPct(pct: number | null): number {
  if (pct == null) return 0;
  const clamped = Math.max(-BAR_SCALE_PP, Math.min(BAR_SCALE_PP, pct));
  return (Math.abs(clamped) / BAR_SCALE_PP) * 50;
}

/**
 * Read-only RS vs VNINDEX block (Batch D1).
 * Never implies trade approval or rank changes.
 */
export function RelativeStrengthDiagnosticPanel({
  diagnostic,
  unavailableMessage = "RS diagnostic unavailable — need ≥50 stock sessions and aligned VNINDEX bars on anchor dates.",
  compact = false,
  detail = "full",
  testId = "rs-diagnostic-panel",
}: RelativeStrengthDiagnosticPanelProps) {
  if (!diagnostic) {
    return (
      <div className={`rs-diagnostic${compact ? " rs-diagnostic--compact" : ""}`} data-testid={testId}>
        <p className="rs-diagnostic__title text-xs font-semibold uppercase tracking-wide">
          Relative strength vs VNINDEX
        </p>
        <p className="rs-diagnostic__unavailable text-sm" data-testid="rs-diagnostic-unavailable">
          {unavailableMessage}
        </p>
      </div>
    );
  }

  const isPositive = (diagnostic.rs20SpreadPct ?? 0) >= 0;
  const width = barWidthPct(diagnostic.rs20SpreadPct);

  const body = (
    <>
      <div className="rs-diagnostic__bar-row" data-testid="rs-diagnostic-bar-row">
        <div
          className="rs-diagnostic__bar-track"
          role="img"
          aria-label={`RS20 spread ${formatSpread(diagnostic.rs20SpreadPct)} versus VNINDEX`}
        >
          <span className="rs-diagnostic__bar-mid" aria-hidden="true" />
          <span
            className={`rs-diagnostic__bar-fill ${isPositive ? "rs-diagnostic__bar-fill--pos" : "rs-diagnostic__bar-fill--neg"}`}
            style={{ ["--rs-bar-w" as string]: `${width}%` }}
            aria-hidden="true"
          />
        </div>
        <span
          className={`rs-diagnostic__spread tabular-nums ${isPositive ? "rs-diagnostic__spread--pos" : "rs-diagnostic__spread--neg"}`}
          data-testid="rs-diagnostic-summary"
        >
          {formatSpread(diagnostic.rs20SpreadPct)}
        </span>
      </div>
      <div className="rs-diagnostic__chips">
        <span className={`rs-diagnostic__chip${diagnostic.trendLabel !== "neutral" ? " rs-diagnostic__chip--on" : ""}`}>
          {TREND_CHIP_LABEL[diagnostic.trendLabel]}
        </span>
        {diagnostic.stockAboveMa50 != null ? (
          <span className={`rs-diagnostic__chip${diagnostic.stockAboveMa50 ? " rs-diagnostic__chip--on" : ""}`}>
            {diagnostic.stockAboveMa50 ? "Above MA50" : "Below MA50"}
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    <div className={`rs-diagnostic${compact ? " rs-diagnostic--compact" : ""}`} data-testid={testId}>
      <p className="rs-diagnostic__title text-xs font-semibold uppercase tracking-wide">
        Relative strength vs VNINDEX
      </p>
      {body}
      {detail === "full" ? (
        <details className="rs-diagnostic__detail">
          <summary className="rs-diagnostic__detail-toggle">Why</summary>
          <ul className="rs-diagnostic__lines text-sm leading-snug" data-testid="rs-diagnostic-line-rs20">
            {diagnostic.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p
            className="rs-diagnostic__disclaimer text-xs leading-snug"
            data-testid="rs-diagnostic-disclaimer"
          >
            {diagnostic.disclaimer}
          </p>
        </details>
      ) : null}
    </div>
  );
}
