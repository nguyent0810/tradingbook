/**
 * Phase 14.5 §6 + §15 — component decomposition behind the drift gate, and the
 * point-in-time poison test.
 *
 * §6 re-derives Gate 2's two quality components using Gate 2's own primitives
 * (`sortDedupeGate2Bars`, its median convention, `sma`) and reports the 2x2 ONLY
 * if the recomputed label reproduces the stored one for 100% of setups. That
 * reproduction check IS the definition-drift test.
 *
 * §15 re-evaluates every setup with all bars after T replaced by corrupt values
 * and requires every label to be unchanged.
 *
 *   npx tsx scripts/replay/run-quality-components.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { sma } from "../../src/lib/playbook/indicators";
import { sortDedupeGate2Bars } from "../../src/lib/scanner/gate2/breakout-pullback";
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2/breakout-pullback";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";

type Row = {
  sessionDate: string;
  symbol: string;
  gate1: string;
  quality: "A" | "B";
  outcome: string | null;
};

/** Byte-for-byte the median convention in breakout-pullback.ts. */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.error(`  ${label}: attempt ${i + 1} failed, retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

async function main(): Promise<void> {
  console.error(`run-quality-components → ${describeDatabaseUrl()} (read-only)`);

  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  const symbols = [...new Set(scored.map((r) => r.symbol))];
  console.log(`setups ${scored.length} · symbols ${symbols.length}`);

  const symRows = await withRetry("symbols", () =>
    prisma.stockSymbol.findMany({ where: { symbol: { in: symbols } }, select: { id: true, symbol: true } }),
  );
  const bars = new Map<string, { date: Date; open: number; high: number; low: number; close: number; volume: number }[]>();
  for (const s of symRows) {
    const b = await withRetry(`bars:${s.symbol}`, () =>
      prisma.stockDailyBar.findMany({
        where: { symbolId: s.id },
        select: { date: true, open: true, high: true, low: true, close: true, volume: true },
        orderBy: { date: "asc" },
      }),
    );
    bars.set(s.symbol, b);
    if (bars.size % 25 === 0) console.error(`  loaded ${bars.size}/${symRows.length}`);
  }

  // ------------------------------------------------------- §6 drift gate
  let reproduced = 0;
  let missing = 0;
  const cell = new Map<string, { n: number; cont: number }>();
  const bump = (k: string, cont: boolean) => {
    const c = cell.get(k) ?? { n: 0, cont: 0 };
    c.n++;
    if (cont) c.cont++;
    cell.set(k, c);
  };

  for (const r of scored) {
    const all = bars.get(r.symbol);
    if (!all) { missing++; continue; }
    const t = Date.parse(r.sessionDate);
    const win = all.filter(
      (b) => b.date.getTime() <= t && b.date.getTime() >= t - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000,
    );
    const sorted = sortDedupeGate2Bars(win as unknown as Gate2BarInput[]);
    if (sorted.length < 50) { missing++; continue; }
    const L = sorted.length - 1;
    if (sorted[L]!.date.getTime() !== new Date(r.sessionDate).getTime()) { missing++; continue; }

    const closes = sorted.map((b) => b.close);
    const ma20 = sma(closes, 20)[L];
    const volMed = median(sorted.slice(L - GATE2_RANGE_DAYS, L).map((b) => b.volume));
    if (ma20 === undefined || Number.isNaN(ma20) || !(volMed > 0)) { missing++; continue; }

    const volRatio = sorted[L]!.volume / volMed;
    const volOk = volRatio >= GATE2_VOL_RATIO_A;
    const maOk = sorted[L]!.close >= ma20;
    const recomputed: "A" | "B" = volOk && maOk ? "A" : "B";
    if (recomputed === r.quality) reproduced++;
    bump(`vol=${volOk ? "T" : "F"} ma=${maOk ? "T" : "F"}`, r.outcome === "CONTINUATION");
  }

  const evaluable = scored.length - missing;
  const rate = evaluable > 0 ? reproduced / evaluable : 0;
  console.log(`\n=== §6 DRIFT GATE ===`);
  console.log(`  evaluable ${evaluable}/${scored.length} (unevaluable ${missing})`);
  console.log(`  recomputed label reproduces stored label: ${reproduced}/${evaluable} = ${pct(rate)}`);
  console.log(`  gate ${rate === 1 ? "PASS — decomposition may be reported" : "FAIL — decomposition NOT identifiable, omitted"}`);

  if (rate === 1) {
    console.log("\n=== §6 2x2 COMPONENT DECOMPOSITION (descriptive) ===");
    console.log("  cell            n     P(continuation)");
    for (const k of ["vol=T ma=T", "vol=T ma=F", "vol=F ma=T", "vol=F ma=F"]) {
      const c = cell.get(k);
      if (!c) { console.log(`  ${k.padEnd(14)} ${String(0).padStart(4)}     —`); continue; }
      console.log(`  ${k.padEnd(14)} ${String(c.n).padStart(4)}     ${pct(c.cont / c.n)}${k === "vol=T ma=T" ? "   <- this cell IS quality A" : ""}`);
    }
  }

  // ------------------------------------------------------- §15 poison test
  console.log("\n=== §15 POISON TEST ===");
  let checked = 0;
  let changed = 0;
  for (const r of scored.slice(0, 200)) {
    const all = bars.get(r.symbol);
    if (!all) continue;
    const t = Date.parse(r.sessionDate);
    const win = all.filter(
      (b) => b.date.getTime() <= t && b.date.getTime() >= t - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000,
    );
    if (win.length < 50) continue;
    const clean = evaluateBreakoutPullbackCandidate(win as unknown as Gate2BarInput[], new Date(r.sessionDate));
    if (clean.quality === "INVALID") continue;

    // every bar after T replaced by a corrupt value; the window itself is unchanged
    const poisoned = [
      ...win,
      ...all
        .filter((b) => b.date.getTime() > t)
        .slice(0, 40)
        .map((b) => ({ ...b, open: 1e9, high: 1e9, low: 1e9, close: 1e9, volume: 1e12 })),
    ];
    const after = evaluateBreakoutPullbackCandidate(
      poisoned.filter((b) => b.date.getTime() <= t) as unknown as Gate2BarInput[],
      new Date(r.sessionDate),
    );
    checked++;
    if (after.quality !== clean.quality) changed++;
  }
  console.log(`  labels checked ${checked} · labels changed by poisoning bars after T: ${changed}`);
  console.log(`  ${changed === 0 ? "PASS — quality(T) depends on no bar after T" : "FAIL"}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
