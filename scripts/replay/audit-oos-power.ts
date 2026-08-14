/**
 * READ-ONLY: §6 — what sample would a pre-2015 out-of-sample study actually get,
 * and could it answer anything?
 *
 * Computed BEFORE any out-of-sample outcome exists, from in-sample quantities
 * only. Three inputs, all measured rather than assumed:
 *
 *   1. setups per eligible-symbol-year, from the existing 2015-2026 sample
 *   2. the month-level intra-cluster correlation of the continuation outcome,
 *      which sets the design effect
 *   3. the eligible-symbol count the frozen liquidity floor admits per year
 *
 * Output is the minimum detectable effect for the two primary questions a
 * pre-2015 study would ask: is the rate above the 2:1 breakeven, and does it sit
 * nearer the old era or the new one.
 *
 *   npx tsx scripts/replay/audit-oos-power.ts --setups docs/trading/replay/continuation/setups.ndjson
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Setup = {
  sessionDate: string;
  symbol: string;
  breakoutLevel: number;
  outcome: string | null;
};

/** §1 dedup of the continuation preregistration, reproduced exactly. */
function dedupe(rows: Setup[]): Setup[] {
  const bySymbol = new Map<string, Setup[]>();
  for (const r of [...rows].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))) {
    const arr = bySymbol.get(r.symbol) ?? [];
    arr.push(r);
    bySymbol.set(r.symbol, arr);
  }
  const kept: Setup[] = [];
  for (const [, arr] of bySymbol) {
    const anchors: Setup[] = [];
    for (const r of arr) {
      const dup = anchors.some((a) => {
        const sameLevel =
          a.breakoutLevel > 0 && Math.abs(r.breakoutLevel - a.breakoutLevel) / a.breakoutLevel <= 0.005;
        const days =
          (Date.parse(r.sessionDate) - Date.parse(a.sessionDate)) / 86_400_000;
        // sessions, not calendar days, are the rule's unit; ~1.45 calendar days
        // per session is the ratio in this history and is used only to bound the
        // window, exactly as the study script did.
        return sameLevel && days <= GATE2_RANGE_DAYS * 1.45;
      });
      if (!dup) anchors.push(r);
    }
    kept.push(...anchors);
  }
  return kept.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

/** One-way random-effects ICC of a binary outcome over clusters. */
function icc(groups: number[][]): number {
  const k = groups.length;
  const n = groups.reduce((a, g) => a + g.length, 0);
  if (k < 2 || n <= k) return 0;
  const grand = groups.flat().reduce((a, x) => a + x, 0) / n;
  let msb = 0;
  for (const g of groups) {
    const m = g.reduce((a, x) => a + x, 0) / g.length;
    msb += g.length * (m - grand) ** 2;
  }
  msb /= k - 1;
  let msw = 0;
  for (const g of groups) {
    const m = g.reduce((a, x) => a + x, 0) / g.length;
    msw += g.reduce((a, x) => a + (x - m) ** 2, 0);
  }
  msw /= n - k;
  const sizes = groups.map((g) => g.length);
  const m0 =
    (n - sizes.reduce((a, s) => a + s * s, 0) / n) / (k - 1);
  const v = (msb - msw) / m0;
  return v <= 0 ? 0 : v / (v + msw);
}

const Z80 = 0.8416; // one-sided power 0.80
const Z50 = 0;
const Z975 = 1.9600;

function main(): void {
  const path = arg("setups") ?? "docs/trading/replay/continuation/setups.ndjson";
  const raw: Setup[] = readFileSync(path, "utf-8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
  const unique = dedupe(raw);
  const scored = unique.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  console.log(`raw=${raw.length} unique=${unique.length} scored=${scored.length}`);

  const era = (d: string) => (d < "2022-01-01" ? "old" : "new");
  for (const e of ["old", "new"] as const) {
    const s = scored.filter((r) => era(r.sessionDate) === e);
    const wins = s.filter((r) => r.outcome === "CONTINUATION").length;
    console.log(`  ${e}: n=${s.length} P(cont)=${((100 * wins) / s.length).toFixed(1)}%`);
  }

  // --- 1. month-level ICC, measured on the in-sample outcomes ---
  const byMonth = new Map<string, number[]>();
  for (const r of scored) {
    const m = r.sessionDate.slice(0, 7);
    const arr = byMonth.get(m) ?? [];
    arr.push(r.outcome === "CONTINUATION" ? 1 : 0);
    byMonth.set(m, arr);
  }
  const groups = [...byMonth.values()];
  const rho = icc(groups);
  const mbar = scored.length / groups.length;
  console.log(
    `\nmonth clusters=${groups.length} mean setups/month=${mbar.toFixed(2)} ICC=${rho.toFixed(4)}`,
  );

  // --- 2. setups per eligible-symbol-year, measured ---
  // eligible counts come from audit-oos-liquidity-floor.ts, restated here so the
  // ratio is auditable in one place.
  const eligibleByYear: Record<number, number> = {
    2015: 18, 2016: 33, 2017: 42, 2018: 56, 2019: 51, 2020: 74,
    2021: 135, 2022: 130, 2023: 104, 2024: 104, 2025: 108,
  };
  const setupsByYear = new Map<number, number>();
  for (const r of unique) {
    const y = Number(r.sessionDate.slice(0, 4));
    setupsByYear.set(y, (setupsByYear.get(y) ?? 0) + 1);
  }
  console.log("\nyear  eligibleSymbols  uniqueSetups  setupsPerEligibleSymbolYear");
  let sumE = 0;
  let sumS = 0;
  for (const y of Object.keys(eligibleByYear).map(Number).sort()) {
    const e = eligibleByYear[y]!;
    const s = setupsByYear.get(y) ?? 0;
    sumE += e;
    sumS += s;
    console.log(
      `${y}  ${String(e).padStart(15)}  ${String(s).padStart(12)}  ${(s / e).toFixed(2).padStart(27)}`,
    );
  }
  const rate = sumS / sumE;
  console.log(`pooled rate = ${rate.toFixed(3)} setups per eligible-symbol-year`);

  // --- 3. projected pre-2015 sample and its power ---
  console.log("\nPROJECTED PRE-2015 SAMPLE (2009-2014, 6 years) AND MDE");
  console.log(
    "eligible/yr  setups  months  deff    SE     MDE80(1 rate)  MDE80(vs old era)",
  );
  const OLD_N = 284;
  const OLD_MONTHS = 62;
  const extra = arg("eligible") ? [Number(arg("eligible"))] : [];
  for (const elig of [...new Set([15, 25, 40, ...extra, 60, 90])].sort((a, b) => a - b)) {
    const n = Math.round(elig * 6 * rate);
    const months = 72;
    const m = n / months;
    const deff = 1 + (m - 1) * rho;
    const se = Math.sqrt((0.333 * 0.667) / n) * Math.sqrt(deff);
    const mde1 = (Z975 + Z80) * se;
    const mOld = OLD_N / OLD_MONTHS;
    const seOld = Math.sqrt((0.408 * 0.592) / OLD_N) * Math.sqrt(1 + (mOld - 1) * rho);
    const seDiff = Math.sqrt(se * se + seOld * seOld);
    const mde2 = (Z975 + Z80) * seDiff;
    console.log(
      `${String(elig).padStart(11)}  ${String(n).padStart(6)}  ${String(months).padStart(6)}  ${deff.toFixed(2)}  ${(100 * se).toFixed(2)}pp  ${(100 * mde1).toFixed(2)}pp`.padEnd(70) +
        `${(100 * mde2).toFixed(2)}pp`,
    );
  }
  console.log(
    `\nreference: old-era 40.8% vs new-era 27.1% is a 13.8pp gap;` +
      ` breakeven at 2:1 is 33.3%, which sits 7.5pp below old and 6.2pp above new.`,
  );
  void Z50;
}

main();
