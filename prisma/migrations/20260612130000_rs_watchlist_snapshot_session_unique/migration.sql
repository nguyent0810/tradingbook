-- One snapshot run per session date (idempotent upsert).
CREATE UNIQUE INDEX "rs_watchlist_snapshot_runs_session_date_key" ON "rs_watchlist_snapshot_runs"("session_date");
