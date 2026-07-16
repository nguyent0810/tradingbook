import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dto = (await loadPaperLabPageFromDb()) ?? buildMockPaperLabPageDto();
  return NextResponse.json({ rows: dto.leaderboard, sessionDate: dto.overview.latestEvaluationAt });
}

