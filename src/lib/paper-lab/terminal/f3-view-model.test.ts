import { describe, expect, it } from "vitest";
import {
  buildF3ViewModel,
  type AgentClass,
  type BattleRecord,
  type F3ViewModelInput,
} from "./f3-view-model";

function battle(over: Partial<BattleRecord> = {}): BattleRecord {
  return {
    id: "b1",
    sessionDate: new Date("2026-08-22T00:00:00.000Z"),
    symbol: "HPG",
    status: "RESOLVED",
    benchmarkReturn5dPct: 1.2,
    battleDecisions: [
      {
        id: "d1",
        agentId: "a1",
        action: "BUY",
        confidence: 0.82,
        reasoning: "RS20 dẫn dắt, nền 11 phiên",
        agent: { id: "a1", displayName: "Momentum-A", agentClass: "AI" },
      },
      {
        id: "d2",
        agentId: "a2",
        action: "HOLD",
        confidence: 0.61,
        reasoning: "Chờ test lại biên dưới",
        agent: { id: "a2", displayName: "Nhã", agentClass: "HUMAN" },
      },
    ],
    outcomes: [
      {
        battleDecisionId: "d1",
        agentId: "a1",
        verdict: "CORRECT_BUY",
        rMultiple: 1.4,
        forwardReturn5dPct: 4.2,
      },
      {
        battleDecisionId: "d2",
        agentId: "a2",
        verdict: "NEUTRAL",
        rMultiple: null,
        forwardReturn5dPct: 0,
      },
    ],
    ...over,
  };
}

function input(over: Partial<F3ViewModelInput> = {}): F3ViewModelInput {
  return {
    leaderboard: [
      {
        agentId: "a1",
        agentName: "Momentum-A",
        style: "momentum",
        navVnd: 1_186_000_000,
        pnlPct: 18.6,
        realizedPnlVnd: 0,
        unrealizedPnlVnd: 0,
        winRate: 0.625,
        maxDrawdownPct: 6.2,
        sharpeLike: 1.42,
        tradeCount: 184,
        openPositions: 2,
        rank: 1,
        rankChange: 0,
      },
      {
        agentId: "a2",
        agentName: "Nhã",
        style: "human",
        navVnd: 1_084_000_000,
        pnlPct: -2.6,
        realizedPnlVnd: 0,
        unrealizedPnlVnd: 0,
        winRate: 0.545,
        maxDrawdownPct: 13.8,
        sharpeLike: 0.92,
        tradeCount: 42,
        openPositions: 1,
        rank: 2,
        rankChange: 0,
      },
    ],
    portfolios: [
      { agentId: "a1", navSparkline: [100, 104, 110, 118.6] } as never,
    ],
    agentClassBySlug: new Map<string, AgentClass>([
      ["a1", "AI"],
      ["a2", "HUMAN"],
    ]),
    battles: [battle()],
    recentBattles: [
      { sessionDate: "2026-08-22", symbol: "HPG", insight: "Vào sớm 1 phiên hơn hẳn chờ xác nhận" } as never,
    ],
    hof: [
      {
        id: "h1",
        achievementType: "HIGHEST_R_MULTIPLE",
        agent: "Momentum-A",
        session: "2026-08-19",
        symbol: "SSI",
        value: 4.8,
      },
    ],
    humanCalls: [
      { id: "hc1", symbol: "MWG", action: "HOLD", reasoning: "Bỏ qua đề xuất MUA", kind: "override" },
      { id: "hc2", symbol: "HPG", action: "BUY", reasoning: "Theo kế hoạch", kind: "accepted" },
    ],
    totalAgents: 6,
    decisionCount: 1024,
    emptyReasons: {
      agents: "chưa có tác tử",
      battles: "chưa có trận",
      hof: "chưa có kỷ lục",
      humanLog: "chưa có quyết định người",
    },
    ...over,
  };
}

describe("bảng xếp hạng", () => {
  it("gắn lớp tác tử từ bản đồ slug, không đoán từ tên", () => {
    const rows = buildF3ViewModel(input()).agents;
    expect(rows[0]).toMatchObject({ name: "Momentum-A", classLabel: "LLM" });
    expect(rows[1]).toMatchObject({ name: "Nhã", classLabel: "NGƯỜI" });
  });

  it("KHÔNG đoán lớp khi tra trượt — hiện gap thay vì gán nhầm thành LLM", () => {
    // Tra trượt (hoặc truy vấn lớp tác tử hỏng) mà mặc định về LLM sẽ hiển thị
    // một tác tử NGƯỜI thành máy, ngay trên màn so kè người vs tác tử.
    const rows = buildF3ViewModel(input({ agentClassBySlug: new Map() })).agents;
    expect(rows).toHaveLength(2);
    expect(rows[0].agentClass).toBe("UNKNOWN");
    expect(rows[0].classLabel).toBe("—");
    expect(rows[1].classLabel).toBe("—");
  });

  it("ghép đường vốn theo agentId; không có thì để mảng rỗng chứ không mượn của tác tử khác", () => {
    const rows = buildF3ViewModel(input()).agents;
    expect(rows[0].navSparkline).toEqual([100, 104, 110, 118.6]);
    expect(rows[1].navSparkline).toEqual([]);
  });

  it("giữ nguyên chỉ số từ DTO", () => {
    const row = buildF3ViewModel(input()).agents[0];
    expect(row).toMatchObject({
      tradeCount: 184,
      sharpeLike: 1.42,
      pnlPct: 18.6,
      maxDrawdownPct: 6.2,
    });
  });

  it("đổi tỉ lệ thắng 0..1 của DTO sang phần trăm — không hiện 0,6%", () => {
    const rows = buildF3ViewModel(input()).agents;
    expect(rows[0].winRatePct).toBeCloseTo(62.5, 6);
    expect(rows[1].winRatePct).toBeCloseTo(54.5, 6);
  });

  it("KHÔNG nhân lại lợi nhuận và sụt giảm — hai cột đó đã là phần trăm", () => {
    const row = buildF3ViewModel(input()).agents[0];
    expect(row.pnlPct).toBe(18.6);
    expect(row.maxDrawdownPct).toBe(6.2);
  });
});

describe("bảng trận đấu", () => {
  it("đếm số tác tử theo số quyết định thật trong trận", () => {
    expect(buildF3ViewModel(input()).battles[0].agentCount).toBe(2);
  });

  it("xác định tác tử thắng từ verdict, không đoán theo lợi nhuận", () => {
    expect(buildF3ViewModel(input()).battles[0].winner).toBe("Momentum-A");
  });

  it("trận chưa có kết quả đúng thì THẮNG là gap", () => {
    const model = buildF3ViewModel(
      input({
        battles: [
          battle({
            status: "OPEN",
            outcomes: [
              { battleDecisionId: "d1", agentId: "a1", verdict: "PENDING", rMultiple: null, forwardReturn5dPct: null },
            ],
          }),
        ],
      })
    );
    expect(model.battles[0].winner).toBeNull();
    expect(model.battles[0].status).toBe("ĐANG CHẠY");
  });

  it("lấy bài học từ tóm tắt trận gần nhất khớp phiên + mã", () => {
    expect(buildF3ViewModel(input()).battles[0].insight).toContain("Vào sớm 1 phiên");
  });

  it("không khớp bài học thì để rỗng chứ không lấy nhầm của trận khác", () => {
    const model = buildF3ViewModel(
      input({
        recentBattles: [
          { sessionDate: "2026-08-19", symbol: "SSI", insight: "Của trận khác" } as never,
        ],
      })
    );
    expect(model.battles[0].insight).toBe("");
  });

  it("thiếu lợi suất chuẩn thì để gap, không hiện 0", () => {
    const model = buildF3ViewModel(input({ battles: [battle({ benchmarkReturn5dPct: null })] }));
    expect(model.battles[0].benchmarkPct).toBeNull();
  });
});

describe("chi tiết trận đấu", () => {
  it("dựng một chi tiết cho mỗi trận, kèm quyết định từng tác tử", () => {
    const detail = buildF3ViewModel(input()).battleDetails.b1;
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows[0]).toMatchObject({
      agent: "Momentum-A",
      action: "BUY",
      confidence: 0.82,
      forwardReturn5dPct: 4.2,
      verdict: "MUA ĐÚNG",
    });
  });

  it("quyết định không có kết quả thì verdict là CHỜ và các số là gap", () => {
    const detail = buildF3ViewModel(input({ battles: [battle({ outcomes: [] })] })).battleDetails.b1;
    expect(detail.rows[0].verdict).toBe("CHỜ");
    expect(detail.rows[0].forwardReturn5dPct).toBeNull();
    expect(detail.rows[0].rMultiple).toBeNull();
  });

  it("nhận diện lớp NGƯỜI trong chi tiết trận", () => {
    const detail = buildF3ViewModel(input()).battleDetails.b1;
    expect(detail.rows[1].classLabel).toBe("NGƯỜI");
  });
});

describe("băng cảnh báo mô phỏng", () => {
  it("đếm tác tử, trận và quyết định từ nguồn thật", () => {
    const d = buildF3ViewModel(input()).disclaimer;
    expect(d).toEqual({ agentCount: 6, decisionCount: 1024, battleCount: 1 });
  });

  it("thiếu số liệu thì để gap chứ không về 0", () => {
    const d = buildF3ViewModel(input({ totalAgents: null, decisionCount: null })).disclaimer;
    expect(d.agentCount).toBeNull();
    expect(d.decisionCount).toBeNull();
  });
});

describe("bảng vàng", () => {
  it("gắn đúng đơn vị theo loại kỷ lục — một cột value nhưng nhiều thang đo", () => {
    const rows = (over: { achievementType: string; value: number }) =>
      buildF3ViewModel(
        input({
          hof: [
            { id: "h", agent: "A", session: "2026-08-19", symbol: "SSI", ...over },
          ],
        })
      ).hof[0];

    expect(rows({ achievementType: "HIGHEST_R_MULTIPLE", value: 4.8 }).value).toBe("+4,80R");
    expect(rows({ achievementType: "GREATEST_TRADE", value: 26_400_000 }).value).toBe("+26,4 tr ₫");
    expect(rows({ achievementType: "BEST_MONTHLY_RETURN", value: 12.5 }).value).toBe("12,5%");
    // Nguồn là tỉ lệ 0..1 — phải ra 82,0% chứ không phải 0,8.
    expect(rows({ achievementType: "MOST_ACCURATE_AGENT", value: 0.82 }).value).toBe("82,0%");
    expect(rows({ achievementType: "LONGEST_WIN_STREAK", value: 7 }).value).toBe("7 lệnh");
  });

  it("dịch tên loại kỷ lục sang tiếng Việt", () => {
    expect(buildF3ViewModel(input()).hof[0].type).toBe("R lớn nhất một lệnh");
  });
});

describe("nhật ký người vs tác tử", () => {
  it("gắn nhãn GHI ĐÈ / ĐỒNG Ý theo phân loại đầu vào", () => {
    const rows = buildF3ViewModel(input()).humanLog;
    expect(rows[0].tag).toBe("GHI ĐÈ");
    expect(rows[1].tag).toBe("ĐỒNG Ý");
    expect(rows[0].message).toContain("MWG");
  });
});

describe("trạng thái rỗng", () => {
  it("mỗi panel rỗng mang lý do riêng, không dùng chung một câu", () => {
    const model = buildF3ViewModel(
      input({ leaderboard: [], battles: [], hof: [], humanCalls: [] })
    );
    expect(model.agentsEmptyReason).toBe("chưa có tác tử");
    expect(model.battlesEmptyReason).toBe("chưa có trận");
    expect(model.hofEmptyReason).toBe("chưa có kỷ lục");
    expect(model.humanLogEmptyReason).toBe("chưa có quyết định người");
  });

  it("panel có dữ liệu thì không mang lý do rỗng", () => {
    const model = buildF3ViewModel(input());
    expect(model.agentsEmptyReason).toBeNull();
    expect(model.battlesEmptyReason).toBeNull();
  });
});

describe("không bịa số khi thiếu dữ liệu", () => {
  it("đọc trận đấu lỗi thì số trận là gap, không phải 0", () => {
    // 0 TRẬN nghĩa là "hôm nay không có trận nào" — một sự thật. Khi truy vấn
    // hỏng thì ta KHÔNG biết có bao nhiêu trận, và hai điều đó không được in
    // giống nhau.
    const failed = buildF3ViewModel(input({ battles: [], battlesLoadFailed: true }));
    expect(failed.disclaimer.battleCount).toBeNull();

    const empty = buildF3ViewModel(input({ battles: [] }));
    expect(empty.disclaimer.battleCount).toBe(0);
  });

  it("tác tử chưa có hàng hiệu suất thì mọi cột đo là gap, không phải 0", () => {
    const model = buildF3ViewModel(
      input({
        leaderboard: [
          {
            agentId: "a1",
            agentName: "Mới toanh",
            style: "momentum",
            navVnd: null,
            pnlPct: null,
            realizedPnlVnd: null,
            unrealizedPnlVnd: null,
            winRate: null,
            maxDrawdownPct: null,
            sharpeLike: null,
            tradeCount: null,
            openPositions: null,
            rank: 1,
            rankChange: 0,
          },
        ],
      })
    );
    const row = model.agents[0];
    expect(row.tradeCount).toBeNull();
    expect(row.winRatePct).toBeNull();
    expect(row.sharpeLike).toBeNull();
    expect(row.pnlPct).toBeNull();
    expect(row.maxDrawdownPct).toBeNull();
  });
});
