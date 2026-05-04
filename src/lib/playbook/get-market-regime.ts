import { prisma } from "@/lib/prisma";
import type { Bar } from "@/lib/market/types";
import {
  evaluateMarketRegime,
  type MarketRegime,
} from "./gate1-market";

const DEFAULT_INDEX_SYMBOL = "VNINDEX";
const DEFAULT_BAR_LIMIT = 60;

const INSUFFICIENT_STORED_BARS: MarketRegime = {
  level: "WARNING",
  reasons: ["Need at least 50 stored bars for Gate 1."],
};

function rowToBar(row: {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Bar {
  return {
    time: row.date.getTime(),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

/**
 * Load recent daily index bars from Postgres and evaluate Gate 1 (MA50 regime).
 * Server-side only (uses DB).
 *
 * Loads up to `barLimit` most recent rows, sorted ascending by date before evaluation.
 */
export async function getMarketRegimeFromDb(
  symbol: string = DEFAULT_INDEX_SYMBOL,
  barLimit: number = DEFAULT_BAR_LIMIT
): Promise<MarketRegime> {
  const rowsDesc = await prisma.indexDailyBar.findMany({
    where: { symbol },
    orderBy: { date: "desc" },
    take: barLimit,
  });

  if (rowsDesc.length < 50) {
    return INSUFFICIENT_STORED_BARS;
  }

  const chronological = [...rowsDesc].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const bars: Bar[] = chronological.map(rowToBar);

  return evaluateMarketRegime(bars);
}
