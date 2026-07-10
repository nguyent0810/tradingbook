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

export function TradeGateCard({ risk }: Props) {
  const rows = mapTradeGateRows(risk);

  return (
    <Card className="p-4" data-testid="dashboard-cyber-trade-gate">
      <CardHeader
        title="Entry Gate"
        subtitle={risk.tradeGate.subtitle}
        action={
          <div className="text-right text-xs">
            <span className="cd-kicker" style={{ letterSpacing: "0.08em" }}>
              Open positions
            </span>
            <strong className="cd-mono block text-sm">{risk.openPositions}</strong>
            {risk.tradeGate.budgetStatus !== "configured" ? (
              <>
                <span className="cd-kicker mt-1 block" style={{ letterSpacing: "0.08em" }}>
                  Risk budget
                </span>
                <strong className="cd-tone-warning block text-sm">Setup needed</strong>
              </>
            ) : null}
          </div>
        }
      />

      <div className="cd-table-scroll" role="region" aria-label="Trade Gate">
        <table className="cd-rs-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Status</th>
              <th>Severity</th>
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
                <td className="cd-mono">{row.severity}</td>
                <td className={`cd-mono ${actionTone(row.action) === "success" ? "cd-tone-success" : actionTone(row.action) === "danger" ? "cd-tone-danger" : actionTone(row.action) === "warning" ? "cd-tone-warning" : ""}`}>
                  {row.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs m-0 mt-2" style={{ color: "var(--cd-text-dim)" }}>
          {risk.capitalProtectionState}
        </p>
      ) : null}
    </Card>
  );
}
