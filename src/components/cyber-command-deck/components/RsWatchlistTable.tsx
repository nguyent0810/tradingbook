"use client";

import type { V3RsWatchlistPanel } from "../types";
import { mapRsTableRows } from "../lib/table-mappers";
import { StatusPill } from "./StatusPill";
import { TechTable } from "./TechTable";
import {
  EARLY_ENTRY_DAILY_CHECKLIST,
  EARLY_ENTRY_PAPER_COMMANDS,
  hasAnyEarlyEntry,
  isExtendedDoNotChase,
} from "@/lib/dashboard/early-entry-ui";
import { EARLY_ENTRY_RESEARCH_DISCLAIMER } from "@/lib/scanner/early-entry";

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

function earlyTone(state: string): "pass" | "caution" | "blocked" {
  if (isExtendedDoNotChase(state) || state.includes("Failed") || state.includes("Blocked")) {
    return "blocked";
  }
  if (state.includes("Pilot Candidate") || state.includes("Add Zone") || state.includes("Watch")) {
    return "caution";
  }
  return "caution";
}

export function RsWatchlistTable({ panel }: Props) {
  const rows = mapRsTableRows(panel.cards);
  const showBanner = panel.cards.length > 0 || panel.contextNote;
  const showEarlyEntry = hasAnyEarlyEntry(panel.cards);

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {showBanner ? (
        <p
          className="text-xs text-slate-500 m-0 px-1 leading-relaxed border-l-2 border-slate-600 pl-2"
          data-testid="dashboard-rs-context-banner"
        >
          {panel.contextNote}
        </p>
      ) : null}
      {showEarlyEntry ? (
        <div
          className="text-xs text-slate-500 m-0 px-1 leading-relaxed border-l-2 border-amber-600/60 pl-2"
          data-testid="dashboard-cyber-rs-early-research"
        >
          <p className="m-0 mb-1">{EARLY_ENTRY_RESEARCH_DISCLAIMER}</p>
          <ul className="m-0 mb-1 pl-4">
            {EARLY_ENTRY_DAILY_CHECKLIST.slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="m-0 font-mono text-[10px] text-slate-600">
            {EARLY_ENTRY_PAPER_COMMANDS.daily}
          </p>
        </div>
      ) : null}
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
            key: "rs20",
            header: "RS20",
            mono: true,
            align: "right",
            render: (row) => row.rs20,
          },
          {
            key: "rs50",
            header: "RS50",
            mono: true,
            align: "right",
            render: (row) => row.rs50,
          },
          {
            key: "strength",
            header: "RS strength",
            render: (row) => row.strengthLabel ?? "—",
          },
          {
            key: "setup",
            header: "Setup state",
            render: (row) => (
              <StatusPill variant={toneToVariant(row.stateTone)}>{row.setupState}</StatusPill>
            ),
          },
          ...(showEarlyEntry
            ? [
                {
                  key: "early",
                  header: "Early state",
                  render: (row: (typeof rows)[number]) =>
                    row.earlyEntry ? (
                      <StatusPill variant={earlyTone(row.earlyEntry.proposedTradeState)}>
                        {row.earlyEntry.proposedTradeState}
                      </StatusPill>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "score",
                  header: "Score",
                  mono: true,
                  align: "right" as const,
                  render: (row: (typeof rows)[number]) => row.earlyEntry?.earlyReversalScore ?? "—",
                },
                {
                  key: "rr",
                  header: "R:R",
                  mono: true,
                  align: "right" as const,
                  render: (row: (typeof rows)[number]) =>
                    row.earlyEntry?.estimatedRiskReward != null
                      ? `${row.earlyEntry.estimatedRiskReward.toFixed(2)}:1`
                      : "—",
                },
              ]
            : []),
          {
            key: "reason",
            header: "Reason",
            render: (row) => (
              <span className="text-slate-500 truncate max-w-[140px] inline-block" title={row.reason}>
                {row.reason}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
