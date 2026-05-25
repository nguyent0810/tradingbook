import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  computeConfidenceBand,
  mapDecisionLevelToUxVerdict,
  resolveCanonicalGate1,
  resolveSetupLadderStage,
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
