/**
 * Scheduled Shadow Allocation review job — STRICTLY READ-ONLY, immutable records.
 *
 * At a cron invocation in period P, this reviews the latest FULLY COMPLETED
 * period strictly before P (prior calendar month / quarter), using the last
 * completed market session inside that prior period as the cutoff. `reviewDate`
 * is that completed session — it can never be a future date, and the result is
 * independent of whether the current period's first session has completed.
 *
 * Persistence contract (an AllocationReview is IMMUTABLE):
 *   - no existing review          → create one (applied=false)
 *   - existing, same inputHash     → REUSE (no write, outcome "reused")
 *   - existing, different inputHash → CONFLICT (no write, row unchanged)
 * A concurrent duplicate create loses the DB unique constraint and is resolved
 * by reading the winner. `force` bypasses ONLY the schedule gate — never
 * eligibility, data-readiness, immutability, conflict handling, or applied=false.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { recordLabTelemetry } from "@/lib/lab/observability/telemetry";
import { MANAGER_SLUGS } from "@/lib/paper-lab/dna/manager-configs";
import { buildAllocationReview } from "@/lib/paper-lab/dna/allocation-store";
import {
  ALLOCATION_SCORING_VERSION,
  ALLOC_CAP_PCT,
  ALLOC_FLOOR_PCT,
  DEFAULT_TRAILING_WINDOW,
  MIN_TRACK_RECORD_SESSIONS,
} from "@/lib/paper-lab/dna/allocation";

export type Cadence = "monthly" | "quarterly";
export const MIN_ACTIVE_MANAGERS = 3;
export const MIN_ELIGIBLE_MANAGERS = 3;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The latest fully completed review period STRICTLY BEFORE the period containing `now`. */
export function resolveReviewPeriod(now: Date, cadence: Cadence): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (cadence === "quarterly") {
    const qStartMonth = Math.floor(m / 3) * 3;
    return { start: new Date(Date.UTC(y, qStartMonth - 3, 1)), end: new Date(Date.UTC(y, qStartMonth, 0)) };
  }
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0)) };
}

/** Last completed VNINDEX session date within [start, end], or null if none. */
export async function latestCompletedSessionIn(prisma: PrismaClient, start: Date, end: Date): Promise<Date | null> {
  const bar = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX", date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return bar?.date ?? null;
}

export interface ShadowAllocationOptions {
  cadence?: Cadence;
  /** Bypasses ONLY the schedule/non-review gate. Never eligibility/immutability/readiness. */
  force?: boolean;
  trailingWindowSessions?: number;
  /** Invocation time (defaults to now). Determines the prior review period. */
  now?: Date;
  minActiveManagers?: number;
  minEligibleManagers?: number;
  minTrackRecord?: number;
}
export type Outcome = "created" | "reused" | "existing_review_input_conflict" | "skipped";
export type ShadowAllocationJobResult =
  | { ok: true; outcome: Outcome; skipped: boolean; reason?: string; summary: Record<string, unknown> }
  | { ok: false; error: string };

async function activeManagerPortfolios(prisma: PrismaClient) {
  const managers = await prisma.paperAgent.findMany({ where: { active: true, slug: { in: [...MANAGER_SLUGS] } }, include: { portfolio: true } });
  return managers.filter((m) => m.portfolio).map((m) => ({ agentId: m.id, portfolioId: m.portfolio!.id }));
}

function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

export async function runShadowAllocationReviewJob(prisma: PrismaClient, options?: ShadowAllocationOptions): Promise<ShadowAllocationJobResult> {
  const started = Date.now();
  const cadence: Cadence = options?.cadence ?? "monthly";
  const window = options?.trailingWindowSessions ?? DEFAULT_TRAILING_WINDOW;
  const now = options?.now ?? new Date();

  const period = resolveReviewPeriod(now, cadence);

  const log = async (level: "info" | "warn", message: string, ctx: Record<string, unknown>) => {
    await prisma.systemLog.create({ data: { jobName: "shadow-allocation-review", level, message, contextJson: ctx as object } });
  };
  const skip = async (reason: string, extra: Record<string, unknown> = {}): Promise<ShadowAllocationJobResult> => {
    const summary = { periodStart: iso(period.start), periodEnd: iso(period.end), cadence, scoringVersion: ALLOCATION_SCORING_VERSION, skipped: true, reason, applied: false, ...extra };
    await log("info", `Shadow allocation review skipped: ${reason}`, summary);
    return { ok: true, outcome: "skipped", skipped: true, reason, summary };
  };

  // --- Resolve the cutoff: last completed session inside the prior period. ---
  const cutoff = await latestCompletedSessionIn(prisma, period.start, period.end);
  if (!cutoff) return skip("no_completed_session_in_prior_period");
  const reviewDate = cutoff; // never future; <= latest completed source session by construction

  // --- Eligibility gates (never bypassed by force). ---
  const managers = await activeManagerPortfolios(prisma);
  if (managers.length < (options?.minActiveManagers ?? MIN_ACTIVE_MANAGERS)) return skip("insufficient_active_managers", { activeManagers: managers.length });
  const pids = managers.map((m) => m.portfolioId);
  const snapTotal = await prisma.portfolioSnapshot.count({ where: { portfolioId: { in: pids }, sessionDate: { lte: reviewDate } } });
  if (snapTotal === 0) return skip("no_performance_snapshots");

  // --- Data-readiness gate: the cutoff session's snapshots must exist (the daily
  // pipeline produced the period's final snapshot). Never bypassed by force. ---
  const cutoffSnaps = await prisma.portfolioSnapshot.count({ where: { portfolioId: { in: pids }, sessionDate: cutoff } });
  if (cutoffSnaps === 0) return skip("source_data_not_ready", { reviewDate: iso(reviewDate) });

  const minTrack = options?.minTrackRecord ?? MIN_TRACK_RECORD_SESSIONS;
  let eligibleCount = 0;
  for (const m of managers) {
    const c = await prisma.portfolioSnapshot.count({ where: { portfolioId: m.portfolioId, sessionDate: { lte: reviewDate } } });
    if (c >= minTrack) eligibleCount += 1;
  }
  if (eligibleCount < (options?.minEligibleManagers ?? MIN_ELIGIBLE_MANAGERS)) return skip("insufficient_track_record", { eligibleManagers: eligibleCount });

  // --- Compute in memory (read-only). ---
  const build = await buildAllocationReview(prisma, reviewDate, cadence, { trailingWindowSessions: window });

  const whereKey = { reviewDate_cadence_scoringVersion: { reviewDate, cadence, scoringVersion: ALLOCATION_SCORING_VERSION } };
  const proposalsSum = build.proposals.reduce((s, p) => s + p.proposedPct, 0);

  const finish = async (outcome: Outcome, reviewId: string | null, extra: Record<string, unknown> = {}): Promise<ShadowAllocationJobResult> => {
    const proposals = build.proposals;
    const eligible = proposals.filter((p) => p.eligible).length;
    const topRanked = [...proposals].sort((a, b) => a.rank - b.rank)[0]!;
    const strongestIncrease = [...proposals].sort((a, b) => b.changePct - a.changePct)[0]!;
    const strongestDecrease = [...proposals].sort((a, b) => a.changePct - b.changePct)[0]!;
    const summary = {
      reviewId,
      reviewDate: iso(reviewDate),
      cadence,
      scoringVersion: ALLOCATION_SCORING_VERSION,
      trailingWindowSessions: window,
      outcome,
      eligibleManagers: eligible,
      ineligibleManagers: proposals.length - eligible,
      attributionCoverage: build.attributionCoverage,
      attributionAvailable: build.attributionCoverage > 0,
      topRanked: topRanked.slug,
      strongestIncrease: { slug: strongestIncrease.slug, changePct: Number(strongestIncrease.changePct.toFixed(4)) },
      strongestDecrease: { slug: strongestDecrease.slug, changePct: Number(strongestDecrease.changePct.toFixed(4)) },
      floorApplied: proposals.filter((p) => Math.abs(p.proposedPct - ALLOC_FLOOR_PCT) < 1e-9).length,
      capApplied: proposals.filter((p) => Math.abs(p.proposedPct - ALLOC_CAP_PCT) < 1e-9).length,
      proposalsSumOk: Math.abs(proposalsSum - 1) < 1e-6,
      applied: false,
      ...extra,
    };
    await recordLabTelemetry(prisma, { jobName: "shadow-allocation-review", eventType: "job_complete", latencyMs: Date.now() - started, success: outcome !== "existing_review_input_conflict", context: summary });
    await log(outcome === "existing_review_input_conflict" ? "warn" : "info", `Shadow allocation review ${outcome}`, summary);
    return { ok: true, outcome, skipped: false, summary };
  };

  // --- Immutable persistence: create-if-absent / reuse / conflict. ---
  const existing = await prisma.allocationReview.findUnique({ where: whereKey });
  if (existing) {
    if (existing.inputHash === build.inputHash) return finish("reused", existing.id);
    return finish("existing_review_input_conflict", existing.id, {
      existingHashPrefix: existing.inputHash.slice(0, 8),
      candidateHashPrefix: build.inputHash.slice(0, 8),
    });
  }

  try {
    const created = await prisma.allocationReview.create({
      data: {
        reviewDate, cadence, trailingWindowSessions: window, scoringVersion: ALLOCATION_SCORING_VERSION,
        totalPoolVnd: BigInt(Math.round(build.totalPoolVnd)),
        scorecardsJson: build.scorecards as object,
        currentAllocationJson: build.currentAllocation as object,
        proposedAllocationJson: build.proposedAllocation as object,
        reasonCodesJson: build.reasonCodes as object,
        inputHash: build.inputHash,
        applied: false,
      },
    });
    return finish("created", created.id);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Concurrent create lost the race — read the winner, never overwrite.
    const winner = await prisma.allocationReview.findUnique({ where: whereKey });
    if (winner && winner.inputHash === build.inputHash) return finish("reused", winner.id);
    return finish("existing_review_input_conflict", winner?.id ?? null, {
      existingHashPrefix: winner?.inputHash.slice(0, 8) ?? null,
      candidateHashPrefix: build.inputHash.slice(0, 8),
    });
  }
}
