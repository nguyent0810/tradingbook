import type { PrismaClient } from "@/generated/prisma/client";
import type { MarketDataAlignmentAnalysis } from "@/lib/market/market-data-alignment";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import {
  fetchMarketSessionSnapshot,
  type MarketSessionSnapshot,
} from "@/lib/market/market-session-snapshot";
import { isBenchmarkStaleVsEquity } from "@/lib/market/market-data-freshness-report";
import type { ScanSessionCoverage } from "@/lib/scanner/scan-session-coverage";

export type MarketFreshnessStaleSeverity = "info" | "warning" | "error";

export type MarketFreshnessStaleFlag = {
  code: string;
  severity: MarketFreshnessStaleSeverity;
  message: string;
};

/** Normalized market freshness contract for Dashboard / Setups / Trades (P1 foundation). */
export type MarketFreshnessDto = {
  /** VNINDEX latest EOD session (UTC calendar day `YYYY-MM-DD`). */
  benchmarkDate: string | null;
  /** Max `stock_daily_bars.date` in DB (UTC calendar day). */
  equityMaxDate: string | null;
  /** Latest `daily_scan_runs.runAt` ISO timestamp, or null when no runs. */
  scanRunAt: string | null;
  /** True when benchmark is behind equity and/or scan notes flagged delayed backdrop. */
  delayedBackdrop: boolean;
  staleFlags: MarketFreshnessStaleFlag[];
  /** From latest scan `notes.sessionCoverage` when available. */
  scanSessionCoverage: ScanSessionCoverage | null;
};

function isoDayUtc(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function staleFlagsFromAlignment(
  alignment: MarketDataAlignmentAnalysis
): MarketFreshnessStaleFlag[] {
  const flags: MarketFreshnessStaleFlag[] = [];
  for (const issue of alignment.issues) {
    switch (issue) {
      case "benchmark_missing":
        flags.push({
          code: issue,
          severity: "error",
          message:
            "VNINDEX benchmark EOD is not available — import index daily bars before trusting Gate 1.",
        });
        break;
      case "benchmark_behind_equity":
        flags.push({
          code: issue,
          severity: "warning",
          message:
            "Latest equity bar session in DB is newer than the stored VNINDEX session date.",
        });
        break;
      case "scan_runtime_after_benchmark_session":
        flags.push({
          code: issue,
          severity: "warning",
          message:
            "Last scan completed after the stored VNINDEX session — market backdrop may be delayed.",
        });
        break;
      default:
        flags.push({
          code: issue,
          severity: "info",
          message: `Market alignment issue: ${issue}`,
        });
    }
  }
  return flags;
}

function staleFlagsFromScanSessionCoverage(
  coverage: ScanSessionCoverage | null | undefined
): MarketFreshnessStaleFlag[] {
  if (!coverage?.weakCoverage) return [];
  return [
    {
      code: "scan_weak_session_coverage",
      severity: "warning",
      message:
        coverage.operatorWarning ??
        "Data coverage is weak for the expected session. Scanner result may be incomplete because many symbols are stale.",
    },
  ];
}

/**
 * Builds the canonical freshness DTO from an existing snapshot + alignment analysis.
 * Preserves `analyzeMarketDataAlignment` / `isBenchmarkStaleVsEquity` semantics.
 */
export function buildMarketFreshnessDto(params: {
  snapshot: MarketSessionSnapshot;
  alignment?: MarketDataAlignmentAnalysis;
  /** When set (from latest scan `notes.benchmarkBackdrop.delayedBackdrop`), OR-combined with alignment stale signals. */
  delayedBackdropFromScanNotes?: boolean;
  /** When set (from latest scan `notes.sessionCoverage`), adds weak-coverage warning flags. */
  scanSessionCoverage?: ScanSessionCoverage | null;
}): MarketFreshnessDto {
  const alignment =
    params.alignment ?? analyzeMarketDataAlignment(params.snapshot);

  const equityStale = isBenchmarkStaleVsEquity(
    params.snapshot.benchmarkSessionDate,
    params.snapshot.latestEquityBarSessionDate
  );

  const delayedFromAlignment =
    alignment.issues.includes("benchmark_behind_equity") ||
    alignment.issues.includes("scan_runtime_after_benchmark_session");

  const delayedBackdrop =
    params.delayedBackdropFromScanNotes === true ||
    equityStale ||
    delayedFromAlignment;

  const scanSessionCoverage = params.scanSessionCoverage ?? null;
  const alignmentFlags = staleFlagsFromAlignment(alignment);
  const coverageFlags = staleFlagsFromScanSessionCoverage(scanSessionCoverage);
  const staleFlags = [...alignmentFlags, ...coverageFlags];

  return {
    benchmarkDate: alignment.benchmarkDay ?? isoDayUtc(params.snapshot.benchmarkSessionDate),
    equityMaxDate: alignment.equityDay ?? isoDayUtc(params.snapshot.latestEquityBarSessionDate),
    scanRunAt: params.snapshot.latestScanRunAt?.toISOString() ?? null,
    delayedBackdrop,
    staleFlags,
    scanSessionCoverage,
  };
}

/** Loads snapshot from DB and returns the normalized freshness DTO (read-only). */
export async function fetchMarketFreshnessDto(
  prisma: PrismaClient,
  options?: {
    delayedBackdropFromScanNotes?: boolean;
    scanSessionCoverage?: ScanSessionCoverage | null;
  }
): Promise<MarketFreshnessDto> {
  const snapshot = await fetchMarketSessionSnapshot(prisma);
  return buildMarketFreshnessDto({
    snapshot,
    delayedBackdropFromScanNotes: options?.delayedBackdropFromScanNotes,
    scanSessionCoverage: options?.scanSessionCoverage,
  });
}
