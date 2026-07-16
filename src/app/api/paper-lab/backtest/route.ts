import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { startBacktestRun } from "@/lib/paper-lab/backtest/backtest-runner";
import { z } from "zod";

const BodySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  agentSlugs: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = BodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const runId = await startBacktestRun(prisma, body.data);
  return NextResponse.json({ runId, status: "COMPLETED" });
}

