import type { MarketRegimeFromDbResult } from "@/lib/playbook/get-market-regime";
import {
  INSUFFICIENT_STORED_BARS_REASON,
  MARKET_DATA_UNAVAILABLE_REASON,
} from "@/lib/playbook/market-regime-reasons";
import type { Gate1Level } from "@/lib/scanner/gate2/types";

export type LiveGate1Reading = {
  /** `null` nghĩa là chưa đánh giá được — ô hiện `—`, không hiện mức nào. */
  level: Gate1Level | null;
  /** Bằng chứng thật khi không đọc được, để panel lỗi hiển thị nguyên văn. */
  error: string | null;
};

/**
 * Đọc Gate 1 trực tiếp từ kết quả đánh giá chế độ thị trường.
 *
 * `getMarketRegimeFromDb()` **không bao giờ ném lỗi**: hỏng DB hay thiếu bar đều
 * trả về `WARNING` với `evaluatedBarsCount = 0`. Nếu tin thẳng mức đó, một sự cố
 * dữ liệu sẽ hiện lên thanh trạng thái thành "CỔNG 1 · CẢNH BÁO" — một phán quyết
 * bịa ra từ chỗ không có dữ liệu, và phán quyết phiên sẽ được tính trên nó.
 *
 * Nên `evaluatedBarsCount = 0` được đọc là "chưa đánh giá được" → gap, kèm lý do
 * thật làm bằng chứng.
 */
export function readLiveGate1(regime: MarketRegimeFromDbResult): LiveGate1Reading {
  if (regime.evaluatedBarsCount > 0) {
    return { level: regime.level as Gate1Level, error: null };
  }

  // `loadError` mang NGUYÊN VĂN exception khi truy vấn hỏng. Ưu tiên nó: một câu
  // "truy vấn thất bại" do chính chỗ này viết ra thì lỗi nào cũng như lỗi nào.
  if (regime.loadError) {
    return { level: null, error: regime.loadError };
  }

  const reason = regime.reasons?.[0] ?? "Không rõ lý do.";
  const detail =
    reason === MARKET_DATA_UNAVAILABLE_REASON
      ? "truy vấn index_daily_bar thất bại"
      : reason === INSUFFICIENT_STORED_BARS_REASON
        ? `chỉ có ${regime.storedBarsCount} bar VNINDEX, cần tối thiểu 50`
        : reason;

  return {
    level: null,
    error: `getMarketRegimeFromDb(${regime.symbol}) → chưa đánh giá được Cổng 1: ${detail}`,
  };
}
