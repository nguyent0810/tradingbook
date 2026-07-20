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
      reasoningSummary: "Pullback setup on FPT passed minimum risk/reward rules — agent opened a long position.",
      explanation: mockExplanation(
        "swing_trader",
        "BUY",
        "FPT",
        "Pullback setup on FPT passed minimum risk/reward rules — agent opened a long position.",
        ["Setup quality rated A"],
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
      reasoningSummary: "Setup may work, but downside asymmetry on FPT is still concerning.",
      explanation: mockExplanation(
        "devils_advocate",
        "HOLD",
        "FPT",
        "Setup may work, but downside asymmetry on FPT is still concerning.",
        [],
        ["Extended above pullback zone"]
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
      reasoningSummary: "Portfolio exposure at 68% — trim weakest momentum sleeve.",
      explanation: mockExplanation(
        "risk_manager",
        "REDUCE",
        "VNM",
        "Portfolio exposure limits favor reducing VNM exposure.",
        [],
        ["High portfolio exposure"]
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
      reasoning: "Pullback setup passed R:R threshold.",
      explanation: mockExplanation("swing_trader", "BUY", "FPT", "Pullback setup passed R:R threshold.", ["Gate2 A quality"], []),
      outcome: "OPEN",
    },
    {
      agentId: "momentum_investor",
      agentName: agentName("momentum_investor"),
      style: "Momentum",
      action: "BUY",
      confidence: 0.68,
      reasoning: "Relative strength leadership supports entry.",
      explanation: mockExplanation("momentum_investor", "BUY", "FPT", "Relative strength leadership supports entry.", ["RS20 leadership"], []),
      outcome: "OPEN",
    },
    {
      agentId: "safe_investor",
      agentName: agentName("safe_investor"),
      style: "Defensive",
      action: "HOLD",
      confidence: 0.6,
      reasoning: "Trend confirmation is still weak — agent prefers to wait.",
      explanation: mockExplanation("safe_investor", "HOLD", "FPT", "Trend confirmation is still weak — agent prefers to wait.", [], ["Needs deeper pullback"]),
      outcome: "N/A",
    },
    {
      agentId: "devils_advocate",
      agentName: agentName("devils_advocate"),
      style: "Contrarian",
      action: "HOLD",
      confidence: 0.55,
      reasoning: "Chase risk elevated above pullback zone.",
      explanation: mockExplanation("devils_advocate", "HOLD", "FPT", "Chase risk elevated above pullback zone.", [], ["Asymmetric downside"]),
      outcome: "N/A",
    },
    {
      agentId: "trend_follower",
      agentName: agentName("trend_follower"),
      style: "Trend",
      action: "BUY",
      confidence: 0.7,
      reasoning: "Dual MA50 uptrend confirms directional bias.",
      explanation: mockExplanation("trend_follower", "BUY", "FPT", "Dual MA50 uptrend confirms directional bias.", ["Trend aligned"], []),
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
        label: "WeakBull · Contracting · Rotation",
        labels: ["WeakBull", "Contracting", "Rotation"],
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
        explanation: "Only small exposure is allowed because market conditions are mixed.",
        scanSessionDate: SESSION,
        funnel: { universe: 229, tradable: 72, setups: 3 },
      },
      marketPulse: {
        vnindexClose: 1345.2,
        vnindexChangePct: 0.42,
        liquidityLabel: "High liquidity",
        volatilityLabel: "Contracting volatility",
        breadthLabel: "Sector rotation",
      },
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
          consensusScore: 0.52,
          consensusLabel: "Strong",
          consensusScoreDisplay: "52/100",
          regimeContext: "Weak Bull · Contracting · Rotation",
          decisionSummary: "CIO sees enough weighted support to favor entry, with caveats.",
          supportingReasons: [
            "Majority of agents support directional entry on FPT.",
            "Setup quality and relative strength align for swing timeframe.",
          ],
          actionVotes: { buy: 5, hold: 3, sell: 0, reduce: 1, exit: 0 },
          dissentingAgents: [
            {
              agentId: "devils_advocate",
              agentName: agentName("devils_advocate"),
              action: "HOLD",
              reason: "Extended above pullback zone",
              humanReason: "Flags downside asymmetry even when setup looks valid.",
            },
          ],
        },
        {
          symbol: "VNM",
          finalAction: "HOLD",
          confidence: 0.52,
          reasoning: "Split panel — momentum fading; risk_manager recommends reduce.",
          risks: ["RS20 spread narrowing", "Volume below MA20"],
          consensusScore: 0.12,
          consensusLabel: "Weak",
          consensusScoreDisplay: "12/100",
          regimeContext: "Weak Bull · Contracting · Rotation",
          decisionSummary: "CIO recommends waiting — agent consensus is mixed and conviction is limited.",
          supportingReasons: [
            "Most agents do not see enough confirmation for a high-conviction trade.",
          ],
          actionVotes: { buy: 1, hold: 6, sell: 0, reduce: 1, exit: 0 },
          dissentingAgents: [
            {
              agentId: "momentum_investor",
              agentName: agentName("momentum_investor"),
              action: "BUY",
              reason: "Still above MA50 structure",
              humanReason: "Sees valid setup and favors entry despite CIO caution.",
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
        insight: "No agents committed to VNM; the panel prefers to wait for stronger confirmation.",
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
