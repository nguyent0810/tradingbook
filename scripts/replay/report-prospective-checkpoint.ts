/**
 * Prospective checkpoint report.
 *
 * Two things this script is designed to do, both of them against the operator's
 * short-term interest:
 *
 *  1. It prints operational health at any time (plan §11) — written, missed,
 *     refused, completion rate, integrity.
 *  2. It REFUSES to print a single performance number until an eligible cohort
 *     with settled outcomes reaches a frozen checkpoint (100 / 250 / 500). The
 *     checkpoint cannot be lowered by editing a flag here, because the constants
 *     live in the frozen schema and are asserted by the test suite.
 *
 * Peeking early is the specific failure mode that destroys a prospective study,
 * so the refusal is the point, not an inconvenience.
 *
 * HONEST LIMIT, stated rather than implied: this is a DEFAULT, not a cage. The
 * registry is plain NDJSON on disk, and anyone willing to read it can compute the
 * delta at N=7. No code can prevent that. What the preregistration protects is
 * the meaning of the result — an early look is not evidence, and reporting one
 * would be a violation of the frozen plan, not a clever shortcut around it.
 *
 *   npx tsx scripts/replay/report-prospective-checkpoint.ts
 */
import { readFileSync } from "node:fs";
import {
  BOOTSTRAP_BLOCK_SESSIONS,
  CHECKPOINTS,
  MIN_BOOTSTRAP_BLOCKS,
  OUTCOME_VERSION,
  PROSPECTIVE_START_EXCLUSIVE,
  SCHEMA_VERSION,
} from "../../src/lib/prospective/registry-schema";
import { readDecisions, readOutcomes, verifyRegistry } from "../../src/lib/prospective/registry-store";

function arg(n: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (h) return h.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

/** Deterministic PRNG so a reported interval is reproducible from the registry. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Obs = { session: string; feasible: boolean; fwd5: number };

/**
 * Moving-block bootstrap over NON-OVERLAPPING 30-session blocks, exactly as §9
 * froze it. Quarter clustering is not used because an early cohort spans too few
 * quarters for it to mean anything.
 */
function blockBootstrap(obs: readonly Obs[], replicates = 20_000): {
  delta: number; lo: number; hi: number; blocks: number;
} {
  const sessions = [...new Set(obs.map((o) => o.session))].sort();
  const blockOf = new Map<string, number>();
  sessions.forEach((s, i) => blockOf.set(s, Math.floor(i / BOOTSTRAP_BLOCK_SESSIONS)));
  const blocks: Obs[][] = [];
  for (const o of obs) {
    const b = blockOf.get(o.session)!;
    (blocks[b] ??= []).push(o);
  }
  const present = blocks.filter(Boolean);

  const delta = (rows: readonly Obs[]): number | null => {
    const f = rows.filter((r) => r.feasible).map((r) => r.fwd5);
    const n = rows.filter((r) => !r.feasible).map((r) => r.fwd5);
    return f.length && n.length ? mean(f) - mean(n) : null;
  };

  const point = delta(obs) ?? Number.NaN;
  const rnd = mulberry32(0x5eed);
  const draws: number[] = [];
  for (let r = 0; r < replicates; r++) {
    const rows: Obs[] = [];
    for (let i = 0; i < present.length; i++) rows.push(...present[Math.floor(rnd() * present.length)]!);
    const d = delta(rows);
    if (d != null) draws.push(d);
  }
  draws.sort((a, b) => a - b);
  return {
    delta: point,
    lo: draws.length ? draws[Math.floor(0.025 * draws.length)]! : Number.NaN,
    hi: draws.length ? draws[Math.floor(0.975 * draws.length)]! : Number.NaN,
    blocks: present.length,
  };
}

function main(): void {
  const dir = arg("dir") ?? "docs/trading/replay/prospective";

  const decisions = readDecisions(dir);
  const outcomes = readOutcomes(dir);
  const integrity = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
  const byId = new Map(outcomes.map((o) => [o.setupId, o]));

  const sessions = [...new Set(decisions.map((d) => d.session))].sort();
  const eligible = decisions.filter((d) => d.eligible);
  const settled = eligible.filter((d) => byId.get(d.setupId)?.fwd5 != null);

  console.log(`# Prospective registry — ${SCHEMA_VERSION} / ${OUTCOME_VERSION}`);
  console.log(`boundary (exclusive): ${PROSPECTIVE_START_EXCLUSIVE}\n`);

  console.log("## Operational health (§11 — may be watched continuously)");
  console.log(`sessions recorded      : ${sessions.length}${sessions.length ? ` (${sessions[0]} .. ${sessions[sessions.length - 1]})` : ""}`);
  console.log(`decisions written      : ${decisions.length}`);
  console.log(`eligible for primary   : ${eligible.length}`);
  console.log(`outcomes settled       : ${settled.length}`);
  console.log(`outcome completion     : ${eligible.length ? pct(settled.length / eligible.length) : "n/a"}`);
  console.log(`stale input bars       : ${decisions.filter((d) => d.lastInputBarDate !== d.session).length} (symbol's last bar older than the session)`);
  console.log(`schema mismatches      : ${decisions.filter((d) => d.schemaVersion !== SCHEMA_VERSION).length}`);
  console.log(`classifier mismatches  : ${decisions.filter((d) => d.codeSha !== decisions[0]?.codeSha).length}`);
  console.log(`integrity              : ${integrity.ok ? "OK" : "FAILED"}`);
  if (!integrity.ok) {
    console.log(JSON.stringify({
      hashMismatches: integrity.hashMismatches,
      duplicateSetupIds: integrity.duplicateSetupIds,
      duplicateSymbolSessions: integrity.duplicateSymbolSessions,
      beforeBoundary: integrity.beforeBoundary,
      outcomesWithoutDecision: integrity.outcomesWithoutDecision,
      outcomesBeforeDecision: integrity.outcomesBeforeDecision,
      malformedLines: integrity.malformedLines,
      chainBreaks: integrity.chainBreaks,
      forgedEligibility: integrity.forgedEligibility,
    }, null, 2));
    console.log("\nNo performance number is reported while integrity fails.");
    process.exit(4);
  }

  // ---- the frozen gate on performance reporting ----
  const reached = [...CHECKPOINTS].filter((c) => settled.length >= c).pop();
  console.log(`\n## Primary metric (§9)`);
  if (!reached) {
    const next = CHECKPOINTS.find((c) => settled.length < c)!;
    console.log(`WITHHELD. ${settled.length} settled eligible observations; the first frozen checkpoint is ${next}.`);
    console.log(`No mean, delta, win rate or interval is computed before a checkpoint — an early`);
    console.log(`look is what would make the rest of this cohort uninterpretable.`);
    console.log(`\nExpected wait was disclosed in the plan at freeze time: ~1.2-1.7 years to N=100.`);
    return;
  }

  const obs: Obs[] = settled.map((d) => ({
    session: d.session,
    feasible: d.feasibility === "FEASIBLE",
    fwd5: byId.get(d.setupId)!.fwd5!,
  }));
  const f = obs.filter((o) => o.feasible).map((o) => o.fwd5);
  const n = obs.filter((o) => !o.feasible).map((o) => o.fwd5);
  const bs = blockBootstrap(obs);

  console.log(`checkpoint reached     : N = ${reached} (settled ${settled.length})`);
  console.log(`FEASIBLE               : n = ${f.length}, mean T+5 ${f.length ? pct(mean(f)) : "n/a"}`);
  console.log(`NOT_FEASIBLE_NOISE     : n = ${n.length}, mean T+5 ${n.length ? pct(mean(n)) : "n/a"}`);
  console.log(`delta (primary)        : ${pct(bs.delta)}`);
  console.log(`95% block bootstrap    : [${pct(bs.lo)}, ${pct(bs.hi)}]  over ${bs.blocks} blocks of ${BOOTSTRAP_BLOCK_SESSIONS} sessions`);
  if (bs.blocks < MIN_BOOTSTRAP_BLOCKS) {
    console.log(`\nINDICATIVE ONLY: ${bs.blocks} blocks is below the frozen minimum of ${MIN_BOOTSTRAP_BLOCKS}.`);
    console.log(`This interval carries no inferential weight and may not be cited as evidence.`);
  }

  const src = readFileSync("docs/trading/replay/PROSPECTIVE-REGISTRY-PLAN.md", "utf-8");
  console.log(`\nplan bytes: ${src.length} (the frozen criteria are in that file, not in this script)`);
}

main();
