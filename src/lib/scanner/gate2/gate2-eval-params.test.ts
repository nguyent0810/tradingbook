import { describe, expect, it } from "vitest";
import {
  GATE2_BREAKOUT_RECENCY_BARS,
  GATE2_DELTA_PULLBACK,
  GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  GATE2_MAX_PULLBACK_DEPTH_FRAC,
  GATE2_MIN_RISK_TO_STOP_FRAC,
  GATE2_VOL_RATIO_B,
} from "./constants";
import {
  gate2EvalParamsForSweep,
  GATE2_SWEEP_DIMENSIONS,
  PRODUCTION_GATE2_EVAL_PARAMS,
  scaleParamValue,
} from "./gate2-eval-params";

describe("PRODUCTION_GATE2_EVAL_PARAMS", () => {
  it("matches constants.ts exports", () => {
    expect(PRODUCTION_GATE2_EVAL_PARAMS.breakoutRecencyBars).toBe(
      GATE2_BREAKOUT_RECENCY_BARS
    );
    expect(PRODUCTION_GATE2_EVAL_PARAMS.deltaPullback).toBe(GATE2_DELTA_PULLBACK);
    expect(PRODUCTION_GATE2_EVAL_PARAMS.maxBreakoutExtensionFrac).toBe(
      GATE2_MAX_BREAKOUT_EXTENSION_FRAC
    );
    expect(PRODUCTION_GATE2_EVAL_PARAMS.maxPullbackDepthFrac).toBe(
      GATE2_MAX_PULLBACK_DEPTH_FRAC
    );
    expect(PRODUCTION_GATE2_EVAL_PARAMS.minRiskToStopFrac).toBe(
      GATE2_MIN_RISK_TO_STOP_FRAC
    );
    expect(PRODUCTION_GATE2_EVAL_PARAMS.volRatioB).toBe(GATE2_VOL_RATIO_B);
  });
});

describe("gate2EvalParamsForSweep", () => {
  it("changes only the swept parameter", () => {
    const dim = GATE2_SWEEP_DIMENSIONS.find((d) => d.key === "minVolumeRatioB")!;
    const p = gate2EvalParamsForSweep(dim, 0.8);
    expect(p.volRatioB).toBeCloseTo(GATE2_VOL_RATIO_B * 0.8, 6);
    expect(p.breakoutRecencyBars).toBe(PRODUCTION_GATE2_EVAL_PARAMS.breakoutRecencyBars);
  });

  it("rounds integer dimensions", () => {
    const dim = GATE2_SWEEP_DIMENSIONS.find((d) => d.key === "breakoutRecencyBars")!;
    expect(scaleParamValue(10, 0.8, true)).toBe(8);
    expect(scaleParamValue(10, 1.2, true)).toBe(12);
    const loosened = gate2EvalParamsForSweep(dim, 1.2);
    expect(loosened.breakoutRecencyBars).toBe(12);
  });
});
