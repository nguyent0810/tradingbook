import type { PrismaClient } from "@/generated/prisma/client";
import { equityPriceToVnd, tradedValueVnd } from "./price-units";
import {
  TRADABILITY_MAX_CALENDAR_GAP_DAYS,
  TRADABILITY_MIN_AVG_VALUE_VND_20,
  TRADABILITY_MIN_AVG_VOLUME_20,
  TRADABILITY_MIN_BARS,
  TRADABILITY_MIN_CLOSE_VND,
  TRADABILITY_REASON,
  TRADABILITY_ROLLING_DAYS,
} from "./tradability-constants";
import type {
  TradabilityAggregate,
  TradabilityBarInput,
  TradabilityBatchItem,
  TradabilityResult,
} from "./tradability-types";

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

/**
 * Consecutive EOD rows: one per calendar day, ascending by date.
 */
export function sortAndDedupeBarsByDate(
  bars: ReadonlyArray<TradabilityBarInput>
): TradabilityBarInput[] {
  const byKey = new Map<string, TradabilityBarInput>();
  for (const b of bars) {
    const k = dateKey(b.date);
    byKey.set(k, {
      date: utcDayOnly(b.date),
      close: b.close,
      volume: b.volume,
    });
  }
  return [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Weekday count between two dates (diagnostics only — **not** used for tradability gap checks).
 */
export function countWeekdaysExclusive(start: Date, end: Date): number {
  const sT = utcDayOnly(start).getTime();
  const eT = utcDayOnly(end).getTime();
  if (eT <= sT) return 0;
  let count = 0;
  const d = new Date(sT);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getTime() < eT) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Whole calendar days from earlier session date to later (UTC day boundaries). */
function calendarDaysBetweenBarDates(earlier: Date, later: Date): number {
  const e = utcDayOnly(earlier).getTime();
  const l = utcDayOnly(later).getTime();
  return Math.round((l - e) / 86_400_000);
}

/**
 * Deterministic tradability checks for one symbol’s daily bars.
 * Call **before** Gate 2; only symbols with `passed: true` should be scanned.
 *
 * @param expectedLatestSession — Expected last completed EOD session (VN market),
 *   aligned to the **latest VNINDEX `IndexDailyBar` date** after daily import
 *   (`getExpectedLatestSessionFromIndexBars`). Do **not** use server clock “today”:
 *   weekends, holidays, and data lag would mark fresh bars as stale.
 */
export function evaluateTradability(
  barsInput: ReadonlyArray<TradabilityBarInput>,
  expectedLatestSession: Date
): TradabilityResult {
  const reasons: string[] = [];
  const bars = sortAndDedupeBarsByDate(barsInput);

  if (bars.length < TRADABILITY_MIN_BARS) {
    reasons.push(TRADABILITY_REASON.INSUFFICIENT_HISTORY);
    return { passed: false, reasons };
  }

  const last20 = bars.slice(-TRADABILITY_ROLLING_DAYS);
  if (last20.length < TRADABILITY_ROLLING_DAYS) {
    reasons.push(TRADABILITY_REASON.INSUFFICIENT_HISTORY);
    return { passed: false, reasons };
  }

  const avgVol = mean(last20.map((b) => b.volume));
  if (avgVol < TRADABILITY_MIN_AVG_VOLUME_20) {
    reasons.push(TRADABILITY_REASON.VOLUME_20D);
  }

  const avgValue = mean(
    last20.map((b) => tradedValueVnd(b.close, b.volume))
  );
  if (avgValue < TRADABILITY_MIN_AVG_VALUE_VND_20) {
    reasons.push(TRADABILITY_REASON.VALUE_20D);
  }

  const latest = bars[bars.length - 1]!;
  if (equityPriceToVnd(latest.close) < TRADABILITY_MIN_CLOSE_VND) {
    reasons.push(TRADABILITY_REASON.PRICE);
  }

  const expected = utcDayOnly(expectedLatestSession);
  const latestDay = utcDayOnly(latest.date);
  if (latestDay.getTime() !== expected.getTime()) {
    reasons.push(TRADABILITY_REASON.STALE_DATA);
  }

  /** Long suspension / bad feed: only calendar gaps (no weekday-aggregate rule). */
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]!;
    const curr = bars[i]!;
    const calGap = calendarDaysBetweenBarDates(prev.date, curr.date);
    if (calGap > TRADABILITY_MAX_CALENDAR_GAP_DAYS) {
      reasons.push(TRADABILITY_REASON.GAP_CALENDAR);
      break;
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

/**
 * Roll up per-symbol results for scan telemetry (counts + failure breakdown).
 */
export function aggregateTradabilityResults(
  items: ReadonlyArray<{ symbolKey: string; result: TradabilityResult }>
): TradabilityAggregate {
  const breakdownByReason: Record<string, number> = {};
  let passedTradability = 0;

  for (const { result } of items) {
    if (result.passed) {
      passedTradability++;
      continue;
    }
    for (const r of result.reasons) {
      breakdownByReason[r] = (breakdownByReason[r] ?? 0) + 1;
    }
  }

  const totalSymbols = items.length;
  return {
    totalSymbols,
    passedTradability,
    filteredOut: totalSymbols - passedTradability,
    breakdownByReason,
  };
}

/** Symbol keys whose tradability result passed. */
export function tradableSymbolKeys(
  items: ReadonlyArray<{ symbolKey: string; result: TradabilityResult }>
): string[] {
  return items.filter((i) => i.result.passed).map((i) => i.symbolKey);
}

/**
 * Load bars from DB and evaluate tradability for one symbol.
 */
export async function evaluateTradabilityForSymbolId(
  prisma: PrismaClient,
  symbolId: string,
  expectedLatestSession: Date
): Promise<TradabilityResult> {
  const rows = await prisma.stockDailyBar.findMany({
    where: { symbolId },
    orderBy: { date: "asc" },
    select: { date: true, close: true, volume: true },
  });

  const bars: TradabilityBarInput[] = rows.map((r) => ({
    date: r.date,
    close: r.close,
    volume: r.volume,
  }));

  return evaluateTradability(bars, expectedLatestSession);
}

/**
 * Evaluate all active `StockSymbol` rows and return per-symbol results + aggregate.
 * Intended to run **after** bars are loaded and **before** Gate 2.
 */
export async function evaluateTradabilityForAllActiveSymbols(
  prisma: PrismaClient,
  expectedLatestSession: Date
): Promise<{
  items: TradabilityBatchItem[];
  aggregate: TradabilityAggregate;
  tradableSymbolIds: string[];
}> {
  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
  });

  const items: TradabilityBatchItem[] = [];

  for (const s of symbols) {
    const result = await evaluateTradabilityForSymbolId(
      prisma,
      s.id,
      expectedLatestSession
    );
    items.push({
      symbolKey: s.symbol,
      symbolId: s.id,
      result,
    });
  }

  const aggregate = aggregateTradabilityResults(
    items.map((i) => ({ symbolKey: i.symbolKey, result: i.result }))
  );

  const tradableSymbolIds = items
    .filter((i) => i.result.passed)
    .map((i) => i.symbolId);

  return { items, aggregate, tradableSymbolIds };
}
