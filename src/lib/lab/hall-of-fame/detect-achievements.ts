import type { PrismaClient } from "@/generated/prisma/client";
import type { HallOfFameAchievementType } from "@/generated/prisma/client";

async function upsertHofIfBetter(
  prisma: PrismaClient,
  params: {
    achievementType: HallOfFameAchievementType;
    agentId: string | null;
    sessionDate?: Date;
    symbol?: string;
    value: number;
    metadata?: object;
  }
): Promise<void> {
  const existing = await prisma.hallOfFameEntry.findFirst({
    where: { achievementType: params.achievementType, agentId: params.agentId ?? undefined },
    orderBy: { value: "desc" },
  });

  if (existing && existing.value >= params.value) return;

  await prisma.hallOfFameEntry.create({
    data: {
      achievementType: params.achievementType,
      agentId: params.agentId,
      sessionDate: params.sessionDate,
      symbol: params.symbol,
      value: params.value,
      metadataJson: (params.metadata ?? {}) as object,
    },
  });
}

export async function detectHallOfFameAchievements(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  let detected = 0;

  const trades = await prisma.paperTrade.findMany({
    where: { closedSessionDate: sessionDate },
    include: { position: { include: { portfolio: { include: { agent: true } } } } },
  });

  for (const t of trades) {
    const agentId = t.position.portfolio.agentId;
    const r = t.rMultiple ?? 0;

    if (r > 0) {
      await upsertHofIfBetter(prisma, {
        achievementType: "HIGHEST_R_MULTIPLE",
        agentId,
        sessionDate,
        symbol: t.position.symbol,
        value: r,
        metadata: { tradeId: t.id },
      });
      detected += 1;
    }

    const pnl = Number(t.realizedPnlVnd);
    await upsertHofIfBetter(prisma, {
      achievementType: "GREATEST_TRADE",
      agentId,
      sessionDate,
      symbol: t.position.symbol,
      value: pnl,
      metadata: { tradeId: t.id, rMultiple: r },
    });
  }

  const perf = await prisma.agentPerformanceDaily.findMany({
    where: { sessionDate },
    include: { agent: true },
  });

  for (const p of perf) {
    await upsertHofIfBetter(prisma, {
      achievementType: "BEST_MONTHLY_RETURN",
      agentId: p.agentId,
      sessionDate,
      value: p.totalReturnPct,
    });

    const cal = await prisma.agentCalibrationDaily.findUnique({
      where: { agentId_sessionDate: { agentId: p.agentId, sessionDate } },
    });
    if (cal && cal.sampleSize >= 10) {
      const accuracy = 1 - cal.brierScore;
      await upsertHofIfBetter(prisma, {
        achievementType: "MOST_ACCURATE_AGENT",
        agentId: p.agentId,
        sessionDate,
        value: accuracy,
      });
    }

    const evo = await prisma.agentEvolutionDaily.findUnique({
      where: { agentId_sessionDate: { agentId: p.agentId, sessionDate } },
    });
    if (evo && evo.trend === "IMPROVING" && evo.score > 0.1) {
      await upsertHofIfBetter(prisma, {
        achievementType: "BEST_RECOVERY",
        agentId: p.agentId,
        sessionDate,
        value: evo.score,
      });
    }
  }

  const highConfWrong = await prisma.arenaBattleOutcome.findMany({
    where: {
      verdict: "WRONG_BUY",
      battle: { sessionDate },
    },
    include: { battleDecision: true },
    orderBy: { battleDecision: { confidence: "desc" } },
    take: 1,
  });

  if (highConfWrong[0]) {
    await upsertHofIfBetter(prisma, {
      achievementType: "WORST_PREDICTION",
      agentId: highConfWrong[0].agentId,
      sessionDate,
      value: highConfWrong[0].battleDecision.confidence,
      metadata: { outcomeId: highConfWrong[0].id },
    });
  }

  return detected;
}

export async function queryHallOfFame(
  prisma: PrismaClient,
  filters?: { achievementType?: HallOfFameAchievementType; agentId?: string; limit?: number }
) {
  return prisma.hallOfFameEntry.findMany({
    where: {
      ...(filters?.achievementType ? { achievementType: filters.achievementType } : {}),
      ...(filters?.agentId ? { agentId: filters.agentId } : {}),
    },
    orderBy: { value: "desc" },
    take: filters?.limit ?? 50,
    include: { agent: true },
  });
}
