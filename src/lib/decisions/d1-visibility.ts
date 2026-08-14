/**
 * D1 — visibility. SHADOW ONLY.
 *
 * Answers exactly one question: is this candidate shown? Actionability is a
 * different decision with different inputs, because letting the budget decide who
 * is *seen* is the leak phase 15's review found.
 *
 * D1 cannot be V1-equivalent, and that is not a defect. V1's visibility reads
 * Gate 1 level and `quality`; this contract has neither. The disagreement between
 * the two is `VISIBILITY_DIVERGENCE`, preregistered as EXPECTED in
 * M1-SHADOW-IMPLEMENTATION-PLAN.md — it is the architecture delta M2 exists to
 * decide about, surfaced here rather than hidden.
 */
import type { VisibilityInput, VisibilityOutput } from "./contracts";

export function decideVisibility(input: VisibilityInput): VisibilityOutput {
  if (input.validity !== "VALID") {
    return { decision: "HIDDEN", reasons: ["setup_not_valid"] };
  }
  // An unexecutable setup is nothing a reader can act on, so it is not shown.
  // Note which verdicts this covers: noise and liquidity, never capacity —
  // capacity is D4's and must not reach back here.
  if (input.feasibility === "NOT_FEASIBLE_NOISE") {
    return { decision: "HIDDEN", reasons: ["stop_inside_noise_floor"] };
  }
  if (input.feasibility === "NOT_FEASIBLE_LIQUIDITY") {
    return { decision: "HIDDEN", reasons: ["insufficient_liquidity"] };
  }
  if (input.feasibility === "UNKNOWN_INPUT") {
    // Fail open: a missing input must never silently hide a valid setup.
    return { decision: "SHOWN", reasons: ["valid_setup", "feasibility_unknown"] };
  }
  return { decision: "SHOWN", reasons: ["valid_setup", "trade_feasible"] };
}
