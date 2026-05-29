import { DashboardMarketStatusBar } from "@/components/dashboard/dashboard-market-status-bar";
import { DashboardScanMetaStrip } from "@/components/dashboard/dashboard-scan-meta-strip";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type TradesFreshnessCompactProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

/** Single-row market trust band for ledger cockpit. */
export function TradesFreshnessCompact({
  freshness,
  latestScan,
  delayedBackdrop,
}: TradesFreshnessCompactProps) {
  return (
    <div className="tosv3-ledger-trust" data-testid="trades-freshness-context">
      <DashboardMarketStatusBar freshness={freshness} />
      <DashboardScanMetaStrip latestScan={latestScan} delayedBackdrop={delayedBackdrop} />
    </div>
  );
}
