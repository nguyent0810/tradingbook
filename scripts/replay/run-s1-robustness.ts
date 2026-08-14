/**
 * S1 robustness, answering the independent review's HIGH/CRITICAL findings.
 *
 *   R1  moving-block bootstrap over the session timeline, with a block longer
 *       than the 20-session outcome horizon. Answers the objection that quarter
 *       clustering fractures dependency at calendar boundaries: 34.8% of setups
 *       have a forward window crossing one.
 *   R2  widened intervals for the decisive cell, to check whether the new-era
 *       DISCARDED upper bound stays below the 33.3% reference once the measured
 *       under-coverage of the percentile bootstrap (93.4% vs 95%) is absorbed.
 *   R3  the stratified within-WARNING contrast the review says should have been
 *       primary, with block-bootstrap intervals.
 *
 *   npx tsx scripts/replay/run-s1-robustness.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";

const REFERENCE = 1 / 3;
const B = 20_000;
/** Longer than the 20-session outcome horizon, so a block contains whole windows. */
const BLOCK_SESSIONS = 30;

type Row = {
  sessionDate: string;
  gate1: "PASS" | "WARNING" | "FAIL";
  quality: "A" | "B";
  population: "RETAINED" | "DISCARDED";
  outcome: string | null;
};

const era = (d: string) => (d < "2022-01-01" ? "old" : "new");
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const rate = (rs: Row[]) =>
  rs.length === 0 ? NaN : rs.filter((r) => r.outcome === "CONTINUATION").length / rs.length;

/**
 * Moving-block bootstrap on the session axis. Blocks are contiguous runs of
 * `BLOCK_SESSIONS` distinct session dates drawn from the pooled calendar, so a
 * setup and everything whose outcome window overlaps it travel together —
 * including across a quarter boundary.
 */
function blockBootstrap(
  rs: Row[],
  allDates: string[],
  seed: number,
  b = B,
): { lo: number; hi: number; se: number; q(p: number): number } {
  const byDate = new Map<string, Row[]>();
  for (const r of rs) {
    const a = byDate.get(r.sessionDate) ?? [];
    a.push(r);
    byDate.set(r.sessionDate, a);
  }
  const nBlocks = Math.max(1, Math.ceil(allDates.length / BLOCK_SESSIONS));
  const starts = allDates.length - BLOCK_SESSIONS + 1;
  const rand = rng(seed);
  const draws: number[] = [];
  for (let i = 0; i < b; i++) {
    let cont = 0;
    let n = 0;
    for (let k = 0; k < nBlocks; k++) {
      const s0 = starts > 0 ? Math.floor(rand() * starts) : 0;
      for (let d = s0; d < Math.min(s0 + BLOCK_SESSIONS, allDates.length); d++) {
        for (const r of byDate.get(allDates[d]!) ?? []) {
          n++;
          if (r.outcome === "CONTINUATION") cont++;
        }
      }
    }
    if (n > 0) draws.push(cont / n);
  }
  draws.sort((a, z) => a - z);
  const mean = draws.reduce((a, x) => a + x, 0) / draws.length;
  const se = Math.sqrt(draws.reduce((a, x) => a + (x - mean) ** 2, 0) / (draws.length - 1));
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))]!;
  return { lo: q(0.025), hi: q(0.975), se, q };
}

function main(): void {
  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const scored = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");

  const datesAll = [...new Set(scored.map((r) => r.sessionDate))].sort();
  const datesByEra = {
    old: datesAll.filter((d) => era(d) === "old"),
    new: datesAll.filter((d) => era(d) === "new"),
  };

  console.log(`block bootstrap: ${BLOCK_SESSIONS}-session blocks over ${datesAll.length} distinct session dates`);
  console.log(`(the outcome horizon is 20 sessions, so a block contains whole windows)\n`);

  console.log("=== R1 — quarter clusters vs moving blocks that span quarter boundaries ===");
  console.log("cell                 n    rate      block-bootstrap 95% CI     SE");
  const cells: Array<[string, Row[], string[]]> = [
    ["RETAINED all", scored.filter((r) => r.population === "RETAINED"), datesAll],
    ["DISCARDED all", scored.filter((r) => r.population === "DISCARDED"), datesAll],
    ["RETAINED new", scored.filter((r) => r.population === "RETAINED" && era(r.sessionDate) === "new"), datesByEra.new],
    ["DISCARDED new", scored.filter((r) => r.population === "DISCARDED" && era(r.sessionDate) === "new"), datesByEra.new],
    ["DISCARDED old", scored.filter((r) => r.population === "DISCARDED" && era(r.sessionDate) === "old"), datesByEra.old],
  ];
  const ci = new Map<string, ReturnType<typeof blockBootstrap>>();
  for (const [label, rs, ds] of cells) {
    const c = blockBootstrap(rs, ds, 777 + label.length);
    ci.set(label, c);
    console.log(
      `${label.padEnd(18)} ${String(rs.length).padStart(4)}   ${pct(rate(rs)).padStart(7)}   [${pct(c.lo)}, ${pct(c.hi)}]   ${pct(c.se)}`,
    );
  }

  console.log("\n=== R2 — is the decisive cell robust to widening for measured under-coverage? ===");
  const dn = ci.get("DISCARDED new")!;
  const rsDn = scored.filter((r) => r.population === "DISCARDED" && era(r.sessionDate) === "new");
  console.log(`  DISCARDED new-era rate ${pct(rate(rsDn))} (n=${rsDn.length}); reference ${pct(REFERENCE)}`);
  for (const lvl of [0.95, 0.975, 0.99, 0.995]) {
    const hi = dn.q(1 - (1 - lvl) / 2);
    console.log(
      `  ${(100 * lvl).toFixed(1)}% interval upper bound ${pct(hi)}  → ${hi < REFERENCE ? "still BELOW the reference" : "reaches the reference"}`,
    );
  }

  console.log("\n=== R3 — the stratified contrast the review says should have been primary ===");
  console.log("inside WARNING, market state held fixed");
  for (const e of [null, "old", "new"] as const) {
    const ds = e ? datesByEra[e] : datesAll;
    const sel = (q: "A" | "B") =>
      scored.filter((r) => r.gate1 === "WARNING" && r.quality === q && (e ? era(r.sessionDate) === e : true));
    const a = sel("A"), b = sel("B");
    const ca = blockBootstrap(a, ds, 4001), cb = blockBootstrap(b, ds, 4002);
    console.log(
      `  ${(e ?? "all").padEnd(4)} A(kept) n=${String(a.length).padStart(3)} ${pct(rate(a))} [${pct(ca.lo)}, ${pct(ca.hi)}]  ` +
      `B(dropped) n=${String(b.length).padStart(3)} ${pct(rate(b))} [${pct(cb.lo)}, ${pct(cb.hi)}]  diff ${((rate(b) - rate(a)) * 100).toFixed(2)}pp`,
    );
  }
}

main();
