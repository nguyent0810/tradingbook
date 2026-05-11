/**
 * Derived open-position context for the trades ledger — daily bars only, never intraday.
 * Pure helpers; safe defaults when data is missing.
 */

import type { StopValidity } from "@/lib/trades/position-health";
import { utcCalendarDayMs } from "@/lib/trades/position-health";
import {
  buildReviewFocusHints,
  describeDeltaSinceReview,
  describeSessionCloseDelta,
} from "@/lib/trades/eod-review-workflow";
import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";
import { checklistMarkedCount } from "@/lib/trades/trade-health-review-checklist";

/** Cushion from latest daily close to planned stop, as % of entry (absolute value when breached). */
export const NEAR_STOP_CUSHION_PCT = 2;

export type StopPriceBand = "breached" | "tight" | "comfortable" | "unknown";

export type StructureHint =
  | "below_pullback_zone"
  | "failed_breakout_hold"
  | "extended_move";

export type EodReviewSurface =
  | "stop_violated"
  | "structure_weakening"
  | "under_pressure"
  | "stale_bar_review"
  | "review_needed"
  | "review_completed";

export type LatestTradeHealthLog = {
  healthLevel: string;
  structureStatus: string | null;
  checkedAt: Date;
  /** From latest row `review_checklist` JSON; null when absent or empty. */
  reviewChecklist: EodReviewChecklistState | null;
};

export type SetupLevelsSnapshot = {
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
};

/** Cash at risk if stop fills at planned stop (same price units as entry × qty). */
export function computePlannedCapitalAtRisk(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number | null;
  quantity: number;
  stopValidity: StopValidity;
}): number | null {
  const { direction, entryPrice, stopLoss, quantity, stopValidity } = params;
  if (stopValidity !== "valid" || stopLoss == null || !Number.isFinite(stopLoss)) {
    return null;
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const riskPerShare =
    direction === "LONG" ? entryPrice - stopLoss : stopLoss - entryPrice;
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) return null;

  return Math.abs(riskPerShare * quantity);
}

export function classifyStopPriceBand(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  distanceToStop: number | null;
  stopValidity: StopValidity;
}): { band: StopPriceBand; cushionPctOfEntry: number | null } {
  const { entryPrice, distanceToStop, stopValidity } = params;

  if (stopValidity !== "valid" || distanceToStop == null || !Number.isFinite(distanceToStop)) {
    return { band: "unknown", cushionPctOfEntry: null };
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { band: "unknown", cushionPctOfEntry: null };
  }

  const cushionPct = (distanceToStop / entryPrice) * 100;

  if (distanceToStop < 0) return { band: "breached", cushionPctOfEntry: cushionPct };

  if (cushionPct < NEAR_STOP_CUSHION_PCT) return { band: "tight", cushionPctOfEntry: cushionPct };

  return { band: "comfortable", cushionPctOfEntry: cushionPct };
}

export function stopBandTraderLabel(band: StopPriceBand): string {
  switch (band) {
    case "breached":
      return "Stop breached vs daily close";
    case "tight":
      return "Close to stop (daily)";
    case "comfortable":
      return "Clear of stop (daily)";
    default:
      return "Stop distance unavailable";
  }
}

/** Calendar-day lag when benchmark session is after equity bar (positive = bar is old). */
export function calendarDaysBehindBenchmark(
  barDate: Date,
  benchmarkSession: Date | null
): number | null {
  if (!benchmarkSession) return null;
  const ms = utcCalendarDayMs(benchmarkSession) - utcCalendarDayMs(barDate);
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor(ms / 86_400_000);
  return Math.max(0, days);
}

/** Conservative LONG breakout-pullback geometry checks vs latest close only. */
export function evaluateSetupStructureHints(params: {
  direction: "LONG" | "SHORT";
  close: number;
  setup: SetupLevelsSnapshot | null;
}): StructureHint[] {
  const { direction, close, setup } = params;
  if (!setup || !Number.isFinite(close)) return [];

  const { breakoutLevel, pullbackZoneLow, pullbackZoneHigh } = setup;
  if (
    !Number.isFinite(breakoutLevel) ||
    breakoutLevel <= 0 ||
    !Number.isFinite(pullbackZoneLow) ||
    !Number.isFinite(pullbackZoneHigh)
  ) {
    return [];
  }

  if (direction !== "LONG") {
    return [];
  }

  const hints: StructureHint[] = [];

  if (close < pullbackZoneLow - 1e-9) {
    hints.push("below_pullback_zone");
  }

  if (close < breakoutLevel * 0.998) {
    hints.push("failed_breakout_hold");
  }

  const zoneMid = (pullbackZoneLow + pullbackZoneHigh) / 2;
  if (
    close > pullbackZoneHigh &&
    breakoutLevel > 0 &&
    (close - breakoutLevel) / breakoutLevel > 0.12 &&
    close > zoneMid
  ) {
    hints.push("extended_move");
  }

  return hints;
}

export function structureHintsTraderLine(hints: readonly StructureHint[]): string | null {
  if (hints.length === 0) return null;
  const parts: string[] = [];
  if (hints.includes("below_pullback_zone")) {
    parts.push("Close below pullback zone");
  }
  if (hints.includes("failed_breakout_hold")) {
    parts.push("Close back under breakout anchor");
  }
  if (hints.includes("extended_move")) {
    parts.push("Extended vs breakout anchor — watch digestion");
  }
  return parts.join(" · ") || null;
}

export function logSuggestsStructureStress(log: LatestTradeHealthLog | null): boolean {
  if (!log) return false;
  const lvl = log.healthLevel.toUpperCase();
  if (lvl === "AT_RISK" || lvl === "DEAD") return true;
  const s = (log.structureStatus ?? "").toLowerCase();
  return /\b(weak|broken|invalid|failed|stressed)\b/.test(s);
}

export function resolveEodReviewSurface(params: {
  stopBand: StopPriceBand;
  staleVsBenchmark: boolean | "unknown" | null;
  structureHints: readonly StructureHint[];
  healthLogStress: boolean;
  reviewedToday: boolean;
}): EodReviewSurface {
  const {
    stopBand,
    staleVsBenchmark,
    structureHints,
    healthLogStress,
    reviewedToday,
  } = params;

  if (stopBand === "breached") return "stop_violated";

  const structuralConcern =
    structureHints.length > 0 || healthLogStress;

  if (structuralConcern) return "structure_weakening";

  if (stopBand === "tight") return "under_pressure";

  if (staleVsBenchmark === true) return "stale_bar_review";

  if (!reviewedToday) return "review_needed";

  return "review_completed";
}

export function eodSurfaceTraderLabel(surface: EodReviewSurface): string {
  switch (surface) {
    case "stop_violated":
      return "Stop violated";
    case "structure_weakening":
      return "Structure weakening";
    case "under_pressure":
      return "Position under pressure";
    case "stale_bar_review":
      return "Review needed — stale bar";
    case "review_needed":
      return "Review needed";
    case "review_completed":
      return "Review completed today";
    default:
      return "On track";
  }
}

export type OpenPositionReviewDto = {
  stopBand: StopPriceBand;
  stopBandLabel: string;
  cushionPctOfEntry: number | null;
  cushionPctDisplay: string | null;
  plannedCapitalAtRisk: number | null;
  setupValidityLine: string | null;
  headline: string;
  primaryReviewLabel: string;
  surface: EodReviewSurface;
  badges: ReadonlyArray<{
    key: string;
    label: string;
    tone: "danger" | "warn" | "ok" | "muted";
  }>;
  /** Conservative scan bullets — not execution advice. */
  focusHints: readonly string[];
  sessionDeltaLine: string | null;
  sinceReviewDeltaLine: string | null;
  latestChecklist: EodReviewChecklistState | null;
  checklistSummaryLine: string | null;
  /** True when equity bar is strictly older than benchmark session. */
  marketDataStale: boolean;
};

export function buildOpenPositionReviewDto(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  stopValidity: StopValidity;
  distanceToStop: number | null;
  latestClose: number | null;
  latestBarDate: Date | null;
  staleVsBenchmark: boolean | "unknown" | null;
  benchmarkSession: Date | null;
  reviewedToday: boolean;
  setupLevels: SetupLevelsSnapshot | null;
  latestHealthLog: LatestTradeHealthLog | null;
  /** Prior session daily close (same symbol), when available. */
  priorClose: number | null;
  /** Daily close on or before last review checkpoint (UTC date bound). */
  baselineCloseAtLastReview: number | null;
}): OpenPositionReviewDto {
  const {
    direction,
    entryPrice,
    quantity,
    stopLoss,
    stopValidity,
    distanceToStop,
    latestClose,
    latestBarDate,
    staleVsBenchmark,
    benchmarkSession,
    reviewedToday,
    setupLevels,
    latestHealthLog,
    priorClose,
    baselineCloseAtLastReview,
  } = params;

  const latestChecklist = latestHealthLog?.reviewChecklist ?? null;

  const { band: stopBand, cushionPctOfEntry } = classifyStopPriceBand({
    direction,
    entryPrice,
    distanceToStop,
    stopValidity,
  });

  const plannedCapitalAtRisk = computePlannedCapitalAtRisk({
    direction,
    entryPrice,
    stopLoss,
    quantity,
    stopValidity,
  });

  const hints =
    latestClose != null && setupLevels
      ? evaluateSetupStructureHints({
          direction,
          close: latestClose,
          setup: setupLevels,
        })
      : [];

  const setupValidityLine = structureHintsTraderLine(hints);
  const healthStress = logSuggestsStructureStress(latestHealthLog);

  const surface = resolveEodReviewSurface({
    stopBand,
    staleVsBenchmark,
    structureHints: hints,
    healthLogStress: healthStress,
    reviewedToday,
  });

  const primaryReviewLabel = eodSurfaceTraderLabel(surface);

  const cushionPctDisplay =
    cushionPctOfEntry != null && Number.isFinite(cushionPctOfEntry)
      ? `${cushionPctOfEntry.toFixed(1)}% cushion vs entry`
      : null;

  const lagDays =
    latestBarDate && benchmarkSession
      ? calendarDaysBehindBenchmark(latestBarDate, benchmarkSession)
      : null;

  const structureTail =
    hints.includes("below_pullback_zone") ? "Close fell below pullback zone." :
    hints.includes("failed_breakout_hold") ? "Close slipped under breakout anchor." :
    hints.includes("extended_move") ? "Extended vs breakout anchor — watch digestion." :
    "";

  const staleTail =
    staleVsBenchmark === true && lagDays != null && lagDays >= 1
      ? `Latest bar is ${lagDays} calendar day(s) behind the benchmark session.`
      : staleVsBenchmark === true
        ? "Latest bar looks stale vs benchmark."
        : "";

  let headline = "";
  if (stopBand === "breached") {
    headline =
      "Latest close is through the planned stop — structural exit signal on daily data only (not intraday advice).";
  } else if (stopBand === "tight" && cushionPctOfEntry != null) {
    headline = `About ${Math.abs(cushionPctOfEntry).toFixed(1)}% cushion vs entry to the planned stop — tight leash.`;
  } else if (stopBand === "comfortable") {
    headline = "Daily close sits clear of the planned stop.";
  } else if (stopValidity === "missing") {
    headline = "Add a valid planned stop to unlock distance and capital-at-risk context.";
  } else if (stopValidity === "invalid") {
    headline = "Stop sits on the wrong side of entry for this direction — fix stop to measure distance.";
  } else if (latestClose == null) {
    headline = "No latest equity bar — cannot score stop distance.";
  } else {
    headline = "Stop distance context incomplete on latest bar.";
  }

  headline = [headline, structureTail, staleTail].filter(Boolean).join(" ").trim();

  type Badge = OpenPositionReviewDto["badges"][number];
  const badges: Badge[] = [
    {
      key: "surface",
      label: primaryReviewLabel,
      tone:
        surface === "stop_violated"
          ? "danger"
          : surface === "structure_weakening" ||
              surface === "under_pressure" ||
              surface === "stale_bar_review"
            ? "warn"
            : surface === "review_completed"
              ? "ok"
              : "muted",
    },
  ];

  if (staleVsBenchmark === true && surface !== "stale_bar_review") {
    badges.push({ key: "stale", label: "Stale market data", tone: "warn" });
  } else if (staleVsBenchmark === "unknown") {
    badges.push({
      key: "freshness_unknown",
      label: "Freshness unverified",
      tone: "muted",
    });
  }

  const focusHints = buildReviewFocusHints({
    direction,
    stopBand,
    structureHints: hints,
    staleVsBenchmark,
    healthLogStress: healthStress,
    hasSetupLevels: setupLevels != null,
  });

  const sessionDeltaLine = describeSessionCloseDelta({
    direction,
    latestClose,
    priorClose,
  });

  const sinceReviewDeltaLine = describeDeltaSinceReview({
    direction,
    latestClose,
    baselineClose: baselineCloseAtLastReview,
    stopBand,
  });

  const checklistSummaryLine =
    latestChecklist != null && checklistMarkedCount(latestChecklist) > 0
      ? `Latest checkpoint checklist: ${checklistMarkedCount(latestChecklist)}/4 marked`
      : null;

  const marketDataStale = staleVsBenchmark === true;

  return {
    stopBand,
    stopBandLabel: stopBandTraderLabel(stopBand),
    cushionPctOfEntry,
    cushionPctDisplay,
    plannedCapitalAtRisk,
    setupValidityLine,
    headline: headline.trim(),
    primaryReviewLabel,
    surface,
    badges,
    focusHints,
    sessionDeltaLine,
    sinceReviewDeltaLine,
    latestChecklist,
    checklistSummaryLine,
    marketDataStale,
  };
}
