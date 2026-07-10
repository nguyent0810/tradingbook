/**
 * Read-only production monitoring for Paper Lab pipeline.
 * Usage: load .env.prod.local then `npx tsx scripts/monitor-paper-lab-production.ts`
 */
import "./load-env";
import { prisma } from "@/lib/prisma";
import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import {
  STALE_SESSION_FAIL_DAYS,
  STALE_SESSION_WARN_DAYS,
} from "@/lib/paper-lab/job-guards";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";

function utcDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.floor((a - b) / 86_400_000);
}

async function main() {
  const db = describeDatabaseUrl();
  const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  const staleDays = sessionDate ? utcDayDiff(new Date(), sessionDate) : null;

  const vnindexBarCount = await prisma.indexDailyBar.count({
    where: { symbol: "VNINDEX" },
  });
  const latestVnindex = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX" },
    orderBy: { date: "desc" },
  });
  const stockBarCount = await prisma.stockDailyBar.count();

  const latestScan = await prisma.dailyScanRun.findFirst({
    orderBy: { runAt: "desc" },
    include: { candidates: { include: { symbol: true } } },
  });

  const latestPaperLog = await prisma.systemLog.findFirst({
    where: { jobName: "paper-lab-daily" },
    orderBy: { createdAt: "desc" },
  });
  const latestAnalyticsLog = await prisma.systemLog.findFirst({
    where: { jobName: "lab-analytics-daily" },
    orderBy: { createdAt: "desc" },
  });
  const cronLogs = await prisma.systemLog.findMany({
    where: {
      OR: [
        { jobName: "paper-lab-daily" },
        { jobName: "lab-analytics-daily" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const agentDecisions = sessionDate
    ? await prisma.agentDecision.count({ where: { sessionDate } })
    : 0;
  const orders = sessionDate
    ? await prisma.paperOrder.count({ where: { sessionDate } })
    : 0;
  const openPositions = await prisma.paperPosition.count({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
  });
  const battles = sessionDate
    ? await prisma.arenaBattle.count({ where: { sessionDate } })
    : 0;

  const telemetry = await prisma.labTelemetryEvent.findFirst({
    where: { jobName: "lab-analytics-daily", eventType: "job_complete" },
    orderBy: { createdAt: "desc" },
  });

  const errors = await prisma.agentError.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const scanSessionDate = latestScan?.runAt.toISOString().slice(0, 10) ?? null;
  const candidateSymbols = latestScan?.candidates.map((c) => c.symbol.symbol) ?? [];

  console.log(JSON.stringify(
    {
      status: "Production Dry Run Passed — Awaiting Live Cron Observation",
      database: db,
      executionMode: getPaperLabExecutionMode(),
      vnindex: {
        latestSession: sessionDate?.toISOString().slice(0, 10) ?? null,
        barCount: vnindexBarCount,
        latestClose: latestVnindex?.close ?? null,
        staleDays,
        staleStatus:
          staleDays == null
            ? "UNKNOWN"
            : staleDays >= STALE_SESSION_FAIL_DAYS
              ? "FAIL"
              : staleDays >= STALE_SESSION_WARN_DAYS
                ? "WARN"
                : "OK",
      },
      bars: { stockDailyBarCount: stockBarCount },
      scanner: {
        latestScanAt: latestScan?.runAt.toISOString() ?? null,
        scanSessionDate,
        candidateCountA: latestScan?.candidateCountA ?? 0,
        candidateCountB: latestScan?.candidateCountB ?? 0,
        totalCandidates: latestScan?.candidates.length ?? 0,
        candidateSymbols: candidateSymbols.slice(0, 30),
      },
      paperLab: {
        sessionDate: sessionDate?.toISOString().slice(0, 10) ?? null,
        agentDecisions,
        orders,
        openPositions,
        battles,
      },
      cron: {
        paperLabLast: latestPaperLog
          ? { at: latestPaperLog.createdAt.toISOString(), context: latestPaperLog.contextJson }
          : null,
        analyticsLast: latestAnalyticsLog
          ? { at: latestAnalyticsLog.createdAt.toISOString(), context: latestAnalyticsLog.contextJson }
          : null,
        recentJobLogs: cronLogs.map((l) => ({
          job: l.jobName,
          at: l.createdAt.toISOString(),
          context: l.contextJson,
        })),
      },
      analytics: {
        lastDurationMs: telemetry?.latencyMs ?? null,
        lastAt: telemetry?.createdAt.toISOString() ?? null,
        context: telemetry?.contextJson ?? null,
      },
      errorsLast7d: errors.map((e) => ({
        at: e.createdAt.toISOString(),
        agentId: e.agentId,
        job: e.jobName,
        message: e.message.slice(0, 200),
      })),
      directUrlConfigured: Boolean(process.env.DIRECT_URL?.trim()),
    },
    null,
    2
  ));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
