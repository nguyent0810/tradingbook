import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";

async function withRetry<T>(l: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; console.error(`  ${l}: retry ${i + 1}`); await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  throw last;
}
const q = <T = any>(sql: string) => withRetry(sql.slice(0, 40), () => prisma.$queryRawUnsafe<T[]>(sql));

async function main() {
  console.log(`DB: ${describeDatabaseUrl()}`);

  const idx = await q(`select symbol, count(*)::int n, min(date) mn, max(date) mx from index_daily_bars group by symbol order by symbol`);
  console.log("\n== INDEX BARS =="); console.table(idx);

  const eq = await q(`select count(*)::int bars, count(distinct symbol_id)::int syms, min(date) mn, max(date) mx from stock_daily_bars`);
  console.log("\n== EQUITY BARS =="); console.table(eq);

  const sym = await q(`select count(*)::int total, sum(case when active then 1 else 0 end)::int active from stock_symbols`);
  console.log("\n== SYMBOL REGISTRY =="); console.table(sym);

  console.log("\n== LAST 12 SESSIONS: index vs equity coverage ==");
  const tail = await q(`
    with idx as (select date from index_daily_bars where symbol='VNINDEX' order by date desc limit 12)
    select i.date, (select count(*)::int from stock_daily_bars b where b.date=i.date) eq_bars,
           (select count(distinct b.symbol_id)::int from stock_daily_bars b where b.date=i.date) eq_syms
    from idx i order by i.date desc`);
  console.table(tail);

  console.log("\n== INTEGRITY ==");
  const dup = await q(`select count(*)::int n from (select symbol_id, date from stock_daily_bars group by 1,2 having count(*)>1) t`);
  console.log(`duplicate (symbol_id,date) rows: ${dup[0].n}`);
  const bad = await q(`select count(*)::int n from stock_daily_bars where not (open>0 and high>0 and low>0 and close>0 and volume>=0 and high>=low and high>=open and high>=close and low<=open and low<=close)`);
  console.log(`invalid OHLCV rows: ${bad[0].n}`);
  const dupIdx = await q(`select count(*)::int n from (select symbol,date from index_daily_bars group by 1,2 having count(*)>1) t`);
  console.log(`duplicate index (symbol,date): ${dupIdx[0].n}`);
  const future = await q(`select count(*)::int n from stock_daily_bars where date > current_date`);
  console.log(`bars dated in the future: ${future[0].n}`);

  console.log("\n== EQUITY SESSIONS WITH NO INDEX BAR (calendar mismatch) ==");
  const orphan = await q(`select b.date, count(distinct b.symbol_id)::int syms from stock_daily_bars b
    where not exists (select 1 from index_daily_bars i where i.symbol='VNINDEX' and i.date=b.date)
    group by b.date order by b.date desc limit 10`);
  console.table(orphan.length ? orphan : [{ note: "none" }]);

  console.log("\n== INDEX SESSIONS WITH FEW EQUITY BARS (stale/partial) ==");
  const thin = await q(`select i.date, (select count(*)::int from stock_daily_bars b where b.date=i.date) eq
    from index_daily_bars i where i.symbol='VNINDEX' and i.date >= '2026-06-01'
    order by i.date desc`);
  console.table(thin.slice(0, 20));

  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
