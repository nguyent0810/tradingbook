import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";

export type RelativeStrengthDiagnosticPanelProps = {
  diagnostic: RsDiagnosticUi | null;
  /** When bars/session cannot compute RS. */
  unavailableMessage?: string;
  compact?: boolean;
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
          <ul className="rs-diagnostic__lines mt-1 space-y-0.5 text-sm leading-snug">
            {diagnostic.lines.map((line, i) => (
              <li key={i} data-testid={i === 0 ? "rs-diagnostic-line-rs20" : undefined}>
                {line}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rs-diagnostic__unavailable text-sm" data-testid="rs-diagnostic-unavailable">
          {unavailableMessage}
        </p>
      )}
      <p
        className="rs-diagnostic__disclaimer mt-2 text-xs leading-snug"
        style={{ color: "var(--text-tertiary)" }}
        data-testid="rs-diagnostic-disclaimer"
      >
        {diagnostic?.disclaimer ?? "Relative strength is a context signal — it helps prioritize, but doesn't approve or rank a setup on its own."}
      </p>
    </div>
  );
}
