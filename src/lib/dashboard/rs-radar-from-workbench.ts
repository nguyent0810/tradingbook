import type { V3DecisionMode } from "./dashboard-v3-view-model";
import type { RadarNode, RadarNodeClassification, RelativeStrengthRow } from "@/components/command-deck/types";
import { isExtendedDoNotChase } from "./early-entry-ui";
import {
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  workbenchActionLabel,
} from "./rs-status-display";

function sparklineFromReadinessRisk(readiness: number, risk: number): number[] {
  const base = Math.max(8, Math.min(92, readiness));
  const caution = Math.max(6, Math.min(34, Math.round(risk / 3)));
  return [
    Math.max(5, base - caution),
    Math.max(5, base - Math.round(caution * 0.6)),
    Math.max(5, base - Math.round(caution * 0.35)),
    Math.max(5, base - Math.round(caution * 0.2)),
    Math.max(5, base),
  ];
}

function readinessFromRow(row: RelativeStrengthRow): number {
  if (row.setupReadinessScore != null) {
    return Math.max(10, Math.min(95, row.setupReadinessScore));
  }
  if (row.earlyEntry?.earlyReversalScore != null) {
    return Math.max(10, Math.min(95, row.earlyEntry.earlyReversalScore));
  }
  return Math.max(15, Math.min(90, 50 + row.rs20 * 2.5));
}

function riskFromRow(row: RelativeStrengthRow): number {
  if (row.earlyEntry && isExtendedDoNotChase(row.earlyEntry.proposedTradeState)) {
    return 88;
  }
  if (row.setupState.startsWith("Blocked")) return 72;
  if (row.earlyEntry?.proposedTradeState.includes("Pilot Candidate")) return 42;
  return 52;
}

function classificationFromRow(
  row: RelativeStrengthRow,
  decisionMode: V3DecisionMode
): RadarNodeClassification {
  if (row.earlyEntry && isExtendedDoNotChase(row.earlyEntry.proposedTradeState)) {
    return "avoid";
  }
  if (row.earlyEntry?.proposedTradeState.includes("Pilot Candidate")) {
    return decisionMode === "TRADE" ? "actionable" : "watch";
  }
  if (row.setupState.startsWith("Blocked")) return "watch";
  return "watch";
}

function tierFromRow(row: RelativeStrengthRow): string {
  if (row.earlyEntry) {
    return friendlyEarlyStateLabel(row.earlyEntry.proposedTradeState);
  }
  return friendlySetupStateLabel(row.setupState);
}

/** Build radar nodes from RS Workbench rows — same symbols as the table, no sample placeholders. */
export function buildRadarNodesFromWorkbenchRows(
  rows: readonly RelativeStrengthRow[],
  decisionMode: V3DecisionMode = "PROTECT CAPITAL"
): RadarNode[] {
  return rows.map((row) => {
    const readiness = readinessFromRow(row);
    const risk = riskFromRow(row);
    return {
      symbol: row.symbol,
      readiness,
      risk,
      classification: classificationFromRow(row, decisionMode),
      tier: tierFromRow(row),
      reason: `${friendlySetupStateLabel(row.setupState)} · ${workbenchActionLabel(row)}`,
      sparkline: sparklineFromReadinessRisk(readiness, risk),
    };
  });
}

export type WorkbenchRadarSummary = {
  pilotResearch: number;
  watch: number;
  tooExtended: number;
  bestRs: string[];
};

export function summarizeWorkbenchRadar(rows: readonly RelativeStrengthRow[]): WorkbenchRadarSummary {
  let pilotResearch = 0;
  let watch = 0;
  let tooExtended = 0;

  for (const row of rows) {
    if (row.earlyEntry && isExtendedDoNotChase(row.earlyEntry.proposedTradeState)) {
      tooExtended += 1;
    } else if (row.earlyEntry?.proposedTradeState.includes("Pilot Candidate")) {
      pilotResearch += 1;
    } else {
      watch += 1;
    }
  }

  const bestRs = [...rows]
    .sort((a, b) => b.rs20 - a.rs20)
    .slice(0, 3)
    .map((r) => r.symbol);

  return { pilotResearch, watch, tooExtended, bestRs };
}
