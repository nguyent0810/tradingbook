import type {
  EvaluateWatchHealthInput,
  OhlcvBar,
  SetupHealthFlag,
  SetupHealthLevelValue,
  WatchHealthMeta,
  WatchHealthResult,
} from "./types";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function compareDay(a: Date, b: Date): number {
  return dayKey(a).localeCompare(dayKey(b));
}

/** Bars on or before eval, ascending by date. */
export function filterBarsThroughEval(bars: OhlcvBar[], evalBarDate: Date): OhlcvBar[] {
  const ek = dayKey(evalBarDate);
  return [...bars]
    .filter((b) => dayKey(b.date) <= ek)
    .sort((a, b) => compareDay(a.date, b.date));
}

/** Min distance from close to segment [zoneLow, zoneHigh] as fractional distance to nearest bound. */
export function distanceToZonePct(close: number, zoneLow: number, zoneHigh: number): number {
  if (zoneLow <= 0 || zoneHigh <= 0) return 0;
  if (close >= zoneLow && close <= zoneHigh) return 0;
  if (close > zoneHigh) return (close - zoneHigh) / zoneHigh;
  return (zoneLow - close) / zoneLow;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function barsInteractionZone(
  low: number,
  high: number,
  zoneLow: number,
  zoneHigh: number
): boolean {
  return low <= zoneHigh && high >= zoneLow;
}

/**
 * Derives extended tier flag (mutually exclusive). Only when close above pullbackZoneHigh.
 */
function extendedTierFlag(
  close: number,
  pullbackZoneHigh: number
): SetupHealthFlag | null {
  if (pullbackZoneHigh <= 0 || close <= pullbackZoneHigh) return null;
  const pct = (close - pullbackZoneHigh) / pullbackZoneHigh;
  if (pct > 0.12) return "CHASE";
  if (pct > 0.08) return "TOO_EXTENDED";
  if (pct > 0.05) return "EXTENDED";
  return null;
}

function computeScore(flags: SetupHealthFlag[]): number {
  let score = 100;
  if (flags.includes("CHASE")) score -= 55;
  else if (flags.includes("TOO_EXTENDED")) score -= 40;
  else if (flags.includes("EXTENDED")) score -= 25;

  if (flags.includes("AGING_SETUP")) score -= 20;
  if (flags.includes("VOLUME_FADE")) score -= 25;
  if (flags.includes("FAILED_TO_PULLBACK")) score -= 30;
  if (flags.includes("REVERSAL_RISK")) score -= 40;
  if (flags.includes("DEAD_SETUP")) score -= 50;

  return Math.max(0, Math.min(100, score));
}

function deriveLevel(flags: SetupHealthFlag[]): SetupHealthLevelValue {
  if (flags.includes("CHASE") || flags.includes("TOO_EXTENDED") || flags.includes("DEAD_SETUP")) {
    return "DEAD";
  }

  let n = 0;
  if (flags.includes("EXTENDED")) n += 1;
  if (flags.includes("AGING_SETUP")) n += 1;
  if (flags.includes("VOLUME_FADE")) n += 1;
  if (flags.includes("FAILED_TO_PULLBACK")) n += 1;
  if (flags.includes("REVERSAL_RISK")) n += 1;

  if (n === 0) return "HEALTHY";
  if (n === 1) return "WARNING";
  return "AT_RISK";
}

/**
 * Pure health evaluation — no Prisma, no Gate 2 imports.
 */
export function evaluateWatchHealth(input: EvaluateWatchHealthInput): WatchHealthResult {
  const {
    breakoutLevel,
    pullbackZoneLow,
    pullbackZoneHigh,
    firstSeenBarDate,
    evalBarDate,
    barsAscThroughEval,
  } = input;

  const bars = filterBarsThroughEval(barsAscThroughEval, evalBarDate);
  const evalBar = bars.length > 0 ? bars[bars.length - 1]! : null;

  const flags: SetupHealthFlag[] = [];

  const meta: WatchHealthMeta = {
    sessionsAfterFirstSeen: 0,
    sessionsSinceBreakout: null,
    extendedPct: null,
    distanceToZonePct: 0,
    median20Volume: null,
  };

  if (!evalBar) {
    return {
      flags: [],
      score: 100,
      level: "HEALTHY",
      meta,
    };
  }

  const close = evalBar.close;

  meta.distanceToZonePct = distanceToZonePct(close, pullbackZoneLow, pullbackZoneHigh);

  const sessionsAfterFirstSeen = bars.filter(
    (b) => compareDay(b.date, firstSeenBarDate) > 0 && compareDay(b.date, evalBarDate) <= 0
  ).length;
  meta.sessionsAfterFirstSeen = sessionsAfterFirstSeen;
  if (sessionsAfterFirstSeen >= 5) flags.push("AGING_SETUP");

  const ext = extendedTierFlag(close, pullbackZoneHigh);
  if (ext) {
    flags.push(ext);
    meta.extendedPct =
      pullbackZoneHigh > 0 ? (close - pullbackZoneHigh) / pullbackZoneHigh : null;
  }

  if (meta.distanceToZonePct > 0.1) flags.push("DEAD_SETUP");

  /** First session where close clears breakout (full history through eval). */
  let breakoutIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i]!.close > breakoutLevel) {
      breakoutIdx = i;
      break;
    }
  }

  if (breakoutIdx >= 0) {
    const breakoutBar = bars[breakoutIdx]!;
    const sessionsSinceBreakout = bars.filter(
      (b) => compareDay(b.date, breakoutBar.date) > 0 && compareDay(b.date, evalBarDate) <= 0
    ).length;
    meta.sessionsSinceBreakout = sessionsSinceBreakout;

    let touchedZone = false;
    for (let j = breakoutIdx; j < bars.length; j++) {
      const b = bars[j]!;
      if (barsInteractionZone(b.low, b.high, pullbackZoneLow, pullbackZoneHigh)) {
        touchedZone = true;
        break;
      }
    }
    if (sessionsSinceBreakout >= 5 && !touchedZone) flags.push("FAILED_TO_PULLBACK");
  }

  const last20 = [...bars].filter((b) => compareDay(b.date, evalBarDate) <= 0).slice(-20);
  const vols = last20.map((b) => b.volume);
  meta.median20Volume = median(vols);

  const last3 = bars.slice(-3);
  const decreasing3 =
    last3.length === 3 &&
    last3[2]!.volume < last3[1]!.volume &&
    last3[1]!.volume < last3[0]!.volume;

  const m20 = meta.median20Volume;
  const volFadeRatio = m20 != null && m20 > 0 ? evalBar.volume / m20 : null;
  const lowVsMedian = volFadeRatio != null && volFadeRatio < 0.7;
  if (decreasing3 || lowVsMedian) flags.push("VOLUME_FADE");

  if (evalBar.high > evalBar.low) {
    const closeFrac = (evalBar.close - evalBar.low) / (evalBar.high - evalBar.low);
    if (closeFrac < 0.3 && m20 != null && evalBar.volume > m20) {
      flags.push("REVERSAL_RISK");
    }
  }

  const score = computeScore(flags);
  const level = deriveLevel(flags);

  return { flags, score, level, meta };
}
