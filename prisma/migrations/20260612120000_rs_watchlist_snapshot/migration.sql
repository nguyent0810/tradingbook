-- CreateTable
CREATE TABLE "rs_watchlist_snapshot_runs" (
    "id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict_ux_level" TEXT,
    "trade_permission" TEXT,
    "tradability_passed_count" INTEGER,
    "scoring_version" TEXT NOT NULL DEFAULT 'v0',

    CONSTRAINT "rs_watchlist_snapshot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rs_watchlist_snapshot_rows" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "rank_position" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "rs20_spread_pct" DOUBLE PRECISION NOT NULL,
    "rs50_spread_pct" DOUBLE PRECISION,
    "terminal_code" TEXT,
    "setup_state" TEXT NOT NULL,
    "setup_reason" TEXT NOT NULL,
    "stage_rank" INTEGER,
    "distance_to_pullback_zone_frac" DOUBLE PRECISION,
    "rs_strength_score" INTEGER,
    "setup_readiness_score" INTEGER,
    "rs_confidence" TEXT,
    "forward_return_3d_pct" DOUBLE PRECISION,
    "forward_return_5d_pct" DOUBLE PRECISION,
    "forward_return_10d_pct" DOUBLE PRECISION,
    "max_drawdown_10d_pct" DOUBLE PRECISION,

    CONSTRAINT "rs_watchlist_snapshot_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rs_watchlist_snapshot_runs_session_date_idx" ON "rs_watchlist_snapshot_runs"("session_date" DESC);

-- CreateIndex
CREATE INDEX "rs_watchlist_snapshot_rows_run_id_rank_position_idx" ON "rs_watchlist_snapshot_rows"("run_id", "rank_position");

-- CreateIndex
CREATE INDEX "rs_watchlist_snapshot_rows_symbol_idx" ON "rs_watchlist_snapshot_rows"("symbol");

-- AddForeignKey
ALTER TABLE "rs_watchlist_snapshot_rows" ADD CONSTRAINT "rs_watchlist_snapshot_rows_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "rs_watchlist_snapshot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
