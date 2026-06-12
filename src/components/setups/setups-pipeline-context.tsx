import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { PipelineMetrics } from "@/components/setups-workstation";
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
      <PipelineMetrics latestScan={latestScan} nearMissCount={nearMissCount} />
    </div>
  );
}
