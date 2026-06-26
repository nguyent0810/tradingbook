import Link from "next/link";
import type { Trade } from "@/generated/prisma/client";
import { formatVND } from "@/lib/formatters";
import { formatPlaybookLabel } from "@/lib/playbook-config";

function formatPreviewDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type TradePreviewTableProps = {
  trades: Trade[];
};

export function TradePreviewTable({ trades }: TradePreviewTableProps) {
  if (trades.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Recent trades
        </h2>
        <Link
          href="/trades/journal"
          className="text-sm font-medium text-[var(--accent-text)] hover:underline"
        >
          View all trades →
        </Link>
      </div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Playbook</th>
              <th>Status</th>
              <th>Entry Date</th>
              <th className="table-num">Entry Price</th>
              <th className="table-num">Exit Price</th>
              <th className="table-num">Qty</th>
              <th className="table-num">P&L</th>
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
                      trade.direction === "LONG" ? "badge-long" : "badge-short"
                    }`}
                  >
                    {trade.direction}
                  </span>
                </td>
                <td>
                  <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    {formatPlaybookLabel(trade.playbook)}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${trade.status.toLowerCase()}`}>
                    {trade.status}
                  </span>
                </td>
                <td className="mono">{formatPreviewDate(trade.entryDate)}</td>
                <td className="mono table-num">{formatVND(trade.entryPrice, false)}</td>
                <td className="mono table-num">
                  {trade.exitPrice !== null ? formatVND(trade.exitPrice, false) : "—"}
                </td>
                <td className="mono table-num">{trade.quantity}</td>
                <td className="table-num">
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
                      {trade.realizedPnl > 0 ? "+" : ""}
                      {formatVND(trade.realizedPnl, false)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td>
                  <Link href={`/trades/${trade.id}`} className="btn btn-ghost btn-sm">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
