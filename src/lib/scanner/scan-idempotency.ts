import type { DailyScanRunStatus } from "@/generated/prisma/client";

/**
 * The daily scan endpoint has two independent triggers: GitHub Actions calls it
 * after the production bar import (~12:30 UTC) and the Vercel cron calls it at
 * 14:00 UTC as a backup. Before this guard, both ran, so production accumulated
 * about two COMPLETED runs per trading session — double-counting
 * `setup_candidates` and every aggregate built on them.
 *
 * The rule is deliberately one-directional: a session that already COMPLETED is
 * skipped, anything else proceeds. A FAILED earlier run must not block the
 * backup trigger — that is precisely the case the backup exists for.
 *
 * Scope, stated honestly: this is a check-then-insert guard, not a hard
 * constraint. Two genuinely concurrent invocations could both read "no prior
 * completed run" and both write. In production the two triggers are ~1.5h apart
 * and the route caps at `maxDuration = 300`, so they cannot overlap; the gap
 * that remains is a manual hit landing on top of a running scan. Closing it
 * properly needs a DB-level guarantee (a partial unique index on
 * `(expected_session_date) WHERE status = 'COMPLETED'`, or an advisory lock),
 * which also has to decide what `SCAN_FORCE_RERUN` should mean — a superseded
 * flag rather than a second COMPLETED row. Deferred deliberately.
 */

export type ExistingScanRun = {
  id: string;
  status: DailyScanRunStatus;
  expectedSessionDate: Date | null;
};

export type ScanIdempotencyDecision =
  | { proceed: true; reason: "no_prior_completed_run" | "forced" }
  | { proceed: false; reason: "already_completed"; existingRunId: string };

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function decideScanIdempotency(params: {
  expectedSession: Date;
  priorRuns: readonly ExistingScanRun[];
  force?: boolean;
}): ScanIdempotencyDecision {
  if (params.force) return { proceed: true, reason: "forced" };

  const completed = params.priorRuns.find(
    (r) =>
      r.status === "COMPLETED" &&
      r.expectedSessionDate != null &&
      sameUtcDay(r.expectedSessionDate, params.expectedSession)
  );

  if (completed) {
    return { proceed: false, reason: "already_completed", existingRunId: completed.id };
  }
  return { proceed: true, reason: "no_prior_completed_run" };
}

/** `SCAN_FORCE_RERUN=1` re-runs a session that already completed (manual ops). */
export function resolveScanForceRerun(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
