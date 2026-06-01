import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { SetupsPipelineSummaryStrip } from "@/components/setups/setups-pipeline-summary-strip";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type SetupsPipelineContextProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  nearMissCount: number;
};

/** Trust strip + pipeline summary for the setups pipeline deck. */
export function SetupsPipelineContext({
  freshness,
  latestScan,
  nearMissCount,
}: SetupsPipelineContextProps) {
  return (
    <div className="tosv3-setups-trust" data-testid="setups-pipeline-context">
      <div className="tosv3-setups-trust__bar">
        <DashboardMarketStatusBar freshness={freshness} />
      </div>
      <SetupsPipelineSummaryStrip latestScan={latestScan} nearMissCount={nearMissCount} />
    </div>
  );
}
