import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TradeFilters } from "./trade-filters";

export const metadata: Metadata = {
  title: "Trades — TradeLog",
  description: "View and manage your trades.",
};

interface TradesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
  }>;
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "";
  const sortOrder = params.sort === "oldest" ? "asc" : "desc";

  // Build where clause
  const where: Record<string, unknown> = { userId: session.userId };

  if (search) {
    where.symbol = { contains: search.toUpperCase(), mode: "insensitive" };
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { entryDate: sortOrder },
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Trades
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            {trades.length} trade{trades.length !== 1 ? "s" : ""}
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

      {/* Filters */}
      <TradeFilters
        currentSearch={search}
        currentStatus={statusFilter}
        currentSort={params.sort || "newest"}
      />

      {/* Trade Table */}
      {trades.length === 0 ? (
        <div className="card mt-4">
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div className="empty-state-title">
              {search || statusFilter ? "No matching trades" : "No trades yet"}
            </div>
            <div className="empty-state-description">
              {search || statusFilter
                ? "Try adjusting your search or filters."
                : "Log your first trade to start tracking your performance."}
            </div>
            {!search && !statusFilter && (
              <Link href="/trades/new" className="btn btn-primary mt-6">
                Log Your First Trade
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Entry Date</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Qty</th>
                <th>P&L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <span
                      className="mono font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {trade.symbol}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        trade.direction === "LONG"
                          ? "badge-long"
                          : "badge-short"
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${trade.status.toLowerCase()}`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="mono">{formatDate(trade.entryDate)}</td>
                  <td className="mono">{formatCurrency(trade.entryPrice)}</td>
                  <td className="mono">
                    {trade.exitPrice !== null
                      ? formatCurrency(trade.exitPrice)
                      : "—"}
                  </td>
                  <td className="mono">{trade.quantity}</td>
                  <td>
                    {trade.realizedPnl !== null ? (
                      <span
                        className="mono font-medium"
                        style={{
                          color:
                            trade.realizedPnl >= 0
                              ? "var(--pnl-positive)"
                              : "var(--pnl-negative)",
                        }}
                      >
                        {trade.realizedPnl >= 0 ? "+" : ""}
                        {formatCurrency(trade.realizedPnl)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/trades/${trade.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
