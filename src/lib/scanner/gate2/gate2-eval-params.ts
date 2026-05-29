import {
  GATE2_BREAKOUT_RECENCY_BARS,
  GATE2_DELTA_PULLBACK,
  GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  GATE2_MAX_PULLBACK_DEPTH_FRAC,
  GATE2_MIN_RISK_TO_STOP_FRAC,
  GATE2_RANGE_DAYS,
  GATE2_STOP_BUFFER_FRAC,
  GATE2_VOL_RATIO_A,
  GATE2_VOL_RATIO_B,
} from "./constants";

/**
 * Tunable Gate 2 template parameters (diagnostic sweeps).
 * Production scanner uses `PRODUCTION_GATE2_EVAL_PARAMS` via default argument.
 */
export type Gate2EvalParams = {
  rangeDays: number;
  breakoutRecencyBars: number;
  deltaPullback: number;
  maxBreakoutExtensionFrac: number;
  maxPullbackDepthFrac: number;
  minRiskToStopFrac: number;
  volRatioA: number;
  volRatioB: number;
  stopBufferFrac: number;
};

/** Mirrors `constants.ts` — default for `evaluateBreakoutPullbackCandidate`. */
export const PRODUCTION_GATE2_EVAL_PARAMS: Gate2EvalParams = {
  rangeDays: GATE2_RANGE_DAYS,
  breakoutRecencyBars: GATE2_BREAKOUT_RECENCY_BARS,
  deltaPullback: GATE2_DELTA_PULLBACK,
  maxBreakoutExtensionFrac: GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  maxPullbackDepthFrac: GATE2_MAX_PULLBACK_DEPTH_FRAC,
  minRiskToStopFrac: GATE2_MIN_RISK_TO_STOP_FRAC,
  volRatioA: GATE2_VOL_RATIO_A,
  volRatioB: GATE2_VOL_RATIO_B,
  stopBufferFrac: GATE2_STOP_BUFFER_FRAC,
};

export type Gate2SweepDimensionKey =
  | "breakoutRecencyBars"
  | "deltaPullback"
  | "maxBreakoutExtensionFrac"
  | "maxPullbackDepthFrac"
  | "minVolumeRatioB"
  | "minRiskToStopFrac";

export type Gate2SweepDimensionSpec = {
  key: Gate2SweepDimensionKey;
  /** Human label for reports. */
  label: string;
  paramKey: keyof Gate2EvalParams;
  /** When true, scaled values are rounded to nearest integer (min 1). */
  integer: boolean;
  /** Multipliers applied to production value (single-parameter sweep). */
  multipliers: readonly number[];
};

/** v1 single-parameter grid — diagnostic only. */
export const GATE2_SWEEP_DIMENSIONS: readonly Gate2SweepDimensionSpec[] = [
  {
    key: "breakoutRecencyBars",
    label: "GATE2_BREAKOUT_RECENCY_BARS",
    paramKey: "breakoutRecencyBars",
    integer: true,
    multipliers: [0.8, 1.0, 1.2],
  },
  {
    key: "deltaPullback",
    label: "GATE2_DELTA_PULLBACK",
    paramKey: "deltaPullback",
    integer: false,
    multipliers: [0.8, 1.0, 1.2],
  },
  {
    key: "maxBreakoutExtensionFrac",
    label: "GATE2_MAX_BREAKOUT_EXTENSION_FRAC",
    paramKey: "maxBreakoutExtensionFrac",
    integer: false,
    multipliers: [0.8, 1.0, 1.2],
  },
  {
    key: "maxPullbackDepthFrac",
    label: "GATE2_MAX_PULLBACK_DEPTH_FRAC",
    paramKey: "maxPullbackDepthFrac",
    integer: false,
    multipliers: [0.8, 1.0, 1.2],
  },
  {
    key: "minVolumeRatioB",
    label: "GATE2_VOL_RATIO_B (min volume)",
    paramKey: "volRatioB",
    integer: false,
    multipliers: [0.8, 1.0, 1.2],
  },
  {
    key: "minRiskToStopFrac",
    label: "GATE2_MIN_RISK_TO_STOP_FRAC",
    paramKey: "minRiskToStopFrac",
    integer: false,
    multipliers: [0.8, 1.0, 1.2],
  },
] as const;

export function scaleParamValue(
  productionValue: number,
  multiplier: number,
  integer: boolean
): number {
  const scaled = productionValue * multiplier;
  if (!integer) return scaled;
  return Math.max(1, Math.round(scaled));
}

/** Build eval params for one sweep arm (only one field differs from production). */
export function gate2EvalParamsForSweep(
  dimension: Gate2SweepDimensionSpec,
  multiplier: number
): Gate2EvalParams {
  const base = PRODUCTION_GATE2_EVAL_PARAMS[dimension.paramKey];
  const next = scaleParamValue(base, multiplier, dimension.integer);
  return {
    ...PRODUCTION_GATE2_EVAL_PARAMS,
    [dimension.paramKey]: next,
  };
}
