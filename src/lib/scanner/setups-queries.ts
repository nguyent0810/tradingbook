import type { Gate1ScanLevel, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isSmokeSetupCandidateRow } from "@/lib/scanner/production-smoke-markers";
import { findLatestNonSmokeScanRunId } from "@/lib/scanner/latest-scan-run";

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
  // Tìm id lần quét thật bằng truy vấn metadata (không join ứng viên), rồi mới
  // nạp đầy đủ đúng lần quét đó — tránh join ứng viên cho hàng chục lần quét sẽ
  // bị loại. Bộ lọc smoke dùng chung với mọi nơi khác, xem `latest-scan-run.ts`.
  const latestId = await findLatestNonSmokeScanRunId(prisma);
  if (!latestId) return null;

  return prisma.dailyScanRun.findUnique({
    where: { id: latestId },
    include: scanRunInclude,
  });
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
