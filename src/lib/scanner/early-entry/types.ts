import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { InvalidLevelReason, TargetReason } from "./risk-reward";

/** Display-only trade states for the early-entry lane (separate from Gate 2). */
export type EarlyEntryTradeState =
  | "BLOCKED"
  | "WATCH"
  | "PILOT_BUY"
  | "ADD_ZONE"
  | "CONFIRMED_BUY"
  | "EXTENDED_DO_NOT_CHASE"
  | "FAILED_SETUP";

export type EarlyEntryReasonCode =
  | "RECLAIM_MA20"
  | "RECLAIM_MA50"
  | "VOLUME_EXPANSION"
  | "CLOSE_NEAR_HIGH"
  | "PRIOR_COMPRESSION"
  | "COMPRESSION_BREAKOUT"
  | "POCKET_PIVOT"
  | "STOP_NEARBY"
  | "RR_ACCEPTABLE"
  | "RS_IMPROVING"
  | "EXTENDED_FROM_MA20"
  | "WEAK_VOLUME"
  | "BAD_RR"
  | "NO_CONFIRMATION_CANDLE";

export type EarlyEntryTransitionReasonCode =
  | "PILOT_TO_ADD_ZONE"
  | "ADD_CONFIRMATION_CANDLE"
  | "PULLBACK_VOLUME_CONTRACTS"
  | "STRUCTURE_HELD"
  | "STRUCTURE_BROKEN"
  | "ADD_RR_ACCEPTABLE"
  | "ADD_BAD_RR"
  | "CHASE_RISK";

export const EARLY_ENTRY_REASON_CODES: readonly EarlyEntryReasonCode[] = [
  "RECLAIM_MA20",
  "RECLAIM_MA50",
  "VOLUME_EXPANSION",
  "CLOSE_NEAR_HIGH",
  "PRIOR_COMPRESSION",
  "COMPRESSION_BREAKOUT",
  "POCKET_PIVOT",
  "STOP_NEARBY",
  "RR_ACCEPTABLE",
  "RS_IMPROVING",
  "EXTENDED_FROM_MA20",
  "WEAK_VOLUME",
  "BAD_RR",
  "NO_CONFIRMATION_CANDLE",
] as const;

export type EarlyEntryBarMetrics = {
  sessionDate: string;
  close: number;
  ma20: number | null;
  ma50: number | null;
  volume: number;
  volumeMa20: number | null;
  volumeRatio: number | null;
  rs20SpreadPct: number | null;
  rs20Delta3d: number | null;
  bodyPct: number | null;
  atr14: number | null;
  closeNearHighPct: number | null;
  distFromMa20Pct: number | null;
  distFromMa50Pct: number | null;
  stopLevel: number | null;
  stopDistancePct: number | null;
  rewardTarget: number | null;
  targetPrice: number | null;
  targetReason: TargetReason | null;
  invalidLevelReason: InvalidLevelReason | null;
  riskRewardRatio: number | null;
  estimatedRewardPct: number | null;
  priorCompression: boolean;
  reclaimMa20: boolean;
  reclaimMa50: boolean;
};

/** Display-only metadata when EARLY_ENTRY_V1_ENABLED — never affects Gate 2 or trade decisions. */
export type EarlyEntryDisplayMetadata = {
  earlyReversalScore: number;
  proposedTradeState: EarlyEntryTradeState;
  entryType: string | null;
  reasonCodes: EarlyEntryReasonCode[];
  transitionReasonCodes: EarlyEntryTransitionReasonCode[];
  invalidLevel: number | null;
  invalidLevelReason: InvalidLevelReason | null;
  stopDistancePct: number | null;
  targetPrice: number | null;
  targetReason: TargetReason | null;
  estimatedRewardPct: number | null;
  estimatedRiskReward: number | null;
  suggestedPilotSizePct: number | null;
  sizingNote: string | null;
  whyNotPilotYet: string | null;
  rrRejectionReason: string | null;
};

export type EarlyEntryEvaluationResult = EarlyEntryDisplayMetadata & {
  metrics: EarlyEntryBarMetrics;
  extensionRiskScore: number;
  riskRewardScore: number;
};

export type ReasonDetectionInput = {
  bar: Gate2BarInput;
  prevBar: Gate2BarInput | null;
  bars: readonly Gate2BarInput[];
  idx: number;
  ma20: number | null;
  ma50: number | null;
  ma20Series: readonly (number | undefined)[];
  volumeRatio: number | null;
  atr14: number | null;
  bodyPct: number | null;
  closeNearHighPct: number | null;
  distFromMa20Pct: number | null;
  distFromMa50Pct: number | null;
  priorCompression: boolean;
  pocketPivot: boolean;
  riskRewardRatio: number | null;
  rs20Delta3d: number | null;
  reclaimMa20: boolean;
  reclaimMa50: boolean;
};
