/**
 * READ-ONLY: §0 — how much smaller was the market before 2015?
 *
 * The tradability floor is a fixed nominal 2,000,000,000 VND of 20-session
 * average traded value. Whether that floor is portable backwards depends on how
 * much market-wide activity has grown, which the per-symbol table cannot answer
 * because this database only holds a curated slice of early years. The index
 * series does answer it: its volume is market-wide matched volume, present for
 * every session since 2010.
 *
 *   npx tsx scripts/replay/audit-oos-market-scale.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.error(`  ${label}: attempt ${i + 1} failed, retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function main(): Promise<void> {
  console.error(`audit-oos-market-scale → ${describeDatabaseUrl()} (read-only)`);

  const rows = await withRetry("index-volume", () =>
    prisma.$queryRawUnsafe<any[]>(
      `select extract(year from date)::int as y, count(*)::int as sessions,
              round(avg(volume))::bigint as avg_daily_shares,
              round(avg(close))::int as avg_close
       from index_daily_bars where symbol = 'VNINDEX' group by 1 order by 1`,
    ),
  );

  const base = rows.find((r) => r.y === 2021);
  console.log("\nVNINDEX MARKET-WIDE ACTIVITY BY YEAR");
  console.log("year  sessions   avgDailyMatchedShares   vs2021   avgIndexClose");
  for (const r of rows) {
    const ratio = base ? Number(r.avg_daily_shares) / Number(base.avg_daily_shares) : NaN;
    console.log(
      `${r.y}  ${String(r.sessions).padStart(8)}   ${Number(r.avg_daily_shares).toLocaleString().padStart(21)}   ${(100 * ratio).toFixed(1).padStart(5)}%   ${String(r.avg_close).padStart(13)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
