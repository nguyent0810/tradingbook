import type { PrismaClient } from "@/generated/prisma/client";
import { classifyRegimeForSession, persistRegimeSnapshot } from "@/lib/lab/regime/classify-regime";
import { registerBattlesForSession, resolveBattleOutcomes } from "@/lib/lab/battle/battle-engine";
import { persistAllAgentCalibration } from "@/lib/lab/calibration/compute-calibration";
import { generateCioRecommendationsV2 } from "@/lib/lab/cio/aggregate-v2";
import { persistAllExplanationTraces } from "@/lib/lab/explain/build-trace";
import { materializeAgentMemory } from "@/lib/lab/memory/build-memory";
import { persistAllAgentDna } from "@/lib/lab/dna/discover-dna";
import { persistAllEvolutionScores } from "@/lib/lab/evolution/compute-evolution";
import { detectHallOfFameAchievements } from "@/lib/lab/hall-of-fame/detect-achievements";
import { persistSessionReplayBundle } from "@/lib/lab/timeline/build-replay-bundle";
import { recordLabTelemetry } from "@/lib/lab/observability/telemetry";
import {
  assertSessionReady,
  wasJobCompletedForSession,
} from "@/lib/paper-lab/job-guards";

export type LabAnalyticsDailyResult =
  | { ok: true; summary: Record<string, unknown> }
  | { ok: false; error: string };

export async function runLabAnalyticsDailyJob(
  prisma: PrismaClient,
  sessionDateOverride?: Date,
  options?: { force?: boolean }
): Promise<LabAnalyticsDailyResult> {
  const started = Date.now();
  const readiness = await assertSessionReady(prisma);
  if (!readiness.ok) {
    return { ok: false, error: readiness.error };
  }
  const sessionDate = sessionDateOverride ?? readiness.sessionDate;

  if (!options?.force) {
    const alreadyDone = await wasJobCompletedForSession(
      prisma,
      "lab-analytics-daily",
      sessionDate
    );
    if (alreadyDone) {
      return {
        ok: true,
        summary: {
          sessionDate: sessionDate.toISOString().slice(0, 10),
          skipped: true,
          reason: "Analytics already completed for session",
        },
      };
    }
  }

  const regimeSnapshot = await classifyRegimeForSession(prisma, sessionDate);
  await persistRegimeSnapshot(prisma, regimeSnapshot);

  const memoryUpdated = await materializeAgentMemory(prisma, sessionDate);
  const battlesRegistered = await registerBattlesForSession(prisma, sessionDate);
  const outcomesResolved = await resolveBattleOutcomes(prisma, sessionDate);
  const calibrationCount = await persistAllAgentCalibration(prisma, sessionDate);
  const dnaCount = await persistAllAgentDna(prisma, sessionDate);
  const evolutionCount = await persistAllEvolutionScores(prisma, sessionDate);
  const cioCount = await generateCioRecommendationsV2(prisma, sessionDate);
  const tracesCount = await persistAllExplanationTraces(prisma, sessionDate);
  const hofCount = await detectHallOfFameAchievements(prisma, sessionDate);
  await persistSessionReplayBundle(prisma, sessionDate);

  const durationMs = Date.now() - started;
  await recordLabTelemetry(prisma, {
    jobName: "lab-analytics-daily",
    eventType: "job_complete",
    latencyMs: durationMs,
    success: true,
    context: {
      sessionDate: sessionDate.toISOString().slice(0, 10),
      memoryUpdated,
      battlesRegistered,
      outcomesResolved,
      calibrationCount,
      dnaCount,
      evolutionCount,
      cioCount,
      tracesCount,
      hofCount,
    },
  });

  await prisma.systemLog.create({
    data: {
      jobName: "lab-analytics-daily",
      level: "info",
      message: "Lab analytics daily job completed",
      contextJson: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        durationMs,
        memoryUpdated,
        battlesRegistered,
        outcomesResolved,
        cioCount,
      },
    },
  });

  return {
    ok: true,
    summary: {
      sessionDate: sessionDate.toISOString().slice(0, 10),
      durationMs,
      memoryUpdated,
      battlesRegistered,
      outcomesResolved,
      calibrationCount,
      dnaCount,
      evolutionCount,
      cioCount,
      tracesCount,
      hofCount,
      staleWarning: readiness.staleWarning,
    },
  };
}
