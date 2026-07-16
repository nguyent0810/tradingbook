import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

async function requireAuth() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

async function loadDto() {
  const fromDb = await loadPaperLabPageFromDb();
  return fromDb ?? buildMockPaperLabPageDto();
}

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dto = await loadDto();
  return NextResponse.json({
    totalAgents: dto.overview.totalAgents,
    totalVirtualCapitalVnd: dto.overview.totalVirtualCapitalVnd,
    bestAgent: dto.overview.bestAgent,
    worstAgent: dto.overview.worstAgent,
    totalOpenPositions: dto.overview.totalOpenPositions,
    marketRegime: dto.overview.marketRegime,
    latestEvaluationAt: dto.overview.latestEvaluationAt,
    disclaimer: dto.overview.disclaimer,
  });
}

