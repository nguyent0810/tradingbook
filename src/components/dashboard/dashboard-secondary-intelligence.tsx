import type { CSSProperties } from "react";
import { DashboardActionableBlockers } from "@/components/dashboard/dashboard-actionable-blockers";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";
import { DashboardWatchlistPanel } from "@/components/dashboard/dashboard-watchlist-panel";
import type {
  ActionableDiagnosticsDto,
  DecisionCockpitDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { formatBlockerSeverity } from "@/lib/dashboard/decision-cockpit-dto";
import { RsNearMissWatchlistPanel } from "@/components/rs-near-miss-watchlist-panel";
import { distanceToZonePct } from "@/lib/setup-health";
import { displaySetupLifecycleStatus } from "@/lib/trading-display-labels";

export type DashboardSecondaryIntelligenceProps = {
  diagnostics: ActionableDiagnosticsDto;
  watchItems: DashboardWatchlistItem[];
  /** True when the watchlist query hit its row cap and more items exist beyond what's shown. */
  watchItemsTruncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
  rsNearMissWatchlist?: DecisionCockpitDto["rsNearMissWatchlist"];
};

const PREVIEW_ROWS = 3;

const IconBinoculars = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3v3M15 3v3" />
    <rect x="4" y="9" width="6" height="9" rx="3" />
    <rect x="14" y="9" width="6" height="9" rx="3" />
    <path d="M10 12h4" />
  </svg>
);
const IconShieldAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** Presentation-only severity → ambient tone for the Gate blockers widget's
 *  3D chrome — worst-first since ActionableDiagnosticsDto.blockers is
 *  already severity-sorted (see decision-cockpit-dto.ts). */
function resolveBlockersTone(diagnostics: ActionableDiagnosticsDto): string {
  const top = diagnostics.blockers[0];
  if (!top) return "var(--success)";
  switch (top.severity) {
    case "market_off":
    case "structure_broken":
      return "var(--danger)";
    case "extension":
      return "var(--warning)";
    case "timing":
      return "var(--accent)";
    case "info":
    default:
      return "var(--success)";
  }
}

export function DashboardSecondaryIntelligence({
  diagnostics,
  watchItems,
  watchItemsTruncated = false,
  latestCloseBySymbol,
  rsNearMissWatchlist,
}: DashboardSecondaryIntelligenceProps) {
  const previewWatch = watchItems.slice(0, PREVIEW_ROWS);
  const previewBlockers = diagnostics.blockers.slice(0, PREVIEW_ROWS - 1);
  const blockersTone = resolveBlockersTone(diagnostics);

  return (
    <section
      className="command-deck-secondary dash-v2-zone dash-v2-zone--context"
      data-testid="dashboard-cockpit-zone-next-session"
      aria-labelledby="dashboard-watch-zone-heading"
    >
      <header className="dash-v2-zone-header dash-header--numbered">
        <span className="dash-header-num" aria-hidden="true">
          03
        </span>
        <div>
          <p className="dash-v2-eyebrow">Thông tin bổ sung</p>
          <h2 id="dashboard-watch-zone-heading" className="dash-v2-zone-title">
            Danh sách theo dõi &amp; rào cản cổng
          </h2>
          <p className="dash-v2-zone-lead">
            Bối cảnh nền — xem khi bạn cần nhiều hơn phán quyết.
          </p>
        </div>
      </header>

      <div className="dash-si-grid dash-v2-zone__body">
        <details
          className="dash-si-widget dash-card dash-si-widget--watch dash-card--tilt"
          style={{ "--si-card-index": 0 } as CSSProperties}
          data-testid="dashboard-secondary-watchlist-widget"
        >
          <summary className="dash-si-widget__summary">
            <span className="dash-si-widget__top">
              <span className="dash-si-widget__icon">
                <IconBinoculars />
              </span>
              <span className="dash-si-widget__title">Danh sách theo dõi</span>
              <span className="dash-si-widget__count tabular-nums">{watchItems.length}</span>
            </span>
            {previewWatch.length === 0 ? (
              <p className="dash-si-widget__empty">Không có mã đang theo dõi.</p>
            ) : (
              <ul className="dash-si-mini-rows">
                {previewWatch.map((w) => {
                  const close = latestCloseBySymbol.get(w.symbolId) ?? null;
                  const dist =
                    close == null
                      ? null
                      : distanceToZonePct(close, w.pullbackZoneLow, w.pullbackZoneHigh);
                  return (
                    <li key={w.id} className="dash-si-mini-row">
                      <span className="dash-si-mini-row__sym font-mono">{w.symbol.symbol}</span>
                      <span>
                        {displaySetupLifecycleStatus(w.lifecycleStatus)}
                        {dist != null ? ` · ${(dist * 100).toFixed(1)}%` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <span className="dash-si-widget__toggle">
              {watchItems.length > previewWatch.length
                ? `+${watchItems.length - previewWatch.length} nữa — xem tất cả`
                : "Xem chi tiết"}
              <span className="dash-si-widget__chevron">
                <IconChevron />
              </span>
            </span>
          </summary>
          <div className="dash-si-widget__full">
            <DashboardWatchlistPanel
              items={watchItems}
              truncated={watchItemsTruncated}
              latestCloseBySymbol={latestCloseBySymbol}
            />
          </div>
        </details>

        <details
          className={`dash-si-widget dash-card dash-si-widget--blockers dash-card--tilt${
            blockersTone === "var(--danger)" ? " dash-card--breathe" : ""
          }`}
          style={{ "--si-card-index": 1, "--tone": blockersTone } as CSSProperties}
          data-testid="dashboard-secondary-blockers-widget"
        >
          <summary className="dash-si-widget__summary">
            <span className="dash-si-widget__top">
              <span className="dash-si-widget__icon">
                <IconShieldAlert />
              </span>
              <span className="dash-si-widget__title">Rào cản cổng</span>
              <span className="dash-si-widget__count tabular-nums">{diagnostics.blockers.length}</span>
            </span>
            {previewBlockers.length === 0 ? (
              <p className="dash-si-widget__empty">
                {diagnostics.emptyReason ?? "Không có rào cản cần xử lý."}
              </p>
            ) : (
              <ul className="dash-si-mini-rows">
                {previewBlockers.map((b) => (
                  <li key={`${b.severity}-${b.title}`} className="dash-si-mini-row">
                    <span className={`dash-si-sev-strip dash-si-sev-strip--${b.severity}`} aria-hidden="true" />
                    <span>
                      {formatBlockerSeverity(b.severity)} · {b.title}
                      {b.count > 0 ? ` — ${b.count}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <span className="dash-si-widget__toggle">
              {diagnostics.blockers.length > previewBlockers.length
                ? `+${diagnostics.blockers.length - previewBlockers.length} nữa — xem tất cả`
                : "Xem chi tiết"}
              <span className="dash-si-widget__chevron">
                <IconChevron />
              </span>
            </span>
          </summary>
          <div className="dash-si-widget__full">
            <DashboardActionableBlockers diagnostics={diagnostics} compact />
          </div>
        </details>
      </div>

      {rsNearMissWatchlist ? (
        <div className="dash-v2-zone__body mt-4">
          <RsNearMissWatchlistPanel
            panel={rsNearMissWatchlist}
            testId="dashboard-secondary-rs-watchlist"
          />
        </div>
      ) : null}
    </section>
  );
}
