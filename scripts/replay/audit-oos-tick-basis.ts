/**
 * READ-ONLY: §0/§5 probe — has the quoted tick grid changed over the history?
 *
 * `src/lib/scanner/stop-feasibility.ts` applies one HOSE tick table (10/50/100
 * VND) to every session in the replay. If the exchange actually quoted a coarser
 * grid in earlier years, that table is wrong for those years and the executable
 * stop floor is too permissive there. This measures the grid from the bars
 * themselves rather than assuming it: for each year it reports what fraction of
 * closes land on a 10 / 50 / 100 / 500 / 1000 VND multiple.
 *
 *   npx tsx scripts/replay/audit-oos-tick-basis.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";

const GRIDS = [10, 50, 100, 500, 1000];

/** Neon's pooler drops idle connections; every prior replay script retries the same way. */
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
  console.error(`audit-oos-tick-basis → ${describeDatabaseUrl()} (read-only)`);

  // close is stored in kVND; ×1000 gives nominal VND. Aggregate in SQL — pulling
  // 700k rows to count divisibility in JS is a pointless allocation.
  const cols = GRIDS.map(
    (g) =>
      `sum(case when mod(round(close * 1000)::bigint, ${g}) = 0 then 1 else 0 end)::int as g${g}`,
  ).join(", ");

  const rows = await withRetry("tick-grid", () =>
    prisma.$queryRawUnsafe<any[]>(
      `select extract(year from date)::int as y, count(*)::int as n, ${cols}
       from stock_daily_bars where close > 0 group by 1 order by 1`,
    ),
  );

  console.log("\nSHARE OF CLOSES LANDING ON EACH VND GRID (stock_daily_bars)");
  console.log("year        n" + GRIDS.map((g) => `%${g}`.padStart(9)).join(""));
  for (const r of rows) {
    const cells = GRIDS.map((g) => `${((100 * r[`g${g}`]) / r.n).toFixed(1)}%`.padStart(9));
    console.log(`${r.y}  ${String(r.n).padStart(7)}${cells.join("")}`);
  }

  // Same question for the index is meaningless (an index is not quoted on a grid),
  // so it is deliberately not asked here.
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
