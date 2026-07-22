import type { DailyScanGate2Notes } from "@/lib/scanner/gate2-scan-diagnostics";
import type { Gate2CategoryBreakdownRow } from "@/lib/scanner/setups-gate2-breakdown";
import {
  rejectionBucketLabel,
  rejectionBucketTraderGuide,
} from "@/lib/scanner/setups-trader-copy";
import type { SetupsRejectionAccordionItem } from "@/components/setups-rejection-accordion";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import { formatScannerReasonForUser } from "@/lib/dashboard/v3-user-copy";

export function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtRunDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function reasonsToStrings(reasons: unknown): string[] {
  return parseSetupCandidateReasons(reasons).lines.map((line) =>
    formatScannerReasonForUser(line)
  );
}

export function humanizeDisplayLine(line: string): string {
  return formatScannerReasonForUser(line);
}

export function rankComponentsFromReasons(reasons: unknown) {
  return parseSetupCandidateReasons(reasons).rankComponents;
}

export type SetupPerfHint = {
  tradeCount: number;
  winRatePct: number;
  avgR: number | null;
};

export function fmtSetupPerfHint(
  tier: "A" | "B",
  perf: SetupPerfHint | null
): string {
  if (!perf || perf.tradeCount < 10) return `Hạng ${tier} · Chưa đủ dữ liệu`;
  const avgR = perf.avgR ?? 0;
  const avgRLabel = `${avgR >= 0 ? "+" : ""}${avgR.toFixed(1)}R`;
  return `Hạng ${tier} · ${perf.winRatePct.toFixed(0)}% thắng · ${avgRLabel} (n=${perf.tradeCount})`;
}

export function dominantCategoryFromNotes(
  top: Record<string, number> | undefined
): string | null {
  if (!top || Object.keys(top).length === 0) return null;
  const sorted = Object.entries(top).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

export function buildDiagnosticsAccordionItems(
  breakdown: Gate2CategoryBreakdownRow[],
  notes: DailyScanGate2Notes | null
): SetupsRejectionAccordionItem[] {
  const notesSym = notes?.rejectionSymbolsByCategory;
  const notesTop = notes?.topRejectionCategories;

  if (breakdown.length > 0) {
    return breakdown.map((row) => {
      const key = String(row.categoryKey);
      const guide = rejectionBucketTraderGuide(key);
      const symbols = row.symbols.length > 0 ? row.symbols : (notesSym?.[key] ?? []);
      return {
        categoryKey: key,
        label: row.label,
        count: row.count,
        symbols,
        meaning: guide.meaning,
        waitFor: guide.waitFor,
      };
    });
  }

  if (!notesTop || Object.keys(notesTop).length === 0) return [];

  return Object.entries(notesTop)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const guide = rejectionBucketTraderGuide(cat);
      return {
        categoryKey: cat,
        label: rejectionBucketLabel(cat),
        count,
        symbols: notesSym?.[cat] ?? [],
        meaning: guide.meaning,
        waitFor: guide.waitFor,
      };
    });
}
