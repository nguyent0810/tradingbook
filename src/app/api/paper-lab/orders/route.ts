import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const sessionDate = req.nextUrl.searchParams.get("sessionDate");

  try {
    const orders = await prisma.paperOrder.findMany({
      where: {
        ...(agentId
          ? { portfolio: { agent: { slug: agentId } } }
          : {}),
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { portfolio: { include: { agent: true } } },
    });
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        agentId: o.portfolio.agent.slug,
        symbol: o.symbol,
        side: o.side,
        quantity: o.quantity,
        priceKvnd: o.priceKvnd,
        status: o.status,
        sessionDate: o.sessionDate.toISOString().slice(0, 10),
        rejectionReason: o.rejectionReason,
      })),
    });
  } catch {
    return NextResponse.json({ orders: [] });
  }
}

