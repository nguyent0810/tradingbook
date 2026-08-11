/** READ-ONLY: dump the individual trades behind the biggest R contributors. */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { runReplay, type SymbolSeries } from "../../src/lib/replay/replay-engine";
import type { TradeBar } from "../../src/lib/replay/trade-model";

async function main(): Promise<void> {
  const wanted = (process.argv[2] ?? "REE").split(",").map((s) => s.trim().toUpperCase());
  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: wanted } },
    select: { id: true, symbol: true },
  });
  const indexBars = (await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    orderBy: { date: "asc" },
  })) as TradeBar[];

  const series: SymbolSeries[] = [];
  for (const r of rows) {
    const bars = (await prisma.stockDailyBar.findMany({
      where: { symbolId: r.id },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    })) as TradeBar[];
    series.push({ symbolId: r.id, symbol: r.symbol, bars });
  }

  const res = runReplay({ series, indexBars, tactical: [], options: { progressEvery: 100000 } });
  const scored = res.signals.filter((s) => s.trade).sort((a, b) => b.trade!.rMultiple - a.trade!.rMultiple);
  console.log(`signals=${res.signals.length} guardViolations=${res.guardViolations}`);
  console.log("symbol  session     entry    stop   risk%   exit    R       reason      held");
  for (const s of scored.slice(0, 12)) {
    const t = s.trade!;
    const riskPct = ((t.entryPrice - t.stopPrice) / t.entryPrice) * 100;
    console.log(
      `${s.symbol.padEnd(6)} ${s.sessionDate} ${t.entryPrice.toFixed(2).padStart(8)} ${t.stopPrice
        .toFixed(2)
        .padStart(7)} ${riskPct.toFixed(2).padStart(6)}% ${t.exitPrice.toFixed(2).padStart(7)} ${t.rMultiple
        .toFixed(1)
        .padStart(7)} ${t.exitReason.padEnd(11)} ${t.sessionsHeld}`
    );
  }
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
