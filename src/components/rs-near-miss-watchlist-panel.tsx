"use client";

import { useState, type CSSProperties } from "react";
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
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Compact chip grid — all symbols glanceable at once — with a single
 * click-to-expand detail panel underneath, instead of a dozen fully-expanded
 * diagnostic cards stacked vertically (the previous layout's main source of
 * dead space/scroll bloat on watchlists this size).
 */
export function RsNearMissWatchlistPanel({ panel, testId = "rs-near-miss-watchlist" }: RsNearMissWatchlistPanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const selectedRow = panel.rows.find((r) => r.symbol === selectedSymbol) ?? null;

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
        <>
          <ul className="dash-rs-chip-grid" data-testid={`${testId}-rows`}>
            {panel.rows.map((row, index) => {
              const rs20Positive = row.rs20SpreadPct >= 0;
              const isSelected = row.symbol === selectedSymbol;
              return (
                <li key={row.symbol} className="dash-rs-chip-cell" style={{ "--rs-row-index": index } as CSSProperties}>
                  <button
                    type="button"
                    className={`dash-rs-chip dash-rs-chip--${rs20Positive ? "up" : "down"}${
                      isSelected ? " dash-rs-chip--active" : ""
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSymbol(isSelected ? null : row.symbol)}
                    data-testid={`${testId}-row-${row.symbol}`}
                  >
                    <span className="dash-rs-chip__symbol font-mono">{row.symbol}</span>
                    <span className="dash-rs-chip__spread tabular-nums">
                      <span className="dash-rs-chip__icon">{rs20Positive ? <IconTrendUp /> : <IconTrendDown />}</span>
                      {rs20Positive ? "+" : ""}
                      {row.rs20SpreadPct.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedRow ? (
            <div className="dash-rs-detail" data-testid={`${testId}-detail`}>
              <div className="dash-rs-detail__head">
                <span className="dash-rs-row__symbol-chip font-mono">{selectedRow.symbol}</span>
                <span
                  className={`dash-rs-spread-chip dash-rs-spread-chip--${
                    selectedRow.rs20SpreadPct >= 0 ? "up" : "down"
                  } tabular-nums`}
                >
                  RS20 {selectedRow.rs20SpreadPct >= 0 ? "+" : ""}
                  {selectedRow.rs20SpreadPct.toFixed(2)} pp
                </span>
                {selectedRow.rs50SpreadPct != null ? (
                  <span
                    className={`dash-rs-spread-chip dash-rs-spread-chip--${
                      selectedRow.rs50SpreadPct >= 0 ? "up" : "down"
                    } tabular-nums`}
                  >
                    RS50 {selectedRow.rs50SpreadPct >= 0 ? "+" : ""}
                    {selectedRow.rs50SpreadPct.toFixed(2)} pp
                  </span>
                ) : null}
                <button
                  type="button"
                  className="dash-rs-detail__close"
                  aria-label={`Đóng chẩn đoán ${selectedRow.symbol}`}
                  onClick={() => setSelectedSymbol(null)}
                >
                  <IconClose />
                </button>
              </div>

              <p className="dash-rs-row__meta">{selectedRow.failedGate2Because}</p>
              {selectedRow.topRejectionReason ? (
                <p className="dash-rs-row__meta dash-rs-row__meta--italic">{selectedRow.topRejectionReason}</p>
              ) : null}

              {selectedRow.distanceToPullbackZoneFrac != null &&
              Number.isFinite(selectedRow.distanceToPullbackZoneFrac) ? (
                <p className="dash-rs-row__meta tabular-nums">
                  K/c tới vùng (chẩn đoán): {(100 * selectedRow.distanceToPullbackZoneFrac).toFixed(1)}%
                  · hạng giai đoạn {selectedRow.stageRank}
                </p>
              ) : (
                <p className="dash-rs-row__meta">Hạng giai đoạn {selectedRow.stageRank}</p>
              )}

              {selectedRow.rsDiagnostic ? (
                <div className="dash-rs-row__diagnostic">
                  <RelativeStrengthDiagnosticPanel diagnostic={selectedRow.rsDiagnostic} compact />
                </div>
              ) : null}

              <p className="dash-rs-row__hint" data-testid={`${testId}-action-hint`}>
                {selectedRow.actionHint}
              </p>
            </div>
          ) : (
            <p className="dash-rs-detail__placeholder">Bấm vào một mã để xem chẩn đoán đầy đủ.</p>
          )}
        </>
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
