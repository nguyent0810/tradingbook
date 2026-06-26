import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";

const SESSION = "2026-06-26";

function agentName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug;
}

function agentStyle(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.style ?? "Unknown";
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

  const portfolios = leaderboard.map((row) => ({
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
  }));

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
      quantity: 507,
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
      quantity: 800,
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
      reasoningSummary: "Gate2 A breakout-pullback with RS20 leadership and PASS regime.",
      jsonPreview: '{"action":"BUY","symbol":"FPT","confidence":0.72}',
      validationStatus: "VALID",
      linkedOrderId: "ord-1",
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
      reasoningSummary: "Extended 8% above pullback zone — chase risk elevated.",
      jsonPreview: '{"action":"HOLD","symbol":"FPT","confidence":0.55}',
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
      reasoningSummary: "Portfolio exposure at 68% — trim weakest momentum sleeve.",
      jsonPreview: '{"action":"REDUCE","symbol":"VNM","confidence":0.81}',
      validationStatus: "VALID",
      linkedOrderId: "ord-2",
      linkedPositionId: "pos-2",
    },
  ];

  return {
    overview: {
      totalAgents: PAPER_AGENT_SEEDS.length,
      totalVirtualCapitalVnd: PAPER_INITIAL_CAPITAL_VND * PAPER_AGENT_SEEDS.length,
      bestAgent: { id: best.agentId, name: best.agentName, returnPct: best.pnlPct },
      worstAgent: { id: worst.agentId, name: worst.agentName, returnPct: worst.pnlPct },
      totalOpenPositions: positions.length,
      marketRegime: { level: "PASS", label: "Gate 1 PASS — normal allocation band" },
      latestEvaluationAt: `${SESSION}T14:15:00.000Z`,
      disclaimer: "PAPER_TRADING_ONLY",
      executionMode: {
        agentType: "rule" as const,
        llmEnabled: false,
        label: "Rule Agents Active · LLM Disabled",
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
            "Weighted consensus: swing_trader and momentum_investor lead; 7/9 agents bullish with manageable dissent.",
          risks: ["Foreign flow negative 3d", "Sector exposure 28% in Tech"],
          dissentingAgents: [
            { agentId: "devils_advocate", reason: "Extended above pullback zone" },
          ],
        },
        {
          symbol: "VNM",
          finalAction: "HOLD",
          confidence: 0.52,
          reasoning: "Split panel — momentum fading; risk_manager recommends reduce.",
          risks: ["RS20 spread narrowing", "Volume below MA20"],
          dissentingAgents: [
            { agentId: "momentum_investor", reason: "Still above MA50 structure" },
          ],
        },
      ],
    },
    battleReplay: {
      sessionDate: SESSION,
      symbol: "FPT",
      rows: [
        { agentId: "swing_trader", agentName: agentName("swing_trader"), action: "BUY", confidence: 0.72, reasoning: "Gate2 A setup", outcome: "OPEN" },
        { agentId: "momentum_investor", agentName: agentName("momentum_investor"), action: "BUY", confidence: 0.68, reasoning: "RS leadership", outcome: "OPEN" },
        { agentId: "safe_investor", agentName: agentName("safe_investor"), action: "HOLD", confidence: 0.6, reasoning: "Wait for deeper pullback", outcome: "N/A" },
        { agentId: "devils_advocate", agentName: agentName("devils_advocate"), action: "HOLD", confidence: 0.55, reasoning: "Chase risk", outcome: "N/A" },
        { agentId: "trend_follower", agentName: agentName("trend_follower"), action: "BUY", confidence: 0.7, reasoning: "Dual MA50 uptrend", outcome: "OPEN" },
      ],
    },
  };
}
