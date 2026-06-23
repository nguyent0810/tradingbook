/**
 * Early-entry cohort backtest — display-only lane validation (audit).
 *
 * Usage:
 *   npx tsx scripts/audit/early-entry-backtest.ts
 *   npx tsx scripts/audit/early-entry-backtest.ts --json
 *   npx tsx scripts/audit/early-entry-backtest.ts --min-symbols=30
 */
import "../load-env";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import {
  evaluateEarlyEntrySession,
  tradeStateDisplayLabel,
  type EarlyEntryTradeState,
} from "../../src/lib/scanner/early-entry";

type StockBarsFile = Array<{
  symbol: string;
  bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}>;

type IndexBarRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ForwardMetrics = {
  symbol: string;
  sessionDate: string;
  gate2Quality: string;
  earlyState: EarlyEntryTradeState;
  earlyScore: number;
  rr: number | null;
  ret5d: number | null;
  ret10d: number | null;
  ret20d: number | null;
  mae: number | null;
  mfe: number | null;
  rMultiple: number | null;
};

function toGate2Bar(row: {
  time?: number;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Gate2BarInput {
  const date =
    row.date != null
      ? new Date(`${row.date}T00:00:00.000Z`)
      : new Date(row.time!);
  return {
    date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

function forwardReturn(bars: readonly Gate2BarInput[], idx: number, days: number): number | null {
  const target = idx + days;
  if (target >= bars.length) return null;
  const entry = bars[idx]!.close;
  const exit = bars[target]!.close;
  if (!(entry > 0)) return null;
  return ((exit - entry) / entry) * 100;
}

function excursion(
  bars: readonly Gate2BarInput[],
  idx: number,
  days: number
): { mae: number | null; mfe: number | null } {
  const entry = bars[idx]!.close;
  if (!(entry > 0)) return { mae: null, mfe: null };
  let minLow = entry;
  let maxHigh = entry;
  const end = Math.min(bars.length - 1, idx + days);
  for (let i = idx + 1; i <= end; i++) {
    minLow = Math.min(minLow, bars[i]!.low);
    maxHigh = Math.max(maxHigh, bars[i]!.high);
  }
  return {
    mae: ((minLow - entry) / entry) * 100,
    mfe: ((maxHigh - entry) / entry) * 100,
  };
}

function loadCohort(minBars: number): {
  symbols: Map<string, Gate2BarInput[]>;
  indexBars: Gate2BarInput[];
} {
  const stockPath = resolve(process.cwd(), "data/stock-bars.json");
  const indexPath = resolve(process.cwd(), "data/vnindex.json");
  if (!existsSync(stockPath) || !existsSync(indexPath)) {
    throw new Error("Missing data/stock-bars.json or data/vnindex.json");
  }

  const raw = JSON.parse(readFileSync(stockPath, "utf8")) as StockBarsFile;
  const indexRaw = JSON.parse(readFileSync(indexPath, "utf8")) as IndexBarRow[];
  const indexBars = indexRaw.map(toGate2Bar);

  const symbols = new Map<string, Gate2BarInput[]>();
  for (const entry of raw) {
    const bars = entry.bars.map(toGate2Bar).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (bars.length >= minBars) {
      symbols.set(entry.symbol, bars);
    }
  }
  return { symbols, indexBars };
}

function summarize(rows: ForwardMetrics[]) {
  const pilots = rows.filter((r) => r.earlyState === "PILOT_BUY");
  const extended = rows.filter((r) => r.earlyState === "EXTENDED_DO_NOT_CHASE");
  const gateAB = rows.filter((r) => r.gate2Quality === "A" || r.gate2Quality === "B");
  const avg = (vals: number[]) =>
    vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  const falsePilots = pilots.filter((p) => (p.ret10d ?? 0) < 0);
  const missedWinners = rows.filter(
    (r) =>
      r.earlyState === "WATCH" &&
      r.earlyScore >= 55 &&
      (r.ret10d ?? 0) > 5
  );

  return {
    sampleSize: rows.length,
    pilotCount: pilots.length,
    extendedBlocked: extended.length,
    gate2Qualified: gateAB.length,
    avgRet5dPilot: avg(pilots.map((p) => p.ret5d!).filter(Number.isFinite)),
    avgRet10dPilot: avg(pilots.map((p) => p.ret10d!).filter(Number.isFinite)),
    avgRet20dPilot: avg(pilots.map((p) => p.ret20d!).filter(Number.isFinite)),
    avgMaePilot: avg(pilots.map((p) => p.mae!).filter(Number.isFinite)),
    avgMfePilot: avg(pilots.map((p) => p.mfe!).filter(Number.isFinite)),
    falsePilotCount: falsePilots.length,
    missedWinnerCount: missedWinners.length,
    extendedChaseAvoided: extended.filter((e) => (e.ret5d ?? 0) < 0).length,
  };
}

function main() {
  const minSymbols = Number.parseInt(
    process.argv.find((a) => a.startsWith("--min-symbols="))?.split("=")[1] ?? "30",
    10
  );
  const asJson = process.argv.includes("--json");

  const { symbols, indexBars } = loadCohort(80);
  const symbolList = [...symbols.keys()].slice(0, Math.max(minSymbols, 30));

  const rows: ForwardMetrics[] = [];

  for (const symbol of symbolList) {
    const bars = symbols.get(symbol)!;
    for (let idx = 55; idx < bars.length - 21; idx += 5) {
      const session = bars[idx]!.date;
      const gate2 = evaluateBreakoutPullbackCandidate(bars, session);
      const early = evaluateEarlyEntrySession({
        stockBars: bars,
        indexBars,
        sessionDate: session,
        skipLookback: true,
      });
      if (!early) continue;

      const { mae, mfe } = excursion(bars, idx, 10);
      const stopDist = early.metrics.stopDistancePct;
      const rMultiple =
        stopDist != null && stopDist > 0 && mfe != null ? mfe / stopDist : null;

      rows.push({
        symbol,
        sessionDate: session.toISOString().slice(0, 10),
        gate2Quality: gate2.quality,
        earlyState: early.proposedTradeState,
        earlyScore: early.earlyReversalScore,
        rr: early.estimatedRiskReward,
        ret5d: forwardReturn(bars, idx, 5),
        ret10d: forwardReturn(bars, idx, 10),
        ret20d: forwardReturn(bars, idx, 20),
        mae,
        mfe,
        rMultiple,
      });
    }
  }

  const summary = summarize(rows);

  if (asJson) {
    console.log(JSON.stringify({ summary, rows: rows.slice(0, 200) }, null, 2));
    return;
  }

  console.log("Early Entry Backtest (display-only lane)");
  console.log("=========================================");
  console.log(`Cohort symbols: ${symbolList.length}`);
  console.log(`Observation rows: ${summary.sampleSize}`);
  console.log(`PILOT_BUY signals: ${summary.pilotCount}`);
  console.log(`Gate 2 A/B at same sessions: ${summary.gate2Qualified}`);
  console.log(`EXTENDED_DO_NOT_CHASE: ${summary.extendedBlocked} (negative 5d avoided: ${summary.extendedChaseAvoided})`);
  console.log(`Avg pilot 5d/10d/20d return: ${summary.avgRet5dPilot?.toFixed(2)}% / ${summary.avgRet10dPilot?.toFixed(2)}% / ${summary.avgRet20dPilot?.toFixed(2)}%`);
  console.log(`Avg pilot MAE/MFE (10d): ${summary.avgMaePilot?.toFixed(2)}% / ${summary.avgMfePilot?.toFixed(2)}%`);
  console.log(`False pilot count (10d < 0): ${summary.falsePilotCount}`);
  console.log(`Missed winners (WATCH score≥55, 10d>5%): ${summary.missedWinnerCount}`);

  const stateCounts = new Map<string, number>();
  for (const r of rows) {
    const label = tradeStateDisplayLabel(r.earlyState);
    stateCounts.set(label, (stateCounts.get(label) ?? 0) + 1);
  }
  console.log("\nState distribution:");
  for (const [state, count] of stateCounts) {
    console.log(`  ${state}: ${count}`);
  }
}

main();
