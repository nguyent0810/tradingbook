import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type TradesFreshnessContextProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

/** Compact market status + secondary scan meta (Trading OS v2). */
export function TradesFreshnessContext({
  freshness,
  latestScan,
  delayedBackdrop,
}: TradesFreshnessContextProps) {
  return (
    <div className="tos-trades-context space-y-3" data-testid="trades-freshness-context">
      <DashboardMarketStatusBar freshness={freshness} />
      <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={delayedBackdrop} />
    </div>
  );
}
