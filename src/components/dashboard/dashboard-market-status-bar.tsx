import Link from "next/link";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";

export type DashboardMarketStatusBarProps = {
  freshness: MarketFreshnessDto;
};

function formatScanRunLabel(iso: string | null): string {
  if (!iso) return "No scan";
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
  } catch {
    return iso;
  }
}

/** Compact market status bar (Trading OS v2) — preserves freshness testids. */
export function DashboardMarketStatusBar({ freshness }: DashboardMarketStatusBarProps) {
  const hasStale =
    freshness.delayedBackdrop || freshness.staleFlags.length > 0;

  if (hasStale) {
    const primaryMessage =
      freshness.staleFlags[0]?.message ??
      "Market benchmark data is stale or incomplete relative to other feeds.";

    return (
      <div
        className="dash-market-status dash-market-status--stale"
        role="status"
        data-testid="dashboard-freshness-stale"
      >
        <div className="dash-market-status__lead">
          <span className="dash-market-status__dot dash-market-status__dot--stale" aria-hidden />
          <span className="dash-market-status__label">Data alignment</span>
          <span className="dash-market-status__value">{primaryMessage}</span>
        </div>
        <div className="dash-market-status__chips">
          <span className="dash-chip">VNINDEX {freshness.benchmarkDate ?? "—"}</span>
          <span className="dash-chip">Equity {freshness.equityMaxDate ?? "—"}</span>
          <span className="dash-chip">Scan {formatScanRunLabel(freshness.scanRunAt)}</span>
        </div>
        <Link href="/setups" className="dash-market-status__action text-xs font-medium">
          Setups →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="dash-market-status dash-market-status--ok"
      role="status"
      data-testid="dashboard-freshness-ok"
    >
      <div className="dash-market-status__lead">
        <span className="dash-market-status__dot dash-market-status__dot--ok" aria-hidden />
        <span className="dash-market-status__label">Market data aligned</span>
        <span className="dash-market-status__value dash-market-status__value--muted">
          Backdrop current
        </span>
      </div>
      <div className="dash-market-status__chips">
        <span className="dash-chip">VNINDEX {freshness.benchmarkDate ?? "—"}</span>
        <span className="dash-chip">Equity {freshness.equityMaxDate ?? "—"}</span>
        <span className="dash-chip">Scan {formatScanRunLabel(freshness.scanRunAt)}</span>
      </div>
    </div>
  );
}
