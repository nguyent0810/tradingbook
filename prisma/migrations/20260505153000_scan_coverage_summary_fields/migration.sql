-- Add scanner coverage and runtime summary fields
ALTER TABLE "daily_scan_runs"
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "finished_at" TIMESTAMP(3),
ADD COLUMN "symbol_count_scanned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "symbol_count_failed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "setup_candidates_created" INTEGER NOT NULL DEFAULT 0;
