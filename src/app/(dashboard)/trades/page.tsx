import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TradeFilters } from "./trade-filters";
import { formatVND } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";
import {
  computeUnrealizedFromLatestClose,
  fetchLatestCloseByTradeSymbols,
  formatSignedPct,
} from "@/lib/trades/unrealized-from-close";

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
    include: {
      setupCandidate: {
        select: {
          id: true,
          setupType: true,
          quality: true,
        },
      },
    },
  });

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const openTradeIds = trades
    .filter((t) => t.status === "OPEN")
    .map((t) => t.id);

  const openSymbols = [
    ...new Set(
      trades
        .filter((t) => t.status === "OPEN")
        .map((t) => t.symbol.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  const latestCloseBySymbol = await fetchLatestCloseByTradeSymbols(
    prisma,
    openSymbols
  );

  let checkedTodayTradeIds = new Set<string>();
  if (openTradeIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<Array<{ trade_id: string }>>`
        SELECT DISTINCT trade_id
        FROM trade_health_logs
        WHERE trade_id IN (${Prisma.join(openTradeIds)})
          AND checked_at >= ${dayStart}
          AND checked_at <= ${dayEnd}
      `;
      checkedTodayTradeIds = new Set(rows.map((r) => r.trade_id));
    } catch (e) {
      console.error("[trades] trade_health_logs batch query skipped:", e);
      checkedTodayTradeIds = new Set();
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatBarSessionDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

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
        <div className="table-container table-sticky mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Setup</th>
                <th>Direction</th>
                <th>Playbook</th>
                <th>Status</th>
                <th>EOD</th>
                <th>Entry Date</th>
                <th className="table-num">Entry Price</th>
                <th className="table-num">Exit / Latest</th>
                <th className="table-num">Qty</th>
                <th className="table-num">P&amp;L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const symKey = trade.symbol.trim().toUpperCase();
                const latestBar =
                  trade.status === "OPEN"
                    ? latestCloseBySymbol.get(symKey) ?? null
                    : null;
                const unrealized =
                  latestBar != null
                    ? computeUnrealizedFromLatestClose({
                        direction: trade.direction,
                        entryPrice: trade.entryPrice,
                        quantity: trade.quantity,
                        latestClose: latestBar.close,
                      })
                    : null;

                return (
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
                    {trade.setupCandidate ? (
                      <span className="px-2 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {trade.setupCandidate.quality} · {trade.setupCandidate.setupType}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Manual</span>
                    )}
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
                    <span className="px-2 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                      {formatPlaybookLabel(trade.playbook)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${trade.status.toLowerCase()}`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td>
                    {trade.status === "OPEN" ? (
                      checkedTodayTradeIds.has(trade.id) ? (
                        <span
                          className="px-2 py-1 text-xs rounded-md border"
                          style={{
                            borderColor: "color-mix(in srgb, #22c55e 35%, var(--border-color))",
                            backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)",
                            color: "#166534",
                          }}
                        >
                          Checked today
                        </span>
                      ) : (
                        <span
                          className="px-2 py-1 text-xs rounded-md border"
                          style={{
                            borderColor: "color-mix(in srgb, #eab308 40%, var(--border-color))",
                            backgroundColor: "color-mix(in srgb, #eab308 12%, transparent)",
                            color: "#854d0e",
                          }}
                        >
                          Needs EOD check
                        </span>
                      )
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="mono">{formatDate(trade.entryDate)}</td>
                  <td className="mono table-num">{formatVND(trade.entryPrice, false)}</td>
                  <td className="mono table-num">
                    {trade.status === "OPEN" ? (
                      latestBar ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>
                            Latest close: {formatVND(latestBar.close, false)}
                          </span>
                          <span
                            className="text-[11px] font-normal normal-case"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {formatBarSessionDate(latestBar.date)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>
                          No latest close
                        </span>
                      )
                    ) : trade.exitPrice !== null ? (
                      formatVND(trade.exitPrice, false)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="mono table-num">{trade.quantity}</td>
                  <td className="table-num">
                    {trade.status === "OPEN" ? (
                      latestBar ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Unrealized
                          </span>
                          {unrealized?.pnlAmount != null ? (
                            <span
                              className="mono font-medium"
                              style={{
                                color:
                                  unrealized.pnlAmount >= 0
                                    ? "var(--pnl-positive)"
                                    : "var(--pnl-negative)",
                              }}
                            >
                              {unrealized.pnlAmount > 0 ? "+" : ""}
                              {formatVND(unrealized.pnlAmount, false)}
                            </span>
                          ) : (
                            <span
                              className="mono text-sm"
                              style={{ color: "var(--text-muted)" }}
                            >
                              —
                            </span>
                          )}
                          <span
                            className="mono text-[12px]"
                            style={{
                              color:
                                unrealized?.pnlPct != null
                                  ? unrealized.pnlPct >= 0
                                    ? "var(--pnl-positive)"
                                    : "var(--pnl-negative)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {formatSignedPct(unrealized?.pnlPct ?? null)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )
                    ) : trade.realizedPnl !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Realized
                        </span>
                        <span
                          className="mono font-medium"
                          style={{
                            color:
                              trade.realizedPnl >= 0
                                ? "var(--pnl-positive)"
                                : "var(--pnl-negative)",
                          }}
                        >
                          {trade.realizedPnl > 0 ? "+" : ""}
                          {formatVND(trade.realizedPnl, false)}
                        </span>
                      </div>
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
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
