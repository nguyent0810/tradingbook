import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const symbol = req.nextUrl.searchParams.get("symbol");
  const date = req.nextUrl.searchParams.get("date");

  const dto = (await loadPaperLabPageFromDb()) ?? buildMockPaperLabPageDto();
  let decisions = dto.decisions;
  if (agentId) decisions = decisions.filter((d) => d.agentId === agentId);
  if (symbol) decisions = decisions.filter((d) => d.symbol === symbol);
  if (date) decisions = decisions.filter((d) => d.date === date);

  return NextResponse.json({ decisions });
}

