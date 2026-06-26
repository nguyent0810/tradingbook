import type { PrismaClient } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";

/** Max calendar days since latest VNINDEX bar before jobs warn/fail. */
export const STALE_SESSION_WARN_DAYS = 3;
export const STALE_SESSION_FAIL_DAYS = 7;

export type SessionReadiness = {
  ok: true;
  sessionDate: Date;
  staleDays: number;
  staleWarning: string | null;
} | {
  ok: false;
  error: string;
  staleDays?: number;
};

function utcDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.floor((a - b) / 86_400_000);
}

export async function assertSessionReady(
  prisma: PrismaClient,
  options?: { failOnStale?: boolean }
): Promise<SessionReadiness> {
  const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!sessionDate) {
    return { ok: false, error: "No VNINDEX session — import index bars before running paper lab" };
  }

  const staleDays = utcDayDiff(new Date(), sessionDate);
  const staleWarning =
    staleDays >= STALE_SESSION_WARN_DAYS
      ? `Market data is ${staleDays} calendar day(s) stale (latest session ${sessionDate.toISOString().slice(0, 10)})`
      : null;

  const failOnStale = options?.failOnStale ?? process.env.VERCEL === "1";
  if (failOnStale && staleDays >= STALE_SESSION_FAIL_DAYS) {
    return {
      ok: false,
      error: `Market data too stale (${staleDays}d) — latest VNINDEX session ${sessionDate.toISOString().slice(0, 10)}`,
      staleDays,
    };
  }

  const agentCount = await prisma.paperAgent.count({ where: { active: true, slug: { not: "cio" } } });
  if (agentCount === 0) {
    return { ok: false, error: "No paper agents seeded — run npm run seed:paper-agents" };
  }

  return { ok: true, sessionDate, staleDays, staleWarning };
}

export async function wasJobCompletedForSession(
  prisma: PrismaClient,
  jobName: string,
  sessionDate: Date
): Promise<boolean> {
  const iso = sessionDate.toISOString().slice(0, 10);
  const recent = await prisma.systemLog.findMany({
    where: { jobName, level: "info" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return recent.some(
    (row) => (row.contextJson as { sessionDate?: string } | null)?.sessionDate === iso
  );
}

export function isProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isDestructiveResetAllowed(request?: Request): boolean {
  if (!isProductionEnvironment()) return true;
  if (process.env.PAPER_LAB_ALLOW_RESET === "true") return true;
  const header = request?.headers.get("x-paper-lab-confirm-reset");
  return header === process.env.PAPER_LAB_RESET_TOKEN?.trim();
}
