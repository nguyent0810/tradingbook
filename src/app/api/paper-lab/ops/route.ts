import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lastLog = await prisma.systemLog.findFirst({
      where: { jobName: "paper-lab-daily" },
      orderBy: { createdAt: "desc" },
    });
    const agentCount = await prisma.paperAgent.count();
    const openPositions = await prisma.paperPosition.count({
      where: { status: { in: ["OPEN", "PARTIAL"] } },
    });
    const errors = await prisma.agentError.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });

    return NextResponse.json({
      ok: true,
      agentCount,
      openPositions,
      errorsLast24h: errors,
      lastRun: lastLog
        ? { at: lastLog.createdAt.toISOString(), context: lastLog.contextJson }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
