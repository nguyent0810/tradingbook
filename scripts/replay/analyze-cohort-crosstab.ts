/**
 * Post-backfill diagnostic — two cross-checks the headline numbers need:
 *
 *   1. old vs new reconciliation on a LIKE-FOR-LIKE basis. The prior M1 figure
 *      (574) was deduped and outcome-resolved; the rebuild is raw. Applying the
 *      same frozen dedup makes the comparison meaningful.
 *   2. the divergence populations split BY REGIME COHORT, because the
 *      decomposition adds most setups in weak-breadth sessions and that is
 *      exactly where the cohort outcomes were best.
 *
 *   npx tsx scripts/replay/analyze-cohort-crosstab.ts
 */
import { readFileSync } from "node:fs";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";

const DIR = "docs/trading/replay/postbackfill";

type Setup = {
  session: string; symbol: string; gate1: string; quality: "A" | "B";
  legacyVisible: boolean; shadowVisible: boolean; feasibility: string;
  entryPriceKVnd: number; stopKVnd: number;
  fwd5: number | null; mfe20: number | null; mae20: number | null;
  stopFirst: boolean | null; fwdBars: number;
};
type Breadth = { session: string; advShare: number };

const load = <T,>(f: string): T[] =>
  readFileSync(`${DIR}/${f}`, "utf-8").trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as T);
const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : `${(100 * x).toFixed(2)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};

/** The frozen dedup rule from the continuation-study preregistration. */
function dedupe(rows: Setup[]): Setup[] {
  const bySym = new Map<string, Setup[]>();
  for (const r of [...rows].sort((a, b) => a.session.localeCompare(b.session))) {
    const a = bySym.get(r.symbol) ?? [];
    a.push(r);
    bySym.set(r.symbol, a);
  }
  const kept: Setup[] = [];
  for (const [, arr] of bySym) {
    const anchors: Setup[] = [];
    for (const r of arr) {
      const dup = anchors.some(
        (a) =>
          a.entryPriceKVnd > 0 &&
          Math.abs(r.stopKVnd - a.stopKVnd) / Math.max(1e-9, a.stopKVnd) <= 0.005 &&
          (Date.parse(r.session) - Date.parse(a.session)) / 86_400_000 <= GATE2_RANGE_DAYS * 1.45,
      );
      if (!dup) anchors.push(r);
    }
    kept.push(...anchors);
  }
  return kept.sort((a, b) => a.session.localeCompare(b.session));
}

function summarise(rows: Setup[], label: string): void {
  const r = rows.filter((x) => x.fwdBars >= 5 && x.fwd5 != null);
  const f5 = r.map((x) => x.fwd5!) as number[];
  const sf = r.map((x) => x.stopFirst).filter((x): x is boolean => x != null);
  console.log(
    `    ${label.padEnd(22)} n=${String(r.length).padStart(3)}  medT+5 ${pct(qt(f5, 0.5))}  meanT+5 ${pct(mean(f5))}` +
      `  win ${pct(f5.length ? f5.filter((x) => x > 0).length / f5.length : NaN)}` +
      `  stopFirst ${pct(sf.length ? sf.filter(Boolean).length / sf.length : NaN)}`,
  );
}

function main(): void {
  const setups = load<Setup>("setups.ndjson");
  const breadth = load<Breadth>("breadth.ndjson");
  const bmap = new Map(breadth.map((b) => [b.session, b.advShare]));

  console.log("======== 1. OLD vs NEW, LIKE FOR LIKE ========");
  const uniq = dedupe(setups);
  const resolved = uniq.filter((s) => s.fwdBars >= 20);
  console.log(`  rebuild raw setups                 ${setups.length}      (prior raw: 765)`);
  console.log(`  after the frozen dedup             ${uniq.length}      (prior: 596/598)`);
  console.log(`  with a full 20-session forward     ${resolved.length}      (prior resolved: 574)`);
  console.log(`  date range                         ${setups[0]!.session} .. ${setups[setups.length - 1]!.session}`);
  const preAug = setups.filter((s) => s.session <= "2026-08-07").length;
  console.log(`  setups on/before 2026-08-07        ${preAug}      (the prior sample's last date)`);
  console.log(`  setups after 2026-08-07            ${setups.length - preAug}      (new sessions)`);
  const rV1 = resolved.filter((s) => s.legacyVisible).length;
  console.log(`  resolved: V1 visible ${rV1} / hidden ${resolved.length - rV1}   (prior M1: 380 / 194)`);
  console.log(`  resolved: hidden->visible ${resolved.filter((s) => !s.legacyVisible && s.shadowVisible).length}   (prior M1: 145)`);
  console.log(`  resolved: visible->hidden ${resolved.filter((s) => s.legacyVisible && !s.shadowVisible).length}   (prior M1: 76)`);

  console.log("\n======== 2. DIVERGENCE x REGIME ========");
  const shares = breadth.map((b) => b.advShare);
  const p10 = qt(shares, 0.1), p30 = qt(shares, 0.3), p70 = qt(shares, 0.7), p90 = qt(shares, 0.9);
  const cohort = (d: string): string | null => {
    const a = bmap.get(d);
    if (a == null) return null;
    if (a >= p90) return "strong";
    if (a <= p10) return "weak";
    if (a > p30 && a < p70) return "ordinary";
    return null;
  };
  for (const c of ["strong", "ordinary", "weak"]) {
    const rows = setups.filter((s) => cohort(s.session) === c);
    console.log(`\n  ${c.toUpperCase()} breadth  (${rows.length} setups)`);
    summarise(rows.filter((s) => !s.legacyVisible && s.shadowVisible), "hidden->visible");
    summarise(rows.filter((s) => s.legacyVisible && s.shadowVisible), "control both SHOWN");
    summarise(rows.filter((s) => s.legacyVisible && !s.shadowVisible), "visible->hidden");
  }

  console.log("\n======== 3. WHAT THE FEASIBILITY SPLIT REMOVES ========");
  const byVerdict = new Map<string, Setup[]>();
  for (const s of setups) {
    const a = byVerdict.get(s.feasibility) ?? [];
    a.push(s);
    byVerdict.set(s.feasibility, a);
  }
  for (const [v, rows] of [...byVerdict.entries()].sort((a, b) => b[1].length - a[1].length)) {
    summarise(rows, v);
  }
}

main();
