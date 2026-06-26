import type { PrismaClient } from "@/generated/prisma/client";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";

function outcomeBinary(verdict: string): number | null {
  const v = battleOutcomeToDisplay(verdict as never);
  if (v === "WIN") return 1;
  if (v === "LOSS") return 0;
  return null;
}

export async function computeAgentCalibration(
  prisma: PrismaClient,
  agentId: string,
  sessionDate: Date
): Promise<{ brierScore: number; overconfidence: number; bucketJson: object; sampleSize: number }> {
  const outcomes = await prisma.arenaBattleOutcome.findMany({
    where: {
      agentId,
      verdict: { not: "PENDING" },
      battle: { sessionDate: { lte: sessionDate } },
    },
    include: { battleDecision: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const pairs: Array<{ confidence: number; outcome: number }> = [];
  for (const o of outcomes) {
    const binary = outcomeBinary(o.verdict);
    if (binary == null) continue;
    pairs.push({ confidence: o.battleDecision.confidence, outcome: binary });
  }

  if (pairs.length === 0) {
    return {
      brierScore: 0.25,
      overconfidence: 0,
      bucketJson: {},
      sampleSize: 0,
    };
  }

  const brier =
    pairs.reduce((s, p) => s + (p.confidence - p.outcome) ** 2, 0) / pairs.length;
  const avgConf = pairs.reduce((s, p) => s + p.confidence, 0) / pairs.length;
  const avgWin = pairs.reduce((s, p) => s + p.outcome, 0) / pairs.length;
  const overconfidence = avgConf - avgWin;

  const buckets: Record<string, { predicted: number; observed: number; count: number }> = {};
  for (const p of pairs) {
    const bucket = `${Math.floor(p.confidence * 10) * 10}-${Math.floor(p.confidence * 10) * 10 + 10}`;
    const b = buckets[bucket] ?? { predicted: 0, observed: 0, count: 0 };
    b.predicted += p.confidence;
    b.observed += p.outcome;
    b.count += 1;
    buckets[bucket] = b;
  }

  for (const k of Object.keys(buckets)) {
    const b = buckets[k]!;
    b.predicted /= b.count;
    b.observed /= b.count;
  }

  return {
    brierScore: brier,
    overconfidence,
    bucketJson: buckets,
    sampleSize: pairs.length,
  };
}

export async function persistAllAgentCalibration(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<number> {
  const agents = await prisma.paperAgent.findMany({
    where: { slug: { not: "cio" }, agentClass: "AI" },
  });

  let n = 0;
  for (const agent of agents) {
    const cal = await computeAgentCalibration(prisma, agent.id, sessionDate);
    await prisma.agentCalibrationDaily.upsert({
      where: { agentId_sessionDate: { agentId: agent.id, sessionDate } },
      create: {
        agentId: agent.id,
        sessionDate,
        brierScore: cal.brierScore,
        overconfidence: cal.overconfidence,
        bucketJson: cal.bucketJson as object,
        sampleSize: cal.sampleSize,
      },
      update: {
        brierScore: cal.brierScore,
        overconfidence: cal.overconfidence,
        bucketJson: cal.bucketJson as object,
        sampleSize: cal.sampleSize,
      },
    });
    n += 1;
  }
  return n;
}
