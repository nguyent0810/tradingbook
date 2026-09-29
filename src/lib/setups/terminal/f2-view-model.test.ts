import { describe, expect, it } from "vitest";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health/prepare-surfaced-health-view";
import type { TradeSuggestion, TradeSuggestionResult } from "@/lib/trades/trade-suggestion";
import { buildF2ViewModel, type F2ViewModelInput } from "./f2-view-model";

/**
 * A suggestion as the builder would hand it over. The numbers are deliberately
 * NOT what the old F2 formula gives (zone high × 1.12 = 153,22; R:R from the
 * zone high), so every assertion below proves F2 shows the suggestion rather
 * than computing its own.
 */
function suggestion(over: Partial<TradeSuggestion> = {}): TradeSuggestion {
  return {
    asOfSession: "2026-08-25",
    exchange: "HOSE",
    exchangeAssumed: false,
    entryZone: { low: 133.5, high: 136.8 },
    stopZone: { structural: 129.4, minFeasible: 130, low: 129.4, high: 130 },
    r: { perShareGross: 7.4, perShareNet: 7.93 },
    targets: [
      { r: 1, price: 145, nearestResistance: 150.2, resistanceBelow: false },
      { r: 2, price: 152.9, nearestResistance: 150.2, resistanceBelow: true },
      { r: 3, price: 160.8, nearestResistance: 150.2, resistanceBelow: true },
    ],
    size: null,
    reasons: [],
    risks: [],
    evidence: { status: "UNVALIDATED", prospectiveN: 7, checkpointN: 100 },
    ...over,
  };
}

function suggestions(result: TradeSuggestionResult = { ok: true, suggestion: suggestion() }) {
  return new Map([["cand_fpt", result]]);
}

function candidate(over: Partial<SurfacedCandidateHealthView> = {}): SurfacedCandidateHealthView {
  return {
    id: "cand_fpt",
    symbolKey: "FPT",
    symbolId: "sym_fpt",
    quality: "A",
    close: 138.2,
    pullbackZoneLow: 133.5,
    pullbackZoneHigh: 136.8,
    stopLevel: 129.4,
    rankScore: 92.4,
    healthScore: 88,
    healthLevel: "HEALTHY",
    healthLines: [],
    healthSummary: "Nền chắc, khối lượng nén",
    healthHint: null,
    barDate: new Date("2026-08-25T00:00:00.000Z"),
    ...over,
  } as unknown as SurfacedCandidateHealthView;
}

function input(over: Partial<F2ViewModelInput> = {}): F2ViewModelInput {
  return {
    candidates: [candidate()],
    reasonLinesBySymbol: { FPT: ["Giá trên MA20 và MA50", "Nền tích luỹ 11 phiên"] },
    rsBySymbol: new Map([["FPT", { rs20SpreadPct: 18.6 } as never]]),
    advBySymbolId: new Map([["sym_fpt", 184_000_000_000]]),
    closesBySymbolId: new Map([["sym_fpt", [130, 132, 136, 138.2]]]),
    suggestionBySetupId: suggestions(),
    prospectiveN: 7,
    sizing: {
      equityVnd: 1_200_000_000,
      baseRiskPct: 0.01,
      maxTradePct: 0.12,
      liquidityCapPct: 0.025,
      currentExposureVnd: 0,
    },
    closest: [
      {
        symbol: "SSI",
        terminalCategory: "rs20_below",
        close: 34.15,
        pullbackZoneLow: 33.0,
        pullbackZoneHigh: 33.8,
        stopLevel: 32.0,
        breakoutLevel: 35.0,
        rankScore: 0,
        partialPipelineScore: 310,
        stageRank: 3,
        reasonLineCount: 10,
        terminalReasonPreview: "RS20 chưa đủ ngưỡng",
      } as never,
    ],
    rsWatchRows: [{ symbol: "PNJ", rs20SpreadPct: 8.4, topRejectionReason: "Nền chưa hình thành" }],
    rsWatchEmptyReason: null,
    funnel: {
      universeScanned: 1605,
      statusFilterPassed: 1240,
      tradabilityPassed: 612,
      qualifiedTotal: 5,
    },
    scanLabel: "25/08/2026 09:15:02",
    scanId: "run_4182",
    scanLog: [],
    candidatesEmptyReason: "Không mã nào đạt đủ tiêu chí.",
    verdictLevel: "PROBE",
    verdictAllocation: "20-40%",
    verdictBlockedReason: null,
    ...over,
  };
}

describe("phễu F2", () => {
  it("năm bước đúng thứ tự đường ống", () => {
    expect(buildF2ViewModel(input()).funnel.map((c) => c.key)).toEqual([
      "VŨ TRỤ ĐÃ QUÉT",
      "LỌC TRẠNG THÁI",
      "KHẢ NĂNG GIAO DỊCH",
      "SUÝT ĐẠT",
      "ĐẠT CỔNG 2",
    ]);
  });

  it("đếm suýt đạt theo số hàng thật, không lấy từ đâu khác", () => {
    expect(buildF2ViewModel(input()).funnel[3].value).toBe(1);
  });

  it("thiếu số liệu lần quét thì để gap chứ không về 0", () => {
    const funnel = buildF2ViewModel(
      input({
        funnel: {
          universeScanned: null,
          statusFilterPassed: null,
          tradabilityPassed: null,
          qualifiedTotal: null,
        },
      })
    ).funnel;
    expect(funnel[0].value).toBeNull();
    expect(funnel[4].value).toBeNull();
  });
});

describe("hồ sơ thiết lập", () => {
  it("gắn setupId để phiếu ghi lệnh gọi được server action", () => {
    expect(buildF2ViewModel(input()).details.FPT.setupId).toBe("cand_fpt");
  });

  it("KPI lấy vùng vào, vùng SL, R và mốc 2R từ gợi ý lệnh, cùng RS và sức khoẻ thật", () => {
    const kpis = buildF2ViewModel(input()).details.FPT.kpis;
    const byKey = new Map(kpis.map((k) => [k.key, k.value]));
    expect(byKey.get("VÙNG VÀO")).toBe("133,50–136,80");
    expect(byKey.get("VÙNG SL")).toBe("129,40–130,00");
    expect(byKey.get("R / CP")).toBe("7,40");
    expect(byKey.get("MỐC 2R")).toBe("152,90");
    expect(byKey.get("RS20 vs VNINDEX")).toBe("+18,6");
    expect(byKey.get("SỨC KHOẺ")).toBe("TỐT 88");
    expect(byKey.get("GTGD 20N")).toBe("184,00 tỷ ₫");
  });

  it("thiếu GTGD thì hiện — chứ không hiện 0", () => {
    const kpis = buildF2ViewModel(input({ advBySymbolId: new Map() })).details.FPT.kpis;
    expect(kpis.find((k) => k.key === "GTGD 20N")?.value).toBe("—");
  });
});

describe("gợi ý lệnh trên F2", () => {
  it("không còn tự tính mục tiêu ×1,12 hay R:R riêng", () => {
    const kpis = buildF2ViewModel(input()).details.FPT.kpis;
    expect(kpis.map((k) => k.key)).not.toContain("MỤC TIÊU 1");
    expect(kpis.map((k) => k.key)).not.toContain("R:R");
    // 136,80 × 1,12 = 153,216 — con số cũ không được xuất hiện ở đâu.
    const all = JSON.stringify(buildF2ViewModel(input()).details.FPT);
    expect(all).not.toContain("153,22");
  });

  it("hiện vùng vào, vùng SL, R gộp và sau phí, theo phiên", () => {
    const s = buildF2ViewModel(input()).details.FPT.suggestion;
    expect(s.unavailable).toBeNull();
    expect(s.asOf).toBe("Theo phiên 25/08/2026 · HOSE");
    const rows = new Map(s.rows.map((r) => [r.key, r]));
    expect(rows.get("Vùng vào tham khảo")?.value).toBe("133,50–136,80");
    expect(rows.get("Vùng SL")?.value).toBe("129,40–130,00");
    expect(rows.get("Vùng SL")?.note).toBe("cấu trúc 129,40 · tối thiểu 130,00");
    expect(rows.get("R / cổ phiếu")?.value).toBe("7,40 · sau phí 7,93");
  });

  it("ba mốc chốt kèm kháng cự gần nhất, cảnh báo khi kháng cự nằm dưới mốc", () => {
    const targets = buildF2ViewModel(input()).details.FPT.suggestion.targets;
    expect(targets.map((t) => [t.key, t.value])).toEqual([
      ["Mốc 1R", "145,00"],
      ["Mốc 2R", "152,90"],
      ["Mốc 3R", "160,80"],
    ]);
    expect(targets[0].note).toBe("kháng cự gần nhất 150,20");
    expect(targets[1].note).toBe("kháng cự gần nhất 150,20 · có kháng cự nằm dưới mốc");
    expect(targets[1].color).not.toBe(targets[0].color);
  });

  it("không thấy kháng cự thì nói rõ, không để trống", () => {
    const noRes = suggestion({
      targets: [1, 2, 3].map((r) => ({
        r: r as 1 | 2 | 3,
        price: 140 + r,
        nearestResistance: null,
        resistanceBelow: false,
      })),
    });
    const targets = buildF2ViewModel(input({ suggestionBySetupId: suggestions({ ok: true, suggestion: noRes }) }))
      .details.FPT.suggestion.targets;
    expect(targets[0].note).toBe("chưa thấy kháng cự phía trên vùng vào");
  });

  it("sàn chưa rõ thì ghi là giả định HOSE", () => {
    const s = buildF2ViewModel(
      input({ suggestionBySetupId: suggestions({ ok: true, suggestion: suggestion({ exchangeAssumed: true }) }) })
    ).details.FPT.suggestion;
    expect(s.asOf).toBe("Theo phiên 25/08/2026 · giả định HOSE");
  });

  it("trạng thái kiểm chứng: Chưa kiểm chứng (N/100), dẫn tới ADR 0001", () => {
    const evidence = buildF2ViewModel(input()).details.FPT.suggestion.evidence;
    expect(evidence.label).toBe("Chưa kiểm chứng (7/100)");
    expect(evidence.href).toContain("docs/adr/0001");
  });

  it("không đọc được registry thì hiện N không rõ, không hiện 0", () => {
    const unknown = suggestion({ evidence: { status: "UNVALIDATED", prospectiveN: null, checkpointN: 100 } });
    const evidence = buildF2ViewModel(
      input({ suggestionBySetupId: suggestions({ ok: true, suggestion: unknown }), prospectiveN: null })
    ).details.FPT.suggestion.evidence;
    expect(evidence.label).toBe("Chưa kiểm chứng (N không rõ/100)");
  });

  it("không tính được thì hiện 'không đủ dữ liệu' kèm lý do, không bao giờ 0 hay NaN", () => {
    const detail = buildF2ViewModel(
      input({
        suggestionBySetupId: suggestions({
          ok: false,
          reason: "TOO_FEW_BARS",
          detail: "mới có 40 phiên giá, cần ít nhất 65",
        }),
      })
    ).details.FPT;
    expect(detail.suggestion.unavailable).toBe("Không đủ dữ liệu — mới có 40 phiên giá, cần ít nhất 65");
    expect(detail.suggestion.rows).toEqual([]);
    expect(detail.suggestion.targets).toEqual([]);
    expect(detail.suggestion.evidence.label).toBe("Chưa kiểm chứng (7/100)");
    const byKey = new Map(detail.kpis.map((k) => [k.key, k.value]));
    for (const key of ["VÙNG VÀO", "VÙNG SL", "R / CP", "MỐC 2R"]) {
      expect(byKey.get(key), key).toBe("—");
    }
    expect(JSON.stringify(detail.kpis)).not.toMatch(/NaN|"0,00"/);
  });

  it("thiếu gợi ý cho ứng viên (nạp nến lỗi) cũng là không đủ dữ liệu", () => {
    const s = buildF2ViewModel(input({ suggestionBySetupId: new Map() })).details.FPT.suggestion;
    expect(s.unavailable).toBe("Không đủ dữ liệu — chưa nạp được nến giá của mã này");
  });
});

describe("định cỡ vị thế theo phán quyết", () => {
  it("PROBE cắt khối lượng còn 30% và nói rõ đã bớt bao nhiêu", () => {
    const detail = buildF2ViewModel(input()).details.FPT;
    const rows = new Map(detail.sizing.map((r) => [r.key, r.value]));
    expect(rows.has("Khối lượng chuẩn")).toBe(true);
    expect(rows.has("Khối lượng 30%")).toBe(true);
    expect(detail.sizingNote).toContain("PROBE");
    expect(detail.sizingNote).toContain("30%");
  });

  it("NO_TRADE đưa khối lượng đề xuất về 0", () => {
    const detail = buildF2ViewModel(input({ verdictLevel: "NO_TRADE" })).details.FPT;
    const row = detail.sizing.find((r) => r.key === "Khối lượng 0%");
    expect(row?.value).toBe("0 cp");
  });

  it("TRADE giữ nguyên khối lượng chuẩn", () => {
    const detail = buildF2ViewModel(input({ verdictLevel: "TRADE" })).details.FPT;
    const standard = detail.sizing.find((r) => r.key === "Khối lượng chuẩn")?.value;
    const applied = detail.sizing.find((r) => r.key === "Khối lượng 100%")?.value;
    expect(applied).toBe(standard);
  });

  it("khối lượng chuẩn đã làm tròn xuống lô chẵn 100 cp", () => {
    const detail = buildF2ViewModel(input()).details.FPT;
    const standard = detail.sizing.find((r) => r.key === "Khối lượng chuẩn")?.value ?? "";
    const shares = Number.parseInt(standard.replace(/\D/g, ""), 10);
    expect(shares % 100).toBe(0);
    expect(detail.systemShares).toBe(shares);
  });

  it("chưa có vốn tài khoản thì CHẶN tính, không rơi về giá trị mặc định", () => {
    const detail = buildF2ViewModel(
      input({
        sizing: {
          equityVnd: null,
          baseRiskPct: null,
          maxTradePct: null,
          liquidityCapPct: null,
          currentExposureVnd: 0,
        },
      })
    ).details.FPT;
    expect(detail.sizing).toEqual([]);
    expect(detail.systemShares).toBeNull();
    expect(detail.sizingBlocked).toContain("Chưa đặt vốn tài khoản");
  });

  it("không đọc được vị thế đang mở thì CHẶN tính, không coi như danh mục rỗng", () => {
    // 0 nghĩa là "đang không giữ gì" và cho khối lượng lớn nhất có thể; nếu truy
    // vấn hỏng mà vẫn dùng 0 thì màn đề xuất khối lượng CAO HƠN trần server áp.
    const detail = buildF2ViewModel(
      input({
        sizing: {
          equityVnd: 500_000_000,
          baseRiskPct: null,
          maxTradePct: null,
          liquidityCapPct: null,
          currentExposureVnd: null,
        },
      })
    ).details.FPT;
    expect(detail.sizing).toEqual([]);
    expect(detail.systemShares).toBeNull();
    expect(detail.sizingBlocked).toContain("vị thế đang mở");
  });

  it("cắt lỗ cao hơn giá vào thì báo mã lỗi thay vì ra số vô nghĩa", () => {
    const detail = buildF2ViewModel(
      input({ candidates: [candidate({ stopLevel: 200 })] })
    ).details.FPT;
    expect(detail.sizingBlocked).toContain("ENTRY_NOT_ABOVE_STOP");
    expect(detail.systemShares).toBeNull();
  });

  it("không có phán quyết thì không thêm hàng khối lượng theo phán quyết", () => {
    const detail = buildF2ViewModel(
      input({ verdictLevel: null, verdictAllocation: null })
    ).details.FPT;
    expect(detail.sizing.some((r) => r.key.startsWith("Khối lượng "))).toBe(true);
    expect(detail.sizing.some((r) => /Khối lượng \d+%/.test(r.key))).toBe(false);
    expect(detail.sizingNote).toBeNull();
  });
});

describe("tiêu chí Cổng 2", () => {
  it("dòng lý do đánh dấu ĐẠT, cờ sức khoẻ đánh dấu CẢNH BÁO", () => {
    const rows = buildF2ViewModel(
      input({ candidates: [candidate({ healthLines: ["Khối lượng cạn dần"] })] })
    ).details.FPT.gate2;
    expect(rows.filter((r) => r.mark === "✓")).toHaveLength(2);
    const warn = rows.find((r) => r.mark === "!");
    expect(warn?.label).toBe("Khối lượng cạn dần");
    expect(warn?.value).toBe("CẢNH BÁO");
  });

  it("không có dòng lý do nào thì trả mảng rỗng để panel hiện trạng thái rỗng", () => {
    expect(buildF2ViewModel(input({ reasonLinesBySymbol: {} })).details.FPT.gate2).toEqual([]);
  });
});

describe("danh sách suýt đạt", () => {
  it("trạng thái chẩn đoán KHÔNG dùng màu xanh của tín hiệu vào lệnh", () => {
    const row = buildF2ViewModel(input()).nearMiss[0];
    expect(row.symbol).toBe("SSI");
    expect(row.statusColor).not.toBe("var(--tm-up)");
  });

  it("RS20 lấy từ bản đồ chẩn đoán, thiếu thì gap", () => {
    expect(buildF2ViewModel(input()).nearMiss[0].rs20).toBeNull();
    const withRs = buildF2ViewModel(
      input({ rsBySymbol: new Map([["SSI", { rs20SpreadPct: 4.2 } as never]]) })
    );
    expect(withRs.nearMiss[0].rs20).toBe(4.2);
  });
});

describe("mã chọn mặc định", () => {
  it("là ứng viên đầu danh sách", () => {
    expect(buildF2ViewModel(input()).defaultSymbol).toBe("FPT");
  });

  it("không có ứng viên thì null và kèm lý do rỗng", () => {
    const model = buildF2ViewModel(input({ candidates: [] }));
    expect(model.defaultSymbol).toBeNull();
    expect(model.candidatesEmptyReason).toBe("Không mã nào đạt đủ tiêu chí.");
  });
});

describe("phễu bộ quét không tô màu cho bậc chưa đo được", () => {
  it("bậc thiếu số hiện màu mờ, bậc có số mới mang màu bậc", () => {
    // Vạch màu là một khẳng định "bậc này đã đo xong". Ô "—" mà vạch vẫn xanh
    // thì màu đang nói thay dữ liệu — cùng lỗi đã sửa cho phễu của F1.
    const model = buildF2ViewModel(
      input({
        funnel: {
          universeScanned: 1605,
          statusFilterPassed: null,
          tradabilityPassed: null,
          qualifiedTotal: null,
        },
      })
    );
    const cell = (k: string) => model.funnel.find((c) => c.key === k);
    expect(cell("VŨ TRỤ ĐÃ QUÉT")?.color).toBe("var(--tm-floor)");
    for (const k of ["LỌC TRẠNG THÁI", "KHẢ NĂNG GIAO DỊCH", "ĐẠT CỔNG 2"]) {
      expect(cell(k)?.value, k).toBeNull();
      expect(cell(k)?.color, k).toBe("var(--tm-text-faint)");
    }
  });
});
