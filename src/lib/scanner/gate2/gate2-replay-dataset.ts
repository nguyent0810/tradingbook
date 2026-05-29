import type { Gate2BarInput } from "./types";
import { sortDedupeGate2Bars } from "./breakout-pullback";

/** Minimum daily bars required for Gate 2 evaluation. */
export const GATE2_MIN_BARS_FOR_EVAL = 50;

/** Forward-return labels need this many sessions after evaluation. */
export const GATE2_FORWARD_20_SESSIONS = 20;

/** One walk-forward evaluation row for Gate 2 replay / forward-return tools. */
export type Gate2ReplayEvaluationRow = {
  /** `SYM` or `SYM@YYYY-MM-DD` when multi-session. */
  symbol: string;
  /** Bars through evaluation session (inclusive). */
  bars: readonly Gate2BarInput[];
  /** Full bar history for forward-return labels (defaults to `bars`). */
  fullBars: readonly Gate2BarInput[];
  sessionDate: Date;
};

export function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function sessionKeysFromBars(
  bars: Gate2BarInput[],
  lookbackSessions: number,
  asOf: Date | null
): Date[] {
  const sorted = sortDedupeGate2Bars(bars);
  if (sorted.length < 50) return [];

  if (asOf) {
    const target = utcDayOnly(asOf).getTime();
    const idx = sorted.findIndex((b) => utcDayOnly(b.date).getTime() === target);
    if (idx < 49) return [];
    return [sorted[idx]!.date];
  }

  const out: Date[] = [];
  const start = Math.max(49, sorted.length - lookbackSessions);
  for (let i = start; i < sorted.length; i++) {
    out.push(sorted[i]!.date);
  }
  return out;
}

export function futureSessionsAfter(
  allBars: ReadonlyArray<Gate2BarInput>,
  sessionDate: Date
): number {
  const sorted = sortDedupeGate2Bars(allBars);
  const target = utcDayOnly(sessionDate).getTime();
  const idx = sorted.findIndex((b) => utcDayOnly(b.date).getTime() === target);
  if (idx < 0) return 0;
  return sorted.length - 1 - idx;
}

export function hasSufficientForwardSessions(
  allBars: ReadonlyArray<Gate2BarInput>,
  sessionDate: Date,
  requiredFuture = GATE2_FORWARD_20_SESSIONS
): boolean {
  return futureSessionsAfter(allBars, sessionDate) >= requiredFuture;
}

/** Last session date on the symbol calendar that still has `requiredFuture` bars ahead. */
export function maxEvaluationSessionWithForward(
  allBars: ReadonlyArray<Gate2BarInput>,
  requiredFuture = GATE2_FORWARD_20_SESSIONS
): Date | null {
  const sorted = sortDedupeGate2Bars(allBars);
  if (sorted.length < GATE2_MIN_BARS_FOR_EVAL + requiredFuture) return null;
  return sorted[sorted.length - 1 - requiredFuture]!.date;
}

export function filterReplayRowsForForwardHorizon(
  rows: readonly Gate2ReplayEvaluationRow[],
  requiredFuture = GATE2_FORWARD_20_SESSIONS
): Gate2ReplayEvaluationRow[] {
  return rows.filter((r) => hasSufficientForwardSessions(r.fullBars, r.sessionDate, requiredFuture));
}

export function buildReplayRowsForSymbol(params: {
  symbol: string;
  allBars: Gate2BarInput[];
  lookbackSessions: number;
  asOf: Date | null;
  /** When true, omit evaluation sessions without enough future bars for 20d labels. */
  requireForward20d?: boolean;
}): Gate2ReplayEvaluationRow[] {
  const sessions = sessionKeysFromBars(params.allBars, params.lookbackSessions, params.asOf);
  const rows: Gate2ReplayEvaluationRow[] = [];

  for (const sessionDate of sessions) {
    if (
      params.requireForward20d &&
      !hasSufficientForwardSessions(params.allBars, sessionDate, GATE2_FORWARD_20_SESSIONS)
    ) {
      continue;
    }
    const sliceEnd = params.allBars.findIndex(
      (b) => utcDayOnly(b.date).getTime() === utcDayOnly(sessionDate).getTime()
    );
    if (sliceEnd < 0) continue;
    const label =
      params.lookbackSessions > 1 || params.asOf
        ? `${params.symbol}@${sessionDate.toISOString().slice(0, 10)}`
        : params.symbol;
    rows.push({
      symbol: label,
      bars: params.allBars.slice(0, sliceEnd + 1),
      fullBars: params.allBars,
      sessionDate,
    });
  }

  return rows;
}
