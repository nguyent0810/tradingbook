import { sma } from "@/lib/playbook/indicators";
import type { Gate2BarInput } from "./types";
import { sortDedupeGate2Bars } from "./breakout-pullback";

/** Diagnostic lookbacks aligned with Gate 2 structure (20d range, 50d MA). */
export const RS_LOOKBACK_20 = 20;
export const RS_LOOKBACK_50 = 50;

export type RelativeReturnMetrics = {
  lookbackSessions: number;
  asOfDate: string;
  stockReturnPct: number;
  indexReturnPct: number;
  /** Stock return minus index return (percentage points). */
  rsSpreadPct: number;
};

export type RelativeStrengthDiagnostic = {
  asOfDate: string;
  returns: RelativeReturnMetrics[];
  stockAboveMa50: boolean | null;
  indexAboveMa50: boolean | null;
  /** Stock above MA50 while index is at or below MA50. */
  stockLeadingMa50: boolean | null;
  /** Both closes above respective MA50. */
  dualUptrendMa50: boolean | null;
};

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

function pctReturn(end: number, start: number): number | null {
  if (!(start > 0 && end > 0 && Number.isFinite(start) && Number.isFinite(end))) {
    return null;
  }
  return ((end / start) - 1) * 100;
}

function indexByDateKey(bars: readonly Gate2BarInput[]): Map<string, Gate2BarInput> {
  const m = new Map<string, Gate2BarInput>();
  for (const b of bars) {
    m.set(dateKey(b.date), b);
  }
  return m;
}

/**
 * Session-aligned relative return: stock N-session return minus VNINDEX N-session return.
 * Uses the stock bar calendar for the end and start anchors; index must have bars on both dates.
 * Diagnostic only — does not affect Gate 2 pass/fail or rankScore.
 */
export function computeRelativeReturnAtSession(
  stockBars: readonly Gate2BarInput[],
  indexBars: readonly Gate2BarInput[],
  sessionDate: Date,
  lookbackSessions: number
): RelativeReturnMetrics | null {
  const sorted = sortDedupeGate2Bars(stockBars);
  const target = dateKey(sessionDate);
  const L = sorted.findIndex((b) => dateKey(b.date) === target);
  if (L < 0 || L < lookbackSessions) return null;

  const stockEnd = sorted[L]!.close;
  const stockStart = sorted[L - lookbackSessions]!.close;
  const stockReturnPct = pctReturn(stockEnd, stockStart);
  if (stockReturnPct === null) return null;

  const indexMap = indexByDateKey(indexBars);
  const endKey = dateKey(sorted[L]!.date);
  const startKey = dateKey(sorted[L - lookbackSessions]!.date);
  const indexEndBar = indexMap.get(endKey);
  const indexStartBar = indexMap.get(startKey);
  if (!indexEndBar || !indexStartBar) return null;

  const indexReturnPct = pctReturn(indexEndBar.close, indexStartBar.close);
  if (indexReturnPct === null) return null;

  return {
    lookbackSessions: lookbackSessions,
    asOfDate: endKey,
    stockReturnPct,
    indexReturnPct,
    rsSpreadPct: stockReturnPct - indexReturnPct,
  };
}

function ma50AtSession(
  bars: readonly Gate2BarInput[],
  sessionDate: Date
): { close: number; ma50: number } | null {
  const sorted = sortDedupeGate2Bars(bars);
  const target = dateKey(sessionDate);
  const L = sorted.findIndex((b) => dateKey(b.date) === target);
  if (L < 49) return null;
  const closes = sorted.map((b) => b.close);
  const maSeries = sma(closes, 50);
  const ma50 = maSeries[L];
  if (ma50 === undefined || Number.isNaN(ma50)) return null;
  return { close: sorted[L]!.close, ma50 };
}

/**
 * Full RS diagnostic bundle for one symbol at the evaluation session.
 * Requires ≥50 stock bars and matching index history on return anchor dates.
 */
export function computeRelativeStrengthDiagnostic(
  stockBars: readonly Gate2BarInput[],
  indexBars: readonly Gate2BarInput[],
  sessionDate: Date
): RelativeStrengthDiagnostic | null {
  const asOf = dateKey(sessionDate);
  const r20 = computeRelativeReturnAtSession(
    stockBars,
    indexBars,
    sessionDate,
    RS_LOOKBACK_20
  );
  const r50 = computeRelativeReturnAtSession(
    stockBars,
    indexBars,
    sessionDate,
    RS_LOOKBACK_50
  );
  const returns = [r20, r50].filter((r): r is RelativeReturnMetrics => r != null);
  if (returns.length === 0) return null;

  const stockMa = ma50AtSession(stockBars, sessionDate);
  const indexMa = ma50AtSession(indexBars, sessionDate);

  const stockAboveMa50 =
    stockMa != null ? stockMa.close > stockMa.ma50 : null;
  const indexAboveMa50 =
    indexMa != null ? indexMa.close > indexMa.ma50 : null;

  let stockLeadingMa50: boolean | null = null;
  let dualUptrendMa50: boolean | null = null;
  if (stockAboveMa50 != null && indexAboveMa50 != null) {
    stockLeadingMa50 = stockAboveMa50 && !indexAboveMa50;
    dualUptrendMa50 = stockAboveMa50 && indexAboveMa50;
  }

  return {
    asOfDate: asOf,
    returns,
    stockAboveMa50,
    indexAboveMa50,
    stockLeadingMa50,
    dualUptrendMa50,
  };
}

/** One-line summary for CLI / reports. */
export function formatRelativeStrengthSummary(d: RelativeStrengthDiagnostic): string {
  const r20 = d.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_20);
  const r50 = d.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_50);
  const parts: string[] = [];
  if (r20) parts.push(`RS20 ${r20.rsSpreadPct >= 0 ? "+" : ""}${r20.rsSpreadPct.toFixed(2)}pp`);
  if (r50) parts.push(`RS50 ${r50.rsSpreadPct >= 0 ? "+" : ""}${r50.rsSpreadPct.toFixed(2)}pp`);
  if (d.dualUptrendMa50 === true) parts.push("dual>MA50");
  else if (d.stockLeadingMa50 === true) parts.push("stock>MA50 only");
  return parts.join(" · ");
}
