/**
 * Read-only bar import + scan monitoring snapshot (JSON for GHA / ops).
 *
 *   npx tsx scripts/verify-bar-import-health.ts
 *   npx tsx scripts/verify-bar-import-health.ts --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { isSmokeDailyScanRunNotes } from "../src/lib/scanner/production-smoke-markers";

function isoDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseBenchmarkBackdrop(notes: unknown): {
  delayedBackdrop: boolean | null;
  vnindexSessionDate: string | null;
  equityBarsMaxDate: string | null;
} {
  if (notes == null || typeof notes !== "object" || Array.isArray(notes)) {
    return {
      delayedBackdrop: null,
      vnindexSessionDate: null,
      equityBarsMaxDate: null,
    };
  }
  const backdrop = (notes as Record<string, unknown>).benchmarkBackdrop;
  if (backdrop == null || typeof backdrop !== "object" || Array.isArray(backdrop)) {
    return {
      delayedBackdrop: null,
      vnindexSessionDate: null,
      equityBarsMaxDate: null,
    };
  }
  const b = backdrop as Record<string, unknown>;
  return {
    delayedBackdrop:
      typeof b.delayedBackdrop === "boolean" ? b.delayedBackdrop : null,
    vnindexSessionDate:
      typeof b.vnindexSessionDate === "string" ? b.vnindexSessionDate : null,
    equityBarsMaxDate:
      typeof b.equityBarsMaxDate === "string" ? b.equityBarsMaxDate : null,
  };
}

async function fetchLatestNonSmokeScan() {
  const recent = await prisma.dailyScanRun.findMany({
    orderBy: { runAt: "desc" },
    take: 15,
    select: {
      id: true,
      runAt: true,
      finishedAt: true,
      status: true,
      candidateCountSurfaced: true,
      setupCandidatesCreated: true,
      notes: true,
    },
  });
  return recent.find((r) => !isSmokeDailyScanRunNotes(r.notes)) ?? null;
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");

  const [vnindexLatest, equityMax, expected, activeCount, latestScan] =
    await Promise.all([
      prisma.indexDailyBar.findFirst({
        where: { symbol: "VNINDEX" },
        orderBy: { date: "desc" },
        select: { date: true, close: true },
      }),
      prisma.stockDailyBar.aggregate({ _max: { date: true } }),
      getExpectedLatestSessionFromIndexBars(prisma),
      prisma.stockSymbol.count({ where: { active: true } }),
      fetchLatestNonSmokeScan(),
    ]);

  const backdrop = latestScan
    ? parseBenchmarkBackdrop(latestScan.notes)
    : {
        delayedBackdrop: null,
        vnindexSessionDate: null,
        equityBarsMaxDate: null,
      };

  const expectedDay = expected ? isoDayUtc(expected) : null;
  const vnindexDay = vnindexLatest ? isoDayUtc(vnindexLatest.date) : null;
  const equityDay = equityMax._max.date ? isoDayUtc(equityMax._max.date) : null;

  const out = {
    generatedAt: new Date().toISOString(),
    databaseUrlHint: describeDatabaseUrl(),
    expectedLatestSessionDay: expectedDay,
    latestVnindexBarDay: vnindexDay,
    latestVnindexClose: vnindexLatest?.close ?? null,
    latestEquityBarDay: equityDay,
    activeSymbolsCount: activeCount,
    latestNonSmokeScan: latestScan
      ? {
          id: latestScan.id,
          runAt: latestScan.runAt.toISOString(),
          finishedAt: latestScan.finishedAt?.toISOString() ?? null,
          status: latestScan.status,
          candidateCountSurfaced: latestScan.candidateCountSurfaced,
          setupCandidatesCreated: latestScan.setupCandidatesCreated,
          ...backdrop,
        }
      : null,
    checks: {
      hasVnindexSession: expected != null,
      equityAlignedWithExpected:
        expectedDay != null &&
        equityDay != null &&
        equityDay >= expectedDay,
      delayedBackdropFalse: backdrop.delayedBackdrop === false,
      scanCompleted: latestScan?.status === "COMPLETED",
    },
  };

  if (json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log("verify-bar-import-health →", describeDatabaseUrl());
    console.log(JSON.stringify(out, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
