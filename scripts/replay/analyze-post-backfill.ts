/**
 * Post-backfill diagnostic — analysis of the rebuilt population (§1, §3-§7).
 *
 * Reads only the freshly rebuilt artifacts. Forward returns are used as outcome
 * labels; nothing here feeds a decision.
 *
 *   npx tsx scripts/replay/analyze-post-backfill.ts
 */
import { readFileSync } from "node:fs";

const DIR = "docs/trading/replay/postbackfill";
const ANCHOR = "2026-08-21";

type Setup = {
  session: string; symbol: string; gate1: "PASS" | "WARNING" | "FAIL"; quality: "A" | "B";
  legacyVisible: boolean; shadowVisible: boolean;
  feasibility: string; bindingFloor: string; riskFrac: number | null; rankScore: number;
  marketRiskClass: string; sizingEligibility: string;
  gate2VolRatioMedian: number | null; contextVolRatioMean: number | null; sameSide: boolean | null;
  entryPriceKVnd: number; stopKVnd: number;
  fwd1: number | null; fwd3: number | null; fwd5: number | null;
  mfe20: number | null; mae20: number | null; stopFirst: boolean | null; fwdBars: number;
  divergences: string[];
};
type Breadth = {
  session: string; n: number; advShare: number; advVolShare: number | null;
  medVolRatio: number | null; shareVolAboveMa20: number | null; shareAboveMa20: number | null;
};

const load = <T,>(f: string): T[] =>
  readFileSync(`${DIR}/${f}`, "utf-8").trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as T);

const pct = (x: number | null) => (x == null || Number.isNaN(x) ? "  n/a" : `${(100 * x).toFixed(2)}%`);
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const qt = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};

/** Outcome summary for a population. Labels only — no decision reads these. */
function outcomes(rows: Setup[], label: string): void {
  const r = rows.filter((x) => x.fwdBars >= 5);
  const f1 = r.map((x) => x.fwd1).filter((x): x is number => x != null);
  const f3 = r.map((x) => x.fwd3).filter((x): x is number => x != null);
  const f5 = r.map((x) => x.fwd5).filter((x): x is number => x != null);
  const mfe = r.map((x) => x.mfe20).filter((x): x is number => x != null);
  const mae = r.map((x) => x.mae20).filter((x): x is number => x != null);
  const sf = r.map((x) => x.stopFirst).filter((x): x is boolean => x != null);
  console.log(
    `  ${label.padEnd(26)} n=${String(r.length).padStart(4)}` +
      `  T+1 ${pct(med(f1))}  T+3 ${pct(med(f3))}  T+5 ${pct(med(f5))}` +
      `  meanT+5 ${pct(mean(f5))}` +
      `  MFE ${pct(med(mfe))}  MAE ${pct(med(mae))}` +
      `  stopFirst ${pct(sf.length ? sf.filter(Boolean).length / sf.length : null)}` +
      `  win@T+5 ${pct(f5.length ? f5.filter((x) => x > 0).length / f5.length : null)}`,
  );
}

function main(): void {
  const setups = load<Setup>("setups.ndjson");
  const breadth = load<Breadth>("breadth.ndjson");
  const bmap = new Map(breadth.map((b) => [b.session, b]));

  console.log("================ §1 REBUILD, FROM RAW ================");
  console.log(`setups                 ${setups.length}`);
  console.log(`sessions with a setup  ${new Set(setups.map((s) => s.session)).size}`);
  console.log(`symbols                ${new Set(setups.map((s) => s.symbol)).size}`);
  console.log(`date range             ${setups[0]?.session} .. ${setups[setups.length - 1]?.session}`);

  const lv = setups.filter((s) => s.legacyVisible).length;
  const sv = setups.filter((s) => s.shadowVisible).length;
  const h2v = setups.filter((s) => !s.legacyVisible && s.shadowVisible);
  const v2h = setups.filter((s) => s.legacyVisible && !s.shadowVisible);
  const agree = setups.filter((s) => s.legacyVisible === s.shadowVisible);
  console.log(`\nAGREEMENT MATRIX`);
  console.log(`                    shadow SHOWN   shadow HIDDEN`);
  console.log(`  V1 SHOWN    ${String(setups.filter((s) => s.legacyVisible && s.shadowVisible).length).padStart(12)}${String(v2h.length).padStart(16)}`);
  console.log(`  V1 HIDDEN   ${String(h2v.length).padStart(12)}${String(setups.filter((s) => !s.legacyVisible && !s.shadowVisible).length).padStart(16)}`);
  console.log(`  V1 visible ${lv} (${pct(lv / setups.length)}) · shadow visible ${sv} (${pct(sv / setups.length)}) · agreement ${pct(agree.length / setups.length)}`);

  console.log(`\nDIVERGENCE TAXONOMY`);
  const codes = new Map<string, number>();
  for (const s of setups) for (const c of s.divergences) codes.set(c, (codes.get(c) ?? 0) + 1);
  const EXPECTED = new Set(["VISIBILITY_DIVERGENCE", "FEASIBILITY_DIVERGENCE", "SIZING_DIVERGENCE", "STANCE_DIVERGENCE", "VOLUME_PRIMITIVE_DIVERGENCE"]);
  let unexpected = 0;
  for (const [c, n] of [...codes.entries()].sort((a, b) => b[1] - a[1])) {
    const cls = EXPECTED.has(c) ? "EXPECTED" : c === "MISSING_INPUT" ? "UNCLASSIFIED" : "UNEXPECTED";
    if (cls === "UNEXPECTED") unexpected += n;
    console.log(`  ${c.padEnd(30)} ${String(n).padStart(5)}   ${cls}`);
  }
  console.log(`  UNEXPECTED total ${unexpected}`);

  console.log(`\nFEASIBILITY VERDICTS`);
  const fv = new Map<string, number>();
  for (const s of setups) fv.set(s.feasibility, (fv.get(s.feasibility) ?? 0) + 1);
  for (const [k, v] of [...fv.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(26)} ${String(v).padStart(5)}  ${pct(v / setups.length)}`);
  const bf = new Map<string, number>();
  for (const s of setups.filter((x) => x.feasibility === "NOT_FEASIBLE_NOISE")) bf.set(s.bindingFloor, (bf.get(s.bindingFloor) ?? 0) + 1);
  console.log(`  noise rejections by binding floor: ${[...bf.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);

  console.log("\n================ §7 VOLUME PRIMITIVE ================");
  const withVp = setups.filter((s) => s.sameSide != null);
  const dis = withVp.filter((s) => s.sameSide === false).length;
  console.log(`  measurable ${withVp.length} · disagree ${dis} · rate ${pct(dis / withVp.length)}   (prior sample: 22.5%)`);
  const g2 = withVp.map((s) => s.gate2VolRatioMedian!).filter(Number.isFinite);
  const cx = withVp.map((s) => s.contextVolRatioMean!).filter(Number.isFinite);
  console.log(`  gate2 median-denominator  p10 ${qt(g2, 0.1).toFixed(3)} p50 ${qt(g2, 0.5).toFixed(3)} p90 ${qt(g2, 0.9).toFixed(3)}`);
  console.log(`  context mean-denominator  p10 ${qt(cx, 0.1).toFixed(3)} p50 ${qt(cx, 0.5).toFixed(3)} p90 ${qt(cx, 0.9).toFixed(3)}`);

  // what does the gate actually track: own-stock volume, or market participation?
  const bySession = new Map<string, Setup[]>();
  for (const s of setups) {
    const a = bySession.get(s.session) ?? [];
    a.push(s);
    bySession.set(s.session, a);
  }
  const pairs: { passRate: number; advShare: number; medVolRatio: number; ownVol: number }[] = [];
  for (const [d, rows] of bySession) {
    const b = bmap.get(d);
    if (!b || b.medVolRatio == null) continue;
    const withG2 = rows.filter((r) => r.gate2VolRatioMedian != null);
    if (withG2.length < 3) continue;
    pairs.push({
      passRate: withG2.filter((r) => r.gate2VolRatioMedian! >= 1.5).length / withG2.length,
      advShare: b.advShare,
      medVolRatio: b.medVolRatio,
      ownVol: med(withG2.map((r) => r.gate2VolRatioMedian!)),
    });
  }
  const corr = (a: number[], b: number[]) => {
    const ma = mean(a), mb = mean(b);
    const num = a.reduce((s, x, i) => s + (x - ma) * (b[i]! - mb), 0);
    const da = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0));
    const db = Math.sqrt(b.reduce((s, x) => s + (b[0] !== undefined ? (x - mb) ** 2 : 0), 0));
    void db;
    const db2 = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0));
    return num / (da * db2);
  };
  if (pairs.length > 30) {
    console.log(`  sessions with >=3 setups: ${pairs.length}`);
    console.log(`  corr(volume-gate pass rate, market advancing share) = ${corr(pairs.map((p) => p.passRate), pairs.map((p) => p.advShare)).toFixed(3)}`);
    console.log(`  corr(volume-gate pass rate, market median vol ratio) = ${corr(pairs.map((p) => p.passRate), pairs.map((p) => p.medVolRatio)).toFixed(3)}`);
    console.log(`  corr(setup own vol ratio,   market median vol ratio) = ${corr(pairs.map((p) => p.ownVol), pairs.map((p) => p.medVolRatio)).toFixed(3)}`);
  }

  console.log("\n================ §3 ANCHOR 2026-08-21 ================");
  const anchorRows = setups.filter((s) => s.session === ANCHOR);
  const b21 = bmap.get(ANCHOR);
  console.log(`  raw market state: advShare ${pct(b21?.advShare ?? null)} · advVolShare ${pct(b21?.advVolShare ?? null)} · medVolRatio ${b21?.medVolRatio?.toFixed(2) ?? "n/a"} · aboveMA20 ${pct(b21?.shareAboveMa20 ?? null)}`);
  console.log(`  setups generated on the anchor: ${anchorRows.length}`);
  if (anchorRows.length) {
    console.log(`    gate1 ${anchorRows[0]!.gate1} · marketRiskClass ${anchorRows[0]!.marketRiskClass}`);
    console.log(`    V1 visible ${anchorRows.filter((s) => s.legacyVisible).length} · shadow visible ${anchorRows.filter((s) => s.shadowVisible).length}`);
    console.log(`    hidden->visible ${anchorRows.filter((s) => !s.legacyVisible && s.shadowVisible).length} · visible->hidden ${anchorRows.filter((s) => s.legacyVisible && !s.shadowVisible).length}`);
    const vg = anchorRows.filter((s) => s.gate2VolRatioMedian != null);
    console.log(`    volume gate >=1.5 pass: ${vg.filter((s) => s.gate2VolRatioMedian! >= 1.5).length}/${vg.length}`);
    for (const s of anchorRows) {
      console.log(`      ${s.symbol.padEnd(5)} q=${s.quality} vol=${s.gate2VolRatioMedian?.toFixed(2) ?? "n/a"} feas=${s.feasibility} V1=${s.legacyVisible ? "SHOWN" : "HIDDEN"} shadow=${s.shadowVisible ? "SHOWN" : "HIDDEN"} risk=${pct(s.riskFrac)}`);
    }
  }
  // window around the anchor
  const win = setups.filter((s) => s.session >= "2026-08-14" && s.session <= ANCHOR);
  console.log(`  setups in 2026-08-14..${ANCHOR}: ${win.length} across ${new Set(win.map((s) => s.session)).size} sessions`);

  console.log("\n================ §4/§5 DIVERGENCE POPULATIONS ================");
  console.log("  (forward returns are OUTCOME LABELS; control = setups where V1 and shadow agree)");
  outcomes(h2v, "hidden -> visible");
  outcomes(agree.filter((s) => s.legacyVisible), "control: both SHOWN");
  outcomes(agree.filter((s) => !s.legacyVisible), "control: both HIDDEN");
  outcomes(v2h, "visible -> hidden");
  outcomes(setups, "all setups");

  console.log("\n  §5 detail — is the decomposed stop model rejecting winners?");
  const v2hStrong = v2h.filter((s) => s.fwd5 != null && s.fwd5 > 0.05);
  const bothShownStrong = agree.filter((s) => s.legacyVisible && s.fwd5 != null && s.fwd5 > 0.05);
  console.log(`    visible->hidden with T+5 > +5%: ${v2hStrong.length}/${v2h.filter((s) => s.fwd5 != null).length} = ${pct(v2hStrong.length / Math.max(1, v2h.filter((s) => s.fwd5 != null).length))}`);
  console.log(`    both-shown control   T+5 > +5%: ${bothShownStrong.length}/${agree.filter((s) => s.legacyVisible && s.fwd5 != null).length} = ${pct(bothShownStrong.length / Math.max(1, agree.filter((s) => s.legacyVisible && s.fwd5 != null).length))}`);

  console.log("\n================ §6 REGIME COHORTS ================");
  const shares = breadth.map((b) => b.advShare).sort((a, b) => a - b);
  const p10 = qt(shares, 0.1), p30 = qt(shares, 0.3), p70 = qt(shares, 0.7), p90 = qt(shares, 0.9);
  console.log(`  advancing-share cutoffs: p10 ${pct(p10)} p30 ${pct(p30)} p70 ${pct(p70)} p90 ${pct(p90)}`);
  const cohortOf = (d: string): string | null => {
    const b = bmap.get(d);
    if (!b) return null;
    if (b.advShare >= p90) return "strong (top decile)";
    if (b.advShare <= p10) return "weak (bottom decile)";
    if (b.advShare > p30 && b.advShare < p70) return "ordinary (d4-d7)";
    return null;
  };
  console.log(`  2026-08-21 cohort: ${cohortOf(ANCHOR) ?? "between cohorts"}`);
  for (const name of ["strong (top decile)", "ordinary (d4-d7)", "weak (bottom decile)"]) {
    const rows = setups.filter((s) => cohortOf(s.session) === name);
    if (!rows.length) { console.log(`\n  ${name}: no setups`); continue; }
    const sess = new Set(rows.map((s) => s.session)).size;
    const vgr = rows.filter((s) => s.gate2VolRatioMedian != null);
    console.log(`\n  ${name}  sessions=${sess} setups=${rows.length} (${(rows.length / sess).toFixed(2)}/session)`);
    console.log(`    V1 visible ${pct(rows.filter((s) => s.legacyVisible).length / rows.length)} · shadow visible ${pct(rows.filter((s) => s.shadowVisible).length / rows.length)}`);
    console.log(`    hidden->visible ${pct(rows.filter((s) => !s.legacyVisible && s.shadowVisible).length / rows.length)} · visible->hidden ${pct(rows.filter((s) => s.legacyVisible && !s.shadowVisible).length / rows.length)}`);
    console.log(`    volume gate pass ${pct(vgr.length ? vgr.filter((s) => s.gate2VolRatioMedian! >= 1.5).length / vgr.length : null)}`);
    outcomes(rows, "    forward");
  }
}

main();
