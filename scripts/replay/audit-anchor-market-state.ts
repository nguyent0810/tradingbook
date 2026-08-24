/**
 * Post-backfill diagnostic §2 — reconstruct the market state on the anchor
 * session WITHOUT consulting D0-D5. Read-only.
 *
 *   npx tsx scripts/replay/audit-anchor-market-state.ts --date 2026-08-21
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";

function arg(n: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (h) return h.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
const iso = (d: unknown) => new Date(d as string).toISOString().slice(0, 10);
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };

async function main(): Promise<void> {
  const T = arg("date") ?? "2026-08-21";
  console.log(`ANCHOR SESSION ${T}\n`);

  // ---------------------------------------------------------------- index
  const idx = (await wr(() =>
    prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }),
  )) as Bar[];
  const ti = idx.findIndex((b) => iso(b.date) === T);
  if (ti < 1) throw new Error(`index bar for ${T} not found`);
  const b = idx[ti]!;
  const prev = idx[ti - 1]!;
  const idxVol20 = mean(idx.slice(ti - 20, ti).map((x) => x.volume));
  const ma20 = mean(idx.slice(ti - 19, ti + 1).map((x) => x.close));
  const ma50 = mean(idx.slice(ti - 49, ti + 1).map((x) => x.close));
  console.log("== INDEX ==");
  console.log(`  return            ${pct(b.close / prev.close - 1)}   ${prev.close.toFixed(2)} to ${b.close.toFixed(2)}`);
  console.log(`  intraday range    ${pct((b.high - b.low) / prev.close)}   H ${b.high.toFixed(2)} L ${b.low.toFixed(2)}`);
  console.log(`  close location    ${pct((b.close - b.low) / (b.high - b.low))} of range`);
  console.log(`  volume            ${(b.volume / 1e6).toFixed(1)}M   vs MA20 ${(b.volume / idxVol20).toFixed(2)}x`);
  console.log(`  close vs MA20/50  ${b.close > ma20 ? "ABOVE" : "below"} MA20 ${ma20.toFixed(1)} / ${b.close > ma50 ? "ABOVE" : "below"} MA50 ${ma50.toFixed(1)}`);
  console.log(`  MA20 vs MA50      ${ma20 > ma50 ? "MA20 > MA50" : "MA20 <= MA50"}`);

  // ------------------------------------------------------------- equities
  const syms = await wr(() =>
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true, exchange: true } }),
  );
  const bars = new Map<string, Bar[]>();
  const exch = new Map<string, string | null>();
  let loaded = 0;
  for (const s of syms) {
    const rows = (await wr(() =>
      prisma.stockDailyBar.findMany({
        where: { symbolId: s.id, date: { lte: new Date(T) } },
        orderBy: { date: "asc" },
        select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      }),
    )) as Bar[];
    if (rows.length) {
      bars.set(s.symbol, rows);
      exch.set(s.symbol, s.exchange);
    }
    if (++loaded % 60 === 0) console.error(`  loaded ${loaded}/${syms.length}`);
  }

  // -------------------------------- limit band inference, then validation
  const BANDS = [0.07, 0.1, 0.15];
  const band = new Map<string, number>();
  for (const [sym, rows] of bars) {
    const hist = rows.filter((r) => iso(r.date) < T); // strictly before T: no look-ahead
    if (hist.length < 60) continue;
    const rets: number[] = [];
    for (let i = 1; i < hist.length; i++) {
      if (hist[i - 1]!.close > 0) rets.push(hist[i]!.close / hist[i - 1]!.close - 1);
    }
    if (rets.length < 60) continue;
    const p995 = qt(rets, 0.995);
    band.set(sym, BANDS.reduce((best, x) => (Math.abs(x - p995) < Math.abs(best - p995) ? x : best), BANDS[0]!));
  }
  console.log("\n== LIMIT-BAND INFERENCE, validated on known exchanges ==");
  const EXPECT: Record<string, number> = { HOSE: 0.07, HNX: 0.1, UPCOM: 0.15 };
  let ok = 0;
  let tot = 0;
  const conf = new Map<string, number>();
  for (const [sym, ex] of exch) {
    if (!ex || !(ex in EXPECT) || !band.has(sym)) continue;
    tot++;
    const k = `${ex} inferred ${(100 * band.get(sym)!).toFixed(0)}%`;
    conf.set(k, (conf.get(k) ?? 0) + 1);
    if (Math.abs(band.get(sym)! - EXPECT[ex]!) < 1e-9) ok++;
  }
  for (const [k, v] of [...conf.entries()].sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`  recovered ${ok}/${tot} = ${tot ? pct(ok / tot) : "n/a"}`);
  const bandOk = tot > 0 && ok / tot >= 0.8;
  console.log(`  ${bandOk ? "USABLE" : "*** UNRELIABLE - limit statistics flagged below ***"}`);

  // -------------------------------------------------------------- breadth
  type Row = {
    sym: string; ret: number; vol: number; volMa20: number; close: number;
    ma20: number | null; ma50: number | null; value: number; limitUp: boolean; limitDown: boolean;
  };
  const rows: Row[] = [];
  for (const [sym, rs] of bars) {
    const i = rs.findIndex((r) => iso(r.date) === T);
    if (i < 1) continue;
    const cur = rs[i]!;
    const pr = rs[i - 1]!;
    if (!(pr.close > 0)) continue;
    const ret = cur.close / pr.close - 1;
    const bd = band.get(sym);
    rows.push({
      sym,
      ret,
      vol: cur.volume,
      volMa20: i >= 20 ? mean(rs.slice(i - 20, i).map((x) => x.volume)) : NaN,
      close: cur.close,
      ma20: i >= 19 ? mean(rs.slice(i - 19, i + 1).map((x) => x.close)) : null,
      ma50: i >= 49 ? mean(rs.slice(i - 49, i + 1).map((x) => x.close)) : null,
      value: cur.close * 1000 * cur.volume,
      limitUp: bd != null && ret >= bd - 0.005,
      limitDown: bd != null && ret <= -bd + 0.005,
    });
  }
  const N = rows.length;
  const adv = rows.filter((r) => r.ret > 0);
  const dec = rows.filter((r) => r.ret < 0);
  const unch = rows.filter((r) => r.ret === 0);
  console.log(`\n== BREADTH   denominator = ${N} symbols with a bar on ${T} AND a prior bar ==`);
  console.log(`  advancing        ${adv.length}  ${pct(adv.length / N)}`);
  console.log(`  declining        ${dec.length}  ${pct(dec.length / N)}`);
  console.log(`  unchanged        ${unch.length}  ${pct(unch.length / N)}`);
  console.log(`  A/D ratio        ${(adv.length / Math.max(1, dec.length)).toFixed(2)}`);
  const lu = rows.filter((r) => r.limitUp).length;
  const ld = rows.filter((r) => r.limitDown).length;
  const flag = bandOk ? "" : "   (UNRELIABLE)";
  console.log(`  limit-up         ${lu}  ${pct(lu / N)}${flag}`);
  console.log(`  limit-down       ${ld}  ${pct(ld / N)}${flag}`);
  const w20 = rows.filter((r) => r.ma20 != null);
  const w50 = rows.filter((r) => r.ma50 != null);
  console.log(`  above own MA20   ${w20.filter((r) => r.close >= r.ma20!).length}/${w20.length}  ${pct(w20.filter((r) => r.close >= r.ma20!).length / w20.length)}`);
  console.log(`  above own MA50   ${w50.filter((r) => r.close >= r.ma50!).length}/${w50.length}  ${pct(w50.filter((r) => r.close >= r.ma50!).length / w50.length)}`);

  console.log("\n== PARTICIPATION / VOLUME ==");
  const av = adv.reduce((a, r) => a + r.vol, 0);
  const dv = dec.reduce((a, r) => a + r.vol, 0);
  console.log(`  advancing volume ${(av / 1e6).toFixed(1)}M   declining ${(dv / 1e6).toFixed(1)}M   adv share ${pct(av / (av + dv))}`);
  const wv = rows.filter((r) => Number.isFinite(r.volMa20) && r.volMa20 > 0);
  const ratios = wv.map((r) => r.vol / r.volMa20);
  console.log(`  vol > own MA20   ${ratios.filter((x) => x > 1).length}/${wv.length}  ${pct(ratios.filter((x) => x > 1).length / wv.length)}`);
  console.log(`  vol > 1.5x MA20  ${ratios.filter((x) => x > 1.5).length}/${wv.length}  ${pct(ratios.filter((x) => x > 1.5).length / wv.length)}`);
  console.log(`  median vol ratio ${qt(ratios, 0.5).toFixed(2)}x   p25 ${qt(ratios, 0.25).toFixed(2)}  p75 ${qt(ratios, 0.75).toFixed(2)}`);

  console.log("\n== CONCENTRATION ==");
  const byValue = [...rows].sort((x, y) => y.value - x.value);
  const totVal = rows.reduce((a, r) => a + r.value, 0);
  for (const k of [5, 10, 20]) {
    const top = byValue.slice(0, k);
    console.log(
      `  top ${String(k).padStart(2)} by traded value: ${pct(top.reduce((a, r) => a + r.value, 0) / totVal)} of value, ` +
        `${top.filter((r) => r.ret > 0).length}/${k} advancing, median ret ${pct(qt(top.map((r) => r.ret), 0.5))}`,
    );
  }
  const allRets = rows.map((r) => r.ret);
  console.log(`  cross-section    p10 ${pct(qt(allRets, 0.1))}  median ${pct(qt(allRets, 0.5))}  p90 ${pct(qt(allRets, 0.9))}`);
  console.log(`  equal-weight mean ${pct(mean(allRets))}   vs index ${pct(b.close / prev.close - 1)}`);

  console.log("\n== HOW UNUSUAL? percentile across every session since 2015 ==");
  const byDate = new Map<string, number[]>();
  for (const [, rs] of bars) {
    for (let i = 1; i < rs.length; i++) {
      const d = iso(rs[i]!.date);
      if (d < "2015-01-01") continue;
      const pc = rs[i - 1]!.close;
      if (!(pc > 0)) continue;
      const a = byDate.get(d) ?? [];
      a.push(rs[i]!.close / pc - 1);
      byDate.set(d, a);
    }
  }
  const advShare: { d: string; s: number; n: number }[] = [];
  for (const [d, rr] of byDate) {
    if (rr.length < 50) continue;
    advShare.push({ d, s: rr.filter((x) => x > 0).length / rr.length, n: rr.length });
  }
  advShare.sort((x, y) => x.s - y.s);
  const rank = advShare.findIndex((x) => x.d === T);
  console.log(`  sessions measured ${advShare.length}`);
  console.log(`  advancing share on ${T} = ${pct(adv.length / N)}  ->  percentile ${pct(rank / advShare.length)}`);
  console.log(`  strongest 8 ever: ${advShare.slice(-8).map((x) => `${x.d} ${(100 * x.s).toFixed(0)}%`).join(" | ")}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
