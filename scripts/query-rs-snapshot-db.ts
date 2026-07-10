import "./load-env";
import { prisma } from "../src/lib/prisma";

async function main() {
  const sessionDate = new Date("2026-06-11T00:00:00.000Z");
  const runCount = await prisma.rsWatchlistSnapshotRun.count({ where: { sessionDate } });
  const rows = await prisma.rsWatchlistSnapshotRow.findMany({
    where: { run: { sessionDate } },
    orderBy: { rankPosition: "asc" },
    take: 10,
  });
  console.log(
    JSON.stringify(
      {
        runCountForSession: runCount,
        top10: rows.map((r) => ({
          symbol: r.symbol,
          rs20: r.rs20SpreadPct,
          rs50: r.rs50SpreadPct,
          rsStrengthScore: r.rsStrengthScore,
          setupReadinessScore: r.setupReadinessScore,
          setupState: r.setupState,
          reason: r.setupReason,
          terminalCode: r.terminalCode,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
