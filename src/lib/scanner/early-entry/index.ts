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
  applyCalibrationVariant,
  CALIBRATION_VARIANTS,
  isProductionPilotAcceptable,
} from "./calibration";
export type { CalibrationContext, CalibrationVariantId } from "./calibration";
export {
  buildPaperCalibrationMap,
  buildPaperSignal,
  emptyPaperStore,
  evaluatePaperAcceptance,
  isPaperWorthySignal,
  mergeSignalsIntoStore,
  PAPER_CALIBRATION_VARIANTS,
  PAPER_SIGNALS_PATH,
  paperSignalId,
  paperSuggestedAction,
  resolvePaperSignalOutcomes,
} from "./paper-signals";
export type {
  PaperAcceptanceResult,
  PaperCalibrationResult,
  PaperCalibrationVariantId,
  PaperSignalOutcomes,
  PaperSignalRecord,
  PaperSignalStore,
} from "./paper-signals";
export { EARLY_ENTRY_RESEARCH_DISCLAIMER } from "./state-machine";
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
