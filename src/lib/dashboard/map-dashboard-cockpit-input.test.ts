import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { buildDashboardCockpitInput } from "./map-dashboard-cockpit-input";
import { buildDecisionCockpitDto } from "./decision-cockpit-dto";

describe("buildDashboardCockpitInput", () => {
  it("maps scan gate1 for DTO canonical resolution (DC-1)", () => {
    const input = buildDashboardCockpitInput({
      latestScan: {
        id: "scan-1",
        runAt: new Date(Date.UTC(2026, 4, 25)),
        gate1Level: "PASS",
        candidateCountA: 0,
        candidateCountB: 0,
        candidateCountSurfaced: 0,
        notes: null,
        candidates: [],
      } as Parameters<typeof buildDashboardCockpitInput>[0]["latestScan"],
      scanNotes: {
        topRejectionCategories: {},
        closestToValidSymbols: [],
        recommendation: {
          likelyBottleneck: "none_obvious",
          summary: "",
          note: "",
        },
      },
      regime: {
        level: "WARNING",
        symbol: "VNINDEX",
        latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 100 },
        storedBarsCount: 60,
        evaluatedBarsCount: 60,
        checkedAt: new Date(),
      },
      freshness: buildMarketFreshnessDto({
        snapshot: {
          benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
          latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
          latestScanRunAt: new Date(Date.UTC(2026, 4, 25)),
        },
      }),
      candidatesWithHealth: [],
      activeWatchItems: [],
      openExposureVnd: 1_000_000,
      portfolioRiskConfigured: false,
    });

    expect(input.latestScan?.gate1Level).toBe("PASS");
    expect(input.liveRegime.level).toBe("WARNING");

    const dto = buildDecisionCockpitDto(input);
    expect(dto.verdict.gate1Resolution.canonical).toBe("PASS");
    expect(dto.verdict.gate1Resolution.mismatch).toBe(true);
    expect(dto.evidence.some((c) => c.id === "gate1_live")).toBe(true);
  });

  it("passes through near-miss from scan notes into opportunity board", () => {
    const input = buildDashboardCockpitInput({
      latestScan: {
        id: "scan-1",
        runAt: new Date(),
        gate1Level: "PASS",
        candidateCountA: 0,
        candidateCountB: 0,
        candidateCountSurfaced: 0,
        notes: null,
        candidates: [],
      } as Parameters<typeof buildDashboardCockpitInput>[0]["latestScan"],
      scanNotes: {
        topRejectionCategories: { pullback_zone_interaction: 3 },
        rejectionSymbolsByCategory: { pullback_zone_interaction: ["HPG"] },
        closestToValidSymbols: [
          {
            symbol: "HPG",
            partialPipelineScore: 1,
            stageRank: 50,
            reasonLineCount: 1,
            terminalCategory: "pullback_zone_interaction",
            terminalReasonPreview: "zone",
            rankScore: 1,
            close: 10,
            breakoutLevel: 9,
            pullbackZoneLow: 9.5,
            pullbackZoneHigh: 10.5,
            stopLevel: 8,
          },
        ],
        recommendation: {
          likelyBottleneck: "pullback_zone_interaction",
          summary: "",
          note: "",
        },
      },
      regime: {
        level: "PASS",
        symbol: "VNINDEX",
        latestBar: null,
        storedBarsCount: 0,
        evaluatedBarsCount: 0,
        checkedAt: new Date(),
      },
      freshness: buildMarketFreshnessDto({
        snapshot: {
          benchmarkSessionDate: null,
          latestEquityBarSessionDate: null,
          latestScanRunAt: null,
        },
      }),
      candidatesWithHealth: [],
      activeWatchItems: [],
      openExposureVnd: 0,
      portfolioRiskConfigured: false,
    });

    const dto = buildDecisionCockpitDto(input);
    expect(dto.opportunity.mode).toBe("near_miss");
    expect(dto.opportunity.nearMiss[0]?.symbol).toBe("HPG");
  });
});
