/**
 * Pre-tests the strongest anticipated attacks on the feasibility gate.
 *
 *   A. Is the effect just "avoid high-ATR stocks" restated? NOT_FEASIBLE_NOISE
 *      fires when riskFrac < 1.0 x ATR / entry, so the exposure is partly an ATR
 *      proxy. Tested in ATR quintiles rather than a median split.
 *   B. The sign flips for setups close to MA20/MA50. Is that where the noise
 *      setups concentrate, and does it survive a finer cut?
 *   C. How many distinct symbols carry the 138 noise setups?
 *
 * Read-only. Adds no new endpoint; these are robustness reads on the frozen
 * primary.
 *
 *   npx tsx scripts/replay/audit-feasibility-gate-challenges.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";

async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
const pct = (x: number) => (Number.isNaN(x) ? "   n/a" : `${(100 * x).toFixed(2)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qtl = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };
type R = {
  session: string; symbol: string; feas: boolean; riskFrac: number; fwd5: number;
  atrPct: number | null; ma20Dist: number | null; ma50Dist: number | null;
};

async function main(): Promise<void> {
  const stored = readFileSync("docs/trading/replay/postbackfill/setups.ndjson", "utf-8")
    .trim().split(/\r?\n/).filter(Boolean)
    .map((l) => JSON.parse(l) as {
      session: string; symbol: string; feasibility: string; riskFrac: number | null; fwdBars: number;
    });

  const symbols = [...new Set(stored.map((s) => s.symbol))];
  const symRows = await wr(() => prisma.stockSymbol.findMany({ where: { symbol: { in: symbols } }, select: { id: true, symbol: true } }));
  const bars = new Map<string, Bar[]>();
  let n = 0;
  for (const s of symRows) {
    bars.set(s.symbol, (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[]);
    if (++n % 40 === 0) console.error(`  loaded ${n}/${symRows.length}`);
  }

  const rows: R[] = [];
  for (const st of stored) {
    if (st.feasibility !== "FEASIBLE" && st.feasibility !== "NOT_FEASIBLE_NOISE") continue;
    if (st.riskFrac == null) continue;
    const rs = bars.get(st.symbol);
    if (!rs) continue;
    const i = rs.findIndex((r) => isoDay(r.date) === st.session);
    if (i < 0) continue;
    const fut = rs.slice(i + 1);
    if (fut.length < 5) continue;
    const entry = fut[0]!.open;
    if (!(entry > 0)) continue;
    const hist = rs.slice(0, i + 1);
    const c = hist[hist.length - 1]!.close;
    let atr: number | null = null;
    if (hist.length >= 15) {
      const trs: number[] = [];
      for (let k = hist.length - 14; k < hist.length; k++) {
        const b = hist[k]!, p = hist[k - 1]!;
        trs.push(Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)));
      }
      atr = mean(trs);
    }
    const ma20 = hist.length >= 20 ? mean(hist.slice(-20).map((x) => x.close)) : null;
    const ma50 = hist.length >= 50 ? mean(hist.slice(-50).map((x) => x.close)) : null;
    rows.push({
      session: st.session, symbol: st.symbol, feas: st.feasibility === "FEASIBLE",
      riskFrac: st.riskFrac, fwd5: fut[4]!.close / entry - 1,
      atrPct: atr != null && c > 0 ? atr / c : null,
      ma20Dist: ma20 ? c / ma20 - 1 : null, ma50Dist: ma50 ? c / ma50 - 1 : null,
    });
  }

  const delta = (rs: R[]) => {
    const f = rs.filter((r) => r.feas).map((r) => r.fwd5);
    const nn = rs.filter((r) => !r.feas).map((r) => r.fwd5);
    return f.length && nn.length ? mean(f) - mean(nn) : NaN;
  };

  console.log(`\n== A. IS IT JUST "AVOID HIGH-ATR STOCKS"? ==`);
  const withAtr = rows.filter((r) => r.atrPct != null);
  console.log(`  ATR/price by arm: FEASIBLE median ${pct(qtl(withAtr.filter((r) => r.feas).map((r) => r.atrPct!), 0.5))}` +
    `  NOISE median ${pct(qtl(withAtr.filter((r) => !r.feas).map((r) => r.atrPct!), 0.5))}`);
  console.log(`  (the exposure is partly an ATR proxy by construction, so this is the load-bearing check)\n`);
  const cuts = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((p) => qtl(withAtr.map((r) => r.atrPct!), p));
  for (let i = 0; i < 5; i++) {
    const lo = cuts[i]!, hi = i === 4 ? Infinity : cuts[i + 1]!;
    const sub = withAtr.filter((r) => r.atrPct! >= lo && (i === 4 ? true : r.atrPct! < hi));
    const nF = sub.filter((r) => r.feas).length, nN = sub.length - sub.filter((r) => r.feas).length;
    const d = delta(sub);
    console.log(
      `  ATR quintile ${i + 1} [${pct(lo)}..${i === 4 ? " max " : pct(hi)}]  nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  ` +
        `delta ${pct(d).padStart(8)}${nF >= 10 && nN >= 10 ? (d > 0 ? "" : "   <-- sign flips") : "   (too few to read)"}`,
    );
  }

  console.log(`\n== B. THE MA-DISTANCE SIGN FLIP ==`);
  for (const [name, get] of [["MA20", (r: R) => r.ma20Dist], ["MA50", (r: R) => r.ma50Dist]] as const) {
    const w = rows.filter((r) => get(r) != null);
    console.log(`  distance from ${name}:`);
    const c2 = [0, 0.25, 0.5, 0.75, 1.0].map((p) => qtl(w.map((r) => get(r)!), p));
    for (let i = 0; i < 4; i++) {
      const lo = c2[i]!, hi = i === 3 ? Infinity : c2[i + 1]!;
      const sub = w.filter((r) => get(r)! >= lo && (i === 3 ? true : get(r)! < hi));
      const nF = sub.filter((r) => r.feas).length, nN = sub.length - sub.filter((r) => r.feas).length;
      const d = delta(sub);
      console.log(
        `    quartile ${i + 1} [${pct(lo)}..${i === 3 ? " max " : pct(hi)}]  nF=${String(nF).padStart(3)} nN=${String(nN).padStart(3)}  ` +
          `delta ${pct(d).padStart(8)}${nF >= 10 && nN >= 10 ? (d > 0 ? "" : "   <-- sign flips") : "   (too few)"}`,
      );
    }
    // where do the noise setups sit?
    const noiseMed = qtl(w.filter((r) => !r.feas).map((r) => get(r)!), 0.5);
    const feasMed = qtl(w.filter((r) => r.feas).map((r) => get(r)!), 0.5);
    console.log(`    median distance: FEASIBLE ${pct(feasMed)}  NOISE ${pct(noiseMed)}`);
  }

  console.log(`\n== C. SYMBOL CONCENTRATION OF THE NOISE ARM ==`);
  const noiseRows = rows.filter((r) => !r.feas);
  const bySym = new Map<string, number>();
  for (const r of noiseRows) bySym.set(r.symbol, (bySym.get(r.symbol) ?? 0) + 1);
  const top = [...bySym.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  ${noiseRows.length} noise setups across ${bySym.size} distinct symbols`);
  console.log(`  top 5: ${top.slice(0, 5).map(([s, c]) => `${s}=${c}`).join(" ")}`);
  const top5 = top.slice(0, 5).reduce((a, [, c]) => a + c, 0);
  console.log(`  top 5 carry ${top5}/${noiseRows.length} = ${pct(top5 / noiseRows.length)} of the noise arm`);
  const fSym = new Set(rows.filter((r) => r.feas).map((r) => r.symbol));
  console.log(`  FEASIBLE arm spans ${fSym.size} symbols; overlap with noise arm ${[...bySym.keys()].filter((s) => fSym.has(s)).length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
