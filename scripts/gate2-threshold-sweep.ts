/**
 * Gate 2 single-parameter threshold sweep — diagnostic only.
 * Does not change production constants, scanner job, or persistence.
 *
 * Usage:
 *   npx tsx scripts/gate2-threshold-sweep.ts
 *   npx tsx scripts/gate2-threshold-sweep.ts --limit=30
 *   npx tsx scripts/gate2-threshold-sweep.ts --symbols=HPG,FPT
 *   npx tsx scripts/gate2-threshold-sweep.ts --lookbackSessions=40
 *   npx tsx scripts/gate2-threshold-sweep.ts --asOf=2026-05-25
 *   npx tsx scripts/gate2-threshold-sweep.ts --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import type { Gate2BarInput } from "../src/lib/scanner/gate2/types";
import { buildReplayRowsForSymbol } from "../src/lib/scanner/gate2/gate2-replay-dataset";
import {
  loadRsDiagnosticsForSymbols,
  loadVnindexBarsForRs,
} from "../src/lib/scanner/gate2/load-rs-diagnostics";
import {
  formatSweepReportTable,
  runThresholdSweep,
  type SymbolBarsInput,
} from "../src/lib/scanner/gate2/gate2-threshold-sweep";
import { describeDatabaseUrl } from "./load-env";

function parseLimit(argv: string[]): number | null {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return null;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSymbols(argv: string[]): string[] | null {
  const raw = argv.find((a) => a.startsWith("--symbols="));
  if (!raw) return null;
  return raw
    .slice("--symbols=".length)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function parseLookback(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--lookbackSessions="));
  if (!raw) return 1;
  const n = Number.parseInt(raw.slice("--lookbackSessions=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : 1;
}

function parseAsOf(argv: string[]): Date | null {
  const raw = argv.find((a) => a.startsWith("--asOf="));
  if (!raw) return null;
  const parts = raw.slice("--asOf=".length).split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const symbolFilter = parseSymbols(argv);
  const lookbackSessions = parseLookback(argv);
  const asOfOverride = parseAsOf(argv);
  const jsonOut = argv.includes("--json");

  console.error("gate2-threshold-sweep.ts → DATABASE_URL:", describeDatabaseUrl());

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    console.error(JSON.stringify({ error: "No VNINDEX session date." }, null, 2));
    process.exit(1);
  }

  const asOfAnchor = asOfOverride ?? expectedLatestSession;

  let symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  if (symbolFilter) {
    const set = new Set(symbolFilter);
    symbols = symbols.filter((s) => set.has(s.symbol));
  }

  const indexBars = await loadVnindexBarsForRs(prisma);
  const sweepInputs: SymbolBarsInput[] = [];
  let tradableCount = 0;

  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(prisma, s.id, asOfAnchor);
    if (!tr.passed) continue;

    const dbBars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });
    const allBars: Gate2BarInput[] = dbBars.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const replayRows = buildReplayRowsForSymbol({
      symbol: s.symbol,
      allBars,
      lookbackSessions,
      asOf: asOfOverride,
    });
    if (replayRows.length === 0) continue;

    tradableCount++;

    for (const row of replayRows) {
      sweepInputs.push({
        symbol: row.symbol,
        bars: row.bars,
        sessionDate: row.sessionDate,
      });
    }

    if (limit != null && tradableCount >= limit) break;
  }

  const uniqueUnderlying = [
    ...new Set(sweepInputs.map((x) => x.symbol.split("@")[0]!)),
  ];
  const rsMap = await loadRsDiagnosticsForSymbols(
    prisma,
    uniqueUnderlying,
    asOfAnchor,
    indexBars
  );

  for (const row of sweepInputs) {
    const sym = row.symbol.split("@")[0]!;
    row.rsDiagnostic = rsMap.get(sym) ?? null;
  }

  const report = runThresholdSweep({
    asOfSession: asOfAnchor,
    symbols: sweepInputs,
    lookbackSessions,
  });
  report.symbolCount = sweepInputs.length;

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          tradableCount,
          ...report,
        },
        null,
        2
      )
    );
  } else {
    console.log(formatSweepReportTable(report));
    console.log("");
    console.log(
      `Tradable symbols: ${tradableCount} · evaluation rows: ${sweepInputs.length} · anchor: ${asOfAnchor.toISOString().slice(0, 10)} · replayMode: ${report.replayMode} · stale: ${report.staleSessionMismatchCount}`
    );
    console.log("Re-run with --json for full arm detail and RS on changed rows.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
