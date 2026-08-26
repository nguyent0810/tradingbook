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

export type StopValidity = "missing" | "invalid" | "valid";

export type OpenPhase2Metrics = {
  rMultiple: number | null;
  distanceToStop: number | null;
  distanceToTakeProfit: number | null;
  stopValidity: StopValidity;
};

/**
 * Phase 2 structural metrics for OPEN trades. Never throws.
 * - `rMultiple` and `distanceToStop` require a valid stop and latest close.
 * - `distanceToTakeProfit` requires latest close and take-profit.
 */
export function computeOpenPhase2Metrics(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  latestClose: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
}): OpenPhase2Metrics {
  const { direction, entryPrice, latestClose, stopLoss, takeProfit } = params;

  const latestOk = latestClose != null && Number.isFinite(latestClose);
  const entryOk = Number.isFinite(entryPrice) && entryPrice > 0;
  const stopMissing = stopLoss == null;
  const stopFinite = stopLoss != null && Number.isFinite(stopLoss);
  const stopValid =
    stopFinite &&
    entryOk &&
    (direction === "LONG" ? stopLoss < entryPrice : stopLoss > entryPrice);

  const stopValidity: StopValidity = stopMissing
    ? "missing"
    : stopValid
      ? "valid"
      : "invalid";

  let distanceToStop: number | null = null;
  let rMultiple: number | null = null;
  if (latestOk && stopValid) {
    const riskPerShare =
      direction === "LONG" ? entryPrice - stopLoss : stopLoss - entryPrice;
    distanceToStop =
      direction === "LONG" ? latestClose - stopLoss : stopLoss - latestClose;
    if (riskPerShare > 0) {
      rMultiple =
        direction === "LONG"
          ? (latestClose - entryPrice) / riskPerShare
          : (entryPrice - latestClose) / riskPerShare;
    }
  }

  let distanceToTakeProfit: number | null = null;
  const tpOk = takeProfit != null && Number.isFinite(takeProfit);
  if (latestOk && tpOk) {
    distanceToTakeProfit =
      direction === "LONG" ? takeProfit - latestClose : latestClose - takeProfit;
  }

  return {
    rMultiple,
    distanceToStop,
    distanceToTakeProfit,
    stopValidity,
  };
}

export type PositionMarksContext = {
  latestCloseBySymbol: Map<string, LatestCloseBar>;
  expectedSessionDate: Date | null;
  /**
   * Nguyên văn lỗi của TỪNG truy vấn — `null` khi đọc được.
   *
   * Trước đây là hai cờ `boolean`: màn biết "có lỗi" nhưng phải tự bịa ra câu mô
   * tả, nên mọi loại hỏng (mất kết nối, sai quyền, thiếu bảng) đều hiện giống
   * hệt nhau. Bàn giao §6 đòi bằng chứng THẬT, mà một cờ `true` thì không mang
   * được bằng chứng nào qua ranh giới hàm.
   */
  benchmarkLoadError: string | null;
  barsLoadError: string | null;
};

/**
 * Batch latest equity bars + VNINDEX session; never throws — supplemental for Trades UI.
 */
export async function loadOpenPositionMarks(
  prisma: PrismaClient,
  openSymbolKeys: readonly string[]
): Promise<PositionMarksContext> {
  let expectedSessionDate: Date | null = null;
  let benchmarkLoadError: string | null = null;
  try {
    expectedSessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  } catch (e) {
    benchmarkLoadError =
      "getExpectedLatestSessionFromIndexBars() thất bại: " +
      String(e) +
      " — không đánh dấu được hàng nào đang dùng giá cũ.";
    console.error("[trades] VNINDEX expected session lookup failed:", e);
  }

  let latestCloseBySymbol = new Map<string, LatestCloseBar>();
  let barsLoadError: string | null = null;
  try {
    latestCloseBySymbol = await fetchLatestCloseByTradeSymbols(
      prisma,
      openSymbolKeys
    );
  } catch (e) {
    barsLoadError =
      "fetchLatestCloseByTradeSymbols() thất bại: " +
      String(e) +
      " — cột giá hiện tại và lãi/lỗ chưa thực hiện để trống.";
    console.error("[trades] batch latest StockDailyBar failed:", e);
  }

  return {
    latestCloseBySymbol,
    expectedSessionDate: benchmarkLoadError != null ? null : expectedSessionDate,
    benchmarkLoadError,
    barsLoadError,
  };
}
