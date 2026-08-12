/**
 * Early-leadership instrumentation.
 *
 * Hypothesis under test: while the index is still below its MA50, some names
 * turn up first — reclaiming structure after a failed breakdown, with relative
 * strength inflecting from negative and volume confirming — and spotting that
 * early would allow an entry nearer the structural stop than waiting for Gate 1
 * to PASS.
 *
 * Everything here is MEASUREMENT. No function returns a buy decision and nothing
 * is wired into the scanner.
 *
 * On thresholds, stated precisely rather than flatteringly: none of these
 * cutoffs was OPTIMISED against outcomes, but that is not the same as their
 * being unfitted. Where a cutoff was needed it is a repo constant
 * (`RS_LOOKBACK_20`, `EXCURSION_HORIZON_SESSIONS`, `GATE2_RANGE_DAYS`) or a
 * natural boundary (zero, parity, "above its own average"), and cohort
 * membership uses within-session quantiles rather than fixed levels. A quantile
 * is still a choice, and the conjunction of several conditions is still a model.
 * Nothing here was tuned by looking at a result, but the shape was chosen by a
 * reader who had already seen the 2022 regime diagnostic.
 *
 * POINT-IN-TIME CONTRACT: every function takes full arrays plus an `end` index
 * and reads only `[0..end]`. `leadership-features.test.ts` proves this by
 * computing each feature on a truncated copy and requiring identical output —
 * the same standard the replay engine is held to.
 */

import { FRESH_RECLAIM_SESSIONS } from "./market-state";

export type Bars = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[];

/** Simple moving average series, causal: element i uses [i-period+1..i]. */
export function rollingMean(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export type RsInflection = {
  /** Stock N-session return minus index N-session return, in points. */
  rs20: number | null;
  rs50: number | null;
  /** rs20 today minus rs20 five sessions ago — the inflection, not the level. */
  rs20Delta5: number | null;
  /** Consecutive sessions the stock out-returned the index day over day. */
  consecutiveOutperformDays: number;
  /**
   * Negative level with a positive slope: lagging, but less so each session.
   * This is the shape the hypothesis is about, and it is deliberately NOT
   * "high RS" — the RS audit found the top RS quintile has the worst forward
   * return (docs/trading/replay/BASELINE-V2-EXECUTABLE-STOPS.md).
   */
  earlyRsImproving: boolean;
  /** Already-strong: positive level. Kept separate so the two can be compared. */
  alreadyExtendedRs: boolean;
};

export function computeRsInflection(
  stockCloses: readonly number[],
  indexClosesAligned: readonly (number | null)[],
  end: number,
  lookback20: number,
  lookback50: number
): RsInflection {
  const rel = (n: number, at: number): number | null => {
    if (at < n) return null;
    const s0 = stockCloses[at - n];
    const s1 = stockCloses[at];
    const i0 = indexClosesAligned[at - n];
    const i1 = indexClosesAligned[at];
    if (s0 == null || s1 == null || i0 == null || i1 == null || s0 <= 0 || i0 <= 0) return null;
    return ((s1 - s0) / s0) * 100 - ((i1 - i0) / i0) * 100;
  };

  const rs20 = rel(lookback20, end);
  const rs50 = rel(lookback50, end);
  const rs20Prev = rel(lookback20, end - 5);
  const rs20Delta5 = rs20 != null && rs20Prev != null ? rs20 - rs20Prev : null;

  let streak = 0;
  for (let i = end; i > 0; i--) {
    const s0 = stockCloses[i - 1];
    const s1 = stockCloses[i];
    const i0 = indexClosesAligned[i - 1];
    const i1 = indexClosesAligned[i];
    if (s0 == null || s1 == null || i0 == null || i1 == null || s0 <= 0 || i0 <= 0) break;
    if ((s1 - s0) / s0 > (i1 - i0) / i0) streak++;
    else break;
  }

  return {
    rs20,
    rs50,
    rs20Delta5,
    consecutiveOutperformDays: streak,
    earlyRsImproving: rs20 != null && rs20Delta5 != null && rs20 < 0 && rs20Delta5 > 0,
    alreadyExtendedRs: rs20 != null && rs20 > 0,
  };
}

export type UndercutReclaim = {
  present: boolean;
  /** The support level that was undercut — the lowest low of the base before the break. */
  supportLevel: number | null;
  undercutPct: number | null;
  sessionsBelowSupport: number | null;
  reclaimPct: number | null;
  sessionsHoldingReclaim: number | null;
  /** A higher low printed after the reclaim — the structure confirming. */
  higherLowAfterReclaim: boolean;
};

/**
 * Failed breakdown: price undercut a prior support shelf, spent a short time
 * below it, and closed back above.
 *
 * `baseLookback` defines the shelf and `maxSessionsBelow` bounds how long a
 * break can last and still count as failed. Both are structural definitions of
 * the pattern, fixed before any outcome was measured.
 */
export function detectUndercutReclaim(
  bars: Bars,
  end: number,
  baseLookback: number,
  maxSessionsBelow: number
): UndercutReclaim {
  const none: UndercutReclaim = {
    present: false,
    supportLevel: null,
    undercutPct: null,
    sessionsBelowSupport: null,
    reclaimPct: null,
    sessionsHoldingReclaim: null,
    higherLowAfterReclaim: false,
  };
  if (end < baseLookback + maxSessionsBelow + 2) return none;

  // Search the most recent reclaim first, then longer-held ones. For each
  // candidate reclaim session, try every admissible break length: the support
  // shelf is the lowest low of the `baseLookback` sessions BEFORE the break
  // began, the session before the break must have been holding it, every
  // session of the break must have closed below it, and the reclaim session
  // must close back above.
  let found: { breakStart: number; reclaimIdx: number; support: number } | null = null;
  outer: for (let hold = 0; hold <= maxSessionsBelow; hold++) {
    const reclaimIdx = end - hold;
    if (reclaimIdx <= baseLookback + 2) break;

    for (let below = 1; below <= maxSessionsBelow; below++) {
      const breakStart = reclaimIdx - below;
      if (breakStart - baseLookback < 0 || breakStart < 1) break;

      let support = Infinity;
      for (let k = breakStart - baseLookback; k < breakStart; k++) support = Math.min(support, bars[k]!.low);
      if (!Number.isFinite(support) || support <= 0) continue;

      // The shelf must have been intact immediately before the break.
      if (bars[breakStart - 1]!.close < support) continue;

      let allBelow = true;
      for (let k = breakStart; k < reclaimIdx; k++) {
        if (bars[k]!.close >= support) {
          allBelow = false;
          break;
        }
      }
      if (!allBelow) continue;
      if (!(bars[reclaimIdx]!.close > support)) continue;

      found = { breakStart, reclaimIdx, support };
      break outer;
    }
  }
  if (!found) return none;

  {
    const { breakStart, reclaimIdx, support } = found;
    const below = reclaimIdx - breakStart;

    let lowestDuringBreak = Infinity;
    for (let k = breakStart; k < reclaimIdx; k++) lowestDuringBreak = Math.min(lowestDuringBreak, bars[k]!.low);

    // A higher low after the reclaim: any subsequent session whose low sits
    // above the break's low, without closing back under support.
    let higherLow = false;
    for (let k = reclaimIdx + 1; k <= end; k++) {
      if (bars[k]!.close < support) {
        higherLow = false;
        break;
      }
      if (bars[k]!.low > lowestDuringBreak) higherLow = true;
    }

    return {
      present: true,
      supportLevel: support,
      undercutPct: ((lowestDuringBreak - support) / support) * 100,
      sessionsBelowSupport: below,
      reclaimPct: ((bars[reclaimIdx]!.close - support) / support) * 100,
      sessionsHoldingReclaim: end - reclaimIdx,
      higherLowAfterReclaim: higherLow,
    };
  }
}

export type AbsorptionProxy = {
  /**
   * PROXY ONLY. This dataset is daily OHLCV with no bid/ask or aggressor side,
   * so none of these measure order flow. They measure where price closed within
   * its range and how much volume accompanied a decline — consistent with
   * absorption, and equally consistent with several other things.
   */
  lowerWickRatio: number | null;
  closeLocationValue: number | null;
  downsideReturnPerRelVolume: number | null;
  breakdownRelVolume: number | null;
  reclaimRelVolume: number | null;
  baseVolumeContraction: number | null;
  /** Sessions since the last close below the prior session's low. */
  sessionsWithoutDownsideFollowThrough: number;
};

export function computeAbsorptionProxy(
  bars: Bars,
  end: number,
  volLookback: number,
  reclaimIdx: number | null
): AbsorptionProxy {
  const b = bars[end]!;
  const range = b.high - b.low;
  const volWindowStart = Math.max(0, end - volLookback);
  const vols = bars.slice(volWindowStart, end).map((x) => x.volume);
  const medVol = vols.length ? [...vols].sort((a, c) => a - c)[Math.floor(vols.length / 2)]! : null;
  const relVol = medVol && medVol > 0 ? b.volume / medVol : null;

  const ret = end > 0 ? ((b.close - bars[end - 1]!.close) / bars[end - 1]!.close) * 100 : null;

  let noFollowThrough = 0;
  for (let i = end; i > 0; i--) {
    if (bars[i]!.close < bars[i - 1]!.low) break;
    noFollowThrough++;
  }

  // Volume contraction across the most recent base: latest half vs earlier half.
  let contraction: number | null = null;
  if (end >= volLookback) {
    const half = Math.floor(volLookback / 2);
    const recent = bars.slice(end - half + 1, end + 1).reduce((a, x) => a + x.volume, 0) / half;
    const earlier = bars.slice(end - volLookback + 1, end - half + 1).reduce((a, x) => a + x.volume, 0) / (volLookback - half);
    contraction = earlier > 0 ? recent / earlier : null;
  }

  const relVolAt = (idx: number): number | null => {
    if (idx < 1) return null;
    const s = Math.max(0, idx - volLookback);
    const v = bars.slice(s, idx).map((x) => x.volume);
    if (!v.length) return null;
    const m = [...v].sort((a, c) => a - c)[Math.floor(v.length / 2)]!;
    return m > 0 ? bars[idx]!.volume / m : null;
  };

  return {
    lowerWickRatio: range > 0 ? (Math.min(b.open, b.close) - b.low) / range : null,
    closeLocationValue: range > 0 ? ((b.close - b.low) - (b.high - b.close)) / range : null,
    downsideReturnPerRelVolume: ret != null && ret < 0 && relVol && relVol > 0 ? ret / relVol : null,
    breakdownRelVolume: reclaimIdx != null ? relVolAt(Math.max(0, reclaimIdx - 1)) : null,
    reclaimRelVolume: reclaimIdx != null ? relVolAt(reclaimIdx) : null,
    baseVolumeContraction: contraction,
    sessionsWithoutDownsideFollowThrough: noFollowThrough,
  };
}

export type StructureRecovery = {
  aboveMa10: boolean;
  aboveMa20: boolean;
  aboveMa50: boolean;
  ma10Rising: boolean;
  ma20Rising: boolean;
  /** Closed back above MA10 within the last `FRESH` sessions after being below. */
  freshMa10Reclaim: boolean;
  higherHigh: boolean;
  higherLow: boolean;
  /** Swing-low anchored stop, mirroring Gate 2's construction (low x (1 - buffer)). */
  structuralStop: number | null;
  distanceToStopPct: number | null;
  /** Stop distance expressed in ATR, so it is comparable across volatility. */
  distanceToStopAtr: number | null;
};

export function computeStructureRecovery(
  bars: Bars,
  end: number,
  ma10: (number | null)[],
  ma20: (number | null)[],
  ma50: (number | null)[],
  swingLookback: number,
  stopBufferFrac: number,
  atr: number | null,
  /** Sessions within which a move back above MA10 counts as fresh. */
  freshWithinSessions = FRESH_RECLAIM_SESSIONS
): StructureRecovery {
  const c = bars[end]!.close;
  const a10 = ma10[end] ?? null;
  const a20 = ma20[end] ?? null;
  const a50 = ma50[end] ?? null;

  let fresh = false;
  if (a10 != null && c >= a10) {
    for (let k = 1; k <= freshWithinSessions && end - k >= 0; k++) {
      const prev = ma10[end - k];
      if (prev != null && bars[end - k]!.close < prev) {
        fresh = true;
        break;
      }
    }
  }

  const start = Math.max(0, end - swingLookback + 1);
  let swingLow = Infinity;
  for (let k = start; k <= end; k++) swingLow = Math.min(swingLow, bars[k]!.low);
  const stop = Number.isFinite(swingLow) ? swingLow * (1 - stopBufferFrac) : null;

  const halfStart = Math.max(0, end - Math.floor(swingLookback / 2) + 1);
  let recentHigh = -Infinity;
  let recentLow = Infinity;
  let priorHigh = -Infinity;
  let priorLow = Infinity;
  for (let k = halfStart; k <= end; k++) {
    recentHigh = Math.max(recentHigh, bars[k]!.high);
    recentLow = Math.min(recentLow, bars[k]!.low);
  }
  for (let k = start; k < halfStart; k++) {
    priorHigh = Math.max(priorHigh, bars[k]!.high);
    priorLow = Math.min(priorLow, bars[k]!.low);
  }

  return {
    aboveMa10: a10 != null && c >= a10,
    aboveMa20: a20 != null && c >= a20,
    aboveMa50: a50 != null && c >= a50,
    ma10Rising: a10 != null && ma10[end - 5] != null && a10 > ma10[end - 5]!,
    ma20Rising: a20 != null && ma20[end - 5] != null && a20 > ma20[end - 5]!,
    freshMa10Reclaim: fresh,
    higherHigh: Number.isFinite(priorHigh) && recentHigh > priorHigh,
    higherLow: Number.isFinite(priorLow) && recentLow > priorLow,
    structuralStop: stop,
    distanceToStopPct: stop != null && c > 0 ? ((c - stop) / c) * 100 : null,
    distanceToStopAtr: stop != null && atr != null && atr > 0 ? (c - stop) / atr : null,
  };
}
