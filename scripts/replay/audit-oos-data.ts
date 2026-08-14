/**
 * READ-ONLY: §0 data availability audit for Phase 12 (true out-of-sample validation).
 *
 * Answers one question and nothing else: does any bar-level data exist that the
 * eleven prior research phases have never touched? It reads coverage only — no
 * setups are scanned, no outcomes are computed.
 *
 *   npx tsx scripts/replay/audit-oos-data.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main(): Promise<void> {
  console.error(`audit-oos-data → ${describeDatabaseUrl()} (read-only)`);

  const overall = await prisma.$queryRawUnsafe<any[]>(
    `select min(date) as mn, max(date) as mx, count(*)::int as bars,
            count(distinct symbol_id)::int as syms
     from stock_daily_bars`,
  );
  console.log("STOCK BARS", overall[0]);

  const idx = await prisma.$queryRawUnsafe<any[]>(
    `select symbol, min(date) as mn, max(date) as mx, count(*)::int as bars
     from index_daily_bars group by symbol order by symbol`,
  );
  console.log("INDEX BARS", idx);

  const byYear = await prisma.$queryRawUnsafe<any[]>(
    `select extract(year from date)::int as y, count(*)::int as bars,
            count(distinct symbol_id)::int as syms
     from stock_daily_bars group by 1 order by 1`,
  );
  console.log("STOCK BARS BY YEAR");
  for (const r of byYear) console.log(`  ${r.y}  bars=${r.bars}  syms=${r.syms}`);

  const idxByYear = await prisma.$queryRawUnsafe<any[]>(
    `select extract(year from date)::int as y, count(*)::int as bars
     from index_daily_bars where symbol = 'VNINDEX' group by 1 order by 1`,
  );
  console.log("VNINDEX BARS BY YEAR");
  for (const r of idxByYear) console.log(`  ${r.y}  bars=${r.bars}`);

  // Distribution of first-bar dates: how many symbols have history starting before
  // the research window, i.e. is there any genuinely earlier data at all.
  const firsts = await prisma.$queryRawUnsafe<any[]>(
    `select extract(year from mn)::int as y, count(*)::int as syms from (
       select symbol_id, min(date) as mn from stock_daily_bars group by symbol_id
     ) t group by 1 order by 1`,
  );
  console.log("SYMBOLS BY FIRST-BAR YEAR");
  for (const r of firsts) console.log(`  ${r.y}  syms=${r.syms}`);

  const lasts = await prisma.$queryRawUnsafe<any[]>(
    `select extract(year from mx)::int as y, count(*)::int as syms from (
       select symbol_id, max(date) as mx from stock_daily_bars group by symbol_id
     ) t group by 1 order by 1`,
  );
  console.log("SYMBOLS BY LAST-BAR YEAR");
  for (const r of lasts) console.log(`  ${r.y}  syms=${r.syms}`);

  const symTotal = await prisma.stockSymbol.count();
  const symWithBars = await prisma.$queryRawUnsafe<any[]>(
    `select count(distinct symbol_id)::int as n from stock_daily_bars`,
  );
  console.log(`SYMBOL REGISTRY total=${symTotal} withBars=${symWithBars[0].n}`);

  const exch = await prisma.$queryRawUnsafe<any[]>(
    `select coalesce(exchange,'(null)') as exchange, count(*)::int as n,
            sum(case when active then 1 else 0 end)::int as active
     from stock_symbols group by 1 order by 2 desc`,
  );
  console.log("EXCHANGES", exch);

  const sources = await prisma.$queryRawUnsafe<any[]>(
    `select source, count(*)::int as bars, min(date) as mn, max(date) as mx
     from stock_daily_bars group by 1 order by 2 desc`,
  );
  console.log("BAR SOURCES", sources);

  const idxSources = await prisma.$queryRawUnsafe<any[]>(
    `select symbol, source, count(*)::int as bars from index_daily_bars group by 1,2 order by 3 desc`,
  );
  console.log("INDEX SOURCES", idxSources);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
