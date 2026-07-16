import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionDateParam = req.nextUrl.searchParams.get("sessionDate");

  try {
    const latest = sessionDateParam
      ? new Date(sessionDateParam)
      : (
          await prisma.agentRanking.findFirst({ orderBy: { sessionDate: "desc" } })
        )?.sessionDate;

    if (!latest) return NextResponse.json({ rankings: [] });

    const rankings = await prisma.agentRanking.findMany({
      where: { sessionDate: latest },
      orderBy: { rank: "asc" },
      include: { agent: true },
    });

    return NextResponse.json({
      sessionDate: latest.toISOString().slice(0, 10),
      rankings: rankings.map((r) => ({
        agentId: r.agent.slug,
        rank: r.rank,
        rankChange: r.rankChange,
        compositeScore: r.compositeScore,
        scoreBreakdown: r.scoreBreakdown,
      })),
    });
  } catch {
    return NextResponse.json({ rankings: [] });
  }
}

