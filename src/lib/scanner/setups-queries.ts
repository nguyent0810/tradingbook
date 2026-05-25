import type { Gate1ScanLevel, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isSmokeDailyScanRunNotes,
  isSmokeSetupCandidateRow,
} from "@/lib/scanner/production-smoke-markers";

const LATEST_SCAN_LOOKBACK = 30;

const scanRunInclude = {
  candidates: {
    include: { symbol: { select: { symbol: true } } },
    orderBy: [{ rankScore: "desc" }, { symbolId: "asc" }],
  },
} satisfies Prisma.DailyScanRunInclude;

export type LatestScanWithCandidates = Prisma.DailyScanRunGetPayload<{
  include: typeof scanRunInclude;
}>;

async function fetchLatestDailyScanRun(): Promise<LatestScanWithCandidates | null> {
  const recentRuns = await prisma.dailyScanRun.findMany({
    orderBy: { runAt: "desc" },
    take: LATEST_SCAN_LOOKBACK,
    include: scanRunInclude,
  });
  return recentRuns.find((r) => !isSmokeDailyScanRunNotes(r.notes)) ?? null;
}

export async function getLatestDailyScanRun(): Promise<LatestScanWithCandidates | null> {
  return fetchLatestDailyScanRun();
}

export type SetupCandidateRow = LatestScanWithCandidates["candidates"][number] & {
  symbolKey: string;
};

export function toCandidateRows(run: LatestScanWithCandidates | null): SetupCandidateRow[] {
  if (!run) return [];
  return run.candidates
    .filter(
      (c) =>
        !isSmokeSetupCandidateRow({
          symbol: c.symbol.symbol,
          reasons: c.reasons,
        })
    )
    .map((c) => ({
      ...c,
      symbolKey: c.symbol.symbol,
    }));
}

export function gate1Label(level: Gate1ScanLevel): string {
  switch (level) {
    case "PASS":
      return "PASS";
    case "WARNING":
      return "WARNING";
    case "FAIL":
      return "FAIL";
    default:
      return String(level);
  }
}
