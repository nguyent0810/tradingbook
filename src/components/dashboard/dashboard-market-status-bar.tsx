import Link from "next/link";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";

export type DashboardMarketStatusBarProps = {
  freshness: MarketFreshnessDto;
};

function formatScanRunLabel(iso: string | null): string {
  if (!iso) return "Chưa quét";
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
      "Dữ liệu chuẩn thị trường bị trễ hoặc chưa đầy đủ so với các nguồn khác.";

    return (
      <div
        className="dash-market-status dash-market-status--stale"
        role="status"
        data-testid="dashboard-freshness-stale"
      >
        <div className="dash-market-status__lead">
          <span className="dash-market-status__dot dash-market-status__dot--stale" aria-hidden />
          <span className="dash-market-status__label">Đồng bộ dữ liệu</span>
          <span className="dash-market-status__value">{primaryMessage}</span>
        </div>
        <div className="dash-market-status__chips">
          <span className="dash-chip">VNINDEX {freshness.benchmarkDate ?? "—"}</span>
          <span className="dash-chip">Cổ phiếu {freshness.equityMaxDate ?? "—"}</span>
          <span className="dash-chip">Quét {formatScanRunLabel(freshness.scanRunAt)}</span>
          <span className="dash-chip" data-testid="dashboard-data-timing-mode" title="Toàn bộ dữ liệu bên dưới là cuối ngày — ứng dụng không có nguồn dữ liệu trong phiên/thời gian thực.">
            Dữ liệu: EOD
          </span>
        </div>
        <Link href="/setups" className="dash-market-status__action text-xs font-medium">
          Thiết lập →
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
        <span className="dash-market-status__label">Dữ liệu thị trường đồng bộ</span>
        <span className="dash-market-status__value dash-market-status__value--muted">
          Dữ liệu chuẩn cập nhật
        </span>
      </div>
      <div className="dash-market-status__chips">
        <span className="dash-chip">VNINDEX {freshness.benchmarkDate ?? "—"}</span>
        <span className="dash-chip">Cổ phiếu {freshness.equityMaxDate ?? "—"}</span>
        <span className="dash-chip">Quét {formatScanRunLabel(freshness.scanRunAt)}</span>
        <span className="dash-chip" data-testid="dashboard-data-timing-mode" title="Toàn bộ dữ liệu bên dưới là cuối ngày — ứng dụng không có nguồn dữ liệu trong phiên/thời gian thực.">
          Dữ liệu: EOD
        </span>
      </div>
    </div>
  );
}
