import type { PrismaClient } from "@/generated/prisma/client";
import type { TradeStatus } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  fetchLatestCloseByTradeSymbols,
  type LatestCloseBar,
} from "@/lib/trades/unrealized-from-close";

/** FRD §1 — banner when VNINDEX benchmark is missing. */
export const VNINDEX_FRESHNESS_UNAVAILABLE =
  "Cannot evaluate bar freshness — import or refresh VNINDEX daily bars.";

export function utcCalendarDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * True if equity session date is strictly before the latest VNINDEX session date.
 * When benchmark is missing, returns `"unknown"` (show page banner; row-level stale is not asserted).
 */
export function equityBarStaleVsBenchmark(
  equityBarDate: Date,
  expectedSessionDate: Date | null
): boolean | "unknown" {
  if (!expectedSessionDate) return "unknown";
  return utcCalendarDayMs(equityBarDate) < utcCalendarDayMs(expectedSessionDate);
}

/**
 * Holding days: UTC calendar-day delta from entry.
 * OPEN / PLANNED: entry → `now`.
 * CLOSED: entry → `exitDate` when present (holding period); otherwise `—` via null from caller.
 */
export function computeDisplayHoldingDaysUtc(params: {
  status: TradeStatus;
  entryDate: Date;
  exitDate: Date | null;
  now: Date;
}): number | null {
  const { status, entryDate, exitDate, now } = params;
  const start = utcCalendarDayMs(entryDate);
  const end =
    status === "CLOSED"
      ? exitDate != null
        ? utcCalendarDayMs(exitDate)
        : null
      : utcCalendarDayMs(now);
  if (end == null || !Number.isFinite(start)) return null;
  const diffDays = Math.floor((end - start) / 86_400_000);
  return Math.max(0, diffDays);
}

export type PositionMarksContext = {
  latestCloseBySymbol: Map<string, LatestCloseBar>;
  expectedSessionDate: Date | null;
  benchmarkLoadFailed: boolean;
  barsLoadFailed: boolean;
};

/**
 * Batch latest equity bars + VNINDEX session; never throws — supplemental for Trades UI.
 */
export async function loadOpenPositionMarks(
  prisma: PrismaClient,
  openSymbolKeys: readonly string[]
): Promise<PositionMarksContext> {
  let expectedSessionDate: Date | null = null;
  let benchmarkLoadFailed = false;
  try {
    expectedSessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  } catch (e) {
    benchmarkLoadFailed = true;
    console.error("[trades] VNINDEX expected session lookup failed:", e);
  }

  let latestCloseBySymbol = new Map<string, LatestCloseBar>();
  let barsLoadFailed = false;
  try {
    latestCloseBySymbol = await fetchLatestCloseByTradeSymbols(
      prisma,
      openSymbolKeys
    );
  } catch (e) {
    barsLoadFailed = true;
    console.error("[trades] batch latest StockDailyBar failed:", e);
  }

  return {
    latestCloseBySymbol,
    expectedSessionDate: benchmarkLoadFailed ? null : expectedSessionDate,
    benchmarkLoadFailed,
    barsLoadFailed,
  };
}
