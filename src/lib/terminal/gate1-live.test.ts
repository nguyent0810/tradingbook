import { describe, expect, it } from "vitest";
import {
  INSUFFICIENT_STORED_BARS_REASON,
  MARKET_DATA_UNAVAILABLE_REASON,
} from "@/lib/playbook/market-regime-reasons";
import type { MarketRegimeFromDbResult } from "@/lib/playbook/get-market-regime";
import { readLiveGate1 } from "./gate1-live";

function regime(over: Partial<MarketRegimeFromDbResult>): MarketRegimeFromDbResult {
  return {
    level: "PASS",
    reasons: [],
    symbol: "VNINDEX",
    storedBarsCount: 240,
    evaluatedBarsCount: 60,
    latestBar: { date: new Date("2026-08-25T00:00:00.000Z"), close: 1284.62 },
    checkedAt: new Date("2026-08-25T07:00:00.000Z"),
    loadError: null,
    ...over,
  } as MarketRegimeFromDbResult;
}

describe("readLiveGate1", () => {
  it("nhận mức khi Cổng 1 thực sự được đánh giá", () => {
    expect(readLiveGate1(regime({ level: "PASS" }))).toEqual({ level: "PASS", error: null });
    expect(readLiveGate1(regime({ level: "WARNING" }))).toEqual({
      level: "WARNING",
      error: null,
    });
    expect(readLiveGate1(regime({ level: "FAIL" }))).toEqual({ level: "FAIL", error: null });
  });

  it("KHÔNG tin mức WARNING khi truy vấn hỏng — trả gap kèm bằng chứng", () => {
    // getMarketRegimeFromDb() không ném lỗi: hỏng DB cũng trả WARNING.
    // Tin thẳng mức đó là bịa ra một phán quyết từ chỗ không có dữ liệu.
    const result = readLiveGate1(
      regime({
        level: "WARNING",
        reasons: [MARKET_DATA_UNAVAILABLE_REASON],
        storedBarsCount: 0,
        evaluatedBarsCount: 0,
        latestBar: null,
      })
    );
    expect(result.level).toBeNull();
    expect(result.error).toContain("index_daily_bar");
  });

  it("KHÔNG tin mức WARNING khi chưa đủ bar cho MA50", () => {
    const result = readLiveGate1(
      regime({
        level: "WARNING",
        reasons: [INSUFFICIENT_STORED_BARS_REASON],
        storedBarsCount: 31,
        evaluatedBarsCount: 0,
      })
    );
    expect(result.level).toBeNull();
    expect(result.error).toContain("31 bar");
    expect(result.error).toContain("cần tối thiểu 50");
  });

  it("lý do lạ vẫn thành gap, giữ nguyên nguyên văn làm bằng chứng", () => {
    const result = readLiveGate1(
      regime({ level: "WARNING", reasons: ["Lý do chưa biết"], evaluatedBarsCount: 0 })
    );
    expect(result.level).toBeNull();
    expect(result.error).toContain("Lý do chưa biết");
  });

  it("không có lý do nào cũng không được im lặng nuốt", () => {
    const result = readLiveGate1(regime({ reasons: [], evaluatedBarsCount: 0 }));
    expect(result.level).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("bằng chứng lỗi truy vấn", () => {
  it("ưu tiên NGUYÊN VĂN exception thay vì câu mô tả tự viết", () => {
    // `getMarketRegimeFromDb()` không bao giờ ném; `loadError` là đường DUY NHẤT
    // để nguyên văn lỗi đi tới được panel.
    const evidence = "getMarketRegimeFromDb(VNINDEX) → prisma.indexDailyBar thất bại: Error: ECONNRESET";
    const reading = readLiveGate1(
      regime({ evaluatedBarsCount: 0, storedBarsCount: 0, loadError: evidence })
    );
    expect(reading.level).toBeNull();
    expect(reading.error).toBe(evidence);
  });

  it("thiếu bar KHÔNG phải lỗi truy vấn — vẫn nêu con số thật", () => {
    const reading = readLiveGate1(
      regime({ evaluatedBarsCount: 0, storedBarsCount: 12, loadError: null, reasons: [INSUFFICIENT_STORED_BARS_REASON] })
    );
    expect(reading.level).toBeNull();
    expect(reading.error).toContain("12 bar");
  });
});
