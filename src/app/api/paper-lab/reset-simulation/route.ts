import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import { isDestructiveResetAllowed } from "@/lib/paper-lab/job-guards";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isDestructiveResetAllowed(request)) {
    return NextResponse.json(
      {
        error:
          "Reset blocked in production. Set PAPER_LAB_ALLOW_RESET=true or send x-paper-lab-confirm-reset header matching PAPER_LAB_RESET_TOKEN.",
      },
      { status: 403 }
    );
  }

  const portfolios = await prisma.paperPortfolio.findMany();
  for (const p of portfolios) {
    await prisma.paperPosition.deleteMany({ where: { portfolioId: p.id } });
    await prisma.paperOrder.deleteMany({ where: { portfolioId: p.id } });
    await prisma.portfolioSnapshot.deleteMany({ where: { portfolioId: p.id } });
    await prisma.paperPortfolio.update({
      where: { id: p.id },
      data: { cashVnd: BigInt(PAPER_INITIAL_CAPITAL_VND) },
    });
  }

  await prisma.agentDecision.deleteMany({});
  await prisma.agentPerformanceDaily.deleteMany({});
  await prisma.agentRanking.deleteMany({});
  await prisma.cioRecommendation.deleteMany({});

  return NextResponse.json({ reset: portfolios.length });
}

export const dynamic = "force-dynamic";
