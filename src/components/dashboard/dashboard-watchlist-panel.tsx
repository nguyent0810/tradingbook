import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import { distanceToZonePct, healthLevelActionHint } from "@/lib/setup-health";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import {
  displaySetupHealthLevel,
  displaySetupLifecycleStatus,
} from "@/lib/trading-display-labels";

export type DashboardWatchlistItem = {
  id: string;
  symbolId: string;
  lifecycleStatus: SetupLifecycleStatus;
  healthLevel: SetupHealthLevelValue | null;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  symbol: { symbol: string };
};

export type DashboardWatchlistPanelProps = {
  items: DashboardWatchlistItem[];
  /** True when more active watch items exist beyond the ones shown here. */
  truncated?: boolean;
  latestCloseBySymbol: Map<string, number>;
};

function watchActionHint(
  lifecycle: SetupLifecycleStatus,
  healthLevel: SetupHealthLevelValue | null
): string {
  if (healthLevel) {
    const hint = healthLevelActionHint(healthLevel);
    if (hint) return hint;
  }
  switch (lifecycle) {
    case "READY":
      return "Đủ điều kiện vào quy trình thực thi.";
    case "WATCHING":
      return "Chờ pullback vào vùng vào lệnh.";
    case "NEW":
      return "Theo dõi lần retest hợp lệ đầu tiên.";
    default:
      return "Xem lại trạng thái thiết lập trước khi hành động.";
  }
}

export function DashboardWatchlistPanel({
  items,
  truncated = false,
  latestCloseBySymbol,
}: DashboardWatchlistPanelProps) {
  return (
    <section className="dash-panel dash-surface-1" data-testid="dashboard-watchlist-panel">
      <header className="dash-panel__header">
        <h2 className="dash-section-title">Danh sách theo dõi</h2>
        <p className="dash-panel__subtitle">Vòng đời MỚI · ĐANG THEO DÕI · SẴN SÀNG</p>
      </header>

      {items.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="Danh sách theo dõi đang trống"
            reason="Mã sẽ xuất hiện khi thiết lập nổi bật chuyển sang MỚI, ĐANG THEO DÕI, hoặc SẴN SÀNG. Không có ứng viên hôm nay vẫn cho phép thêm mã theo dõi thủ công từ các lần quét sau."
            data-testid="dashboard-watchlist-empty"
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Trạng thái</th>
                <th>Sức khỏe</th>
                <th className="table-num">K/c tới vùng</th>
                <th>Gợi ý</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const close = latestCloseBySymbol.get(w.symbolId) ?? null;
                const dist =
                  close == null
                    ? null
                    : distanceToZonePct(close, w.pullbackZoneLow, w.pullbackZoneHigh);
                return (
                  <tr key={w.id}>
                    <td className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                      {w.symbol.symbol}
                    </td>
                    <td>{displaySetupLifecycleStatus(w.lifecycleStatus)}</td>
                    <td>
                      {w.healthLevel ? displaySetupHealthLevel(w.healthLevel) : "—"}
                    </td>
                    <td className="table-num">
                      {dist == null ? "—" : `${(dist * 100).toFixed(1)}%`}
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {watchActionHint(w.lifecycleStatus, w.healthLevel)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {truncated ? (
            <p
              className="dash-panel__subtitle text-xs"
              data-testid="dashboard-watchlist-truncated-note"
            >
              Đang hiện {items.length} mã đầu tiên — còn nhiều mã đang theo dõi khác. Vào đường ống
              Thiết lập để xem toàn bộ.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
