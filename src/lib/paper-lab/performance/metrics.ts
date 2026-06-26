import type { PrismaClient } from "@/generated/prisma/client";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";

export type AgentPerformanceMetrics = {
  agentId: string;
  navVnd: number;
  totalReturnPct: number;
  realizedPnlVnd: number;
  unrealizedPnlVnd: number;
  winRate: number;
  maxDrawdownPct: number;
  sharpeLike: number;
  tradeCount: number;
  openPositions: number;
  profitFactor: number;
  avgWinR: number;
  avgLossR: number;
};

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const var_ = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(var_);
}

export async function computeAgentPerformance(
  prisma: PrismaClient,
  agentId: string,
  sessionDate: Date,
  navVnd: number,
  initialCapitalVnd: number = PAPER_INITIAL_CAPITAL_VND
): Promise<AgentPerformanceMetrics> {
  const portfolio = await prisma.paperPortfolio.findUnique({
    where: { agentId },
    include: {
      positions: { where: { status: { in: ["OPEN", "PARTIAL"] } } },
    },
  });

  const closedTrades = await prisma.paperTrade.findMany({
    where: { position: { portfolio: { agentId } } },
  });

  const wins = closedTrades.filter((t) => Number(t.realizedPnlVnd) > 0);
  const losses = closedTrades.filter((t) => Number(t.realizedPnlVnd) < 0);
  const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;

  const grossWin = wins.reduce((s, t) => s + Number(t.realizedPnlVnd), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.realizedPnlVnd), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { portfolio: { agentId } },
    orderBy: { sessionDate: "asc" },
    take: 90,
  });

  let peak = initialCapitalVnd;
  let maxDd = 0;
  const dailyReturns: number[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const nav = Number(snapshots[i]!.navVnd);
    if (nav > peak) peak = nav;
    const dd = peak > 0 ? ((peak - nav) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
    if (i > 0) {
      const prev = Number(snapshots[i - 1]!.navVnd);
      if (prev > 0) dailyReturns.push((nav - prev) / prev);
    }
  }

  const meanRet = dailyReturns.length ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const vol = stdDev(dailyReturns);
  const sharpeLike = vol > 0 ? (meanRet / vol) * Math.sqrt(252) : 0;

  const realizedPnlVnd = closedTrades.reduce((s, t) => s + Number(t.realizedPnlVnd), 0);
  const unrealizedPnlVnd = navVnd - initialCapitalVnd - realizedPnlVnd;

  return {
    agentId,
    navVnd,
    totalReturnPct: ((navVnd - initialCapitalVnd) / initialCapitalVnd) * 100,
    realizedPnlVnd,
    unrealizedPnlVnd,
    winRate,
    maxDrawdownPct: maxDd,
    sharpeLike,
    tradeCount: closedTrades.length,
    openPositions: portfolio?.positions.length ?? 0,
    profitFactor,
    avgWinR:
      wins.length > 0
        ? wins.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / wins.length
        : 0,
    avgLossR:
      losses.length > 0
        ? losses.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / losses.length
        : 0,
  };
}

export async function persistAgentPerformanceDaily(
  prisma: PrismaClient,
  agentId: string,
  sessionDate: Date,
  metrics: AgentPerformanceMetrics
): Promise<void> {
  await prisma.agentPerformanceDaily.upsert({
    where: { agentId_sessionDate: { agentId, sessionDate } },
    create: {
      agentId,
      sessionDate,
      navVnd: BigInt(Math.round(metrics.navVnd)),
      totalReturnPct: metrics.totalReturnPct,
      realizedPnlVnd: BigInt(Math.round(metrics.realizedPnlVnd)),
      unrealizedPnlVnd: BigInt(Math.round(metrics.unrealizedPnlVnd)),
      winRate: metrics.winRate,
      maxDrawdownPct: metrics.maxDrawdownPct,
      sharpeLike: metrics.sharpeLike,
      tradeCount: metrics.tradeCount,
      openPositions: metrics.openPositions,
      metricsJson: {
        profitFactor: metrics.profitFactor,
        avgWinR: metrics.avgWinR,
        avgLossR: metrics.avgLossR,
      },
    },
    update: {
      navVnd: BigInt(Math.round(metrics.navVnd)),
      totalReturnPct: metrics.totalReturnPct,
      realizedPnlVnd: BigInt(Math.round(metrics.realizedPnlVnd)),
      unrealizedPnlVnd: BigInt(Math.round(metrics.unrealizedPnlVnd)),
      winRate: metrics.winRate,
      maxDrawdownPct: metrics.maxDrawdownPct,
      sharpeLike: metrics.sharpeLike,
      tradeCount: metrics.tradeCount,
      openPositions: metrics.openPositions,
      metricsJson: {
        profitFactor: metrics.profitFactor,
        avgWinR: metrics.avgWinR,
        avgLossR: metrics.avgLossR,
      },
    },
  });
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function compositeRankingScore(metrics: AgentPerformanceMetrics): number {
  const tradePenalty = Math.min(metrics.tradeCount, 30) / 30;
  return (
    0.25 * Math.max(0, metrics.totalReturnPct / 20) +
    0.2 * Math.max(0, metrics.sharpeLike / 2) +
    0.15 * Math.min(metrics.profitFactor, 3) / 3 +
    0.15 * metrics.winRate +
    0.1 * Math.max(0, 1 - metrics.maxDrawdownPct / 20) +
    0.1 * 0.5 +
    0.05 * tradePenalty
  );
}

export async function computeAndPersistRankings(
  prisma: PrismaClient,
  sessionDate: Date,
  metricsList: AgentPerformanceMetrics[]
): Promise<void> {
  const strategyAgents = metricsList.filter((m) => m.agentId !== undefined);
  const scores = strategyAgents.map((m) => ({
    agentId: m.agentId,
    score: compositeRankingScore(m),
    metrics: m,
  }));
  scores.sort((a, b) => b.score - a.score);

  const prev = await prisma.agentRanking.findMany({
    where: {
      sessionDate: {
        lt: sessionDate,
      },
    },
    orderBy: { sessionDate: "desc" },
    take: strategyAgents.length * 2,
  });
  const prevRankByAgent = new Map<string, number>();
  for (const r of prev) {
    if (!prevRankByAgent.has(r.agentId)) prevRankByAgent.set(r.agentId, r.rank);
  }

  for (let i = 0; i < scores.length; i++) {
    const { agentId, score, metrics } = scores[i]!;
    const rank = i + 1;
    const prevRank = prevRankByAgent.get(agentId);
    const rankChange = prevRank != null ? prevRank - rank : 0;

    await prisma.agentRanking.upsert({
      where: { sessionDate_agentId: { sessionDate, agentId } },
      create: {
        sessionDate,
        agentId,
        rank,
        rankChange,
        compositeScore: score * 100,
        scoreBreakdown: {
          totalReturnPct: metrics.totalReturnPct,
          sharpeLike: metrics.sharpeLike,
          winRate: metrics.winRate,
        },
      },
      update: {
        rank,
        rankChange,
        compositeScore: score * 100,
        scoreBreakdown: {
          totalReturnPct: metrics.totalReturnPct,
          sharpeLike: metrics.sharpeLike,
          winRate: metrics.winRate,
        },
      },
    });
  }
}
