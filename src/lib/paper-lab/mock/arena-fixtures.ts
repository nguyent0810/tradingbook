import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import {
  buildBattleInsight,
  buildDecisionExplanation,
} from "@/lib/paper-lab/ui/arena-copy";

const SESSION = "2026-06-26";

function agentName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug;
}

function mockExplanation(
  agentId: string,
  action: AgentAction,
  symbol: string,
  summary: string,
  supporting: string[] = [],
  opposing: string[] = []
) {
  const base = buildDecisionExplanation({
    agentId,
    action,
    symbol,
    reasoningSummary: summary,
    payload: {
      supporting_signals: supporting.length ? ["gate2_quality_A"] : [],
      opposing_signals: opposing.length ? ["weak_regime"] : [],
      market_regime_assumption: "PASS",
    },
  });
  return {
    ...base,
    summary,
    supporting: supporting.length ? supporting : base.supporting,
    opposing: opposing.length ? opposing : base.opposing,
    auditReasoning: summary,
  };
}

/** Mock arena data for UI shell and tests when DB has no runs yet. */
export function buildMockPaperLabPageDto(): PaperLabPageDto {
  const leaderboard = PAPER_AGENT_SEEDS.filter((a) => a.slug !== "cio").map((agent, i) => {
    const returnPct = 8.5 - i * 1.2 + (i % 3) * 0.4;
    const nav = PAPER_INITIAL_CAPITAL_VND * (1 + returnPct / 100);
    return {
      agentId: agent.slug,
      agentName: agent.displayName,
      style: agent.style,
      navVnd: Math.round(nav),
      pnlPct: returnPct,
      realizedPnlVnd: Math.round(PAPER_INITIAL_CAPITAL_VND * (returnPct * 0.6) / 100),
      unrealizedPnlVnd: Math.round(PAPER_INITIAL_CAPITAL_VND * (returnPct * 0.4) / 100),
      winRate: 0.62 - i * 0.03,
      maxDrawdownPct: 4 + i * 0.8,
      sharpeLike: 1.4 - i * 0.12,
      tradeCount: 18 - i,
      openPositions: Math.max(1, 4 - Math.floor(i / 2)),
      rank: i + 1,
      rankChange: i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0,
    };
  });

  const best = leaderboard[0]!;
  const worst = leaderboard[leaderboard.length - 1]!;

  const portfolios = leaderboard.map((row, i) => {
    const base = PAPER_INITIAL_CAPITAL_VND;
    const spark = Array.from({ length: 10 }, (_, j) =>
      Math.round(base * (1 + (row.pnlPct * (j + 1)) / 1000))
    );
    return {
      agentId: row.agentId,
      agentName: row.agentName,
      style: row.style,
      startingCapitalVnd: PAPER_INITIAL_CAPITAL_VND,
      cashVnd: Math.round(PAPER_INITIAL_CAPITAL_VND * 0.35),
      investedVnd: Math.round(row.navVnd - PAPER_INITIAL_CAPITAL_VND * 0.35),
      navVnd: row.navVnd,
      exposurePct: 42 + row.rank * 2,
      sectorExposure: { Tech: 18, Finance: 12, UNKNOWN: 8 },
      openRiskVnd: Math.round(PAPER_INITIAL_CAPITAL_VND * 0.008),
      buyingPowerVnd: Math.round(PAPER_INITIAL_CAPITAL_VND * 0.34),
      pnlPct: row.pnlPct,
      winRate: row.winRate,
      maxDrawdownPct: row.maxDrawdownPct,
      navSparkline: spark.length >= 2 ? spark : [base, row.navVnd],
    };
  });

  const positions: PaperLabPageDto["positions"] = [
    {
      id: "pos-1",
      agentId: "swing_trader",
      agentName: agentName("swing_trader"),
      symbol: "FPT",
      entryPriceKVnd: 98.5,
      currentPriceKVnd: 102.3,
      stopLossKVnd: 92.0,
      takeProfitKVnd: 112.0,
      quantity: 3900,
      allocationPct: 10.4,
      riskAmountVnd: 3_295_500,
      unrealizedPnlVnd: 1_926_600,
      unrealizedPnlPct: 3.86,
      rMultiple: 0.58,
      holdingDays: 6,
      status: "OPEN",
    },
    {
      id: "pos-2",
      agentId: "momentum_investor",
      agentName: agentName("momentum_investor"),
      symbol: "VNM",
      entryPriceKVnd: 62.1,
      currentPriceKVnd: 60.8,
      stopLossKVnd: 58.5,
      takeProfitKVnd: 68.0,
      quantity: 8000,
      allocationPct: 9.7,
      riskAmountVnd: 2_880_000,
      unrealizedPnlVnd: -1_040_000,
      unrealizedPnlPct: -2.09,
      rMultiple: -0.36,
      holdingDays: 3,
      status: "OPEN",
    },
    {
      id: "pos-3",
      agentId: "trend_follower",
      agentName: agentName("trend_follower"),
      symbol: "HPG",
      entryPriceKVnd: 27.4,
      currentPriceKVnd: 28.9,
      stopLossKVnd: 25.8,
      takeProfitKVnd: 31.2,
      quantity: 1800,
      allocationPct: 10.4,
      riskAmountVnd: 2_880_000,
      unrealizedPnlVnd: 2_700_000,
      unrealizedPnlPct: 5.47,
      rMultiple: 0.94,
      holdingDays: 11,
      status: "OPEN",
    },
  ];

  const decisions: PaperLabPageDto["decisions"] = [
    {
      id: "dec-1",
      date: SESSION,
      agentId: "swing_trader",
      agentName: agentName("swing_trader"),
      symbol: "FPT",
      action: "BUY",
      confidence: 0.72,
      reasoningSummary: "Thiết lập pullback trên FPT đạt tiêu chuẩn tối thiểu về rủi ro/lợi nhuận — agent đã mở vị thế mua.",
      explanation: mockExplanation(
        "swing_trader",
        "BUY",
        "FPT",
        "Thiết lập pullback trên FPT đạt tiêu chuẩn tối thiểu về rủi ro/lợi nhuận — agent đã mở vị thế mua.",
        ["Chất lượng thiết lập được đánh giá hạng A"],
        []
      ),
      jsonPayload: { action: "BUY", symbol: "FPT", confidence: 0.72 },
      validationStatus: "VALID",
      linkedOrderId: "f619a9ac-78a8-45bc-95db-1d54a79092f5",
      linkedPositionId: "pos-1",
    },
    {
      id: "dec-2",
      date: SESSION,
      agentId: "devils_advocate",
      agentName: agentName("devils_advocate"),
      symbol: "FPT",
      action: "HOLD",
      confidence: 0.55,
      reasoningSummary: "Thiết lập có thể hiệu quả, nhưng rủi ro giảm giá bất cân xứng trên FPT vẫn đáng lo ngại.",
      explanation: mockExplanation(
        "devils_advocate",
        "HOLD",
        "FPT",
        "Thiết lập có thể hiệu quả, nhưng rủi ro giảm giá bất cân xứng trên FPT vẫn đáng lo ngại.",
        [],
        ["Đã vượt xa phía trên vùng pullback"]
      ),
      jsonPayload: { action: "HOLD", symbol: "FPT", confidence: 0.55 },
      validationStatus: "VALID",
      linkedOrderId: null,
      linkedPositionId: null,
    },
    {
      id: "dec-3",
      date: SESSION,
      agentId: "risk_manager",
      agentName: agentName("risk_manager"),
      symbol: "VNM",
      action: "REDUCE",
      confidence: 0.81,
      reasoningSummary: "Tỷ trọng danh mục đang ở mức 68% — cắt giảm phần nắm giữ có động lượng yếu nhất.",
      explanation: mockExplanation(
        "risk_manager",
        "REDUCE",
        "VNM",
        "Giới hạn tỷ trọng danh mục ủng hộ việc giảm tỷ trọng VNM.",
        [],
        ["Tỷ trọng danh mục ở mức cao"]
      ),
      jsonPayload: { action: "REDUCE", symbol: "VNM", confidence: 0.81 },
      validationStatus: "VALID",
      linkedOrderId: "cee952aa-78a8-45bc-95db-1d54a79092f5",
      linkedPositionId: "pos-2",
    },
  ];

  const battleRows: PaperLabPageDto["battleReplay"]["rows"] = [
    {
      agentId: "swing_trader",
      agentName: agentName("swing_trader"),
      style: "Swing",
      action: "BUY",
      confidence: 0.72,
      reasoning: "Thiết lập pullback đạt ngưỡng R:R.",
      explanation: mockExplanation("swing_trader", "BUY", "FPT", "Thiết lập pullback đạt ngưỡng R:R.", ["Chất lượng Gate2 đạt hạng A"], []),
      outcome: "OPEN",
    },
    {
      agentId: "momentum_investor",
      agentName: agentName("momentum_investor"),
      style: "Momentum",
      action: "BUY",
      confidence: 0.68,
      reasoning: "Sức mạnh tương đối dẫn dắt ủng hộ việc vào lệnh.",
      explanation: mockExplanation("momentum_investor", "BUY", "FPT", "Sức mạnh tương đối dẫn dắt ủng hộ việc vào lệnh.", ["RS20 dẫn dắt"], []),
      outcome: "OPEN",
    },
    {
      agentId: "safe_investor",
      agentName: agentName("safe_investor"),
      style: "Defensive",
      action: "HOLD",
      confidence: 0.6,
      reasoning: "Xác nhận xu hướng vẫn còn yếu — agent ưu tiên chờ đợi.",
      explanation: mockExplanation("safe_investor", "HOLD", "FPT", "Xác nhận xu hướng vẫn còn yếu — agent ưu tiên chờ đợi.", [], ["Cần pullback sâu hơn"]),
      outcome: "N/A",
    },
    {
      agentId: "devils_advocate",
      agentName: agentName("devils_advocate"),
      style: "Contrarian",
      action: "HOLD",
      confidence: 0.55,
      reasoning: "Rủi ro đuổi giá tăng cao phía trên vùng pullback.",
      explanation: mockExplanation("devils_advocate", "HOLD", "FPT", "Rủi ro đuổi giá tăng cao phía trên vùng pullback.", [], ["Rủi ro giảm giá bất cân xứng"]),
      outcome: "N/A",
    },
    {
      agentId: "trend_follower",
      agentName: agentName("trend_follower"),
      style: "Trend",
      action: "BUY",
      confidence: 0.7,
      reasoning: "Xu hướng tăng kép trên MA50 xác nhận thiên hướng giao dịch.",
      explanation: mockExplanation("trend_follower", "BUY", "FPT", "Xu hướng tăng kép trên MA50 xác nhận thiên hướng giao dịch.", ["Xu hướng đồng thuận"], []),
      outcome: "OPEN",
    },
  ];

  return {
    overview: {
      totalAgents: PAPER_AGENT_SEEDS.length,
      totalVirtualCapitalVnd: PAPER_INITIAL_CAPITAL_VND * PAPER_AGENT_SEEDS.length,
      bestAgent: { id: best.agentId, name: best.agentName, returnPct: best.pnlPct },
      worstAgent: { id: worst.agentId, name: worst.agentName, returnPct: worst.pnlPct },
      totalOpenPositions: positions.length,
      marketRegime: {
        level: "WARNING",
        label: "Xu hướng tăng yếu · Biến động thu hẹp · Xoay vòng ngành",
        labels: ["Xu hướng tăng yếu", "Biến động thu hẹp", "Xoay vòng ngành"],
        confidence: 85,
        dimensions: {
          trendRegime: "WeakBull",
          volatilityRegime: "Contracting",
          breadthRegime: "Rotation",
          liquidityRegime: "HighLiquidity",
        },
      },
      tradingDecision: {
        level: "PROBE",
        allocation: "20-40%",
        explanation: "Chỉ được phép giải ngân tỷ trọng nhỏ vì điều kiện thị trường đang hỗn hợp.",
        scanSessionDate: SESSION,
        funnel: { universe: 229, tradable: 72, setups: 3 },
      },
      marketPulse: {
        vnindexClose: 1345.2,
        vnindexChangePct: 0.42,
        liquidityLabel: "Thanh khoản cao",
        volatilityLabel: "Biến động thu hẹp",
        breadthLabel: "Xoay vòng ngành",
      },
      latestEvaluationAt: `${SESSION}T14:15:00.000Z`,
      disclaimer: "PAPER_TRADING_ONLY",
      executionMode: {
        agentType: "rule" as const,
        llmEnabled: false,
        label: "Agent theo quy tắc đang hoạt động · LLM tắt",
        provider: null,
      },
    },
    leaderboard,
    portfolios,
    positions,
    decisions,
    cio: {
      sessionDate: SESSION,
      recommendations: [
        {
          symbol: "FPT",
          finalAction: "BUY",
          confidence: 0.68,
          reasoning:
            "Đồng thuận có trọng số: swing_trader và momentum_investor dẫn dắt; 7/9 agent nghiêng tăng với mức bất đồng có thể kiểm soát.",
          risks: ["Dòng vốn khối ngoại âm 3 phiên", "Tỷ trọng ngành Tech chiếm 28%"],
          consensusScore: 0.52,
          consensusLabel: "Mạnh",
          consensusScoreDisplay: "52/100",
          regimeContext: "Xu hướng tăng yếu · Biến động thu hẹp · Xoay vòng ngành",
          decisionSummary: "CIO nhận thấy đủ sự ủng hộ có trọng số để nghiêng về vào lệnh, kèm một số lưu ý.",
          supportingReasons: [
            "Đa số agent ủng hộ vào lệnh theo hướng này trên FPT.",
            "Chất lượng thiết lập và sức mạnh tương đối phù hợp với khung thời gian swing.",
          ],
          actionVotes: { buy: 5, hold: 3, sell: 0, reduce: 1, exit: 0 },
          dissentingAgents: [
            {
              agentId: "devils_advocate",
              agentName: agentName("devils_advocate"),
              action: "HOLD",
              reason: "Đã vượt xa phía trên vùng pullback",
              humanReason: "Cảnh báo rủi ro giảm giá bất cân xứng ngay cả khi thiết lập có vẻ hợp lệ.",
            },
          ],
        },
        {
          symbol: "VNM",
          finalAction: "HOLD",
          confidence: 0.52,
          reasoning: "Hội đồng phân rẽ — động lượng đang suy yếu; risk_manager khuyến nghị giảm tỷ trọng.",
          risks: ["Chênh lệch RS20 đang thu hẹp", "Khối lượng dưới MA20"],
          consensusScore: 0.12,
          consensusLabel: "Yếu",
          consensusScoreDisplay: "12/100",
          regimeContext: "Xu hướng tăng yếu · Biến động thu hẹp · Xoay vòng ngành",
          decisionSummary: "CIO khuyến nghị chờ đợi — đồng thuận giữa các agent còn phân tán và độ tin cậy hạn chế.",
          supportingReasons: [
            "Hầu hết agent không thấy đủ xác nhận cho một giao dịch có độ tin cậy cao.",
          ],
          actionVotes: { buy: 1, hold: 6, sell: 0, reduce: 1, exit: 0 },
          dissentingAgents: [
            {
              agentId: "momentum_investor",
              agentName: agentName("momentum_investor"),
              action: "BUY",
              reason: "Vẫn ở trên cấu trúc MA50",
              humanReason: "Nhận thấy thiết lập hợp lệ và ủng hộ vào lệnh bất chấp thận trọng của CIO.",
            },
          ],
        },
      ],
    },
    recentBattles: [
      {
        id: "mock-battle-fpt",
        sessionDate: SESSION,
        symbol: "FPT",
        status: "RESOLVED",
        agentCount: battleRows.length,
        consensusAction: "BUY",
        consensusConfidence: 0.68,
        voteCounts: { buy: 5, hold: 3, sell: 0, reduce: 1 },
        insight: buildBattleInsight(battleRows, "FPT"),
      },
      {
        id: "mock-battle-vnm",
        sessionDate: SESSION,
        symbol: "VNM",
        status: "OPEN",
        agentCount: 9,
        consensusAction: "HOLD",
        consensusConfidence: 0.52,
        voteCounts: { buy: 1, hold: 6, sell: 0, reduce: 1 },
        insight: "Không agent nào cam kết với VNM; hội đồng ưu tiên chờ xác nhận mạnh hơn.",
      },
    ],
    battleReplay: {
      sessionDate: SESSION,
      symbol: "FPT",
      insight: buildBattleInsight(battleRows, "FPT"),
      rows: battleRows,
    },
  };
}
