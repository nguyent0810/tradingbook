import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { computePortfolioState } from "@/lib/paper-lab/portfolio/portfolio-service";
import {
  computeAgentPerformance,
  computeAndPersistRankings,
  persistAgentPerformanceDaily,
} from "@/lib/paper-lab/performance/metrics";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!sessionDate) return NextResponse.json({ error: "No session" }, { status: 503 });

  const agents = await prisma.paperAgent.findMany({
    where: { slug: { not: "cio" } },
    include: { portfolio: true },
  });

  const metricsList = [];
  for (const agent of agents) {
    if (!agent.portfolio) continue;
    const marks = new Map<string, number>();
    const state = await computePortfolioState(prisma, agent.portfolio.id, marks);
    const metrics = await computeAgentPerformance(prisma, agent.id, sessionDate, state.navVnd);
    await persistAgentPerformanceDaily(prisma, agent.id, sessionDate, metrics);
    metricsList.push(metrics);
  }

  await computeAndPersistRankings(prisma, sessionDate, metricsList);
  return NextResponse.json({ updated: metricsList.length });
}

