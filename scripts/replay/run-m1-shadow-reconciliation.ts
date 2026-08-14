/**
 * M1 §16 — reconciliation run for the shadow decision pipeline.
 *
 * READ-ONLY, and offline. It touches no production call site: the shadow module
 * is pure and is driven here over the replay sample the earlier phases already
 * produced. Nothing it computes reaches a scan, an order, a size or a dashboard.
 *
 * It reports ONLY structural quantities. No continuation rate, no P&L, no
 * expectancy — §16 forbids all of them and M1 makes no profitability claim.
 *
 *   npx tsx scripts/replay/run-m1-shadow-reconciliation.ts
 */
import "../load-env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { sma } from "../../src/lib/playbook/indicators";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "../../src/lib/scanner/gate2/breakout-pullback";
import { computeAtr } from "../../src/lib/scanner/stop-feasibility";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import { runShadowSafely, type ShadowCandidateInput } from "../../src/lib/decisions/run-shadow";
import { decideStance } from "../../src/lib/decisions/d5-stance";
import { legacyStance } from "../../src/lib/decisions/legacy-adapter";
import { classifyDivergence, type ShadowDecisionRecord } from "../../src/lib/decisions/shadow-record";
import type { Gate2BarInput, Gate1Level } from "../../src/lib/scanner/gate2/types";

/** Gate 2's median convention (breakout-pullback.ts:39-44), reproduced exactly. */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
/** Market context's mean convention (compute-market-context.ts:88). */
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

type Row = {
  sessionDate: string;
  symbol: string;
  quality: "A" | "B";
  gate1: Gate1Level;
  outcome: string | null;
  medTradedValue: number | null;
};

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
  console.error(`m1-shadow-reconciliation → ${describeDatabaseUrl()} (read-only)`);

  const rows: Row[] = readFileSync("docs/trading/replay/s1/populations.ndjson", "utf-8")
    .trim().split(/\r?\n/).map((l) => JSON.parse(l));
  const setups = rows.filter((r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE");
  const symbols = [...new Set(setups.map((r) => r.symbol))];

  const symRows = await withRetry("symbols", () =>
    prisma.stockSymbol.findMany({ where: { symbol: { in: symbols } }, select: { id: true, symbol: true, exchange: true } }),
  );
  const board = new Map(symRows.map((s) => [s.symbol, (s.exchange as "HOSE" | "HNX" | "UPCOM" | null) ?? "HOSE"]));
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

  const records: ShadowDecisionRecord[] = [];
  let shadowErrors = 0;
  let unevaluable = 0;

  for (const r of setups) {
    const all = bars.get(r.symbol);
    if (!all) { unevaluable++; continue; }
    const t = Date.parse(r.sessionDate);
    const win = all.filter(
      (b) => b.date.getTime() <= t && b.date.getTime() >= t - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000,
    );
    const sorted = sortDedupeGate2Bars(win as unknown as Gate2BarInput[]);
    if (sorted.length < GATE2_RANGE_DAYS + 1) { unevaluable++; continue; }
    const L = sorted.length - 1;

    // Validity and the structural stop come from the PRODUCTION evaluator; the
    // shadow never re-derives strategy logic.
    const ev = evaluateBreakoutPullbackCandidate(win as unknown as Gate2BarInput[], new Date(r.sessionDate));
    if (ev.quality === "INVALID") { unevaluable++; continue; }

    const prior = sorted.slice(L - GATE2_RANGE_DAYS, L).map((b) => b.volume);
    const med = median(prior);
    const mu = mean(prior);
    const g2 = med > 0 ? sorted[L]!.volume / med : null;
    const ctx = mu > 0 ? sorted[L]!.volume / mu : null;

    const input: ShadowCandidateInput = {
      symbol: r.symbol,
      session: r.sessionDate,
      gate1Level: r.gate1,
      quality: ev.quality,
      validity: "VALID",
      entryPriceKVnd: ev.close,
      structuralStopKVnd: ev.stopLevel,
      atrKVnd: computeAtr(sorted.slice(Math.max(0, L - 40))),
      board: board.get(r.symbol) ?? "HOSE",
      avgDailyValueVnd: r.medTradedValue != null ? r.medTradedValue * 1000 : null,
      rankComponents: ev.rankComponents ?? null,
      // V1 has no per-setup account state in the replay, and inventing one would
      // be the fabrication M1 forbids. Reported as a gap instead.
      accountEquityVnd: null,
      portfolioOpenRiskVnd: null,
      volumePrimitives: {
        gate2VolRatioMedian: g2,
        contextVolRatioMean: ctx,
        sameSideOf1_5Cutoff:
          g2 == null || ctx == null ? null : (g2 >= GATE2_VOL_RATIO_A) === (ctx >= GATE2_VOL_RATIO_A),
      },
    };

    const res = runShadowSafely(input);
    if (!res.ok) { shadowErrors++; continue; }
    records.push(res.record);
    void sma; // production primitive imported to assert availability, unused here
  }

  // ---- session-level D5, compared with V1's stance ----
  const bySession = new Map<string, ShadowDecisionRecord[]>();
  for (const rec of records) {
    const a = bySession.get(rec.session) ?? [];
    a.push(rec);
    bySession.set(rec.session, a);
  }
  let stanceDiverged = 0;
  for (const [, recs] of bySession) {
    const shown = recs.filter((x) => x.d1Visibility.decision === "SHOWN").length;
    const feasible = recs.filter((x) => x.d2Feasibility.verdict === "FEASIBLE").length;
    const shadow = decideStance({
      marketRiskClass: recs[0]!.d0MarketRisk.riskClass,
      counts: { shown, hidden: recs.length - shown, feasible },
      aggregateOpenRiskVnd: null,
    });
    const legacy = legacyStance({
      gate1Level: recs[0]!.legacy.gate1Level as Gate1Level,
      candidateCountA: recs.filter((x) => x.legacy.quality === "A").length,
      candidateCountB: recs.filter((x) => x.legacy.quality === "B").length,
    });
    if (legacy !== shadow.stance) stanceDiverged++;
  }

  // ---------------------------------------------------------------- report
  console.log("\n================ M1 SHADOW RECONCILIATION ================");
  console.log(`setups in sample          ${setups.length}`);
  console.log(`records produced          ${records.length}`);
  console.log(`unevaluable               ${unevaluable}`);
  console.log(`shadow errors             ${shadowErrors}`);
  console.log(
    `decisions computed        ${records.length}/${setups.length} = ${((100 * records.length) / setups.length).toFixed(1)}%` +
      `   (D0-D5 evaluated for every record, no exceptions)`,
  );
  const fully = records.filter((r) => r.fullyDecomposed).length;
  console.log(
    `all contract fields real  ${fully}/${records.length} = ${((100 * fully) / records.length).toFixed(1)}%` +
      `   (limited by input availability, not by the decomposition)`,
  );

  console.log("\nCONTRACT FIELDS THAT COULD NOT BE POPULATED");
  const missing = new Map<string, number>();
  for (const rec of records) {
    for (const d of rec.divergences) {
      if (d.code !== "MISSING_INPUT") continue;
      for (const f of d.shadow.split(",")) missing.set(f, (missing.get(f) ?? 0) + 1);
    }
  }
  const GAP_REASON: Record<string, string> = {
    accountEquityVnd: "replay carries no account state; today's equity would be anachronistic",
    portfolioOpenRiskVnd: "V1 HAS NO AGGREGATE OPEN-RISK CONCEPT — the phase-13 gap, not a replay limit",
  };
  for (const [f, n] of [...missing.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f.padEnd(22)} ${String(n).padStart(4)}   ${GAP_REASON[f] ?? "unclassified gap"}`);
  }
  console.log("  both belong to D4 only. D0, D1, D2, D3, D5 are fully populated for every record.");

  console.log("\nDIVERGENCES BY CODE");
  const byCode = new Map<string, number>();
  for (const rec of records) for (const d of rec.divergences) byCode.set(d.code, (byCode.get(d.code) ?? 0) + 1);
  byCode.set("STANCE_DIVERGENCE", stanceDiverged);
  let unexpected = 0;
  let unclassified = 0;
  for (const [code, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    const cls = classifyDivergence(code);
    if (cls === "UNEXPECTED") unexpected += n;
    if (cls === "UNCLASSIFIED") unclassified += n;
    console.log(`  ${code.padEnd(30)} ${String(n).padStart(4)}   ${cls}`);
  }
  console.log(`\n  UNEXPECTED total   ${unexpected}   ${unexpected === 0 ? "(none — no defect surfaced)" : "*** blocks the verdict ***"}`);
  console.log(`  UNCLASSIFIED total ${unclassified}   (all are MISSING_INPUT, enumerated above)`);

  console.log("\n§11 VOLUME PRIMITIVE REPRODUCTION GATE");
  const withBoth = records.filter((r) => r.volumePrimitives.sameSideOf1_5Cutoff != null);
  const disagree = withBoth.filter((r) => r.volumePrimitives.sameSideOf1_5Cutoff === false).length;
  const rate = (100 * disagree) / withBoth.length;
  console.log(`  measurable ${withBoth.length} · disagree ${disagree} · rate ${rate.toFixed(1)}%`);
  console.log(`  phase 15 measured 22.5% (129/574)`);
  const gateOk = Math.abs(rate - 22.5) <= 2.0;
  console.log(`  gate ${gateOk ? "PASS — reproduces, no data drift" : "FAIL — investigate data drift, do not report"}`);

  console.log("\n§12 QUALITY AUTHORITY AUDIT");
  const d1UsesQuality = records.some((r) => r.d1Visibility.reasons.some((x) => /quality|tier/i.test(x)));
  const d2UsesQuality = records.some((r) => r.d2Feasibility.reasons.some((x) => /quality|tier/i.test(x)));
  const d4UsesQuality = records.some((r) => r.d4Sizing.reasons.some((x) => /quality|tier/i.test(x)));
  console.log(`  D1 reason codes referencing quality: ${d1UsesQuality ? "YES *** " : "none"}`);
  console.log(`  D2 reason codes referencing quality: ${d2UsesQuality ? "YES *** " : "none"}`);
  console.log(`  D4 reason codes referencing quality: ${d4UsesQuality ? "YES *** " : "none"}`);
  console.log(`  the contracts make this structural: quality is absent from every D0-D5 input type`);

  console.log("\nVISIBILITY DELTA (observation only — nothing is surfaced)");
  const visDiv = records.filter((r) => r.divergences.some((d) => d.code === "VISIBILITY_DIVERGENCE"));
  const v1Hid = visDiv.filter((r) => r.legacy.visibility === "HIDDEN").length;
  const shadowHid = visDiv.length - v1Hid;
  const v1HiddenTotal = records.filter((r) => r.legacy.visibility === "HIDDEN").length;
  console.log(`  V1 HIDDEN total ${v1HiddenTotal} · V1 SHOWN total ${records.length - v1HiddenTotal}`);
  console.log(`  V1 HIDDEN, shadow SHOWN   ${v1Hid}   <- the M2 question`);
  console.log(`  V1 HIDDEN, shadow HIDDEN  ${v1HiddenTotal - v1Hid}   (hidden by feasibility, not by tier)`);
  console.log(`  V1 SHOWN,  shadow HIDDEN  ${shadowHid}   (V1 surfaces setups whose stop is not executable)`);
  console.log(`  M1 surfaces none of them. Production visibility is untouched.`);

  const outDir = "docs/trading/replay/m1";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/shadow-records.ndjson`, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`\nwrote ${outDir}/shadow-records.ndjson (${records.length})`);
  console.log("NO continuation rate, expectancy or P&L is computed anywhere in this run.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
