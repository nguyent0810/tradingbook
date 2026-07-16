import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionDate = req.nextUrl.searchParams.get("sessionDate");
  const symbol = req.nextUrl.searchParams.get("symbol");

  const dto = (await loadPaperLabPageFromDb()) ?? buildMockPaperLabPageDto();
  let recommendations = dto.cio.recommendations;
  if (symbol) recommendations = recommendations.filter((r) => r.symbol === symbol);

  return NextResponse.json({
    sessionDate: sessionDate ?? dto.cio.sessionDate,
    recommendations,
  });
}

