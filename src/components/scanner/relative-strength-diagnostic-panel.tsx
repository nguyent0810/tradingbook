import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";

export type RelativeStrengthDiagnosticPanelProps = {
  diagnostic: RsDiagnosticUi | null;
  /** When bars/session cannot compute RS. */
  unavailableMessage?: string;
  compact?: boolean;
  /**
   * Content density, independent of `compact` (which only affects CSS padding).
   * "full" (default) renders the summary line, the full sentence-by-sentence
   * breakdown, and the disclaimer — the original detail-view payload, still
   * used by the opt-in "Show technical evidence" panel on /setups.
   * "summary" renders only the one-line `summary` — for always-visible
   * dashboard cards where the full breakdown is redundant clutter.
   */
  detail?: "summary" | "full";
  testId?: string;
};

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
  return (
    <div
      className={`rs-diagnostic${compact ? " rs-diagnostic--compact" : ""}`}
      data-testid={testId}
    >
      <p className="rs-diagnostic__title text-xs font-semibold uppercase tracking-wide">
        Relative strength vs VNINDEX
      </p>
      {diagnostic ? (
        <>
          <p className="rs-diagnostic__summary text-sm font-medium" data-testid="rs-diagnostic-summary">
            {diagnostic.summary}
          </p>
          {detail === "full" ? (
            <ul className="rs-diagnostic__lines mt-1 space-y-0.5 text-sm leading-snug">
              {diagnostic.lines.map((line, i) => (
                <li key={i} data-testid={i === 0 ? "rs-diagnostic-line-rs20" : undefined}>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="rs-diagnostic__unavailable text-sm" data-testid="rs-diagnostic-unavailable">
          {unavailableMessage}
        </p>
      )}
      {detail === "full" ? (
        <p
          className="rs-diagnostic__disclaimer mt-2 text-xs leading-snug"
          style={{ color: "var(--text-tertiary)" }}
          data-testid="rs-diagnostic-disclaimer"
        >
          {diagnostic?.disclaimer ?? "Relative strength is a context signal — it helps prioritize, but doesn't approve or rank a setup on its own."}
        </p>
      ) : null}
    </div>
  );
}
