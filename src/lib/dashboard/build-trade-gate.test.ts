import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "./decision-cockpit-dto";
import { buildTradeGate } from "./build-trade-gate";
import { foreignFlowEvidenceState, FOREIGN_FLOW_DANGER_VND } from "./foreign-flow-evidence";

const alignedFreshness = buildMarketFreshnessDto({
  snapshot: {
    benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
  },
});

function baseInput(overrides: Partial<DecisionCockpitInput> = {}): DecisionCockpitInput {
  return {
    latestScan: {
      id: "scan-1",
      runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
      gate1Level: "PASS",
      candidateCountA: 0,
      candidateCountB: 0,
      candidateCountSurfaced: 0,
      universeScannedCount: 400,
    },
    scanNotes: {
      gate2QualityCounts: { A: 0, B: 0, INVALID: 10 },
      invalidCountByCategory: {},
      topRejectionCategories: { extension_cap: 5 },
      rejectionSymbolsByCategory: { extension_cap: ["MWG"] },
      topRejectionTerminalReasons: {},
      closestToValidSymbols: [],
      recommendation: {
        likelyBottleneck: "extension_cap",
        summary: "",
        note: "",
      },
    },
    liveRegime: {
      level: "PASS",
      symbol: "VNINDEX",
      latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1286.42 },
    },
    freshness: alignedFreshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    ...overrides,
  };
}

describe("buildTradeGate — NO_TRADE", () => {
  it("never surfaces Go on any row", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const gate = buildTradeGate({
      cockpitDto: dto,
      freshness: alignedFreshness,
      topSetups: [],
      utilizationTone: "normal",
    });
    expect(gate.rows.some((r) => r.action === "Go")).toBe(false);
    expect(gate.subtitle).toMatch(/Entry closed/i);
  });

  it("shows configure equity when budget unavailable", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const gate = buildTradeGate({
      cockpitDto: dto,
      freshness: alignedFreshness,
      topSetups: [],
      utilizationTone: "normal",
    });
    const budgetRows = gate.rows.filter((r) => r.id === "budget");
    expect(budgetRows).toHaveLength(1);
    expect(budgetRows[0]?.statusLabel).toBe("Setup needed");
    expect(budgetRows[0]?.action).toBe("Configure equity");
    expect(gate.rows.filter((r) => /risk budget headroom/i.test(r.rule))).toHaveLength(0);
  });
});

describe("buildTradeGate — TRADE", () => {
  it("shows Go only on qualified setups surfaced, not daily stance", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          candidateCountA: 2,
          candidateCountB: 1,
          candidateCountSurfaced: 3,
        },
        scanNotes: {
          ...baseInput().scanNotes!,
          decision: { level: "NORMAL", allocation: "50-70%", explanation: "Valid setups." },
          closestToValidSymbols: [],
        },
        accountEquityVnd: 2_000_000_000,
        surfacedCandidates: [
          {
            id: "c1",
            symbolKey: "FPT",
            quality: "A",
            lifecycleSortLabel: "READY",
            healthLevel: "HEALTHY",
            healthScore: 88,
            healthScoreLabel: "Strong",
            healthFlags: [],
            healthSummary: null,
            reasons: ["Pullback hold"],
            close: 128,
            pullbackZoneLow: 127,
            pullbackZoneHigh: 129,
            stopLevel: 124,
            rankScore: 90,
          },
        ],
      })
    );
    const gate = buildTradeGate({
      cockpitDto: dto,
      freshness: alignedFreshness,
      topSetups: [
        {
          id: "c1",
          symbolKey: "FPT",
          quality: "A",
          lifecycleSortLabel: "READY",
          healthLevel: "HEALTHY",
          healthScore: 88,
          healthScoreLabel: "Strong",
          healthFlags: [],
          healthSummary: null,
          reasons: ["Pullback hold"],
          close: 128,
          pullbackZoneLow: 127,
          pullbackZoneHigh: 129,
          stopLevel: 124,
          rankScore: 90,
        },
      ],
      utilizationTone: "normal",
    });
    const stance = gate.rows.find((r) => r.id === "stance");
    const surfaced = gate.rows.find((r) => r.id === "surfaced");
    expect(stance?.action).toBe("Watch");
    expect(surfaced?.action).toBe("Go");
    expect(gate.rows.filter((r) => r.action === "Go")).toHaveLength(1);
  });
});

describe("foreignFlowEvidenceState", () => {
  it("warns on negative flow and danger below threshold", () => {
    expect(foreignFlowEvidenceState(-1)).toBe("warn");
    expect(foreignFlowEvidenceState(FOREIGN_FLOW_DANGER_VND - 1)).toBe("danger");
    expect(foreignFlowEvidenceState(100)).toBe("ok");
  });
});
