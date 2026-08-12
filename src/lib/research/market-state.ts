/**
 * Where the index sits in a drawdown-and-recovery cycle, and how much of the
 * market is participating.
 *
 * Gate 1 collapses the index into three labels from two conditions, and the
 * regime audit showed that mix is identical before and after 2022 — because an
 * index-only lens cannot tell a narrow market from a broad one
 * (docs/trading/replay/WHY-2022.md). This module exists to describe the states
 * Gate 1 cannot distinguish. It is DIAGNOSTIC: nothing here gates, ranks or
 * sizes anything.
 *
 * Every classification is ORDINAL — where price sits relative to its own moving
 * averages, and which way those averages point. There are no magnitude
 * thresholds to fit, because a research phase that tunes its own state
 * definitions against outcomes has measured the tuning.
 */

export type MarketState =
  | "DETERIORATING"
  | "STABILIZING"
  | "EARLY_RECOVERY"
  | "APPROACHING_SHORT_MA"
  | "APPROACHING_MA50"
  | "FRESH_MA50_RECLAIM"
  | "EXTENDED_AFTER_RECOVERY";

/**
 * Sessions within which an MA50 cross counts as "fresh".
 *
 * One trading week. Definitional, not fitted: it separates "just reclaimed" from
 * "has been above for a while", and no outcome was consulted in choosing it.
 */
export const FRESH_RECLAIM_SESSIONS = 5;

export type MarketStateInput = {
  close: number;
  ma10: number | null;
  ma20: number | null;
  ma50: number | null;
  /** Sessions since the close last crossed from below MA50 to at/above it. Null if never. */
  sessionsSinceMa50Reclaim: number | null;
  /** True when MA20 today is below MA20 `slopeLookback` sessions ago. */
  ma20Falling: boolean;
  /** True when the close set a new N-session low within the last `FRESH_RECLAIM_SESSIONS`. */
  madeRecentNewLow: boolean;
};

/**
 * Classify one session.
 *
 * The ladder runs from worst to best, and each rung is a strictly stronger
 * structural position than the one below it:
 *
 *   below MA50, under everything, still making lows   -> DETERIORATING
 *   below MA50, under everything, lows have stopped   -> STABILIZING
 *   below MA50, back above MA10                       -> EARLY_RECOVERY
 *   below MA50, between MA10 and MA20                 -> APPROACHING_SHORT_MA
 *   below MA50, above MA20                            -> APPROACHING_MA50
 *   at/above MA50, crossed within a week              -> FRESH_MA50_RECLAIM
 *   at/above MA50, longer than that                   -> EXTENDED_AFTER_RECOVERY
 *
 * Returns null when the moving averages are not yet warm.
 */
export function classifyMarketState(i: MarketStateInput): MarketState | null {
  if (i.ma10 == null || i.ma20 == null || i.ma50 == null) return null;

  if (i.close >= i.ma50) {
    return i.sessionsSinceMa50Reclaim != null && i.sessionsSinceMa50Reclaim <= FRESH_RECLAIM_SESSIONS
      ? "FRESH_MA50_RECLAIM"
      : "EXTENDED_AFTER_RECOVERY";
  }

  // Below MA50 from here down.
  if (i.close >= i.ma20) return "APPROACHING_MA50";
  if (i.close >= i.ma10) {
    // Above the fast average but still under the medium one. Distinguish a first
    // lift off the lows from a genuine push toward MA20 by MA20's direction.
    return i.ma20Falling ? "EARLY_RECOVERY" : "APPROACHING_SHORT_MA";
  }
  return i.madeRecentNewLow ? "DETERIORATING" : "STABILIZING";
}

/** Coarse grouping used for cohorts. */
export function marketPhase(s: MarketState): "DETERIORATING" | "RECOVERING" | "ABOVE_MA50" {
  if (s === "DETERIORATING" || s === "STABILIZING") return "DETERIORATING";
  if (s === "FRESH_MA50_RECLAIM" || s === "EXTENDED_AFTER_RECOVERY") return "ABOVE_MA50";
  return "RECOVERING";
}

export type Breadth = {
  n: number;
  pctAboveMa10: number;
  pctAboveMa20: number;
  pctAboveMa50: number;
  pctUp20d: number;
  /** 52-week extremes; null when too few symbols have a year of history. */
  newHighs: number;
  newLows: number;
  nWithYear: number;
  /** Symbols whose close is above MA10 AND MA10 is rising — structure turning up. */
  structureImproving: number;
  /** Symbols whose 20-session relative return beat the index and is improving. */
  rsImproving: number;
};

/**
 * Aggregate per-symbol observations into breadth.
 *
 * Kept separate from the per-symbol feature code so the same observations can
 * feed both, and so this stays a pure fold over whatever the caller decided the
 * point-in-time universe was.
 */
export function computeBreadth(
  rows: ReadonlyArray<{
    aboveMa10: boolean;
    aboveMa20: boolean;
    aboveMa50: boolean;
    up20d: boolean;
    newHigh52w: boolean | null;
    newLow52w: boolean | null;
    structureImproving: boolean;
    rsImproving: boolean;
  }>
): Breadth | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const pct = (k: number) => Number(((k / n) * 100).toFixed(2));
  const withYear = rows.filter((r) => r.newHigh52w !== null);
  return {
    n,
    pctAboveMa10: pct(rows.filter((r) => r.aboveMa10).length),
    pctAboveMa20: pct(rows.filter((r) => r.aboveMa20).length),
    pctAboveMa50: pct(rows.filter((r) => r.aboveMa50).length),
    pctUp20d: pct(rows.filter((r) => r.up20d).length),
    newHighs: withYear.filter((r) => r.newHigh52w).length,
    newLows: withYear.filter((r) => r.newLow52w).length,
    nWithYear: withYear.length,
    structureImproving: rows.filter((r) => r.structureImproving).length,
    rsImproving: rows.filter((r) => r.rsImproving).length,
  };
}
