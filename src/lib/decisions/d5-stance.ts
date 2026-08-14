/**
 * D5 — stance. SHADOW ONLY.
 *
 * A derived report, never an authority. It composes decisions that already
 * happened and can change none of them: it takes a value, returns a value, and
 * imports no upstream decision function. There is no code path by which D5 can
 * reach D0-D4, which is the anti-circularity property, enforced by the module
 * graph rather than by discipline.
 *
 * Fixed arity, forever: budget class, a vector of counts, aggregate open risk.
 * A fourth input is a contract change requiring the scrutiny of a new gate.
 */
import type { StanceInput, StanceOutput } from "./contracts";

export function decideStance(input: StanceInput): StanceOutput {
  if (input.marketRiskClass === "NONE") {
    return { stance: "NO_TRADE", reasons: ["no_market_risk_budget"] };
  }
  if (input.counts.shown === 0) {
    return { stance: "NO_TRADE", reasons: ["nothing_shown"] };
  }
  if (input.counts.feasible === 0) {
    return { stance: "NO_TRADE", reasons: ["nothing_feasible"] };
  }
  if (input.marketRiskClass === "REDUCED") {
    return { stance: "PROBE", reasons: ["reduced_budget", "feasible_candidates_exist"] };
  }
  return { stance: "NORMAL", reasons: ["normal_budget", "feasible_candidates_exist"] };
}
