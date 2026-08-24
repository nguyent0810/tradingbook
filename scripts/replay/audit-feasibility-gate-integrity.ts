import "../load-env";
import { prisma } from "../../src/lib/prisma";
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) { try { return await fn(); } catch (x) { e = x; await new Promise(r => setTimeout(r, 1500 * (i + 1))); } }
  throw e;
}
const q = <T = any>(sql: string) => wr(() => prisma.$queryRawUnsafe<T[]>(sql));
async function main() {
  console.log("== 8 DATA INTEGRITY, RE-RUN AT GATE TIME ==");
  const dup = await q(`select count(*)::int n from (select symbol_id,date from stock_daily_bars group by 1,2 having count(*)>1) t`);
  const dupI = await q(`select count(*)::int n from (select symbol,date from index_daily_bars group by 1,2 having count(*)>1) t`);
  const fut = await q(`select count(*)::int n from stock_daily_bars where date > current_date`);
  const bad = await q(`select count(*)::int n from stock_daily_bars where not (open>0 and high>0 and low>0 and close>0 and volume>=0 and high>=low)`);
  const policy = await q(`select count(*)::int n from stock_daily_bars where not (high>=open and high>=close and low<=open and low<=close)`);
  const recent = await q(`select count(*)::int n from stock_daily_bars where date >= (select max(date) from stock_daily_bars) - interval '90 days' and not (high>=open and high>=close and low<=open and low<=close)`);
  const settled = await q(`select (select max(date) from index_daily_bars where symbol='VNINDEX') idx, (select max(date) from stock_daily_bars) eq`);
  const orphan = await q(`select count(distinct b.date)::int n from stock_daily_bars b where not exists (select 1 from index_daily_bars i where i.symbol='VNINDEX' and i.date=b.date)`);
  console.log(`  duplicate (symbol_id,date)          ${dup[0].n}`);
  console.log(`  duplicate index (symbol,date)       ${dupI[0].n}`);
  console.log(`  bars dated in the future            ${fut[0].n}`);
  console.log(`  importer usability rule violations  ${bad[0].n}   (positive prices, high>=low)`);
  console.log(`  stricter policy: o/c outside [l,h]  ${policy[0].n}   of which in the last 90 days: ${recent[0].n}`);
  console.log(`  settled session idx / eq            ${String(settled[0].idx).slice(0,10)} / ${String(settled[0].eq).slice(0,10)}`);
  console.log(`  equity sessions with no index bar   ${orphan[0].n}`);
  const ok = dup[0].n===0 && dupI[0].n===0 && fut[0].n===0 && bad[0].n===0 && orphan[0].n===0 && String(settled[0].idx).slice(0,10)===String(settled[0].eq).slice(0,10);
  console.log(`  ${ok ? "PASS - no DATA NO-GO condition" : "*** DATA NO-GO ***"}`);
  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
