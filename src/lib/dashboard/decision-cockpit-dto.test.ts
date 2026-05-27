import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  buildRiskBudgetHeadroom,
  computeConfidenceBand,
  mapDecisionLevelToUxVerdict,
  parseMaxBookFractionFromAllocation,
  resolveBestSetupsPanelPresentation,
  resolveCanonicalGate1,
  resolveSetupLadderStage,
  SETUP_LADDER_STAGE_ORDER,
  type DecisionCockpitInput,
} from "./decision-cockpit-dto";

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
      id: "cmpku2jyq000004l42cv873wq",
      runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
      gate1Level: "PASS",
      candidateCountA: 0,
      candidateCountB: 0,
      candidateCountSurfaced: 0,
      universeScannedCount: 412,
    },
    scanNotes: {
      gate2QualityCounts: { A: 0, B: 0, INVALID: 120 },
      invalidCountByCategory: {},
      topRejectionCategories: {
        pullback_zone_interaction: 42,
        extension_cap: 18,
      },
      rejectionSymbolsByCategory: {
        pullback_zone_interaction: ["HPG", "FPT", "VNM"],
        extension_cap: ["SSI", "VCB"],
      },
      topRejectionTerminalReasons: {},
      closestToValidSymbols: [
        {
          symbol: "HPG",
          partialPipelineScore: 0.82,
          stageRank: 58,
          reasonLineCount: 2,
          terminalCategory: "pullback_zone_interaction",
          terminalReasonPreview: "Current bar does not interact with the pullback box.",
          rankScore: 71.2,
          close: 28.5,
          breakoutLevel: 27.1,
          pullbackZoneLow: 27.8,
          pullbackZoneHigh: 28.2,
          stopLevel: 26.9,
        },
      ],
      recommendation: {
        likelyBottleneck: "pullback_zone_interaction",
        summary: "Largest bucket pullback_zone_interaction",
        note: "Use closest rows.",
      },
    },
    liveRegime: {
      level: "WARNING",
      symbol: "VNINDEX",
      latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1245.5 },
    },
    freshness: alignedFreshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
    ...overrides,
  };
}

describe("resolveCanonicalGate1 (DC-1)", () => {
  it("prefers scan-run Gate 1 when scan exists", () => {
    const r = resolveCanonicalGate1({ scanGate1: "PASS", liveRegimeGate1: "WARNING" });
    expect(r.canonical).toBe("PASS");
    expect(r.source).toBe("scan_run");
    expect(r.mismatch).toBe(true);
  });

  it("falls back to live regime when no scan", () => {
    const r = resolveCanonicalGate1({ scanGate1: null, liveRegimeGate1: "WARNING" });
    expect(r.canonical).toBe("WARNING");
    expect(r.source).toBe("live_regime");
    expect(r.mismatch).toBe(false);
  });
});

describe("mapDecisionLevelToUxVerdict", () => {
  it("maps NORMAL to TRADE without confidence percent", () => {
    expect(mapDecisionLevelToUxVerdict("NORMAL")).toBe("TRADE");
  });
});

describe("buildDecisionCockpitDto — production-like zero surfaced", () => {
  it("uses scan Gate 1 for verdict (not live WARNING)", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.verdict.persistedLevel.value).toBe("NO_TRADE");
    expect(dto.verdict.uxLevel.value).toBe("NO_TRADE");
    expect(dto.verdict.gate1Resolution.canonical).toBe("PASS");
    expect(dto.verdict.gate1Resolution.mismatch).toBe(true);
  });

  it("surfaces near-miss opportunity board when zero candidates", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.opportunity.mode).toBe("near_miss");
    expect(dto.opportunity.nearMiss[0]?.symbol).toBe("HPG");
    expect(dto.opportunity.nearMiss[0]?.waitFor).toContain("pullback");
  });

  it("does not expose confidence percent — only band", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(["high", "medium", "low"]).toContain(dto.verdict.confidenceBand.value);
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toMatch(/confidencePercent|breadthPercent|NEUTRAL/i);
  });

  it("limits actionable blockers to three", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        scanNotes: {
          ...baseInput().scanNotes!,
          topRejectionCategories: {
            a: 10,
            b: 9,
            c: 8,
            d: 7,
            e: 6,
          },
          rejectionSymbolsByCategory: {},
          closestToValidSymbols: [],
          gate2QualityCounts: { A: 0, B: 0, INVALID: 5 },
          invalidCountByCategory: {},
          topRejectionTerminalReasons: {},
          recommendation: {
            likelyBottleneck: "none_obvious",
            summary: "",
            note: "",
          },
        },
      })
    );
    expect(dto.blockers.length).toBeLessThanOrEqual(3);
  });

  it("includes real rejection counts and sample symbols on blockers", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const pullback = dto.blockers.find((b) => b.title.includes("pullback"));
    expect(pullback?.count).toBe(42);
    expect(pullback?.sampleSymbols).toEqual(["HPG", "FPT", "VNM"]);
    expect(pullback?.provenance).toBe("real");
  });
});

describe("buildDecisionCockpitDto — TRADE day", () => {
  it("maps NORMAL to TRADE and lists tier_a ladder", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          candidateCountA: 2,
          candidateCountB: 1,
          candidateCountSurfaced: 3,
        },
        liveRegime: { level: "PASS", symbol: "VNINDEX", latestBar: null },
        surfacedCandidates: [
          {
            id: "cand-hpg",
            symbolKey: "HPG",
            quality: "A",
            lifecycleSortLabel: "READY",
            healthLevel: "HEALTHY",
            healthScore: 82,
            healthScoreLabel: "Strong",
            healthFlags: [],
            healthSummary: null,
            reasons: ["Tier A liquidity checks passed."],
            close: 28,
            pullbackZoneLow: 27.5,
            pullbackZoneHigh: 28.2,
            stopLevel: 26.8,
            rankScore: 88,
          },
        ],
      })
    );
    expect(dto.verdict.uxLevel.value).toBe("TRADE");
    expect(dto.verdict.persistedLevel.value).toBe("NORMAL");
    expect(dto.opportunity.mode).toBe("candidates");
    expect(dto.opportunity.candidates[0]?.ladderStage).toBe("tier_a");
    expect(dto.opportunity.candidates[0]?.actionHint).toContain("setupCandidateId=cand-hpg");
  });
});

describe("resolveSetupLadderStage", () => {
  it("downgrades extended flags to extended stage", () => {
    expect(
      resolveSetupLadderStage({
        id: "x",
        symbolKey: "SSI",
        quality: "A",
        lifecycleSortLabel: "READY",
        healthLevel: "HEALTHY",
        healthScore: 70,
        healthScoreLabel: "Decent",
        healthFlags: ["CHASE"],
        healthSummary: null,
        reasons: [],
        close: 1,
        pullbackZoneLow: 0.9,
        pullbackZoneHigh: 1.1,
        stopLevel: 0.8,
        rankScore: 1,
      })
    ).toBe("extended");
  });
});

describe("buildDecisionCockpitDto — tomorrow plan", () => {
  it("zero surfaced + near-miss: watch symbols from closestToValidSymbols", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.tomorrow.watchSymbols.value).toContain("HPG");
    expect(dto.tomorrow.watchNote.value).toBeNull();
    expect(dto.tomorrow.triggerLine.value).toContain("HPG");
  });

  it("zero surfaced + no near-miss: honest watch note", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        scanNotes: {
          ...baseInput().scanNotes!,
          closestToValidSymbols: [],
          topRejectionCategories: { extension_cap: 5 },
          rejectionSymbolsByCategory: { extension_cap: ["SSI"] },
          recommendation: {
            likelyBottleneck: "extension_cap",
            summary: "",
            note: "",
          },
        },
      })
    );
    expect(dto.opportunity.mode).toBe("empty");
    expect(dto.tomorrow.watchSymbols.value).toHaveLength(0);
    expect(dto.tomorrow.watchNote.value).toContain("No near-miss symbols");
    expect(dto.tomorrow.watchNote.value).toContain("/setups");
  });

  it("candidate day: watch includes surfaced symbol", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
        },
        surfacedCandidates: [
          {
            id: "c1",
            symbolKey: "MWG",
            quality: "A",
            lifecycleSortLabel: "READY",
            healthLevel: "HEALTHY",
            healthScore: 80,
            healthScoreLabel: "Strong",
            healthFlags: [],
            healthSummary: null,
            reasons: [],
            close: 10,
            pullbackZoneLow: 9.5,
            pullbackZoneHigh: 10.2,
            stopLevel: 9,
            rankScore: 1,
          },
        ],
      })
    );
    expect(dto.tomorrow.watchSymbols.value).toContain("MWG");
    expect(dto.tomorrow.triggerLine.value).toContain("MWG");
    expect(dto.tomorrow.postureLine.value).toContain("TRADE");
  });
});

describe("buildDecisionCockpitDto — actionable diagnostics", () => {
  it("exposes actionableDiagnostics aligned with blockers (max 3)", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.actionableDiagnostics.maxShown).toBe(3);
    expect(dto.actionableDiagnostics.blockers).toEqual(dto.blockers);
    expect(dto.actionableDiagnostics.blockers.length).toBeLessThanOrEqual(3);
    expect(dto.actionableDiagnostics.blockers[0]?.meaning.length).toBeGreaterThan(0);
  });

  it("uses only real sample symbols from scan notes", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const pullback = dto.actionableDiagnostics.blockers.find((b) =>
      b.title.toLowerCase().includes("pullback")
    );
    expect(pullback?.sampleSymbols).toEqual(["HPG", "FPT", "VNM"]);
    expect(pullback?.sampleSymbols).not.toContain("FAKE");
  });
});

describe("buildDecisionCockpitDto — setup quality ladder (S5)", () => {
  it("candidate day: groups tier_a with real symbols and zero other stages", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        scanNotes: {
          ...baseInput().scanNotes!,
          closestToValidSymbols: [],
        },
        latestScan: {
          ...baseInput().latestScan!,
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
        },
        surfacedCandidates: [
          {
            id: "c1",
            symbolKey: "MWG",
            quality: "A",
            lifecycleSortLabel: "READY",
            healthLevel: "HEALTHY",
            healthScore: 80,
            healthScoreLabel: "Strong",
            healthFlags: [],
            healthSummary: null,
            reasons: [],
            close: 10,
            pullbackZoneLow: 9.5,
            pullbackZoneHigh: 10.2,
            stopLevel: 9,
            rankScore: 1,
          },
        ],
      })
    );
    expect(dto.setupQualityLadder.totalClassified).toBe(1);
    const tierA = dto.setupQualityLadder.stages.find((s) => s.stage === "tier_a");
    expect(tierA?.count).toBe(1);
    expect(tierA?.sampleSymbols).toEqual(["MWG"]);
    expect(dto.setupQualityLadder.stages.find((s) => s.stage === "watch")?.count).toBe(0);
    expect(SETUP_LADDER_STAGE_ORDER).toHaveLength(6);
  });

  it("zero surfaced + near-miss: watch stage has HPG, no fabricated symbols", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const watch = dto.setupQualityLadder.stages.find((s) => s.stage === "watch");
    expect(watch?.count).toBe(1);
    expect(watch?.sampleSymbols).toEqual(["HPG"]);
    expect(watch?.sampleSymbols).not.toContain("FAKE");
    expect(dto.setupQualityLadder.stages.find((s) => s.stage === "tier_a")?.count).toBe(0);
    for (const group of dto.setupQualityLadder.stages) {
      for (const sym of group.sampleSymbols) {
        expect(sym).toMatch(/^[A-Z0-9]+$/);
      }
    }
  });

  it("zero surfaced + no near-miss: all stages show count 0", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        scanNotes: {
          ...baseInput().scanNotes!,
          closestToValidSymbols: [],
        },
      })
    );
    expect(dto.setupQualityLadder.totalClassified).toBe(0);
    expect(dto.setupQualityLadder.stages.every((s) => s.count === 0)).toBe(true);
    expect(dto.setupQualityLadder.stages.every((s) => s.sampleSymbols.length === 0)).toBe(true);
  });
});

describe("resolveBestSetupsPanelPresentation (S5 dedup)", () => {
  it("uses full table when setup rows exist", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const p = resolveBestSetupsPanelPresentation({
      setupRowCount: 2,
      opportunity: dto.opportunity,
      latestScan: baseInput().latestScan!,
    });
    expect(p.mode).toBe("full_table");
  });

  it("compact empty references opportunity when near_miss and zero rows", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const p = resolveBestSetupsPanelPresentation({
      setupRowCount: 0,
      opportunity: dto.opportunity,
      latestScan: baseInput().latestScan!,
    });
    expect(p.mode).toBe("compact_empty");
    expect(p.emptyTitle).toMatch(/No validated breakout-pullback/i);
    expect(p.emptyReason).toMatch(/Coverage is fresh|Gate2/i);
    expect(p.emptyReason).toMatch(/Near miss/i);
  });
});

describe("buildRiskBudgetHeadroom (DC-5)", () => {
  it("configured path: equity from config, derived max book and remaining headroom", () => {
    const h = buildRiskBudgetHeadroom({
      accountEquityVnd: 100_000_000,
      openExposureVnd: 30_000_000,
      maxBookAllocation: "50-70%",
      perTradeGuidance: "10–20% of equity",
    });
    expect(h.status).toBe("configured");
    expect(h.equityVnd.provenance).toBe("config");
    expect(h.equityVnd.value).toBe(100_000_000);
    expect(h.maxBookPercent.value).toBe(0.7);
    expect(h.maxBookVnd.value).toBe(70_000_000);
    expect(h.remainingBookVnd.value).toBe(40_000_000);
    expect(h.isOverMaxBook).toBe(false);
    expect(h.openExposureVnd.provenance).toBe("derived");
  });

  it("unavailable when equity missing", () => {
    const h = buildRiskBudgetHeadroom({
      accountEquityVnd: null,
      openExposureVnd: 5_000_000,
      maxBookAllocation: "50%",
      perTradeGuidance: "None",
    });
    expect(h.status).toBe("unavailable");
    expect(h.equityVnd.provenance).toBe("gap");
    expect(h.maxBookVnd.value).toBeNull();
    expect(h.statusCopy).toMatch(/not configured/i);
  });

  it("flags over max book when open exposure exceeds parsed cap", () => {
    const h = buildRiskBudgetHeadroom({
      accountEquityVnd: 100_000_000,
      openExposureVnd: 60_000_000,
      maxBookAllocation: "50%",
      perTradeGuidance: "10–20% of equity",
    });
    expect(h.status).toBe("configured");
    expect(h.maxBookVnd.value).toBe(50_000_000);
    expect(h.remainingBookVnd.value).toBe(-10_000_000);
    expect(h.isOverMaxBook).toBe(true);
  });

  it("partial when allocation cannot be parsed", () => {
    const h = buildRiskBudgetHeadroom({
      accountEquityVnd: 50_000_000,
      openExposureVnd: 0,
      maxBookAllocation: "TBD",
      perTradeGuidance: "None",
    });
    expect(h.status).toBe("partial");
    expect(h.equityVnd.provenance).toBe("config");
    expect(h.maxBookVnd.value).toBeNull();
  });

  it("does not expose R-multiple or stop-based risk fields", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        accountEquityVnd: 100_000_000,
        openExposureVnd: 10_000_000,
        portfolioRiskConfigured: true,
        scanNotes: {
          ...baseInput().scanNotes!,
          decision: {
            level: "NORMAL",
            allocation: "50%",
            explanation: "Test day.",
          },
        },
        latestScan: {
          ...baseInput().latestScan!,
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
        },
      })
    );
    const serialized = JSON.stringify(dto.riskBudgetHeadroom);
    expect(serialized).not.toMatch(/riskAtStop|rMultiple|riskBudgetVnd|perShareRisk/i);
    expect(dto.riskBudgetHeadroom.status).toBe("configured");
  });
});

describe("parseMaxBookFractionFromAllocation", () => {
  it("parses range upper bound", () => {
    expect(parseMaxBookFractionFromAllocation("20-40%")).toBe(0.4);
  });
});

describe("computeConfidenceBand", () => {
  it("returns low when benchmark missing", () => {
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: null,
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestScanRunAt: null,
      },
    });
    expect(
      computeConfidenceBand({
        hasScan: false,
        freshness: fresh,
        gate1: "PASS",
        surfacedCount: 0,
        now: new Date(),
        scanRunAt: null,
      })
    ).toBe("low");
  });
});
