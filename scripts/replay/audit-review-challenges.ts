/**
 * Answers three reviewer challenges with measurement rather than argument.
 *
 *   #9  synthetic entry prices — is the T+1 open a real traded price?
 *   #6  limit-up detection error — recompute using ONLY known-exchange symbols
 *   #7  breadth denominator — recompute excluding zero-volume and unchanged names
 *
 *   npx tsx scripts/replay/audit-review-challenges.ts
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
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };
type Setup = { session: string; symbol: string; legacyVisible: boolean; shadowVisible: boolean; fwd5: number | null };

async function main(): Promise<void> {
  const setups = readFileSync("docs/trading/replay/postbackfill/setups.ndjson", "utf-8")
    .trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Setup);

  const symRows = await wr(() => prisma.stockSymbol.findMany({
    where: { bars: { some: {} } }, select: { id: true, symbol: true, exchange: true }, orderBy: { symbol: "asc" },
  }));
  const bars = new Map<string, Bar[]>();
  const exch = new Map<string, string | null>();
  let n = 0;
  for (const s of symRows) {
    const rows = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[];
    if (rows.length) { bars.set(s.symbol, rows); exch.set(s.symbol, s.exchange); }
    if (++n % 80 === 0) console.error(`  loaded ${n}/${symRows.length}`);
  }

  // ---------------------------------------------- #9 synthetic entry prices
  console.log("== #9 IS THE T+1 ENTRY A REAL TRADED PRICE? ==");
  let checked = 0, synthetic = 0, zeroVol = 0;
  const badPairs: string[] = [];
  for (const st of setups) {
    const rs = bars.get(st.symbol);
    if (!rs) continue;
    const i = rs.findIndex((r) => isoDay(r.date) === st.session);
    if (i < 0 || i + 1 >= rs.length) continue;
    const e = rs[i + 1]!;
    checked++;
    // a synthetic reference price sits outside the bar's own traded range
    if (!(e.open >= e.low && e.open <= e.high)) { synthetic++; badPairs.push(`${st.symbol} ${st.session}`); }
    if (!(e.volume > 0)) zeroVol++;
  }
  console.log(`  setups with a T+1 bar        ${checked}/${setups.length}`);
  console.log(`  T+1 open outside [low,high]  ${synthetic}  ${pct(synthetic / checked)}`);
  console.log(`  T+1 bar with zero volume     ${zeroVol}  ${pct(zeroVol / checked)}`);
  if (badPairs.length) console.log(`  affected: ${badPairs.slice(0, 10).join(", ")}${badPairs.length > 10 ? " ..." : ""}`);
  console.log(`  ${synthetic === 0 ? "NO synthetic entries - the objection does not apply to this sample" : "*** some entries are reference prices ***"}`);

  // -------------------------------- #6 limit-up on known-exchange symbols only
  const T = "2026-08-21";
  console.log(`\n== #6 LIMIT-UP, KNOWN-EXCHANGE SYMBOLS ONLY (${T}) ==`);
  const EXPECT: Record<string, number> = { HOSE: 0.07, HNX: 0.1, UPCOM: 0.15 };
  let knownTraded = 0, knownLimitUp = 0;
  for (const [sym, rs] of bars) {
    const ex = exch.get(sym);
    if (!ex || !(ex in EXPECT)) continue;
    const i = rs.findIndex((r) => isoDay(r.date) === T);
    if (i < 1 || !(rs[i - 1]!.close > 0)) continue;
    knownTraded++;
    if (rs[i]!.close / rs[i - 1]!.close - 1 >= EXPECT[ex]! - 0.005) knownLimitUp++;
  }
  console.log(`  known-exchange symbols trading on ${T}: ${knownTraded}`);
  console.log(`  limit-up among them: ${knownLimitUp}  ${knownTraded ? pct(knownLimitUp / knownTraded) : "n/a"}   (inferred-band estimate over all 217 was 6 = 2.76%)`);

  // ------------------------------- #7 breadth excluding non-participants
  console.log(`\n== #7 BREADTH DENOMINATOR SENSITIVITY (${T}) ==`);
  let all = 0, adv = 0, traded = 0, tradedAdv = 0, tradedDec = 0;
  for (const [, rs] of bars) {
    const i = rs.findIndex((r) => isoDay(r.date) === T);
    if (i < 1 || !(rs[i - 1]!.close > 0)) continue;
    const ret = rs[i]!.close / rs[i - 1]!.close - 1;
    all++;
    if (ret > 0) adv++;
    if (rs[i]!.volume > 0) {
      traded++;
      if (ret > 0) tradedAdv++;
      else if (ret < 0) tradedDec++;
    }
  }
  console.log(`  as reported: advancing ${adv}/${all} = ${pct(adv / all)}`);
  console.log(`  volume > 0 only: advancing ${tradedAdv}/${traded} = ${pct(tradedAdv / traded)}`);
  console.log(`  advancing / (advancing + declining), volume > 0: ${pct(tradedAdv / (tradedAdv + tradedDec))}`);
  console.log(`  zero-volume names excluded: ${all - traded}`);

  // ------------------------- #1 survivorship exposure, restated with numbers
  console.log("\n== #1 SURVIVORSHIP EXPOSURE ==");
  const lastBar = new Map<string, string>();
  for (const [sym, rs] of bars) lastBar.set(sym, isoDay(rs[rs.length - 1]!.date));
  const dead = [...lastBar.entries()].filter(([, d]) => d < "2026-01-01");
  console.log(`  symbols with bars: ${bars.size}`);
  console.log(`  symbols whose last bar predates 2026: ${dead.length}  (${pct(dead.length / bars.size)})`);
  console.log(`  a survivorship-free universe would carry far more; this is the standing limitation from phase 12`);

  // the relative comparison is what the verdict rests on - check both populations
  const h2v = setups.filter((s) => !s.legacyVisible && s.shadowVisible);
  const ctrl = setups.filter((s) => s.legacyVisible && s.shadowVisible);
  const symsIn = (rows: Setup[]) => new Set(rows.map((r) => r.symbol));
  console.log(`  hidden->visible draws on ${symsIn(h2v).size} symbols; control on ${symsIn(ctrl).size}; overlap ${[...symsIn(h2v)].filter((x) => symsIn(ctrl).has(x)).length}`);
  console.log(`  both populations come from the SAME universe, so survivorship inflates both and biases the DIFFERENCE far less than the levels`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
