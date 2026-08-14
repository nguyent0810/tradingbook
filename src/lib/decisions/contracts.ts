/**
 * Narrow input contracts for the shadow decision pipeline (M1).
 *
 * The point of this file is what is NOT in it. Each decision receives an object
 * from which the fields it must not read are *absent*, so a forbidden read is a
 * compile error rather than something a reviewer has to notice. Phase 15's
 * independent review asked for exactly this — grep cannot catch aliasing,
 * destructuring or transitive property access, and a type can.
 *
 * `quality` appears in none of these contracts. It appears only in
 * `legacy-adapter.ts`, whose job is reconstructing V1 for comparison.
 *
 * SHADOW ONLY. Nothing here is imported by production code.
 */

// ---------------------------------------------------------------- D0 · market

export type MarketRiskClass = "NONE" | "REDUCED" | "NORMAL";

/**
 * D0 sees the market and nothing else. No stock field exists on this type, which
 * is invariant I5 ("no stock attribute raises the total budget") enforced by
 * construction rather than by test.
 */
export type MarketRiskInput = {
  readonly gate1Level: "PASS" | "WARNING" | "FAIL";
};

export type MarketRiskOutput = {
  readonly riskClass: MarketRiskClass;
  /** Tagged in the value, not only in a comment: this may never size an order. */
  readonly usage: "SHADOW_ONLY";
  readonly reasons: readonly string[];
};

// ------------------------------------------------------------ D1 · visibility

export type SetupValidity = "NOT_A_SETUP" | "VALID";
export type VisibilityDecision = "SHOWN" | "HIDDEN";

/**
 * D1 answers "is it shown", full stop. Actionability is a different question with
 * a different input set, because letting the budget decide who is *seen* is the
 * leak phase 15's review found in the first draft.
 */
export type VisibilityInput = {
  readonly validity: SetupValidity;
  readonly feasibility: FeasibilityVerdict;
};

export type VisibilityOutput = {
  readonly decision: VisibilityDecision;
  readonly reasons: readonly string[];
};

// ----------------------------------------------------------- D2 · feasibility

/**
 * `NOT_FEASIBLE_CAPACITY` is deliberately NOT a member. Whether a budget affords
 * a lot is an allocation question owned by D4; making it a feasibility verdict is
 * what made V1's feasibility order-dependent.
 */
export type FeasibilityVerdict =
  | "FEASIBLE"
  | "NOT_FEASIBLE_NOISE"
  | "NOT_FEASIBLE_LIQUIDITY"
  | "UNKNOWN_INPUT";

export type FeasibilityInput = {
  /** Price the trade would be entered at, in kVND (repo convention). */
  readonly entryPriceKVnd: number;
  /** Structural stop, kVND. D2 never moves it — it only measures the distance. */
  readonly structuralStopKVnd: number;
  /** ATR at the decision bar, kVND. Null when history is too short. */
  readonly atrKVnd: number | null;
  readonly board: "HOSE" | "HNX" | "UPCOM";
  /** 20-session average traded value, VND. Null when unknown. */
  readonly avgDailyValueVnd: number | null;
};

export type FeasibilityOutput = {
  readonly verdict: FeasibilityVerdict;
  readonly riskFracOfEntry: number | null;
  readonly minStopFrac: number | null;
  readonly bindingFloor: "tick" | "fee" | "volatility" | "none";
  readonly reasons: readonly string[];
};

// --------------------------------------------------------------- D3 · ranking

/** Which primitive a rank term came from — makes the known fan-out visible. */
export type RankTermSource = "volRatioMedian" | "extensionPct" | "maDistancePct" | "depthFrac";

export type RankingInput = {
  readonly terms: readonly {
    readonly name: string;
    readonly value: number;
    readonly source: RankTermSource;
  }[];
};

export type RankingOutput = {
  readonly score: number;
  readonly terms: RankingInput["terms"];
  /** Sources appearing more than once — an I9b violation if non-empty. */
  readonly duplicatedSources: readonly RankTermSource[];
};

// ---------------------------------------------------------------- D4 · sizing

export type SizingEligibility =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE_NO_BUDGET"
  | "NOT_FEASIBLE_CAPACITY"
  | "UNKNOWN_INPUT";

/**
 * D4 reads structural risk and the market budget class. It does not read
 * `quality`, visibility or rank — the three things V1's sizing path is entangled
 * with.
 */
export type SizingInput = {
  readonly structuralRiskPerShareKVnd: number;
  readonly entryPriceKVnd: number;
  readonly marketRiskClass: MarketRiskClass;
  /** Sum of risk-at-stop over open positions, VND. Null where V1 has no such concept. */
  readonly portfolioOpenRiskVnd: number | null;
  readonly accountEquityVnd: number | null;
};

export type SizingOutput = {
  readonly eligibility: SizingEligibility;
  /** Inputs echoed back so a divergence can be explained, never a share count. */
  readonly inputs: SizingInput;
  readonly reasons: readonly string[];
  /** M1 emits no order and no final size. This field records that, in the value. */
  readonly emitsOrder: false;
};

// ----------------------------------------------------------------- D5 · stance

export type Stance = "NO_TRADE" | "PROBE" | "NORMAL";

/**
 * Fixed arity, forever: the budget class, a vector of counts, and aggregate open
 * risk. A fourth field is a contract change requiring the scrutiny of a new gate.
 * No per-candidate field appears, which is what stops D5 accreting authority.
 */
export type StanceInput = {
  readonly marketRiskClass: MarketRiskClass;
  readonly counts: {
    readonly shown: number;
    readonly hidden: number;
    readonly feasible: number;
  };
  readonly aggregateOpenRiskVnd: number | null;
};

export type StanceOutput = {
  readonly stance: Stance;
  readonly reasons: readonly string[];
};

// ============================================================================
// Compile-time forbidden-read assertions.
//
// `Forbidden<T, K>` resolves to `true` only when NONE of the keys in K exist on
// T. If a banned field is ever added to a contract, the corresponding constant
// below stops type-checking and `tsc --noEmit` fails. This is the enforcement
// mechanism, not documentation of one.
// ============================================================================

type Forbidden<T, K extends string> = Extract<keyof T, K> extends never ? true : never;

/** Fields no decision contract may ever carry, by name. */
type SizingFields = "size" | "quantity" | "riskMultiplier" | "riskBudgetVnd" | "notionalVnd";
type VisibilityFields = "visibility" | "decision" | "shown" | "hidden";
type QualityField = "quality" | "tier" | "gate2Quality";
type RankField = "rankScore" | "rank" | "ranking";
type StanceField = "stance" | "tradingDecision" | "allocation";

// D0 — market only. No stock attribute of any kind.
const _d0_no_quality: Forbidden<MarketRiskInput, QualityField> = true;
const _d0_no_sizing: Forbidden<MarketRiskInput, SizingFields> = true;
const _d0_no_rank: Forbidden<MarketRiskInput, RankField> = true;
const _d0_no_stance: Forbidden<MarketRiskInput, StanceField> = true;
const _d0_no_symbol: Forbidden<MarketRiskInput, "symbol" | "close" | "atr" | "volRatio"> = true;

// D1 — validity and feasibility only. The budget must not reach it.
const _d1_no_quality: Forbidden<VisibilityInput, QualityField> = true;
const _d1_no_sizing: Forbidden<VisibilityInput, SizingFields> = true;
const _d1_no_rank: Forbidden<VisibilityInput, RankField> = true;
const _d1_no_stance: Forbidden<VisibilityInput, StanceField> = true;
const _d1_no_budget: Forbidden<VisibilityInput, "marketRiskClass" | "budget" | "gate1Level"> = true;

// D2 — structural only. No market state, no budget, no ordering.
const _d2_no_quality: Forbidden<FeasibilityInput, QualityField> = true;
const _d2_no_rank: Forbidden<FeasibilityInput, RankField> = true;
const _d2_no_visibility: Forbidden<FeasibilityInput, VisibilityFields> = true;
const _d2_no_market: Forbidden<FeasibilityInput, "marketRiskClass" | "gate1Level"> = true;
const _d2_no_budget: Forbidden<FeasibilityInput, SizingFields> = true;

// D3 — comparative attributes only. Nothing that could invalidate.
const _d3_no_quality: Forbidden<RankingInput, QualityField> = true;
const _d3_no_validity: Forbidden<RankingInput, "validity" | "feasibility"> = true;
const _d3_no_sizing: Forbidden<RankingInput, SizingFields> = true;

// D4 — structural risk and budget. Not quality, not visibility, not rank.
const _d4_no_quality: Forbidden<SizingInput, QualityField> = true;
const _d4_no_visibility: Forbidden<SizingInput, VisibilityFields> = true;
const _d4_no_rank: Forbidden<SizingInput, RankField> = true;

// D5 — three fields, none of them per-candidate.
const _d5_no_quality: Forbidden<StanceInput, QualityField> = true;
const _d5_no_rank: Forbidden<StanceInput, RankField> = true;
const _d5_no_sizing: Forbidden<StanceInput, SizingFields> = true;
const _d5_no_symbol: Forbidden<StanceInput, "symbol" | "close" | "validity" | "feasibility"> = true;

/** Referenced so the assertions are not dead code the compiler may skip. */
export const CONTRACT_ASSERTIONS_HOLD = [
  _d0_no_quality, _d0_no_sizing, _d0_no_rank, _d0_no_stance, _d0_no_symbol,
  _d1_no_quality, _d1_no_sizing, _d1_no_rank, _d1_no_stance, _d1_no_budget,
  _d2_no_quality, _d2_no_rank, _d2_no_visibility, _d2_no_market, _d2_no_budget,
  _d3_no_quality, _d3_no_validity, _d3_no_sizing,
  _d4_no_quality, _d4_no_visibility, _d4_no_rank,
  _d5_no_quality, _d5_no_rank, _d5_no_sizing, _d5_no_symbol,
].every(Boolean);
