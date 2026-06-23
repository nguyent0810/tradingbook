"use client";

import type { V3RiskConsole } from "@/lib/dashboard/dashboard-v3-view-model";
import { mapTradeGateRows } from "@/components/cyber-command-deck/lib/table-mappers";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  risk: V3RiskConsole;
};

function actionTone(action: string): "danger" | "warning" | "success" | "neutral" {
  if (action === "Go") return "success";
  if (action === "No new entries" || action === "Hold") return "danger";
  if (action === "Setup needed" || action === "Configure equity") return "warning";
  return "neutral";
}

function countByStatus(rows: ReturnType<typeof mapTradeGateRows>) {
  let blocked = 0;
  let waiting = 0;
  let ready = 0;
  for (const row of rows) {
    const label = row.statusLabel.toLowerCase();
    if (label.includes("block")) blocked += 1;
    else if (label.includes("wait") || label.includes("setup")) waiting += 1;
    else if (label.includes("ready") || row.action === "Go") ready += 1;
    else waiting += 1;
  }
  return { blocked, waiting, ready };
}

export function TradeGateSummaryCard({ risk }: Props) {
  const rows = mapTradeGateRows(risk);
  const counts = countByStatus(rows);

  return (
    <Card className="p-3 cd-trade-gate-summary" data-testid="dashboard-cyber-trade-gate">
      <CardHeader
        title="Trade Gate"
        subtitle={risk.tradeGate.subtitle}
        action={
          <span className="cd-mono text-xs" style={{ color: "var(--cd-text-muted)" }}>
            Open {risk.openPositions}
          </span>
        }
      />

      <p className="cd-trade-gate-summary__counts m-0 mb-2 text-xs">
        Blocked: <strong>{counts.blocked}</strong> · Waiting: <strong>{counts.waiting}</strong> ·
        Ready: <strong>{counts.ready}</strong>
      </p>

      <details className="cd-trade-gate-summary__details">
        <summary className="cd-trade-gate-summary__trigger text-xs">View rules</summary>
        <div className="cd-table-scroll cd-table-scroll--compact mt-2" role="region" aria-label="Trade Gate rules">
          <table className="cd-rs-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rule}</td>
                  <td>
                    <Badge tone={actionTone(row.action)} size="compact">
                      {row.statusLabel}
                    </Badge>
                  </td>
                  <td className="cd-mono text-xs">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {rows.length === 0 ? (
        <p className="text-xs m-0 mt-1" style={{ color: "var(--cd-text-dim)" }}>
          {risk.capitalProtectionState}
        </p>
      ) : null}
    </Card>
  );
}
