import "../load-env";
import { prisma } from "../../src/lib/prisma";
async function withRetry<T>(l: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); } }
  throw last;
}
const q = <T = any>(sql: string) => withRetry("q", () => prisma.$queryRawUnsafe<T[]>(sql));
async function main() {
  console.log("== WHICH RULE FAILS ==");
  for (const [name, cond] of [
    ["open<=0", "open<=0"], ["high<=0", "high<=0"], ["low<=0", "low<=0"], ["close<=0", "close<=0"],
    ["volume<0", "volume<0"], ["high<low", "high<low"],
    ["high<open", "high<open"], ["high<close", "high<close"],
    ["low>open", "low>open"], ["low>close", "low>close"],
  ] as const) {
    const r = await q(`select count(*)::int n, min(date) mn, max(date) mx from stock_daily_bars where ${cond}`);
    if (r[0].n > 0) console.log(`  ${name.padEnd(12)} ${String(r[0].n).padStart(6)}   ${String(r[0].mn).slice(0,10)} .. ${String(r[0].mx).slice(0,10)}`);
    else console.log(`  ${name.padEnd(12)} ${String(0).padStart(6)}`);
  }
  console.log("\n== ARE THEY NEW? invalid rows by year ==");
  const byYear = await q(`select extract(year from date)::int y, count(*)::int n from stock_daily_bars
    where not (high>=open and high>=close and low<=open and low<=close) group by 1 order by 1`);
  console.table(byYear);
  console.log("\n== SAMPLE ==");
  const s = await q(`select s.symbol, b.date, b.open, b.high, b.low, b.close, b.volume from stock_daily_bars b
    join stock_symbols s on s.id=b.symbol_id
    where not (b.high>=b.open and b.high>=b.close and b.low<=b.open and b.low<=b.close)
    order by b.date desc limit 8`);
  console.table(s.map((r:any)=>({symbol:r.symbol,date:String(r.date).slice(0,10),o:r.open,h:r.high,l:r.low,c:r.close,v:r.volume})));
  console.log("\n== magnitude: how far outside the range? ==");
  const mag = await q(`select
      round(max(greatest(open-high, close-high, low-open, low-close))::numeric, 6) worst_abs,
      round(avg(greatest(open-high, close-high, low-open, low-close))::numeric, 8) mean_abs
    from stock_daily_bars where not (high>=open and high>=close and low<=open and low<=close)`);
  console.table(mag);
  console.log("\n== do any affect the last 60 sessions? ==");
  const recent = await q(`select count(*)::int n from stock_daily_bars b
    where b.date >= (select max(date) from stock_daily_bars) - interval '90 days'
      and not (b.high>=b.open and b.high>=b.close and b.low<=b.open and b.low<=b.close)`);
  console.log(`  invalid rows in last 90 days: ${recent[0].n}`);
  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
