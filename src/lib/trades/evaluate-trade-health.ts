import type { SetupHealthLevel } from "@/generated/prisma/client";
import { computeOpenPhase2Metrics } from "./position-health";
import {
  classifyStopPriceBand,
  evaluateSetupStructureHints,
  logSuggestsStructureStress,
  resolveEodReviewSurface,
  structureHintsTraderLine,
  type EodReviewSurface,
  type LatestTradeHealthLog,
  type SetupLevelsSnapshot,
} from "./open-position-intelligence";

export type TradeHealthEvalInput = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  latestClose: number | null;
  latestBarDate: Date | null;
  evalBarDate: Date;
  setupLevels: SetupLevelsSnapshot | null;
  latestHealthLog: LatestTradeHealthLog | null;
};

export type TradeHealthEvalResult = {
  healthLevel: SetupHealthLevel;
  surface: EodReviewSurface;
  priceVsZone: string | null;
  structureStatus: string | null;
  recommendedAction: string | null;
};

/** Daily automated check has no "reviewed today" concept — a human hasn't looked yet. */
const AUTOMATED_CHECK_REVIEWED_TODAY = false;

/**
 * Nightly-scan-cadence surface → persisted health level. `stop_violated` is the
 * only DEAD case (position invalidated); everything else that isn't clearly
 * fine downgrades to WARNING/AT_RISK rather than being silently dropped.
 */
const SURFACE_TO_HEALTH_LEVEL: Record<EodReviewSurface, SetupHealthLevel> = {
  stop_violated: "DEAD",
  structure_weakening: "AT_RISK",
  under_pressure: "WARNING",
  stale_bar_review: "WARNING",
  review_needed: "HEALTHY",
  review_completed: "HEALTHY",
};

const RECOMMENDED_ACTION: Partial<Record<EodReviewSurface, string>> = {
  stop_violated: "Giá đóng cửa đã xuyên qua cắt lỗ — xem xét đóng lệnh theo kế hoạch.",
  structure_weakening: "Cấu trúc breakout-pullback đang yếu đi — xem lại lệnh trước phiên tới.",
  under_pressure: "Giá gần vùng cắt lỗ — theo dõi sát phiên tới.",
  stale_bar_review: "Dữ liệu giá gần nhất cũ hơn phiên chuẩn — kiểm tra lại dữ liệu trước khi tin tưởng cảnh báo này.",
};

function utcDayOnlyMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function describePriceVsZone(close: number | null, setup: SetupLevelsSnapshot | null): string | null {
  if (close == null || !setup) return null;
  const { pullbackZoneLow, pullbackZoneHigh } = setup;
  if (close < pullbackZoneLow) return `Đóng cửa ${close} dưới vùng mua lại [${pullbackZoneLow}, ${pullbackZoneHigh}]`;
  if (close > pullbackZoneHigh) return `Đóng cửa ${close} trên vùng mua lại [${pullbackZoneLow}, ${pullbackZoneHigh}]`;
  return `Đóng cửa ${close} trong vùng mua lại [${pullbackZoneLow}, ${pullbackZoneHigh}]`;
}

/**
 * Pure — no Prisma. Reuses the same open-position review primitives
 * (`open-position-intelligence.ts`) the trades ledger UI is built on, so an
 * automated nightly checkpoint and the on-screen review surface never disagree.
 */
export function evaluateTradeHealth(input: TradeHealthEvalInput): TradeHealthEvalResult {
  const {
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    latestClose,
    latestBarDate,
    evalBarDate,
    setupLevels,
    latestHealthLog,
  } = input;

  const { distanceToStop, stopValidity } = computeOpenPhase2Metrics({
    direction,
    entryPrice,
    latestClose,
    stopLoss,
    takeProfit,
  });

  const { band: stopBand } = classifyStopPriceBand({
    direction,
    entryPrice,
    distanceToStop,
    stopValidity,
  });

  const staleVsBenchmark =
    latestBarDate == null ? "unknown" : utcDayOnlyMs(latestBarDate) < utcDayOnlyMs(evalBarDate);

  const structureHints =
    latestClose != null ? evaluateSetupStructureHints({ direction, close: latestClose, setup: setupLevels }) : [];

  const healthLogStress = logSuggestsStructureStress(latestHealthLog);

  const surface = resolveEodReviewSurface({
    stopBand,
    staleVsBenchmark,
    structureHints,
    healthLogStress,
    reviewedToday: AUTOMATED_CHECK_REVIEWED_TODAY,
  });

  return {
    healthLevel: SURFACE_TO_HEALTH_LEVEL[surface],
    surface,
    priceVsZone: describePriceVsZone(latestClose, setupLevels),
    structureStatus: structureHintsTraderLine(structureHints),
    recommendedAction: RECOMMENDED_ACTION[surface] ?? null,
  };
}
