import type { MarketContextHealthReport } from "@/lib/market/market-context-health";
import { isoDayUtc } from "@/lib/market/session-date";

export type { MarketContextHealthReport } from "@/lib/market/market-context-health";

export function formatMarketContextHealthReport(
  report: MarketContextHealthReport,
  asJson: boolean
): string {
  if (asJson) {
    return JSON.stringify(report, null, 2);
  }

  const lines = [
    "=== market-context health ===",
    `sessionDate: ${report.sessionDate ?? "—"}`,
    `expectedSession: ${report.expectedSession ?? "—"}`,
    `sessionAligned: ${report.sessionAligned}`,
    `foreignTradeRows: ${report.foreignTradeDaily.rowCount}`,
    `foreignOkRows: ${report.foreignTradeDaily.okCount}`,
    `foreignCoveragePct: ${report.foreignTradeDaily.coveragePct ?? "—"}`,
    `marketContextBuilt: ${report.marketContextDaily.exists}`,
    `symbolsBuilt: ${report.symbolMarketContextDaily.count}`,
    `foreignNetValue1d: ${report.marketContextDaily.foreignNetValue1d ?? "—"}`,
    `foreignNetValue5d: ${report.marketContextDaily.foreignNetValue5d ?? "null (insufficient sessions)"}`,
    `foreignNetValue10d: ${report.marketContextDaily.foreignNetValue10d ?? "null (insufficient sessions)"}`,
    `issues: ${report.issues.length}`,
  ];
  for (const issue of report.issues) {
    lines.push(`  - [${issue.severity}] ${issue.code}: ${issue.message}`);
  }
  return lines.join("\n");
}

export function exitCodeFromHealthReport(report: MarketContextHealthReport): number {
  if (report.issues.some((i) => i.severity === "error")) return 1;
  return 0;
}

export function sessionDateFromReportDay(day: string | null): string | null {
  if (!day) return null;
  return isoDayUtc(new Date(day));
}
