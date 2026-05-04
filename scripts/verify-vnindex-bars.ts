/**
 * One-shot: VNINDEX row count + latest bar.
 * Loads env via `load-env` (`.env` then `.env.local`), matching `next dev` precedence.
 *
 * Usage: npx tsx scripts/verify-vnindex-bars.ts
 */
import { describeDatabaseUrl } from "./load-env";
import { prisma } from "../src/lib/prisma";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";

async function main() {
  console.log("verify-vnindex-bars.ts → DATABASE_URL:", describeDatabaseUrl());
  const symbol = "VNINDEX";
  const count = await prisma.indexDailyBar.count({ where: { symbol } });

  const sqlCountRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM index_daily_bars WHERE symbol = ${symbol}
  `;
  const sqlTop3 = await prisma.$queryRaw<
    { symbol: string; date: Date; close: unknown }[]
  >`
    SELECT symbol, date, close
    FROM index_daily_bars
    WHERE symbol = ${symbol}
    ORDER BY date DESC
    LIMIT 3
  `;

  const latest = await prisma.indexDailyBar.findFirst({
    where: { symbol },
    orderBy: { date: "desc" },
    select: { date: true, close: true },
  });
  const regime = await getMarketRegimeFromDb(symbol);
  console.log(
    JSON.stringify(
      {
        vnindexRowCount: count,
        sqlMirrorCount: sqlCountRows[0]?.count?.toString() ?? null,
        sqlTop3Desc: sqlTop3,
        latestBar: latest,
        regime: {
          level: regime.level,
          storedBarsCount: regime.storedBarsCount,
          evaluatedBarsCount: regime.evaluatedBarsCount,
          reasons: regime.reasons,
          checkedAt: regime.checkedAt.toISOString(),
        },
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
  .finally(async () => {
    await prisma.$disconnect();
  });
