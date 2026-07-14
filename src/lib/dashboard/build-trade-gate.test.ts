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
        now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
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

  it("acceptance audit: persisted TRADE + live Gate 1 FAIL — full fail-closed cascade end-to-end", () => {
    const scanNotes = {
      ...baseInput().scanNotes!,
      decision: { level: "NORMAL" as const, allocation: "50-70%", explanation: "Valid setups." },
      closestToValidSymbols: [],
    };
    const surfacedCandidates = [
      {
        id: "c1",
        symbolKey: "FPT",
        quality: "A" as const,
        lifecycleSortLabel: "READY" as const,
        healthLevel: "HEALTHY" as const,
        healthScore: 88,
        healthScoreLabel: "Strong",
        healthFlags: [],
        healthSummary: null,
        reasons: ["Pullback hold"],
        rankSummary: null,
        close: 128,
        pullbackZoneLow: 127,
        pullbackZoneHigh: 129,
        stopLevel: 124,
        rankScore: 90,
      },
    ];

    const dto = buildDecisionCockpitDto(
      baseInput({
        now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
        latestScan: {
          ...baseInput().latestScan!,
          gate1Level: "PASS",
          candidateCountA: 2,
          candidateCountB: 1,
          candidateCountSurfaced: 3,
        },
        scanNotes,
        // Persisted scan says PASS; live VNINDEX regime has since turned FAIL.
        liveRegime: {
          level: "FAIL",
          symbol: "VNINDEX",
          latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1180.0 },
        },
        accountEquityVnd: 2_000_000_000,
        portfolioRiskConfigured: true,
        surfacedCandidates,
      })
    );

    // 1. Headline / verdict no longer TRADE, despite the scan having persisted NORMAL/TRADE.
    expect(dto.verdict.persistedLevel.value).toBe("NORMAL");
    expect(dto.verdict.uxLevel.value).toBe("NO_TRADE");
    expect(dto.verdict.gate1Resolution.canonical).toBe("FAIL");
    expect(dto.verdict.gate1Resolution.liveOverrideApplied).toBe(true);
    expect(dto.verdict.explanation.value).toMatch(/live regime downgraded/i);

    // 2. Confidence band must be low — gate1 FAIL forces it regardless of freshness/session.
    expect(dto.verdict.confidenceBand.value).toBe("low");

    // 3. Recommended allocation / deployable headroom is 0 (equity IS configured here).
    expect(dto.verdict.allocation.value).toBe("0%");
    expect(dto.riskBudgetHeadroom.status).toBe("configured");
    expect(dto.riskBudgetHeadroom.maxBookVnd.value).toBe(0);
    expect(dto.riskBudgetHeadroom.remainingBookVnd.value).toBe(0);

    // 4. Position sizing must NOT recommend a buy — not even a 0-qty object, actually null.
    expect(dto.recommendedPositionSizing).toBeNull();

    // 5. Trade Gate — no row may show "Go", and the market-regime row explains the block.
    const gate = buildTradeGate({
      cockpitDto: dto,
      freshness: alignedFreshness,
      topSetups: [
        {
          id: "c1",
          scanRunId: "scan-1",
          symbolId: "sym-fpt",
          symbol: { symbol: "FPT" },
          symbolKey: "FPT",
          setupType: "BREAKOUT_PULLBACK",
          quality: "A",
          lifecycleSortLabel: "READY",
          healthLevel: "HEALTHY",
          healthScore: 88,
          healthScoreLabel: "Strong",
          healthFlags: [],
          healthLines: [],
          healthSummary: null,
          healthHint: null,
          reasons: ["Pullback hold"],
          close: 128,
          breakoutLevel: 125,
          pullbackZoneLow: 127,
          pullbackZoneHigh: 129,
          stopLevel: 124,
          rankScore: 90,
          barDate: new Date(Date.UTC(2026, 4, 25)),
        },
      ],
      utilizationTone: "normal",
    });
    expect(gate.rows.some((r) => r.action === "Go")).toBe(false);
    const gate1Row = gate.rows.find((r) => r.id === "gate1");
    expect(gate1Row?.status).toBe("blocked");

    // 6. UI-facing copy explicitly names the live override, not just a generic "no trade".
    expect(dto.verdict.gate1Resolution.note).toMatch(/live regime is worse/i);
  });
});

describe("foreignFlowEvidenceState", () => {
  it("warns on negative flow and danger below threshold", () => {
    expect(foreignFlowEvidenceState(-1)).toBe("warn");
    expect(foreignFlowEvidenceState(FOREIGN_FLOW_DANGER_VND - 1)).toBe("danger");
    expect(foreignFlowEvidenceState(100)).toBe("ok");
  });
});
