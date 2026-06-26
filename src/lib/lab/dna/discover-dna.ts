import type { PrismaClient } from "@/generated/prisma/client";
import type { AgentDnaProfile } from "@/lib/lab/types/regime";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)]!;
}

export async function discoverAgentDna(
  prisma: PrismaClient,
  agentId: string,
  asOfSession: Date
): Promise<AgentDnaProfile> {
  const agent = await prisma.paperAgent.findUniqueOrThrow({ where: { id: agentId } });

  const decisions = await prisma.agentDecision.findMany({
    where: { agentId, sessionDate: { lte: asOfSession } },
    include: { output: true, battleDecision: { include: { outcome: true } } },
    orderBy: { sessionDate: "desc" },
    take: 300,
  });

  const signalCounts = new Map<string, { wins: number; total: number }>();
  const holdingDays: number[] = [];
  let totalConfidence = 0;

  for (const d of decisions) {
    totalConfidence += d.confidence;
    const payload = d.output?.payload as { supporting_signals?: string[] } | undefined;
    const signals = payload?.supporting_signals ?? [];
    const won =
      d.battleDecision?.outcome?.verdict === "CORRECT_BUY" ||
      d.battleDecision?.outcome?.verdict === "CORRECT_AVOID";

    for (const sig of signals) {
      const s = signalCounts.get(sig) ?? { wins: 0, total: 0 };
      s.total += 1;
      if (won) s.wins += 1;
      signalCounts.set(sig, s);
    }
  }

  const trades = await prisma.paperTrade.findMany({
    where: { position: { portfolio: { agentId } } },
    select: { holdingDays: true, rMultiple: true },
    take: 200,
  });
  for (const t of trades) holdingDays.push(t.holdingDays);

  const loves: AgentDnaProfile["loves"] = [];
  const avoids: AgentDnaProfile["avoids"] = [];

  for (const [signal, stats] of signalCounts) {
    if (stats.total < 3) continue;
    const affinity = stats.wins / stats.total;
    if (affinity >= 0.55) loves.push({ signal, affinity });
    else if (affinity <= 0.4) avoids.push({ signal, aversion: 1 - affinity });
  }

  loves.sort((a, b) => b.affinity - a.affinity);
  avoids.sort((a, b) => b.aversion - a.aversion);

  const sortedDays = [...holdingDays].sort((a, b) => a - b);

  const regimeRows = await prisma.agentRegimePerformanceDaily.findMany({
    where: { agentId },
    orderBy: { sessionDate: "desc" },
    take: 50,
  });

  const weaknessRegimes: AgentDnaProfile["weaknessRegimes"] = [];
  const strengthRegimes: AgentDnaProfile["strengthRegimes"] = [];
  for (const r of regimeRows) {
    if (r.returnPct < -2) weaknessRegimes.push({ regime: r.trendRegime, underperformancePct: r.returnPct });
    if (r.returnPct > 2) strengthRegimes.push({ regime: r.trendRegime, outperformancePct: r.returnPct });
  }

  return {
    agentId: agent.slug,
    asOfSession: asOfSession.toISOString().slice(0, 10),
    loves: loves.slice(0, 8),
    avoids: avoids.slice(0, 8),
    preferredHoldingDays: {
      p25: percentile(sortedDays, 0.25),
      p50: percentile(sortedDays, 0.5),
      p75: percentile(sortedDays, 0.75),
    },
    favoriteSectors: [{ sector: "UNKNOWN", exposurePct: 0, winRate: 0 }],
    weaknessRegimes: weaknessRegimes.slice(0, 5),
    strengthRegimes: strengthRegimes.slice(0, 5),
    tradeFrequency: decisions.length / 90,
    avgConfidence: decisions.length > 0 ? totalConfidence / decisions.length : 0,
    specializationScore: loves.length > 3 ? 0.7 : 0.3,
  };
}

export async function persistAllAgentDna(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const agents = await prisma.paperAgent.findMany({
    where: { slug: { not: "cio" }, agentClass: "AI" },
  });

  for (const agent of agents) {
    const profile = await discoverAgentDna(prisma, agent.id, sessionDate);
    await prisma.agentDnaProfile.upsert({
      where: { agentId_asOfSession: { agentId: agent.id, asOfSession: sessionDate } },
      create: {
        agentId: agent.id,
        asOfSession: sessionDate,
        profileJson: profile as object,
      },
      update: { profileJson: profile as object },
    });
  }
  return agents.length;
}
