/**
 * Lý do Gate 1 không đánh giá được. Tách khỏi `get-market-regime.ts` vì file đó
 * nạp Prisma ngay khi import — nơi nào chỉ cần đọc lý do thì không phải kéo theo
 * kết nối cơ sở dữ liệu.
 */

export const INSUFFICIENT_STORED_BARS_REASON =
  "Need at least 50 daily bars to evaluate regime.";

export const MARKET_DATA_UNAVAILABLE_REASON = "Market data unavailable.";
