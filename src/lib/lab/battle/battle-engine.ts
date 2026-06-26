import type { PrismaClient } from "@/generated/prisma/client";
import type { BattleOutcomeVerdict, PaperAgentAction } from "@/generated/prisma/client";

const BENCHMARK_OUTPERFORM_THRESHOLD = 3;

function actionScore(action: PaperAgentAction): number {
  switch (action) {
    case "BUY":
    case "ADD":
      return 1;
    case "REDUCE":
    case "EXIT":
    case "SELL":
      return -0.5;
    default:
      return 0;
  }
}

export async function registerBattlesForSession(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const decisions = await prisma.agentDecision.findMany({
    where: { sessionDate, validationStatus: "VALID" },
    include: { agent: true },
  });

  const bySymbol = new Map<string, typeof decisions>();
  for (const d of decisions) {
    const list = bySymbol.get(d.symbol) ?? [];
    list.push(d);
    bySymbol.set(d.symbol, list);
  }

  let count = 0;
  for (const [symbol, decs] of bySymbol) {
    const battle = await prisma.arenaBattle.upsert({
      where: { sessionDate_symbol: { sessionDate, symbol } },
      create: { sessionDate, symbol, status: "OPEN" },
      update: {},
    });

    for (const d of decs) {
      if (d.agent.slug === "cio") continue;

      await prisma.agentDecision.update({
        where: { id: d.id },
        data: { battleId: battle.id },
      });

      const bd = await prisma.arenaBattleDecision.upsert({
        where: { decisionId: d.id },
        create: {
          battleId: battle.id,
          decisionId: d.id,
          agentId: d.agentId,
          action: d.action,
          confidence: d.confidence,
          reasoning: d.reasoningSummary,
        },
        update: {
          action: d.action,
          confidence: d.confidence,
          reasoning: d.reasoningSummary,
        },
      });

      await prisma.arenaBattleOutcome.upsert({
        where: { battleDecisionId: bd.id },
        create: {
          battleId: battle.id,
          battleDecisionId: bd.id,
          agentId: d.agentId,
          verdict: "PENDING",
        },
        update: {},
      });
    }
    count += 1;
  }
  return count;
}

async function forwardReturnPct(
  prisma: PrismaClient,
  symbol: string,
  fromDate: Date,
  sessions: number
): Promise<number | null> {
  const bars = await prisma.stockDailyBar.findMany({
    where: { symbol: { symbol }, date: { gte: fromDate } },
    orderBy: { date: "asc" },
    take: sessions + 1,
    include: { symbol: true },
  });
  if (bars.length < 2) return null;
  const start = bars[0]!.close;
  const end = bars[bars.length - 1]!.close;
  if (!(start > 0)) return null;
  return ((end / start) - 1) * 100;
}

export async function resolveBattleOutcomes(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const battles = await prisma.arenaBattle.findMany({
    where: { sessionDate },
    include: {
      battleDecisions: { include: { outcome: true, decision: { include: { order: true } } } },
    },
  });

  let resolved = 0;

  for (const battle of battles) {
    const fwd5 = await forwardReturnPct(prisma, battle.symbol, sessionDate, 5);
    const bench = fwd5 ?? 0;

    for (const bd of battle.battleDecisions) {
      let verdict: BattleOutcomeVerdict = "NEUTRAL";
      let rMultiple: number | null = null;
      let explanation = "";

      const decision = bd.decision;
      const order = decision.order;

      if (["BUY", "ADD"].includes(bd.action) && order?.status === "FILLED") {
        const position = await prisma.paperPosition.findFirst({
          where: {
            portfolio: { agentId: bd.agentId },
            symbol: battle.symbol,
          },
          include: { trades: true },
        });

        const closedTrade = position?.trades.find(
          (t) => t.closedSessionDate >= sessionDate
        );

        if (closedTrade) {
          rMultiple = closedTrade.rMultiple;
          verdict = (closedTrade.rMultiple ?? 0) > 0 ? "CORRECT_BUY" : "WRONG_BUY";
          explanation = `Trade closed with R=${(closedTrade.rMultiple ?? 0).toFixed(2)}`;
        } else if (position && ["OPEN", "PARTIAL"].includes(position.status)) {
          verdict = "OPEN";
          explanation = "Position still open";
        } else {
          verdict = bench > 0 ? "WRONG_BUY" : "CORRECT_BUY";
          explanation = `No fill; symbol ${bench >= 0 ? "rose" : "fell"} ${bench.toFixed(1)}% over 5d`;
        }
      } else if (["HOLD"].includes(bd.action)) {
        if (bench > BENCHMARK_OUTPERFORM_THRESHOLD) {
          verdict = "WRONG_AVOID";
          explanation = `Held cash while symbol +${bench.toFixed(1)}% vs 5d`;
        } else if (bench < -BENCHMARK_OUTPERFORM_THRESHOLD) {
          verdict = "CORRECT_AVOID";
          explanation = `Avoided ${bench.toFixed(1)}% 5d decline`;
        } else {
          verdict = "NEUTRAL";
          explanation = "Hold aligned with flat performance";
        }
      } else if (["REDUCE", "EXIT", "SELL"].includes(bd.action)) {
        verdict = bench < 0 ? "CORRECT_RISK" : "NEUTRAL";
        explanation =
          bench < 0
            ? `Risk action before ${bench.toFixed(1)}% decline`
            : "Defensive action in rising tape";
      }

      if (bd.outcome) {
        await prisma.arenaBattleOutcome.update({
          where: { id: bd.outcome.id },
          data: {
            verdict,
            rMultiple,
            forwardReturn5dPct: fwd5,
            explanation,
            resolvedAt: new Date(),
          },
        });
        resolved += 1;
      }
    }

    await prisma.arenaBattle.update({
      where: { id: battle.id },
      data: {
        status: "RESOLVED",
        benchmarkReturn5dPct: fwd5,
        resolvedAt: new Date(),
      },
    });
  }

  return resolved;
}

export function battleOutcomeToDisplay(verdict: BattleOutcomeVerdict): string {
  const map: Record<BattleOutcomeVerdict, string> = {
    PENDING: "PENDING",
    CORRECT_BUY: "WIN",
    WRONG_BUY: "LOSS",
    CORRECT_AVOID: "WIN",
    WRONG_AVOID: "LOSS",
    CORRECT_RISK: "WIN",
    OPEN: "OPEN",
    NEUTRAL: "N/A",
  };
  return map[verdict] ?? verdict;
}
