import { prisma } from "@/lib/prisma";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import type { CioRecommendation } from "@/lib/paper-lab/types/agent-decision.schema";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import type { RegimeDimensions } from "@/lib/lab/types/regime";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";

function tableExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("paper_agents") || msg.includes("does not exist");
}

export async function loadPaperLabPageFromDb(): Promise<PaperLabPageDto | null> {
  try {
    const agentCount = await prisma.paperAgent.count();
    if (agentCount === 0) return null;

    const latestPerf = await prisma.agentPerformanceDaily.findFirst({
      orderBy: { sessionDate: "desc" },
    });
    const sessionDate = latestPerf?.sessionDate ?? new Date();

    const agents = await prisma.paperAgent.findMany({
      where: { slug: { not: "cio" } },
      include: {
        portfolio: true,
        performance: {
          where: { sessionDate },
          take: 1,
        },
        rankings: {
          where: { sessionDate },
          take: 1,
        },
      },
    });

    const rankings = await prisma.agentRanking.findMany({
      where: { sessionDate },
      orderBy: { rank: "asc" },
      include: { agent: true },
    });

    const leaderboard = rankings.map((r) => {
      const perf = agents.find((a) => a.id === r.agentId)?.performance[0];
      return {
        agentId: r.agent.slug,
        agentName: r.agent.displayName,
        style: r.agent.style,
        navVnd: perf ? Number(perf.navVnd) : PAPER_INITIAL_CAPITAL_VND,
        pnlPct: perf?.totalReturnPct ?? 0,
        realizedPnlVnd: perf ? Number(perf.realizedPnlVnd) : 0,
        unrealizedPnlVnd: perf ? Number(perf.unrealizedPnlVnd) : 0,
        winRate: perf?.winRate ?? 0,
        maxDrawdownPct: perf?.maxDrawdownPct ?? 0,
        sharpeLike: perf?.sharpeLike ?? 0,
        tradeCount: perf?.tradeCount ?? 0,
        openPositions: perf?.openPositions ?? 0,
        rank: r.rank,
        rankChange: r.rankChange,
      };
    });

    const portfolios = await Promise.all(
      agents.map(async (a) => {
        const snap = await prisma.portfolioSnapshot.findFirst({
          where: { portfolioId: a.portfolio?.id },
          orderBy: { sessionDate: "desc" },
        });
        const perf = a.performance[0];
        return {
          agentId: a.slug,
          agentName: a.displayName,
          style: a.style,
          startingCapitalVnd: a.portfolio ? Number(a.portfolio.initialCapitalVnd) : PAPER_INITIAL_CAPITAL_VND,
          cashVnd: snap ? Number(snap.cashVnd) : Number(a.portfolio?.cashVnd ?? PAPER_INITIAL_CAPITAL_VND),
          investedVnd: snap
            ? Number(snap.navVnd) - Number(snap.cashVnd)
            : 0,
          navVnd: snap ? Number(snap.navVnd) : perf ? Number(perf.navVnd) : PAPER_INITIAL_CAPITAL_VND,
          exposurePct: snap?.exposurePct ?? 0,
          sectorExposure: (snap?.sectorExposureJson as Record<string, number>) ?? {},
          openRiskVnd: 0,
          buyingPowerVnd: snap ? Math.floor(Number(snap.cashVnd) * 0.99) : PAPER_INITIAL_CAPITAL_VND,
        };
      })
    );

    const openPositions = await prisma.paperPosition.findMany({
      where: { status: { in: ["OPEN", "PARTIAL"] } },
      include: { portfolio: { include: { agent: true } } },
    });

    const positions = await Promise.all(
      openPositions.map(async (p) => {
        const bar = await prisma.stockDailyBar.findFirst({
          where: { symbol: { symbol: p.symbol } },
          orderBy: { date: "desc" },
        });
        const mark = bar?.close ?? p.avgEntryKvnd;
        const unrealized = Math.round((mark - p.avgEntryKvnd) * 1000 * p.quantity);
        const cost = p.avgEntryKvnd * 1000 * p.quantity;
        const nav = Number(p.portfolio.initialCapitalVnd);
        return {
          id: p.id,
          agentId: p.portfolio.agent.slug,
          agentName: p.portfolio.agent.displayName,
          symbol: p.symbol,
          entryPriceKVnd: p.avgEntryKvnd,
          currentPriceKVnd: mark,
          stopLossKVnd: p.stopLossKvnd,
          takeProfitKVnd: p.takeProfitKvnd,
          quantity: p.quantity,
          allocationPct: nav > 0 ? (cost / nav) * 100 : 0,
          riskAmountVnd: Number(p.riskAmountVnd),
          unrealizedPnlVnd: unrealized,
          unrealizedPnlPct: cost > 0 ? (unrealized / cost) * 100 : 0,
          rMultiple:
            p.avgEntryKvnd > p.stopLossKvnd
              ? (mark - p.avgEntryKvnd) / (p.avgEntryKvnd - p.stopLossKvnd)
              : 0,
          holdingDays: 0,
          status: p.status === "PARTIAL" ? ("PARTIAL" as const) : ("OPEN" as const),
        };
      })
    );

    const decisions = await prisma.agentDecision.findMany({
      where: { sessionDate },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { agent: true, output: true, order: true },
    });

    const decisionRows = decisions.map((d) => ({
      id: d.id,
      date: d.sessionDate.toISOString().slice(0, 10),
      agentId: d.agent.slug,
      agentName: d.agent.displayName,
      symbol: d.symbol,
      action: d.action as AgentAction,
      confidence: d.confidence,
      reasoningSummary: d.reasoningSummary ?? "",
      jsonPreview: JSON.stringify(d.output?.payload ?? {}).slice(0, 120),
      validationStatus: d.validationStatus as "VALID" | "INVALID" | "SKIPPED",
      linkedOrderId: d.order?.id ?? null,
      linkedPositionId: null,
    }));

    const cioRows = await prisma.cioRecommendation.findMany({
      where: { sessionDate },
      take: 10,
    });

    const regimeSnapshot = await prisma.marketRegimeSnapshot.findUnique({
      where: { sessionDate },
    });
    const regimeCtx = await prisma.marketContextDaily.findUnique({
      where: { sessionDate },
    });

    const dimensions = regimeSnapshot?.dimensionsJson as RegimeDimensions | undefined;
    const regimeLabels = dimensions
      ? [dimensions.trendRegime, dimensions.volatilityRegime, dimensions.breadthRegime]
      : [];

    const sorted = [...leaderboard].sort((a, b) => b.pnlPct - a.pnlPct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const battle = await prisma.arenaBattle.findFirst({
      where: { sessionDate },
      orderBy: { createdAt: "desc" },
      include: {
        battleDecisions: {
          include: {
            outcome: true,
            decision: { include: { agent: true } },
          },
        },
      },
    });

    const battleSymbol = battle?.symbol ?? decisions[0]?.symbol ?? "FPT";
    const battleRows =
      battle?.battleDecisions.map((bd) => ({
        agentId: bd.decision.agent.slug,
        agentName: bd.decision.agent.displayName,
        action: bd.action as AgentAction,
        confidence: bd.confidence,
        reasoning: bd.reasoning ?? bd.decision.reasoningSummary ?? "",
        outcome: battleOutcomeToDisplay(bd.outcome?.verdict ?? "PENDING") as
          | "WIN"
          | "LOSS"
          | "OPEN"
          | "N/A",
      })) ??
      decisions
        .filter((d) => d.symbol === battleSymbol)
        .map((d) => ({
          agentId: d.agent.slug,
          agentName: d.agent.displayName,
          action: d.action as AgentAction,
          confidence: d.confidence,
          reasoning: d.reasoningSummary ?? "",
          outcome: "N/A" as const,
        }));

    return {
      overview: {
        totalAgents: agentCount,
        totalVirtualCapitalVnd: agentCount * PAPER_INITIAL_CAPITAL_VND,
        bestAgent: best
          ? { id: best.agentId, name: best.agentName, returnPct: best.pnlPct }
          : { id: "-", name: "—", returnPct: 0 },
        worstAgent: worst
          ? { id: worst.agentId, name: worst.agentName, returnPct: worst.pnlPct }
          : { id: "-", name: "—", returnPct: 0 },
        totalOpenPositions: positions.length,
        marketRegime: {
          level: (regimeCtx?.gate1Level ?? regimeSnapshot?.gate1Level ?? "WARNING") as
            | "PASS"
            | "WARNING"
            | "FAIL",
          label: regimeLabels.length
            ? regimeLabels.join(" · ")
            : `Gate 1 ${regimeCtx?.gate1Level ?? "WARNING"}`,
          dimensions: dimensions as Record<string, string> | undefined,
          labels: regimeLabels,
          confidence: regimeSnapshot?.confidence,
        },
        latestEvaluationAt: latestPerf?.createdAt.toISOString() ?? null,
        disclaimer: "PAPER_TRADING_ONLY",
        executionMode: getPaperLabExecutionMode(),
      },
      leaderboard,
      portfolios,
      positions,
      decisions: decisionRows,
      cio: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        recommendations: cioRows.map((c) => {
          const p = c.payload as CioRecommendation;
          return {
            symbol: c.symbol,
            finalAction: p.final_action,
            confidence: p.confidence,
            reasoning: p.reasoning,
            risks: p.risks,
            dissentingAgents: p.dissenting_agents.map((d) => ({
              agentId: d.agent_id,
              reason: d.reason,
            })),
          };
        }),
      },
      battleReplay: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        symbol: battleSymbol,
        rows: battleRows,
      },
    };
  } catch (err) {
    if (tableExistsError(err)) return null;
    throw err;
  }
}
