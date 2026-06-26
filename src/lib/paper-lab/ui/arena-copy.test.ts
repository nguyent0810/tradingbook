import { describe, expect, it } from "vitest";
import {
  buildAgentReasoningSummary,
  buildCioPresentation,
  buildDecisionExplanation,
} from "./arena-copy";
import {
  consensusLabel,
  formatBoardLotQty,
  formatShortRef,
  formatOrderRef,
} from "./arena-format";

describe("arena-format", () => {
  it("formats board lot qty", () => {
    expect(formatBoardLotQty(3900)).toEqual({
      sharesLabel: "3,900",
      lots: 39,
      display: "3,900 (39 lots)",
      isRounded: false,
    });
  });

  it("flags non-lot-rounded qty", () => {
    expect(formatBoardLotQty(3950).isRounded).toBe(true);
  });

  it("shortens UUID refs", () => {
    const id = "cee952aa-78a8-45bc-95db-1d54a79092f5";
    expect(formatShortRef(id)).toBe("cee952…a79092f5");
    expect(formatOrderRef(id)).toBe("ORD-092F5");
  });
});

describe("arena-copy", () => {
  it("builds human-readable decision for aggressive investor BUY", () => {
    const exp = buildDecisionExplanation({
      agentId: "aggressive_investor",
      action: "BUY",
      symbol: "CSM",
      payload: {
        supporting_signals: ["gate2_quality_A"],
        opposing_signals: ["weak_regime"],
        market_regime_assumption: "WARNING",
      },
    });
    expect(exp.summary).toContain("CSM");
    expect(exp.supporting.length).toBeGreaterThan(0);
    expect(exp.opposing.length).toBeGreaterThan(0);
    expect(exp.styleLens).toContain("weaker regime");
  });

  it("builds momentum HOLD reason", () => {
    const exp = buildDecisionExplanation({
      agentId: "momentum_investor",
      action: "HOLD",
      symbol: "CSM",
      payload: {
        supporting_signals: [],
        opposing_signals: ["weak_regime"],
        market_regime_assumption: "WARNING",
      },
    });
    expect(exp.summary.toLowerCase()).toMatch(/volume|momentum|insufficient/);
  });

  it("buildAgentReasoningSummary returns single line", () => {
    const s = buildAgentReasoningSummary({
      agentId: "swing_trader",
      action: "BUY",
      symbol: "FPT",
      payload: {
        supporting_signals: ["gate2_quality_A"],
        opposing_signals: [],
        market_regime_assumption: "PASS",
      },
    });
    expect(s.length).toBeGreaterThan(20);
    expect(s).not.toContain("rule evaluation on");
  });

  it("buildCioPresentation humanizes dissent", () => {
    const pres = buildCioPresentation({
      recommendation_id: "00000000-0000-0000-0000-000000000001",
      session_date: "2026-06-25",
      symbol: "CSM",
      final_action: "HOLD",
      confidence: 0.48,
      consensus_score: 0.18,
      entry_price: null,
      stop_loss: null,
      take_profit: null,
      suggested_position_size_vnd: null,
      reasoning: "CIO v2 weighted consensus 0.18 from 9 agents under WeakBull.",
      supporting_agents: [],
      dissenting_agents: [
        {
          agent_id: "aggressive_investor",
          action: "BUY",
          reason: "aggressive_investor rule evaluation on CSM: regime WARNING, gate2 A.",
        },
      ],
      risks: ["Agent disagreement on direction"],
      agent_weights_used: {},
      metadata: { cio_version: "2.0.0", regime: "WARNING" },
      regime_context: "Weak Bull · Contracting · Rotation",
    });
    expect(pres.consensusLabel).toBe("Weak");
    expect(pres.consensusScoreDisplay).toBe("18/100");
    expect(pres.decisionSummary).not.toContain("weighted consensus 0.18");
    expect(pres.dissent[0]?.humanReason).toContain("weaker regime");
  });
});

describe("consensusLabel", () => {
  it("maps score bands", () => {
    expect(consensusLabel(0.18)).toBe("Weak");
    expect(consensusLabel(0.4)).toBe("Medium");
    expect(consensusLabel(0.6)).toBe("Strong");
  });
});
