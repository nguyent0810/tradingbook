/**
 * Post-backfill diagnostic §3 — why did the anchor session produce so few
 * setups? Walks the full funnel on 2026-08-21 and its neighbours and reports
 * the Gate 2 terminal rejection code for every tradable symbol.
 *
 * Read-only, decision-channel bars only.
 *
 *   npx tsx scripts/replay/audit-anchor-funnel.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2/breakout-pullback";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { resolvePointInTimeUniverse, type SymbolActivityRow, type TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";
import type { Gate2BarInput, Gate1Level } from "../../src/lib/scanner/gate2/types";

async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };
function lastIdxAtOrBefore(t: readonly number[], x: number): number {
  let lo = 0, hi = t.length - 1, a = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m]! <= x) { a = m; lo = m + 1; } else hi = m - 1; }
  return a;
}

async function main(): Promise<void> {
  const SESSIONS = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];

  const idxRows = (await wr(() => prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX" }, orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  }))) as Bar[];
  const idxTimes = idxRows.map((b) => b.date.getTime());

  const symRows = await wr(() => prisma.stockSymbol.findMany({
    where: { bars: { some: {} } }, select: { id: true, symbol: true }, orderBy: { symbol: "asc" },
  }));
  const tacticalRows = await wr(() => prisma.tacticalSymbol.findMany({
    select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
  }));
  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol, addedAt: t.addedAt.toISOString(), expiresAt: t.expiresAt.toISOString(),
    status: String(t.status), activeForScanner: t.activeForScanner,
  }));

  const syms: { id: string; symbol: string; bars: Bar[]; times: number[]; first: string }[] = [];
  let loaded = 0;
  for (const s of symRows) {
    const bars = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[];
    if (!bars.length) continue;
    syms.push({ id: s.id, symbol: s.symbol, bars, times: bars.map((b) => b.date.getTime()), first: isoDay(bars[0]!.date) });
    if (++loaded % 80 === 0) console.error(`  loaded ${loaded}/${symRows.length}`);
  }

  for (const T of SESSIONS) {
    const ms = Date.parse(T);
    const ie = lastIdxAtOrBefore(idxTimes, ms);
    const regime = evaluateMarketRegime(
      idxRows.slice(0, ie + 1).map((b) => ({ time: b.date.getTime(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })),
    );
    const gate1 = regime.level as Gate1Level;

    const lookbackFrom = ms - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;
    const activity: SymbolActivityRow[] = [];
    const windows = new Map<string, Bar[]>();
    for (const s of syms) {
      const end = lastIdxAtOrBefore(s.times, ms);
      if (end < 0) { activity.push({ symbolId: s.id, symbol: s.symbol, barsInWindow: 0, lastBarDate: null, firstBarDateEver: s.first }); continue; }
      const start = lastIdxAtOrBefore(s.times, lookbackFrom) + 1;
      const w = s.bars.slice(start, end + 1);
      windows.set(s.symbol, w);
      activity.push({ symbolId: s.id, symbol: s.symbol, barsInWindow: w.length, lastBarDate: isoDay(s.bars[end]!.date), firstBarDateEver: s.first });
    }
    const universe = resolvePointInTimeUniverse({ sessionDate: T, activity, tactical });

    let tradable = 0;
    const codes = new Map<string, number>();
    const valid: string[] = [];
    for (const m of universe.members) {
      const w = windows.get(m.symbol);
      if (!w || !w.length) continue;
      if (!evaluateTradability(w as never, new Date(ms)).passed) continue;
      tradable++;
      const ev = evaluateBreakoutPullbackCandidate(w as unknown as Gate2BarInput[], new Date(ms));
      if (ev.quality === "INVALID") {
        const c = ev.terminalCode ?? "unspecified";
        codes.set(c, (codes.get(c) ?? 0) + 1);
      } else valid.push(`${m.symbol}(${ev.quality})`);
    }
    console.log(`\n=== ${T}  gate1=${gate1}  universe=${universe.members.length}  tradable=${tradable}  VALID=${valid.length} ===`);
    if (valid.length) console.log(`  valid: ${valid.join(" ")}`);
    for (const [c, n] of [...codes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`  ${c.padEnd(32)} ${String(n).padStart(4)}  ${((100 * n) / tradable).toFixed(1)}%`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
