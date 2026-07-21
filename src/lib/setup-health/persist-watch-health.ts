import type { PrismaClient } from "@/generated/prisma/client";
import { ScanQuality, ScanSetupType, SetupHealthLevel, SetupLifecycleStatus } from "@/generated/prisma/client";
import { evaluateWatchHealth } from "./evaluate-watch-health";
import type { OhlcvBar } from "./types";

export type SurfacedCandidateLike = {
  symbolId: string;
  quality: "A" | "B";
  close: number;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  barDate: Date;
};

function scanQuality(q: "A" | "B"): ScanQuality {
  return q === "A" ? ScanQuality.A : ScanQuality.B;
}

/**
 * Upsert watch rows from surfaced scanner candidates (health overlay sync).
 * Does not write lifecycle transitions — `lifecycleStatus` stays schema-default / existing FSM only.
 */
export async function syncWatchItemsFromSurfacedCandidates(
  prisma: PrismaClient,
  scanRunId: string,
  surfaced: SurfacedCandidateLike[]
): Promise<void> {
  for (const c of surfaced) {
    try {
      await prisma.setupWatchItem.upsert({
        where: {
          symbolId_setupType: {
            symbolId: c.symbolId,
            setupType: ScanSetupType.BREAKOUT_PULLBACK,
          },
        },
        create: {
          symbolId: c.symbolId,
          setupType: ScanSetupType.BREAKOUT_PULLBACK,
          quality: scanQuality(c.quality),
          breakoutLevel: c.breakoutLevel,
          pullbackZoneLow: c.pullbackZoneLow,
          pullbackZoneHigh: c.pullbackZoneHigh,
          firstSeenBarDate: c.barDate,
          lastSeenScanRunId: scanRunId,
        },
        update: {
          quality: scanQuality(c.quality),
          breakoutLevel: c.breakoutLevel,
          pullbackZoneLow: c.pullbackZoneLow,
          pullbackZoneHigh: c.pullbackZoneHigh,
          lastSeenScanRunId: scanRunId,
        },
      });
    } catch (e) {
      // One bad row (e.g. a concurrent lifecycle transition) must not abort sync for the rest.
      console.error(`[setup-health] syncWatchItemsFromSurfacedCandidates failed for symbolId=${c.symbolId}:`, e);
    }
  }
}

export async function evaluateAndPersistHealthForActiveWatchItems(
  prisma: PrismaClient,
  evalBarDate: Date,
  now: Date = new Date()
): Promise<{ updated: number }> {
  const watches = await prisma.setupWatchItem.findMany({
    where: {
      lifecycleStatus: {
        notIn: [
          SetupLifecycleStatus.TRIGGERED,
          SetupLifecycleStatus.EXPIRED,
          SetupLifecycleStatus.INVALID,
        ],
      },
    },
  });

  let updated = 0;

  for (const w of watches) {
    try {
      const rows = await prisma.stockDailyBar.findMany({
        where: {
          symbolId: w.symbolId,
          date: { lte: evalBarDate },
        },
        orderBy: { date: "asc" },
        select: {
          date: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      const barsAsc: OhlcvBar[] = rows.map((r) => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));

      const { flags, score, level } = evaluateWatchHealth({
        breakoutLevel: w.breakoutLevel,
        pullbackZoneLow: w.pullbackZoneLow,
        pullbackZoneHigh: w.pullbackZoneHigh,
        firstSeenBarDate: w.firstSeenBarDate,
        evalBarDate,
        barsAscThroughEval: barsAsc,
      });

      // The Prisma `SetupHealthLevel` enum has no NO_DATA member (would need a
      // migration). AT_RISK is the closest existing value that already means
      // "don't trust this without a closer look" — a safe, lossy downgrade for
      // the persisted column. The dashboard's own live computation (not this
      // periodic job) uses the real NO_DATA level to fully exclude Tier A/B/Go.
      const persistedLevel: SetupHealthLevel = level === "NO_DATA" ? "AT_RISK" : level;

      await prisma.setupWatchItem.update({
        where: { id: w.id },
        data: {
          healthFlags: flags,
          healthScore: score,
          healthLevel: persistedLevel,
          lastHealthEvaluatedAt: now,
        },
      });
      updated++;
    } catch (e) {
      // One bad row (DB timeout, or the watch item changed/deleted between the
      // read and this write) must not abort health evaluation for the rest of the batch.
      console.error(`[setup-health] evaluateAndPersistHealthForActiveWatchItems failed for watchItemId=${w.id}:`, e);
    }
  }

  return { updated };
}
