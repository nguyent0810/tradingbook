import { describe, expect, it } from "vitest";
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
      pullbackZoneLow: 26.9,
      pullbackZoneHigh: 27.4,
      stopLevel: 25.8,
      healthLevel: "HEALTHY",
      healthScore: 81,
      baseSessions: null,
    },
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
    expect(quote(model, "TRẦN")?.value).toBe("29,75"); // 27,8 × 1,07
    expect(quote(model, "SÀN")?.value).toBe("25,85"); // 27,8 × 0,93
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
    const model = buildF7ViewModel(
      input({
        candidate: {
          id: "c",
          quality: "A",
          rankScore: 1,
          pullbackZoneLow: 26.9,
          pullbackZoneHigh: 27.4,
          stopLevel: 20,
          healthLevel: null,
          healthScore: null,
          baseSessions: null,
        },
      })
    );
    expect(model.stopY).not.toBeNull();
    // Vùng giá chiếm 78% khung; vạch cắt lỗ phải nằm trong đó, không tràn xuống
    // dải khối lượng ở 22% dưới cùng.
    expect(model.stopY as number).toBeLessThanOrEqual(0.78 + 1e-9);
    expect(model.stopY as number).toBeGreaterThanOrEqual(0);
  });

  it("vùng mua nằm trên đỉnh nến cũng không bị cắt", () => {
    const model = buildF7ViewModel(
      input({
        candidate: {
          id: "c",
          quality: "A",
          rankScore: 1,
          pullbackZoneLow: 40,
          pullbackZoneHigh: 42,
          stopLevel: 38,
          healthLevel: null,
          healthScore: null,
          baseSessions: null,
        },
      })
    );
    expect((model.zoneBand as { topY: number }).topY).toBeGreaterThanOrEqual(0);
  });

  it("không có ứng viên thì không vẽ vùng mua hay cắt lỗ", () => {
    const model = buildF7ViewModel(input({ candidate: null }));
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
