import type { Gate1ScanLevel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

async function fetchLatestDailyScanRun() {
  return prisma.dailyScanRun.findFirst({
    orderBy: { runAt: "desc" },
    include: {
      candidates: {
        include: { symbol: { select: { symbol: true } } },
        orderBy: [{ rankScore: "desc" }, { symbolId: "asc" }],
      },
    },
  });
}

export type LatestScanWithCandidates = NonNullable<
  Awaited<ReturnType<typeof fetchLatestDailyScanRun>>
>;

export async function getLatestDailyScanRun(): Promise<LatestScanWithCandidates | null> {
  return fetchLatestDailyScanRun();
}

export type SetupCandidateRow = LatestScanWithCandidates["candidates"][number] & {
  symbolKey: string;
};

export function toCandidateRows(run: LatestScanWithCandidates | null): SetupCandidateRow[] {
  if (!run) return [];
  return run.candidates.map((c) => ({
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
