"use client";

import type { V3SetupCard } from "../types";
import { mapSetupTableRows } from "../lib/table-mappers";
import { StatusPill } from "./StatusPill";
import { TechTable } from "./TechTable";

type Props = {
  cards: V3SetupCard[];
};

function healthVariant(health: V3SetupCard["health"]): "pass" | "caution" | "blocked" {
  if (health === "Healthy") return "pass";
  if (health === "Warning") return "caution";
  return "blocked";
}

export function SetupTable({ cards }: Props) {
  const rows = mapSetupTableRows(cards);

  return (
    <TechTable
      title="Setup Intelligence"
      subtitle="Trigger · risk · action"
      testId="dashboard-cyber-setup-table"
      rows={rows}
      emptyMessage="No surfaced setups in the latest scan."
      columns={[
        {
          key: "symbol",
          header: "Symbol",
          mono: true,
          render: (row) => row.symbol,
        },
        {
          key: "tier",
          header: "Tier",
          render: (row) => row.tier,
        },
        {
          key: "type",
          header: "Setup",
          render: (row) => row.setupType,
        },
        {
          key: "entry",
          header: "Entry",
          mono: true,
          align: "right",
          render: (row) => row.entry,
        },
        {
          key: "stop",
          header: "Stop",
          mono: true,
          align: "right",
          render: (row) => row.stop,
        },
        {
          key: "action",
          header: "Action",
          render: (row) => row.actionState,
        },
        {
          key: "health",
          header: "Health",
          render: (row) => (
            <StatusPill variant={healthVariant(row.health)}>{row.health}</StatusPill>
          ),
        },
      ]}
    />
  );
}
