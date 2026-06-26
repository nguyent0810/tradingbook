import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const dto = (await loadPaperLabPageFromDb()) ?? buildMockPaperLabPageDto();
  let portfolios = dto.portfolios;
  if (agentId) portfolios = portfolios.filter((p) => p.agentId === agentId);
  return NextResponse.json({ portfolios });
}

export const dynamic = "force-dynamic";
