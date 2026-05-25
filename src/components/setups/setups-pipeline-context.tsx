import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { SetupsPipelineSummaryStrip } from "@/components/setups/setups-pipeline-summary-strip";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type SetupsPipelineContextProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  nearMissCount: number;
};

/** Scanner pipeline market status + summary strip (Trading OS v2). */
export function SetupsPipelineContext({
  freshness,
  latestScan,
  nearMissCount,
}: SetupsPipelineContextProps) {
  return (
    <div className="tos-setups-context space-y-3" data-testid="setups-pipeline-context">
      <DashboardMarketStatusBar freshness={freshness} />
      <SetupsPipelineSummaryStrip latestScan={latestScan} nearMissCount={nearMissCount} />
    </div>
  );
}
