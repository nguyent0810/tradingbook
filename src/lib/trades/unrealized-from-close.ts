import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

export type LatestCloseBar = {
  close: number;
  date: Date;
};

/**
 * Latest daily bar per symbol (by `StockDailyBar.date` desc). Symbols use exchange ticker keys (uppercase).
 */
export async function fetchLatestCloseByTradeSymbols(
  prisma: PrismaClient,
  symbolKeys: readonly string[]
): Promise<Map<string, LatestCloseBar>> {
  const normalized = [
    ...new Set(
      symbolKeys
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0)
    ),
  ];
  if (normalized.length === 0) return new Map();

  const stocks = await prisma.stockSymbol.findMany({
    where: { symbol: { in: normalized } },
    select: { id: true, symbol: true },
  });
  if (stocks.length === 0) return new Map();

  const ids = stocks.map((s) => s.id);
  const rows = await prisma.$queryRaw<
    Array<{ symbol_id: string; date: Date; close: number }>
  >`
    SELECT DISTINCT ON (symbol_id) symbol_id, date, close
    FROM stock_daily_bars
    WHERE symbol_id IN (${Prisma.join(ids)})
    ORDER BY symbol_id, date DESC
  `;

  const idToSymbol = new Map(stocks.map((s) => [s.id, s.symbol] as const));
  const out = new Map<string, LatestCloseBar>();
  for (const r of rows) {
    const sym = idToSymbol.get(r.symbol_id);
    if (sym)
      out.set(sym.toUpperCase(), { close: r.close, date: r.date });
  }
  return out;
}

/** Derived display only — not persisted. */
export function computeUnrealizedFromLatestClose(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  latestClose: number;
}): { pnlAmount: number | null; pnlPct: number | null } {
  const { direction, entryPrice, quantity, latestClose } = params;
  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    !Number.isFinite(latestClose)
  ) {
    return { pnlAmount: null, pnlPct: null };
  }

  const pnlPct =
    direction === "LONG"
      ? ((latestClose - entryPrice) / entryPrice) * 100
      : ((entryPrice - latestClose) / entryPrice) * 100;

  const qtyOk = Number.isFinite(quantity) && quantity > 0;
  const pnlAmount = qtyOk
    ? direction === "LONG"
      ? (latestClose - entryPrice) * quantity
      : (entryPrice - latestClose) * quantity
    : null;

  return { pnlAmount, pnlPct };
}

export function formatSignedPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
