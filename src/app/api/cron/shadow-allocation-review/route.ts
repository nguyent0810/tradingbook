import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request";
import { prisma } from "@/lib/prisma";
import { runShadowAllocationReviewJob } from "@/lib/paper-lab/dna/allocation-review-job";

export const maxDuration = 300;

/**
 * Scheduled monthly shadow-allocation review (read-only). Cadence is fixed to
 * MONTHLY here and no request parameters alter behavior — `force` and quarterly
 * cadence are deliberately CLI-only (npm run alloc:review [-- --quarterly --force])
 * so a query string cannot weaken the schedule or safety gates.
 */
export async function GET(request: Request) {
  const isVercel = Boolean(process.env.VERCEL);
  const auth = authorizeCronRequest(request, process.env.CRON_SECRET, isVercel);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await runShadowAllocationReviewJob(prisma, { cadence: "monthly" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result.summary });
}
