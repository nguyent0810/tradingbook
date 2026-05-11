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

export type LatestTwoCloseBars = {
  latest: LatestCloseBar;
  prior: LatestCloseBar | null;
};

/** Latest and prior daily close per symbol (same keys as `fetchLatestCloseByTradeSymbols`). */
export async function fetchLatestTwoClosesByTradeSymbols(
  prisma: PrismaClient,
  symbolKeys: readonly string[]
): Promise<Map<string, LatestTwoCloseBars>> {
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
    Array<{ symbol_id: string; date: Date; close: number; rn: bigint | number }>
  >`
    SELECT symbol_id, date, close, rn
    FROM (
      SELECT
        symbol_id,
        date,
        close,
        ROW_NUMBER() OVER (PARTITION BY symbol_id ORDER BY date DESC) AS rn
      FROM stock_daily_bars
      WHERE symbol_id IN (${Prisma.join(ids)})
    ) ranked
    WHERE rn <= 2
  `;

  const idToSymbol = new Map(stocks.map((s) => [s.id, s.symbol] as const));
  const bySym = new Map<
    string,
    Array<{ date: Date; close: number; rn: number }>
  >();

  for (const r of rows) {
    const sym = idToSymbol.get(r.symbol_id);
    if (!sym) continue;
    const key = sym.toUpperCase();
    const rn = Number(r.rn);
    const arr = bySym.get(key) ?? [];
    arr.push({ date: r.date, close: r.close, rn });
    bySym.set(key, arr);
  }

  const out = new Map<string, LatestTwoCloseBars>();
  for (const [key, arr] of bySym) {
    const sorted = [...arr].sort((a, b) => a.rn - b.rn);
    const latestRow = sorted.find((x) => x.rn === 1);
    const priorRow = sorted.find((x) => x.rn === 2);
    if (latestRow) {
      out.set(key, {
        latest: { close: latestRow.close, date: latestRow.date },
        prior: priorRow ? { close: priorRow.close, date: priorRow.date } : null,
      });
    }
  }
  return out;
}

/** UTC calendar date at midnight (for `StockDailyBar.date` comparisons). */
export function utcStockBarCutoffDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type TradeReviewBaselineSpec = {
  tradeId: string;
  symbolId: string;
  /** Inclusive upper bound on bar session date (UTC calendar day of review). */
  cutoffDate: Date;
};

/**
 * Close of the latest bar on or before each trade's review cutoff (UTC date).
 * Omits trades with no matching bar.
 */
export async function fetchBarCloseOnOrBeforeReviewBatch(
  prisma: PrismaClient,
  specs: readonly TradeReviewBaselineSpec[]
): Promise<Map<string, { close: number; date: Date }>> {
  if (specs.length === 0) return new Map();

  const placeholders = specs
    .map((_, i) => `($${i * 3 + 1}::text, $${i * 3 + 2}::text, $${i * 3 + 3}::date)`)
    .join(", ");

  const params = specs.flatMap((s) => [
    s.tradeId,
    s.symbolId,
    s.cutoffDate,
  ]);

  const rows = await prisma.$queryRawUnsafe<
    Array<{ trade_id: string; bar_date: Date; close: number }>
  >(
    `
    WITH specs(trade_id, symbol_id, cutoff_date) AS (VALUES ${placeholders}),
    ranked AS (
      SELECT
        s.trade_id,
        b.date AS bar_date,
        b.close,
        ROW_NUMBER() OVER (PARTITION BY s.trade_id ORDER BY b.date DESC) AS rn
      FROM specs s
      INNER JOIN stock_daily_bars b
        ON b.symbol_id = s.symbol_id AND b.date <= s.cutoff_date
    )
    SELECT trade_id, bar_date, close FROM ranked WHERE rn = 1
    `,
    ...params
  );

  const out = new Map<string, { close: number; date: Date }>();
  for (const r of rows) {
    out.set(r.trade_id, { close: r.close, date: r.bar_date });
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
