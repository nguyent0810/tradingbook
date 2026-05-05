import { sma } from "@/lib/playbook/indicators";
import {
  GATE2_BREAKOUT_RECENCY_BARS,
  GATE2_DELTA_PULLBACK,
  GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  GATE2_MAX_PULLBACK_DEPTH_FRAC,
  GATE2_MIN_RISK_TO_STOP_FRAC,
  GATE2_RANK_DEPTH_CAP,
  GATE2_RANK_EXT_CAP,
  GATE2_RANK_MA_CAP,
  GATE2_RANK_VOL_CAP,
  GATE2_RANGE_DAYS,
  GATE2_STOP_BUFFER_FRAC,
  GATE2_VOL_RATIO_A,
  GATE2_VOL_RATIO_B,
} from "./constants";
import type { BreakoutPullbackEvaluation, Gate2BarInput } from "./types";

function utcDayOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function dateKey(d: Date): string {
  const x = utcDayOnly(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** One row per calendar day (last wins), ascending. */
export function sortDedupeGate2Bars(
  bars: ReadonlyArray<Gate2BarInput>
): Gate2BarInput[] {
  const byKey = new Map<string, Gate2BarInput>();
  for (const b of bars) {
    const k = dateKey(b.date);
    byKey.set(k, { ...b, date: utcDayOnly(b.date) });
  }
  return [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function rangeHighBeforeJ(bars: Gate2BarInput[], j: number): number {
  const slice = bars.slice(j - GATE2_RANGE_DAYS, j);
  let hi = slice[0]?.high ?? 0;
  for (const b of slice) {
    if (b.high > hi) hi = b.high;
  }
  return hi;
}

function minLowInRange(bars: Gate2BarInput[], from: number, toInclusive: number): number {
  let m = bars[from]!.low;
  for (let i = from + 1; i <= toInclusive; i++) {
    if (bars[i]!.low < m) m = bars[i]!.low;
  }
  return m;
}

export function computeGate2RankScore(params: {
  volRatio: number;
  close: number;
  breakoutLevel: number;
  ma50: number;
  minLowSinceBreakout: number;
}): number {
  const { volRatio, close, breakoutLevel, ma50, minLowSinceBreakout } = params;
  const volTerm = 1000 * Math.min(volRatio, GATE2_RANK_VOL_CAP);
  const extRaw =
    breakoutLevel > 0
      ? ((close - breakoutLevel) / breakoutLevel) * 100
      : 0;
  const extTerm = 100 * Math.min(Math.max(0, extRaw), GATE2_RANK_EXT_CAP);
  const maRaw = ma50 > 0 ? ((close - ma50) / ma50) * 100 : 0;
  const maTerm = 50 * Math.min(Math.max(0, maRaw), GATE2_RANK_MA_CAP);
  const depthRaw =
    breakoutLevel > 0
      ? Math.max(0, (breakoutLevel - minLowSinceBreakout) / breakoutLevel)
      : 0;
  const depthPenalty = 200 * Math.min(depthRaw, GATE2_RANK_DEPTH_CAP);
  return volTerm + extTerm + maTerm - depthPenalty;
}

function invalidBase(
  reasons: string[],
  barDate: Date,
  close = 0
): BreakoutPullbackEvaluation {
  return {
    quality: "INVALID",
    rankScore: 0,
    breakoutLevel: 0,
    pullbackZoneLow: 0,
    pullbackZoneHigh: 0,
    stopLevel: 0,
    close,
    reasons,
    barDate,
  };
}

/** Swing template needs finite levels and room between entry and stop. Exported for tests. */
export function validateSwingTradeStructure(params: {
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  close: number;
}): string | null {
  const {
    breakoutLevel,
    pullbackZoneLow,
    pullbackZoneHigh,
    stopLevel,
    close,
  } = params;
  if (
    !(
      breakoutLevel > 0 &&
      pullbackZoneLow > 0 &&
      pullbackZoneHigh > 0 &&
      Number.isFinite(stopLevel) &&
      stopLevel > 0
    )
  ) {
    return "Incomplete setup—missing breakout, pullback zone, or stop; cannot size or execute.";
  }
  if (pullbackZoneLow > pullbackZoneHigh + 1e-12) {
    return "Pullback zone is malformed (floor above ceiling).";
  }
  if (stopLevel >= close) {
    return "Stop would be at or above entry—no actionable downside anchor for a long.";
  }
  const riskFrac = (close - stopLevel) / close;
  if (riskFrac < GATE2_MIN_RISK_TO_STOP_FRAC) {
    return `Entry→stop distance (${(riskFrac * 100).toFixed(2)}%) is below minimum swing risk (${(GATE2_MIN_RISK_TO_STOP_FRAC * 100).toFixed(2)}%).`;
  }
  return null;
}

/**
 * Gate 2 — deterministic breakout + pullback setup on daily stock bars.
 *
 * @param bars — ascending by session date (OHLCV); deduped by calendar day.
 * @param expectedLatestSession — must match the latest bar’s UTC calendar date.
 */
export function evaluateBreakoutPullbackCandidate(
  bars: ReadonlyArray<Gate2BarInput>,
  expectedLatestSession: Date
): BreakoutPullbackEvaluation {
  const sorted = sortDedupeGate2Bars(bars);
  const reasons: string[] = [];

  if (sorted.length < 50) {
    reasons.push(`Need at least 50 daily bars (got ${sorted.length}).`);
    const last = sorted[sorted.length - 1];
    return invalidBase(
      reasons,
      last?.date ?? expectedLatestSession,
      last?.close ?? 0
    );
  }

  const L = sorted.length - 1;
  const lastBar = sorted[L]!;
  const expectedDay = utcDayOnly(expectedLatestSession).getTime();
  const lastDay = lastBar.date.getTime();
  if (lastDay !== expectedDay) {
    reasons.push(
      `Latest bar date ${dateKey(lastBar.date)} does not match expected session ${dateKey(utcDayOnly(expectedLatestSession))}.`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }

  const closes = sorted.map((b) => b.close);
  const ma20Series = sma(closes, 20);
  const ma50Series = sma(closes, 50);
  const ma20 = ma20Series[L];
  const ma50 = ma50Series[L];

  if (ma20 === undefined || ma50 === undefined || Number.isNaN(ma20) || Number.isNaN(ma50)) {
    reasons.push("Could not compute MA20/MA50 at evaluation bar.");
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }

  const c = lastBar.close;
  if (c < ma50) {
    reasons.push(
      `Trend not supportive for long swings—price finished below its 50-day average (${ma50.toFixed(2)} vs close ${c.toFixed(2)}). Wait or skip.`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  if (ma20 < ma50) {
    reasons.push(
      `Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries.`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Trend OK for long-bias pullback: close above MA50 and MA20 ≥ MA50.`
  );

  const startJ = Math.max(GATE2_RANGE_DAYS, L - GATE2_BREAKOUT_RECENCY_BARS);
  let tB: number | null = null;
  let breakoutLevel = 0;

  for (let j = startJ; j <= L - 1; j++) {
    const rh = rangeHighBeforeJ(sorted, j);
    if (sorted[j]!.close > rh) {
      tB = j;
      breakoutLevel = rh;
      break;
    }
  }

  if (tB === null) {
    reasons.push(
      `No qualifying breakout in the last ${GATE2_BREAKOUT_RECENCY_BARS} sessions—need a fresh push above the prior ${GATE2_RANGE_DAYS}-day range high (excluding today).`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Fresh breakout: cleared prior resistance ${breakoutLevel.toFixed(2)} at session offset ${tB} (${L - tB} bars ago).`
  );

  let pullbackDigest = false;
  for (let k = tB + 1; k <= L; k++) {
    if (sorted[k]!.low < sorted[tB]!.close) {
      pullbackDigest = true;
      break;
    }
  }
  if (!pullbackDigest) {
    reasons.push(
      "Need a digestion dip after the impulse—no session yet traded below the breakout-day close; avoid chasing straight-line breaks."
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    "Pullback/digestion observed—price dipped below the breakout-day close before building the current hold."
  );

  const pullbackZoneHigh = breakoutLevel;
  const pullbackZoneLow = Math.max(
    breakoutLevel * (1 - GATE2_DELTA_PULLBACK),
    ma20
  );

  for (let i = tB; i <= L; i++) {
    if (sorted[i]!.close < breakoutLevel) {
      reasons.push(
        `Setup failed—session closed back under resistance ${breakoutLevel.toFixed(2)}; former breakout not holding.`
      );
      return invalidBase(reasons, lastBar.date, lastBar.close);
    }
  }

  for (let i = tB + 1; i <= L - 1; i++) {
    const m50i = ma50Series[i];
    if (m50i !== undefined && !Number.isNaN(m50i) && sorted[i]!.close < m50i) {
      reasons.push(
        `Mid-pullback close dipped under the 50-day line before today—reset and wait for cleaner structure.`
      );
      return invalidBase(reasons, lastBar.date, lastBar.close);
    }
  }

  const breakoutDayLow = sorted[tB]!.low;
  let sweptBreakoutLow = false;
  for (let i = tB; i <= L; i++) {
    if (sorted[i]!.low < breakoutDayLow) {
      sweptBreakoutLow = true;
      break;
    }
  }
  if (sweptBreakoutLow && c < ma20) {
    reasons.push(
      "Lower lows vs the breakout session with a weak finish—pattern broken for this template."
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }

  if (L >= 1) {
    const z = pullbackZoneLow;
    if (sorted[L - 1]!.close < z && c < z) {
      reasons.push(
        "Two closes in a row under the pullback zone floor—stand aside until price reclaims the zone."
      );
      return invalidBase(reasons, lastBar.date, lastBar.close);
    }
  }

  if (lastBar.low > pullbackZoneHigh || c < pullbackZoneLow) {
    reasons.push(
      `Current bar does not interact with the pullback box (${pullbackZoneLow.toFixed(2)}–${pullbackZoneHigh.toFixed(2)})—no actionable entry location yet.`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Price is interacting with the pullback zone floor–ceiling (${pullbackZoneLow.toFixed(2)}–${pullbackZoneHigh.toFixed(2)}).`
  );

  const volWindow = sorted.slice(L - GATE2_RANGE_DAYS, L).map((b) => b.volume);
  const volMed = median(volWindow);
  if (volMed <= 0 || Number.isNaN(volMed)) {
    reasons.push("Cannot score participation—median volume over the prior 20 sessions is unusable.");
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  const volRatio = lastBar.volume / volMed;
  if (volRatio < GATE2_VOL_RATIO_B) {
    reasons.push(
      `Participation too thin—today’s volume is ${volRatio.toFixed(2)}× the 20-day median (need ≥ ${GATE2_VOL_RATIO_B}×).`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Liquidity check passed—volume ${volRatio.toFixed(2)}× the 20-day median.`
  );

  const minLowSince = minLowInRange(sorted, tB, L);

  const extensionFrac =
    breakoutLevel > 0 ? (c - breakoutLevel) / breakoutLevel : 0;
  if (extensionFrac > GATE2_MAX_BREAKOUT_EXTENSION_FRAC) {
    reasons.push(
      `Entry is ${(extensionFrac * 100).toFixed(2)}% above the breakout level—exceeds the ${(GATE2_MAX_BREAKOUT_EXTENSION_FRAC * 100).toFixed(0)}% swing cap (avoid chasing).`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Extension vs breakout level: ${(extensionFrac * 100).toFixed(2)}% (≤ ${(GATE2_MAX_BREAKOUT_EXTENSION_FRAC * 100).toFixed(0)}%).`
  );

  const depthFrac =
    breakoutLevel > 0 && minLowSince < breakoutLevel
      ? (breakoutLevel - minLowSince) / breakoutLevel
      : 0;
  if (depthFrac > GATE2_MAX_PULLBACK_DEPTH_FRAC) {
    reasons.push(
      `Pullback violated ${(GATE2_MAX_PULLBACK_DEPTH_FRAC * 100).toFixed(0)}% max depth under the breakout—retracement ${(depthFrac * 100).toFixed(2)}% is too heavy for this playbook.`
    );
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    depthFrac > 0
      ? `Pullback depth under the breakout level: ${(depthFrac * 100).toFixed(2)}% (within ${(GATE2_MAX_PULLBACK_DEPTH_FRAC * 100).toFixed(0)}%).`
      : `No dip materially below the breakout level—depth OK.`
  );

  const stopLevel = minLowSince * (1 - GATE2_STOP_BUFFER_FRAC);

  const structuralErr = validateSwingTradeStructure({
    breakoutLevel,
    pullbackZoneLow,
    pullbackZoneHigh,
    stopLevel,
    close: c,
  });
  if (structuralErr) {
    reasons.push(structuralErr);
    return invalidBase(reasons, lastBar.date, lastBar.close);
  }
  reasons.push(
    `Stop anchor: ${stopLevel.toFixed(2)} (≈${(GATE2_STOP_BUFFER_FRAC * 100).toFixed(0)}% cushion under recent swing low ${minLowSince.toFixed(2)}).`
  );

  const rankScore = computeGate2RankScore({
    volRatio,
    close: c,
    breakoutLevel,
    ma50,
    minLowSinceBreakout: minLowSince,
  });

  let quality: "A" | "B";
  if (volRatio >= GATE2_VOL_RATIO_A && c >= ma20) {
    quality = "A";
    reasons.push(
      `Tier A — strong participation (${volRatio.toFixed(2)}× median, ≥${GATE2_VOL_RATIO_A}×) and constructive close vs MA20.`
    );
  } else {
    quality = "B";
    reasons.push(
      `Tier B — setup valid but softer participation or close vs MA20 (still ≥ ${GATE2_VOL_RATIO_B}× median volume).`
    );
  }

  return {
    quality,
    rankScore,
    breakoutLevel,
    pullbackZoneLow,
    pullbackZoneHigh,
    stopLevel,
    close: c,
    reasons,
    barDate: lastBar.date,
  };
}
