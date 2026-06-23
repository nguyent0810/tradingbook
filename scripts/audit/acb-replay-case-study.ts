/**
 * ACB early-entry case study — walk-forward replay (audit only).
 *
 * Usage:
 *   npx tsx scripts/audit/acb-replay-case-study.ts
 *   npx tsx scripts/audit/acb-replay-case-study.ts --json
 *   npx tsx scripts/audit/acb-replay-case-study.ts --fixture
 *   npx tsx scripts/audit/acb-replay-case-study.ts --from=2026-05-01 --to=2026-06-30
 */
import "../load-env";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { sortDedupeGate2Bars } from "../../src/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import {
  evaluateEarlyEntrySession,
  findEventSessions,
  parseFixtureBars,
  tradeStateDisplayLabel,
  type EarlyEntryEvaluationResult,
  type ReplayFixture,
} from "./early-reversal-detector";

const FIXTURE_PATH = resolve(
  process.cwd(),
  "docs/quant-audit/fixtures/acb-replay-real.json"
);
const FIXTURE_FALLBACK = resolve(
  process.cwd(),
  "docs/quant-audit/fixtures/acb-replay.json"
);

function parseDateArg(prefix: string, fallback: string): string {
  const raw = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return raw ? raw.slice(prefix.length + 1) : fallback;
}

function toGate2Bars(
  rows: Array<{
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>
): Gate2BarInput[] {
  return rows.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

async function loadFromDb(symbol: string): Promise<{
  stockBars: Gate2BarInput[];
  indexBars: Gate2BarInput[];
  source: string;
} | null> {
  const sym = await prisma.stockSymbol.findUnique({
    where: { symbol },
    select: { id: true },
  });
  if (!sym) return null;

  const stockRows = await prisma.stockDailyBar.findMany({
    where: { symbolId: sym.id },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });

  const indexRows = await prisma.indexDailyBar.findMany({
    where: { indexSymbol: "VNINDEX" },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });

  if (stockRows.length < 60 || indexRows.length < 60) return null;

  return {
    stockBars: toGate2Bars(stockRows),
    indexBars: toGate2Bars(indexRows),
    source: "postgres",
  };
}

function loadFromFixture(): {
  stockBars: Gate2BarInput[];
  indexBars: Gate2BarInput[];
  source: string;
} {
  const path = existsSync(FIXTURE_PATH) ? FIXTURE_PATH : FIXTURE_FALLBACK;
  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${FIXTURE_PATH} or ${FIXTURE_FALLBACK}`);
  }
  const fixture = JSON.parse(readFileSync(path, "utf8")) as ReplayFixture;
  return {
    stockBars: parseFixtureBars(fixture.stockBars),
    indexBars: parseFixtureBars(fixture.indexBars),
    source: `fixture:${path} (${fixture.source})`,
  };
}

function saveFixture(
  stockBars: Gate2BarInput[],
  indexBars: Gate2BarInput[],
  source: string
): void {
  const dir = resolve(process.cwd(), "docs/quant-audit/fixtures");
  mkdirSync(dir, { recursive: true });
  const fixture: ReplayFixture = {
    symbol: "ACB",
    generatedAt: new Date().toISOString(),
    source,
    stockBars: stockBars.map((b) => ({
      date: b.date.toISOString().slice(0, 10),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    })),
    indexBars: indexBars.map((b) => ({
      date: b.date.toISOString().slice(0, 10),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    })),
  };
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2), "utf8");
  console.error(`Saved fixture: ${FIXTURE_PATH} (${stockBars.length} stock bars)`);
}

function sessionsInRange(
  bars: Gate2BarInput[],
  from: string,
  to: string
): Date[] {
  const sorted = sortDedupeGate2Bars(bars);
  return sorted
    .filter((b) => {
      const k = b.date.toISOString().slice(0, 10);
      return k >= from && k <= to;
    })
    .map((b) => b.date);
}

function formatMarkdownTable(results: EarlyEntryEvaluationResult[]): string {
  const lines = [
    "| Date | Close | MA20 | MA50 | Vol | VolMA20 | RS20 | Current State | Proposed State | Reason Codes |",
    "|------|-------|------|------|-----|---------|------|---------------|----------------|--------------|",
  ];
  for (const r of results) {
    const m = r.metrics;
    lines.push(
      `| ${r.metrics.sessionDate} | ${m.close.toFixed(2)} | ${m.ma20?.toFixed(2) ?? "-"} | ${m.ma50?.toFixed(2) ?? "-"} | ${Math.round(m.volume)} | ${m.volumeMa20 != null ? Math.round(m.volumeMa20) : "-"} | ${m.rs20SpreadPct != null ? m.rs20SpreadPct.toFixed(1) : "-"} | Gate2 INVALID | **${tradeStateDisplayLabel(r.proposedTradeState)}** | ${r.reasonCodes.slice(0, 5).join(", ") || "-"} |`
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");
  const forceFixture = process.argv.includes("--fixture");
  const saveFixtureFlag = process.argv.includes("--save-fixture");
  const from = parseDateArg("--from", "2026-05-01");
  const to = parseDateArg("--to", "2026-06-30");

  console.error(`DB: ${describeDatabaseUrl()}`);

  let loaded: { stockBars: Gate2BarInput[]; indexBars: Gate2BarInput[]; source: string } | null =
    null;

  if (!forceFixture) {
    try {
      loaded = await loadFromDb("ACB");
    } catch (err) {
      console.error(`DB load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!loaded) {
    console.error("Falling back to fixture...");
    loaded = loadFromFixture();
  } else if (saveFixtureFlag) {
    saveFixture(loaded.stockBars, loaded.indexBars, loaded.source);
  }

  const { stockBars, indexBars, source } = loaded;
  const sessions = sessionsInRange(stockBars, from, to);

  const results: EarlyEntryEvaluationResult[] = [];
  for (const sessionDate of sessions) {
    const row = evaluateEarlyEntrySession({ stockBars, indexBars, sessionDate });
    if (row) results.push(row);
  }

  const events = findEventSessions(results);
  const eventDates = new Set(events.map((e) => e.metrics.sessionDate));
  const focusResults = results.filter(
    (r) =>
      eventDates.has(r.metrics.sessionDate) ||
      r.proposedTradeState === "PILOT_BUY" ||
      r.proposedTradeState === "CONFIRMED_BUY" ||
      r.proposedTradeState === "ADD_ZONE"
  );

  const displayResults =
    focusResults.length >= 5
      ? focusResults
      : results.filter((_, i) => i % Math.max(1, Math.floor(results.length / 15)) === 0);

  const output = {
    symbol: "ACB",
    source,
    window: { from, to },
    sessionCount: results.length,
    eventCount: events.length,
    events: events.map((e) => ({
      date: e.metrics.sessionDate,
      proposedState: tradeStateDisplayLabel(e.proposedTradeState),
      reasonCodes: e.reasonCodes,
      earlyReversalScore: e.earlyReversalScore,
      rr: e.metrics.riskRewardRatio,
      whyNotPilotYet: e.whyNotPilotYet,
    })),
    sessions: displayResults,
    markdownTable: formatMarkdownTable(displayResults),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("\n# ACB Early-Entry Replay\n");
    console.log(`Source: ${source}`);
    console.log(`Window: ${from} → ${to} (${results.length} sessions)\n`);
    console.log("## Key events\n");
    for (const e of events) {
      console.log(
        `- **${e.metrics.sessionDate}**: ${tradeStateDisplayLabel(e.proposedTradeState)} — ${e.reasonCodes.join(", ")} [score=${e.earlyReversalScore}, R:R=${e.metrics.riskRewardRatio?.toFixed(2) ?? "n/a"}${e.whyNotPilotYet ? `, why-not: ${e.whyNotPilotYet}` : ""}]`
      );
    }
    console.log("\n## Session table\n");
    console.log(output.markdownTable);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
