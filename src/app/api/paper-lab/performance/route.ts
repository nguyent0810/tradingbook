import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  try {
    const rows = await prisma.agentPerformanceDaily.findMany({
      where: {
        ...(agentId ? { agent: { slug: agentId } } : {}),
        ...(from || to
          ? {
              sessionDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { sessionDate: "asc" },
      take: 365,
      include: { agent: true },
    });
    return NextResponse.json({
      series: rows.map((r) => ({
        agentId: r.agent.slug,
        sessionDate: r.sessionDate.toISOString().slice(0, 10),
        navVnd: Number(r.navVnd),
        totalReturnPct: r.totalReturnPct,
        sharpeLike: r.sharpeLike,
        winRate: r.winRate,
      })),
    });
  } catch {
    return NextResponse.json({ series: [] });
  }
}

export const dynamic = "force-dynamic";
