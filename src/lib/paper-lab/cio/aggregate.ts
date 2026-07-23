import type { PrismaClient } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { CioRecommendation } from "@/lib/paper-lab/types/agent-decision.schema";
import { randomUUID } from "node:crypto";

const ACTION_SCORE: Record<string, number> = {
  BUY: 1,
  ADD: 0.8,
  HOLD: 0,
  REDUCE: -0.5,
  EXIT: -1,
  SELL: -1,
};

export type WeightedDecision = {
  agentId: string;
  agentSlug: string;
  action: string;
  confidence: number;
  weight: number;
  reasoning: string;
};

function agentWeight(params: {
  slug: string;
  sharpeLike: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  regime: string;
}): number {
  let w = 1;
  if (params.slug === "risk_manager") w = 0.15;
  if (params.slug === "devils_advocate") w = 0.1;
  if (params.slug === "swing_trader" || params.slug === "momentum_investor") w = 1.2;
  w *= 1 + Math.max(0, params.sharpeLike) * 0.1;
  w *= 1 + params.totalReturnPct / 100;
  w *= Math.max(0.5, 1 - params.maxDrawdownPct / 30);
  if (params.regime === "PASS" && params.slug === "trend_follower") w *= 1.05;
  return w;
}

export async function generateCioRecommendations(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const decisions = await prisma.agentDecision.findMany({
    where: { sessionDate, validationStatus: "VALID" },
    include: { agent: true, output: true },
  });

  const perf = await prisma.agentPerformanceDaily.findMany({
    where: { sessionDate },
  });
  const perfByAgent = new Map(perf.map((p) => [p.agentId, p]));

  const regimeRow = await prisma.marketContextDaily.findUnique({
    where: { sessionDate },
  });
  const regime = regimeRow?.gate1Level ?? "UNKNOWN";

  const bySymbol = new Map<string, WeightedDecision[]>();

  for (const d of decisions) {
    if (d.agent.slug === "cio") continue;
    const payload = d.output?.payload as AgentDecisionOutput | undefined;
    const p = perfByAgent.get(d.agentId);
    const weight = agentWeight({
      slug: d.agent.slug,
      sharpeLike: p?.sharpeLike ?? 0,
      totalReturnPct: p?.totalReturnPct ?? 0,
      maxDrawdownPct: p?.maxDrawdownPct ?? 0,
      regime,
    });

    const list = bySymbol.get(d.symbol) ?? [];
    list.push({
      agentId: d.agentId,
      agentSlug: d.agent.slug,
      action: d.action,
      confidence: d.confidence,
      weight,
      reasoning: payload?.reasoning ?? d.reasoningSummary ?? "",
    });
    bySymbol.set(d.symbol, list);
  }

  let count = 0;

  for (const [symbol, panel] of bySymbol) {
    let score = 0;
    let weightSum = 0;
    for (const p of panel) {
      const s = (ACTION_SCORE[p.action] ?? 0) * p.confidence * p.weight;
      score += s;
      weightSum += p.weight;
    }
    const consensus = weightSum > 0 ? score / weightSum : 0;

    let finalAction: AgentDecisionOutput["action"] = "HOLD";
    if (consensus > 0.35) finalAction = "BUY";
    else if (consensus < -0.35) finalAction = "EXIT";

    const supporting = panel.filter((p) => (ACTION_SCORE[p.action] ?? 0) > 0);
    const dissent = panel.filter((p) => {
      const a = ACTION_SCORE[p.action] ?? 0;
      const f = ACTION_SCORE[finalAction] ?? 0;
      return Math.sign(a) !== Math.sign(f) && Math.abs(a - f) > 0.5;
    });

    const buyDecision = panel.find((p) => p.action === "BUY");
    const payload: CioRecommendation = {
      recommendation_id: randomUUID(),
      session_date: sessionDate.toISOString().slice(0, 10),
      symbol,
      final_action: finalAction,
      confidence: Math.min(0.95, Math.abs(consensus) + 0.3),
      consensus_score: consensus,
      entry_price: null,
      stop_loss: null,
      take_profit: null,
      suggested_position_size_vnd: null,
      reasoning: `Điểm đồng thuận ${consensus.toFixed(2)} từ ${panel.length} agent về ${symbol}.`,
      supporting_agents: supporting.slice(0, 5).map((p) => ({
        agent_id: p.agentSlug,
        action: p.action as AgentDecisionOutput["action"],
        weight: p.weight,
        confidence: p.confidence,
      })),
      dissenting_agents: dissent.map((p) => ({
        agent_id: p.agentSlug,
        action: p.action as AgentDecisionOutput["action"],
        reason: p.reasoning.slice(0, 200),
      })),
      risks: dissent.length > 0 ? ["Agent bất đồng về hướng giao dịch"] : [],
      agent_weights_used: Object.fromEntries(panel.map((p) => [p.agentSlug, p.weight])),
      metadata: { cio_version: "1.0.0", regime: regime as "PASS" | "WARNING" | "FAIL" | "UNKNOWN" },
    };

    if (buyDecision) {
      const out = await prisma.agentDecisionOutput.findFirst({
        where: { decision: { agent: { slug: buyDecision.agentSlug }, symbol, sessionDate } },
      });
      const raw = out?.payload as AgentDecisionOutput | undefined;
      if (raw?.entry_price) payload.entry_price = raw.entry_price;
      if (raw?.stop_loss) payload.stop_loss = raw.stop_loss;
      if (raw?.take_profit) payload.take_profit = raw.take_profit;
      if (raw?.position_size_vnd) payload.suggested_position_size_vnd = raw.position_size_vnd;
    }

    await prisma.cioRecommendation.upsert({
      where: { sessionDate_symbol: { sessionDate, symbol } },
      create: { sessionDate, symbol, payload: payload as object },
      update: { payload: payload as object },
    });
    count += 1;
  }

  return count;
}
