/**
 * The single observability record for the shadow pipeline, and the divergence
 * taxonomy preregistered in M1-SHADOW-IMPLEMENTATION-PLAN.md (`bc18d0c`) before
 * any sample was processed.
 *
 * A divergence must answer WHAT differed, WHERE, and WHY — a boolean is useless.
 * Every code below carries a fixed EXPECTED / UNEXPECTED classification made in
 * advance; anything unrecognised is UNCLASSIFIED and named rather than absorbed.
 *
 * SHADOW ONLY.
 */
import type {
  FeasibilityOutput,
  MarketRiskOutput,
  RankingOutput,
  SizingOutput,
  StanceOutput,
  VisibilityOutput,
} from "./contracts";

export const DIVERGENCE_CODES = [
  "VISIBILITY_DIVERGENCE",
  "FEASIBILITY_DIVERGENCE",
  "RANKING_INPUT_DIVERGENCE",
  "SIZING_DIVERGENCE",
  "STANCE_DIVERGENCE",
  "VOLUME_PRIMITIVE_DIVERGENCE",
  "MISSING_INPUT",
] as const;
export type DivergenceCode = (typeof DIVERGENCE_CODES)[number];

export type DivergenceClass = "EXPECTED" | "UNEXPECTED" | "UNCLASSIFIED";

/** Frozen at `bc18d0c`, before the reconciliation run. Not editable afterwards. */
export const DIVERGENCE_CLASSIFICATION: Readonly<Record<DivergenceCode, DivergenceClass>> = {
  VISIBILITY_DIVERGENCE: "EXPECTED",
  FEASIBILITY_DIVERGENCE: "EXPECTED",
  RANKING_INPUT_DIVERGENCE: "UNEXPECTED",
  SIZING_DIVERGENCE: "EXPECTED",
  STANCE_DIVERGENCE: "EXPECTED",
  VOLUME_PRIMITIVE_DIVERGENCE: "EXPECTED",
  MISSING_INPUT: "UNCLASSIFIED",
};

export function classifyDivergence(code: string): DivergenceClass {
  return (DIVERGENCE_CLASSIFICATION as Record<string, DivergenceClass>)[code] ?? "UNCLASSIFIED";
}

export type Divergence = {
  readonly code: DivergenceCode | string;
  readonly classification: DivergenceClass;
  /** WHERE: which decision produced the disagreement. */
  readonly decision: "D0" | "D1" | "D2" | "D3" | "D4" | "D5" | "PRIMITIVE";
  /** WHAT: the two values, rendered. */
  readonly legacy: string;
  readonly shadow: string;
  /** WHY: a reason code, never prose alone. */
  readonly reason: string;
};

/**
 * Both volume primitives, side by side and never unified. Phase 15 measured them
 * disagreeing on 22.5% of setups at the shared 1.5 cutoff; reproducing that rate
 * is M1's data-drift gate.
 */
export type VolumePrimitives = {
  readonly gate2VolRatioMedian: number | null;
  readonly contextVolRatioMean: number | null;
  readonly sameSideOf1_5Cutoff: boolean | null;
};

export type ShadowDecisionRecord = {
  readonly symbol: string;
  readonly session: string;

  /** What V1 decided, reconstructed via the legacy adapter. */
  readonly legacy: {
    readonly gate1Level: string;
    /** LEGACY_COUPLING — recorded to explain divergences, never used by D0-D5. */
    readonly quality: "A" | "B";
    readonly visibility: string;
    readonly riskMultiplier: number;
  };

  readonly d0MarketRisk: MarketRiskOutput;
  readonly d1Visibility: VisibilityOutput;
  readonly d2Feasibility: FeasibilityOutput;
  readonly d3Ranking: RankingOutput;
  readonly d4Sizing: SizingOutput;
  /** Session-level; identical across every record of one session. */
  readonly d5Stance: StanceOutput | null;

  readonly volumePrimitives: VolumePrimitives;
  readonly divergences: readonly Divergence[];
  /** True when every contract field was populated from real inputs. */
  readonly fullyDecomposed: boolean;
};
