/**
 * Prospective recorder — records one settled session into the append-only
 * registry, before its outcome exists.
 *
 * This is a STANDALONE script with zero production call sites (plan §6). The
 * consequence is stated rather than hidden: it must be scheduled, and a missed
 * run is a missed observation that may never be reconstructed — fabricating one
 * later is forbidden, and the late-run guard makes it impossible anyway.
 *
 * The guard (plan §7): if any bar dated after the session already exists in the
 * database, this refuses to write. A run late enough to have seen the outcome is
 * not a prospective observation.
 *
 *   npx tsx scripts/replay/record-prospective-session.ts --session 2026-09-01
 *   npx tsx scripts/replay/record-prospective-session.ts            # newest settled session
 */
import "../load-env";
import { execFileSync } from "node:child_process";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import { evaluateTradability } from "../../src/lib/scanner/tradability";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "../../src/lib/scanner/gate2/breakout-pullback";
import { computeAtr } from "../../src/lib/scanner/stop-feasibility";
import { GATE2_RANGE_DAYS, GATE2_VOL_RATIO_A } from "../../src/lib/scanner/gate2/constants";
import { TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS } from "../../src/lib/scanner/tradability-constants";
import {
  resolvePointInTimeUniverse,
  type SymbolActivityRow,
  type TacticalWindowRow,
} from "../../src/lib/replay/point-in-time-universe";
import { createPointInTimeGuard, isoDay } from "../../src/lib/replay/point-in-time-guard";
import { runShadowSafely, type ShadowCandidateInput } from "../../src/lib/decisions/run-shadow";
import { CLASSIFIER_BLOBS } from "../../src/lib/prospective/registry-schema";
import { appendDecision, verifyClassifierBlobs } from "../../src/lib/prospective/registry-store";
import { buildDecisionEntry, guardSession, runRecorderSafely } from "../../src/lib/prospective/recorder";
import type { Gate2BarInput, Gate1Level } from "../../src/lib/scanner/gate2/types";

function arg(n: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (h) return h.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}
/** Gate 2's own median convention (breakout-pullback.ts:39-44). */
function median(nums: readonly number[]): number {
  if (nums.length === 0) return Number.NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const sma = (xs: readonly number[], n: number) =>
  xs.length >= n ? mean(xs.slice(xs.length - n)) : null;

type Bar = { date: Date; open: number; high: number; low: number; close: number; volume: number };

function lastIdxAtOrBefore(t: readonly number[], x: number): number {
  let lo = 0, hi = t.length - 1, a = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m]! <= x) { a = m; lo = m + 1; } else hi = m - 1; }
  return a;
}

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/prospective";
  console.error(`prospective recorder → ${describeDatabaseUrl()} (read-only on the database)`);

  // ---- classifier must be byte-identical to the frozen version (plan §1) ----
  const blobs = verifyClassifierBlobs((p) => execFileSync("git", ["hash-object", p], { encoding: "utf-8" }).trim());
  if (!blobs.ok) {
    console.error("REFUSED: classifier drifted from the frozen version");
    for (const m of blobs.mismatches) console.error(`  ${m}`);
    console.error("Version the cohort (plan §10) rather than mixing classifier versions.");
    await prisma.$disconnect();
    process.exit(2);
  }

  // ---- the late-run guard needs the newest bar anywhere in the table ----
  const maxStock = await wr(() => prisma.stockDailyBar.aggregate({ _max: { date: true } }));
  const maxIndex = await wr(() => prisma.indexDailyBar.aggregate({ _max: { date: true } }));
  const maxBarDateInDb = [maxStock._max.date, maxIndex._max.date]
    .filter((d): d is Date => d != null)
    .map(isoDay)
    .sort()
    .pop() ?? null;

  const session = arg("session") ?? maxBarDateInDb;
  if (!session) {
    console.error("REFUSED: no bars in the database, so there is no session to record.");
    await prisma.$disconnect();
    process.exit(2);
  }

  const idxRows = (await wr(() => prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX", date: { lte: new Date(session) } },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  }))) as Bar[];
  const idxTimes = idxRows.map((b) => b.date.getTime());
  const lastIndexBar = idxRows.length ? isoDay(idxRows[idxRows.length - 1]!.date) : null;

  const gate = guardSession({ session, maxBarDateInDb, lastInputBarDate: lastIndexBar });
  if (!gate.ok) {
    console.error(`REFUSED (${gate.refusal}): ${gate.detail}`);
    console.error(
      gate.refusal === "OUTCOME_DATA_ALREADY_EXISTS"
        ? "This run is late. The outcome is already knowable, so the observation would not be prospective."
        : gate.refusal === "BEFORE_PROSPECTIVE_BOUNDARY"
          ? "The prospective boundary is frozen and may never be moved backwards."
          : "The session has not settled in this database yet.",
    );
    await prisma.$disconnect();
    process.exit(3);
  }

  const sessionMs = Date.parse(session);
  const guardPit = createPointInTimeGuard(session, { throwOnViolation: true });
  const recordedAt = new Date().toISOString();
  const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim();

  // ---- Gate 1, index bars through T only ----
  const ie = lastIdxAtOrBefore(idxTimes, sessionMs);
  if (ie < 49) {
    console.error("REFUSED: not enough index history to evaluate Gate 1.");
    await prisma.$disconnect();
    process.exit(3);
  }
  const regime = evaluateMarketRegime(
    guardPit.decisionRows("gate1", idxRows.slice(0, ie + 1)).map((b) => ({
      time: b.date.getTime(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    })),
  );
  const gate1 = regime.level as Gate1Level;

  // ---- point-in-time universe from bars <= T ----
  const symRows = await wr(() => prisma.stockSymbol.findMany({
    where: { bars: { some: {} } },
    select: { id: true, symbol: true, exchange: true },
    orderBy: { symbol: "asc" },
  }));
  const tacticalRows = await wr(() => prisma.tacticalSymbol.findMany({
    select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
  }));
  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol, addedAt: t.addedAt.toISOString(), expiresAt: t.expiresAt.toISOString(),
    status: String(t.status), activeForScanner: t.activeForScanner,
  }));

  // Trailing features need roughly a year; the query is bounded at T so no bar
  // after the decision session is ever loaded into this process.
  const featureFrom = new Date(sessionMs - 420 * 86_400_000);
  const lookbackFrom = sessionMs - TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS * 86_400_000;

  const activity: SymbolActivityRow[] = [];
  const windows = new Map<string, Bar[]>();
  const features = new Map<string, Bar[]>();
  const exchanges = new Map<string, string | null>();

  let loaded = 0;
  for (const s of symRows) {
    const bars = (await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: s.id, date: { gte: featureFrom, lte: new Date(sessionMs) } },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    }))) as Bar[];
    const firstEver = await wr(() => prisma.stockDailyBar.findFirst({
      where: { symbolId: s.id }, orderBy: { date: "asc" }, select: { date: true },
    }));
    if (!bars.length) {
      activity.push({ symbolId: s.id, symbol: s.symbol, barsInWindow: 0, lastBarDate: null, firstBarDateEver: firstEver ? isoDay(firstEver.date) : null });
      continue;
    }
    const times = bars.map((b) => b.date.getTime());
    const start = lastIdxAtOrBefore(times, lookbackFrom) + 1;
    windows.set(s.symbol, bars.slice(start));
    features.set(s.symbol, bars);
    exchanges.set(s.symbol, s.exchange);
    activity.push({
      symbolId: s.id, symbol: s.symbol, barsInWindow: bars.length - start,
      lastBarDate: isoDay(bars[bars.length - 1]!.date),
      firstBarDateEver: firstEver ? isoDay(firstEver.date) : null,
    });
    if (++loaded % 60 === 0) console.error(`  loaded ${loaded}/${symRows.length}`);
  }

  const universe = resolvePointInTimeUniverse({ sessionDate: session, activity, tactical });
  console.error(`session ${session} · gate1 ${gate1} · universe ${universe.members.length}`);

  let considered = 0, valid = 0, written = 0, refused = 0, errors = 0;

  for (const member of universe.members) {
    const w = windows.get(member.symbol);
    const feat = features.get(member.symbol);
    if (!w || !w.length || !feat) continue;
    considered++;

    const bounded = guardPit.decisionRows(`bars:${member.symbol}`, w);
    if (!evaluateTradability(bounded as never, new Date(sessionMs)).passed) continue;

    const ev = evaluateBreakoutPullbackCandidate(bounded as unknown as Gate2BarInput[], new Date(sessionMs));
    if (ev.quality === "INVALID") continue;
    valid++;

    // ---- decision-time features, all from bars <= T ----
    const sorted = sortDedupeGate2Bars(bounded as unknown as Gate2BarInput[]);
    const L = sorted.length - 1;
    const prior = sorted.slice(Math.max(0, L - GATE2_RANGE_DAYS), L).map((x) => x.volume);
    const med = median(prior);
    const mu = mean(prior);
    const volRatioMedian = med > 0 ? sorted[L]!.volume / med : null;
    const volRatioMean = mu > 0 ? sorted[L]!.volume / mu : null;
    const last20 = sorted.slice(Math.max(0, L - 19), L + 1);
    const medTradedValueVnd = median(last20.map((x) => x.close * 1000 * x.volume));

    const closes = guardPit.decisionRows(`ma:${member.symbol}`, feat).map((b) => b.close);
    const ma20 = sma(closes, 20);
    const ma50 = sma(closes, 50);

    const input: ShadowCandidateInput = {
      symbol: member.symbol, session, gate1Level: gate1, quality: ev.quality, validity: "VALID",
      entryPriceKVnd: ev.close, structuralStopKVnd: ev.stopLevel,
      atrKVnd: computeAtr(sorted.slice(Math.max(0, L - 40))),
      board: (exchanges.get(member.symbol) as "HOSE" | "HNX" | "UPCOM" | null) ?? "HOSE",
      avgDailyValueVnd: Number.isFinite(medTradedValueVnd) ? medTradedValueVnd : null,
      rankComponents: ev.rankComponents ?? null,
      accountEquityVnd: null, portfolioOpenRiskVnd: null,
      volumePrimitives: {
        gate2VolRatioMedian: volRatioMedian,
        contextVolRatioMean: volRatioMean,
        sameSideOf1_5Cutoff:
          volRatioMedian == null || volRatioMean == null
            ? null
            : (volRatioMedian >= GATE2_VOL_RATIO_A) === (volRatioMean >= GATE2_VOL_RATIO_A),
      },
    };

    const shadow = runShadowSafely(input);
    if (!shadow.ok) { errors++; continue; }
    const rec = shadow.record;

    const built = runRecorderSafely(() => buildDecisionEntry({
      symbol: member.symbol,
      session,
      decisionRecordedAt: recordedAt,
      sourceDataCutoff: session,
      codeSha,
      classifierBlobs: CLASSIFIER_BLOBS,
      entryPriceKVnd: ev.close,
      structuralStopKVnd: ev.stopLevel,
      riskFrac: rec.d2Feasibility.riskFracOfEntry,
      atrKVnd: input.atrKVnd,
      board: input.board,
      avgDailyValueVnd: input.avgDailyValueVnd,
      minStopFrac: rec.d2Feasibility.minStopFrac,
      bindingFloor: rec.d2Feasibility.bindingFloor,
      v1Visibility: rec.legacy.visibility,
      feasibility: rec.d2Feasibility.verdict,
      feasibilityReasons: rec.d2Feasibility.reasons,
      gate1Level: gate1,
      quality: ev.quality,
      validity: "VALID",
      breakoutLevelKVnd: ev.breakoutLevel,
      stopDistancePct: ev.close > 0 ? ((ev.close - ev.stopLevel) / ev.close) * 100 : 0,
      ma20DistPct: ma20 && ma20 > 0 ? ((ev.close - ma20) / ma20) * 100 : null,
      ma50DistPct: ma50 && ma50 > 0 ? ((ev.close - ma50) / ma50) * 100 : null,
      volRatioMedian,
      volRatioMean,
      lastInputBarDate: isoDay(w[w.length - 1]!.date),
      inputBarCount: sorted.length,
    }));
    if (!built.ok) { errors++; console.error(`  ${member.symbol}: ${built.error}`); continue; }

    const res = appendDecision(built.value, outDir);
    if (res.ok) written++;
    else { refused++; console.error(`  ${member.symbol} refused: ${res.refusal} (${res.detail})`); }
  }

  console.log(
    `\n${session} · gate1 ${gate1} · considered ${considered} · gate2-valid ${valid} · ` +
    `written ${written} · refused ${refused} · errors ${errors}`,
  );
  console.log(`registry: ${outDir}/decisions.ndjson`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  // Fail-open at the top level too: a recorder crash is an operational incident,
  // never a corrupted registry, and never a partially-rewritten row.
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
