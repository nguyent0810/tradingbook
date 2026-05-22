import Link from "next/link";
import { PriceChangeBadge } from "./price-change-badge";
import type { PriceDirection } from "@/lib/design-tokens";

export type WatchlistRow = {
  symbol: string;
  price: string;
  change: string;
  direction: PriceDirection;
  status: string;
  health?: string;
  actionHint?: string;
  href?: string;
};

export type WatchlistTableProps = {
  rows: WatchlistRow[];
  emptyTitle?: string;
  emptyDescription?: string;
  compact?: boolean;
};

export function WatchlistTable({
  rows,
  emptyTitle = "No symbols on watch",
  emptyDescription = "Add setups from the scanner or dashboard.",
  compact,
}: WatchlistTableProps) {
  if (rows.length === 0) {
    return (
      <div className="card px-5 py-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{emptyTitle}</p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className={`table min-w-[640px] ${compact ? "table-dense" : ""}`}>
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="table-num">Price</th>
            <th className="table-num">Change</th>
            <th>Status</th>
            <th>Health</th>
            <th>Hint</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {row.href ? (
                  <Link href={row.href} className="hover:underline" style={{ color: "var(--accent-text)" }}>
                    {row.symbol}
                  </Link>
                ) : (
                  row.symbol
                )}
              </td>
              <td className="table-num mono">{row.price}</td>
              <td className="table-num">
                <PriceChangeBadge value={row.change} direction={row.direction} />
              </td>
              <td>{row.status}</td>
              <td>{row.health ?? "—"}</td>
              <td className="max-w-[200px] text-xs" style={{ color: "var(--text-secondary)" }}>
                {row.actionHint ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
