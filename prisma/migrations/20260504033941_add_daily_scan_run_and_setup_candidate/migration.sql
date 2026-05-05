-- CreateEnum
CREATE TYPE "DailyScanRunStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Gate1ScanLevel" AS ENUM ('PASS', 'WARNING', 'FAIL');

-- CreateEnum
CREATE TYPE "ScanSetupType" AS ENUM ('BREAKOUT_PULLBACK');

-- CreateEnum
CREATE TYPE "ScanQuality" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "daily_scan_runs" (
    "id" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gate1_level" "Gate1ScanLevel" NOT NULL,
    "status" "DailyScanRunStatus" NOT NULL,
    "symbol_count_total" INTEGER NOT NULL,
    "symbol_count_after_tradability" INTEGER NOT NULL,
    "symbol_count_filtered_out" INTEGER NOT NULL,
    "candidate_count_a" INTEGER NOT NULL,
    "candidate_count_b" INTEGER NOT NULL,
    "candidate_count_surfaced" INTEGER NOT NULL,
    "tradability_breakdown" JSONB,
    "error_summary" TEXT,

    CONSTRAINT "daily_scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setup_candidates" (
    "id" TEXT NOT NULL,
    "scan_run_id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "setup_type" "ScanSetupType" NOT NULL,
    "quality" "ScanQuality" NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "breakout_level" DOUBLE PRECISION NOT NULL,
    "pullback_zone_low" DOUBLE PRECISION NOT NULL,
    "pullback_zone_high" DOUBLE PRECISION NOT NULL,
    "stop_level" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "rank_score" DOUBLE PRECISION NOT NULL,
    "bar_date" DATE NOT NULL,

    CONSTRAINT "setup_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_scan_runs_run_at_idx" ON "daily_scan_runs"("run_at" DESC);

-- CreateIndex
CREATE INDEX "setup_candidates_scan_run_id_idx" ON "setup_candidates"("scan_run_id");

-- CreateIndex
CREATE INDEX "setup_candidates_symbol_id_idx" ON "setup_candidates"("symbol_id");

-- AddForeignKey
ALTER TABLE "setup_candidates" ADD CONSTRAINT "setup_candidates_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "daily_scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_candidates" ADD CONSTRAINT "setup_candidates_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "stock_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
