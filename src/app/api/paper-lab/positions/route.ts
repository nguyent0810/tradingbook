import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadPaperLabPageFromDb } from "@/lib/paper-lab/queries/load-paper-lab-page-from-db";
import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const status = req.nextUrl.searchParams.get("status") ?? "OPEN";

  const dto = (await loadPaperLabPageFromDb()) ?? buildMockPaperLabPageDto();
  let positions = dto.positions;
  if (agentId) positions = positions.filter((p) => p.agentId === agentId);
  if (status !== "ALL") positions = positions.filter((p) => p.status === status);

  return NextResponse.json({ positions });
}

export const dynamic = "force-dynamic";
