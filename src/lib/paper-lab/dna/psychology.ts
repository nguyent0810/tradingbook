/**
 * Phase 2 — Deterministic psychology modulation.
 *
 * Scales the manager's base risk by its own recent equity-curve state
 * (drawdown, streaks, win rate, calibration). Pure and reproducible from the
 * ManagerStateSnapshot. Halt-on-deep-drawdown is enforced by the evaluator, not
 * here.
 */
import type { PsychologyDna } from "@/lib/paper-lab/dna/fund-manager-dna";
import type { ManagerStateSnapshot } from "@/lib/paper-lab/dna/manager-state";

export interface PsychologyModulation {
  mod: number;
  applied: string[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function computePsychologyModulation(
  state: ManagerStateSnapshot,
  psy: PsychologyDna
): PsychologyModulation {
  let mod = 1;
  const applied: string[] = [];

  if (state.currentDdPct >= psy.drawdownResponse.deRiskAtDdPct) {
    mod *= psy.drawdownResponse.riskCutFactor;
    applied.push("drawdown_derisk");
  }
  if (state.lossStreakLen >= psy.lossStreak.streakLen) {
    mod *= psy.lossStreak.riskCutFactor;
    applied.push("loss_streak_cut");
  }
  if (state.winStreakLen >= psy.winStreak.streakLen) {
    mod *= Math.min(psy.winStreak.riskBoostFactor, psy.winStreak.maxBoost);
    applied.push("win_streak_boost");
  }

  const confAdj =
    1 +
    psy.confidenceScaling.byWinRate * (state.winRate - 0.5) +
    psy.confidenceScaling.byCalibration * (0.25 - state.brierScore);
  mod *= confAdj;

  return { mod: clamp(mod, 0.25, 1.75), applied };
}
