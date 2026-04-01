import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard — TradeLog",
  description: "Your trading performance at a glance.",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch all of user's closed trades for metrics
  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    select: {
      status: true,
      realizedPnl: true,
      direction: true,
    },
  });

  const totalTrades = trades.length;
  const closedTrades = trades.filter((t) => t.status === "CLOSED");
  const openTrades = trades.filter((t) => t.status === "OPEN").length;

  const winners = closedTrades.filter(
    (t) => t.realizedPnl !== null && t.realizedPnl > 0
  );
  const winRate =
    closedTrades.length > 0
      ? ((winners.length / closedTrades.length) * 100).toFixed(1)
      : "—";

  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl ?? 0),
    0
  );

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Your trading performance at a glance
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Total Trades</div>
          <div className="metric-value">{totalTrades}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Open Positions</div>
          <div className="metric-value">{openTrades}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Win Rate</div>
          <div className="metric-value">
            {winRate}
            {winRate !== "—" && (
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
          <div className="metric-label">Total P&L</div>
          <div
            className="metric-value"
            style={{
              color:
                totalPnl === 0
                  ? "var(--text-primary)"
                  : totalPnl > 0
                    ? "var(--pnl-positive)"
                    : "var(--pnl-negative)",
            }}
          >
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {totalTrades === 0 && (
        <div className="card mt-8">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="empty-state-title">No trades yet</div>
            <div className="empty-state-description">
              Start logging your trades to track your performance and identify
              patterns in your trading.
            </div>
            <Link
              href="/trades/new"
              className="btn btn-primary mt-6"
            >
              Log Your First Trade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
