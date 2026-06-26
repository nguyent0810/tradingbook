import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AgentMemoryRecall } from "@/lib/lab/types/regime";

export function computeSetupSignature(params: {
  gate2Quality?: string | null;
  rsBucket?: string;
  regimeTag?: string;
  sector?: string | null;
}): string {
  const raw = JSON.stringify({
    q: params.gate2Quality ?? "none",
    rs: params.rsBucket ?? "neutral",
    regime: params.regimeTag ?? "unknown",
    sector: params.sector ?? "UNKNOWN",
  });
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export async function loadAgentMemoryRecall(
  prisma: PrismaClient,
  agentId: string,
  setupSignature: string
): Promise<AgentMemoryRecall | null> {
  const row = await prisma.agentSetupMemory.findUnique({
    where: { agentId_setupSignature: { agentId, setupSignature } },
  });
  if (!row || row.sampleSize < 1) return null;

  const cal = await prisma.agentCalibrationDaily.findFirst({
    where: { agentId },
    orderBy: { sessionDate: "desc" },
  });

  return {
    setupSignature,
    sampleSize: row.sampleSize,
    winRate: row.winRate,
    avgReturnPct: row.avgReturnPct,
    avgRMultiple: row.avgRMultiple,
    avgHoldingDays: row.avgHoldingDays,
    failureRate: row.failureRate,
    lastNOutcomes: [],
    regimeBreakdown: row.regimeBreakdown as Record<string, { winRate: number; avgR: number }>,
    confidenceCalibrationHint: cal ? 1 - Math.max(0, cal.overconfidence) : 0.5,
  };
}

export async function materializeAgentMemory(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const agents = await prisma.paperAgent.findMany({
    where: { slug: { not: "cio" }, agentClass: "AI" },
  });

  let updated = 0;

  for (const agent of agents) {
    const trades = await prisma.paperTrade.findMany({
      where: { position: { portfolio: { agentId: agent.id } } },
      include: {
        position: {
          include: {
            portfolio: true,
          },
        },
      },
      orderBy: { closedSessionDate: "desc" },
      take: 500,
    });

    const bySetup = new Map<
      string,
      { wins: number; losses: number; returns: number[]; rs: number[]; days: number[] }
    >();

    for (const t of trades) {
      const sig = computeSetupSignature({ gate2Quality: "unknown", rsBucket: "neutral" });
      const bucket = bySetup.get(sig) ?? { wins: 0, losses: 0, returns: [], rs: [], days: [] };
      const pnl = Number(t.realizedPnlVnd);
      if (pnl > 0) bucket.wins += 1;
      else if (pnl < 0) bucket.losses += 1;
      bucket.returns.push(pnl);
      if (t.rMultiple != null) bucket.rs.push(t.rMultiple);
      bucket.days.push(t.holdingDays);
      bySetup.set(sig, bucket);
    }

    for (const [setupSignature, stats] of bySetup) {
      const total = stats.wins + stats.losses;
      if (total < 1) continue;

      await prisma.agentSetupMemory.upsert({
        where: { agentId_setupSignature: { agentId: agent.id, setupSignature } },
        create: {
          agentId: agent.id,
          setupSignature,
          sampleSize: total,
          winRate: stats.wins / total,
          avgReturnPct: stats.returns.reduce((a, b) => a + b, 0) / total / 1_000_000,
          avgRMultiple:
            stats.rs.length > 0 ? stats.rs.reduce((a, b) => a + b, 0) / stats.rs.length : 0,
          avgHoldingDays:
            stats.days.length > 0 ? stats.days.reduce((a, b) => a + b, 0) / stats.days.length : 0,
          failureRate: stats.losses / total,
          regimeBreakdown: {},
        },
        update: {
          sampleSize: total,
          winRate: stats.wins / total,
          avgReturnPct: stats.returns.reduce((a, b) => a + b, 0) / total / 1_000_000,
          avgRMultiple:
            stats.rs.length > 0 ? stats.rs.reduce((a, b) => a + b, 0) / stats.rs.length : 0,
          avgHoldingDays:
            stats.days.length > 0 ? stats.days.reduce((a, b) => a + b, 0) / stats.days.length : 0,
          failureRate: stats.losses / total,
        },
      });
      updated += 1;
    }

    await prisma.agentMemoryStats.upsert({
      where: {
        agentId_asOfSession_windowDays: {
          agentId: agent.id,
          asOfSession: sessionDate,
          windowDays: 90,
        },
      },
      create: {
        agentId: agent.id,
        asOfSession: sessionDate,
        windowDays: 90,
        statsJson: { tradeCount: trades.length, setupBuckets: bySetup.size },
      },
      update: {
        statsJson: { tradeCount: trades.length, setupBuckets: bySetup.size },
      },
    });
  }

  return updated;
}
