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
