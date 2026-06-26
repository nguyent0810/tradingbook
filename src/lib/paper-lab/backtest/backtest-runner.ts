import type { PrismaClient } from "@/generated/prisma/client";
import { runPaperLabDailyJob } from "@/lib/paper-lab/jobs/run-paper-lab-daily-job";

export type BacktestConfig = {
  startDate: string;
  endDate: string;
  agentSlugs: string[];
  feeBps?: number;
  slippageBps?: number;
};

export async function startBacktestRun(
  prisma: PrismaClient,
  config: BacktestConfig
): Promise<string> {
  const run = await prisma.backtestRun.create({
    data: {
      configJson: config as object,
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      status: "RUNNING",
    },
  });

  // Phase 8: full historical replay — placeholder stores job id for async completion
  await prisma.backtestRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      resultsJson: {
        note: "Backtest scaffold — run paper-lab-daily per session in future iteration",
        config,
        benchmark: "VNINDEX",
      },
    },
  });

  return run.id;
}

export async function createExperimentRun(
  prisma: PrismaClient,
  name: string,
  agentVersionMap: Record<string, string>
): Promise<string> {
  const run = await prisma.experimentRun.create({
    data: {
      name,
      agentVersionMap,
      status: "RUNNING",
    },
  });
  return run.id;
}

export async function completeExperimentRun(
  prisma: PrismaClient,
  experimentRunId: string
): Promise<void> {
  const result = await runPaperLabDailyJob(prisma);
  await prisma.experimentRun.update({
    where: { id: experimentRunId },
    data: {
      status: result.ok ? "COMPLETED" : "FAILED",
      finishedAt: new Date(),
      notes: result.ok ? JSON.stringify(result.summary) : result.error,
    },
  });
}
