/**
 * D4 — sizing / allocation. SHADOW ONLY.
 *
 * D4 emits ELIGIBILITY AND INPUTS. It does not emit an order and does not emit a
 * final share count — `emitsOrder: false` is in the return value, not only in a
 * comment, so the guarantee is checkable at runtime.
 *
 * No multiplier is invented. §7 forbids choosing a final formula, and inventing
 * one here would be the parameter selection fifteen phases have avoided. What D4
 * establishes is that the *inputs* to sizing can be assembled without reading
 * `quality`, which is the claim M1 needs to test.
 *
 * `NOT_FEASIBLE_CAPACITY` lives here, not in D2: whether the budget affords a lot
 * is an allocation question about the portfolio, not a property of the setup.
 *
 * ---------------------------------------------------------------------------
 * KNOWN LIMIT, surfaced by the M1 independent review and stated rather than
 * papered over: `NOT_FEASIBLE_CAPACITY` is UNREACHABLE IN M1.
 *
 * Deciding it requires converting a budget into a share count, which requires a
 * risk fraction — and choosing one is exactly the parameter selection §3 and §7
 * of the M1 brief forbid. So the branch is declared in the vocabulary (it is
 * D4's by right, per the phase-15 contracts) and cannot fire until M2 supplies a
 * risk fraction with evidence behind it.
 *
 * The alternative — inventing a fraction so the branch executes — would make the
 * pipeline look better tested while fabricating the number fifteen phases have
 * refused to fabricate. `d4CapacityUnreachableInM1` below makes the limit
 * explicit and testable instead.
 * ---------------------------------------------------------------------------
 */
import type { SizingEligibility, SizingInput, SizingOutput } from "./contracts";

/**
 * The verdicts D4 can actually return in M1, and the one it cannot. Exported so
 * the limit is asserted by a test rather than living only in a comment.
 */
export const M1_REACHABLE_ELIGIBILITY: readonly SizingEligibility[] = [
  "ELIGIBLE",
  "NOT_ELIGIBLE_NO_BUDGET",
  "UNKNOWN_INPUT",
];
export const M1_UNREACHABLE_ELIGIBILITY: readonly SizingEligibility[] = ["NOT_FEASIBLE_CAPACITY"];

export function decideSizing(input: SizingInput): SizingOutput {
  const reasons: string[] = [];

  if (!(input.structuralRiskPerShareKVnd > 0) || !(input.entryPriceKVnd > 0)) {
    return {
      eligibility: "UNKNOWN_INPUT",
      inputs: input,
      reasons: ["structural_risk_unusable"],
      emitsOrder: false,
    };
  }

  if (input.marketRiskClass === "NONE") {
    return {
      eligibility: "NOT_ELIGIBLE_NO_BUDGET",
      inputs: input,
      reasons: ["market_risk_class_none"],
      emitsOrder: false,
    };
  }

  // Capacity is only answerable when equity is known. Where V1 has no aggregate
  // open-risk concept the field is null, and that gap is reported rather than
  // filled with an invented default.
  if (input.accountEquityVnd == null) {
    reasons.push("equity_unknown");
  }
  if (input.portfolioOpenRiskVnd == null) {
    reasons.push("aggregate_open_risk_not_available_in_v1");
  }

  reasons.push(`market_risk_class_${input.marketRiskClass.toLowerCase()}`);
  return {
    eligibility: "ELIGIBLE",
    inputs: input,
    reasons,
    emitsOrder: false,
  };
}
