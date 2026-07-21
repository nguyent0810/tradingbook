import type { CSSProperties } from "react";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";

export type RsNearMissWatchlistPanelProps = {
  panel: RsNearMissWatchlistPanelDto;
  /** Optional data-testid prefix for page-specific panels. */
  testId?: string;
};

const IconTrendUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="14 7 21 7 21 14" />
  </svg>
);
const IconTrendDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 7 9 13 13 9 21 17" />
    <polyline points="21 10 21 17 14 17" />
  </svg>
);

function rsRowIndexStyle(index: number): CSSProperties {
  return { "--rs-row-index": index } as CSSProperties;
}

export function RsNearMissWatchlistPanel({ panel, testId = "rs-near-miss-watchlist" }: RsNearMissWatchlistPanelProps) {
  return (
    <section
      className="dash-card dash-rs-widget dash-card--tilt"
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
    >
      <header className="dash-panel__header">
        <h2 id={`${testId}-heading`} className="dash-section-title dash-rs-widget__title-row">
          {panel.title}
          {panel.rows.length > 0 ? (
            <span className="dash-rs-widget__count-chip tabular-nums">{panel.rows.length}</span>
          ) : null}
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
        <ul className="dash-rs-chip-grid" data-testid={`${testId}-rows`}>
          {panel.rows.map((row, index) => {
            const rs20Positive = row.rs20SpreadPct >= 0;
            return (
              <li
                key={row.symbol}
                className="dash-rs-row"
                style={rsRowIndexStyle(index)}
                data-testid={`${testId}-row-${row.symbol}`}
              >
                <div className="dash-rs-row__top">
                  <span className="dash-rs-row__symbol-chip font-mono">{row.symbol}</span>
                  <span
                    className={`dash-rs-spread-chip dash-rs-spread-chip--${rs20Positive ? "up" : "down"} tabular-nums`}
                  >
                    <span className="dash-rs-spread-chip__icon">
                      {rs20Positive ? <IconTrendUp /> : <IconTrendDown />}
                    </span>
                    RS20 {rs20Positive ? "+" : ""}
                    {row.rs20SpreadPct.toFixed(2)} pp
                  </span>
                </div>

                {row.rs50SpreadPct != null ? (
                  <div className="dash-rs-row__sub-chip-row">
                    <span
                      className={`dash-rs-spread-chip dash-rs-spread-chip--sm dash-rs-spread-chip--${
                        row.rs50SpreadPct >= 0 ? "up" : "down"
                      } tabular-nums`}
                    >
                      RS50 {row.rs50SpreadPct >= 0 ? "+" : ""}
                      {row.rs50SpreadPct.toFixed(2)} pp
                    </span>
                  </div>
                ) : null}

                <p className="dash-rs-row__meta">{row.failedGate2Because}</p>
                {row.topRejectionReason ? (
                  <p className="dash-rs-row__meta dash-rs-row__meta--italic">{row.topRejectionReason}</p>
                ) : null}

                {row.distanceToPullbackZoneFrac != null &&
                Number.isFinite(row.distanceToPullbackZoneFrac) ? (
                  <p className="dash-rs-row__meta tabular-nums">
                    Zone distance (diagnostic): {(100 * row.distanceToPullbackZoneFrac).toFixed(1)}%
                    · stage rank {row.stageRank}
                  </p>
                ) : (
                  <p className="dash-rs-row__meta">Stage rank {row.stageRank}</p>
                )}

                {row.rsDiagnostic ? (
                  <div className="dash-rs-row__diagnostic">
                    <RelativeStrengthDiagnosticPanel diagnostic={row.rsDiagnostic} compact />
                  </div>
                ) : null}

                <p className="dash-rs-row__hint" data-testid={`${testId}-action-hint`}>
                  {row.actionHint}
                </p>
              </li>
            );
          })}
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
