import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type { DecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { DashboardEntrance } from "@/components/dashboard/dashboard-entrance";
import { DashboardSignalsRail } from "@/components/dashboard/dashboard-signals-rail";
import { DashboardOpportunityCandidates } from "@/components/dashboard/dashboard-opportunity-candidates";
import { DashboardNearMissRejectionsPanel } from "@/components/dashboard/dashboard-near-miss-rejections-panel";
import { DashboardTomorrowPlan } from "@/components/dashboard/dashboard-tomorrow-plan";
import { DashboardSecondaryIntelligence } from "@/components/dashboard/dashboard-secondary-intelligence";
import type { DashboardWatchlistItem } from "@/components/dashboard/dashboard-watchlist-panel";

export type DashboardDecisionCockpitProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  cockpitDto: DecisionCockpitDto;
  surfacedCount: number;
  activeWatchItems: DashboardWatchlistItem[];
  watchlistTruncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError?: boolean;
};

/**
 * Decision Cockpit — verdict -> evidence -> opportunities -> tomorrow's plan
 * (docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md). Composes the
 * dashboard-* panel family; the panels themselves already read
 * DecisionCockpitDto fields directly, so this assembler only sequences them.
 */
export function DashboardDecisionCockpit({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  cockpitDto,
  surfacedCount,
  activeWatchItems,
  watchlistTruncated = false,
  latestCloseBySymbol,
  vnindexHistory,
  vnindexHistoryError = false,
}: DashboardDecisionCockpitProps) {
  return (
    <div className="command-deck__layout" data-testid="dashboard-cockpit-layout">
      <DashboardEntrance>
        <section
          className="command-deck-opportunity dash-v2-zone dash-v2-zone--context"
          data-testid="dashboard-cockpit-zone-opportunity"
          aria-labelledby="dashboard-opportunity-heading"
        >
          <header className="dash-v2-zone-header dash-header--numbered">
            <span className="dash-header-num" aria-hidden="true">
              01
            </span>
            <div>
              <p className="dash-v2-eyebrow">Cơ hội</p>
              <h2 id="dashboard-opportunity-heading" className="dash-v2-zone-title">
                Bảng cơ hội
              </h2>
              <p className="dash-v2-zone-lead">
                Hành động theo Hạng và các mã suýt đạt — so sánh trước khi ghi nhận rủi ro.
              </p>
            </div>
          </header>

          <div className="command-deck-opportunity__body dash-v2-zone__body">
            {cockpitDto.opportunity.mode === "candidates" ? (
              <DashboardOpportunityCandidates opportunity={cockpitDto.opportunity} />
            ) : (
              <DashboardNearMissRejectionsPanel opportunity={cockpitDto.opportunity} />
            )}
          </div>
        </section>

        <div className="command-deck__tomorrow">
          <DashboardTomorrowPlan tomorrow={cockpitDto.tomorrow} />
        </div>

        <DashboardSecondaryIntelligence
          diagnostics={cockpitDto.actionableDiagnostics}
          watchItems={activeWatchItems}
          watchItemsTruncated={watchlistTruncated}
          latestCloseBySymbol={latestCloseBySymbol}
          rsNearMissWatchlist={cockpitDto.rsNearMissWatchlist}
        />
      </DashboardEntrance>

      <DashboardSignalsRail
        freshness={freshness}
        latestScan={latestScan}
        scanDelayedBackdrop={scanDelayedBackdrop}
        ladder={cockpitDto.setupQualityLadder}
        verdict={cockpitDto.verdict}
        vnindexHistory={vnindexHistory}
        vnindexHistoryError={vnindexHistoryError}
        surfacedCount={surfacedCount}
        evidence={cockpitDto.evidence}
        blockers={cockpitDto.blockers}
      />
    </div>
  );
}
