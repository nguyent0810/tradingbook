/**
 * Shadow orchestrator. SHADOW ONLY — nothing in production imports this.
 *
 * Two guarantees, both tested:
 *
 *   1. `runShadowDecisions` is pure. It performs no I/O, no database access and
 *      no order emission. Its only output is a value.
 *   2. `runShadowSafely` is fail-open: any throw anywhere inside the pipeline is
 *      swallowed and reported, so a shadow defect can never propagate to a caller.
 *      M1 wires no caller, but M2 will, and the semantics must exist and be
 *      verified before they are relied upon.
 */
import { decideMarketRisk } from "./d0-market-risk";
import { decideVisibility } from "./d1-visibility";
import { decideFeasibility } from "./d2-feasibility";
import { decideRanking, toRankingInput } from "./d3-ranking";
import { decideSizing } from "./d4-sizing";
import { legacyRiskMultiplier, legacyVisibility } from "./legacy-adapter";
import { classifyDivergence, type Divergence, type ShadowDecisionRecord, type VolumePrimitives } from "./shadow-record";
import { GATE2_VOL_RATIO_A } from "@/lib/scanner/gate2/constants";
import type { Gate2RankComponents } from "@/lib/scanner/gate2/rank-components";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { SetupValidity } from "./contracts";

export type ShadowCandidateInput = {
  readonly symbol: string;
  readonly session: string;
  readonly gate1Level: Gate1Level;
  /** LEGACY_COUPLING — passed for the legacy leg and the record, never into D0-D5. */
  readonly quality: "A" | "B";
  readonly validity: SetupValidity;
  readonly entryPriceKVnd: number;
  readonly structuralStopKVnd: number;
  readonly atrKVnd: number | null;
  readonly board: "HOSE" | "HNX" | "UPCOM";
  readonly avgDailyValueVnd: number | null;
  readonly rankComponents: Gate2RankComponents | null;
  readonly accountEquityVnd: number | null;
  readonly portfolioOpenRiskVnd: number | null;
  readonly volumePrimitives: VolumePrimitives;
};

const EMPTY_RANK: Gate2RankComponents = {
  volumeTerm: 0, extensionTerm: 0, maDistanceTerm: 0, depthPenalty: 0, rankScore: 0,
  inputs: { volRatio: 0, extensionPct: 0, maDistancePct: 0, depthFrac: 0 },
};

export function runShadowDecisions(c: ShadowCandidateInput): ShadowDecisionRecord {
  // D0 — market only. The candidate's fields are not in scope for this call.
  const d0 = decideMarketRisk({ gate1Level: c.gate1Level });

  // D2 before D1: visibility consumes the feasibility verdict, never the reverse.
  const d2 = decideFeasibility({
    entryPriceKVnd: c.entryPriceKVnd,
    structuralStopKVnd: c.structuralStopKVnd,
    atrKVnd: c.atrKVnd,
    board: c.board,
    avgDailyValueVnd: c.avgDailyValueVnd,
  });

  const d1 = decideVisibility({ validity: c.validity, feasibility: d2.verdict });

  const d3 = decideRanking(toRankingInput(c.rankComponents ?? EMPTY_RANK));

  const d4 = decideSizing({
    structuralRiskPerShareKVnd: c.entryPriceKVnd - c.structuralStopKVnd,
    entryPriceKVnd: c.entryPriceKVnd,
    marketRiskClass: d0.riskClass,
    portfolioOpenRiskVnd: c.portfolioOpenRiskVnd,
    accountEquityVnd: c.accountEquityVnd,
  });

  const legacyVis = legacyVisibility({ gate1Level: c.gate1Level, quality: c.quality });
  const legacyMult = legacyRiskMultiplier({ gate1Level: c.gate1Level, quality: c.quality });

  const divergences: Divergence[] = [];

  if (legacyVis !== d1.decision) {
    divergences.push({
      code: "VISIBILITY_DIVERGENCE",
      classification: classifyDivergence("VISIBILITY_DIVERGENCE"),
      decision: "D1",
      legacy: legacyVis,
      shadow: d1.decision,
      reason:
        legacyVis === "HIDDEN"
          ? "v1_hid_on_gate1_x_quality_shadow_has_neither_input"
          : "shadow_hid_on_feasibility_v1_does_not_check_it",
    });
  }

  // V1 has no feasibility verdict: it folds the too-tight-stop case into INVALID
  // and has no liquidity verdict at this stage at all. Any non-FEASIBLE shadow
  // verdict on a candidate V1 considered valid is therefore a divergence.
  if (c.validity === "VALID" && d2.verdict !== "FEASIBLE") {
    divergences.push({
      code: "FEASIBILITY_DIVERGENCE",
      classification: classifyDivergence("FEASIBILITY_DIVERGENCE"),
      decision: "D2",
      legacy: "no_feasibility_concept",
      shadow: d2.verdict,
      reason: d2.reasons[0] ?? "unspecified",
    });
  }

  // A multiplier of 0.5 versus 1.0 has no counterpart in a contract that cannot
  // read `quality`. Recorded whenever V1 would have halved the risk.
  if (legacyMult !== 1) {
    divergences.push({
      code: "SIZING_DIVERGENCE",
      classification: classifyDivergence("SIZING_DIVERGENCE"),
      decision: "D4",
      legacy: `risk_multiplier_${legacyMult}`,
      shadow: "no_quality_multiplier_in_contract",
      reason: "v1_scales_risk_by_tier_shadow_contract_excludes_tier",
    });
  }

  if (d3.duplicatedSources.length > 0) {
    divergences.push({
      code: "RANKING_INPUT_DIVERGENCE",
      classification: classifyDivergence("RANKING_INPUT_DIVERGENCE"),
      decision: "D3",
      legacy: "single_term_per_primitive_assumed",
      shadow: d3.duplicatedSources.join(","),
      reason: "primitive_enters_score_more_than_once",
    });
  }

  const vp = c.volumePrimitives;
  if (vp.sameSideOf1_5Cutoff === false) {
    divergences.push({
      code: "VOLUME_PRIMITIVE_DIVERGENCE",
      classification: classifyDivergence("VOLUME_PRIMITIVE_DIVERGENCE"),
      decision: "PRIMITIVE",
      legacy: `median=${vp.gate2VolRatioMedian?.toFixed(3)}`,
      shadow: `mean=${vp.contextVolRatioMean?.toFixed(3)}`,
      reason: `opposite_sides_of_${GATE2_VOL_RATIO_A}_cutoff`,
    });
  }

  const missing: string[] = [];
  if (c.atrKVnd == null) missing.push("atr");
  if (c.avgDailyValueVnd == null) missing.push("avgDailyValueVnd");
  if (c.rankComponents == null) missing.push("rankComponents");
  if (c.accountEquityVnd == null) missing.push("accountEquityVnd");
  if (c.portfolioOpenRiskVnd == null) missing.push("portfolioOpenRiskVnd");
  if (vp.gate2VolRatioMedian == null || vp.contextVolRatioMean == null) missing.push("volumePrimitives");
  if (missing.length > 0) {
    divergences.push({
      code: "MISSING_INPUT",
      classification: classifyDivergence("MISSING_INPUT"),
      decision: "D4",
      legacy: "n/a",
      shadow: missing.join(","),
      reason: "contract_field_unavailable_in_v1",
    });
  }

  return {
    symbol: c.symbol,
    session: c.session,
    legacy: {
      gate1Level: c.gate1Level,
      quality: c.quality,
      visibility: legacyVis,
      riskMultiplier: legacyMult,
    },
    d0MarketRisk: d0,
    d1Visibility: d1,
    d2Feasibility: d2,
    d3Ranking: d3,
    d4Sizing: d4,
    d5Stance: null,
    volumePrimitives: vp,
    divergences,
    fullyDecomposed: missing.length === 0,
  };
}

export type ShadowResult =
  | { readonly ok: true; readonly record: ShadowDecisionRecord }
  | { readonly ok: false; readonly error: string };

/**
 * Fail-open wrapper. Any throw is captured and returned as a value, so no shadow
 * defect can reach a caller. M1 has no caller; M2 will, and this is the boundary
 * it must go through.
 */
export function runShadowSafely(c: ShadowCandidateInput): ShadowResult {
  try {
    return { ok: true, record: runShadowDecisions(c) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
