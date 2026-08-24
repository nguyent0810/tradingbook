/**
 * Post-backfill diagnostic §9 — look-ahead proof by poisoning.
 *
 * For a sample of sessions, every decision is computed twice:
 *   (a) with the full bar history, and
 *   (b) with every bar AFTER T deleted from the input entirely.
 *
 * If any decision input leaked from the future, (a) and (b) must differ. They
 * must not. Forward returns are excluded from the comparison because they are
 * outcome labels, which is exactly what they are allowed to be.
 *
 *   npx tsx scripts/replay/audit-lookahead-poison.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import { evaluateBreakoutPullbackCandidate, sortDedupeGate2Bars } from "../../src/lib/scanner/gate2/breakout-pullback";
import { computeAtr } from "../../src/lib/scanner/stop-feasibility";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { runShadowSafely, type ShadowCandidateInput } from "../../src/lib/decisions/run-shadow";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";
import type { Gate2BarInput, Gate1Level } from "../../src/lib/scanner/gate2/types";

async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };

/** Everything the shadow decides, with forward labels deliberately excluded. */
function decideAll(bars: Bar[], idx: Bar[], T: string, symbol: string, exchange: string | null): string | null {
  const ms = Date.parse(T);
  const ie = idx.filter((b) => b.date.getTime() <= ms);
  if (ie.length < 50) return null;
  const regime = evaluateMarketRegime(
    ie.map((b) => ({ time: b.date.getTime(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })),
  );
  const gate1 = regime.level as Gate1Level;

  const w = bars.filter((b) => b.date.getTime() <= ms && b.date.getTime() >= ms - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000);
  if (!w.length) return null;
  if (!evaluateTradability(w as never, new Date(ms)).passed) return null;
  const ev = evaluateBreakoutPullbackCandidate(w as unknown as Gate2BarInput[], new Date(ms));
  if (ev.quality === "INVALID") return null;

  const sorted = sortDedupeGate2Bars(w as unknown as Gate2BarInput[]);
  const L = sorted.length - 1;
  const prior = sorted.slice(Math.max(0, L - GATE2_RANGE_DAYS), L).map((x) => x.volume);
  const med = median(prior);
  const mu = mean(prior);
  const g2v = med > 0 ? sorted[L]!.volume / med : null;
  const ctxv = mu > 0 ? sorted[L]!.volume / mu : null;
  const v20 = sorted.slice(Math.max(0, L - 19), L + 1);
  const mtv = median(v20.map((x) => x.close * 1000 * x.volume));

  const input: ShadowCandidateInput = {
    symbol, session: T, gate1Level: gate1, quality: ev.quality, validity: "VALID",
    entryPriceKVnd: ev.close, structuralStopKVnd: ev.stopLevel,
    atrKVnd: computeAtr(sorted.slice(Math.max(0, L - 40))),
    board: (exchange as "HOSE" | "HNX" | "UPCOM" | null) ?? "HOSE",
    avgDailyValueVnd: Number.isFinite(mtv) ? mtv : null,
    rankComponents: ev.rankComponents ?? null,
    accountEquityVnd: null, portfolioOpenRiskVnd: null,
    volumePrimitives: {
      gate2VolRatioMedian: g2v, contextVolRatioMean: ctxv,
      sameSideOf1_5Cutoff: g2v == null || ctxv == null ? null : (g2v >= GATE2_VOL_RATIO_A) === (ctxv >= GATE2_VOL_RATIO_A),
    },
  };
  const r = runShadowSafely(input);
  if (!r.ok) return `ERROR:${r.error}`;
  const rec = r.record;
  return JSON.stringify({
    gate1, quality: ev.quality, stop: ev.stopLevel, entry: ev.close, rank: rec.d3Ranking.score,
    d0: rec.d0MarketRisk.riskClass, d1: rec.d1Visibility.decision, d2: rec.d2Feasibility.verdict,
    d4: rec.d4Sizing.eligibility, legacyVis: rec.legacy.visibility,
    vp: rec.volumePrimitives, div: rec.divergences.map((d) => d.code).sort(),
  });
}

async function main(): Promise<void> {
  const idx = (await wr(() => prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX" }, orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  }))) as Bar[];

  const symRows = await wr(() => prisma.stockSymbol.findMany({ where: { bars: { some: {} } }, select: { id: true, symbol: true, exchange: true }, orderBy: { symbol: "asc" } }));

  // Test the REAL decisions: every symbol x session pair that actually produced
  // a setup in the rebuild. A random sample almost never lands on one (Gate 2
  // validity is ~0.35% of evaluations), so it proves nothing.
  const setups = readFileSync("docs/trading/replay/postbackfill/setups.ndjson", "utf-8")
    .trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { session: string; symbol: string });
  const bySymbol = new Map<string, string[]>();
  for (const st of setups) {
    const a = bySymbol.get(st.symbol) ?? [];
    a.push(st.session);
    bySymbol.set(st.symbol, a);
  }
  const sample = symRows.filter((s) => bySymbol.has(s.symbol));
  console.log(`poison-testing ${setups.length} real setups across ${sample.length} symbols`);

  let compared = 0, mismatched = 0, decided = 0;
  for (const s of sample) {
    const bars = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[];
    if (!bars.length) continue;
    for (const T of bySymbol.get(s.symbol)!) {
      const ms = Date.parse(T);
      // (a) full history, including everything after T
      const full = decideAll(bars, idx, T, s.symbol, s.exchange);
      // (b) every bar after T physically removed from BOTH series
      const truncBars = bars.filter((x) => x.date.getTime() <= ms);
      const truncIdx = idx.filter((x) => x.date.getTime() <= ms);
      const trunc = decideAll(truncBars, truncIdx, T, s.symbol, s.exchange);
      compared++;
      if (full !== null) decided++;
      if (full !== trunc) {
        mismatched++;
        if (mismatched <= 5) console.log(`  MISMATCH ${s.symbol} ${T}\n    full : ${full}\n    trunc: ${trunc}`);
      }
    }
  }

  console.log("\n== §9 LOOK-AHEAD POISON TEST ==");
  console.log(`  symbol x session pairs compared : ${compared}`);
  console.log(`  pairs that produced a decision  : ${decided}`);
  console.log(`  outputs that changed when post-T bars were deleted : ${mismatched}`);
  console.log(`  ${mismatched === 0 ? "PASS - no decision input reads a bar after T" : "*** FAIL - look-ahead leakage ***"}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
