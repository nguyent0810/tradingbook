import {
  SetupHealthLevel,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { EodReviewChecklistState } from "@/lib/trades/trade-health-review-checklist";
import {
  parseHealthReviewLogPayload,
  type ReviewOutcomeId,
} from "@/lib/trades/review-outcome";

export type TradeHealthLevel = "HEALTHY" | "WARNING" | "AT_RISK" | "DEAD";

export type TradeHealthLogDetailRow = {
  checkedAt: Date;
  healthLevel: TradeHealthLevel | null;
  priceVsZone: string | null;
  structureStatus: string | null;
  recommendedAction: string | null;
  reviewChecklist: EodReviewChecklistState | null;
  reviewOutcome: ReviewOutcomeId | null;
};

const HEALTH_LEVELS = new Set<TradeHealthLevel>([
  "HEALTHY",
  "WARNING",
  "AT_RISK",
  "DEAD",
]);

export type TradeHealthLogCreateParams = {
  tradeId: string;
  healthLevel: SetupHealthLevel;
  healthScore: number | null;
  priceVsZone: string | null;
  structureStatus: string | null;
  recommendedAction: string | null;
  reviewPayloadJson: string | null;
};

/** Maps validated checkpoint fields to `tradeHealthLog.create` data (omits `id`, `checkedAt`). */
export function buildTradeHealthLogCreateData(
  input: TradeHealthLogCreateParams
): Prisma.TradeHealthLogUncheckedCreateInput {
  const reviewChecklist: Prisma.InputJsonValue | undefined =
    input.reviewPayloadJson != null
      ? (JSON.parse(input.reviewPayloadJson) as Prisma.InputJsonValue)
      : undefined;

  return {
    tradeId: input.tradeId,
    healthLevel: input.healthLevel,
    healthScore: input.healthScore,
    priceVsZone: input.priceVsZone,
    structureStatus: input.structureStatus,
    recommendedAction: input.recommendedAction,
    reviewChecklist,
  };
}

/** Coerce DB / Prisma enum values to the detail-page health level union. */
export function normalizeTradeHealthLevel(
  value: string | null | undefined
): TradeHealthLevel | null {
  if (value == null) return null;
  return HEALTH_LEVELS.has(value as TradeHealthLevel)
    ? (value as TradeHealthLevel)
    : null;
}

function mapRowToDetail(row: {
  checkedAt: Date;
  healthLevel: string;
  priceVsZone: string | null;
  structureStatus: string | null;
  recommendedAction: string | null;
  reviewChecklist: unknown;
}): TradeHealthLogDetailRow {
  const payload = parseHealthReviewLogPayload(row.reviewChecklist);
  return {
    checkedAt: row.checkedAt,
    healthLevel: normalizeTradeHealthLevel(row.healthLevel),
    priceVsZone: row.priceVsZone,
    structureStatus: row.structureStatus,
    recommendedAction: row.recommendedAction,
    reviewChecklist: payload.checklist,
    reviewOutcome: payload.reviewOutcome,
  };
}

/** Server-local end of calendar day (aligned with trade detail `hasCheckpointToday`). */
export function endOfLocalCalendarDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function localDayBounds(now: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = endOfLocalCalendarDay(now);
  return { dayStart, dayEnd };
}

/**
 * Resolves exit health from trade checkpoints for `SetupOutcome` writeback.
 * Never falls back to `healthLevelAtEntry`.
 */
export async function resolveHealthLevelAtExitForTrade(
  db: PrismaClient,
  params: { tradeId: string; exitDate: Date | null }
): Promise<SetupHealthLevel | null> {
  const where =
    params.exitDate != null
      ? {
          tradeId: params.tradeId,
          checkedAt: { lte: endOfLocalCalendarDay(params.exitDate) },
        }
      : { tradeId: params.tradeId };

  const latest = await db.tradeHealthLog.findFirst({
    where,
    orderBy: { checkedAt: "desc" },
    select: { healthLevel: true },
  });

  return latest?.healthLevel ?? null;
}

/**
 * Last N health checkpoints for one trade (newest first), plus whether any fall on `now`'s local calendar day.
 * Matches prior raw SQL: ORDER BY checked_at DESC LIMIT 20; silent empty result on read failure.
 */
export async function loadTradeHealthLogsForDetailPage(
  db: PrismaClient,
  params: { tradeId: string; now: Date; limit?: number }
): Promise<{
  healthLogsDesc: TradeHealthLogDetailRow[];
  hasCheckpointToday: boolean;
}> {
  const limit = params.limit ?? 20;
  const { dayStart, dayEnd } = localDayBounds(params.now);

  try {
    const rows = await db.tradeHealthLog.findMany({
      where: { tradeId: params.tradeId },
      orderBy: { checkedAt: "desc" },
      take: limit,
      select: {
        checkedAt: true,
        healthLevel: true,
        priceVsZone: true,
        structureStatus: true,
        recommendedAction: true,
        reviewChecklist: true,
      },
    });

    const healthLogsDesc = rows.map(mapRowToDetail);
    const hasCheckpointToday = healthLogsDesc.some(
      (r) => r.checkedAt >= dayStart && r.checkedAt <= dayEnd
    );

    return { healthLogsDesc, hasCheckpointToday };
  } catch {
    return { healthLogsDesc: [], hasCheckpointToday: false };
  }
}
