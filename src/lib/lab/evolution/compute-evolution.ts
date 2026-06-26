import type { PrismaClient } from "@/generated/prisma/client";
import type { EvolutionTrend } from "@/generated/prisma/client";

export async function computeEvolutionScore(
  prisma: PrismaClient,
  agentId: string,
  sessionDate: Date
): Promise<{ score: number; trend: EvolutionTrend; components: Record<string, number> }> {
  const recent = await prisma.agentPerformanceDaily.findMany({
    where: { agentId, sessionDate: { lte: sessionDate } },
    orderBy: { sessionDate: "desc" },
    take: 180,
  });

  const recent90 = recent.slice(0, 90);
  const prior90 = recent.slice(90, 180);

  const avgSharpe = (rows: typeof recent) =>
    rows.length > 0 ? rows.reduce((s, r) => s + r.sharpeLike, 0) / rows.length : 0;
  const avgDd = (rows: typeof recent) =>
    rows.length > 0 ? rows.reduce((s, r) => s + r.maxDrawdownPct, 0) / rows.length : 0;
  const avgReturn = (rows: typeof recent) =>
    rows.length > 0 ? rows.reduce((s, r) => s + r.totalReturnPct, 0) / rows.length : 0;

  const sharpeImprovement = avgSharpe(recent90) - avgSharpe(prior90);
  const ddImprovement = avgDd(prior90) - avgDd(recent90);
  const returnImprovement = avgReturn(recent90) - avgReturn(prior90);

  const calRecent = await prisma.agentCalibrationDaily.findMany({
    where: { agentId },
    orderBy: { sessionDate: "desc" },
    take: 60,
  });
  const calPrior = calRecent.slice(30);
  const calImprovement =
    (calPrior.reduce((s, c) => s + c.brierScore, 0) / Math.max(1, calPrior.length)) -
    (calRecent.slice(0, 30).reduce((s, c) => s + c.brierScore, 0) / Math.max(1, Math.min(30, calRecent.length)));

  const components = {
    sharpeImprovement: sharpeImprovement * 0.3,
    calibrationImprovement: calImprovement * 0.25,
    consistencyImprovement: ddImprovement * 0.2,
    drawdownImprovement: ddImprovement * 0.15,
    learningRate: returnImprovement * 0.1,
  };

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  let trend: EvolutionTrend = "STABLE";
  if (score > 0.05) trend = "IMPROVING";
  else if (score < -0.05) trend = "DEGRADING";

  return { score, trend, components };
}

export async function persistAllEvolutionScores(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const agents = await prisma.paperAgent.findMany({
    where: { slug: { not: "cio" }, agentClass: "AI" },
  });

  for (const agent of agents) {
    const evo = await computeEvolutionScore(prisma, agent.id, sessionDate);
    await prisma.agentEvolutionDaily.upsert({
      where: { agentId_sessionDate: { agentId: agent.id, sessionDate } },
      create: {
        agentId: agent.id,
        sessionDate,
        score: evo.score,
        trend: evo.trend,
        componentsJson: evo.components as object,
      },
      update: {
        score: evo.score,
        trend: evo.trend,
        componentsJson: evo.components as object,
      },
    });
  }
  return agents.length;
}
