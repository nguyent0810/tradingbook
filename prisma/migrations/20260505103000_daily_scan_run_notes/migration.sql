-- Optional Gate 2 / scan diagnostics JSON for offline review.
ALTER TABLE "daily_scan_runs" ADD COLUMN "notes" JSONB;
