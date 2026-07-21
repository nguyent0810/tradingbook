import type {
  EvaluateWatchHealthInput,
  OhlcvBar,
  SetupHealthFlag,
  SetupHealthLevelValue,
  WatchHealthMeta,
  WatchHealthResult,
} from "./types";

/**
 * Extension tiers: close vs pullback-zone-high, mutually exclusive (highest wins).
 * Exported so `rank-components.ts`'s extension reward curve uses the SAME
 * distance definition as this health penalty — one normalized "how extended"
 * scale shared by both, instead of two independently-tuned numbers.
 */
export const EXTENDED_PCT = 0.05;
export const TOO_EXTENDED_PCT = 0.08;
export const CHASE_PCT = 0.12;

/** Distance-to-zone beyond which a setup is considered dead. */
const DEAD_SETUP_DISTANCE_PCT = 0.1;

/** Minimum bars for a stable 14-period ATR (14 true-range values, each needing a prior close). */
const ATR_PERIOD = 14;
const MIN_BARS_FOR_ATR = ATR_PERIOD + 1;

/**
 * ATR-multiple thresholds replacing the flat EXTENDED_PCT/TOO_EXTENDED_PCT/CHASE_PCT
 * when enough bars exist, so the same rule doesn't misjudge a sleepy large-cap and a
 * high-beta small-cap identically. Multiples are chosen so a ~2% "typical" daily
 * ATR% reproduces roughly the old flat thresholds (5%/8%/12%) — an unvalidated
 * calibration assumption (no backtest evidence either way — see final report),
 * documented here for the next tuning pass rather than derived from data.
 */
const EXTENDED_ATR_MULT = 2;
const TOO_EXTENDED_ATR_MULT = 3.5;
const CHASE_ATR_MULT = 5;

/** True Range for one bar given the previous bar's close. */
function trueRange(bar: OhlcvBar, prevClose: number): number {
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prevClose),
    Math.abs(bar.low - prevClose)
  );
}

/**
 * Simple (not Wilder-smoothed) 14-period ATR from the last 15 ascending bars.
 * Returns null when there aren't enough bars for a stable read — callers must
 * fall back to the flat-% thresholds, not silently treat null as zero volatility.
 */
export function computeAtr14(barsAsc: OhlcvBar[]): number | null {
  if (barsAsc.length < MIN_BARS_FOR_ATR) return null;
  const recent = barsAsc.slice(-MIN_BARS_FOR_ATR);
  const trs: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    trs.push(trueRange(recent[i]!, recent[i - 1]!.close));
  }
  if (trs.length === 0) return null;
  return trs.reduce((sum, v) => sum + v, 0) / trs.length;
}

type ExtensionThresholds = {
  extended: number;
  tooExtended: number;
  chase: number;
  source: "atr" | "flat_pct_fallback";
};

function resolveExtensionThresholds(barsAsc: OhlcvBar[], close: number): ExtensionThresholds {
  const atr = computeAtr14(barsAsc);
  if (atr != null && close > 0) {
    const atrPct = atr / close;
    return {
      extended: atrPct * EXTENDED_ATR_MULT,
      tooExtended: atrPct * TOO_EXTENDED_ATR_MULT,
      chase: atrPct * CHASE_ATR_MULT,
      source: "atr",
    };
  }
  return {
    extended: EXTENDED_PCT,
    tooExtended: TOO_EXTENDED_PCT,
    chase: CHASE_PCT,
    source: "flat_pct_fallback",
  };
}

/** Sessions since first seen before a setup is flagged as aging. */
const AGING_SETUP_SESSIONS = 5;

/** Sessions since breakout without a zone touch before flagging failed-to-pullback. */
const FAILED_TO_PULLBACK_SESSIONS = 5;

/** Volume vs 20-bar median below this ratio counts toward volume fade. */
const VOLUME_FADE_RATIO = 0.7;

/** Close position within the bar's range below this fraction, on above-median volume, flags reversal risk. */
const REVERSAL_CLOSE_FRACTION = 0.3;

const SCORE_PENALTY = {
  CHASE: 55,
  TOO_EXTENDED: 40,
  EXTENDED: 25,
  AGING_SETUP: 20,
  VOLUME_FADE: 25,
  FAILED_TO_PULLBACK: 30,
  REVERSAL_RISK: 40,
  DEAD_SETUP: 50,
} as const;

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

/**
 * Min distance from close to segment [zoneLow, zoneHigh] as fractional distance to
 * nearest bound. Returns null when the zone itself is invalid data (<=0) — that must
 * never be confused with 0, which means "sitting inside a valid zone".
 */
export function distanceToZonePct(close: number, zoneLow: number, zoneHigh: number): number | null {
  if (zoneLow <= 0 || zoneHigh <= 0) return null;
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
  pullbackZoneHigh: number,
  thresholds: ExtensionThresholds
): SetupHealthFlag | null {
  if (pullbackZoneHigh <= 0 || close <= pullbackZoneHigh) return null;
  const pct = (close - pullbackZoneHigh) / pullbackZoneHigh;
  if (pct > thresholds.chase) return "CHASE";
  if (pct > thresholds.tooExtended) return "TOO_EXTENDED";
  if (pct > thresholds.extended) return "EXTENDED";
  return null;
}

function computeScore(flags: SetupHealthFlag[]): number {
  let score = 100;
  if (flags.includes("CHASE")) score -= SCORE_PENALTY.CHASE;
  else if (flags.includes("TOO_EXTENDED")) score -= SCORE_PENALTY.TOO_EXTENDED;
  else if (flags.includes("EXTENDED")) score -= SCORE_PENALTY.EXTENDED;

  if (flags.includes("AGING_SETUP")) score -= SCORE_PENALTY.AGING_SETUP;
  if (flags.includes("VOLUME_FADE")) score -= SCORE_PENALTY.VOLUME_FADE;
  if (flags.includes("FAILED_TO_PULLBACK")) score -= SCORE_PENALTY.FAILED_TO_PULLBACK;
  if (flags.includes("REVERSAL_RISK")) score -= SCORE_PENALTY.REVERSAL_RISK;
  if (flags.includes("DEAD_SETUP")) score -= SCORE_PENALTY.DEAD_SETUP;

  return Math.max(0, Math.min(100, score));
}

/**
 * Buckets by cumulative SCORE_PENALTY of the non-dead-forcing flags rather than
 * flag count, so level and score can never disagree (e.g. one severe flag no
 * longer ranks below two mild ones just because "two" outnumbers "one").
 */
function deriveLevel(flags: SetupHealthFlag[]): SetupHealthLevelValue {
  if (flags.includes("CHASE") || flags.includes("TOO_EXTENDED") || flags.includes("DEAD_SETUP")) {
    return "DEAD";
  }

  let penalty = 0;
  if (flags.includes("EXTENDED")) penalty += SCORE_PENALTY.EXTENDED;
  if (flags.includes("AGING_SETUP")) penalty += SCORE_PENALTY.AGING_SETUP;
  if (flags.includes("VOLUME_FADE")) penalty += SCORE_PENALTY.VOLUME_FADE;
  if (flags.includes("FAILED_TO_PULLBACK")) penalty += SCORE_PENALTY.FAILED_TO_PULLBACK;
  if (flags.includes("REVERSAL_RISK")) penalty += SCORE_PENALTY.REVERSAL_RISK;

  if (penalty === 0) return "HEALTHY";
  if (penalty <= SCORE_PENALTY.REVERSAL_RISK) return "WARNING";
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
    distanceToZonePct: null,
    median20Volume: null,
    extensionThresholdSource: "flat_pct_fallback",
  };

  if (!evalBar) {
    // Missing data must never read as a healthy 100 — that's indistinguishable
    // from a genuinely strong setup. NO_DATA sorts/scores as the worst case so
    // it can never surface as Tier A/B or enable Go (see resolveSetupLadderStage,
    // canShowGo/blockedHealth in build-trade-gate.ts).
    return {
      flags: [],
      score: 0,
      level: "NO_DATA",
      meta,
    };
  }

  const close = evalBar.close;

  const extensionThresholds = resolveExtensionThresholds(bars, close);
  meta.extensionThresholdSource = extensionThresholds.source;

  meta.distanceToZonePct = distanceToZonePct(close, pullbackZoneLow, pullbackZoneHigh);

  const sessionsAfterFirstSeen = bars.filter(
    (b) => compareDay(b.date, firstSeenBarDate) > 0 && compareDay(b.date, evalBarDate) <= 0
  ).length;
  meta.sessionsAfterFirstSeen = sessionsAfterFirstSeen;
  if (sessionsAfterFirstSeen >= AGING_SETUP_SESSIONS) flags.push("AGING_SETUP");

  const ext = extendedTierFlag(close, pullbackZoneHigh, extensionThresholds);
  if (ext) {
    flags.push(ext);
    meta.extendedPct =
      pullbackZoneHigh > 0 ? (close - pullbackZoneHigh) / pullbackZoneHigh : null;
  }

  if (meta.distanceToZonePct != null && meta.distanceToZonePct > DEAD_SETUP_DISTANCE_PCT) {
    flags.push("DEAD_SETUP");
  }

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
    if (sessionsSinceBreakout >= FAILED_TO_PULLBACK_SESSIONS && !touchedZone) flags.push("FAILED_TO_PULLBACK");
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
  const lowVsMedian = volFadeRatio != null && volFadeRatio < VOLUME_FADE_RATIO;
  if (decreasing3 || lowVsMedian) flags.push("VOLUME_FADE");

  if (evalBar.high > evalBar.low) {
    const closeFrac = (evalBar.close - evalBar.low) / (evalBar.high - evalBar.low);
    if (closeFrac < REVERSAL_CLOSE_FRACTION && m20 != null && evalBar.volume > m20) {
      flags.push("REVERSAL_RISK");
    }
  }

  const score = computeScore(flags);
  const level = deriveLevel(flags);

  return { flags, score, level, meta };
}
