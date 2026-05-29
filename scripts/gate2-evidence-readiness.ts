/**
 * Gate 2 evidence coverage / readiness — diagnostic only.
 *
 * Usage:
 *   npx tsx scripts/gate2-evidence-readiness.ts --json
 *   npx tsx scripts/gate2-evidence-readiness.ts "--windows=40,60,80,120,160" --json
 *   npx tsx scripts/gate2-evidence-readiness.ts --limit=30
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import type { Gate2BarInput } from "../src/lib/scanner/gate2/types";
import {
  aggregateLookbackReadiness,
  buildEvidenceReadinessReport,
  buildSnapshotsForLookback,
  formatReadinessTable,
  summarizeSymbolBars,
} from "../src/lib/scanner/gate2/gate2-evidence-readiness";
import type { ReplayRowGate2Snapshot } from "../src/lib/scanner/gate2/gate2-evidence-readiness";
import { describeDatabaseUrl } from "./load-env";

const DEFAULT_WINDOWS = [40, 60, 80, 120, 160];

function parseWindows(argv: string[]): number[] {
  const raw = argv.find((a) => a.startsWith("--windows="));
  if (!raw) return DEFAULT_WINDOWS;
  return raw
    .slice("--windows=".length)
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseLimit(argv: string[]): number | null {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return null;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type SymbolCache = {
  symbol: string;
  allBars: Gate2BarInput[];
  tradable: boolean;
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonOut = argv.includes("--json");
  const windows = parseWindows(argv);
  const limit = parseLimit(argv);

  console.error("gate2-evidence-readiness.ts → DATABASE_URL:", describeDatabaseUrl());

  const anchor = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!anchor) {
    console.error(JSON.stringify({ error: "No VNINDEX session." }, null, 2));
    process.exit(1);
  }

  const activeSymbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const cache: SymbolCache[] = [];
  let tradableAtAnchorCount = 0;

  for (const s of activeSymbols) {
    const tr = await evaluateTradabilityForSymbolId(prisma, s.id, anchor);
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

    if (tr.passed) tradableAtAnchorCount++;
    cache.push({ symbol: s.symbol, allBars, tradable: tr.passed });

    if (limit != null && cache.filter((c) => c.tradable).length >= limit) break;
  }

  const symbolSummaries = cache.map((c) => summarizeSymbolBars(c.symbol, c.allBars, anchor));
  const tradableCache = cache.filter((c) => c.tradable);

  const lookbackWindows = windows.map((lookbackSessions) => {
    const allSnaps: ReplayRowGate2Snapshot[] = [];
    const fwdSnaps: ReplayRowGate2Snapshot[] = [];

    for (const c of tradableCache) {
      const { all, forward20Eligible } = buildSnapshotsForLookback({
        symbol: c.symbol,
        allBars: c.allBars,
        lookbackSessions,
        requireForward20d: true,
      });
      allSnaps.push(...all);
      fwdSnaps.push(...forward20Eligible);
    }

    return aggregateLookbackReadiness({
      lookbackSessions,
      tradableSymbolCount: tradableCache.length,
      snapshots: allSnaps,
      forward20EligibleSnapshots: fwdSnaps,
    });
  });

  const report = buildEvidenceReadinessReport({
    anchorSession: anchor.toISOString().slice(0, 10),
    activeSymbolCount: activeSymbols.length,
    symbolSummaries,
    tradableAtAnchorCount,
    lookbackWindows,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    ...report,
  };

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatReadinessTable(report));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
