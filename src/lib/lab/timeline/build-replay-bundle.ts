import type { PrismaClient } from "@/generated/prisma/client";

export async function buildSessionReplayBundle(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<object> {
  const regime = await prisma.marketRegimeSnapshot.findUnique({
    where: { sessionDate },
  });

  const decisions = await prisma.agentDecision.findMany({
    where: { sessionDate },
    include: { agent: true, output: true },
    orderBy: { createdAt: "asc" },
  });

  const rankingsBefore = await prisma.agentRanking.findMany({
    where: { sessionDate },
    orderBy: { rank: "asc" },
    include: { agent: true },
  });

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { sessionDate },
    include: { portfolio: { include: { agent: true } } },
  });

  const battles = await prisma.arenaBattle.findMany({
    where: { sessionDate },
    include: {
      battleDecisions: { include: { outcome: true, decision: { include: { agent: true } } } },
    },
  });

  const cio = await prisma.cioRecommendation.findMany({
    where: { sessionDate },
  });

  return {
    sessionDate: sessionDate.toISOString().slice(0, 10),
    regime: regime
      ? {
          gate1Level: regime.gate1Level,
          dimensions: regime.dimensionsJson,
          confidence: regime.confidence,
        }
      : null,
    decisions: decisions.map((d) => ({
      agentSlug: d.agent.slug,
      symbol: d.symbol,
      action: d.action,
      confidence: d.confidence,
      reasoning: d.reasoningSummary,
    })),
    rankings: rankingsBefore.map((r) => ({
      agentSlug: r.agent.slug,
      rank: r.rank,
      score: r.compositeScore,
    })),
    navSnapshots: snapshots.map((s) => ({
      agentSlug: s.portfolio.agent.slug,
      navVnd: Number(s.navVnd),
      exposurePct: s.exposurePct,
    })),
    battles: battles.map((b) => ({
      symbol: b.symbol,
      status: b.status,
      decisions: b.battleDecisions.map((bd) => ({
        agentSlug: bd.decision.agent.slug,
        action: bd.action,
        verdict: bd.outcome?.verdict,
        explanation: bd.outcome?.explanation,
      })),
    })),
    cio: cio.map((c) => ({ symbol: c.symbol, payload: c.payload })),
  };
}

export async function persistSessionReplayBundle(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<void> {
  const bundle = await buildSessionReplayBundle(prisma, sessionDate);
  const regime = await prisma.marketRegimeSnapshot.findUnique({
    where: { sessionDate },
  });
  await prisma.sessionReplayBundle.upsert({
    where: { sessionDate },
    create: {
      sessionDate,
      regimeId: regime?.sessionDate ?? null,
      bundleJson: bundle as object,
    },
    update: {
      regimeId: regime?.sessionDate ?? null,
      bundleJson: bundle as object,
    },
  });
}
