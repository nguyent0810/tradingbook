import type { PrismaClient } from "@/generated/prisma/client";
import type { Gate2BarInput } from "./types";
import {
  computeRelativeStrengthDiagnostic,
  type RelativeStrengthDiagnostic,
} from "./relative-strength";
import {
  formatRelativeStrengthDiagnosticForUi,
  type RsDiagnosticUi,
} from "./rs-diagnostic-format";

function toGate2Bars(
  rows: {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[]
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

/** Load VNINDEX daily bars for RS (read-only diagnostic). */
export async function loadVnindexBarsForRs(
  prisma: PrismaClient
): Promise<Gate2BarInput[]> {
  const rows = await prisma.indexDailyBar.findMany({
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
  return toGate2Bars(rows);
}

/**
 * Compute RS diagnostics for symbols at `sessionDate` — does not run or alter Gate 2.
 */
export async function loadRsDiagnosticsForSymbols(
  prisma: PrismaClient,
  symbols: readonly string[],
  sessionDate: Date,
  indexBars?: Gate2BarInput[]
): Promise<Map<string, RelativeStrengthDiagnostic | null>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, RelativeStrengthDiagnostic | null>();
  if (unique.length === 0) return out;

  const index =
    indexBars ?? (await loadVnindexBarsForRs(prisma));
  if (index.length < 50) {
    for (const s of unique) out.set(s, null);
    return out;
  }

  const symbolRows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: unique } },
    select: { id: true, symbol: true },
  });

  for (const { id, symbol } of symbolRows) {
    const stockRows = await prisma.stockDailyBar.findMany({
      where: { symbolId: id },
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
    const stockBars = toGate2Bars(stockRows);
    out.set(
      symbol,
      computeRelativeStrengthDiagnostic(stockBars, index, sessionDate)
    );
  }

  for (const s of unique) {
    if (!out.has(s)) out.set(s, null);
  }

  return out;
}

/** UI-ready map keyed by symbol. */
export async function loadRsDiagnosticUiForSymbols(
  prisma: PrismaClient,
  symbols: readonly string[],
  sessionDate: Date
): Promise<Map<string, RsDiagnosticUi | null>> {
  const raw = await loadRsDiagnosticsForSymbols(prisma, symbols, sessionDate);
  const ui = new Map<string, RsDiagnosticUi | null>();
  for (const [sym, diag] of raw) {
    ui.set(sym, diag ? formatRelativeStrengthDiagnosticForUi(diag) : null);
  }
  return ui;
}
