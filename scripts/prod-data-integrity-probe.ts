/**
 * Read-only production data integrity probe.
 *   SMOKE_DATABASE=production npx tsx scripts/prod-data-integrity-probe.ts
 */
import { config } from "dotenv";

async function run(): Promise<void> {
  const useProd = process.env.SMOKE_DATABASE === "production";
  if (!useProd) {
    console.error("Set SMOKE_DATABASE=production for this probe.");
    process.exit(1);
  }
  config({ path: ".env.prod.local", override: true });

  const pg = (await import("pg")).default;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const q = async (label: string, sql: string, params: unknown[] = []) => {
    const res = await pool.query(sql, params);
    return { label, rows: res.rows, rowCount: res.rowCount };
  };

  const results = {
    probedAt: new Date().toISOString(),
    vnindexLatest: await q(
      "vnindex_latest",
      `SELECT date, close FROM index_daily_bars WHERE symbol = 'VNINDEX' ORDER BY date DESC LIMIT 5`
    ),
    equityMax: await q(
      "equity_max",
      `SELECT MAX(date) AS max_date, COUNT(*)::int AS bar_count FROM stock_daily_bars`
    ),
    equityLatestBySymbol: await q(
      "equity_latest_sample",
      `SELECT ss.symbol, MAX(b.date) AS max_date
       FROM stock_daily_bars b
       JOIN stock_symbols ss ON ss.id = b.symbol_id
       GROUP BY ss.symbol
       ORDER BY max_date DESC NULLS LAST
       LIMIT 10`
    ),
    scanRunsRecent: await q(
      "scan_runs",
      `SELECT id, run_at, status, gate1_level, symbol_count_total, symbol_count_scanned,
              candidate_count_surfaced, setup_candidates_created, error_summary,
              notes->'p0dExitHealthSmoke' AS p0d_smoke,
              notes->'demoSeed' AS demo_seed
       FROM daily_scan_runs
       ORDER BY run_at DESC
       LIMIT 10`
    ),
    p0dexitSymbol: await q(
      "stock_p0dexit",
      `SELECT id, symbol, name, active FROM stock_symbols WHERE symbol IN ('P0DEXIT', 'PODEXIT', 'DEMOSETUP')`
    ),
    p0dCandidates: await q(
      "setup_candidates_p0d",
      `SELECT sc.id, sc.scan_run_id, ss.symbol, sc.rank_score, sc.bar_date, sc.reasons
       FROM setup_candidates sc
       JOIN stock_symbols ss ON ss.id = sc.symbol_id
       WHERE ss.symbol IN ('P0DEXIT', 'PODEXIT')
       ORDER BY sc.id DESC`
    ),
    p0dTrades: await q(
      "trades_smoke",
      `SELECT id, symbol, status, setup_id, notes, health_level_at_entry
       FROM trades WHERE notes LIKE '%P0D_EXIT_HEALTH_SMOKE%' OR symbol IN ('P0DEXIT', 'PODEXIT')`
    ),
    p0dHealthLogs: await q(
      "health_logs_smoke",
      `SELECT thl.id, thl.trade_id, thl.checked_at, thl.health_level, thl.price_vs_zone
       FROM trade_health_logs thl
       JOIN trades t ON t.id = thl.trade_id
       WHERE t.notes LIKE '%P0D_EXIT_HEALTH_SMOKE%' OR t.symbol = 'P0DEXIT'`
    ),
    p0dOutcomes: await q(
      "setup_outcomes_smoke",
      `SELECT id, trade_id, setup_id, health_level_at_entry, health_level_at_exit
       FROM setup_outcomes
       WHERE trade_id IN (SELECT id FROM trades WHERE notes LIKE '%P0D_EXIT_HEALTH_SMOKE%')`
    ),
    scanRunsWithP0dFlag: await q(
      "scan_runs_p0d_flag",
      `SELECT id, run_at, notes FROM daily_scan_runs
       WHERE notes::text LIKE '%p0dExitHealthSmoke%' OR notes::text LIKE '%P0D_EXIT_HEALTH%'
       ORDER BY run_at DESC LIMIT 5`
    ),
    latestScanCandidates: await q(
      "latest_scan_top_candidates",
      `SELECT ss.symbol, sc.rank_score, sc.quality, sc.bar_date
       FROM setup_candidates sc
       JOIN stock_symbols ss ON ss.id = sc.symbol_id
       WHERE sc.scan_run_id = (SELECT id FROM daily_scan_runs ORDER BY run_at DESC LIMIT 1)
       ORDER BY sc.rank_score DESC
       LIMIT 15`
    ),
    activeSymbolCount: await q(
      "active_symbols",
      `SELECT COUNT(*)::int AS active_count FROM stock_symbols WHERE active = true`
    ),
    failedScanRuns: await q(
      "failed_scan_runs",
      `SELECT id, run_at, status, error_summary
       FROM daily_scan_runs
       WHERE status::text != 'COMPLETED'
       ORDER BY run_at DESC
       LIMIT 5`
    ),
    smokeWatchItems: await q(
      "watch_items_smoke",
      `SELECT swi.id, ss.symbol
       FROM setup_watch_items swi
       JOIN stock_symbols ss ON ss.id = swi.symbol_id
       WHERE ss.symbol = 'P0DEXIT'`
    ),
  };

  console.log(JSON.stringify(results, null, 2));
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
