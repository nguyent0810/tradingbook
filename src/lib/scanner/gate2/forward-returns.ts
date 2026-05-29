import { sortDedupeGate2Bars } from "./breakout-pullback";
import type { Gate2BarInput } from "./types";

export const FORWARD_RETURN_HORIZONS = [5, 10, 20] as const;
export type ForwardReturnHorizon = (typeof FORWARD_RETURN_HORIZONS)[number];

export const EXCURSION_HORIZON_SESSIONS = 20;

const GAIN_BEFORE_LOSS_TARGET = 0.05;
const GAIN_BEFORE_LOSS_STOP = -0.03;
const HIT_PLUS_10_TARGET = 0.1;
const DRAWDOWN_WORSE_THAN = -0.05;

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateKey(d: Date): string {
  const x = utcDayOnly(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pctReturnFromCloses(entryClose: number, exitClose: number): number {
  return ((exitClose / entryClose) - 1) * 100;
}

function firstIndexMeeting(
  bars: Gate2BarInput[],
  from: number,
  toInclusive: number,
  test: (b: Gate2BarInput) => boolean
): number | null {
  for (let i = from; i <= toInclusive; i++) {
    if (test(bars[i]!)) return i;
  }
  return null;
}

/**
 * Forward outcomes from evaluation session close (diagnostic only).
 * Returns null when evaluation session is not found in bars.
 */
export type ForwardReturnLabels = {
  evaluationDate: string;
  entryClose: number;
  /** Fraction of future sessions available after evaluation (0–20+). */
  futureSessionsAvailable: number;
  forwardReturnPct: Record<ForwardReturnHorizon, number | null>;
  maxFavorableExcursion20Pct: number | null;
  maxAdverseExcursion20Pct: number | null;
  hitPlus5BeforeMinus3: boolean | null;
  hitPlus10Within20: boolean | null;
  drawdownWorseThanMinus5Within20: boolean | null;
};

export function computeForwardReturnLabels(
  bars: ReadonlyArray<Gate2BarInput>,
  evaluationSession: Date
): ForwardReturnLabels | null {
  const sorted = sortDedupeGate2Bars(bars);
  const target = dateKey(evaluationSession);
  const L = sorted.findIndex((b) => dateKey(b.date) === target);
  if (L < 0) return null;

  const entryClose = sorted[L]!.close;
  if (!(entryClose > 0 && Number.isFinite(entryClose))) return null;

  const futureAvailable = sorted.length - 1 - L;
  const forwardReturnPct: Record<ForwardReturnHorizon, number | null> = {
    5: null,
    10: null,
    20: null,
  };

  for (const h of FORWARD_RETURN_HORIZONS) {
    const idx = L + h;
    if (idx < sorted.length) {
      forwardReturnPct[h] = pctReturnFromCloses(entryClose, sorted[idx]!.close);
    }
  }

  let maxFavorableExcursion20Pct: number | null = null;
  let maxAdverseExcursion20Pct: number | null = null;
  let hitPlus5BeforeMinus3: boolean | null = null;
  let hitPlus10Within20: boolean | null = null;
  let drawdownWorseThanMinus5Within20: boolean | null = null;

  if (futureAvailable >= EXCURSION_HORIZON_SESSIONS) {
    const end = L + EXCURSION_HORIZON_SESSIONS;
    let maxHigh = sorted[L + 1]!.high;
    let minLow = sorted[L + 1]!.low;
    for (let i = L + 2; i <= end; i++) {
      if (sorted[i]!.high > maxHigh) maxHigh = sorted[i]!.high;
      if (sorted[i]!.low < minLow) minLow = sorted[i]!.low;
    }
    maxFavorableExcursion20Pct = ((maxHigh / entryClose) - 1) * 100;
    maxAdverseExcursion20Pct = ((minLow / entryClose) - 1) * 100;

    const gainLevel = entryClose * (1 + GAIN_BEFORE_LOSS_TARGET);
    const lossLevel = entryClose * (1 + GAIN_BEFORE_LOSS_STOP);
    const firstGain = firstIndexMeeting(sorted, L + 1, end, (b) => b.high >= gainLevel);
    const firstLoss = firstIndexMeeting(sorted, L + 1, end, (b) => b.low <= lossLevel);
    if (firstGain != null || firstLoss != null) {
      hitPlus5BeforeMinus3 =
        firstGain != null && (firstLoss == null || firstGain < firstLoss);
    }

    const plus10Level = entryClose * (1 + HIT_PLUS_10_TARGET);
    hitPlus10Within20 = firstIndexMeeting(sorted, L + 1, end, (b) => b.high >= plus10Level) != null;

    const minus5Level = entryClose * (1 + DRAWDOWN_WORSE_THAN);
    drawdownWorseThanMinus5Within20 =
      firstIndexMeeting(sorted, L + 1, end, (b) => b.low <= minus5Level) != null;
  }

  return {
    evaluationDate: target,
    entryClose,
    futureSessionsAvailable: futureAvailable,
    forwardReturnPct,
    maxFavorableExcursion20Pct,
    maxAdverseExcursion20Pct,
    hitPlus5BeforeMinus3,
    hitPlus10Within20,
    drawdownWorseThanMinus5Within20,
  };
}
