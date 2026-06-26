import type { PrismaClient } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { executeValidatedDecision } from "@/lib/paper-lab/engine/paper-trading-engine";
import { computePortfolioState } from "@/lib/paper-lab/portfolio/portfolio-service";

export async function ensureHumanPmAgent(
  prisma: PrismaClient,
  userId: string
): Promise<{ agentId: string; portfolioId: string }> {
  const slug = `human_${userId.slice(0, 8)}`;
  let agent = await prisma.paperAgent.findUnique({
    where: { slug },
    include: { portfolio: true },
  });

  if (!agent) {
    agent = await prisma.paperAgent.create({
      data: {
        slug,
        displayName: "Human PM",
        style: "Discretionary",
        agentClass: "HUMAN",
        userId,
        portfolio: {
          create: {
            initialCapitalVnd: BigInt(500_000_000),
            cashVnd: BigInt(500_000_000),
          },
        },
      },
      include: { portfolio: true },
    });
  }

  if (!agent.portfolio) {
    const portfolio = await prisma.paperPortfolio.create({
      data: {
        agentId: agent.id,
        initialCapitalVnd: BigInt(500_000_000),
        cashVnd: BigInt(500_000_000),
      },
    });
    return { agentId: agent.id, portfolioId: portfolio.id };
  }

  return { agentId: agent.id, portfolioId: agent.portfolio.id };
}

export async function submitHumanPmDecision(
  prisma: PrismaClient,
  params: {
    userId: string;
    sessionDate: Date;
    decision: AgentDecisionOutput;
    bundle: MarketContextBundle;
    bar: { low: number; high: number; close: number };
  }
) {
  const parsed = AgentDecisionOutputSchema.parse(params.decision);
  const { agentId, portfolioId } = await ensureHumanPmAgent(prisma, params.userId);

  const regime = await prisma.marketRegimeSnapshot.findUnique({
    where: { sessionDate: params.sessionDate },
  });

  const decision = await prisma.agentDecision.create({
    data: {
      agentId,
      agentVersion: "human-1.0.0",
      sessionDate: params.sessionDate,
      symbol: parsed.symbol,
      action: parsed.action,
      confidence: parsed.confidence,
      validationStatus: "VALID",
      reasoningSummary: parsed.reasoning,
      regimeSnapshotSessionDate: regime?.sessionDate ?? null,
      input: { create: { payload: params.bundle as object } },
      output: { create: { payload: parsed as object } },
    },
  });

  const closeMarks = new Map([[parsed.symbol, params.bar.close]]);
  const state = await computePortfolioState(prisma, portfolioId, closeMarks);

  const result = await executeValidatedDecision(prisma, {
    portfolioId,
    agentDbId: agentId,
    decisionDbId: decision.id,
    decision: parsed,
    sessionDate: params.sessionDate,
    bar: params.bar,
    validationCtx: {
      navVnd: state.navVnd,
      cashVnd: state.cashVnd,
      currentExposureVnd: state.investedVnd,
      openPositionCount: state.openPositionCount,
      newPositionsToday: 0,
      hasOpenPositionOnSymbol: false,
      tradable: params.bundle.liquidity.tradable,
      prevCloseKVnd: params.bundle.price.prevCloseKVnd,
      sessionCloseKVnd: params.bar.close,
    },
  });

  return { decisionId: decision.id, execution: result };
}

export async function compareHumanVsAi(prisma: PrismaClient, userId: string) {
  const slug = `human_${userId.slice(0, 8)}`;
  const human = await prisma.paperAgent.findUnique({
    where: { slug },
    include: {
      performance: { orderBy: { sessionDate: "desc" }, take: 1 },
      calibration: { orderBy: { sessionDate: "desc" }, take: 1 },
      evolution: { orderBy: { sessionDate: "desc" }, take: 1 },
    },
  });

  const topAi = await prisma.agentRanking.findMany({
    where: { agent: { agentClass: "AI", slug: { not: "cio" } } },
    orderBy: { rank: "asc" },
    take: 3,
    include: {
      agent: {
        include: {
          performance: { orderBy: { sessionDate: "desc" }, take: 1 },
          calibration: { orderBy: { sessionDate: "desc" }, take: 1 },
          evolution: { orderBy: { sessionDate: "desc" }, take: 1 },
        },
      },
    },
  });

  const mapAgent = (a: typeof human) =>
    a
      ? {
          slug: a.slug,
          displayName: a.displayName,
          returnPct: a.performance[0]?.totalReturnPct ?? 0,
          sharpeLike: a.performance[0]?.sharpeLike ?? 0,
          calibration: a.calibration[0]?.brierScore ?? null,
          evolutionScore: a.evolution[0]?.score ?? null,
        }
      : null;

  return {
    human: mapAgent(human),
    topAi: topAi.map((r) => mapAgent(r.agent)),
  };
}
