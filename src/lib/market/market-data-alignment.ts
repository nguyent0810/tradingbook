import type { MarketSessionSnapshot } from "@/lib/market/market-session-snapshot";
import { utcCalendarDayMs } from "@/lib/trades/position-health";

export type MarketDataAlignmentIssue =
  | "benchmark_missing"
  | "benchmark_behind_equity"
  | "scan_runtime_after_benchmark_session";

function isoDayUtc(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export type MarketDataAlignmentAnalysis = {
  issues: MarketDataAlignmentIssue[];
  showBanner: boolean;
  benchmarkDay: string | null;
  equityDay: string | null;
  scanRunDay: string | null;
};

/**
 * Operator-facing alignment: benchmark EOD vs broad equity max date vs scan wall clock.
 */
export function analyzeMarketDataAlignment(
  snapshot: MarketSessionSnapshot
): MarketDataAlignmentAnalysis {
  const bench = snapshot.benchmarkSessionDate;
  const equity = snapshot.latestEquityBarSessionDate;
  const scanAt = snapshot.latestScanRunAt;

  const issues: MarketDataAlignmentIssue[] = [];

  if (!bench) {
    issues.push("benchmark_missing");
  }

  if (bench && equity && utcCalendarDayMs(equity) > utcCalendarDayMs(bench)) {
    issues.push("benchmark_behind_equity");
  }

  if (bench && scanAt && utcCalendarDayMs(scanAt) > utcCalendarDayMs(bench)) {
    issues.push("scan_runtime_after_benchmark_session");
  }

  return {
    issues,
    showBanner: issues.length > 0,
    benchmarkDay: isoDayUtc(bench),
    equityDay: isoDayUtc(equity),
    scanRunDay: isoDayUtc(scanAt),
  };
}
