/**
 * Phase 15 §4 — how far apart are the repo's TWO volume-expansion primitives?
 *
 * Gate 2            volRatio      = bar.volume / MEDIAN(prior 20 volumes)
 *                                   breakout-pullback.ts:316-322
 * Market context    volRatioMa20  = bar.volume / MEAN(prior 20 volumes)
 *                                   compute-market-context.ts:88-89
 *
 * Same window, same numerator, different central tendency. Volume is heavily
 * right-skewed, so mean > median systematically and the two ratios are offset
 * rather than merely noisy. This measures the offset on the setups that exist.
 *
 * Semantic audit only — no outcome is read, nothing is tuned.
 *
 *   npx tsx scripts/replay/audit-volratio-fanout.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { sortDedupeGate2Bars } from "../../src/lib/scanner/gate2/breakout-pullback";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";

/** Gate 2's convention, byte-for-byte (breakout-pullback.ts:39-44). */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
/** Market context's convention (compute-market-context.ts:88). */
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

type Row = { sessionDate: string; symbol: string; quality: "A" | "B"; outcome: string | null };

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      console.error(`  ${label}: attempt ${i + 1} failed, retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function main(): Promise<void> {
  console.error(`audit-volratio-fanout → ${describeDatabaseUrl()} (read-only)`);
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  const symbols = [...new Set(scored.map((r) => r.symbol))];

  const symRows = await withRetry("symbols", () =>
    prisma.stockSymbol.findMany({ where: { symbol: { in: symbols } }, select: { id: true, symbol: true } }),
  );
  const bars = new Map<string, { date: Date; open: number; high: number; low: number; close: number; volume: number }[]>();
  for (const s of symRows) {
    bars.set(s.symbol, await withRetry(`bars:${s.symbol}`, () =>
      prisma.stockDailyBar.findMany({
        where: { symbolId: s.id },
        select: { date: true, open: true, high: true, low: true, close: true, volume: true },
        orderBy: { date: "asc" },
      }),
    ));
    if (bars.size % 25 === 0) console.error(`  loaded ${bars.size}/${symRows.length}`);
  }

  const pairs: Array<{ gate2: number; ctx: number; quality: "A" | "B" }> = [];
  for (const r of scored) {
    const all = bars.get(r.symbol);
    if (!all) continue;
    const t = Date.parse(r.sessionDate);
    const win = all.filter(
      (b) => b.date.getTime() <= t && b.date.getTime() >= t - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000,
    );
    const sorted = sortDedupeGate2Bars(win as unknown as Gate2BarInput[]);
    if (sorted.length < GATE2_RANGE_DAYS + 1) continue;
    const L = sorted.length - 1;
    const prior = sorted.slice(L - GATE2_RANGE_DAYS, L).map((b) => b.volume);
    const med = median(prior);
    const mu = mean(prior);
    if (!(med > 0) || !(mu > 0)) continue;
    pairs.push({ gate2: sorted[L]!.volume / med, ctx: sorted[L]!.volume / mu, quality: r.quality });
  }

  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * xs.length)]!;
  const g = pairs.map((p) => p.gate2);
  const c = pairs.map((p) => p.ctx);
  const ratio = pairs.map((p) => p.ctx / p.gate2);

  console.log(`\nsetups measured: ${pairs.length}`);
  console.log("\nTHE TWO PRIMITIVES, SAME WINDOW AND NUMERATOR");
  console.log("statistic              p10     p50     p90");
  console.log(`Gate 2 volRatio      ${q(g, 0.1).toFixed(3)}   ${q(g, 0.5).toFixed(3)}   ${q(g, 0.9).toFixed(3)}   (median denominator)`);
  console.log(`ctx    volRatioMa20  ${q(c, 0.1).toFixed(3)}   ${q(c, 0.5).toFixed(3)}   ${q(c, 0.9).toFixed(3)}   (mean denominator)`);
  console.log(`ratio  ctx / gate2   ${q(ratio, 0.1).toFixed(3)}   ${q(ratio, 0.5).toFixed(3)}   ${q(ratio, 0.9).toFixed(3)}`);
  console.log(`  ctx below gate2 in ${(100 * ratio.filter((x) => x < 1).length / ratio.length).toFixed(1)}% of setups`);

  // What the divergence costs at the one place a cutoff is applied.
  const disagree = pairs.filter(
    (p) => (p.gate2 >= GATE2_VOL_RATIO_A) !== (p.ctx >= GATE2_VOL_RATIO_A),
  );
  console.log(
    `\nIf the SAME 1.5 cutoff were applied to both, they would disagree on ` +
      `${disagree.length}/${pairs.length} setups (${((100 * disagree.length) / pairs.length).toFixed(1)}%)`,
  );
  console.log("  every disagreement is a setup one subsystem calls high-volume and the other does not");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
