"use client";

import type { RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  rows: RelativeStrengthRow[];
  contextNote?: string;
};

function statusTone(status: RelativeStrengthRow["status"]) {
  if (status === "aligned") return "success" as const;
  if (status === "blocked") return "danger" as const;
  return "warning" as const;
}

function statusLabel(status: RelativeStrengthRow["status"]) {
  if (status === "aligned") return "Aligned";
  if (status === "blocked") return "Blocked";
  return "Watch";
}

export function RelativeStrengthTable({ rows, contextNote }: Props) {
  return (
    <Card className="p-4 h-full" data-testid="command-deck-rs-table">
      <CardHeader
        title="Relative Strength Radar"
        subtitle="Leaders vs VNINDEX that have not cleared setup filters yet"
      />
      {contextNote ? (
        <p
          className="text-xs m-0 mb-3 leading-relaxed"
          style={{ color: "var(--cd-text-muted)" }}
          data-testid="dashboard-rs-context-banner"
        >
          {contextNote}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="cd-rs-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">RS20</th>
              <th className="text-right">vs VNINDEX</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td className="cd-rs-table__symbol cd-mono">{row.symbol}</td>
                <td className="cd-mono text-right tabular-nums">{row.rs20.toFixed(1)}</td>
                <td
                  className={`cd-mono text-right tabular-nums ${row.rs20 >= 0 ? "cd-tone-success" : "cd-tone-danger"}`}
                >
                  {row.vsIndex}
                </td>
                <td>
                  <Badge tone={statusTone(row.status)} pulse={row.status === "watch"}>
                    {statusLabel(row.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs m-0 mt-2" style={{ color: "var(--cd-text-dim)" }}>
          No RS leaders on this session.
        </p>
      ) : null}
    </Card>
  );
}
