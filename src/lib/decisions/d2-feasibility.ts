/**
 * D2 — trade feasibility. SHADOW ONLY.
 *
 * Answers only: is this structural trade executable under constraints that exist
 * today? It never changes the structural stop and never decides validity — the
 * coupling at `breakout-pullback.ts:132-135`, where a too-tight stop makes a
 * sound pattern INVALID, is precisely what this separation exists to sever.
 *
 * `NOT_FEASIBLE_CAPACITY` is absent from the verdict type by construction.
 * Whether a budget affords a lot belongs to D4; keeping it here is what made V1's
 * feasibility depend on the order candidates were processed in.
 *
 * D2 is a pure function of ONE candidate. Evaluating a set in any order gives
 * identical verdicts (invariant I11).
 */
import { computeMinStopFrac } from "@/lib/scanner/stop-feasibility";
import { TRADABILITY_MIN_AVG_VALUE_VND_20 } from "@/lib/scanner/tradability-constants";
import type { FeasibilityInput, FeasibilityOutput } from "./contracts";

export function decideFeasibility(input: FeasibilityInput): FeasibilityOutput {
  const { entryPriceKVnd, structuralStopKVnd, atrKVnd, board, avgDailyValueVnd } = input;

  if (!(entryPriceKVnd > 0) || !(structuralStopKVnd > 0) || structuralStopKVnd >= entryPriceKVnd) {
    return {
      verdict: "UNKNOWN_INPUT",
      riskFracOfEntry: null,
      minStopFrac: null,
      bindingFloor: "none",
      reasons: ["entry_or_stop_unusable"],
    };
  }

  // Reuses the production floor unchanged: max(tick, fee, volatility), with no
  // coefficient chosen or moved here.
  const floor = computeMinStopFrac({ entryPrice: entryPriceKVnd, atr: atrKVnd, board });
  const riskFrac = (entryPriceKVnd - structuralStopKVnd) / entryPriceKVnd;

  if (riskFrac < floor.minStopFrac) {
    return {
      verdict: "NOT_FEASIBLE_NOISE",
      riskFracOfEntry: riskFrac,
      minStopFrac: floor.minStopFrac,
      bindingFloor: floor.binding,
      reasons: [`stop_inside_${floor.binding}_floor`],
    };
  }

  if (avgDailyValueVnd != null && avgDailyValueVnd < TRADABILITY_MIN_AVG_VALUE_VND_20) {
    return {
      verdict: "NOT_FEASIBLE_LIQUIDITY",
      riskFracOfEntry: riskFrac,
      minStopFrac: floor.minStopFrac,
      bindingFloor: floor.binding,
      reasons: ["below_traded_value_floor"],
    };
  }

  return {
    verdict: "FEASIBLE",
    riskFracOfEntry: riskFrac,
    minStopFrac: floor.minStopFrac,
    bindingFloor: floor.binding,
    reasons: avgDailyValueVnd == null ? ["stop_executable", "liquidity_unknown"] : ["stop_executable"],
  };
}
