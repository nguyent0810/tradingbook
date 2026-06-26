import type { PrismaClient } from "@/generated/prisma/client";

export async function recordLabTelemetry(
  prisma: PrismaClient,
  params: {
    jobName: string;
    eventType: string;
    agentId?: string;
    latencyMs?: number;
    tokenCount?: number;
    costUsd?: number;
    success?: boolean;
    context?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.labTelemetryEvent.create({
    data: {
      jobName: params.jobName,
      agentId: params.agentId,
      eventType: params.eventType,
      latencyMs: params.latencyMs,
      tokenCount: params.tokenCount,
      costUsd: params.costUsd,
      success: params.success ?? true,
      contextJson: params.context as object | undefined,
    },
  });
}

export async function getTelemetrySummary(prisma: PrismaClient) {
  const since = new Date(Date.now() - 86400000);
  const events = await prisma.labTelemetryEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byJob = new Map<string, { count: number; errors: number; avgLatency: number }>();
  for (const e of events) {
    const row = byJob.get(e.jobName) ?? { count: 0, errors: 0, avgLatency: 0 };
    row.count += 1;
    if (!e.success) row.errors += 1;
    if (e.latencyMs != null) row.avgLatency += e.latencyMs;
    byJob.set(e.jobName, row);
  }

  const jobs = [...byJob.entries()].map(([jobName, stats]) => ({
    jobName,
    count: stats.count,
    errors: stats.errors,
    avgLatencyMs: stats.count > 0 ? Math.round(stats.avgLatency / stats.count) : 0,
  }));

  const lastPaper = await prisma.systemLog.findFirst({
    where: { jobName: "paper-lab-daily" },
    orderBy: { createdAt: "desc" },
  });
  const lastAnalytics = await prisma.systemLog.findFirst({
    where: { jobName: "lab-analytics-daily" },
    orderBy: { createdAt: "desc" },
  });

  return {
    eventsLast24h: events.length,
    jobs,
    lastPaperLabRun: lastPaper?.createdAt.toISOString() ?? null,
    lastAnalyticsRun: lastAnalytics?.createdAt.toISOString() ?? null,
  };
}
