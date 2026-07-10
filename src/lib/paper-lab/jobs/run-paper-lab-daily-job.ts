import type { PrismaClient } from "@/generated/prisma/client";
import { executeValidatedDecision, markPositionsAndDetectExits } from "@/lib/paper-lab/engine/paper-trading-engine";
import { AgentDecisionOutputSchema } from "@/lib/paper-lab/types/agent-decision.schema";
import { computePortfolioState, snapshotAllPortfolios } from "@/lib/paper-lab/portfolio/portfolio-service";
import {
  computeAgentPerformance,
  computeAndPersistRankings,
  persistAgentPerformanceDaily,
} from "@/lib/paper-lab/performance/metrics";
import { runMockAgentsForSession } from "@/lib/paper-lab/agents/agent-runner";
import {
  buildContextBundlesForUniverse,
  resolvePaperLabSymbolUniverse,
} from "@/lib/paper-lab/context/build-market-context-bundle";
import { classifyRegimeForSession, persistRegimeSnapshot } from "@/lib/lab/regime/classify-regime";
import { assertSessionReady } from "@/lib/paper-lab/job-guards";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";

export type PaperLabDailyJobResult =
  | { ok: true; summary: Record<string, unknown> }
  | { ok: false; error: string };

async function loadSessionBars(
  prisma: PrismaClient,
  sessionDate: Date,
  symbols: string[]
): Promise<Map<string, { low: number; high: number; close: number }>> {
  const marks = new Map<string, { low: number; high: number; close: number }>();
  for (const symbol of symbols) {
    const bar = await prisma.stockDailyBar.findFirst({
      where: { symbol: { symbol }, date: sessionDate },
    });
    if (bar) {
      marks.set(symbol, { low: bar.low, high: bar.high, close: bar.close });
    }
  }
  return marks;
}

export async function runPaperLabDailyJob(
  prisma: PrismaClient
): Promise<PaperLabDailyJobResult> {
  const readiness = await assertSessionReady(prisma);
  if (!readiness.ok) {
    return { ok: false, error: readiness.error };
  }
  const sessionDate = readiness.sessionDate;

  const regimeSnapshot = await classifyRegimeForSession(prisma, sessionDate);
  await persistRegimeSnapshot(prisma, regimeSnapshot);

  const symbols = await resolvePaperLabSymbolUniverse(prisma, sessionDate);
  const barMarks = await loadSessionBars(prisma, sessionDate, symbols);
  const closeMarks = new Map([...barMarks.entries()].map(([s, b]) => [s, b.close]));

  const agents = await prisma.paperAgent.findMany({
    where: { active: true, slug: { not: "cio" } },
    include: { portfolio: true },
  });

  let decisionsCreated = 0;
  const errors: string[] = [];

  for (const agent of agents) {
    if (!agent.portfolio) continue;
    const bundles = await buildContextBundlesForUniverse(
      prisma,
      sessionDate,
      agent.id,
      symbols.slice(0, 15)
    );
    const run = await runMockAgentsForSession(prisma, sessionDate, bundles, [agent.slug]);
    decisionsCreated += run.decisionsCreated;
    errors.push(...run.errors);

    const decisions = await prisma.agentDecision.findMany({
      where: { agentId: agent.id, sessionDate },
      include: { output: true, order: true },
      // Deterministic insertion order so rotation's laggard REDUCE/EXIT executes
      // before its funding BUY. Insertion order is what the legacy path already
      // relied on implicitly, so this does not change legacy behavior.
      orderBy: { createdAt: "asc" },
    });

    for (const dec of decisions) {
      if (dec.order) continue;

      const raw = dec.output?.payload;
      const parsed = AgentDecisionOutputSchema.safeParse(raw);
      if (!parsed.success) continue;
      if (["HOLD"].includes(parsed.data.action)) continue;

      const bar = barMarks.get(dec.symbol);
      if (!bar) continue;

      const state = await computePortfolioState(prisma, agent.portfolio.id, closeMarks);
      const newToday = await prisma.paperOrder.count({
        where: {
          portfolioId: agent.portfolio.id,
          sessionDate,
          side: "BUY",
          status: "FILLED",
        },
      });
      const hasOpen = await prisma.paperPosition.findFirst({
        where: {
          portfolioId: agent.portfolio.id,
          symbol: dec.symbol,
          status: { in: ["OPEN", "PARTIAL"] },
        },
      });

      const bundle = bundles.find((b) => b.symbol === dec.symbol);

      await executeValidatedDecision(prisma, {
        portfolioId: agent.portfolio.id,
        agentDbId: agent.id,
        decisionDbId: dec.id,
        decision: parsed.data,
        sessionDate,
        bar,
        validationCtx: {
          navVnd: state.navVnd,
          cashVnd: state.cashVnd,
          currentExposureVnd: state.investedVnd,
          openPositionCount: state.openPositionCount,
          newPositionsToday: newToday,
          hasOpenPositionOnSymbol: !!hasOpen,
          tradable: bundle?.liquidity.tradable ?? true,
          prevCloseKVnd: bundle?.price.prevCloseKVnd ?? null,
          sessionCloseKVnd: bar.close,
        },
      });
    }
  }

  const exitsClosed = await markPositionsAndDetectExits(prisma, sessionDate, barMarks);
  await snapshotAllPortfolios(prisma, sessionDate, closeMarks);

  const metricsList = [];
  for (const agent of agents) {
    if (!agent.portfolio) continue;
    const state = await computePortfolioState(prisma, agent.portfolio.id, closeMarks);
    const metrics = await computeAgentPerformance(prisma, agent.id, sessionDate, state.navVnd);
    await persistAgentPerformanceDaily(prisma, agent.id, sessionDate, metrics);
    metricsList.push(metrics);
  }

  await computeAndPersistRankings(prisma, sessionDate, metricsList);

  await prisma.systemLog.create({
    data: {
      jobName: "paper-lab-daily",
      level: "info",
      message: "Paper lab daily job completed",
      contextJson: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        symbols: symbols.length,
        decisionsCreated,
        exitsClosed,
        regime: regimeSnapshot.labels,
        executionMode: getPaperLabExecutionMode(),
        staleWarning: readiness.staleWarning,
      },
    },
  });

  return {
    ok: true,
    summary: {
      sessionDate: sessionDate.toISOString().slice(0, 10),
      symbols: symbols.length,
      decisionsCreated,
      exitsClosed,
      regime: regimeSnapshot.labels,
      executionMode: getPaperLabExecutionMode(),
      staleWarning: readiness.staleWarning,
      errors,
    },
  };
}
