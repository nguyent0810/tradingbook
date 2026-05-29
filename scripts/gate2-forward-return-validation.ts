/**
 * Gate 2 forward-return validation — diagnostic only.
 * Measures post-evaluation outcomes for baseline tiers, RS-positive INVALID, and sweep flips.
 *
 * Usage:
 *   npx tsx scripts/gate2-forward-return-validation.ts
 *   npx tsx scripts/gate2-forward-return-validation.ts --limit=30
 *   npx tsx scripts/gate2-forward-return-validation.ts --symbols=HPG,FPT
 *   npx tsx scripts/gate2-forward-return-validation.ts --lookbackSessions=40
 *   npx tsx scripts/gate2-forward-return-validation.ts --asOf=2026-05-25
 *   npx tsx scripts/gate2-forward-return-validation.ts --noSweep
 *   npx tsx scripts/gate2-forward-return-validation.ts --includeSweepRejects
 *   npx tsx scripts/gate2-forward-return-validation.ts --json
 *   npx tsx scripts/gate2-forward-return-validation.ts --requireForward20d --lookbackSessions=80 --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import { buildReplayRowsForSymbol } from "../src/lib/scanner/gate2/gate2-replay-dataset";
import type { Gate2BarInput } from "../src/lib/scanner/gate2/types";
import { loadRsDiagnosticsForSymbols } from "../src/lib/scanner/gate2/load-rs-diagnostics";
import { loadVnindexBarsForRs } from "../src/lib/scanner/gate2/load-rs-diagnostics";
import {
  buildForwardReturnValidationReport,
  formatForwardReturnReportTable,
} from "../src/lib/scanner/gate2/forward-return-validation";
import type { Gate2ReplayEvaluationRow } from "../src/lib/scanner/gate2/gate2-replay-dataset";
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
  const includeSweepArms = !argv.includes("--noSweep");
  const includeSweepRejects = argv.includes("--includeSweepRejects");
  const requireForward20d = argv.includes("--requireForward20d");

  console.error(
    "gate2-forward-return-validation.ts → DATABASE_URL:",
    describeDatabaseUrl()
  );

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
  const replayRows: Gate2ReplayEvaluationRow[] = [];
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

    const rows = buildReplayRowsForSymbol({
      symbol: s.symbol,
      allBars,
      lookbackSessions,
      asOf: asOfOverride,
      requireForward20d,
    });
    if (rows.length === 0) continue;

    tradableCount++;
    replayRows.push(...rows);

    if (limit != null && tradableCount >= limit) break;
  }

  const uniqueUnderlying = [
    ...new Set(replayRows.map((r) => r.symbol.split("@")[0]!)),
  ];
  const rsMap = await loadRsDiagnosticsForSymbols(
    prisma,
    uniqueUnderlying,
    asOfAnchor,
    indexBars
  );

  const report = buildForwardReturnValidationReport({
    replayRows,
    rsByUnderlying: rsMap,
    includeSweepArms,
    includeSweepRejects,
    lookbackSessions,
  });

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          tradableCount,
          replayRowCount: replayRows.length,
          requireForward20d,
          report,
        },
        null,
        2
      )
    );
  } else {
    console.log(formatForwardReturnReportTable(report));
    console.log("");
    console.log(
      `Tradable symbols: ${tradableCount} · evaluation rows: ${replayRows.length} · anchor: ${report.anchorSession}`
    );
    console.log(
      includeSweepArms
        ? `Sweep arms included: ${report.sweepArmCount} (use --noSweep to skip)`
        : "Sweep arms skipped (--noSweep)"
    );
    console.log("Archive JSON: re-run with --json for downstream analysis.");
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
