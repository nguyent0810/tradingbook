import { DashboardFreshnessStrip } from "@/components/dashboard/dashboard-freshness-strip";
import { DashboardScanRunMeta } from "@/components/dashboard/dashboard-scan-run-meta";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";

export type TradesFreshnessContextProps = {
  freshness: MarketFreshnessDto;
  latestScan: LatestScanWithCandidates | null;
  delayedBackdrop: boolean | null;
};

/** Market freshness + latest scan metadata for the trades ledger (Slice 3). */
export function TradesFreshnessContext({
  freshness,
  latestScan,
  delayedBackdrop,
}: TradesFreshnessContextProps) {
  return (
    <div className="trades-freshness-context space-y-4" data-testid="trades-freshness-context">
      <DashboardFreshnessStrip freshness={freshness} />
      <DashboardScanRunMeta latestScan={latestScan} delayedBackdrop={delayedBackdrop} />
    </div>
  );
}
