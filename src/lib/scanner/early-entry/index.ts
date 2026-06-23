export { isEarlyEntryV1Enabled } from "./feature-flag";
export type {
  EarlyEntryBarMetrics,
  EarlyEntryDisplayMetadata,
  EarlyEntryEvaluationResult,
  EarlyEntryReasonCode,
  EarlyEntryTradeState,
  EarlyEntryTransitionReasonCode,
} from "./types";
export { EARLY_ENTRY_REASON_CODES } from "./types";
export {
  detectCloseNearHigh,
  detectCompressionBreakout,
  detectEarlyEntryReasonCodes,
  detectExtendedFromMa20,
  detectNoConfirmationCandle,
  detectPocketPivot,
  detectPriorCompression,
  detectReclaimMa20,
  detectReclaimMa50,
  detectRiskRewardAcceptable,
  detectRiskRewardBad,
  detectRsImproving,
  detectStopNearbyFromDistance,
  detectVolumeExpansion,
  detectWeakVolume,
} from "./reason-codes";
export {
  computeEarlyReversalScore,
  computeExtensionRiskScore,
  computeRiskRewardScore,
  PILOT_SCORE_THRESHOLD,
} from "./early-reversal-score";
export {
  collectResistanceCandidates,
  collectStopCandidates,
  computeEarlyEntryRiskReward,
  isRiskRewardAcceptable,
  isRiskRewardBad,
  RR_ACCEPTABLE,
  selectRewardTarget,
  selectStopLevel,
} from "./risk-reward";
export type { InvalidLevelReason, TargetReason } from "./risk-reward";
export {
  deriveEarlyEntryTradeState,
  detectAddZoneContext,
  detectStructureBroken,
  resolveWhyNotPilotYet,
  resolveSizingNote,
  tradeStateDisplayLabel,
} from "./state-machine";
export {
  evaluateEarlyEntryForSymbol,
  evaluateEarlyEntrySession,
  toEarlyEntryDisplayMetadata,
} from "./evaluate-early-entry";
