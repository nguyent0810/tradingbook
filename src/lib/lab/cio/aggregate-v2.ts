import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PaperAgentAction } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { LAB_CIO_SCHEMA_VERSION } from "@/lib/paper-lab/constants";
import type { RegimeDimensions } from "@/lib/lab/types/regime";

const ACTION_SCORE: Record<string, number> = {
  BUY: 1,
  ADD: 0.8,
  HOLD: 0,
  REDUCE: -0.5,
  EXIT: -1,
  SELL: -1,
};

function regimeFitBonus(style: string, trend: TrendRegime): number {
  const matrix: Record<string, Partial<Record<TrendRegime, number>>> = {
    Trend: { StrongBull: 1.15, WeakBull: 1.08, StrongBear: 0.85 },
    Momentum: { StrongBull: 1.12, WeakBull: 1.05 },
    Defensive: { StrongBear: 1.1, WeakBear: 1.05, StrongBull: 0.9 },
    MeanRev: { Sideways: 1.1, WeakBear: 1.05 },
    Contrarian: { Sideways: 1.05 },
  };
  return matrix[style]?.[trend] ?? 1;
}

type TrendRegime = RegimeDimensions["trendRegime"];

async function computeTrustScore(
  prisma: PrismaClient,
  agentId: string,
  agentSlug: string,
  style: string,
  sessionDate: Date,
  trendRegime: TrendRegime,
  symbol: string
): Promise<{ weight: number; reasons: string[] }> {
  const reasons: string[] = [];
  let weight = 1;

  if (agentSlug === "risk_manager") {
    return { weight: 0.15, reasons: ["Fixed risk-manager meta weight"] };
  }
  if (agentSlug === "devils_advocate") {
    return { weight: 0.1, reasons: ["Fixed contrarian meta weight"] };
  }

  const perf = await prisma.agentPerformanceDaily.findFirst({
    where: { agentId, sessionDate },
  });
  if (perf) {
    const sharpeBoost = 1 + Math.max(0, perf.sharpeLike) * 0.1;
    weight *= sharpeBoost;
    reasons.push(`Sharpe-like ${perf.sharpeLike.toFixed(2)} → ×${sharpeBoost.toFixed(2)}`);
    const retBoost = 1 + perf.totalReturnPct / 200;
    weight *= Math.max(0.5, retBoost);
    reasons.push(`Return ${perf.totalReturnPct.toFixed(1)}%`);
    const ddPenalty = Math.max(0.5, 1 - perf.maxDrawdownPct / 30);
    weight *= ddPenalty;
    if (perf.maxDrawdownPct > 10) reasons.push(`Drawdown penalty ×${ddPenalty.toFixed(2)}`);
  }

  const cal = await prisma.agentCalibrationDaily.findFirst({
    where: { agentId, sessionDate },
  });
  if (cal) {
    const calPenalty = Math.max(0.4, 1 - Math.max(0, cal.overconfidence) * 2);
    weight *= calPenalty;
    if (cal.overconfidence > 0.1) {
      reasons.push(`Overconfidence ${(cal.overconfidence * 100).toFixed(0)}% → ×${calPenalty.toFixed(2)}`);
    }
  }

  const regimeBoost = regimeFitBonus(style, trendRegime);
  weight *= regimeBoost;
  if (regimeBoost !== 1) reasons.push(`Regime fit ${trendRegime} ×${regimeBoost.toFixed(2)}`);

  const regimePerf = await prisma.agentRegimePerformanceDaily.findFirst({
    where: { agentId, trendRegime, sessionDate },
  });
  if (regimePerf && regimePerf.winRate > 0.55) {
    weight *= 1.05;
    reasons.push(`Strong in ${trendRegime} (${(regimePerf.winRate * 100).toFixed(0)}% WR)`);
  }

  return { weight: Math.max(0.05, weight), reasons };
}

export async function generateCioRecommendationsV2(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const regime = await prisma.marketRegimeSnapshot.findUnique({
    where: { sessionDate },
  });
  const dimensions = (regime?.dimensionsJson ?? {}) as RegimeDimensions;
  const trendRegime = dimensions.trendRegime ?? "Sideways";

  const decisions = await prisma.agentDecision.findMany({
    where: { sessionDate, validationStatus: "VALID" },
    include: { agent: true, output: true },
  });

  const bySymbol = new Map<string, typeof decisions>();
  for (const d of decisions) {
    if (d.agent.slug === "cio") continue;
    const list = bySymbol.get(d.symbol) ?? [];
    list.push(d);
    bySymbol.set(d.symbol, list);
  }

  let count = 0;

  for (const [symbol, panel] of bySymbol) {
    let score = 0;
    let weightSum = 0;
    const trustBreakdown: Record<string, { weight: number; reason_codes: string[] }> = {};
    const supporting: Array<{ agent_id: string; action: PaperAgentAction; weight: number; confidence: number }> = [];
    const whyIgnored: Array<{ agentId: string; reason: string }> = [];

    for (const d of panel) {
      const trust = await computeTrustScore(
        prisma,
        d.agentId,
        d.agent.slug,
        d.agent.style,
        sessionDate,
        trendRegime,
        symbol
      );
      trustBreakdown[d.agent.slug] = {
        weight: trust.weight,
        reason_codes: trust.reasons,
      };

      const actionScore = (ACTION_SCORE[d.action] ?? 0) * d.confidence * trust.weight;
      score += actionScore;
      weightSum += trust.weight;

      if ((ACTION_SCORE[d.action] ?? 0) > 0) {
        supporting.push({
          agent_id: d.agent.slug,
          action: d.action,
          weight: trust.weight,
          confidence: d.confidence,
        });
      }
    }

    const consensus = weightSum > 0 ? score / weightSum : 0;
    let finalAction: PaperAgentAction = "HOLD";
    if (consensus > 0.35) finalAction = "BUY";
    else if (consensus < -0.35) finalAction = "EXIT";

    const riskMgr = panel.find((p) => p.agent.slug === "risk_manager");
    if (riskMgr && ["EXIT", "REDUCE"].includes(riskMgr.action) && finalAction === "BUY") {
      finalAction = "HOLD";
      whyIgnored.push({
        agentId: "risk_manager",
        reason: "Risk override — cap at HOLD when risk manager signals exit/reduce",
      });
    }

    const dissent = panel.filter((p) => {
      const a = ACTION_SCORE[p.action] ?? 0;
      const f = ACTION_SCORE[finalAction] ?? 0;
      return Math.sign(a) !== Math.sign(f) && Math.abs(a - f) > 0.5;
    });

    const buyDecision = panel.find((p) => p.action === "BUY");
    let entryPrice: number | null = null;
    let stopLoss: number | null = null;
    let takeProfit: number | null = null;
    let suggestedSize: number | null = null;

    if (buyDecision?.output?.payload) {
      const raw = buyDecision.output.payload as AgentDecisionOutput;
      entryPrice = raw.entry_price;
      stopLoss = raw.stop_loss;
      takeProfit = raw.take_profit;
      suggestedSize = raw.position_size_vnd;
    }

    const payload = {
      recommendation_id: randomUUID(),
      session_date: sessionDate.toISOString().slice(0, 10),
      symbol,
      final_action: finalAction,
      confidence: Math.min(0.95, Math.abs(consensus) + 0.3),
      consensus_score: consensus,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      suggested_position_size_vnd: suggestedSize,
      reasoning: `CIO v2 weighted consensus ${consensus.toFixed(2)} from ${panel.length} agents under ${trendRegime}.`,
      supporting_agents: supporting.slice(0, 5),
      dissenting_agents: dissent.map((p) => ({
        agent_id: p.agent.slug,
        action: p.action,
        reason: (p.reasoningSummary ?? "").slice(0, 200),
      })),
      risks: dissent.length > 0 ? ["Agent disagreement on direction"] : [],
      agent_weights_used: Object.fromEntries(
        Object.entries(trustBreakdown).map(([k, v]) => [k, v.weight])
      ),
      trust_breakdown: trustBreakdown,
      why_ignored: whyIgnored,
      regime_context: dimensions,
      metadata: {
        cio_version: LAB_CIO_SCHEMA_VERSION,
        regime: regime?.gate1Level ?? "UNKNOWN",
      },
    };

    await prisma.cioRecommendation.upsert({
      where: { sessionDate_symbol: { sessionDate, symbol } },
      create: { sessionDate, symbol, payload: payload as object },
      update: { payload: payload as object },
    });
    count += 1;
  }

  return count;
}
