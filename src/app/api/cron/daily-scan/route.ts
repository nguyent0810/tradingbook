import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request";
import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";
import { prisma } from "@/lib/prisma";
import { runDailyScanJob } from "@/lib/scanner/run-daily-scan-job";

/** Vercel / Node ceiling — scanner loops DB-heavy symbols (requires Hobby limits awareness). */
export const maxDuration = 300;

/**
 * GET — invoked by Vercel Cron (backup) or GitHub Actions after bar import.
 *
 * When `CRON_SECRET` is set on the Vercel project, Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` on scheduled invocations (see Vercel Cron docs).
 * Manual triggers must send the same header.
 *
 * Env:
 * - `DATABASE_URL` — Postgres (must contain indexed equity bars + active universe).
 * - `CRON_SECRET` — **required** on Vercel (`VERCEL=1`); omitted locally allows open access for dev only.
 * - `SCAN_SYMBOL_LIMIT` — optional cap (same semantics as CLI).
 */

export async function GET(request: Request): Promise<NextResponse> {
  const started = Date.now();
  const isVercel = Boolean(process.env.VERCEL);
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const dbHint = describeDatabaseUrl();

  console.info("[cron daily-scan] request", {
    isVercel,
    vercelCronInvocation: vercelCronHeader === "1",
    databaseUrlHint: dbHint,
  });

  const secret = process.env.CRON_SECRET;
  const auth = authorizeCronRequest(request, secret, isVercel);
  if (!auth.ok) {
    console.warn("[cron daily-scan] auth_failed", {
      reason: auth.reason,
      isVercel,
      vercelCronInvocation: vercelCronHeader === "1",
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      databaseUrlHint: dbHint,
    });
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const result = await runDailyScanJob(prisma);

  if (!result.ok) {
    console.error("[cron daily-scan] job_failed", {
      error: result.error,
      elapsedMs: Date.now() - started,
      databaseUrlHint: dbHint,
    });
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // A skipped run wrote nothing, so there is no new scan data to expose and no
  // reason to churn the cache. Only a real scan invalidates.
  if (result.kind === "SKIPPED_ALREADY_COMPLETED") {
    console.info("[cron daily-scan] skipped", {
      ...result.summaryJson,
      elapsedMs: Date.now() - started,
      databaseUrlHint: dbHint,
    });
    return NextResponse.json(
      { ok: true, kind: result.kind, databaseUrlHint: dbHint, ...result.summaryJson },
      { status: 200 }
    );
  }

  // Cron-triggered, not a user-facing Server Action — expire immediately rather than
  // stale-while-revalidate so the next dashboard/setups visit gets fresh scan data.
  revalidateTag("daily-scan", { expire: 0 });

  const summary =
    typeof result.summaryJson === "object" && result.summaryJson !== null
      ? result.summaryJson
      : {};

  console.info("[cron daily-scan] completed", {
    kind: result.kind,
    scanRunId: summary.scanRunId,
    symbolCountTotal: summary.symbolCountTotal,
    symbolCountScanned: summary.symbolCountScanned,
    symbolCountAfterTradability: summary.symbolCountAfterTradability,
    setupCandidatesInserted: summary.setupCandidatesInserted,
    elapsedMs: Date.now() - started,
    databaseUrlHint: dbHint,
  });

  return NextResponse.json(
    {
      ok: true,
      kind: result.kind,
      databaseUrlHint: dbHint,
      ...summary,
    },
    { status: 200 }
  );
}
