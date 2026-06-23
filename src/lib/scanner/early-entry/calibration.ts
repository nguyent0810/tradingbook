import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import type { EarlyEntryEvaluationResult, EarlyEntryTradeState } from "./types";
import { RR_ACCEPTABLE } from "./risk-reward";

/** Experimental calibration variants — audit/backtest only; never production defaults. */
export type CalibrationVariantId =
  | "baseline"
  | "rr_min_2_5"
  | "rs_improving_3d"
  | "next_day_confirmation"
  | "next_day_confirmation_candidate"
  | "close_top_quartile"
  | "volume_ratio_1_5"
  | "block_dist_ma20_gt_4"
  | "block_weak_gate1"
  | "two_day_follow_through"
  | "demote_weak_regime"
  | "rr_min_2_5_plus_demote_weak_regime"
  | "combined_tight";

export type Gate1RegimeLevel = "PASS" | "WARNING" | "FAIL";

export type CalibrationContext = {
  gate1Level: Gate1RegimeLevel | null;
  gate1Trend: string | null;
  sector: string | null;
  /** Next session bar when available (backtest). */
  nextBar: Gate2BarInput | null;
  nextNextBar: Gate2BarInput | null;
  indexRs20Positive: boolean | null;
};

export type CalibratedStateResult = {
  state: EarlyEntryTradeState;
  demotedFromPilot: boolean;
  calibrationNote: string | null;
};

export const CALIBRATION_VARIANTS: readonly CalibrationVariantId[] = [
  "baseline",
  "rr_min_2_5",
  "rs_improving_3d",
  "next_day_confirmation",
  "close_top_quartile",
  "volume_ratio_1_5",
  "block_dist_ma20_gt_4",
  "block_weak_gate1",
  "two_day_follow_through",
  "demote_weak_regime",
  "combined_tight",
] as const;

function demotePilot(
  state: EarlyEntryTradeState,
  note: string
): CalibratedStateResult {
  if (state !== "PILOT_BUY") {
    return { state, demotedFromPilot: false, calibrationNote: null };
  }
  return { state: "WATCH", demotedFromPilot: true, calibrationNote: note };
}

export function applyCalibrationVariant(
  evaluation: EarlyEntryEvaluationResult,
  variant: CalibrationVariantId,
  ctx: CalibrationContext
): CalibratedStateResult {
  const base = evaluation.proposedTradeState;
  if (variant === "baseline") {
    return { state: base, demotedFromPilot: false, calibrationNote: null };
  }

  const m = evaluation.metrics;
  const codes = evaluation.reasonCodes;

  if (variant === "rr_min_2_5") {
    if (base === "PILOT_BUY" && (m.riskRewardRatio ?? 0) < 2.5) {
      return demotePilot(base, "R:R below experimental 2.5 floor");
    }
  }

  if (variant === "rs_improving_3d") {
    if (base === "PILOT_BUY" && (m.rs20Delta3d ?? 0) < 1) {
      return demotePilot(base, "RS not improving over 3 sessions");
    }
  }

  if (variant === "next_day_confirmation") {
    if (base === "PILOT_BUY") {
      const nb = ctx.nextBar;
      if (!nb || nb.close <= m.close) {
        return demotePilot(base, "No next-day close confirmation");
      }
    }
  }

  if (variant === "close_top_quartile") {
    if (base === "PILOT_BUY" && (m.closeNearHighPct ?? 0) < 0.75) {
      return demotePilot(base, "Close not in top 25% of daily range");
    }
  }

  if (variant === "volume_ratio_1_5") {
    if (base === "PILOT_BUY" && (m.volumeRatio ?? 0) < 1.5) {
      return demotePilot(base, "Volume ratio below 1.5x");
    }
  }

  if (variant === "block_dist_ma20_gt_4") {
    if (base === "PILOT_BUY" && (m.distFromMa20Pct ?? 0) > 4) {
      return demotePilot(base, "Extended more than 4% above MA20");
    }
  }

  if (variant === "block_weak_gate1") {
    if (base === "PILOT_BUY" && ctx.gate1Level === "FAIL") {
      return demotePilot(base, "Gate 1 market regime FAIL");
    }
  }

  if (variant === "two_day_follow_through") {
    if (base === "PILOT_BUY") {
      const n1 = ctx.nextBar;
      const n2 = ctx.nextNextBar;
      if (!n1 || !n2 || n2.close <= m.close) {
        return demotePilot(base, "No 2-day follow-through");
      }
    }
  }

  if (variant === "demote_weak_regime") {
    if (base === "PILOT_BUY" && ctx.gate1Level !== "PASS") {
      return demotePilot(base, "Gate 1 not PASS");
    }
  }

  if (variant === "next_day_confirmation_candidate") {
    if (base === "PILOT_BUY") {
      const nb = ctx.nextBar;
      if (!nb || nb.close <= m.close) {
        return demotePilot(base, "No next-day close confirmation");
      }
    }
    return { state: base, demotedFromPilot: false, calibrationNote: null };
  }

  if (variant === "rr_min_2_5_plus_demote_weak_regime") {
    const afterRr = applyCalibrationVariant(evaluation, "rr_min_2_5", ctx);
    const stacked: EarlyEntryEvaluationResult = {
      ...evaluation,
      proposedTradeState: afterRr.state,
    };
    return applyCalibrationVariant(stacked, "demote_weak_regime", ctx);
  }

  if (variant === "combined_tight") {
    let state = base;
    const checks: Array<() => CalibratedStateResult | null> = [
      () =>
        state === "PILOT_BUY" && (m.riskRewardRatio ?? 0) < 2.5
          ? demotePilot(state, "combined: R:R < 2.5")
          : null,
      () =>
        state === "PILOT_BUY" && !codes.includes("RS_IMPROVING")
          ? demotePilot(state, "combined: RS not improving")
          : null,
      () =>
        state === "PILOT_BUY" && (m.volumeRatio ?? 0) < 1.3
          ? demotePilot(state, "combined: weak volume")
          : null,
      () =>
        state === "PILOT_BUY" && ctx.gate1Level !== "PASS"
          ? demotePilot(state, "combined: Gate 1 not PASS")
          : null,
      () =>
        state === "PILOT_BUY" && (m.distFromMa20Pct ?? 0) > 4
          ? demotePilot(state, "combined: >4% above MA20")
          : null,
    ];
    for (const check of checks) {
      const hit = check();
      if (hit) return hit;
    }
  }

  return { state: base, demotedFromPilot: false, calibrationNote: null };
}

export function isProductionPilotAcceptable(
  evaluation: Pick<EarlyEntryEvaluationResult, "proposedTradeState" | "metrics">
): boolean {
  return (
    evaluation.proposedTradeState === "PILOT_BUY" &&
    (evaluation.metrics.riskRewardRatio ?? 0) >= RR_ACCEPTABLE
  );
}
