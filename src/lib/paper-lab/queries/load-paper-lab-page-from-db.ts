import { prisma } from "@/lib/prisma";
import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import type {
  AgentDecisionOutput,
  CioRecommendation,
} from "@/lib/paper-lab/types/agent-decision.schema";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import type { RegimeDimensions } from "@/lib/lab/types/regime";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";
import {
  buildBattleInsight,
  buildCioPresentation,
  buildDecisionExplanation,
} from "@/lib/paper-lab/ui/arena-copy";

function tableExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("paper_agents") || msg.includes("does not exist");
}

function agentDisplayName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug;
}

function utcDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.floor((a - b) / 86_400_000);
}

function parsePayload(raw: unknown): Partial<AgentDecisionOutput> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Partial<AgentDecisionOutput>;
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
        const sparkSnaps = a.portfolio
          ? await prisma.portfolioSnapshot.findMany({
              where: { portfolioId: a.portfolio.id },
              orderBy: { sessionDate: "desc" },
              take: 14,
              select: { navVnd: true },
            })
          : [];
        const navSparkline = sparkSnaps.reverse().map((s) => Number(s.navVnd));
        const lb = leaderboard.find((r) => r.agentId === a.slug);

        let openRiskVnd = 0;
        if (a.portfolio) {
          const openPos = await prisma.paperPosition.findMany({
            where: {
              portfolioId: a.portfolio.id,
              status: { in: ["OPEN", "PARTIAL"] },
            },
          });
          openRiskVnd = openPos.reduce((sum, p) => sum + Number(p.riskAmountVnd), 0);
        }

        return {
          agentId: a.slug,
          agentName: a.displayName,
          style: a.style,
          startingCapitalVnd: a.portfolio
            ? Number(a.portfolio.initialCapitalVnd)
            : PAPER_INITIAL_CAPITAL_VND,
          cashVnd: snap
            ? Number(snap.cashVnd)
            : Number(a.portfolio?.cashVnd ?? PAPER_INITIAL_CAPITAL_VND),
          investedVnd: snap ? Number(snap.navVnd) - Number(snap.cashVnd) : 0,
          navVnd: snap
            ? Number(snap.navVnd)
            : perf
              ? Number(perf.navVnd)
              : PAPER_INITIAL_CAPITAL_VND,
          exposurePct: snap?.exposurePct ?? 0,
          sectorExposure: (snap?.sectorExposureJson as Record<string, number>) ?? {},
          openRiskVnd,
          buyingPowerVnd: snap
            ? Math.floor(Number(snap.cashVnd) * 0.99)
            : PAPER_INITIAL_CAPITAL_VND,
          pnlPct: lb?.pnlPct ?? perf?.totalReturnPct ?? 0,
          winRate: lb?.winRate ?? perf?.winRate ?? 0,
          maxDrawdownPct: lb?.maxDrawdownPct ?? perf?.maxDrawdownPct ?? 0,
          navSparkline:
            navSparkline.length >= 2
              ? navSparkline
              : [PAPER_INITIAL_CAPITAL_VND, snap ? Number(snap.navVnd) : PAPER_INITIAL_CAPITAL_VND],
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
          holdingDays: utcDayDiff(sessionDate, p.openedAt),
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

    const decisionRows = decisions.map((d) => {
      const payload = parsePayload(d.output?.payload);
      const explanation = buildDecisionExplanation({
        agentId: d.agent.slug,
        action: d.action as AgentAction,
        symbol: d.symbol,
        reasoningSummary: d.reasoningSummary,
        payload,
      });
      return {
        id: d.id,
        date: d.sessionDate.toISOString().slice(0, 10),
        agentId: d.agent.slug,
        agentName: d.agent.displayName,
        symbol: d.symbol,
        action: d.action as AgentAction,
        confidence: d.confidence,
        reasoningSummary: explanation.summary,
        explanation,
        jsonPayload: (d.output?.payload as Record<string, unknown>) ?? null,
        validationStatus: d.validationStatus as "VALID" | "INVALID" | "SKIPPED",
        linkedOrderId: d.order?.id ?? null,
        linkedPositionId: null,
      };
    });

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
            decision: { include: { agent: true, output: true } },
          },
        },
      },
    });

    const battleSymbol = battle?.symbol ?? decisions[0]?.symbol ?? "FPT";

    const battleRowsRaw =
      battle?.battleDecisions.map((bd) => {
        const payload = parsePayload(bd.decision.output?.payload);
        const explanation = buildDecisionExplanation({
          agentId: bd.decision.agent.slug,
          action: bd.action as AgentAction,
          symbol: battleSymbol,
          reasoningSummary: bd.reasoning ?? bd.decision.reasoningSummary,
          payload,
        });
        return {
          agentId: bd.decision.agent.slug,
          agentName: bd.decision.agent.displayName,
          style: bd.decision.agent.style,
          action: bd.action as AgentAction,
          confidence: bd.confidence,
          reasoning: explanation.summary,
          explanation,
          outcome: battleOutcomeToDisplay(bd.outcome?.verdict ?? "PENDING") as
            | "WIN"
            | "LOSS"
            | "OPEN"
            | "N/A",
        };
      }) ??
      decisions
        .filter((d) => d.symbol === battleSymbol)
        .map((d) => {
          const payload = parsePayload(d.output?.payload);
          const explanation = buildDecisionExplanation({
            agentId: d.agent.slug,
            action: d.action as AgentAction,
            symbol: d.symbol,
            reasoningSummary: d.reasoningSummary,
            payload,
          });
          return {
            agentId: d.agent.slug,
            agentName: d.agent.displayName,
            style: d.agent.style,
            action: d.action as AgentAction,
            confidence: d.confidence,
            reasoning: explanation.summary,
            explanation,
            outcome: "N/A" as const,
          };
        });

    const panelDecisionsForCio = decisions
      .filter((d) => d.symbol === battleSymbol && d.agent.slug !== "cio")
      .map((d) => ({ action: d.action as AgentAction, agent_id: d.agent.slug }));

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
          const p = c.payload as CioRecommendation & { regime_context?: string };
          const regimeContext =
            p.regime_context ?? regimeLabels.join(" · ") ?? p.metadata?.regime ?? "Unknown";
          const pres = buildCioPresentation(
            { ...p, regime_context: regimeContext },
            panelDecisionsForCio
          );
          return {
            symbol: c.symbol,
            finalAction: p.final_action,
            confidence: p.confidence,
            reasoning: p.reasoning,
            risks: p.risks,
            consensusScore: p.consensus_score,
            consensusLabel: pres.consensusLabel,
            consensusScoreDisplay: pres.consensusScoreDisplay,
            regimeContext,
            decisionSummary: pres.decisionSummary,
            supportingReasons: pres.supportingReasons,
            actionVotes: pres.actionVotes,
            dissentingAgents: p.dissenting_agents.map((d) => ({
              agentId: d.agent_id,
              agentName: agentDisplayName(d.agent_id),
              action: d.action,
              reason: d.reason,
              humanReason: pres.dissent.find((x) => x.agentName === agentDisplayName(d.agent_id))
                ?.humanReason ?? d.reason,
            })),
          };
        }),
      },
      battleReplay: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        symbol: battleSymbol,
        insight: buildBattleInsight(battleRowsRaw, battleSymbol),
        rows: battleRowsRaw,
      },
    };
  } catch (err) {
    if (tableExistsError(err)) return null;
    throw err;
  }
}
