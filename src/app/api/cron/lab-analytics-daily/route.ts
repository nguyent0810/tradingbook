import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request";
import { prisma } from "@/lib/prisma";
import { runLabAnalyticsDailyJob } from "@/lib/lab/jobs/run-lab-analytics-daily";

export const maxDuration = 300;

export async function GET(request: Request) {
  const isVercel = Boolean(process.env.VERCEL);
  const auth = authorizeCronRequest(request, process.env.CRON_SECRET, isVercel);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await runLabAnalyticsDailyJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.summary });
}
