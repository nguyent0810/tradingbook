/**
 * Relative strength vs VNINDEX diagnostic — read-only overlay on Gate 2 results.
 * Does NOT change scanner rules, rankScore, pass/fail, or SetupCandidate persistence.
 *
 * Usage:
 *   npx tsx scripts/rs-gate2-diagnostic.ts
 *   npx tsx scripts/rs-gate2-diagnostic.ts --limit=30
 *   npx tsx scripts/rs-gate2-diagnostic.ts --symbols=HPG,FPT
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { evaluateBreakoutPullbackCandidate } from "../src/lib/scanner/gate2/breakout-pullback";
import {
  computeRelativeStrengthDiagnostic,
  RS_LOOKBACK_20,
  RS_LOOKBACK_50,
} from "../src/lib/scanner/gate2/relative-strength";
import { formatRelativeStrengthDiagnosticForUi } from "../src/lib/scanner/gate2/rs-diagnostic-format";
import { terminalGate2Reason } from "../src/lib/scanner/gate2-scan-diagnostics";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const symbolFilter = parseSymbols(argv);

  console.error("rs-gate2-diagnostic.ts → DATABASE_URL:", describeDatabaseUrl());

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    console.log(JSON.stringify({ error: "No VNINDEX session date." }, null, 2));
    process.exit(1);
  }

  const indexRows = await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX" },
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
  const indexBars = indexRows.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));

  let symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  if (symbolFilter) {
    const set = new Set(symbolFilter);
    symbols = symbols.filter((s) => set.has(s.symbol));
  }

  const rows: Record<string, unknown>[] = [];
  let evaluated = 0;

  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(
      prisma,
      s.id,
      expectedLatestSession
    );
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
    const stockBars = dbBars.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const ev = evaluateBreakoutPullbackCandidate(stockBars, expectedLatestSession);
    const rs = computeRelativeStrengthDiagnostic(
      stockBars,
      indexBars,
      expectedLatestSession
    );

    const rs20 = rs?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_20);
    const rs50 = rs?.returns.find((r) => r.lookbackSessions === RS_LOOKBACK_50);

    const rsUi = rs ? formatRelativeStrengthDiagnosticForUi(rs) : null;
    rows.push({
      symbol: s.symbol,
      gate2Quality: ev.quality,
      terminalCategory: ev.quality === "INVALID" ? terminalGate2Reason(ev) : null,
      rankScore: ev.rankScore,
      relativeStrength: rs
        ? {
            summary: rsUi!.summary,
            lines: rsUi!.lines,
            disclaimer: rsUi!.disclaimer,
            rs20SpreadPct: rs20?.rsSpreadPct ?? null,
            rs50SpreadPct: rs50?.rsSpreadPct ?? null,
            dualUptrendMa50: rs.dualUptrendMa50,
            stockLeadingMa50: rs.stockLeadingMa50,
          }
        : null,
    });

    evaluated++;
    if (limit != null && evaluated >= limit) break;
  }

  const qualityCounts = { A: 0, B: 0, INVALID: 0 };
  for (const r of rows) {
    const q = r.gate2Quality as keyof typeof qualityCounts;
    if (q in qualityCounts) qualityCounts[q]++;
  }

  const withRs = rows.filter((r) => r.relativeStrength != null);
  const abWithRs = withRs.filter((r) => r.gate2Quality === "A" || r.gate2Quality === "B");
  const invalidWithPositiveRs20 = withRs.filter((r) => {
    if (r.gate2Quality !== "INVALID") return false;
    const rs = r.relativeStrength as { rs20SpreadPct: number | null };
    return rs.rs20SpreadPct != null && rs.rs20SpreadPct > 0;
  });

  console.log(
    JSON.stringify(
      {
        disclaimer:
          "Diagnostic only — RS metrics do not change Gate 2 pass/fail, rankScore, or persisted SetupCandidate rows.",
        expectedLatestSession: expectedLatestSession.toISOString(),
        tradableEvaluated: evaluated,
        gate2QualityCounts: qualityCounts,
        rsCoverage: {
          withRsMetrics: withRs.length,
          tierABWithRs: abWithRs.length,
          invalidWithPositiveRs20: invalidWithPositiveRs20.length,
        },
        hypotheticalNotes: {
          positiveRs20Invalid:
            "INVALID names with RS20>0 are candidates for false negatives if RS were a hard filter — review before any rule change.",
          tierABNegativeRs20:
            "Tier A/B with RS20<0 would be false positives under an RS hard filter — none expected until A/B exist in sample.",
        },
        rows,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
