/**
 * READ-ONLY baseline replay over the backfilled history.
 *
 * Answers one question and refuses to answer it prematurely: does the CURRENT
 * strategy have an edge, and where does the failure concentrate? No parameter is
 * tuned here. Nothing is written to the database.
 *
 * Usage:
 *   npx tsx scripts/replay/run-baseline-replay.ts --out docs/trading/replay/baseline.json
 *   npx tsx scripts/replay/run-baseline-replay.ts --min-session 2016-01-01 --limit-symbols 20
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { runReplay, type SymbolSeries } from "../../src/lib/replay/replay-engine";
import type { TradeBar } from "../../src/lib/replay/trade-model";
import type { TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";
import { estimateSurvivorshipExposure } from "../../src/lib/replay/point-in-time-universe";
import { buildReplayReport, judgeEdge } from "../../src/lib/replay/replay-metrics";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const outPath = arg("out");
  const minSession = arg("min-session");
  const maxSession = arg("max-session");
  const limitSymbols = Number(arg("limit-symbols") ?? "0");

  console.error(`run-baseline-replay → DATABASE_URL: ${describeDatabaseUrl()} (read-only)`);
  const started = Date.now();

  const [symbolRows, indexRows, tacticalRows, totalKnown] = await Promise.all([
    // Deliberately NOT filtered by `active`. That flag is today's curation state,
    // and filtering on it here would re-introduce the survivorship bias the
    // point-in-time resolver exists to remove — the resolver would never see a
    // symbol that traded in 2019 but was curated out since. Exclusion must be
    // decided from bar evidence at T, not from a flag edited afterwards.
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }),
    prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    }),
    prisma.tacticalSymbol.findMany({
      select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
    }),
    prisma.stockSymbol.count(),
  ]);

  const symbols = limitSymbols > 0 ? symbolRows.slice(0, limitSymbols) : symbolRows;
  console.error(`symbols=${symbols.length} indexBars=${indexRows.length} tactical=${tacticalRows.length}`);

  // Bars are pulled per symbol rather than in one query: 693k rows in a single
  // result set is a large allocation spike, and the engine needs them grouped and
  // sorted anyway.
  const series: SymbolSeries[] = [];
  let loaded = 0;
  for (const s of symbols) {
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    });
    series.push({ symbolId: s.id, symbol: s.symbol, bars: bars as TradeBar[] });
    loaded += bars.length;
    if (series.length % 50 === 0) {
      console.error(`  loaded ${series.length}/${symbols.length} symbols, ${loaded} bars`);
    }
  }
  console.error(`loaded ${loaded} bars in ${((Date.now() - started) / 1000).toFixed(0)}s`);

  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol,
    addedAt: t.addedAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    status: String(t.status),
    activeForScanner: t.activeForScanner,
  }));

  const runStart = Date.now();
  const result = runReplay({
    series,
    indexBars: indexRows as TradeBar[],
    tactical,
    options: { minSessionDate: minSession, maxSessionDate: maxSession, progressEvery: 200 },
    onProgress: (done, total, sig) =>
      console.error(`  session ${done}/${total} · signals ${sig} · ${((Date.now() - runStart) / 1000).toFixed(0)}s`),
  });

  const report = buildReplayReport(result.signals);
  const verdict = judgeEdge(report);
  const survivorship = estimateSurvivorshipExposure({
    totalSymbolsKnown: totalKnown,
    symbolsWithAnyBars: series.filter((s) => s.bars.length > 0).length,
    replayedUniverseSize: series.length,
  });

  const avgUniverse =
    result.universeSizeBySession.reduce((a, x) => a + x.universe, 0) /
    Math.max(1, result.universeSizeBySession.length);
  const avgTradable =
    result.universeSizeBySession.reduce((a, x) => a + x.tradable, 0) /
    Math.max(1, result.universeSizeBySession.length);

  const artifact = {
    capturedAt: new Date().toISOString(),
    database: describeDatabaseUrl(),
    inputs: {
      symbols: series.length,
      totalBars: loaded,
      indexBars: indexRows.length,
      minSession: minSession ?? null,
      maxSession: maxSession ?? null,
    },
    integrity: {
      guardViolations: result.guardViolations,
      sessionsEvaluated: result.sessionsEvaluated,
      avgUniversePerSession: Number(avgUniverse.toFixed(1)),
      avgTradablePerSession: Number(avgTradable.toFixed(1)),
    },
    survivorship,
    verdict,
    report,
    caveats: [
      "No slippage, fees, T+2 settlement, price bands or position sizing are modelled. These numbers are an UPPER BOUND on live results.",
      "Exit is stop-first else the 20th session close. The scanner defines entry and stop but no exit; 20 is the repo's existing forward horizon.",
      "Entry is the next session's open, because the decision consumed the signal bar's close.",
      "Universe membership is inferred from bar evidence. Symbols with no stored bars cannot be replayed, so results are survivor-conditional.",
    ],
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(0)),
  };

  console.log("\n=== BASELINE REPLAY ===");
  console.log(`sessions evaluated : ${result.sessionsEvaluated}`);
  console.log(`guard violations   : ${result.guardViolations}`);
  console.log(`signals surfaced   : ${report.signalCounts.surfaced}`);
  console.log(`signals scored     : ${report.signalCounts.scored}`);
  console.log(JSON.stringify(report.overall, null, 2));
  console.log(`\nVERDICT: ${verdict.verdict}`);
  for (const r of verdict.reasons) console.log(`  - ${r}`);
  if (verdict.failureConcentration.length) {
    console.log("failure concentrates in:");
    for (const f of verdict.failureConcentration) console.log(`  - ${f}`);
  }

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");
    console.error(`\nWrote replay artifact to ${outPath}`);

    // Per-signal rows alongside the aggregates. The report's breakdowns are
    // one-dimensional, and single dimensions confound: Gate 1 PASS surfaces
    // Tier A and B while WARNING surfaces Tier A only, so comparing the two
    // buckets as reported compares different candidate mixes. Cross-tabs and
    // outlier-excluded cuts need the raw rows, and re-running the replay to
    // get them costs minutes each time.
    const signalsPath = outPath.replace(/\.json$/, "") + ".signals.ndjson";
    writeFileSync(
      signalsPath,
      result.signals
        .map((s) =>
          JSON.stringify({
            symbol: s.symbol,
            sessionDate: s.sessionDate,
            quality: s.quality,
            gate1Level: s.gate1Level,
            rankScore: s.rankScore,
            unscoredReason: s.unscoredReason,
            ...(s.gate1 ?? {}),
            ...(s.trade ?? {}),
          })
        )
        .join("\n") + "\n",
      "utf8"
    );
    console.error(`Wrote ${result.signals.length} signal rows to ${signalsPath}`);
  }

  // A run that read the future is not a baseline; make that fatal.
  if (result.guardViolations > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("run-baseline-replay FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
