import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDailyScanJob } from "@/lib/scanner/run-daily-scan-job";

/** Vercel / Node ceiling — scanner loops DB-heavy symbols (requires Hobby limits awareness). */
export const maxDuration = 300;

/**
 * GET — invoked by Vercel Cron.
 * Secured with `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set (recommended).
 *
 * Env:
 * - `DATABASE_URL` — Postgres (must contain indexed equity bars + active universe).
 * - `CRON_SECRET` — required on Vercel deployments (`VERCEL=1`) so anonymous callers cannot trigger scans.
 * - `SCAN_SYMBOL_LIMIT` — optional cap (same semantics as CLI).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isVercel = Boolean(process.env.VERCEL);
  const secret = process.env.CRON_SECRET?.trim();

  if (isVercel && !secret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET is not configured — set it in Vercel env and redeploy so cron requests can authenticate.",
      },
      { status: 500 }
    );
  }

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runDailyScanJob(prisma);

  if (!result.ok) {
    console.error("[cron daily-scan]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      kind: result.kind,
      ...(typeof result.summaryJson === "object" && result.summaryJson !== null
        ? result.summaryJson
        : {}),
    },
    { status: 200 }
  );
}
