import { describe, expect, it } from "vitest";
import type {
  DecisionCockpitDto,
  VerdictUxLevel,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health/prepare-surfaced-health-view";
import { buildF1ViewModel, type F1ViewModelInput } from "./f1-view-model";

function provenance<T>(value: T, p: "real" | "derived" | "gap" = "real") {
  return { value, provenance: p as never };
}

function cockpit(over: Partial<DecisionCockpitDto> = {}): DecisionCockpitDto {
  const base = {
    verdict: {
      uxLevel: provenance<VerdictUxLevel>("PROBE"),
      persistedLevel: provenance("PROBE"),
      headline: provenance("Thăm dò khối lượng nhỏ"),
      subtitle: provenance(""),
      persistedLevelNote: provenance("giới hạn thăm dò"),
      explanation: provenance("Độ rộng thị trường suy yếu."),
      allocation: provenance("20-40%"),
      perTradeGuidance: provenance("0,5%"),
      confidenceBand: provenance("medium"),
      gate1Resolution: {
        canonical: "WARNING",
        source: "scan_run",
        scanGate1: "PASS",
        liveRegimeGate1: "WARNING",
        mismatch: true,
        liveOverrideApplied: true,
        note: "Chế độ trực tiếp xấu hơn lần quét.",
      },
    },
    gateFunnel: {
      gate1Level: "WARNING",
      qualifiedCountA: 3,
      qualifiedCountB: 2,
      qualifiedTotal: 5,
      surfacedCountA: 3,
      surfacedCountB: 0,
      surfacedTotal: 3,
      suppressedCountA: 0,
      suppressedCountB: 2,
      suppressedTotal: 2,
    },
    evidence: [
      { id: "e1", label: "VNINDEX vs MA50", display: "+3,5%", provenance: "real" },
      { id: "e2", label: "Độ rộng", display: "42%", provenance: "derived", hint: "dưới ngưỡng 50%" },
    ],
    opportunity: {
      mode: "candidates",
      candidates: [
        {
          candidateId: "c1",
          symbol: "FPT",
          quality: "A",
          ladderStage: "tier_a",
          healthLevel: "HEALTHY",
          healthSummary: null,
          primaryReasons: [],
          rankSummary: null,
          rsDiagnostic: null,
          actionHint: "Chờ về vùng mua",
          provenance: "real",
          rankScore: 92.4,
        },
        {
          candidateId: "c2",
          symbol: "VCB",
          quality: "B",
          ladderStage: "tier_b",
          healthLevel: "WARNING",
          healthSummary: null,
          primaryReasons: [],
          rankSummary: null,
          rsDiagnostic: null,
          actionHint: "Chờ nến xác nhận",
          provenance: "real",
          rankScore: 79.2,
        },
      ],
      nearMiss: [
        {
          symbol: "SSI",
          terminalCategory: "RS20 chưa đủ ngưỡng",
          terminalCode: "RS20_LOW",
          ladderStage: "watch",
          executionStatus: "WAIT",
          executionStatusLabel: "Gần thiết lập, chưa xác thực",
          waitFor: "RS20 ≥ 6",
          distanceToZonePct: -1.8,
          rsDiagnostic: null,
          actionHint: "",
          provenance: "real",
          partialPipelineScore: 310,
        },
      ],
      emptyReason: null,
    },
    ladder: [],
    setupQualityLadder: { stages: [], totalClassified: 0, summary: "" },
    tomorrow: {
      watchSymbols: provenance(["FPT"]),
      watchNote: provenance(null),
      watchReasons: { FPT: "Chờ về 133,5–136,8" },
      triggerLine: provenance("Vào khi giá về vùng mua."),
      avoidLine: provenance("Không đuổi giá."),
    },
    actionableDiagnostics: { blockers: [], maxShown: 3, emptyReason: null },
    blockers: [
      {
        severity: "market_off",
        title: "Độ rộng suy yếu",
        meaning: "42% mã trên MA20",
        count: 1,
        sampleSymbols: [],
        waitFor: "",
        provenance: "real",
      },
    ],
    scanRunId: "run_4182",
    rsNearMissWatchlist: {
      title: "",
      subtitle: "",
      disclaimerLines: [],
      actionHint: "",
      rows: [],
      emptyReason: null,
    },
  };
  return { ...base, ...over } as unknown as DecisionCockpitDto;
}

function candidate(over: Partial<SurfacedCandidateHealthView>): SurfacedCandidateHealthView {
  return {
    symbolKey: "FPT",
    symbolId: "sym_fpt",
    close: 138.2,
    pullbackZoneLow: 133.5,
    pullbackZoneHigh: 136.8,
    stopLevel: 129.4,
    healthScore: 88,
    ...over,
  } as unknown as SurfacedCandidateHealthView;
}

function input(over: Partial<F1ViewModelInput> = {}): F1ViewModelInput {
  return {
    cockpit: cockpit(),
    candidates: [
      candidate({}),
      candidate({ symbolKey: "VCB", symbolId: "sym_vcb", close: 91.5, healthScore: 76 }),
    ],
    rsDiagnosticsBySymbol: {
      FPT: { rs20SpreadPct: 18.6 } as never,
      VCB: { rs20SpreadPct: 3.1 } as never,
    },
    sparkBySymbolId: new Map([
      ["sym_fpt", [130, 132, 136, 138.2]],
      ["sym_vcb", [92, 91.9, 91.5]],
    ]),
    liveGate1: { level: "WARNING", error: null },
    vnindexHistory: [
      { date: "2026-08-24", close: 1273.88 },
      { date: "2026-08-25", close: 1284.62 },
    ],
    vnindexHistoryError: null,
    watchItems: [{ symbol: "FPT", symbolId: "sym_fpt", lifecycleStatus: "READY" }],
    // Khoá phải là `symbolId`, đúng như `buildLatestCloseBySymbol()` dựng ra.
    // Fixture cũ dùng mã "FPT" nên test vẫn xanh trong khi màn thật luôn ra "—".
    latestCloseBySymbolId: new Map([["sym_fpt", 138.2]]),
    watchTruncated: false,
    universeScanned: 1605,
    statusFilterPassed: 1240,
    tradabilityPassed: 612,
    ...over,
  };
}

describe("phán quyết", () => {
  it("dùng token phán quyết dùng chung — cùng màu với ô ở thanh trạng thái", () => {
    for (const [level, color, code] of [
      ["NO_TRADE", "var(--tm-down)", "NO-TRADE"],
      ["PROBE", "var(--tm-accent)", "PROBE"],
      ["TRADE", "var(--tm-up)", "TRADE"],
    ] as const) {
      const dto = cockpit();
      dto.verdict.uxLevel = provenance<VerdictUxLevel>(level) as never;
      const model = buildF1ViewModel(input({ cockpit: dto }));
      expect(model.verdict.color).toBe(color);
      expect(model.verdict.code).toBe(code);
    }
  });

  it("giữ nguyên phân bổ và rủi ro/lệnh từ DTO, không tự chế", () => {
    const model = buildF1ViewModel(input());
    expect(model.verdict.allocation).toBe("20-40%");
    expect(model.verdict.perTrade).toBe("0,5%");
  });

  it("dịch dải độ tin cậy sang nhãn tiếng Việt", () => {
    expect(buildF1ViewModel(input()).verdict.confidenceLabel).toBe("TRUNG BÌNH");
  });

  it("KHÔNG trình bày phán quyết khi Cổng 1 trực tiếp chưa đo được", () => {
    // DTO vẫn có phán quyết PROBE vì hàm nạp chế độ trả WARNING mặc định khi
    // thiếu bar — nhưng đó không phải phép đo, nên F1 không được khoe nó.
    const model = buildF1ViewModel(
      input({ liveGate1: { level: null, error: "chỉ có 31 bar VNINDEX, cần tối thiểu 50" } })
    );

    expect(model.verdict.untrusted).not.toBeNull();
    expect(model.verdict.code).toBe("—");
    expect(model.verdict.allocation).toBe("—");
    expect(model.verdict.perTrade).toBe("—");
    expect(model.verdict.confidenceBars).toBe(0);
    expect(model.verdict.provenance).toBe("gap");
    expect(model.verdict.untrusted?.reason).toContain("31 bar VNINDEX");

    // Màu cũng không được khẳng định: mã là "—" mà panel vẫn mang màu/nền đỏ của
    // NO_TRADE thì màu đang nói một kết luận rủi ro ở nơi chưa đo được gì. Hai
    // trạng thái dẫn tới hai hành động khác nhau, phải trông khác nhau.
    expect(model.verdict.color).not.toBe("var(--tm-down)");
    expect(model.verdict.headBg).not.toBe("var(--tm-head-no-trade)");
    expect(model.verdict.color).toBe("var(--tm-text-faint)");
  });

  it("đo được Cổng 1 thì phán quyết hiện bình thường", () => {
    expect(buildF1ViewModel(input()).verdict.untrusted).toBeNull();
    expect(buildF1ViewModel(input()).verdict.code).toBe("PROBE");
  });
});

describe("Cổng 1", () => {
  it("hiện CẢ HAI giá trị và ghi rõ nguồn chuẩn là trực tiếp khi live xấu hơn", () => {
    const model = buildF1ViewModel(input());
    const byKey = new Map(model.gate1Rows.map((r) => [r.key, r]));

    expect(byKey.get("CỔNG 1 · TRỰC TIẾP")?.value).toBe("CẢNH BÁO");
    expect(byKey.get("CỔNG 1 · LẦN QUÉT")?.value).toBe("ĐẠT");
    expect(byKey.get("NGUỒN CHUẨN")?.value).toBe("TRỰC TIẾP (XẤU HƠN)");
    expect(byKey.get("NGUỒN CHUẨN")?.color).toBe("var(--tm-down)");
  });

  it("PHÁN QUYẾT DÙNG luôn theo mức chuẩn của DTO, không theo mức trực tiếp", () => {
    // Bản đã lưu (FAIL) xấu hơn trực tiếp (ĐẠT) ⇒ chuẩn là FAIL. Nếu panel lấy
    // mức trực tiếp, nó sẽ khoe ĐẠT trong khi phán quyết vẫn tính trên FAIL.
    const dto = cockpit();
    dto.verdict.gate1Resolution = {
      canonical: "FAIL",
      source: "scan_run",
      scanGate1: "FAIL",
      liveRegimeGate1: "PASS",
      mismatch: true,
      liveOverrideApplied: false,
      note: "Phán quyết dùng Gate 1 tại thời điểm quét.",
    };
    const model = buildF1ViewModel(
      input({ cockpit: dto, liveGate1: { level: "PASS", error: null } })
    );
    const byKey = new Map(model.gate1Rows.map((r) => [r.key, r]));
    expect(byKey.get("PHÁN QUYẾT DÙNG")?.value).toBe("FAIL");
    expect(byKey.get("CỔNG 1 · TRỰC TIẾP")?.value).toBe("ĐẠT");
  });

  it("chế độ trực tiếp chưa đánh giá được thì hiện gap và nối bằng chứng vào ghi chú", () => {
    const model = buildF1ViewModel(
      input({
        liveGate1: { level: null, error: "chỉ có 31 bar VNINDEX, cần tối thiểu 50" },
      })
    );
    const byKey = new Map(model.gate1Rows.map((r) => [r.key, r]));
    expect(byKey.get("CỔNG 1 · TRỰC TIẾP")?.value).toBe("—");
    expect(model.gate1Note).toContain("31 bar VNINDEX");
  });

  it("không có Cổng 1 lần quét thì hiện — chứ không đoán", () => {
    const dto = cockpit();
    dto.verdict.gate1Resolution = {
      ...dto.verdict.gate1Resolution,
      scanGate1: null,
      source: "live_regime",
      liveOverrideApplied: false,
      mismatch: false,
    };
    const model = buildF1ViewModel(input({ cockpit: dto }));
    const scanRow = model.gate1Rows.find((r) => r.key === "CỔNG 1 · LẦN QUÉT");
    expect(scanRow?.value).toBe("—");
  });
});

describe("bảng thiết lập A/B", () => {
  it("ghép giá / vùng mua / cắt lỗ từ ứng viên đã kèm sức khoẻ", () => {
    const fpt = buildF1ViewModel(input()).setups.find((r) => r.symbol === "FPT");
    expect(fpt).toMatchObject({
      tier: "A",
      rankScore: 92.4,
      close: 138.2,
      zoneLow: 133.5,
      zoneHigh: 136.8,
      stop: 129.4,
      rs20: 18.6,
      healthLabel: "TỐT",
      healthScore: 88,
    });
  });

  it("tính +/- từ hai phiên cuối của sparkline", () => {
    const fpt = buildF1ViewModel(input()).setups.find((r) => r.symbol === "FPT");
    // 138,2 so với 136 → +1,6176…%
    expect(fpt?.changePct).toBeCloseTo(1.6176, 3);
  });

  it("thiếu lịch sử giá thì +/- là gap, không phải 0", () => {
    const model = buildF1ViewModel(input({ sparkBySymbolId: new Map() }));
    expect(model.setups[0].changePct).toBeNull();
    expect(model.setups[0].spark).toEqual([]);
  });

  it("thiếu RS20 thì để gap và dùng màu trung tính", () => {
    const model = buildF1ViewModel(input({ rsDiagnosticsBySymbol: undefined }));
    expect(model.setups[0].rs20).toBeNull();
    expect(model.setups[0].rsColor).toBe("var(--tm-text-faint)");
  });

  it("ứng viên không có hàng sức khoẻ tương ứng vẫn ra hàng, các ô số là gap", () => {
    const model = buildF1ViewModel(input({ candidates: [] }));
    expect(model.setups).toHaveLength(2);
    expect(model.setups[0].close).toBeNull();
    expect(model.setups[0].stop).toBeNull();
  });

  it("màu RS20 theo ngưỡng bộ quét (≥6 đạt)", () => {
    const model = buildF1ViewModel(input());
    expect(model.setups.find((r) => r.symbol === "FPT")?.rsColor).toBe("var(--tm-up)");
    expect(model.setups.find((r) => r.symbol === "VCB")?.rsColor).toBe("var(--tm-ref)");
  });
});

describe("suýt đạt", () => {
  it("READY của lane chẩn đoán KHÔNG dùng màu xanh — nó không phải tín hiệu vào lệnh", () => {
    const dto = cockpit();
    dto.opportunity.nearMiss[0] = {
      ...dto.opportunity.nearMiss[0],
      executionStatus: "READY",
    } as never;
    const model = buildF1ViewModel(input({ cockpit: dto }));
    expect(model.nearMiss[0].statusColor).not.toBe("var(--tm-up)");
    expect(model.nearMiss[0].statusColor).toBe("var(--tm-floor)");
  });

  it("giữ nguyên nhãn trạng thái chẩn đoán từ DTO", () => {
    const model = buildF1ViewModel(input());
    expect(model.nearMiss[0].status).toBe("Gần thiết lập, chưa xác thực");
    expect(model.nearMiss[0].distancePct).toBe(-1.8);
  });
});

describe("phễu bộ quét", () => {
  it("năm bước theo đúng thứ tự đường ống", () => {
    const keys = buildF1ViewModel(input()).funnel.map((r) => r.key);
    expect(keys).toEqual([
      "VŨ TRỤ ĐÃ QUÉT",
      "LỌC TRẠNG THÁI",
      "KHẢ NĂNG GIAO DỊCH",
      "SUÝT ĐẠT",
      "ĐẠT CỔNG 2 · A/B",
    ]);
  });

  it("tính % theo vũ trụ đã quét", () => {
    const rows = buildF1ViewModel(input()).funnel;
    expect(rows[1].pctOfUniverse).toBeCloseTo((1240 / 1605) * 100, 4);
    expect(rows[4].value).toBe(5);
  });

  it("bước nhỏ nhất vẫn có bề rộng thanh nhìn thấy được", () => {
    const rows = buildF1ViewModel(input()).funnel;
    expect(rows[4].barWidth).toBeGreaterThan(0);
    expect(rows[0].barWidth).toBe(100);
  });

  it("không biết vũ trụ thì % là gap và thanh bằng 0", () => {
    const rows = buildF1ViewModel(input({ universeScanned: null })).funnel;
    for (const row of rows) {
      expect(row.pctOfUniverse).toBeNull();
      expect(row.barWidth).toBe(0);
    }
  });
});

describe("VNINDEX", () => {
  it("lấy giá đóng cuối và biến động so với phiên liền trước", () => {
    const index = buildF1ViewModel(input()).index;
    expect(index.latestClose).toBe(1284.62);
    expect(index.changePct).toBeCloseTo(0.843, 2);
  });

  it("một phiên duy nhất thì biến động là gap", () => {
    const index = buildF1ViewModel(
      input({ vnindexHistory: [{ date: "2026-08-25", close: 1284.62 }] })
    ).index;
    expect(index.changePct).toBeNull();
  });

  it("chuyển NGUYÊN VĂN lỗi xuống panel, không rút gọn thành cờ", () => {
    const evidence = "fetchVnindexHistoryCached(30) thất bại (…): Error: timeout";
    expect(buildF1ViewModel(input({ vnindexHistoryError: evidence })).index.error).toBe(evidence);
    expect(buildF1ViewModel(input()).index.error).toBeNull();
  });
});

describe("danh mục theo dõi", () => {
  it("để biến động là gap vì chỉ có giá đóng gần nhất, không có phiên trước", () => {
    const model = buildF1ViewModel(input());
    expect(model.watch[0].changePct).toBeNull();
    expect(model.watch[0].close).toBe(138.2);
    // Chốt luôn CHIỀU TRA CỨU: map theo `symbolId`, không theo mã. Trước đây
    // fixture dùng mã nên test xanh trong khi màn thật luôn hiện "—".
    expect(
      buildF1ViewModel(input({ latestCloseBySymbolId: new Map([["FPT", 138.2]]) })).watch[0].close
    ).toBeNull();
    expect(model.watch[0].state).toBe("SẴN SÀNG");
  });
});

describe("kế hoạch phiên mai", () => {
  it("liệt kê mã theo dõi kèm lý do, rồi tới điều kiện kích hoạt và thứ cần tránh", () => {
    const plan = buildF1ViewModel(input()).plan;
    expect(plan[0]).toMatchObject({ n: "1", title: "Theo dõi FPT" });
    expect(plan[0].note).toContain("133,5");
    expect(plan.at(-2)?.title).toBe("Điều kiện kích hoạt");
    expect(plan.at(-1)?.title).toBe("Cần tránh");
  });

  it("không có mã nào thì nêu lý do thay vì để trống", () => {
    const dto = cockpit();
    dto.tomorrow.watchSymbols = provenance<string[]>([]) as never;
    dto.tomorrow.watchNote = provenance("Chưa có mã đạt Cổng 2.") as never;
    const plan = buildF1ViewModel(input({ cockpit: dto })).plan;
    expect(plan[0].note).toBe("Chưa có mã đạt Cổng 2.");
  });
});

describe("bằng chứng", () => {
  it("giữ nguyên nhãn nguồn dữ liệu của từng dòng", () => {
    const rows = buildF1ViewModel(input()).evidence;
    expect(rows.map((r) => r.provenance)).toEqual(["real", "derived"]);
    expect(rows[1].hint).toBe("dưới ngưỡng 50%");
  });
});
