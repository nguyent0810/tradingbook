import { StatCard } from "./stat-card";
import { pnlColor } from "@/lib/design-tokens";

export type PortfolioSummaryProps = {
  exposure: string;
  allocationGuide: string;
  perTradeGuide: string;
  stance: string;
  openCount?: number;
  configured?: boolean;
};

export function PortfolioSummary({
  exposure,
  allocationGuide,
  perTradeGuide,
  stance,
  openCount,
  configured = true,
}: PortfolioSummaryProps) {
  return (
    <div className="space-y-3">
      {!configured ? (
        <div className="alert-warning px-4 py-3 text-sm">
          Risk budget not configured. Values are guidance-only until{" "}
          <code className="rounded bg-[var(--bg-tertiary)] px-1 text-xs">TRADING_ACCOUNT_EQUITY_VND</code> is set.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current exposure" value={exposure} />
        <StatCard label="Allocation guide" value={allocationGuide} />
        <StatCard label="Per-trade guide" value={perTradeGuide} />
        <StatCard label="Stance" value={stance} />
      </div>
      {openCount != null ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {openCount} open position{openCount === 1 ? "" : "s"} — entry notional, not mark-to-market.
        </p>
      ) : null}
    </div>
  );
}

export type PortfolioKpiStripProps = {
  closedTrades: number;
  openPositions: number;
  winRate: number | null;
  cumulativePnl: number;
  formatPnl: (n: number) => string;
};

export function PortfolioKpiStrip({
  closedTrades,
  openPositions,
  winRate,
  cumulativePnl,
  formatPnl,
}: PortfolioKpiStripProps) {
  const trend =
    cumulativePnl > 0 ? "up" : cumulativePnl < 0 ? "down" : ("neutral" as const);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Closed trades" value={closedTrades} />
      <StatCard label="Open positions" value={openPositions} />
      <StatCard
        label="Win rate"
        value={winRate != null ? `${winRate}%` : "—"}
      />
      <StatCard
        label="Cumulative P&L"
        value={
          <span style={{ color: pnlColor(cumulativePnl) }}>
            {cumulativePnl > 0 ? "+" : ""}
            {formatPnl(cumulativePnl)}
          </span>
        }
        trend={trend}
      />
    </div>
  );
}
