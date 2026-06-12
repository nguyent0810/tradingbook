"use client";

import type { V3RsWatchlistPanel } from "../types";
import { mapRsTableRows } from "../lib/table-mappers";
import { StatusPill } from "./StatusPill";
import { TechTable } from "./TechTable";

type Props = {
  panel: V3RsWatchlistPanel;
};

function toneToVariant(
  tone: ReturnType<typeof mapRsTableRows>[number]["stateTone"]
): "pass" | "caution" | "blocked" {
  if (tone === "supportive") return "pass";
  if (tone === "not-ready") return "blocked";
  return "caution";
}

export function RsWatchlistTable({ panel }: Props) {
  const rows = mapRsTableRows(panel.cards);

  return (
    <TechTable
      title={panel.title}
      subtitle={panel.subtitle}
      testId="dashboard-cyber-rs-table"
      rows={rows}
      fillHeight
      emptyMessage={panel.emptyReason ?? "No relative strength watchlist entries."}
      columns={[
        {
          key: "symbol",
          header: "Symbol",
          mono: true,
          render: (row) => <span className="ccd-tech-table__symbol">{row.symbol}</span>,
        },
        {
          key: "state",
          header: "State",
          render: (row) => (
            <StatusPill variant={toneToVariant(row.stateTone)}>{row.stateBadge}</StatusPill>
          ),
        },
        {
          key: "strength",
          header: "Strength",
          render: (row) => row.strengthLabel ?? "—",
        },
        {
          key: "rs",
          header: "RS",
          mono: true,
          align: "right",
          render: (row) => row.rsValue,
        },
        {
          key: "blocker",
          header: "Blocker",
          render: (row) => (
            <span className="text-slate-500 truncate max-w-[120px] inline-block">
              {row.blockerLabel}
            </span>
          ),
        },
      ]}
    />
  );
}
