/**
 * DEV-ONLY dashboard seed — makes every Command Deck dashboard section render
 * populated (non-empty) states against a LOCAL Postgres.
 *
 * Safe / idempotent / removable:
 *  - Refuses to run unless DATABASE_URL points at localhost/127.0.0.1.
 *  - All records are tagged with SEED_TAG ("DEV_DASHBOARD_SEED") via source /
 *    notes.seedTag / trade notes, and the script deletes its own tagged records
 *    before re-creating them, so re-running is a clean upsert (no duplicates).
 *  - Cleanup: `npx tsx scripts/dev/seed-dashboard-dev.ts --clean`
 *
 * Run: `npx tsx scripts/dev/seed-dashboard-dev.ts`
 *
 * Anchoring (critical): every "latest" bar, candidate barDate, market-context
 * sessionDate and notes session strings land on ANCHOR = 2026-07-03 (UTC), the
 * session the dashboard resolves from the latest VNINDEX bar.
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SEED_TAG = "DEV_DASHBOARD_SEED";
const ANCHOR = new Date(Date.UTC(2026, 6, 3)); // 2026-07-03
const N = 150; // weekday bars per symbol (>=120 tradability floor)
const DEMO_EMAIL = "demo@tradelog.local";

type BarRow = { date: Date; open: number; high: number; low: number; close: number; volume: number };

const round2 = (x: number) => Math.round(x * 100) / 100;

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  const masked = url.replace(/:[^:@/]+@/, ":***@");
  if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL is not localhost — got ${masked}. DEV ONLY.`);
  }
  if (/neon\.tech|amazonaws|supabase|\.render\.com/i.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL looks hosted — ${masked}.`);
  }
}

/** N weekday (Mon–Fri) dates ending exactly at `anchor`, ascending, UTC-midnight. */
function weekdayDatesEndingAt(anchor: Date, n: number): Date[] {
  const dates: Date[] = [];
  const d = new Date(anchor);
  while (dates.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.unshift(new Date(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates;
}

function ma(vals: number[], i: number, n: number): number {
  const start = Math.max(0, i - n + 1);
  const slice = vals.slice(start, i + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function barsFromCloses(closes: number[], dates: Date[], baseVol: number): BarRow[] {
  return closes.map((c, i) => {
    const prev = i > 0 ? closes[i - 1] : c;
    const o = prev;
    const hi = Math.max(o, c) * 1.006;
    const lo = Math.min(o, c) * 0.994;
    const v = Math.round(baseVol * (0.85 + 0.3 * Math.abs(Math.sin(i * 0.7))));
    return { date: dates[i], open: round2(o), high: round2(hi), low: round2(lo), close: round2(c), volume: v };
  });
}

/** Gently rising benchmark: last close > MA50, last 3 strictly rising → regime PASS. */
function vnindexCloses(): number[] {
  const out: number[] = [];
  for (let i = 0; i < N; i++) out.push(round2(1180 + (i * 150) / (N - 1)));
  return out;
}

/** Healthy uptrend for surfaced candidates (bars only need tradability + health). */
function uptrendCloses(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const base = from + ((to - from) * i) / (N - 1);
    out.push(round2(base + 0.6 * Math.sin(i * 0.5)));
  }
  return out;
}

/**
 * RS-lane near-miss shape → Gate2 `trend_below_ma50` (final close < MA50) while the
 * 20-session return still beats VNINDEX (RS20 > 0). Big lift inside the MA50 window
 * pumps MA50 above the final close; the last 20 bars rise off a low so RS20 stays positive.
 */
function nearMissBelowMa50Closes(scale: number): number[] {
  const c: number[] = new Array(N);
  const iPeak = N - 30; // peak inside MA50 window
  const iLow = N - 20; // low that the last 20 bars rise from
  // Gentle amplitude: final close sits just below MA50 and near MA20 (so the early-entry
  // evaluator does not flag it "Too Extended"), while RS20 stays just above the index.
  for (let i = 0; i < N; i++) {
    let v: number;
    if (i <= N - 50) v = 0.95 + (0.02 * i) / Math.max(1, N - 50); // gentle pre-window drift
    else if (i <= iPeak) v = 0.96 + (0.16 * (i - (N - 50))) / (iPeak - (N - 50)); // 0.96 → 1.12
    else if (i <= iLow) v = 1.12 - (0.16 * (i - iPeak)) / (iLow - iPeak); // 1.12 → 0.96
    else v = 0.96 + (0.04 * (i - iLow)) / (N - 1 - iLow); // 0.96 → 1.00 (final below MA50, near MA20)
    c[i] = round2(v * scale);
  }
  return c;
}

function volAt(baseVol: number, i: number): number {
  return Math.round(baseVol * (0.85 + 0.3 * Math.abs(Math.sin(i * 0.7))));
}

/**
 * Build a full N-bar series: a gentle history ramp (histFrom→histTo, relative) then an
 * explicit relative-OHLC tail ([close, high, low] × scale). Lets us hit specific Gate2
 * terminal codes deterministically (verified in-script against the real evaluator).
 */
function buildRelBars(
  histFrom: number,
  histTo: number,
  tail: [number, number, number][],
  dates: Date[],
  scale: number,
  baseVol: number
): BarRow[] {
  const K = tail.length;
  const H = N - K;
  const bars: BarRow[] = [];
  const histClose = (i: number) => (histFrom + ((histTo - histFrom) * i) / (H - 1)) * scale;
  for (let i = 0; i < H; i++) {
    const c = histClose(i);
    const o = i > 0 ? histClose(i - 1) : c;
    bars.push({ date: dates[i], open: round2(o), high: round2(Math.max(o, c) * 1.008), low: round2(Math.min(o, c) * 0.992), close: round2(c), volume: volAt(baseVol, i) });
  }
  for (let t = 0; t < K; t++) {
    const [rc, rh, rl] = tail[t];
    const i = H + t;
    bars.push({ date: dates[i], open: bars[i - 1].close, high: round2(rh * scale), low: round2(rl * scale), close: round2(rc * scale), volume: volAt(baseVol, i) });
  }
  return bars;
}

// HPG → `breakout_recency`: a real push happens at L-11 (just OUTSIDE the 10-bar recency
// window), then price drifts below that peak high, so no qualifying breakout in [L-10, L-1].
const HPG_TAIL: [number, number, number][] = [
  [1.11, 1.12, 1.1], [1.13, 1.14, 1.12], [1.15, 1.16, 1.14], [1.16, 1.17, 1.15],
  [1.17, 1.185, 1.16], [1.16, 1.168, 1.15], [1.155, 1.163, 1.145], [1.15, 1.158, 1.14],
  [1.145, 1.153, 1.135], [1.14, 1.148, 1.13], [1.14, 1.148, 1.13], [1.14, 1.148, 1.13],
  [1.14, 1.148, 1.13], [1.14, 1.148, 1.13], [1.14, 1.148, 1.13], [1.14, 1.148, 1.13],
];

// VCB → `pullback_zone_interaction`: trend OK, a breakout at L-6 with a digestion dip that
// holds, but the final bar's LOW floats just above the breakout level (no zone interaction).
// Kept a SMALL float (close near MA20) so the early-entry evaluator does not tag it
// "Too Extended" — that lets the workbench label it "Wait better zone" (not "Avoid chase").
const VCB_TAIL: [number, number, number][] = [
  [1.03, 1.04, 1.02], [1.035, 1.045, 1.025], [1.03, 1.04, 1.02], [1.04, 1.05, 1.03],
  [1.035, 1.045, 1.025], [1.03, 1.04, 1.02], [1.04, 1.05, 1.03], [1.035, 1.045, 1.025],
  [1.04, 1.05, 1.03], [1.075, 1.085, 1.05], [1.07, 1.078, 1.055], [1.072, 1.08, 1.062],
  [1.073, 1.081, 1.063], [1.074, 1.082, 1.064], [1.075, 1.083, 1.065], [1.076, 1.084, 1.066],
];

async function cleanup() {
  console.log(`[seed] cleanup: removing ${SEED_TAG}-tagged records…`);
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (user) {
    await prisma.trade.deleteMany({ where: { userId: user.id, notes: { contains: SEED_TAG } } });
  }
  await prisma.symbolMarketContextDaily.deleteMany({ where: { sessionDate: ANCHOR } });
  await prisma.marketContextDaily.deleteMany({ where: { sessionDate: ANCHOR } });
  await prisma.setupWatchItem.deleteMany({ where: { symbol: { name: { contains: SEED_TAG } } } });
  // Deleting the scan run cascades its SetupCandidate rows.
  await prisma.dailyScanRun.deleteMany({ where: { notes: { path: ["seedTag"], equals: SEED_TAG } } });
  await prisma.stockDailyBar.deleteMany({ where: { source: SEED_TAG } });
  await prisma.indexDailyBar.deleteMany({ where: { source: SEED_TAG } });
  console.log("[seed] cleanup done.");
}

async function main() {
  assertLocalDb();
  const clean = process.argv.includes("--clean");
  await cleanup();
  if (clean) {
    console.log("[seed] --clean only; exiting.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    throw new Error(`Demo user ${DEMO_EMAIL} not found. Register it at /register first.`);
  }

  const dates = weekdayDatesEndingAt(ANCHOR, N);
  console.log(`[seed] ${N} weekday bars, ${dates[0].toISOString().slice(0, 10)} … ${dates[N - 1].toISOString().slice(0, 10)} (anchor)`);

  // ── Symbols ──
  const symbolDefs = [
    { symbol: "FPT", sector: "tech", lane: "candidate" as const, level: 95 },
    { symbol: "MWG", sector: "retail", lane: "candidate" as const, level: 55 },
    { symbol: "HPG", sector: "industrial", lane: "nearmiss" as const, level: 28 },
    { symbol: "VCB", sector: "bank", lane: "nearmiss" as const, level: 90 },
    { symbol: "SSI", sector: "securities", lane: "nearmiss" as const, level: 50 },
  ];
  const symbolIds: Record<string, string> = {};
  for (const s of symbolDefs) {
    const row = await prisma.stockSymbol.upsert({
      where: { symbol: s.symbol },
      update: { exchange: "HOSE", name: `${s.symbol} (${SEED_TAG})`, active: true },
      create: { symbol: s.symbol, exchange: "HOSE", name: `${s.symbol} (${SEED_TAG})`, active: true },
    });
    symbolIds[s.symbol] = row.id;
  }

  // ── VNINDEX benchmark bars ──
  const idxCloses = vnindexCloses();
  const idxBars = barsFromCloses(idxCloses, dates, 300_000_000);
  await prisma.indexDailyBar.createMany({
    data: idxBars.map((b) => ({ symbol: "VNINDEX", ...b, source: SEED_TAG })),
    skipDuplicates: true,
  });
  const idxRs20 = idxCloses[N - 1] / idxCloses[N - 21] - 1;

  // ── Per-symbol stock bars ──
  const closesBySymbol: Record<string, number[]> = {};
  const barsBySymbol: Record<string, BarRow[]> = {};
  const buildBars = (sym: string, level: number): BarRow[] => {
    switch (sym) {
      case "HPG":
        return buildRelBars(0.82, 1.09, HPG_TAIL, dates, level / 1.14, 1_600_000);
      case "VCB":
        return buildRelBars(0.8, 1.04, VCB_TAIL, dates, level / 1.076, 1_600_000);
      case "SSI":
        return barsFromCloses(nearMissBelowMa50Closes(level), dates, 1_600_000);
      default:
        return barsFromCloses(uptrendCloses(level * 0.72, level), dates, 1_600_000);
    }
  };
  for (const s of symbolDefs) {
    const bars = buildBars(s.symbol, s.level);
    barsBySymbol[s.symbol] = bars;
    closesBySymbol[s.symbol] = bars.map((b) => b.close);
    await prisma.stockDailyBar.createMany({
      data: bars.map((b) => ({ symbolId: symbolIds[s.symbol], ...b, source: SEED_TAG })),
      skipDuplicates: true,
    });
  }

  // ── Self-check the fragile RS-lane symbols against the REAL Gate2 evaluator ──
  console.log(`[seed] RS self-check (index RS20 baseline = ${(idxRs20 * 100).toFixed(2)}%):`);
  const wantCode: Record<string, string> = {
    HPG: "breakout_recency",
    VCB: "pullback_zone_interaction",
    SSI: "trend_below_ma50",
  };
  for (const s of symbolDefs.filter((x) => x.lane === "nearmiss")) {
    const c = closesBySymbol[s.symbol];
    const rs20 = c[N - 1] / c[N - 21] - 1;
    const evalRes = evaluateBreakoutPullbackCandidate(barsBySymbol[s.symbol], ANCHOR);
    const code = evalRes.terminalCode ?? evalRes.quality;
    const ok = code === wantCode[s.symbol] && rs20 > idxRs20;
    console.log(
      `   ${s.symbol}: terminalCode=${code} (want ${wantCode[s.symbol]}) rs20=${(rs20 * 100).toFixed(2)}% beatsIndex=${rs20 > idxRs20} ${ok ? "✓" : "✗ CHECK"}`
    );
  }

  // ── Daily scan run (COMPLETED, PASS) + surfaced candidates (FPT, MWG) ──
  const anchorStr = ANCHOR.toISOString().slice(0, 10);
  const scan = await prisma.dailyScanRun.create({
    data: {
      runAt: new Date(Date.UTC(2026, 6, 3, 9, 30)),
      startedAt: new Date(Date.UTC(2026, 6, 3, 9, 0)),
      finishedAt: new Date(Date.UTC(2026, 6, 3, 9, 30)),
      gate1Level: "PASS",
      status: "COMPLETED",
      symbolCountTotal: 5,
      symbolCountScanned: 5,
      symbolCountFailed: 0,
      symbolCountAfterTradability: 5,
      symbolCountFilteredOut: 0,
      candidateCountA: 1,
      candidateCountB: 1,
      candidateCountSurfaced: 2,
      setupCandidatesCreated: 2,
      notes: {
        seedTag: SEED_TAG,
        decision: { level: "NORMAL", allocation: "50-70%", explanation: "Market supportive; valid setups available." },
        topRejectionCategories: { breakout_recency: 3, pullback_zone_interaction: 2, trend_below_ma50: 1 },
        rejectionSymbolsByCategory: { breakout_recency: ["HPG"], pullback_zone_interaction: ["VCB"], trend_below_ma50: ["SSI"] },
        closestToValidSymbols: [
          { symbol: "HPG", terminalCategory: "breakout_recency", terminalCode: "breakout_recency", stageRank: 8, partialPipelineScore: 0.8, reasonLineCount: 5, terminalReasonPreview: "needs fresh breakout", rankScore: 12.5, close: 28, breakoutLevel: 28.5, pullbackZoneLow: 27, pullbackZoneHigh: 28.5, stopLevel: 26.5 },
        ],
        recommendation: { likelyBottleneck: "breakout_recency", summary: "Most names failing on breakout recency.", note: "Wait for fresh pushes above range highs." },
        benchmarkBackdrop: { vnindexSessionDate: anchorStr, equityBarsMaxDate: anchorStr, delayedBackdrop: false },
        sessionCoverage: { expectedSessionDate: anchorStr, universeScanned: 5, tradabilityEvaluated: 5, tradabilityPassed: 5, staleSessionCount: 0, staleSessionFrac: 0, sessionAlignedCount: 5, sessionAlignedFrac: 1, weakCoverage: false, headline: `Full coverage on ${anchorStr}`, operatorWarning: null },
      },
    },
  });

  const candidateDefs = [
    { symbol: "FPT", quality: "A" as const, close: 95, breakoutLevel: 96, low: 93.5, high: 96, stop: 92, rank: 14.2 },
    { symbol: "MWG", quality: "B" as const, close: 55, breakoutLevel: 55.5, low: 54, high: 55.6, stop: 52.5, rank: 11.6 },
  ];
  for (const c of candidateDefs) {
    await prisma.setupCandidate.create({
      data: {
        scanRunId: scan.id,
        symbolId: symbolIds[c.symbol],
        setupType: "BREAKOUT_PULLBACK",
        quality: c.quality,
        close: c.close,
        breakoutLevel: c.breakoutLevel,
        pullbackZoneLow: c.low,
        pullbackZoneHigh: c.high,
        stopLevel: c.stop,
        reasons: ["Trend OK: price above rising MA20/MA50.", "Fresh breakout above range high with expansion.", `Tier ${c.quality} — strong participation and clean structure.`],
        rankScore: c.rank,
        barDate: ANCHOR,
      },
    });
  }

  // ── Watch items (lifecycle in {NEW,WATCHING,READY}) ──
  const watchDefs = [
    { symbol: "FPT", quality: "A" as const, status: "READY" as const, health: "HEALTHY" as const, score: 88 },
    { symbol: "MWG", quality: "B" as const, status: "WATCHING" as const, health: "WARNING" as const, score: 64 },
    { symbol: "VCB", quality: "B" as const, status: "NEW" as const, health: "HEALTHY" as const, score: 80 },
  ];
  for (const w of watchDefs) {
    await prisma.setupWatchItem.upsert({
      where: { symbolId_setupType: { symbolId: symbolIds[w.symbol], setupType: "BREAKOUT_PULLBACK" } },
      update: { lifecycleStatus: w.status, quality: w.quality, healthLevel: w.health, healthScore: w.score, lastSeenScanRunId: scan.id, lastHealthEvaluatedAt: ANCHOR },
      create: {
        symbolId: symbolIds[w.symbol],
        setupType: "BREAKOUT_PULLBACK",
        quality: w.quality,
        lifecycleStatus: w.status,
        breakoutLevel: 100,
        pullbackZoneLow: 97,
        pullbackZoneHigh: 100,
        firstSeenBarDate: new Date(Date.UTC(2026, 5, 20)),
        lastSeenScanRunId: scan.id,
        healthLevel: w.health,
        healthScore: w.score,
        lastHealthEvaluatedAt: ANCHOR,
      },
    });
  }

  // ── Market context (Evidence Grid foreign flow) ──
  await prisma.marketContextDaily.create({
    data: {
      sessionDate: ANCHOR,
      vnindexClose: idxCloses[N - 1],
      vnindexMa20: ma(idxCloses, N - 1, 20),
      vnindexMa50: ma(idxCloses, N - 1, 50),
      vnindexVolume: 300_000_000,
      vnindexVolMa20: 290_000_000,
      vnindexVolRatioMa20: 1.1,
      gate1Level: "PASS",
      foreignNetValue1d: 120_000_000_000,
      foreignNetValue5d: 450_000_000_000,
      foreignNetValue10d: -80_000_000_000,
      foreignSymbolsOk: 5,
      foreignSymbolsTotal: 5,
      foreignCoveragePct: 100,
      symbolsBuilt: 5,
    },
  });
  for (const s of symbolDefs) {
    const c = closesBySymbol[s.symbol];
    await prisma.symbolMarketContextDaily.create({
      data: {
        sessionDate: ANCHOR,
        symbolId: symbolIds[s.symbol],
        close: c[N - 1],
        volume: 1_600_000,
        volMa20: 1_500_000,
        volRatioMa20: 1.06,
        foreignNetValue1d: s.sector === "bank" ? 60_000_000_000 : 12_000_000_000,
        foreignNetValue5d: 40_000_000_000,
        foreignNetValue10d: -5_000_000_000,
        foreignDataQuality: "OK",
      },
    });
  }

  // ── Trades (Ledger Pulse + Signal Trajectory + exposure) ──
  const tradeNote = `${SEED_TAG} dev fixture`;
  const trades = [
    { symbol: "FPT", status: "OPEN" as const, entry: 88, qty: 1000, entryDate: Date.UTC(2026, 5, 24) },
    { symbol: "MWG", status: "OPEN" as const, entry: 51, qty: 1500, entryDate: Date.UTC(2026, 5, 26) },
    { symbol: "HPG", status: "CLOSED" as const, entry: 25, exit: 27.5, qty: 2000, entryDate: Date.UTC(2026, 5, 10), exitDate: Date.UTC(2026, 5, 20), pnl: 5000, r: 1.6, outcome: "WIN" as const },
    { symbol: "SSI", status: "CLOSED" as const, entry: 52, exit: 49.5, qty: 1200, entryDate: Date.UTC(2026, 5, 12), exitDate: Date.UTC(2026, 5, 23), pnl: -3000, r: -1.0, outcome: "LOSS" as const },
    { symbol: "VCB", status: "CLOSED" as const, entry: 84, exit: 90, qty: 800, entryDate: Date.UTC(2026, 5, 15), exitDate: Date.UTC(2026, 5, 30), pnl: 4800, r: 2.1, outcome: "WIN" as const },
  ];
  for (const t of trades) {
    await prisma.trade.create({
      data: {
        userId: user.id,
        symbol: t.symbol,
        direction: "LONG",
        status: t.status,
        entryDate: new Date(t.entryDate),
        entryPrice: t.entry,
        quantity: t.qty,
        exitDate: "exitDate" in t && t.exitDate ? new Date(t.exitDate) : null,
        exitPrice: "exit" in t ? t.exit : null,
        realizedPnl: "pnl" in t ? t.pnl : null,
        rMultiple: "r" in t ? t.r : null,
        outcome: "outcome" in t ? t.outcome : null,
        notes: tradeNote,
      },
    });
  }

  // ── Paper Validation file (non-Prisma; minimal valid store → available:true) ──
  const evidenceDir = path.join(process.cwd(), "docs", "trading", "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, "early-entry-paper-signals.json"),
    JSON.stringify({ version: 1, updatedAt: "2026-07-03T00:00:00.000Z", signals: [] }, null, 2),
    "utf8"
  );

  console.log("[seed] done. Sections seeded: symbols, VNINDEX+stock bars, scan+candidates, watch items, market context, trades, paper-signals file.");
}

main()
  .catch((err) => {
    console.error("[seed] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
