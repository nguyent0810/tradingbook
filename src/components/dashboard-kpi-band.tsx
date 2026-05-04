import { formatVND } from "@/lib/formatters";

export type DashboardKpiBandProps = {
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  className?: string;
};

/**
 * 2×2 KPI grid aligned to the equity row height: cells stretch evenly without hero sizing.
 */
export function DashboardKpiBand({
  totalTrades,
  openTrades,
  winRate,
  totalPnl,
  className = "",
}: DashboardKpiBandProps) {
  return (
    <div
      className={`flex min-h-0 flex-col lg:min-h-[350px] ${className}`.trim()}
    >
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        <div className="metric-card flex h-full min-h-0 flex-col justify-center">
          <div className="metric-label">Closed Trades</div>
          <div className="metric-value">{totalTrades}</div>
        </div>
        <div className="metric-card flex h-full min-h-0 flex-col justify-center">
          <div className="metric-label">Open Positions</div>
          <div className="metric-value">{openTrades}</div>
        </div>
        <div className="metric-card flex h-full min-h-0 flex-col justify-center">
          <div className="metric-label">Win Rate</div>
          <div className="metric-value">
            {totalTrades > 0 ? winRate : "—"}
            {totalTrades > 0 && (
              <span
                className="ml-1 text-sm font-normal"
                style={{ color: "var(--text-tertiary)" }}
              >
                %
              </span>
            )}
          </div>
        </div>
        <div className="metric-card flex h-full min-h-0 flex-col justify-center">
          <div className="metric-label">Cumulative P&L</div>
          <div
            className="metric-value"
            style={{
              color:
                totalPnl === 0
                  ? "var(--text-primary)"
                  : totalPnl > 0
                    ? "var(--pnl-positive)"
                    : "var(--danger)",
            }}
          >
            {totalPnl > 0 ? "+" : ""}
            {formatVND(totalPnl, true)}
          </div>
        </div>
      </div>
    </div>
  );
}
