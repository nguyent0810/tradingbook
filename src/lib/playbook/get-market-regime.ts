import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";
import type { Bar } from "@/lib/market/types";
import {
  evaluateMarketRegime,
  type MarketRegime,
} from "./gate1-market";
import {
  INSUFFICIENT_STORED_BARS_REASON,
  MARKET_DATA_UNAVAILABLE_REASON,
} from "./market-regime-reasons";

const DEFAULT_INDEX_SYMBOL = "VNINDEX";
const DEFAULT_BAR_LIMIT = 60;

export {
  INSUFFICIENT_STORED_BARS_REASON,
  MARKET_DATA_UNAVAILABLE_REASON,
} from "./market-regime-reasons";

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

export type MarketRegimeLatestBar = {
  date: Date;
  close: number;
};

/** Gate 1 evaluation plus DB metadata for the dashboard regime strip. */
export type MarketRegimeFromDbResult = MarketRegime & {
  symbol: string;
  /** Total `index_daily_bar` rows for this symbol. */
  storedBarsCount: number;
  /** Bars included in the Gate 1 window (up to `barLimit`); 0 if evaluation did not run. */
  evaluatedBarsCount: number;
  latestBar: MarketRegimeLatestBar | null;
  checkedAt: Date;
  /**
   * Nguyên văn lỗi khi truy vấn ném — `null` khi đọc được.
   *
   * Hàm này CỐ Ý không bao giờ ném (nhiều nơi gọi phụ thuộc điều đó), nhưng nếu
   * chỉ trả `WARNING` với `evaluatedBarsCount = 0` thì phía gọi không phân biệt
   * được "DB hỏng" với "chưa đủ bar" — hai thứ cần hai câu trả lời khác nhau.
   * Trường này mang bằng chứng thật vượt qua ranh giới hàm.
   */
  loadError: string | null;
};

/**
 * Load recent daily index bars from Postgres and evaluate Gate 1 (MA50 regime).
 * Server-side only (uses DB).
 *
 * Loads up to `barLimit` most recent rows, sorted ascending by date before evaluation.
 * Returns WARNING with a fixed message if fewer than 50 rows exist. Never throws;
 * on DB errors returns WARNING with a generic reason and zero counts.
 */
export async function getMarketRegimeFromDb(
  symbol: string = DEFAULT_INDEX_SYMBOL,
  barLimit: number = DEFAULT_BAR_LIMIT
): Promise<MarketRegimeFromDbResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("daily-scan");
  try {
    const totalStored = await prisma.indexDailyBar.count({ where: { symbol } });

    const rowsDesc = await prisma.indexDailyBar.findMany({
      where: { symbol },
      orderBy: { date: "desc" },
      take: barLimit,
    });

    const latestRow = rowsDesc[0] ?? null;
    const latestBar: MarketRegimeLatestBar | null = latestRow
      ? { date: latestRow.date, close: latestRow.close }
      : null;

    if (rowsDesc.length < 50) {
      return {
        // Thiếu bar là một sự thật đọc được, KHÔNG phải lỗi ⇒ `loadError: null`.
        loadError: null,
        level: "WARNING",
        reasons: [INSUFFICIENT_STORED_BARS_REASON],
        symbol,
        storedBarsCount: totalStored,
        evaluatedBarsCount: 0,
        latestBar,
        checkedAt: new Date(),
      };
    }

    const chronological = [...rowsDesc].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const bars: Bar[] = chronological.map(rowToBar);
    const regime = evaluateMarketRegime(bars);

    return {
      ...regime,
      symbol,
      storedBarsCount: totalStored,
      evaluatedBarsCount: chronological.length,
      latestBar,
      checkedAt: new Date(),
      loadError: null,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getMarketRegimeFromDb] Prisma/query error:", err);
    }
    return {
      level: "WARNING",
      reasons: [MARKET_DATA_UNAVAILABLE_REASON],
      symbol,
      storedBarsCount: 0,
      evaluatedBarsCount: 0,
      latestBar: null,
      checkedAt: new Date(),
      loadError: `getMarketRegimeFromDb(${symbol}) → prisma.indexDailyBar thất bại: ${String(err)}`,
    };
  }
}
