/**
 * Post-backfill diagnostic §6 — per-session breadth and participation for EVERY
 * session, so regime cohorts can be defined by a rule applied to all dates
 * rather than by picking examples.
 *
 * Read-only. Writes docs/trading/replay/postbackfill/breadth.ndjson.
 *
 *   npx tsx scripts/replay/audit-session-breadth.ts
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";

async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

type Bar = { date: Date; close: number; volume: number };

async function main(): Promise<void> {
  const symRows = await wr(() => prisma.stockSymbol.findMany({ where: { bars: { some: {} } }, select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }));

  // date -> per-symbol observations, accumulated symbol by symbol to bound memory
  const advCount = new Map<string, number>();
  const decCount = new Map<string, number>();
  const total = new Map<string, number>();
  const advVol = new Map<string, number>();
  const decVol = new Map<string, number>();
  const volRatios = new Map<string, number[]>();
  const aboveMa20 = new Map<string, number>();
  const withMa20 = new Map<string, number>();

  const bump = (m: Map<string, number>, k: string, v = 1) => m.set(k, (m.get(k) ?? 0) + v);

  let loaded = 0;
  for (const s of symRows) {
    const bars = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, close: true, volume: true },
    }))) as Bar[];
    if (!bars.length) continue;
    for (let i = 1; i < bars.length; i++) {
      const d = isoDay(bars[i]!.date);
      if (d < "2015-01-01") continue;
      const pc = bars[i - 1]!.close;
      if (!(pc > 0)) continue;
      const ret = bars[i]!.close / pc - 1;
      bump(total, d);
      if (ret > 0) { bump(advCount, d); bump(advVol, d, bars[i]!.volume); }
      else if (ret < 0) { bump(decCount, d); bump(decVol, d, bars[i]!.volume); }
      if (i >= 20) {
        const vm = mean(bars.slice(i - 20, i).map((x) => x.volume));
        if (vm > 0) {
          const a = volRatios.get(d) ?? [];
          a.push(bars[i]!.volume / vm);
          volRatios.set(d, a);
        }
        const m20 = mean(bars.slice(i - 19, i + 1).map((x) => x.close));
        bump(withMa20, d);
        if (bars[i]!.close >= m20) bump(aboveMa20, d);
      }
    }
    if (++loaded % 60 === 0) console.error(`  loaded ${loaded}/${symRows.length}`);
  }

  const rows = [...total.entries()]
    .filter(([, n]) => n >= 50)
    .map(([d, n]) => {
      const vr = volRatios.get(d) ?? [];
      const av = advVol.get(d) ?? 0;
      const dv = decVol.get(d) ?? 0;
      return {
        session: d,
        n,
        advShare: (advCount.get(d) ?? 0) / n,
        decShare: (decCount.get(d) ?? 0) / n,
        adRatio: (advCount.get(d) ?? 0) / Math.max(1, decCount.get(d) ?? 0),
        advVolShare: av + dv > 0 ? av / (av + dv) : null,
        medVolRatio: vr.length ? qt(vr, 0.5) : null,
        shareVolAboveMa20: vr.length ? vr.filter((x) => x > 1).length / vr.length : null,
        shareAboveMa20: (withMa20.get(d) ?? 0) > 0 ? (aboveMa20.get(d) ?? 0) / (withMa20.get(d) ?? 1) : null,
      };
    })
    .sort((a, b) => a.session.localeCompare(b.session));

  const dir = "docs/trading/replay/postbackfill";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/breadth.ndjson`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`wrote ${dir}/breadth.ndjson (${rows.length} sessions)`);

  const shares = rows.map((r) => r.advShare);
  console.log(`\nadvancing-share deciles across ${rows.length} sessions:`);
  for (const p of [0.1, 0.3, 0.4, 0.7, 0.9]) console.log(`  p${(100 * p).toFixed(0).padStart(2)} ${(100 * qt(shares, p)).toFixed(1)}%`);
  const anchor = rows.find((r) => r.session === "2026-08-21");
  if (anchor) {
    const rank = shares.filter((x) => x < anchor.advShare).length / shares.length;
    console.log(`\n2026-08-21: advShare ${(100 * anchor.advShare).toFixed(1)}% (percentile ${(100 * rank).toFixed(1)}) · advVolShare ${(100 * (anchor.advVolShare ?? 0)).toFixed(1)}% · medVolRatio ${anchor.medVolRatio?.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
