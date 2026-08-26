import { describe, expect, it } from "vitest";
import {
  buildF4ViewModel,
  maxDrawdownPct,
  openRiskVnd,
  type F4ViewModelInput,
  type TradeRecord,
} from "./f4-view-model";

const NOW = new Date("2026-08-25T08:00:00.000Z");

function openTrade(over: Partial<TradeRecord> = {}): TradeRecord {
  return {
    id: "t-open",
    symbol: "HPG",
    direction: "LONG",
    status: "OPEN",
    entryDate: new Date("2026-08-21T00:00:00.000Z"),
    exitDate: null,
    entryPrice: 27.2,
    exitPrice: null,
    quantity: 8600,
    stopLoss: 25.8,
    takeProfit: 31.2,
    realizedPnl: null,
    rMultiple: null,
    outcome: null,
    exitReason: null,
    healthLogs: [
      {
        id: "log1",
        checkedAt: new Date("2026-08-24T10:00:00.000Z"),
        healthLevel: "HEALTHY",
        recommendedAction: "Giữ kế hoạch",
      },
    ],
    ...over,
  };
}

function closedTrade(over: Partial<TradeRecord> = {}): TradeRecord {
  return {
    id: "t-closed",
    symbol: "MWG",
    direction: "LONG",
    status: "CLOSED",
    entryDate: new Date("2026-08-05T00:00:00.000Z"),
    exitDate: new Date("2026-08-14T00:00:00.000Z"),
    entryPrice: 58.4,
    exitPrice: 63.9,
    quantity: 4800,
    stopLoss: 55.6,
    takeProfit: null,
    // Nghìn ₫ — cùng đơn vị với `entryPrice`/`exitPrice` (xem `computePnl`).
    realizedPnl: 26_400,
    rMultiple: 2.31,
    outcome: "WIN",
    exitReason: "TAKE_PROFIT_HIT",
    healthLogs: [],
    ...over,
  };
}

function input(over: Partial<F4ViewModelInput> = {}): F4ViewModelInput {
  return {
    openTrades: [openTrade()],
    closedTrades: [closedTrade()],
    latestCloseBySymbol: new Map([
      ["HPG", { close: 27.85, date: new Date("2026-08-25T00:00:00.000Z") }],
    ]),
    expectedSessionDate: new Date("2026-08-25T00:00:00.000Z"),
    equityVnd: 1_200_000_000,
    maxPortfolioRiskPct: null,
    now: NOW,
    ...over,
  };
}

function kpi(model: ReturnType<typeof buildF4ViewModel>, key: string) {
  return model.kpis.find((k) => k.key === key);
}

describe("lãi/lỗ chưa thực hiện", () => {
  it("tính theo nghìn ₫/cp × 1.000 × khối lượng", () => {
    const row = buildF4ViewModel(input()).openRows[0];
    // (27,85 − 27,20) × 1.000 × 8.600 = 5.590.000 ₫
    expect(row.unrealizedVnd).toBeCloseTo(5_590_000, 0);
    expect(row.unrealizedPct).toBeCloseTo(2.3897, 3);
  });

  it("R hiện tại tính trên khoảng cách giá vào — cắt lỗ", () => {
    const row = buildF4ViewModel(input()).openRows[0];
    // 0,65 / (27,20 − 25,80) = 0,4643
    expect(row.rMultiple).toBeCloseTo(0.4643, 3);
  });

  it("thiếu giá phiên gần nhất thì mọi ô là gap và hàng bị đánh dấu cũ", () => {
    const row = buildF4ViewModel(input({ latestCloseBySymbol: new Map() })).openRows[0];
    expect(row.markPrice).toBeNull();
    expect(row.unrealizedVnd).toBeNull();
    expect(row.rMultiple).toBeNull();
    expect(row.stale).toBe(true);
    expect(row.staleReason).toContain("Chưa có bar giá");
  });

  it("có giá nhưng bar CŨ HƠN phiên chuẩn vẫn phải bị đánh dấu dữ liệu cũ", () => {
    const row = buildF4ViewModel(
      input({
        latestCloseBySymbol: new Map([
          ["HPG", { close: 27.85, date: new Date("2026-08-22T00:00:00.000Z") }],
        ]),
      })
    ).openRows[0];
    expect(row.markPrice).toBe(27.85);
    expect(row.stale).toBe(true);
    expect(row.staleReason).toContain("2026-08-22");
    expect(row.staleReason).toContain("2026-08-25");
  });

  it("bar đúng phiên chuẩn thì không đánh dấu cũ", () => {
    const row = buildF4ViewModel(input()).openRows[0];
    expect(row.stale).toBe(false);
    expect(row.staleReason).toBeNull();
  });

  it("không biết phiên chuẩn thì không tự suy ra là cũ", () => {
    const row = buildF4ViewModel(input({ expectedSessionDate: null })).openRows[0];
    expect(row.stale).toBe(false);
  });

  it("không có cắt lỗ thì không có R, nhưng vẫn có lãi/lỗ", () => {
    const row = buildF4ViewModel(input({ openTrades: [openTrade({ stopLoss: null })] })).openRows[0];
    expect(row.rMultiple).toBeNull();
    expect(row.unrealizedVnd).not.toBeNull();
  });
});

describe("rủi ro đang mở", () => {
  it("cộng (giá vào − cắt lỗ) × khối lượng của mọi lệnh có cắt lỗ hợp lệ", () => {
    // (27,20 − 25,80) × 1.000 × 8.600 = 12.040.000
    expect(openRiskVnd([openTrade()])).toBeCloseTo(12_040_000, 0);
  });

  it("bỏ qua lệnh không có cắt lỗ, và trả gap khi không lệnh nào tính được", () => {
    expect(openRiskVnd([openTrade({ stopLoss: null })])).toBeNull();
    expect(openRiskVnd([])).toBeNull();
  });

  it("bỏ qua cắt lỗ nằm trên giá vào — đó không phải cắt lỗ", () => {
    expect(openRiskVnd([openTrade({ stopLoss: 30 })])).toBeNull();
  });

  it("ô KPI hiện % NAV khi có vốn, và nói rõ chưa đặt trần", () => {
    const cell = kpi(buildF4ViewModel(input()), "RỦI RO ĐANG MỞ");
    expect(cell?.value).toBe("1,0%");
    expect(cell?.sub).toBe("chưa đặt trần");
  });

  it("chưa đặt vốn thì hiện số tiền tuyệt đối thay vì % bịa", () => {
    const cell = kpi(buildF4ViewModel(input({ equityVnd: null })), "RỦI RO ĐANG MỞ");
    expect(cell?.value).toContain("tr ₫");
  });
});

describe("sụt giảm tối đa", () => {
  it("tính từ đỉnh trước đó của đường vốn", () => {
    expect(maxDrawdownPct([100, 120, 90, 110])).toBeCloseTo(25, 6);
  });

  it("đường vốn chỉ đi lên thì sụt giảm bằng 0", () => {
    expect(maxDrawdownPct([100, 110, 120])).toBe(0);
  });

  it("dưới hai điểm thì là gap, không phải 0", () => {
    expect(maxDrawdownPct([100])).toBeNull();
    expect(maxDrawdownPct([])).toBeNull();
  });
});

describe("ô KPI", () => {
  it("chưa đặt vốn tài khoản thì hiện — và chỉ sang F5", () => {
    const cell = kpi(buildF4ViewModel(input({ equityVnd: null })), "VỐN TÀI KHOẢN");
    expect(cell?.value).toBe("—");
    expect(cell?.sub).toContain("F5");
  });

  it("chưa có lệnh đóng nào thì lãi/lỗ và tỷ lệ thắng là gap, không phải 0", () => {
    const model = buildF4ViewModel(input({ closedTrades: [] }));
    expect(kpi(model, "LÃI/LỖ THÁNG")?.value).toBe("—");
    expect(kpi(model, "LÃI/LỖ NĂM")?.value).toBe("—");
    expect(kpi(model, "TỶ LỆ THẮNG")?.value).toBe("—");
    expect(kpi(model, "R BÌNH QUÂN")?.value).toBe("—");
    expect(kpi(model, "SỤT GIẢM TỐI ĐA")?.value).toBe("—");
  });

  it("lãi/lỗ tháng chỉ cộng lệnh đóng trong tháng hiện tại", () => {
    const model = buildF4ViewModel(
      input({
        closedTrades: [
          closedTrade(),
          closedTrade({
            id: "t-old",
            exitDate: new Date("2026-07-20T00:00:00.000Z"),
            realizedPnl: 9_000,
          }),
        ],
      })
    );
    expect(kpi(model, "LÃI/LỖ THÁNG")?.value).toBe("+26,4 tr ₫");
    expect(kpi(model, "LÃI/LỖ NĂM")?.value).toBe("+35,4 tr ₫");
  });

  it("tỷ lệ thắng chỉ tính trên lệnh đã có kết quả", () => {
    const model = buildF4ViewModel(
      input({
        closedTrades: [
          closedTrade(),
          closedTrade({ id: "t2", outcome: "LOSS", realizedPnl: -5_000, rMultiple: -1 }),
          closedTrade({ id: "t3", outcome: null, realizedPnl: 1_000, rMultiple: null }),
        ],
      })
    );
    expect(kpi(model, "TỶ LỆ THẮNG")?.value).toBe("50,0%");
    expect(kpi(model, "TỶ LỆ THẮNG")?.sub).toBe("2 lệnh");
  });
});

describe("đơn vị tiền", () => {
  it("realizedPnl lưu theo NGHÌN ₫ nên phải quy về đồng — không nhỏ đi 1.000 lần", () => {
    // 26.400 nghìn ₫ = 26.400.000 ₫
    const row = buildF4ViewModel(input()).closedRows[0];
    expect(row.realizedPnlVnd).toBe(26_400_000_000 / 1000);
    expect(row.realizedPnlVnd).toBe(26_400_000);
  });
});

describe("đường vốn", () => {
  it("bắt đầu từ vốn tài khoản rồi cộng dồn lãi/lỗ đã thực hiện", () => {
    const model = buildF4ViewModel(input());
    expect(model.equityCurve).toEqual([1_200_000_000, 1_226_400_000]);
    expect(model.equityCurveNote).toContain("vốn tài khoản");
  });

  it("chưa đặt vốn thì gốc quy ước bằng 0 và ghi chú nói rõ", () => {
    const model = buildF4ViewModel(input({ equityVnd: null }));
    expect(model.equityCurve[0]).toBe(0);
    expect(model.equityCurveNote).toContain("quy ước bằng 0");
  });

  it("sắp xếp theo ngày đóng, không theo thứ tự đầu vào", () => {
    const model = buildF4ViewModel(
      input({
        equityVnd: 0,
        closedTrades: [
          closedTrade({ id: "b", exitDate: new Date("2026-08-20T00:00:00Z"), realizedPnl: 10 }),
          closedTrade({ id: "a", exitDate: new Date("2026-08-10T00:00:00Z"), realizedPnl: 100 }),
        ],
      })
    );
    expect(model.equityCurve).toEqual([0, 100_000, 110_000]);
  });

  it("chưa có lệnh đóng thì đường vốn rỗng, không vẽ một điểm giả", () => {
    expect(buildF4ViewModel(input({ closedTrades: [] })).equityCurve).toEqual([]);
  });
});

describe("sổ nhật ký rủi ro", () => {
  it("ghi mốc mở, mốc đóng và mốc đánh giá sức khoẻ, mới nhất lên đầu", () => {
    const rows = buildF4ViewModel(input()).riskLog;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].time >= rows[rows.length - 1].time).toBe(true);
    expect(rows.some((r) => r.message.includes("sức khoẻ TỐT"))).toBe(true);
    expect(rows.some((r) => r.message.includes("mở 8.600 cp"))).toBe(true);
    expect(rows.some((r) => r.message.includes("đóng +26,4 tr ₫"))).toBe(true);
  });

  it("không có lệnh nào thì rỗng kèm lý do", () => {
    const model = buildF4ViewModel(input({ openTrades: [], closedTrades: [] }));
    expect(model.riskLog).toEqual([]);
    expect(model.riskLogEmptyReason).toContain("mốc mở/đóng");
  });
});

describe("trạng thái rỗng", () => {
  it("sổ trống nêu lý do cụ thể và chỉ đường", () => {
    const model = buildF4ViewModel(input({ openTrades: [] }));
    expect(model.openEmptyReason).toContain("Thiết lập (F2)");
    expect(model.openSummary).toBe("");
  });
});
