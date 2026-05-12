import type { MarketDataAlignmentAnalysis } from "@/lib/market/market-data-alignment";
import type { MarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { utcCalendarDayMs } from "@/lib/trades/position-health";

/** True when any stored equity bar session is strictly after the benchmark EOD session. */
export function isBenchmarkStaleVsEquity(
  benchmarkSession: Date | null,
  equityMaxSession: Date | null
): boolean {
  if (!benchmarkSession || !equityMaxSession) return false;
  return utcCalendarDayMs(equityMaxSession) > utcCalendarDayMs(benchmarkSession);
}

export type MarketDataFreshnessReport = {
  lines: string[];
  recommendedActions: string[];
};

/**
 * Human-readable report for operators (read-only; no DB writes).
 * Uses the same date logic as `analyzeMarketDataAlignment`.
 */
export function buildMarketDataFreshnessReport(
  snapshot: MarketSessionSnapshot,
  alignment: MarketDataAlignmentAnalysis
): MarketDataFreshnessReport {
  const lines: string[] = [];
  lines.push("=== Market data freshness (read-only) ===");
  lines.push(`VNINDEX latest EOD in DB (UTC): ${alignment.benchmarkDay ?? "— (no rows)"}`);
  lines.push(`Latest stock_daily_bars.date (UTC): ${alignment.equityDay ?? "—"}`);
  lines.push(`Latest daily_scan_run.runAt (UTC day): ${alignment.scanRunDay ?? "—"}`);
  lines.push(`Benchmark stale vs equity max: ${isBenchmarkStaleVsEquity(snapshot.benchmarkSessionDate, snapshot.latestEquityBarSessionDate) ? "yes" : "no"}`);
  lines.push(`Alignment issues: ${alignment.issues.length ? alignment.issues.join(", ") : "none"}`);

  const recommendedActions: string[] = [];
  if (alignment.issues.includes("benchmark_missing")) {
    recommendedActions.push(
      "Run `npm run data:vnindex` (or `npm run fetch:vnindex` then `npm run import:bars`) to load VNINDEX IndexDailyBar rows."
    );
  }
  if (alignment.issues.includes("benchmark_behind_equity")) {
    recommendedActions.push(
      "Refresh VNINDEX before trusting Gate 1 / benchmark session: equity bars in DB are newer than the index session date."
    );
  }
  if (alignment.issues.includes("scan_runtime_after_benchmark_session")) {
    recommendedActions.push(
      "Scan wall-clock is after the stored VNINDEX session — backdrop may be delayed until index import is current."
    );
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("No mandatory action — dates are aligned within current rules.");
  }

  return { lines, recommendedActions };
}
