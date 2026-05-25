import { DashboardFreshnessStrip } from "@/components/dashboard/dashboard-freshness-strip";
import { DashboardScanRunMeta } from "@/components/dashboard/dashboard-scan-run-meta";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type SetupsPipelineContextProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

/** Scanner pipeline freshness + latest run metadata (Setups Slice 2). */
export function SetupsPipelineContext({
  freshness,
  latestScan,
  delayedBackdrop,
}: SetupsPipelineContextProps) {
  return (
    <div className="setups-pipeline-context space-y-4" data-testid="setups-pipeline-context">
      <DashboardFreshnessStrip freshness={freshness} />
      <DashboardScanRunMeta latestScan={latestScan} delayedBackdrop={delayedBackdrop} />
    </div>
  );
}
