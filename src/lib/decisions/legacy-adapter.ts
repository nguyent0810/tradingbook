/**
 * V1 reconstruction, for comparison only. SHADOW ONLY.
 *
 * THIS IS THE ONLY FILE IN `src/lib/decisions/` THAT READS `quality`.
 *
 * Its job is to reproduce what V1 decided so the shadow pipeline's disagreements
 * can be measured. Every function here is marked LEGACY_COUPLING: it reads a
 * variable the new contracts deliberately exclude, and it exists to make that
 * coupling visible rather than to preserve it.
 *
 * Nothing here is imported by D0-D5. If it were, the decomposition would be a
 * fiction — so the direction of dependency is asserted in the tests.
 */
import { deriveGate1SurfacingRule } from "@/lib/scanner/gate2/collect-candidates";
import { computePositionSizing, qualityRiskMultiplier } from "@/lib/position-sizing";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { Stance, VisibilityDecision } from "./contracts";

export type LegacyCandidate = {
  readonly gate1Level: Gate1Level;
  /** LEGACY_COUPLING — the variable the new contracts exclude. */
  readonly quality: "A" | "B";
};

/**
 * V1 visibility, from production's single source of truth. LEGACY_COUPLING:
 * reads Gate 1 level and `quality`, both forbidden to the D1 contract.
 */
export function legacyVisibility(c: LegacyCandidate): VisibilityDecision {
  const rule = deriveGate1SurfacingRule(c.gate1Level);
  if (rule === "none") return "HIDDEN";
  if (rule === "tier-a-only") return c.quality === "A" ? "SHOWN" : "HIDDEN";
  return "SHOWN";
}

/** LEGACY_COUPLING — V1's risk multiplier is a pure function of `quality`. */
export function legacyRiskMultiplier(c: LegacyCandidate): number {
  return qualityRiskMultiplier(c.quality);
}

/**
 * V1's stance. LEGACY_COUPLING twice over: it reads `quality` through the tier
 * counts, and it reads counts tallied BEFORE the Gate 1 surfacing filter, so it
 * and V1's visibility describe different populations.
 */
export function legacyStance(params: {
  gate1Level: Gate1Level;
  candidateCountA: number;
  candidateCountB: number;
}): Stance {
  const d = computeDailyTradingDecision(params);
  return d.level;
}

/**
 * V1's actual position size, computed by the real production function so the
 * comparison is against reality rather than a reimplementation. LEGACY_COUPLING:
 * `quality` is a required argument.
 */
export function legacySize(params: {
  accountEquityVnd: number;
  maxPortfolioExposurePct: number;
  currentPortfolioExposureVnd: number;
  maxPerTradeExposurePct: number;
  baseRiskPerTradePct: number;
  quality: "A" | "B";
  entryKVnd: number;
  stopKVnd: number;
}): { shares: number; riskAtStopVnd: number } | null {
  const r = computePositionSizing({ ...params, liquidityCapPct: null, symbolAvgDailyValueVnd: null });
  if (!r.ok) return null;
  return { shares: r.value.qFinalShares, riskAtStopVnd: r.value.riskAtStopVnd };
}
