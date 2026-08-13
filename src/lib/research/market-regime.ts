/**
 * Market regime as two independent axes: a capitalisation-weighted index and an
 * equal-weighted cross-section.
 *
 * Gate 1 reads VN-Index alone. VN-Index is cap-weighted, so a handful of large
 * names can hold it up while the median stock falls — and the 2022 diagnostic
 * found exactly that (docs/trading/replay/WHY-2022.md). This module keeps the
 * two measurements SEPARATE rather than combining or residualising them, because
 * the divergence between them is the thing worth seeing.
 *
 * CLASSIFICATION ONLY. Nothing here predicts, ranks, gates or sizes. No cutoff
 * was chosen by looking at a forward return.
 *
 * Both axes split on a NATURAL boundary rather than a fitted one:
 *
 *   index axis   — is the index at or above its own MA50?
 *   breadth axis — is more than half the market above its own MA50?
 *
 * "More than half" is not a tuned parameter; it is what it means for a majority
 * of the market to be in an uptrend by its own measure. The sensitivity of every
 * result to that boundary is reported rather than assumed away.
 */

export type IndexAxis = "INDEX_STRONG" | "INDEX_WEAK";
export type BreadthAxis = "BREADTH_STRONG" | "BREADTH_WEAK";

export type Regime =
  /** Index above MA50, majority of stocks above theirs. Health agrees. */
  | "BROAD_ADVANCE"
  /** Index above MA50, majority of stocks below theirs. Large caps carrying it. */
  | "NARROW_RALLY"
  /** Index below MA50, majority of stocks above theirs. The cross-section leads. */
  | "RECOVERY_UNDERNEATH"
  /** Both below. Nothing is working. */
  | "SYSTEMIC_WEAKNESS";

export const REGIMES: readonly Regime[] = [
  "BROAD_ADVANCE",
  "NARROW_RALLY",
  "RECOVERY_UNDERNEATH",
  "SYSTEMIC_WEAKNESS",
] as const;

/** Majority of the market participating. A natural boundary, not a tuned one. */
export const BREADTH_MAJORITY_PCT = 50;

export type RegimeInput = {
  indexClose: number;
  indexMa50: number | null;
  /** Percent of the eligible universe trading above its own MA50. */
  pctAboveMa50: number | null;
  /** Eligible symbols this session. Below `minUniverse` the breadth axis is unusable. */
  universeN: number;
};

export type RegimeClassification = {
  regime: Regime;
  index: IndexAxis;
  breadth: BreadthAxis;
};

/**
 * Classify one session. Returns null when either axis cannot be measured —
 * an unmeasurable session is excluded, never guessed.
 */
export function classifyRegime(
  i: RegimeInput,
  opts: { minUniverse: number; breadthCutoffPct?: number } = { minUniverse: 100 }
): RegimeClassification | null {
  const cutoff = opts.breadthCutoffPct ?? BREADTH_MAJORITY_PCT;
  if (i.indexMa50 == null || i.pctAboveMa50 == null) return null;
  if (i.universeN < opts.minUniverse) return null;

  const index: IndexAxis = i.indexClose >= i.indexMa50 ? "INDEX_STRONG" : "INDEX_WEAK";
  const breadth: BreadthAxis = i.pctAboveMa50 >= cutoff ? "BREADTH_STRONG" : "BREADTH_WEAK";

  const regime: Regime =
    index === "INDEX_STRONG"
      ? breadth === "BREADTH_STRONG" ? "BROAD_ADVANCE" : "NARROW_RALLY"
      : breadth === "BREADTH_STRONG" ? "RECOVERY_UNDERNEATH" : "SYSTEMIC_WEAKNESS";

  return { regime, index, breadth };
}

/** True when the two axes disagree — the case Gate 1 structurally cannot see. */
export function isDivergent(c: RegimeClassification): boolean {
  return c.regime === "NARROW_RALLY" || c.regime === "RECOVERY_UNDERNEATH";
}

export type RegimeRun = {
  regime: Regime;
  startIdx: number;
  endIdx: number;
  /** Sessions in the run. Runs, not sessions, are the independent unit. */
  length: number;
};

/**
 * Collapse a per-session series into contiguous runs.
 *
 * A regime that changes every session is a noise generator, not a description of
 * the market, and run statistics are what expose that. Sessions inside one run
 * are also not independent observations, so anything inferential must resample
 * runs rather than days.
 */
export function toRuns(series: readonly (Regime | null)[]): RegimeRun[] {
  const runs: RegimeRun[] = [];
  let i = 0;
  while (i < series.length) {
    const r = series[i];
    if (r == null) { i++; continue; }
    let j = i;
    while (j + 1 < series.length && series[j + 1] === r) j++;
    runs.push({ regime: r, startIdx: i, endIdx: j, length: j - i + 1 });
    i = j + 1;
  }
  return runs;
}

/**
 * Transition counts between consecutive DIFFERENT runs, plus the one-session
 * flip rate — the share of runs that lasted a single session.
 */
export function transitionStats(runs: readonly RegimeRun[]): {
  matrix: Record<string, Record<string, number>>;
  oneDayFlipRate: number;
  medianRunLength: number;
} {
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of REGIMES) {
    matrix[a] = {};
    for (const b of REGIMES) matrix[a]![b] = 0;
  }
  for (let k = 1; k < runs.length; k++) {
    matrix[runs[k - 1]!.regime]![runs[k]!.regime]! += 1;
  }
  const lengths = runs.map((r) => r.length).sort((a, b) => a - b);
  return {
    matrix,
    oneDayFlipRate: runs.length ? runs.filter((r) => r.length === 1).length / runs.length : 0,
    medianRunLength: lengths.length ? lengths[Math.floor(lengths.length / 2)]! : 0,
  };
}
