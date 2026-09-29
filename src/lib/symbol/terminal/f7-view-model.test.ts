import { describe, expect, it } from "vitest";
import type { TradeSuggestion, TradeSuggestionResult } from "@/lib/trades/trade-suggestion";
import {
  atrPct,
  buildF7ViewModel,
  priceBandPct,
  rsi,
  sma,
  type Bar,
  type F7ViewModelInput,
} from "./f7-view-model";

function bar(i: number, close: number, over: Partial<Bar> = {}): Bar {
  return {
    date: new Date(Date.UTC(2026, 7, 1 + i)),
    open: close - 0.2,
    high: close + 0.3,
    low: close - 0.4,
    close,
    volume: 1_000_000 + i * 1000,
    ...over,
  };
}

/**
 * A Gợi ý lệnh for HPG shaped as the builder returns it. Only the prices the
 * chart draws matter here: entry zone 26,9–27,4, stop zone 25,8–26,1, and the
 * 1R/2R/3R prices 29,0 / 30,6 / 32,2 (R = 27,4 − 25,8 = 1,6 gross).
 */
function suggestion(over: Partial<TradeSuggestion> = {}): TradeSuggestionResult {
  return {
    ok: true,
    suggestion: {
      asOfSession: "2026-08-30",
      setupSession: "2026-08-30",
      sessionsSinceSetup: 0,
      exchange: "HOSE",
      exchangeAssumed: false,
      entryZone: { low: 26.9, high: 27.4 },
      stopZone: { structural: 26.1, minFeasible: 25.8, low: 25.8, high: 26.1 },
      r: { perShareGross: 1.6, perShareNet: 1.7 },
      targets: [
        { r: 1, price: 29.0, nearestResistance: null, resistanceBelow: false },
        { r: 2, price: 30.6, nearestResistance: null, resistanceBelow: false },
        { r: 3, price: 32.2, nearestResistance: null, resistanceBelow: false },
      ],
      size: null,
      reasons: [],
      risks: [{ code: "settlement_lockup", severity: "info", text: "T+2,5." }],
      evidence: { status: "UNVALIDATED", prospectiveN: 12, checkpointN: 100 },
      ...over,
    },
  };
}

function input(over: Partial<F7ViewModelInput> = {}): F7ViewModelInput {
  const bars = Array.from({ length: 30 }, (_, i) => bar(i, 25 + i * 0.1));
  return {
    symbol: "HPG",
    exchange: "HOSE",
    bars,
    candidate: {
      id: "cand1",
      quality: "A",
      rankScore: 88.1,
      healthLevel: "HEALTHY",
      healthScore: 81,
      baseSessions: null,
    },
    suggestion: suggestion(),
    prospectiveN: 12,
    avgValue20Vnd: 184_000_000_000,
    volumeRatioMa20: 0.68,
    foreignNetVnd: 24_600_000_000,
    rs20SpreadPct: 12.4,
    scanHistory: [
      { sessionDate: new Date(Date.UTC(2026, 7, 25)), quality: "A", rankScore: 88.1 },
    ],
    ...over,
  };
}

function quote(model: ReturnType<typeof buildF7ViewModel>, key: string) {
  return model.quote.find((c) => c.key === key);
}
function tech(model: ReturnType<typeof buildF7ViewModel>, key: string) {
  return model.tech.find((r) => r.key === key);
}

describe("biên độ theo sàn", () => {
  it("HOSE 7% · HNX 10% · UPCOM 15%", () => {
    expect(priceBandPct("HOSE")).toBe(7);
    expect(priceBandPct("hnx")).toBe(10);
    expect(priceBandPct("UPCOM")).toBe(15);
  });

  it("không biết sàn thì KHÔNG đoán biên độ", () => {
    expect(priceBandPct(null)).toBeNull();
    expect(priceBandPct("XYZ")).toBeNull();
  });
});

describe("chỉ báo", () => {
  it("sma trả null cho phần chưa đủ cửa sổ rồi mới ra số", () => {
    const out = sma([1, 2, 3, 4], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2, 6);
    expect(out[3]).toBeCloseTo(3, 6);
  });

  it("rsi trả null khi chưa đủ dữ liệu và 100 khi chỉ toàn tăng", () => {
    expect(rsi([1, 2, 3])).toBeNull();
    expect(rsi(Array.from({ length: 30 }, (_, i) => 10 + i))).toBe(100);
  });

  it("rsi của chuỗi đi ngang là 50", () => {
    expect(rsi(Array.from({ length: 30 }, () => 10))).toBe(50);
  });

  it("atr trả null khi chưa đủ phiên", () => {
    expect(atrPct([bar(0, 10), bar(1, 10)])).toBeNull();
  });

  it("atr của chuỗi ổn định là số dương nhỏ", () => {
    const value = atrPct(Array.from({ length: 30 }, (_, i) => bar(i, 10)));
    expect(value).not.toBeNull();
    expect(value as number).toBeGreaterThan(0);
    expect(value as number).toBeLessThan(20);
  });
});

describe("bảng giá", () => {
  it("tham chiếu là giá đóng phiên liền trước, trần/sàn theo biên độ sàn", () => {
    const model = buildF7ViewModel(input());
    // Phiên cuối là 25 + 29×0,1 = 27,9; phiên trước là 27,8.
    expect(quote(model, "THAM CHIẾU")?.value).toBe("27,80");
    // Changed in #16 (follow-up from #14): the limits now go through
    // `sessionBand`, so they are quotable prices on the HOSE tick (0,05 between
    // 10.000 and 50.000 đ). Ceiling 27,8 × 1,07 = 29,746 rounds DOWN to 29,70
    // (was the unsnapped 29,75); floor 27,8 × 0,93 = 25,854 rounds UP to 25,90
    // (was 25,85, a price below the real floor).
    expect(quote(model, "TRẦN")?.value).toBe("29,70");
    expect(quote(model, "SÀN")?.value).toBe("25,90");
  });

  it("không biết sàn thì trần/sàn là gap, không tính bừa 7%", () => {
    const model = buildF7ViewModel(input({ exchange: null }));
    expect(quote(model, "TRẦN")?.value).toBe("—");
    expect(quote(model, "SÀN")?.value).toBe("—");
  });

  it("thiếu GTGD 20N và khối ngoại thì hiện — chứ không hiện 0", () => {
    const model = buildF7ViewModel(input({ avgValue20Vnd: null, foreignNetVnd: null }));
    expect(quote(model, "GTGD 20N")?.value).toBe("—");
    expect(quote(model, "KHỐI NGOẠI")?.value).toBe("—");
  });

  it("nêu rõ phiên của bảng giá", () => {
    expect(quote(buildF7ViewModel(input()), "PHIÊN")?.value).toBe("2026-08-30");
  });
});

describe("chỉ báo kỹ thuật", () => {
  it("so giá đóng với từng đường MA và ghi TRÊN / DƯỚI", () => {
    const model = buildF7ViewModel(input());
    expect(tech(model, "MA20")?.status).toBe("TRÊN");
  });

  it("chưa đủ dữ liệu cho MA200 thì để gap, không rơi về MA ngắn hơn", () => {
    const model = buildF7ViewModel(input());
    expect(tech(model, "MA200")?.value).toBe("—");
    expect(tech(model, "MA200")?.status).toBe("—");
  });

  it("RS20 dưới ngưỡng 6 được đánh dấu đúng", () => {
    const model = buildF7ViewModel(input({ rs20SpreadPct: 2.1 }));
    expect(tech(model, "RS20 vs VNINDEX")?.status).toBe("DƯỚI NGƯỠNG");
    expect(tech(model, "RS20 vs VNINDEX")?.value).toBe("+2,1");
  });

  it("thiếu RS20 thì gap chứ không thành 0", () => {
    const model = buildF7ViewModel(input({ rs20SpreadPct: null }));
    expect(tech(model, "RS20 vs VNINDEX")?.value).toBe("—");
  });

  it("khối lượng dưới bình quân 20 phiên là NÉN", () => {
    expect(tech(buildF7ViewModel(input()), "KL vs B/Q 20N")?.status).toBe("NÉN");
    expect(tech(buildF7ViewModel(input({ volumeRatioMa20: 1.8 })), "KL vs B/Q 20N")?.status).toBe(
      "BUNG"
    );
  });
});

describe("biểu đồ", () => {
  it("mọi toạ độ nằm trong hệ 0..1", () => {
    const model = buildF7ViewModel(input());
    for (const candle of model.candles) {
      for (const v of [candle.x, candle.highY, candle.lowY, candle.bodyTopY]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("dải vùng mua và vạch cắt lỗ cùng thang đo với nến", () => {
    const model = buildF7ViewModel(input());
    expect(model.zoneBand).not.toBeNull();
    expect(model.stopY).not.toBeNull();
    // Cắt lỗ thấp hơn vùng mua ⇒ y lớn hơn (y = 0 ở đỉnh khung).
    expect(model.stopY as number).toBeGreaterThan(
      (model.zoneBand as { topY: number }).topY
    );
  });

  it("thang đo BAO cả vùng mua và cắt lỗ nằm ngoài dải nến", () => {
    // Cắt lỗ 20 nằm dưới đáy 64 phiên (≈24,6). Nếu thang đo chỉ lấy min/max của
    // nến, vạch cắt lỗ sẽ rơi xuống dải khối lượng hoặc bị cắt mất.
    // #16: the stop is drawn from the suggestion's stop zone now, so the low
    // stop is set there instead of on the raw scanner row.
    const model = buildF7ViewModel(
      input({
        suggestion: suggestion({
          stopZone: { structural: 20, minFeasible: 20, low: 20, high: 20 },
        }),
      })
    );
    expect(model.stopY).not.toBeNull();
    // Vùng giá chiếm 78% khung; vạch cắt lỗ phải nằm trong đó, không tràn xuống
    // dải khối lượng ở 22% dưới cùng.
    expect(model.stopY as number).toBeLessThanOrEqual(0.78 + 1e-9);
    expect(model.stopY as number).toBeGreaterThanOrEqual(0);
  });

  it("vùng mua nằm trên đỉnh nến cũng không bị cắt", () => {
    // #16: the zone comes from the suggestion's entry zone (was the raw row).
    const model = buildF7ViewModel(
      input({
        suggestion: suggestion({
          entryZone: { low: 40, high: 42 },
          stopZone: { structural: 38, minFeasible: 38, low: 38, high: 38 },
        }),
      })
    );
    expect((model.zoneBand as { topY: number }).topY).toBeGreaterThanOrEqual(0);
  });

  it("không có ứng viên thì không vẽ vùng mua hay cắt lỗ", () => {
    const model = buildF7ViewModel(input({ candidate: null, suggestion: null }));
    expect(model.zoneBand).toBeNull();
    expect(model.stopY).toBeNull();
    expect(model.setupId).toBeNull();
  });

  it("dưới hai phiên thì nêu lý do thay vì vẽ khung rỗng", () => {
    const model = buildF7ViewModel(input({ bars: [bar(0, 10)] }));
    expect(model.candles).toEqual([]);
    expect(model.chartEmptyReason).toContain("cần tối thiểu 2 phiên");
  });
});

describe("gợi ý lệnh trên biểu đồ (#16)", () => {
  // By hand. Bars: close 25,0 + 0,1i (i = 0..29), high = close + 0,3, low =
  // close − 0,4 ⇒ lowest low 24,6, highest high 28,2. The 3R price 32,2 is above
  // every candle, so the scale runs 24,6..32,2 (range 7,6) and the price area is
  // the top 78% of the frame: y(v) = (32,2 − v) / 7,6 × 0,78.
  const y = (v: number) => ((32.2 - v) / 7.6) * 0.78;

  it("dải vùng vào lấy từ entryZone của gợi ý", () => {
    const model = buildF7ViewModel(input());
    expect(model.zone).toEqual({ low: 26.9, high: 27.4 });
    // top = y(27,4) = 4,8/7,6 × 0,78 ≈ 0,49263; height = 0,5/7,6 × 0,78 ≈ 0,05132
    expect(model.zoneBand?.topY).toBeCloseTo(0.49263, 5);
    expect(model.zoneBand?.height).toBeCloseTo(0.05132, 5);
    expect(model.zoneBand?.topY).toBeCloseTo(y(27.4), 9);
  });

  it("vùng SL là một dải từ stopZone.high xuống stopZone.low, vạch stop ở đáy", () => {
    const model = buildF7ViewModel(input());
    // top = y(26,1) = 6,1/7,6 × 0,78 ≈ 0,62605; height = 0,3/7,6 × 0,78 ≈ 0,03079
    expect(model.stopZoneBand?.topY).toBeCloseTo(0.62605, 5);
    expect(model.stopZoneBand?.height).toBeCloseTo(0.03079, 5);
    // The stop line is the bottom of the stop zone, where R ends: y(25,8) ≈ 0,65684.
    expect(model.stop).toBe(25.8);
    expect(model.stopY).toBeCloseTo(0.65684, 5);
  });

  it("vẽ ba mốc 1R/2R/3R theo giá của gợi ý", () => {
    const model = buildF7ViewModel(input());
    expect(model.rLines.map((l) => [l.r, l.price])).toEqual([
      [1, 29.0],
      [2, 30.6],
      [3, 32.2],
    ]);
    // y(29,0) = 3,2/7,6 × 0,78 ≈ 0,32842; y(30,6) ≈ 0,16421; y(32,2) = 0 (top).
    expect(model.rLines[0].y).toBeCloseTo(0.32842, 5);
    expect(model.rLines[1].y).toBeCloseTo(0.16421, 5);
    expect(model.rLines[2].y).toBeCloseTo(0, 9);
    expect(model.suggestionUnavailable).toBeNull();
  });

  it("gợi ý không tính được thì không vẽ đường nào và nêu 'Không đủ dữ liệu'", () => {
    const model = buildF7ViewModel(
      input({
        suggestion: {
          ok: false,
          reason: "STOP_NOT_BELOW_ENTRY",
          detail: "mức vô hiệu 27,50 không nằm dưới vùng vào 26,90–27,40",
        },
      })
    );
    expect(model.zone).toBeNull();
    expect(model.stop).toBeNull();
    expect(model.zoneBand).toBeNull();
    expect(model.stopZoneBand).toBeNull();
    expect(model.stopY).toBeNull();
    expect(model.rLines).toEqual([]);
    expect(model.suggestionUnavailable).toBe(
      "Không đủ dữ liệu — mức vô hiệu 27,50 không nằm dưới vùng vào 26,90–27,40"
    );
    // The candles still draw; only the suggestion's lines are withheld.
    expect(model.candles).toHaveLength(30);
    expect(model.setupId).toBe("cand1");
  });

  it("có ứng viên mà chưa nạp được gợi ý cũng là 'Không đủ dữ liệu'", () => {
    const model = buildF7ViewModel(input({ suggestion: null }));
    expect(model.rLines).toEqual([]);
    expect(model.zoneBand).toBeNull();
    expect(model.suggestionUnavailable).toBe(
      "Không đủ dữ liệu — chưa nạp được nến giá của mã này"
    );
  });

  it("không có ứng viên thì không có gì để nói về gợi ý", () => {
    expect(buildF7ViewModel(input({ candidate: null, suggestion: null })).suggestionUnavailable).toBeNull();
  });

  it("mang trạng thái kiểm chứng (ADR 0003)", () => {
    expect(buildF7ViewModel(input()).evidence?.label).toBe("Chưa kiểm chứng (12/100)");
    expect(buildF7ViewModel(input({ candidate: null, suggestion: null })).evidence).toBeNull();
  });
});

describe("lịch sử bộ quét", () => {
  it("liệt kê các lần mã đạt Cổng 2", () => {
    const model = buildF7ViewModel(input());
    expect(model.history[0].message).toContain("Hạng A");
    expect(model.history[0].time).toBe("2026-08-25");
  });

  it("chưa từng đạt thì nêu rõ lý do rỗng", () => {
    const model = buildF7ViewModel(input({ scanHistory: [] }));
    expect(model.history).toEqual([]);
    expect(model.historyEmptyReason).toContain("chưa từng đạt Cổng 2");
  });
});

describe("màu bảng giá không nói thay dữ liệu", () => {
  it("không có nến thì mọi ô là gap và màu TRUNG TÍNH, không xanh/đỏ/vàng", () => {
    // `SymbolPage` dựng được model với `bars: []` — khi đó ô "—" mà vẫn tô xanh
    // (CAO NHẤT) hay vàng (THAM CHIẾU) là gán ý nghĩa cho chỗ không có dữ liệu.
    const model = buildF7ViewModel(input({ bars: [] }));
    for (const key of ["MỞ CỬA", "CAO NHẤT", "THẤP NHẤT", "THAM CHIẾU", "KL KHỚP", "GTGD"]) {
      const cell = quote(model, key);
      expect(cell?.value, key).toBe("—");
      expect(cell?.color, key).toBe("var(--tm-text-faint)");
    }
  });

  it("khối ngoại ròng bằng 0 là cân bằng (vàng), không phải mua ròng (xanh)", () => {
    expect(quote(buildF7ViewModel(input({ foreignNetVnd: 0 })), "KHỐI NGOẠI")?.color).toBe(
      "var(--tm-ref)"
    );
    expect(quote(buildF7ViewModel(input({ foreignNetVnd: 5 })), "KHỐI NGOẠI")?.color).toBe(
      "var(--tm-up)"
    );
    expect(quote(buildF7ViewModel(input({ foreignNetVnd: -5 })), "KHỐI NGOẠI")?.color).toBe(
      "var(--tm-down)"
    );
  });
});
