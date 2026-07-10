"use client";

import type { V3RiskConsole } from "@/lib/dashboard/dashboard-v3-view-model";
import { mapTradeGateRows } from "@/components/cyber-command-deck/lib/table-mappers";
import { Card, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  risk: V3RiskConsole;
};

type GateTone = "danger" | "warning" | "success" | "neutral";
type GateRow = ReturnType<typeof mapTradeGateRows>[number];

/** Per-row tone — same buckets as countByStatus so dots/badges/counts agree. */
function rowTone(row: GateRow): GateTone {
  const label = row.statusLabel.toLowerCase();
  if (label.includes("block")) return "danger";
  if (label.includes("ready") || row.action === "Go") return "success";
  if (label.includes("wait") || label.includes("setup")) return "warning";
  return "warning";
}

function countByStatus(rows: GateRow[]) {
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

/** Overall gate verdict — answers "are we allowed to trade?" */
function gateVerdict(counts: { blocked: number; waiting: number; ready: number }): {
  label: string;
  tone: GateTone;
} {
  if (counts.blocked > 0) return { label: "Entries blocked", tone: "danger" };
  if (counts.ready > 0) return { label: "Entries allowed", tone: "success" };
  return { label: "Awaiting setup", tone: "warning" };
}

const TONE_ORDER: Record<GateTone, number> = { danger: 0, warning: 1, success: 2, neutral: 3 };

function Count({ label, value, tone }: { label: string; value: number; tone: GateTone }) {
  return (
    <div className={`cd-count cd-count--${tone}`}>
      <span className="cd-mono cd-count__value">{value}</span>
      <span className="cd-count__label">{label}</span>
    </div>
  );
}

export function TradeGateSummaryCard({ risk }: Props) {
  const rows = mapTradeGateRows(risk);
  const counts = countByStatus(rows);
  const verdict = gateVerdict(counts);
  const ordered = [...rows].sort((a, b) => TONE_ORDER[rowTone(a)] - TONE_ORDER[rowTone(b)]);

  return (
    <Card className="p-3 cd-trade-gate" data-testid="dashboard-cyber-trade-gate">
      <CardHeader
        title="Entry Gate"
        subtitle={risk.tradeGate.subtitle}
        action={
          <span className="cd-trade-gate__open">
            <span className="cd-trade-gate__open-label">Open</span>
            <span className="cd-mono cd-trade-gate__open-count">{risk.openPositions}</span>
          </span>
        }
      />

      {/* Verdict — allowed to trade? */}
      <div className={`cd-trade-gate__verdict cd-trade-gate__verdict--${verdict.tone}`}>
        <span className="cd-trade-gate__verdict-dot" aria-hidden />
        {verdict.label}
      </div>

      {/* Counts */}
      <div className="cd-trade-gate__counts" role="group" aria-label="Gate status counts">
        <Count label="Blocked" value={counts.blocked} tone="danger" />
        <Count label="Waiting" value={counts.waiting} tone="warning" />
        <Count label="Ready" value={counts.ready} tone="success" />
      </div>

      {/* Compact checklist — blocked first */}
      {rows.length > 0 ? (
        <ul className="cd-trade-gate__list" aria-label="Trade gate rules">
          {ordered.map((row) => {
            const tone = rowTone(row);
            return (
              <li key={row.id} className="cd-trade-gate__item">
                <span className={`cd-trade-gate__dot cd-trade-gate__dot--${tone}`} aria-hidden />
                <span className="cd-trade-gate__rule" title={row.rule}>
                  {row.rule}
                </span>
                <Badge tone={tone} size="compact">
                  {row.statusLabel}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cd-trade-gate__empty">{risk.capitalProtectionState}</p>
      )}

      {rows.length > 0 && risk.capitalProtectionState ? (
        <p className="cd-trade-gate__footer">{risk.capitalProtectionState}</p>
      ) : null}
    </Card>
  );
}
