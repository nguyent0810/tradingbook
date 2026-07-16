import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runPaperLabDailyJob } from "@/lib/paper-lab/jobs/run-paper-lab-daily-job";
import { z } from "zod";

const BodySchema = z.object({
  sessionDate: z.string().optional(),
  agentIds: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  if (body.data.dryRun) {
    return NextResponse.json({ runId: null, dryRun: true, message: "Dry run — no agents executed" });
  }

  const result = await runPaperLabDailyJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ runId: "paper-lab-daily", ...result.summary });
}

export const maxDuration = 300;
