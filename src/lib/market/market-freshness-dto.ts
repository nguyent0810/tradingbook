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

/**
 * Data timing mode — always "eod" today: the entire import → scan pipeline
 * runs once daily, after VN cash-session close (production-bar-import.yml
 * cron: Mon-Fri after ATC), from `StockDailyBar`/`IndexDailyBar` daily bars.
 * There is no intraday/realtime feed anywhere in this app to be "delayed"
 * relative to — "delayed"/"realtime" are placeholders for if one is ever
 * added; do not infer either from the current data without a real source.
 */
export type MarketDataTimingMode = "eod" | "delayed" | "realtime";

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
  /** See `MarketDataTimingMode` — always "eod" in this app today. */
  dataTimingMode: MarketDataTimingMode;
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
            "Chưa có dữ liệu EOD của VNINDEX — hãy nhập dữ liệu chỉ số theo ngày trước khi tin tưởng Gate 1.",
        });
        break;
      case "benchmark_behind_equity":
        flags.push({
          code: issue,
          severity: "warning",
          message:
            "Phiên nến cổ phiếu mới nhất trong DB mới hơn ngày phiên VNINDEX đã lưu.",
        });
        break;
      case "scan_runtime_after_benchmark_session":
        flags.push({
          code: issue,
          severity: "warning",
          message:
            "Lượt quét gần nhất hoàn tất sau phiên VNINDEX đã lưu — bối cảnh thị trường có thể bị trễ.",
        });
        break;
      default:
        flags.push({
          code: issue,
          severity: "info",
          message: `Vấn đề đồng bộ dữ liệu thị trường: ${issue}`,
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
        "Độ phủ dữ liệu cho phiên dự kiến còn yếu. Kết quả quét có thể chưa đầy đủ vì nhiều mã đang có dữ liệu cũ.",
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
    dataTimingMode: "eod",
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
