import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { sma } from "@/lib/playbook/indicators";
import type {
  EarlyEntryBarMetrics,
  EarlyEntryReasonCode,
  EarlyEntryTradeState,
  EarlyEntryTransitionReasonCode,
} from "./types";
import {
  EXTENSION_RISK_BLOCK,
  EXTENSION_RISK_PILOT_MAX,
  PILOT_SCORE_THRESHOLD,
  WATCH_SCORE_THRESHOLD,
} from "./early-reversal-score";
import { isRiskRewardAcceptable } from "./risk-reward";
import { hadCloseBelowLevel, volumeMa20AtIndex } from "./bar-metrics";

export type StateMachineInput = {
  reasonCodes: readonly EarlyEntryReasonCode[];
  transitionReasonCodes: EarlyEntryTransitionReasonCode[];
  earlyReversalScore: number;
  extensionRiskScore: number;
  gate2Quality: string;
  metrics: EarlyEntryBarMetrics;
  /** Recent pilot-like signal within lookback */
  hadRecentPilotContext: boolean;
  structureBroken: boolean;
};

export function detectStructureBroken(
  close: number,
  invalidLevel: number | null
): boolean {
  return invalidLevel != null && close < invalidLevel;
}

export function detectAddZoneContext(params: {
  bars: readonly Gate2BarInput[];
  idx: number;
  ma20: number | null;
  ma50: number | null;
  ma20Series: readonly (number | undefined)[];
  ma10Series: readonly (number | undefined)[];
  volumeRatio: number | null;
  prevBar: Gate2BarInput | null;
  hadRecentPilotContext: boolean;
  riskRewardRatio: number | null;
  invalidLevel: number | null;
  close: number;
}): { eligible: boolean; transitionCodes: EarlyEntryTransitionReasonCode[] } {
  const codes: EarlyEntryTransitionReasonCode[] = [];
  const {
    ma20,
    ma50,
    ma20Series,
    ma10Series,
    volumeRatio,
    prevBar,
    hadRecentPilotContext,
    riskRewardRatio,
    invalidLevel,
    close,
    bars,
    idx,
  } = params;

  const trendConfirmed =
    ma20 != null &&
    ma50 != null &&
    close >= ma50 &&
    ma20 >= ma50;

  if (!hadRecentPilotContext && !trendConfirmed) {
    return { eligible: false, transitionCodes: codes };
  }

  if (trendConfirmed) codes.push("PILOT_TO_ADD_ZONE");

  const closes = bars.map((b) => b.close);
  const nearMa10 =
    ma10Series[idx] != null &&
    close >= ma10Series[idx]! * 0.98 &&
    close <= ma10Series[idx]! * 1.03;
  const nearMa20 =
    ma20 != null && close >= ma20 * 0.98 && close <= ma20 * 1.03;
  const pullbackToMa = nearMa10 || nearMa20;

  if (!pullbackToMa) {
    return { eligible: false, transitionCodes: codes };
  }

  if (volumeRatio != null && volumeRatio < 1.0) {
    codes.push("PULLBACK_VOLUME_CONTRACTS");
  } else {
    return { eligible: false, transitionCodes: codes };
  }

  if (invalidLevel != null && close >= invalidLevel) {
    codes.push("STRUCTURE_HELD");
  } else {
    codes.push("STRUCTURE_BROKEN");
    return { eligible: false, transitionCodes: codes };
  }

  const confirmation =
    (prevBar != null && close > prevBar.high) ||
    (ma20 != null && close >= ma20 && hadCloseBelowLevel(closes, ma20Series, idx - 1, 3));
  if (confirmation) {
    codes.push("ADD_CONFIRMATION_CANDLE");
  } else {
    return { eligible: false, transitionCodes: codes };
  }

  if (isRiskRewardAcceptable(riskRewardRatio)) {
    codes.push("ADD_RR_ACCEPTABLE");
  } else {
    codes.push("ADD_BAD_RR");
    return { eligible: false, transitionCodes: codes };
  }

  return { eligible: true, transitionCodes: codes };
}

export function hadRecentPilotContextInLookback(
  scoresBySession: readonly { score: number; state: EarlyEntryTradeState }[],
  lookback = 15
): boolean {
  const slice = scoresBySession.slice(-lookback);
  return slice.some(
    (s) => s.state === "PILOT_BUY" || s.score >= PILOT_SCORE_THRESHOLD
  );
}

export function deriveEarlyEntryTradeState(input: StateMachineInput): {
  state: EarlyEntryTradeState;
  transitionReasonCodes: EarlyEntryTransitionReasonCode[];
} {
  const {
    reasonCodes,
    transitionReasonCodes: addCodes,
    earlyReversalScore,
    extensionRiskScore,
    gate2Quality,
    metrics,
    hadRecentPilotContext,
    structureBroken,
  } = input;

  const transitionReasonCodes = [...addCodes];

  if (structureBroken) {
    transitionReasonCodes.push("STRUCTURE_BROKEN");
    return { state: "FAILED_SETUP", transitionReasonCodes };
  }

  if (extensionRiskScore >= EXTENSION_RISK_BLOCK) {
    transitionReasonCodes.push("CHASE_RISK");
    return { state: "EXTENDED_DO_NOT_CHASE", transitionReasonCodes };
  }
  if (reasonCodes.includes("EXTENDED_FROM_MA20") && extensionRiskScore >= 25) {
    transitionReasonCodes.push("CHASE_RISK");
    return { state: "EXTENDED_DO_NOT_CHASE", transitionReasonCodes };
  }

  if (gate2Quality === "A" || gate2Quality === "B") {
    return { state: "CONFIRMED_BUY", transitionReasonCodes };
  }

  const addEligible = addCodes.includes("ADD_RR_ACCEPTABLE");
  if (addEligible && addCodes.includes("ADD_CONFIRMATION_CANDLE")) {
    return { state: "ADD_ZONE", transitionReasonCodes };
  }

  const hasAcceptableRr =
    reasonCodes.includes("RR_ACCEPTABLE") && !reasonCodes.includes("BAD_RR");

  if (
    earlyReversalScore >= PILOT_SCORE_THRESHOLD &&
    hasAcceptableRr &&
    extensionRiskScore < EXTENSION_RISK_PILOT_MAX
  ) {
    return { state: "PILOT_BUY", transitionReasonCodes };
  }

  if (
    earlyReversalScore >= PILOT_SCORE_THRESHOLD &&
    reasonCodes.includes("BAD_RR")
  ) {
    return { state: "WATCH", transitionReasonCodes };
  }

  if (
    earlyReversalScore >= WATCH_SCORE_THRESHOLD ||
    reasonCodes.includes("PRIOR_COMPRESSION") ||
    reasonCodes.includes("RECLAIM_MA20") ||
    reasonCodes.includes("RECLAIM_MA50") ||
    hadRecentPilotContext ||
    (metrics.rs20SpreadPct != null && metrics.rs20SpreadPct > 0)
  ) {
    return { state: "WATCH", transitionReasonCodes };
  }

  if (reasonCodes.includes("BAD_RR") || reasonCodes.includes("WEAK_VOLUME")) {
    return { state: "BLOCKED", transitionReasonCodes };
  }

  return { state: "BLOCKED", transitionReasonCodes };
}

export function resolveEntryType(params: {
  reasonCodes: readonly EarlyEntryReasonCode[];
  proposedTradeState: EarlyEntryTradeState;
  gate2Quality: string;
}): string | null {
  const { reasonCodes, proposedTradeState, gate2Quality } = params;
  if (proposedTradeState === "ADD_ZONE") return "Pullback Add";
  if (reasonCodes.includes("RECLAIM_MA50") || reasonCodes.includes("RECLAIM_MA20")) {
    return "Early Reclaim";
  }
  if (reasonCodes.includes("POCKET_PIVOT")) return "Pocket Pivot";
  if (reasonCodes.includes("COMPRESSION_BREAKOUT")) return "Compression Breakout";
  if (gate2Quality === "A" || gate2Quality === "B") return "Breakout Pullback";
  return null;
}

export function resolveWhyNotPilotYet(params: {
  proposedTradeState: EarlyEntryTradeState;
  reasonCodes: readonly EarlyEntryReasonCode[];
  terminalCode: string | null;
  earlyReversalScore: number;
  rrRejectionReason: string | null;
}): string | null {
  const {
    proposedTradeState,
    reasonCodes,
    terminalCode,
    earlyReversalScore,
    rrRejectionReason,
  } = params;

  if (proposedTradeState === "PILOT_BUY" || proposedTradeState === "CONFIRMED_BUY") {
    return null;
  }
  if (proposedTradeState === "ADD_ZONE") {
    return null;
  }

  if (proposedTradeState === "EXTENDED_DO_NOT_CHASE") {
    return "Price extended from moving averages — do not chase";
  }

  if (proposedTradeState === "FAILED_SETUP") {
    return "Invalidation level violated — setup failed";
  }

  if (reasonCodes.includes("BAD_RR") && rrRejectionReason) {
    return rrRejectionReason;
  }
  if (reasonCodes.includes("BAD_RR")) {
    return "Risk/reward below pilot minimum (need R:R ≥ 2.0)";
  }

  if (reasonCodes.includes("WEAK_VOLUME")) {
    return "Volume below recent average";
  }

  if (terminalCode === "trend_below_ma50") {
    return "Below MA50 — early reclaim not fully confirmed";
  }

  if (proposedTradeState === "WATCH" && earlyReversalScore >= PILOT_SCORE_THRESHOLD) {
    return "Strong early structure but R:R or extension gate not cleared";
  }

  if (proposedTradeState === "WATCH") {
    return "Early reversal forming — wait for R:R and confirmation";
  }

  return "Structure or risk gates not ready for pilot entry";
}

export function resolveSuggestedPilotSizePct(
  state: EarlyEntryTradeState
): number | null {
  switch (state) {
    case "PILOT_BUY":
      return 25;
    case "ADD_ZONE":
      return 35;
    case "CONFIRMED_BUY":
      return 100;
    default:
      return null;
  }
}

export function resolveSizingNote(state: EarlyEntryTradeState): string | null {
  switch (state) {
    case "PILOT_BUY":
      return "Display-only research: pilot candidate ~25% — not validated for live trading";
    case "ADD_ZONE":
      return "Display-only: add ~35% after confirmation — not execution advice";
    case "CONFIRMED_BUY":
      return "Gate 2 qualified — full size only when health and regime agree";
    default:
      return null;
  }
}

export function tradeStateDisplayLabel(state: EarlyEntryTradeState): string {
  switch (state) {
    case "PILOT_BUY":
      return "Pilot Candidate";
    case "ADD_ZONE":
      return "Add Zone";
    case "CONFIRMED_BUY":
      return "Confirmed Buy";
    case "EXTENDED_DO_NOT_CHASE":
      return "Extended — Do Not Chase";
    case "FAILED_SETUP":
      return "Failed Setup";
    case "WATCH":
      return "Watch";
    case "BLOCKED":
      return "Blocked";
  }
}

/** Cautious UI copy — research lane, not a buy signal. */
export const EARLY_ENTRY_RESEARCH_DISCLAIMER =
  "Research signal only — display-only, needs forward validation. Not a buy recommendation.";

export function computeMa10Series(closes: readonly number[]): (number | undefined)[] {
  return sma([...closes], 10);
}
