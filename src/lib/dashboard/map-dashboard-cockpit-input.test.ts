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
      } as unknown as Parameters<typeof buildDashboardCockpitInput>[0]["latestScan"],
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
        reasons: [],
        symbol: "VNINDEX",
        latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 100 },
        storedBarsCount: 60,
        evaluatedBarsCount: 60,
        loadError: null,
        checkedAt: new Date(),
      },
      freshness: buildMarketFreshnessDto({
        snapshot: {
          benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
          latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
          latestScanRunAt: new Date(Date.UTC(2026, 4, 25)),
          error: null,
        },
      }),
      candidatesWithHealth: [],
      activeWatchItems: [],
    });

    expect(input.latestScan?.gate1Level).toBe("PASS");
    expect(input.liveRegime.level).toBe("WARNING");

    const dto = buildDecisionCockpitDto(input);
    // Fail-closed: live WARNING is worse than the persisted scan-run PASS, so
    // canonical is overridden toward the live (worse) reading — see decision-cockpit-dto.ts:355.
    expect(dto.verdict.gate1Resolution.canonical).toBe("WARNING");
    expect(dto.verdict.gate1Resolution.mismatch).toBe(true);
    expect(dto.verdict.gate1Resolution.liveOverrideApplied).toBe(true);
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
      } as unknown as Parameters<typeof buildDashboardCockpitInput>[0]["latestScan"],
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
          likelyBottleneck: "pullback_zone",
          summary: "",
          note: "",
        },
      },
      regime: {
        level: "PASS",
        reasons: [],
        symbol: "VNINDEX",
        latestBar: null,
        storedBarsCount: 0,
        evaluatedBarsCount: 0,
        loadError: null,
        checkedAt: new Date(),
      },
      freshness: buildMarketFreshnessDto({
        snapshot: {
          benchmarkSessionDate: null,
          latestEquityBarSessionDate: null,
          latestScanRunAt: null,
          error: null,
        },
      }),
      candidatesWithHealth: [],
      activeWatchItems: [],
    });

    const dto = buildDecisionCockpitDto(input);
    expect(dto.opportunity.mode).toBe("near_miss");
    expect(dto.opportunity.nearMiss[0]?.symbol).toBe("HPG");
  });
});
