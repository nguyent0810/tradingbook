export type ClosestExecutionStatus = "READY" | "WAIT" | "INVALID";

/** Terminal buckets treated as broken structure for execution status (presentation only). */
const STRUCTURE_BROKEN_CATEGORIES = new Set<string>([
  "breakout_not_holding",
  "pullback_zone_two_closes",
  "swept_breakout_weak_close",
  "mid_pullback_below_ma50",
  "trend_below_ma50",
  "trend_ma20_below_ma50",
  "depth_cap",
]);

export function isStructureBrokenCategory(terminalCategory: string): boolean {
  return STRUCTURE_BROKEN_CATEGORIES.has(terminalCategory);
}

export function hasExecutableZone(close: number, zoneLow: number, zoneHigh: number): boolean {
  return (
    Number.isFinite(close) &&
    close > 0 &&
    Number.isFinite(zoneLow) &&
    Number.isFinite(zoneHigh) &&
    zoneLow <= zoneHigh &&
    zoneHigh > 0
  );
}

/**
 * Relative distance from close to pullback zone band (0 = inside zone).
 * Per UX spec: above zoneHigh uses (close - zoneHigh) / close; below zoneLow uses (zoneLow - close) / close.
 */
export function computeDistanceToPullbackZoneFrac(
  close: number,
  zoneLow: number,
  zoneHigh: number
): number {
  if (!hasExecutableZone(close, zoneLow, zoneHigh)) return Number.NaN;
  if (close >= zoneLow && close <= zoneHigh) return 0;
  if (close > zoneHigh) return (close - zoneHigh) / close;
  return (zoneLow - close) / close;
}

/** Extension above breakout level vs breakout anchor. */
export function computeDistanceAboveBreakoutFrac(close: number, breakoutLevel: number): number {
  if (!Number.isFinite(close) || !Number.isFinite(breakoutLevel) || breakoutLevel <= 0) {
    return Number.NaN;
  }
  return (close - breakoutLevel) / breakoutLevel;
}

/** Downside span from close to stop as fraction of close (long bias). */
export function computeRiskToStopFrac(close: number, stopLevel: number): number {
  if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(stopLevel)) {
    return Number.NaN;
  }
  return (close - stopLevel) / close;
}

/** UX-only label from pullback distance fraction (same inputs as `computeDistanceToPullbackZoneFrac`). */
export function pullbackProximityLabel(distanceFrac: number): string | null {
  if (!Number.isFinite(distanceFrac) || distanceFrac < 0) return null;
  if (distanceFrac < 0.01) return "Very close";
  // “1–3% Near” in UX copy; upper bound extended slightly so ~3.2% reads as Near (see product example).
  if (distanceFrac < 0.04) return "Near";
  if (distanceFrac <= 0.06) return "Moderate";
  return "Far";
}

export function closestExecutionActionHint(status: ClosestExecutionStatus): string {
  switch (status) {
    case "READY":
      return "Entry conditions met. Monitor for execution.";
    case "WAIT":
      return "Wait for pullback into entry zone.";
    case "INVALID":
      return "Structure invalid. Do not consider.";
  }
}

export function computeClosestExecutionStatus(
  terminalCategory: string,
  close: number,
  zoneLow: number,
  zoneHigh: number
): ClosestExecutionStatus {
  if (
    hasExecutableZone(close, zoneLow, zoneHigh) &&
    close >= zoneLow &&
    close <= zoneHigh
  ) {
    return "READY";
  }
  if (isStructureBrokenCategory(terminalCategory)) return "INVALID";
  return "WAIT";
}

export function hasExecutableBreakout(breakoutLevel: number): boolean {
  return Number.isFinite(breakoutLevel) && breakoutLevel > 0;
}

export type ClosestRowSortInput = {
  /** Kept for reference only — always 0 for INVALID rows, not used for sort order. */
  rankScore: number;
  close: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  /** Deterministic tie-breakers when distance ties (avoids stable-sort artifact looking alphabetical). */
  symbol?: string;
  partialPipelineScore?: number;
  stageRank?: number;
  /** Gate 2 invalid rows: fewer reason lines treated as closer to qualifying when other ties hold. */
  reasonLineCount?: number;
};

function tieBreakerNum(v: number | undefined, fallback: number): number {
  return v !== undefined && Number.isFinite(v) ? v : fallback;
}

/**
 * Sort: nearest to pullback zone first (lower distance fraction), then higher
 * Gate 2 partialPipelineScore. `rankScore` is intentionally NOT a tie-breaker
 * here — these are all INVALID-quality evaluations, and `rankScore` is
 * hardcoded to 0 for every INVALID row (see `invalidBase()` in
 * gate2/breakout-pullback.ts), so comparing it would always be a no-op.
 */
export function compareClosestRowsExecutionOrder(a: ClosestRowSortInput, b: ClosestRowSortInput): number {
  const da = computeDistanceToPullbackZoneFrac(a.close, a.pullbackZoneLow, a.pullbackZoneHigh);
  const db = computeDistanceToPullbackZoneFrac(b.close, b.pullbackZoneLow, b.pullbackZoneHigh);
  const na = Number.isNaN(da) ? Number.POSITIVE_INFINITY : da;
  const nb = Number.isNaN(db) ? Number.POSITIVE_INFINITY : db;
  if (na !== nb) return na - nb;

  const pa = tieBreakerNum(a.partialPipelineScore, Number.NEGATIVE_INFINITY);
  const pb = tieBreakerNum(b.partialPipelineScore, Number.NEGATIVE_INFINITY);
  if (pa !== pb) return pb - pa;

  const sa = tieBreakerNum(a.stageRank, Number.NEGATIVE_INFINITY);
  const sb = tieBreakerNum(b.stageRank, Number.NEGATIVE_INFINITY);
  if (sa !== sb) return sb - sa;

  const ra = tieBreakerNum(a.reasonLineCount, Number.POSITIVE_INFINITY);
  const rb = tieBreakerNum(b.reasonLineCount, Number.POSITIVE_INFINITY);
  if (ra !== rb) return ra - rb;

  const syma = a.symbol ?? "";
  const symb = b.symbol ?? "";
  return syma.localeCompare(symb);
}
