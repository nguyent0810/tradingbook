-- Idempotency key for the daily scan.
--
-- The scan endpoint is triggered twice per trading day: GitHub Actions calls it
-- after the bar import (~12:30 UTC), and the Vercel cron calls it again at
-- 14:00 UTC as a backup. Neither path had a guard, so production accumulated
-- ~2 COMPLETED runs per session (one session had 3), which double-counted
-- setup_candidates and every aggregate derived from them.
--
-- This column stores the trading session a run evaluated so the second trigger
-- can detect that the session is already done and skip.

ALTER TABLE "daily_scan_runs" ADD COLUMN "expected_session_date" DATE;

-- Backfill from the session already recorded in the notes payload. This is the
-- authoritative value the run itself computed, not a heuristic derived from
-- run_at (which would misattribute late-evening runs). Rows written before
-- notes carried sessionCoverage stay NULL, which is correct: the guard only
-- matches non-null sessions, so it can never suppress a run on their account.
UPDATE "daily_scan_runs"
SET "expected_session_date" = ("notes" -> 'sessionCoverage' ->> 'expectedSessionDate')::date
WHERE "notes" -> 'sessionCoverage' ->> 'expectedSessionDate' IS NOT NULL;

CREATE INDEX "daily_scan_runs_expected_session_date_status_idx"
  ON "daily_scan_runs" ("expected_session_date", "status");
