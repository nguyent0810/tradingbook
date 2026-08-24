import "../load-env";
import { prisma } from "../../src/lib/prisma";
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> { let e: unknown; for (let i=0;i<t;i++){try{return await fn();}catch(x){e=x;await new Promise(r=>setTimeout(r,1500*(i+1)));}} throw e; }
async function main() {
  const r = await wr(() => prisma.$queryRawUnsafe<any[]>(`select coalesce(exchange,'(null)') ex, count(*)::int n,
    count(*) filter (where exists (select 1 from stock_daily_bars b where b.symbol_id=s.id and b.date='2026-08-21'))::int traded_0821
    from stock_symbols s group by 1 order by 2 desc`));
  console.table(r);
  await prisma.$disconnect();
}
main().catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1);});
