"use client";

import type { RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";

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
  if (state.includes("Extended") || state.includes("Failed") || state.includes("Blocked")) {
    return "danger";
  }
  return "neutral";
}

function formatPp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
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
        <p
          className="text-xs m-0 mb-3 leading-relaxed cd-rs-early-research-warning"
          style={{ color: "var(--cd-text-muted)" }}
          data-testid="command-deck-rs-early-research-warning"
        >
          Early-entry chips are research-only signals — not buy recommendations. Needs forward validation.
        </p>
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
              {showEarlyEntry ? <th className="cd-rs-table__col--hide-mobile">R:R</th> : null}
              <th className="cd-rs-table__col--hide-mobile">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
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
                  <td
                    className="cd-mono text-right tabular-nums cd-rs-table__col--hide-mobile"
                    title={row.earlyEntry?.whyNotPilotYet ?? undefined}
                  >
                    {row.earlyEntry?.estimatedRiskReward != null
                      ? `${row.earlyEntry.estimatedRiskReward.toFixed(2)}:1`
                      : "—"}
                  </td>
                ) : null}
                <td
                  className="text-xs cd-rs-table__col--hide-mobile"
                  style={{ color: "var(--cd-text-muted)", maxWidth: "12rem" }}
                  title={row.reason}
                >
                  {row.reason}
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
