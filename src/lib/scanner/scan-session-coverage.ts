import { TRADABILITY_REASON } from "@/lib/scanner/tradability-constants";
import type { TradabilityResult } from "@/lib/scanner/tradability-types";

/**
 * Fraction of scanned symbols whose latest bar is not on the expected VNINDEX session
 * above which we treat universe coverage as weak (operator warning only — scan still runs).
 */
export const SCAN_SESSION_COVERAGE_WEAK_STALE_FRAC = 0.35;

/** Minimum symbols evaluated before weak-coverage heuristics apply. */
export const SCAN_SESSION_COVERAGE_MIN_UNIVERSE = 5;

export type ScanSessionCoverage = {
  /** Expected EOD session (UTC calendar day, same as VNINDEX latest bar). */
  expectedSessionDate: string;
  universeScanned: number;
  tradabilityEvaluated: number;
  tradabilityPassed: number;
  /** Symbols failing tradability with `STALE_DATA` (latest bar ≠ expected session). */
  staleSessionCount: number;
  /** `staleSessionCount / tradabilityEvaluated` when evaluated > 0, else 0. */
  staleSessionFrac: number;
  /** Symbols whose latest bar matches expected session (may still fail other tradability checks). */
  sessionAlignedCount: number;
  sessionAlignedFrac: number;
  /** True when stale fraction ≥ threshold and universe is large enough to matter. */
  weakCoverage: boolean;
  /** Short headline for chips / integrity panel. */
  headline: string;
  /** Trader-facing warning when `weakCoverage`; null otherwise. */
  operatorWarning: string | null;
};

function isoDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type TradabilityItemForCoverage = {
  result: TradabilityResult;
};

/**
 * Summarizes how many symbols have equity bars on the expected VNINDEX session.
 * Used at scan time (persisted on `DailyScanRun.notes`) and when building freshness DTOs.
 */
export function computeScanSessionCoverage(params: {
  expectedLatestSession: Date;
  universeScanned: number;
  tradabilityItems: readonly TradabilityItemForCoverage[];
  weakStaleFracThreshold?: number;
  minUniverseForWeak?: number;
}): ScanSessionCoverage {
  const {
    expectedLatestSession,
    universeScanned,
    tradabilityItems,
    weakStaleFracThreshold = SCAN_SESSION_COVERAGE_WEAK_STALE_FRAC,
    minUniverseForWeak = SCAN_SESSION_COVERAGE_MIN_UNIVERSE,
  } = params;

  const tradabilityEvaluated = tradabilityItems.length;
  let staleSessionCount = 0;
  let tradabilityPassed = 0;

  for (const { result } of tradabilityItems) {
    if (result.passed) tradabilityPassed++;
    if (result.reasons.includes(TRADABILITY_REASON.STALE_DATA)) {
      staleSessionCount++;
    }
  }

  const staleSessionFrac =
    tradabilityEvaluated > 0 ? staleSessionCount / tradabilityEvaluated : 0;
  const sessionAlignedCount = tradabilityEvaluated - staleSessionCount;
  const sessionAlignedFrac =
    tradabilityEvaluated > 0 ? sessionAlignedCount / tradabilityEvaluated : 0;

  const weakCoverage =
    tradabilityEvaluated >= minUniverseForWeak &&
    staleSessionFrac >= weakStaleFracThreshold;

  const pct = (frac: number) => `${(frac * 100).toFixed(0)}%`;

  const headline = weakCoverage
    ? `Weak session coverage — ${pct(staleSessionFrac)} stale (${staleSessionCount}/${tradabilityEvaluated})`
    : tradabilityEvaluated > 0
      ? `Session coverage OK — ${pct(sessionAlignedFrac)} aligned to ${isoDayUtc(expectedLatestSession)}`
      : "No tradability evaluations";

  const operatorWarning = weakCoverage
    ? "Data coverage is weak for the expected session. Scanner result may be incomplete because many symbols are stale."
    : null;

  return {
    expectedSessionDate: isoDayUtc(expectedLatestSession),
    universeScanned,
    tradabilityEvaluated,
    tradabilityPassed,
    staleSessionCount,
    staleSessionFrac,
    sessionAlignedCount,
    sessionAlignedFrac,
    weakCoverage,
    headline,
    operatorWarning,
  };
}

/** Gate 2 should only run for symbols that passed tradability (non-stale among other checks). */
export function symbolIdsEligibleForGate2(
  items: ReadonlyArray<{ symbolId: string; result: TradabilityResult }>
): string[] {
  return items.filter((i) => i.result.passed).map((i) => i.symbolId);
}
