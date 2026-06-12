"use client";

import type { FlashMap, V3RiskConsole } from "../types";
import { mapTradeGateRows } from "../lib/table-mappers";
import { FlashValue } from "./FlashValue";
import { StatusPill } from "./StatusPill";
import { TechTable } from "./TechTable";

type Props = {
  data: V3RiskConsole;
  flashMap: FlashMap;
};

function statusPillVariant(status: "pass" | "caution" | "blocked"): "pass" | "caution" | "blocked" {
  return status;
}

export function TradeGateTable({ data, flashMap }: Props) {
  const rows = mapTradeGateRows(data);
  const hasPercentCap =
    data.exposurePercent != null &&
    data.maxRiskPercent != null &&
    data.utilizationPercent != null &&
    data.tradeGate.budgetStatus === "configured";

  const budgetNote =
    data.tradeGate.budgetStatus === "unavailable"
      ? "Budget unknown — set account equity to compare open notional to a book cap."
      : data.tradeGate.budgetStatus === "partial"
        ? "Budget partially configured — cap could not be parsed."
        : null;

  const headerExtra = (
    <div className="text-right text-xs">
      <span className="ccd-label">Open positions</span>
      <FlashValue flashKey="risk.openPositions" flashMap={flashMap}>
        <strong className="ccd-metric block">{data.openPositions}</strong>
      </FlashValue>
      {hasPercentCap ? (
        <>
          <span className="ccd-label mt-1">Utilization</span>
          <FlashValue flashKey="risk.utilizationPercent" flashMap={flashMap}>
            <strong className="ccd-metric block">{data.utilizationPercent}%</strong>
          </FlashValue>
        </>
      ) : budgetNote ? (
        <>
          <span className="ccd-label mt-1">Risk budget</span>
          <strong className="ccd-metric block text-amber-400/90">Setup needed</strong>
        </>
      ) : null}
    </div>
  );

  return (
    <TechTable
      title="Trade Gate"
      subtitle={data.tradeGate.subtitle}
      testId="dashboard-cyber-trade-gate"
      rows={rows}
      fillHeight
      headerExtra={headerExtra}
      emptyMessage={data.capitalProtectionState}
      columns={[
        {
          key: "rule",
          header: "Rule",
          render: (row) => row.rule,
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <StatusPill variant={statusPillVariant(row.status)}>{row.statusLabel}</StatusPill>
          ),
        },
        {
          key: "severity",
          header: "Severity",
          mono: true,
          align: "right",
          render: (row) => row.severity,
        },
        {
          key: "action",
          header: "Action",
          render: (row) => row.action,
        },
      ]}
    />
  );
}

/** @deprecated Use TradeGateTable */
export const RiskConsoleTable = TradeGateTable;
