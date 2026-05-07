/**
 * Fresh breakout / momentum continuation audit lane (read-only diagnostics).
 *
 * Observational only:
 * Fresh breakout audit is observational only and does not represent validated core setups.
 *
 * Usage:
 *   npx tsx scripts/fresh-breakout-audit.ts
 *   npx tsx scripts/fresh-breakout-audit.ts --json
 *   npx tsx scripts/fresh-breakout-audit.ts --limit=40
 *   npx tsx scripts/fresh-breakout-audit.ts --symbols=GEX,GEE
 *   npx tsx scripts/fresh-breakout-audit.ts --tradable-only --limit=30
 *   npx tsx scripts/fresh-breakout-audit.ts --include-failed-risk
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import {
  computeEffectiveScanUniverse,
  listActiveTacticalSymbols,
  type UniverseSource,
} from "../src/lib/tactical-universe";
import { evaluateTradability } from "../src/lib/scanner/tradability";
import {
  FRESH_BREAKOUT_AUDIT_DISCLAIMER,
  classifyFreshBreakout,
  compareFreshBreakoutRows,
  computeFreshBreakoutMetrics,
  determineFreshBreakoutGroup,
  shouldIncludeFreshBreakoutRow,
  type FreshBreakoutAuditGroup,
} from "../src/lib/scanner/fresh-breakout-audit";

type Row = {
  symbol: string;
  universeSource: UniverseSource;
  tradabilityPassed: boolean;
  tradabilityReasons: string[];
  latestBarDate: string;
  staleSession: boolean;
  close: number;
  volume: number;
  ma20: number | null;
  ma50: number | null;
  closeAbovePriorNDayHigh: boolean;
  priorNDayHigh: number | null;
  volumeRatio20: number | null;
  breakoutExtensionPct: number | null;
  distanceFromMa20Pct: number | null;
  distanceFromMa50Pct: number | null;
  labels: string[];
  riskAnnotations: string[];
  notes: string[];
  group: FreshBreakoutAuditGroup;
};

function parseLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return 30;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 30;
}

function parseSymbols(argv: string[]): string[] {
  const i = argv.findIndex((a) => a.startsWith("--symbols="));
  if (i < 0) return [];
  const tokens: string[] = [argv[i]!.slice("--symbols=".length)];
  for (let j = i + 1; j < argv.length; j++) {
    const part = argv[j]!;
    if (part.startsWith("--")) break;
    tokens.push(part);
  }
  return tokens
    .join(" ")
    .replace(/[,;]+/g, " ")
    .split(/\s+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function hasJsonFlag(argv: string[]): boolean {
  return argv.includes("--json");
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function fmtNum(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function pad(s: string, w: number): string {
  const t = s.length > w ? `${s.slice(0, w - 1)}…` : s;
  return t.padEnd(w, " ");
}

function printTable(rows: Row[]): void {
  const header = `${pad("symbol", 8)}${pad("src", 10)}${pad("trad", 6)}${pad("stale", 7)}${pad(
    "close",
    9
  )}${pad("vR20", 8)}${pad("ext%", 8)}${pad("dMA20%", 9)}${pad("labels", 34)}${pad(
    "risks",
    24
  )}`;
  console.log(header);
  console.log("-".repeat(Math.min(header.length, 180)));
  for (const r of rows) {
    console.log(
      `${pad(r.symbol, 8)}${pad(r.universeSource, 10)}${pad(r.tradabilityPassed ? "PASS" : "FAIL", 6)}${pad(
        r.staleSession ? "Y" : "N",
        7
      )}${pad(fmtNum(r.close, 2), 9)}${pad(fmtNum(r.volumeRatio20, 2), 8)}${pad(
        fmtNum(r.breakoutExtensionPct, 2),
        8
      )}${pad(fmtNum(r.distanceFromMa20Pct, 2), 9)}${pad(r.labels.join(","), 34)}${pad(
        r.riskAnnotations.join(","),
        24
      )}`
    );
  }
}

function groupRows(rows: Row[]): Record<FreshBreakoutAuditGroup, Row[]> {
  return rows.reduce(
    (acc, row) => {
      acc[row.group].push(row);
      return acc;
    },
    {
      ACTIONABLE_WATCH: [],
      EXTENDED_WATCH_ONLY: [],
      AVOID_RISK: [],
      COVERAGE_TRADABILITY_BLOCKED: [],
    } as Record<FreshBreakoutAuditGroup, Row[]>
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const asJson = hasJsonFlag(argv);
  const tradableOnly = hasFlag(argv, "--tradable-only");
  const includeFailedRisk = hasFlag(argv, "--include-failed-risk");
  const filterSymbols = new Set(parseSymbols(argv));
  const now = new Date();

  console.error("fresh-breakout-audit.ts → DATABASE_URL:", describeDatabaseUrl());
  console.error(FRESH_BREAKOUT_AUDIT_DISCLAIMER);

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    console.log(JSON.stringify({ error: "No VNINDEX session date in database." }, null, 2));
    return;
  }

  const coreSymbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });
  const tacticalSymbols = await listActiveTacticalSymbols(prisma, now);
  const tacticalKeys = [...new Set(tacticalSymbols.map((t) => t.symbol.trim().toUpperCase()))];
  const tacticalStockRows =
    tacticalKeys.length === 0
      ? []
      : await prisma.stockSymbol.findMany({
          where: { symbol: { in: tacticalKeys } },
          select: { id: true, symbol: true },
        });
  const stockIdBySymbol = new Map(
    tacticalStockRows.map((s) => [s.symbol.trim().toUpperCase(), s.id] as const)
  );
  const tacticalMatches = tacticalSymbols.map((t) => ({
    tacticalId: t.id,
    tacticalSymbol: t.symbol,
    stockSymbolId: stockIdBySymbol.get(t.symbol.trim().toUpperCase()) ?? null,
  }));
  const effectiveUniverse = computeEffectiveScanUniverse({
    coreRows: coreSymbols,
    tacticalRows: tacticalMatches,
  });

  const selectedUniverse = effectiveUniverse.symbols.filter((row) =>
    filterSymbols.size === 0 ? true : filterSymbols.has(row.symbol)
  );

  const rows: Row[] = [];

  for (const row of selectedUniverse) {
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: row.symbolId },
      orderBy: { date: "asc" },
      select: { date: true, close: true, volume: true },
    });
    const metrics = computeFreshBreakoutMetrics({
      bars,
      expectedLatestSession,
    });
    if (!metrics) continue;
    const tradability = evaluateTradability(
      bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
      expectedLatestSession
    );
    const classification = classifyFreshBreakout({
      metrics,
      tradability,
      recentBars: bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
    });

    rows.push({
      symbol: row.symbol,
      universeSource: row.universeSource,
      tradabilityPassed: tradability.passed,
      tradabilityReasons: tradability.reasons,
      latestBarDate: metrics.latestBarDate.toISOString().slice(0, 10),
      staleSession: metrics.staleSession,
      close: metrics.close,
      volume: metrics.volume,
      ma20: metrics.ma20,
      ma50: metrics.ma50,
      closeAbovePriorNDayHigh: metrics.closeAbovePriorNDayHigh,
      priorNDayHigh: metrics.priorNDayHigh,
      volumeRatio20: metrics.volumeRatio20,
      breakoutExtensionPct: metrics.breakoutExtensionPct,
      distanceFromMa20Pct: metrics.distanceFromMa20Pct,
      distanceFromMa50Pct: metrics.distanceFromMa50Pct,
      labels: classification.labels,
      riskAnnotations: classification.riskAnnotations,
      notes: classification.notes,
      group: determineFreshBreakoutGroup({
        tradabilityPassed: tradability.passed,
        staleSession: metrics.staleSession,
        labels: classification.labels,
      }),
    });
  }

  const filteredRows = rows
    .filter((r) =>
      shouldIncludeFreshBreakoutRow(
        {
          labels: r.labels,
          tradabilityPassed: r.tradabilityPassed,
          staleSession: r.staleSession,
        },
        { includeFailedRisk, tradableOnly }
      )
    )
    .sort(compareFreshBreakoutRows)
    .slice(0, limit);
  const grouped = groupRows(filteredRows);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          disclaimer: FRESH_BREAKOUT_AUDIT_DISCLAIMER,
          generatedAt: new Date().toISOString(),
          expectedLatestSession: expectedLatestSession.toISOString(),
          params: {
            limit,
            symbolsFilter: [...filterSymbols],
            tradableOnly,
            includeFailedRisk,
          },
          universeMerge: effectiveUniverse.stats,
          summary: {
            totalRowsEvaluated: rows.length,
            rowsReturned: filteredRows.length,
            groupCounts: {
              ACTIONABLE_WATCH: grouped.ACTIONABLE_WATCH.length,
              EXTENDED_WATCH_ONLY: grouped.EXTENDED_WATCH_ONLY.length,
              AVOID_RISK: grouped.AVOID_RISK.length,
              COVERAGE_TRADABILITY_BLOCKED: grouped.COVERAGE_TRADABILITY_BLOCKED.length,
            },
          },
          rows: filteredRows,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("");
  const sections: Array<{ group: FreshBreakoutAuditGroup; title: string }> = [
    { group: "ACTIONABLE_WATCH", title: "Actionable Watch (diagnostic)" },
    { group: "EXTENDED_WATCH_ONLY", title: "Extended / Watch-only" },
    { group: "AVOID_RISK", title: "Avoid / Risk" },
    { group: "COVERAGE_TRADABILITY_BLOCKED", title: "Coverage / Tradability Blocked" },
  ];
  for (const section of sections) {
    const bucket = grouped[section.group];
    if (bucket.length === 0) continue;
    console.log(`== ${section.title} ==`);
    printTable(bucket);
    console.log("");
  }
  console.log("");
  console.log(`Rows shown: ${filteredRows.length} (evaluated: ${rows.length})`);
  console.log(
    "Interpretation: labels/risks are diagnostic watchlist signals only. They are not validated core setups."
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
