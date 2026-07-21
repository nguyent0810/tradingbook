import type { PrismaClient } from "@/generated/prisma/client";
import { ScanSetupType } from "@/generated/prisma/client";
import type { SetupCandidateRow } from "@/lib/scanner/setups-queries";
import { evaluateWatchHealth } from "./evaluate-watch-health";
import {
  buildHealthLines,
  healthFlagSummary,
  healthLevelActionHint,
  healthScoreLabel,
} from "./health-ui-copy";
import { fetchStockBarsGroupedAscThroughDate } from "./load-bars";
import {
  sortCandidatesWithHealth,
  type CandidateWithHealth,
} from "./sort-candidates";
import type { SetupHealthFlag, SetupHealthLevelValue } from "./types";

export type SurfacedCandidateHealthView = SetupCandidateRow & {
  healthFlags: SetupHealthFlag[];
  healthScore: number;
  healthScoreLabel: "Strong" | "Decent" | "Weak" | "Risky";
  healthLevel: SetupHealthLevelValue;
  healthLines: string[];
  healthSummary: string | null;
  healthHint: string | null;
  lifecycleSortLabel: "READY" | "WATCHING";
};

function closeInPullbackZone(
  close: number,
  zoneLow: number,
  zoneHigh: number
): boolean {
  return close >= zoneLow && close <= zoneHigh;
}

/**
 * Loads bars + optional watch rows, evaluates health per surfaced candidate, applies merge sort order.
 */
/**
 * Generous lookback bound for the health-eval bar fetch — well beyond the 20-bar
 * median/14-bar ATR windows actually needed, since SetupWatchItem has no expiry
 * to derive a tighter bound from. Bounds the query without risking a truncated window.
 */
const FROM_DATE_LOOKBACK_DAYS = 180;

export async function prepareSurfacedCandidatesHealthView(
  prisma: PrismaClient,
  candidates: SetupCandidateRow[],
  evalBarDate: Date
): Promise<SurfacedCandidateHealthView[]> {
  if (candidates.length === 0) return [];

  const symbolIds = [...new Set(candidates.map((c) => c.symbolId))];
  const fromDate = new Date(evalBarDate.getTime() - FROM_DATE_LOOKBACK_DAYS * 86_400_000);

  const [barsBySymbol, watches] = await Promise.all([
    fetchStockBarsGroupedAscThroughDate(prisma, symbolIds, evalBarDate, fromDate),
    prisma.setupWatchItem.findMany({
      where: {
        symbolId: { in: symbolIds },
        setupType: ScanSetupType.BREAKOUT_PULLBACK,
      },
    }),
  ]);

  const watchBySymbolId = new Map(watches.map((w) => [w.symbolId, w]));

  const merged: SurfacedCandidateHealthView[] = candidates.map((c) => {
    const w = watchBySymbolId.get(c.symbolId);
    const barsAsc = barsBySymbol.get(c.symbolId) ?? [];

    const breakoutLevel = w?.breakoutLevel ?? c.breakoutLevel;
    const pullbackZoneLow = w?.pullbackZoneLow ?? c.pullbackZoneLow;
    const pullbackZoneHigh = w?.pullbackZoneHigh ?? c.pullbackZoneHigh;
    const firstSeenBarDate = w?.firstSeenBarDate ?? c.barDate;

    const { flags, score, level, meta } = evaluateWatchHealth({
      breakoutLevel,
      pullbackZoneLow,
      pullbackZoneHigh,
      firstSeenBarDate,
      evalBarDate,
      barsAscThroughEval: barsAsc,
    });

    const lifecycleSortLabel = closeInPullbackZone(
      c.close,
      c.pullbackZoneLow,
      c.pullbackZoneHigh
    )
      ? "READY"
      : "WATCHING";

    return {
      ...c,
      healthFlags: flags,
      healthScore: score,
      healthScoreLabel: healthScoreLabel(score),
      healthLevel: level,
      healthLines: buildHealthLines(flags, meta),
      healthSummary: healthFlagSummary(flags),
      healthHint: healthLevelActionHint(level),
      lifecycleSortLabel,
    };
  });

  const forSort: CandidateWithHealth[] = merged.map((row) => ({
    symbolKey: row.symbolKey,
    symbolId: row.symbolId,
    close: row.close,
    pullbackZoneLow: row.pullbackZoneLow,
    pullbackZoneHigh: row.pullbackZoneHigh,
    lifecycleLabel: row.lifecycleSortLabel,
    healthLevel: row.healthLevel,
    healthScore: row.healthScore,
    rankScore: row.rankScore,
  }));

  const orderKeys = sortCandidatesWithHealth(forSort).map((r) => r.symbolKey);
  const rank = new Map(orderKeys.map((k, i) => [k, i]));

  return [...merged].sort((a, b) => {
    const ra = rank.get(a.symbolKey) ?? 0;
    const rb = rank.get(b.symbolKey) ?? 0;
    return ra - rb;
  });
}
