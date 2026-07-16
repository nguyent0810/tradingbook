import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  ActionableBlockerDto,
  EvidenceChipDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { resolveHostilityGauge } from "@/lib/dashboard/hostility-gauge";
import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";
import { DashboardEvidenceCompact } from "@/components/dashboard/dashboard-evidence-compact";
import { DashboardVnindexTrendChartLazy } from "@/components/dashboard/dashboard-vnindex-trend-chart-lazy";
import { DashboardHostilityGaugeLazy } from "@/components/dashboard/dashboard-hostility-gauge-lazy";
import { DashboardConvictionRing } from "@/components/dashboard/dashboard-conviction-ring";

export type DashboardCommandPanelProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  scanDelayedBackdrop: boolean | null;
  verdict: VerdictDto;
  surfacedCount: number;
  evidence: EvidenceChipDto[];
  blockers: ActionableBlockerDto[];
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError?: boolean;
};

export function DashboardCommandPanel({
  freshness,
  latestScan,
  scanDelayedBackdrop,
  verdict,
  surfacedCount,
  evidence,
  blockers,
  vnindexHistory,
  vnindexHistoryError = false,
}: DashboardCommandPanelProps) {
  const gauge = resolveHostilityGauge(verdict.gate1Resolution.canonical);

  return (
    <section
      className="dash-card dash-card--command"
      data-testid="dashboard-cockpit-zone-decision"
      aria-labelledby="dash-v2-command-heading"
    >
      <h2 id="dash-v2-command-heading" className="dash-sr-only">
        Command center
      </h2>

      <div
        className="dash-v2-command__status"
        data-testid="dashboard-cockpit-zone-status"
      >
        <DashboardMarketStatusBar freshness={freshness} />
        <DashboardScanMetaStrip
          latestScan={latestScan}
          delayedBackdrop={scanDelayedBackdrop}
        />
      </div>

      <div className="command-deck-panel__hero-row">
        <div className="command-deck-panel__verdict">
          <DashboardDecisionHero verdict={verdict} surfacedCount={surfacedCount} />
        </div>
        <div className="command-deck-panel__hero-charts">
          <DashboardConvictionRing band={verdict.confidenceBand.value} />
          <DashboardVnindexTrendChartLazy history={vnindexHistory} error={vnindexHistoryError} />
          <DashboardHostilityGaugeLazy gauge={gauge} />
        </div>
      </div>

      <div className="dash-v2-proof-foot">
        <DashboardEvidenceCompact chips={evidence} blockers={blockers} />
      </div>
    </section>
  );
}
