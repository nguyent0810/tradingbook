/**
 * Log Early Entry paper-trading research signals to JSON evidence.
 *
 * Usage:
 *   npm run audit:early-entry:paper-log
 *   npx tsx scripts/audit/early-entry-paper-log.ts --seed-historical
 *   npx tsx scripts/audit/early-entry-paper-log.ts --session=2026-05-14
 */
import "../load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { evaluateBreakoutPullbackCandidate } from "../../src/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "../../src/lib/scanner/gate2/types";
import { evaluateMarketRegime } from "../../src/lib/playbook/gate1-market";
import type { Bar } from "../../src/lib/market/types";
import {
  evaluateEarlyEntrySession,
  isEarlyEntryV1Enabled,
} from "../../src/lib/scanner/early-entry";
import {
  buildPaperSignal,
  emptyPaperStore,
  isPaperWorthySignal,
  mergeSignalsIntoStore,
  type PaperSignalRecord,
  type PaperSignalStore,
} from "../../src/lib/scanner/early-entry/paper-signals";
import type { CalibrationContext, Gate1RegimeLevel } from "../../src/lib/scanner/early-entry/calibration";
import {
  COHORT_ANCHORS,
  sectorForSymbol,
} from "./early-entry-sector-map";

const EVIDENCE_DIR = resolve(process.cwd(), "docs/trading/evidence");
const SIGNALS_PATH = resolve(EVIDENCE_DIR, "early-entry-paper-signals.json");

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

function loadBars(): { symbols: Map<string, Gate2BarInput[]>; indexBars: Gate2BarInput[] } {
  const stockPath = resolve(process.cwd(), "data/stock-bars.json");
  const indexPath = resolve(process.cwd(), "data/vnindex.json");
  if (!existsSync(stockPath) || !existsSync(indexPath)) {
    throw new Error("Missing data/stock-bars.json or data/vnindex.json");
  }
  const raw = JSON.parse(readFileSync(stockPath, "utf8")) as StockBarsFile;
  const indexRaw = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  const symbols = new Map<string, Gate2BarInput[]>();
  for (const entry of raw) {
    const bars = entry.bars.map(toGate2Bar).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (bars.length >= 80) symbols.set(entry.symbol, bars);
  }
  return { symbols, indexBars: indexRaw.map(toGate2Bar) };
}

function gate1AtSession(
  indexBars: readonly Gate2BarInput[],
  session: Date
): { level: Gate1RegimeLevel | null; label: string } {
  const idx = indexBars.findIndex((b) => b.date.getTime() === session.getTime());
  if (idx < 0) return { level: null, label: "unknown" };
  const slice: Bar[] = indexBars.slice(0, idx + 1).map((b) => ({
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  const regime = evaluateMarketRegime(slice);
  let label = regime.level.toLowerCase();
  if (regime.trend === "bullish" && regime.momentum === "up") label = "uptrend";
  else if (regime.trend === "bearish" && regime.momentum === "down") label = "correction";
  else if (regime.level === "WARNING") label = "sideways";
  return { level: regime.level, label };
}

function loadStore(): PaperSignalStore {
  if (!existsSync(SIGNALS_PATH)) return emptyPaperStore();
  return JSON.parse(readFileSync(SIGNALS_PATH, "utf8")) as PaperSignalStore;
}

function saveStore(store: PaperSignalStore): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(SIGNALS_PATH, JSON.stringify(store, null, 2));
}

function buildSignalAtSession(params: {
  symbol: string;
  bars: Gate2BarInput[];
  indexBars: Gate2BarInput[];
  sessionIdx: number;
}): PaperSignalRecord | null {
  const session = params.bars[params.sessionIdx]!.date;
  const gate2 = evaluateBreakoutPullbackCandidate(params.bars, session);
  const early = evaluateEarlyEntrySession({
    stockBars: params.bars,
    indexBars: params.indexBars,
    sessionDate: session,
    skipLookback: true,
  });
  if (!early) return null;
  if (!isPaperWorthySignal(early.proposedTradeState, early.earlyReversalScore)) {
    return null;
  }

  const g1 = gate1AtSession(params.indexBars, session);
  const ctx: CalibrationContext = {
    gate1Level: g1.level,
    gate1Trend: null,
    sector: sectorForSymbol(params.symbol),
    nextBar: params.bars[params.sessionIdx + 1] ?? null,
    nextNextBar: params.bars[params.sessionIdx + 2] ?? null,
    indexRs20Positive: null,
  };

  return buildPaperSignal({
    symbol: params.symbol,
    sessionDate: session.toISOString().slice(0, 10),
    evaluation: early,
    calibrationCtx: ctx,
    gate1RegimeLabel: g1.label,
    gate2Quality: gate2.quality,
    gate2TerminalCode: gate2.terminalCode ?? null,
  });
}

function selectSymbolList(symbols: Map<string, Gate2BarInput[]>, minSymbols: number): string[] {
  const picked = new Set<string>(COHORT_ANCHORS.filter((s) => symbols.has(s)));
  if (picked.size < minSymbols) {
    for (const sym of symbols.keys()) {
      picked.add(sym);
      if (picked.size >= minSymbols) break;
    }
  }
  return [...picked].slice(0, minSymbols);
}

function main() {
  if (!isEarlyEntryV1Enabled()) {
    process.env.EARLY_ENTRY_V1_ENABLED = "true";
    console.error("Note: EARLY_ENTRY_V1_ENABLED set to true for paper logging (research only).");
  }

  const seedHistorical = process.argv.includes("--seed-historical");
  const sessionArg = process.argv.find((a) => a.startsWith("--session="));
  const minSymbols = Number.parseInt(
    process.argv.find((a) => a.startsWith("--min-symbols="))?.split("=")[1] ?? "50",
    10
  );

  const { symbols, indexBars } = loadBars();
  const symbolList = selectSymbolList(symbols, minSymbols);
  const incoming: PaperSignalRecord[] = [];

  if (seedHistorical) {
    for (const symbol of symbolList) {
      const bars = symbols.get(symbol)!;
      for (let idx = 55; idx < bars.length - 21; idx += 5) {
        const sig = buildSignalAtSession({ symbol, bars, indexBars, sessionIdx: idx });
        if (sig) incoming.push(sig);
      }
    }
  } else if (sessionArg) {
    const sessionDate = sessionArg.split("=")[1]!;
    const session = new Date(`${sessionDate}T00:00:00.000Z`);
    for (const symbol of symbolList) {
      const bars = symbols.get(symbol)!;
      const idx = bars.findIndex((b) => b.date.toISOString().slice(0, 10) === sessionDate);
      if (idx < 55) continue;
      const sig = buildSignalAtSession({ symbol, bars, indexBars, sessionIdx: idx });
      if (sig) incoming.push(sig);
    }
  } else {
    const latest = indexBars[indexBars.length - 1]!.date;
    const sessionDate = latest.toISOString().slice(0, 10);
    for (const symbol of symbolList) {
      const bars = symbols.get(symbol)!;
      const idx = bars.findIndex((b) => b.date.getTime() === latest.getTime());
      if (idx < 55) continue;
      const sig = buildSignalAtSession({ symbol, bars, indexBars, sessionIdx: idx });
      if (sig) incoming.push(sig);
    }
    console.error(`Logging latest session: ${sessionDate}`);
  }

  const store = mergeSignalsIntoStore(loadStore(), incoming);
  saveStore(store);

  console.log(
    JSON.stringify(
      {
        path: SIGNALS_PATH,
        added: incoming.length,
        total: store.signals.length,
        open: store.signals.filter((s) => !s.outcomes).length,
        resolved: store.signals.filter((s) => s.outcomes).length,
      },
      null,
      2
    )
  );
}

main();
