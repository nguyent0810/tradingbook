"use client";

import type { FlashMap, V3RiskConsole } from "../types";
import { mapRiskTableRows } from "../lib/table-mappers";
import { FlashValue } from "./FlashValue";
import { StatusPill } from "./StatusPill";
import { TechTable } from "./TechTable";

type Props = {
  data: V3RiskConsole;
  flashMap: FlashMap;
};

export function RiskConsoleTable({ data, flashMap }: Props) {
  const rows = mapRiskTableRows(data);
  const hasPercentCap =
    data.exposurePercent != null &&
    data.maxRiskPercent != null &&
    data.utilizationPercent != null;

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
            <strong className="ccd-metric block text-[#00F0FF]">
              {data.utilizationPercent}%
            </strong>
          </FlashValue>
        </>
      ) : null}
    </div>
  );

  return (
    <TechTable
      title="Risk Console"
      subtitle={data.posture}
      testId="dashboard-cyber-risk-table"
      rows={rows}
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
          render: (row) => <StatusPill variant={row.status}>{row.status === "pass" ? "Ready" : row.status === "caution" ? "Guard" : "Blocked"}</StatusPill>,
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
          align: "right",
          render: (row) => row.action,
        },
      ]}
    />
  );
}
