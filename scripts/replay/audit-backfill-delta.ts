import "../load-env";
import { prisma } from "../../src/lib/prisma";
async function withRetry<T>(l: string, fn: () => Promise<T>, tries = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); } }
  throw last;
}
const q = <T = any>(sql: string) => withRetry("q", () => prisma.$queryRawUnsafe<T[]>(sql));
async function main() {
  console.log("== BARS BY SESSION SINCE 2026-08-12 (prior max was 2026-08-13) ==");
  console.table(await q(`select date, count(*)::int bars, count(distinct symbol_id)::int syms,
      min(updated_at) first_written, max(updated_at) last_written
    from stock_daily_bars where date >= '2026-08-12' group by date order by date`));

  console.log("\n== WERE HISTORICAL BARS REVISED? rows written recently but dated long ago ==");
  console.table(await q(`select date_trunc('day', updated_at)::date wrote_on, count(*)::int rows,
      min(date) oldest_bar_touched, max(date) newest_bar_touched
    from stock_daily_bars where updated_at >= now() - interval '30 days'
    group by 1 order by 1 desc limit 15`));

  console.log("\n== VNINDEX new sessions ==");
  console.table((await q(`select date, open, high, low, close, volume from index_daily_bars
    where symbol='VNINDEX' and date >= '2026-08-12' order by date`))
    .map((r:any)=>({date:String(r.date).slice(0,10),o:r.open,h:r.high,l:r.low,c:r.close,vol:Number(r.volume)})));

  console.log("\n== ACTIVE FLAG: does the replay depend on it? symbols with bars vs active ==");
  console.table(await q(`select
      (select count(distinct symbol_id)::int from stock_daily_bars) syms_with_bars,
      (select count(*)::int from stock_symbols where active) active_flag,
      (select count(*)::int from stock_symbols s where s.active and not exists (select 1 from stock_daily_bars b where b.symbol_id=s.id)) active_but_no_bars,
      (select count(distinct b.symbol_id)::int from stock_daily_bars b join stock_symbols s on s.id=b.symbol_id where not s.active) has_bars_but_inactive`));

  console.log("\n== SYMBOLS TRADING ON 2026-08-21 vs universe ==");
  console.table(await q(`select
      (select count(distinct symbol_id)::int from stock_daily_bars where date='2026-08-21') traded_0821,
      (select count(distinct symbol_id)::int from stock_daily_bars where date between '2026-07-21' and '2026-08-21') traded_last_month,
      (select count(distinct symbol_id)::int from stock_daily_bars where date >= '2026-01-01') traded_2026`));
  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
