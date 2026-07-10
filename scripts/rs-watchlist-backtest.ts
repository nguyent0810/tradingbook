/**
 * Backtest RS watchlist snapshots — forward returns and bucket comparisons.
 *
 * Usage:
 *   npx tsx scripts/rs-watchlist-backtest.ts
 *   npx tsx scripts/rs-watchlist-backtest.ts --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { sortDedupeGate2Bars } from "../src/lib/scanner/gate2/breakout-pullback";
import { computeForwardReturnLabels } from "../src/lib/scanner/gate2/forward-returns";

type BucketStats = {
  count: number;
  medianForward10d: number | null;
  hitPlus5Rate: number | null;
};

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function bucketStats(returns: number[]): BucketStats {
  const valid = returns.filter((r) => Number.isFinite(r));
  return {
    count: valid.length,
    medianForward10d: median(valid),
    hitPlus5Rate:
      valid.length > 0 ? valid.filter((r) => r >= 5).length / valid.length : null,
  };
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");
  console.error(`DB: ${describeDatabaseUrl()}`);

  const runs = await prisma.rsWatchlistSnapshotRun.findMany({
    orderBy: { sessionDate: "desc" },
    take: 30,
    include: { rows: { orderBy: { rankPosition: "asc" } } },
  });

  if (runs.length === 0) {
    console.log(JSON.stringify({ error: "No snapshot runs found." }, null, 2));
    return;
  }

  const enriched: {
    runId: string;
    sessionDate: string;
    tradePermission: string | null;
    rows: {
      symbol: string;
      setupState: string;
      rs20: number;
      rs50: number | null;
      forward10d: number | null;
      maxDrawdown10d: number | null;
    }[];
  }[] = [];

  for (const run of runs) {
    const sessionDate = run.sessionDate;
    const rowOut: (typeof enriched)[number]["rows"] = [];

    for (const row of run.rows) {
      const sym = await prisma.stockSymbol.findUnique({
        where: { symbol: row.symbol },
        select: { id: true },
      });
      let forward10d: number | null = row.forwardReturn10dPct;
      let maxDrawdown10d: number | null = row.maxDrawdown10dPct;

      if (sym && forward10d == null) {
        const bars = await prisma.stockDailyBar.findMany({
          where: { symbolId: sym.id },
          orderBy: { date: "asc" },
          select: {
            date: true,
            open: true,
            high: true,
            low: true,
            close: true,
            volume: true,
          },
        });
        const labels = computeForwardReturnLabels(
          sortDedupeGate2Bars(bars),
          sessionDate
        );
        forward10d = labels?.forwardReturnPct[10] ?? null;
        maxDrawdown10d = labels?.maxAdverseExcursion20Pct ?? null;

        if (forward10d != null || maxDrawdown10d != null) {
          await prisma.rsWatchlistSnapshotRow.update({
            where: { id: row.id },
            data: {
              forwardReturn10dPct: forward10d,
              maxDrawdown10dPct: maxDrawdown10d,
            },
          });
        }
      }

      rowOut.push({
        symbol: row.symbol,
        setupState: row.setupState,
        rs20: row.rs20SpreadPct,
        rs50: row.rs50SpreadPct,
        forward10d,
        maxDrawdown10d,
      });
    }

    enriched.push({
      runId: run.id,
      sessionDate: sessionDate.toISOString().slice(0, 10),
      tradePermission: run.tradePermission,
      rows: rowOut,
    });
  }

  const allRows = enriched.flatMap((r) => r.rows);
  const watchReturns = allRows
    .filter((r) => r.setupState.startsWith("Watch"))
    .map((r) => r.forward10d)
    .filter((v): v is number => v != null);
  const blockedReturns = allRows
    .filter((r) => r.setupState.startsWith("Blocked"))
    .map((r) => r.forward10d)
    .filter((v): v is number => v != null);
  const rsDisagree = allRows
    .filter((r) => r.rs20 > 5 && r.rs50 != null && r.rs50 < 0)
    .map((r) => r.forward10d)
    .filter((v): v is number => v != null);
  const rsAgree = allRows
    .filter((r) => r.rs20 > 5 && r.rs50 != null && r.rs50 > 0)
    .map((r) => r.forward10d)
    .filter((v): v is number => v != null);

  const report = {
    snapshotRuns: enriched.length,
    totalRows: allRows.length,
    buckets: {
      watch: bucketStats(watchReturns),
      blocked: bucketStats(blockedReturns),
      positiveRs20_negativeRs50: bucketStats(rsDisagree),
      positiveRs20_positiveRs50: bucketStats(rsAgree),
    },
    runs: asJson ? enriched : undefined,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
