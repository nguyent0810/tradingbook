import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { EquityCurveChart } from "@/components/equity-curve-chart";
import {
  computeAdvancedMetrics,
  computeEquityCurve,
  computeStrategyPerformance,
} from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Your trading performance at a glance.",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch all of user's trades
  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    orderBy: { entryDate: "asc" },
  });

  const {
    totalTrades,
    winRate,
    totalPnl,
    averageWinner,
    averageLoser,
    largestWinner,
    largestLoser,
    profitFactor,
    expectancy,
    maxDrawdown,
  } = computeAdvancedMetrics(trades);

  const equityData = computeEquityCurve(trades);
  const strategyData = computeStrategyPerformance(trades);
  const openTrades = trades.filter((t) => t.status === "OPEN").length;

  return (
    <div className="page-container animate-in space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Advanced analytical breakdown of your performance edge.
          </p>
        </div>

        <Link href="/trades/new" className="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Log Trade
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Closed Trades</div>
          <div className="metric-value">{totalTrades}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open Positions</div>
          <div className="metric-value">{openTrades}</div>
        </div>
        <div className="metric-card">
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
        <div className="metric-card">
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
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Equity Curve
          </h2>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Cumulative progression of closed realized P&L.
          </p>
        </div>
        <EquityCurveChart data={equityData} />
      </div>

      {/* Advanced Performance Metrics */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Performance Edge
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Expectancy</div>
            <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
              ${expectancy.toFixed(2)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Profit Factor</div>
            <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {profitFactor > 0 ? profitFactor : "—"}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Max Drawdown</div>
            <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
              ${maxDrawdown.toFixed(2)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Avg Winner</div>
            <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
              ${averageWinner.toFixed(2)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Avg Loser</div>
            <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
              -${averageLoser.toFixed(2)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Largest Win</div>
            <div className="mt-2 text-xl font-semibold text-[var(--pnl-positive)]">
              ${largestWinner.toFixed(2)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Largest Loss</div>
            <div className="mt-2 text-xl font-semibold text-[var(--danger)]">
              ${largestLoser.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Analytics */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Strategy Breakdown
        </h2>
        
        {strategyData.length === 0 ? (
          <div className="flex h-[150px] items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm text-[var(--text-muted)]">
            Tag your trades with strategies to see performance metrics here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <tr>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Strategy Tag</th>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Count</th>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)]">Win Rate</th>
                    <th className="px-6 py-3 font-medium text-[var(--text-secondary)] text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {strategyData.map((s) => (
                    <tr key={s.strategy} className="hover:bg-[var(--bg-primary)] transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--text-primary)]">
                        {s.strategy}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {s.totalTrades}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {s.winRate}%
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        <span style={{ color: s.totalPnl >= 0 ? "var(--pnl-positive)" : "var(--danger)" }}>
                          {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {trades.length === 0 && (
        <div className="card mt-8">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="empty-state-title">No trades yet</div>
            <div className="empty-state-description">
              Start logging your trades to track your performance and identify patterns in your edge.
            </div>
            <Link href="/trades/new" className="btn btn-primary mt-6">
              Log Your First Trade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
