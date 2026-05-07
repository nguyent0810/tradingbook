import { NextResponse } from "next/server";
import { describeDatabaseUrl } from "@/lib/database-url-fingerprint";
import { prisma } from "@/lib/prisma";
import { runDailyScanJob } from "@/lib/scanner/run-daily-scan-job";

/** Vercel / Node ceiling — scanner loops DB-heavy symbols (requires Hobby limits awareness). */
export const maxDuration = 300;

/**
 * GET — invoked by Vercel Cron.
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
function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1];
  return raw != null ? raw.trim() : null;
}

type CronAuthFailure =
  | "cron_secret_missing"
  | "missing_authorization"
  | "malformed_bearer"
  | "bearer_mismatch";

function authorizeCronRequest(
  request: Request,
  secret: string | undefined,
  isVercel: boolean
): { ok: true } | { ok: false; status: 401 | 500; error: string; reason: CronAuthFailure } {
  const trimmed = secret?.trim();
  if (isVercel && !trimmed) {
    return {
      ok: false,
      status: 500,
      error:
        "CRON_SECRET is not configured — add CRON_SECRET to Vercel Production env and redeploy. Without it, scheduled cron cannot authenticate.",
      reason: "cron_secret_missing",
    };
  }
  if (!trimmed) {
    return { ok: true };
  }

  const authHeader = request.headers.get("authorization");
  const token = parseBearerToken(authHeader);
  if (!authHeader?.trim()) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "missing_authorization",
    };
  }
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "malformed_bearer",
    };
  }
  if (token !== trimmed) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "bearer_mismatch",
    };
  }
  return { ok: true };
}

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
