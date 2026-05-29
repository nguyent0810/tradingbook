export {
  collectGate2SetupCandidates,
  collectGate2SetupCandidatesWithStats,
  filterCandidatesByGate1Level,
} from "./collect-candidates";
export type { Gate2CollectionStats } from "./collect-candidates";
export {
  computeGate2RankScore,
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
  validateSwingTradeStructure,
} from "./breakout-pullback";
export {
  computeGate2RankBreakdown,
  formatGate2RankBreakdownLines,
  formatGate2RankSummary,
  type Gate2RankComponents,
} from "./rank-components";
export {
  buildGate2RankWithRsPreview,
  compareGate2RankOrdering,
  computeRelativeStrengthRankTerm,
  effectiveGate2RankScore,
  extractRs20SpreadPct,
  formatRankOrderingComparisonTable,
  formatRsRankPreviewLines,
  GATE2_RS_RANK_TERM_CAP,
  GATE2_RS_RANK_TERM_MULTIPLIER,
  isGate2RsRankTermEnabled,
  RS_RANK_PREVIEW_DISCLAIMER,
  type Gate2RankOrderingComparison,
  type Gate2RankWithRsPreview,
} from "./rs-rank-term";
export {
  buildRsRankEvidenceReport,
  formatRsRankEvidenceTable,
  aggregateForwardOutcomeGroup,
  RS_RANK_EVIDENCE_SCHEMA_VERSION,
  RS_RANK_ENABLE_MIN_AB_SAMPLES,
  type RsRankEvidenceReport,
  type RsRankReplayAbRow,
  type ForwardOutcomeGroupSummary,
} from "./rs-rank-evidence";
export {
  buildEvidenceReadinessReport,
  formatReadinessTable,
  aggregateLookbackReadiness,
  recommendLookbackForAbTarget,
  EVIDENCE_READINESS_SCHEMA_VERSION,
  DECISION_GRADE_AB_TARGET,
  type EvidenceReadinessReport,
  type LookbackWindowReadiness,
} from "./gate2-evidence-readiness";
export {
  GATE2_MIN_BARS_FOR_EVAL,
  GATE2_FORWARD_20_SESSIONS,
  hasSufficientForwardSessions,
  filterReplayRowsForForwardHorizon,
  maxEvaluationSessionWithForward,
  futureSessionsAfter,
} from "./gate2-replay-dataset";
export {
  GATE2_REJECTION_CODES,
  inferGate2RejectionCodeFromMessage,
  resolveTerminalClassification,
  type Gate2RejectionCode,
  type TerminalCategory,
} from "./rejection-codes";
export {
  GATE2_BREAKOUT_RECENCY_BARS,
  GATE2_DELTA_PULLBACK,
  GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  GATE2_MAX_PULLBACK_DEPTH_FRAC,
  GATE2_MIN_RISK_TO_STOP_FRAC,
  GATE2_RANK_DEPTH_CAP,
  GATE2_RANK_EXT_CAP,
  GATE2_RANK_MA_CAP,
  GATE2_RANK_VOL_CAP,
  GATE2_RANGE_DAYS,
  GATE2_STOP_BUFFER_FRAC,
  GATE2_VOL_RATIO_A,
  GATE2_VOL_RATIO_B,
} from "./constants";
export type {
  BreakoutPullbackEvaluation,
  Gate1Level,
  Gate2BarInput,
  Gate2Quality,
  SetupCandidate,
} from "./types";
