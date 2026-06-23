"use client";

import type { RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  EARLY_ENTRY_DAILY_CHECKLIST,
  EARLY_ENTRY_PAPER_COMMANDS,
  isExtendedDoNotChase,
} from "@/lib/dashboard/early-entry-ui";
import { EARLY_ENTRY_RESEARCH_DISCLAIMER } from "@/lib/scanner/early-entry";

type Props = {
  rows: RelativeStrengthRow[];
  contextNote?: string;
};

function setupStateTone(setupState: string): "success" | "warning" | "danger" | "neutral" {
  if (setupState.startsWith("Blocked")) return "danger";
  if (setupState.startsWith("Watch")) return "warning";
  return "neutral";
}

function earlyEntryTone(state: string): "success" | "warning" | "danger" | "neutral" {
  if (state.includes("Confirmed")) return "success";
  if (state.includes("Pilot Candidate") || state.includes("Add Zone") || state.includes("Watch")) {
    return "warning";
  }
  if (isExtendedDoNotChase(state) || state.includes("Failed") || state.includes("Blocked")) {
    return "danger";
  }
  return "neutral";
}

function formatPp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function RelativeStrengthTable({ rows, contextNote }: Props) {
  const showEarlyEntry = rows.some((row) => row.earlyEntry);

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

      {showEarlyEntry ? (
        <div
          className="cd-rs-early-research mb-3"
          data-testid="command-deck-rs-early-research-section"
        >
          <p
            className="text-xs m-0 mb-2 leading-relaxed cd-rs-early-research-warning"
            style={{ color: "var(--cd-text-muted)" }}
            data-testid="command-deck-rs-early-research-warning"
          >
            {EARLY_ENTRY_RESEARCH_DISCLAIMER}
          </p>
          <ul
            className="text-xs m-0 mb-2 pl-4 leading-relaxed"
            style={{ color: "var(--cd-text-dim)" }}
            data-testid="command-deck-rs-daily-checklist"
          >
            {EARLY_ENTRY_DAILY_CHECKLIST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p
            className="text-xs m-0 leading-relaxed cd-mono"
            style={{ color: "var(--cd-text-dim)" }}
            data-testid="command-deck-rs-paper-commands"
          >
            Daily: {EARLY_ENTRY_PAPER_COMMANDS.daily} · Weekly:{" "}
            {EARLY_ENTRY_PAPER_COMMANDS.weeklyValidate} · {EARLY_ENTRY_PAPER_COMMANDS.weeklySummary}
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="cd-rs-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right cd-rs-table__col--hide-mobile">RS20</th>
              <th className="text-right cd-rs-table__col--hide-mobile">RS50</th>
              <th>RS strength</th>
              <th>Setup state</th>
              {showEarlyEntry ? <th className="cd-rs-table__col--hide-mobile">Early state</th> : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Score</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="cd-rs-table__col--hide-mobile">Entry type</th>
              ) : null}
              {showEarlyEntry ? <th className="text-right cd-rs-table__col--hide-mobile">R:R</th> : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Target</th>
              ) : null}
              {showEarlyEntry ? (
                <th className="text-right cd-rs-table__col--hide-mobile">Invalid</th>
              ) : null}
              <th className="cd-rs-table__col--hide-mobile">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extended =
                row.earlyEntry != null &&
                isExtendedDoNotChase(row.earlyEntry.proposedTradeState);
              return (
                <tr
                  key={row.symbol}
                  className={extended ? "cd-rs-table__row--extended" : undefined}
                >
                  <td className="cd-rs-table__symbol cd-mono">{row.symbol}</td>
                  <td
                    className={`cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile ${row.rs20 >= 0 ? "cd-tone-success" : "cd-tone-danger"}`}
                  >
                    {formatPp(row.rs20)}
                  </td>
                  <td
                    className={`cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile ${row.rs50 != null && row.rs50 >= 0 ? "cd-tone-success" : row.rs50 != null ? "cd-tone-danger" : ""}`}
                  >
                    {formatPp(row.rs50)}
                  </td>
                  <td className="cd-mono tabular-nums">{row.rsStrength}</td>
                  <td>
                    <Badge tone={setupStateTone(row.setupState)} pulse={row.setupState.startsWith("Watch")}>
                      {row.setupState}
                    </Badge>
                  </td>
                  {showEarlyEntry ? (
                    <td className="cd-rs-table__col--hide-mobile">
                      {row.earlyEntry ? (
                        <Badge tone={earlyEntryTone(row.earlyEntry.proposedTradeState)}>
                          {row.earlyEntry.proposedTradeState}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {showEarlyEntry ? (
                    <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                      {row.earlyEntry?.earlyReversalScore ?? "—"}
                    </td>
                  ) : null}
                  {showEarlyEntry ? (
                    <td
                      className="text-xs cd-rs-table__col--hide-mobile"
                      style={{ color: "var(--cd-text-muted)" }}
                    >
                      {row.earlyEntry?.entryType ?? "—"}
                    </td>
                  ) : null}
                  {showEarlyEntry ? (
                    <td
                      className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile"
                      title={row.earlyEntry?.whyNotPilotYet ?? undefined}
                    >
                      {row.earlyEntry?.estimatedRiskReward != null
                        ? `${row.earlyEntry.estimatedRiskReward.toFixed(2)}:1`
                        : "—"}
                    </td>
                  ) : null}
                  {showEarlyEntry ? (
                    <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                      {row.earlyEntry?.targetPrice?.toFixed(2) ?? "—"}
                    </td>
                  ) : null}
                  {showEarlyEntry ? (
                    <td className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile">
                      {row.earlyEntry?.invalidLevel?.toFixed(2) ?? "—"}
                    </td>
                  ) : null}
                  <td
                    className="text-xs cd-rs-table__col--hide-mobile"
                    style={{ color: "var(--cd-text-muted)", maxWidth: "12rem" }}
                    title={
                      row.earlyEntry?.whyNotPilotYet
                        ? `${row.reason} · ${row.earlyEntry.whyNotPilotYet}`
                        : row.reason
                    }
                  >
                    {row.reason}
                  </td>
                </tr>
              );
            })}
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
