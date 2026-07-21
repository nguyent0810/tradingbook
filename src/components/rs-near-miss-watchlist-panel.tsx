import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";

export type RsNearMissWatchlistPanelProps = {
  panel: RsNearMissWatchlistPanelDto;
  /** Optional data-testid prefix for page-specific panels. */
  testId?: string;
};

export function RsNearMissWatchlistPanel({ panel, testId = "rs-near-miss-watchlist" }: RsNearMissWatchlistPanelProps) {
  return (
    <section
      className="dash-card dash-rs-widget dash-card--tilt"
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
    >
      <header className="dash-panel__header">
        <h2 id={`${testId}-heading`} className="dash-section-title">
          {panel.title}
          {panel.rows.length > 0 ? ` (${panel.rows.length})` : ""}
        </h2>
        <p className="dash-panel__subtitle">{panel.subtitle}</p>
        <ul
          className="mt-2 space-y-0.5 text-xs leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
          data-testid={`${testId}-disclaimer`}
        >
          {panel.disclaimerLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </header>

      {panel.rows.length > 0 ? (
        <ul className="mt-3 space-y-3" data-testid={`${testId}-rows`}>
          {panel.rows.map((row) => (
            <li
              key={row.symbol}
              className="rounded-md border p-3 text-sm"
              style={{
                borderColor: "var(--border-secondary)",
                background: "var(--bg-secondary)",
              }}
              data-testid={`${testId}-row-${row.symbol}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {row.symbol}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  RS20 {row.rs20SpreadPct >= 0 ? "+" : ""}
                  {row.rs20SpreadPct.toFixed(2)} pp
                  {row.rs50SpreadPct != null
                    ? ` · RS50 ${row.rs50SpreadPct >= 0 ? "+" : ""}${row.rs50SpreadPct.toFixed(2)} pp`
                    : ""}
                </span>
              </div>

              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {row.failedGate2Because}
              </p>
              {row.topRejectionReason ? (
                <p className="mt-0.5 text-xs italic" style={{ color: "var(--text-tertiary)" }}>
                  {row.topRejectionReason}
                </p>
              ) : null}

              {row.distanceToPullbackZoneFrac != null &&
              Number.isFinite(row.distanceToPullbackZoneFrac) ? (
                <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                  Zone distance (diagnostic): {(100 * row.distanceToPullbackZoneFrac).toFixed(1)}%
                  · stage rank {row.stageRank}
                </p>
              ) : (
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Stage rank {row.stageRank}
                </p>
              )}

              {row.rsDiagnostic ? (
                <div className="mt-2">
                  <RelativeStrengthDiagnosticPanel diagnostic={row.rsDiagnostic} compact />
                </div>
              ) : null}

              <p
                className="mt-2 text-xs font-medium"
                style={{ color: "var(--text-tertiary)" }}
                data-testid={`${testId}-action-hint`}
              >
                {row.actionHint}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="dash-empty-compact text-sm"
          style={{ color: "var(--text-secondary)" }}
          data-testid={`${testId}-empty`}
        >
          {panel.emptyReason ?? "No symbols on the relative-strength watchlist for this session."}
        </p>
      )}

      <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
        {panel.actionHint}
      </p>
    </section>
  );
}
