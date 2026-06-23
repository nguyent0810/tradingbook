/**
 * Audit replay CLI — consumes production early-entry module.
 */
export {
  evaluateEarlyEntrySession,
  evaluateEarlyEntrySession as evaluateEarlyReversalSession,
  type EarlyEntryEvaluationResult as EarlyReversalSessionResult,
  type EarlyEntryBarMetrics as EarlyReversalBarMetrics,
  type EarlyEntryReasonCode as EarlyEntryReasonCode,
  type EarlyEntryTradeState,
  EARLY_ENTRY_REASON_CODES as EARLY_ENTRY_REASON_CODES,
} from "../../src/lib/scanner/early-entry";

export type ProposedTradeState =
  import("../../src/lib/scanner/early-entry").EarlyEntryTradeState;

import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import type { EarlyEntryEvaluationResult } from "../../src/lib/scanner/early-entry";
import { buildSetupStateLabel } from "../../src/lib/dashboard/rs-setup-labels";
import { tradeStateDisplayLabel } from "../../src/lib/scanner/early-entry";

export type ReplayFixture = {
  symbol: string;
  generatedAt: string;
  source: string;
  stockBars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  indexBars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

export function parseFixtureBars(rows: ReplayFixture["stockBars"]): Gate2BarInput[] {
  return rows.map((r) => ({
    date: new Date(`${r.date}T00:00:00.000Z`),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

export function findEventSessions(
  results: EarlyEntryEvaluationResult[]
): EarlyEntryEvaluationResult[] {
  return results.filter(
    (r) =>
      r.reasonCodes.includes("RECLAIM_MA20") ||
      r.reasonCodes.includes("RECLAIM_MA50") ||
      r.reasonCodes.includes("COMPRESSION_BREAKOUT") ||
      r.reasonCodes.includes("POCKET_PIVOT") ||
      r.proposedTradeState === "PILOT_BUY"
  );
}

export function enrichWithCurrentLabels(
  result: EarlyEntryEvaluationResult
): EarlyEntryEvaluationResult & {
  currentSetupState: string;
  gate2Quality: string;
  suggestedAction: string;
  whyNotYet: string | null;
  pilotSizePct: number | null;
} {
  return {
    ...result,
    currentSetupState: buildSetupStateLabel(result.reasonCodes[0] ?? null),
    gate2Quality: "INVALID",
    suggestedAction: result.proposedTradeState === "PILOT_BUY"
      ? "Consider pilot entry (20–30% intended size)"
      : "Monitor — no action",
    whyNotYet: result.whyNotPilotYet,
    pilotSizePct: result.suggestedPilotSizePct,
  };
}

export { tradeStateDisplayLabel };
