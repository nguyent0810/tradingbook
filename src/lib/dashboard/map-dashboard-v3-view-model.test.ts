import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "./decision-cockpit-dto";
import {
  confidenceBandMeterWidth,
  mapDashboardV3ViewModel,
  mapMarketForeignEvidenceFromDto,
  mapUxVerdictToDecisionMode,
} from "./map-dashboard-v3-view-model";
import {
  formatGateFailureForUser,
  formatRelativeStrengthSummaryForUser,
} from "./v3-user-copy";
import { buildEvidenceSummaryLine } from "./build-evidence-summary";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";

const prodLikeMarketContext: MarketContextUiDto = {
  sessionDate: "2026-06-03",
  available: true,
  market: {
    foreignNetValue1d: -458_371_893_440,
    foreignNetValue5d: null,
    foreignNetValue10d: null,
    foreignSymbolsOk: 159,
    foreignSymbolsTotal: 206,
    foreignCoveragePct: 159 / 206,
    gate1Level: "PASS",
    vnindexVolRatioMa20: 1.1,
  },
  bySymbol: {},
};

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
      closestToValidSymbols: [
        {
          symbol: "HPG",
          partialPipelineScore: 0.8,
          stageRank: 58,
          reasonLineCount: 1,
          terminalCategory: "pullback_zone_interaction",
          terminalReasonPreview: "Not in zone",
          rankScore: 70,
          close: 28,
          breakoutLevel: 27,
          pullbackZoneLow: 27.5,
          pullbackZoneHigh: 28.2,
          stopLevel: 26.5,
        },
      ],
      recommendation: {
        likelyBottleneck: "pullback_zone",
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
    now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
    ...overrides,
  };
}

function mapFromInput(
  input: DecisionCockpitInput,
  options: { watchItemCount?: number; openPositionCount?: number } = {}
) {
  const dto = buildDecisionCockpitDto(input);
  return mapDashboardV3ViewModel({
    cockpitDto: dto,
    freshness: input.freshness,
    regime: {
      ...input.liveRegime,
      storedBarsCount: 60,
      evaluatedBarsCount: 60,
      checkedAt: input.now ?? new Date(),
      reasons: [],
      trend: "bullish",
      momentum: "up",
    },
    latestScan: input.latestScan
      ? ({
          id: input.latestScan.id,
          runAt: input.latestScan.runAt,
          gate1Level: input.latestScan.gate1Level,
          candidateCountA: input.latestScan.candidateCountA,
          candidateCountB: input.latestScan.candidateCountB,
          candidateCountSurfaced: input.latestScan.candidateCountSurfaced,
          universeScannedCount: input.latestScan.universeScannedCount,
          notes: null,
          candidates: [],
        } as Parameters<typeof mapDashboardV3ViewModel>[0]["latestScan"])
      : null,
    topSetups: [],
    trades: [],
    watchItemCount: options.watchItemCount ?? 2,
    openPositionCount: options.openPositionCount ?? 0,
    marketContext: input.marketContext ?? null,
  });
}

describe("confidenceBandMeterWidth", () => {
  it("maps bands to UX widths without exposing percent labels", () => {
    expect(confidenceBandMeterWidth("high")).toBe(85);
    expect(confidenceBandMeterWidth("medium")).toBe(65);
    expect(confidenceBandMeterWidth("low")).toBe(40);
  });
});

describe("mapDashboardV3ViewModel — NO_TRADE + near-miss", () => {
  it("plots near-miss on map and leaves rejected without invented coords", () => {
    const vm = mapFromInput(baseInput());
    expect(vm.decision.mode).toBe("PROTECT CAPITAL");
    expect(vm.radar.mapDots.every((d) => d.status === "near-miss")).toBe(true);
    expect(vm.radar.mapDots[0]?.symbol).toBe("HPG");
    expect(vm.radar.nearMiss.length).toBeGreaterThan(0);
    const rejectedOnMap = vm.radar.mapDots.filter((d) =>
      vm.radar.rejected.some((r) => r.symbol === d.symbol)
    );
    expect(rejectedOnMap).toHaveLength(0);
  });

  it("uses confidence band text encoding only", () => {
    const vm = mapFromInput(baseInput());
    expect(vm.decision.confidenceBand).toMatch(/high|medium|low/);
    expect(vm.decision.confidenceMeterWidth).toBeGreaterThan(0);
    const serialized = JSON.stringify(vm.decision);
    expect(serialized).not.toMatch(/"confidence":\s*\d{2,}/);
  });
});

describe("mapDashboardV3ViewModel — TRADE + candidates", () => {
  it("maps qualified candidates to radar and setup cards", () => {
    const vm = mapFromInput(
      baseInput({
        latestScan: {
          id: "scan-2",
          runAt: new Date(),
          gate1Level: "PASS",
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
          universeScannedCount: 400,
        },
        surfacedCandidates: [
          {
            id: "cand-1",
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

    expect(vm.decision.mode).toBe("TRADE");
    expect(vm.decision.stanceLabel).toBe("TRADE MODE");
    expect(vm.decision.primaryReason).toMatch(/not an automatic instruction/i);
    expect(vm.radar.qualified.length).toBeGreaterThan(0);
    expect(vm.radar.mapDots.some((d) => d.symbol === "FPT" && d.status === "qualified")).toBe(
      true
    );
  });
});

describe("mapDashboardV3ViewModel — risk headroom gaps", () => {
  it("leaves exposure percent null when equity not configured", () => {
    const vm = mapFromInput(baseInput({ accountEquityVnd: null }));
    expect(vm.risk.exposurePercent).toBeNull();
    expect(vm.risk.maxRiskPercent).toBeNull();
    expect(vm.risk.lossLimit).toBeNull();
  });
});

describe("mapDashboardV3ViewModel — no scan", () => {
  it("handles empty opportunity without fake radar qualified rows", () => {
    const vm = mapFromInput(
      baseInput({
        latestScan: null,
        scanNotes: null,
        surfacedCandidates: [],
      })
    );
    expect(vm.radar.qualified).toHaveLength(0);
    expect(vm.radar.mapDots).toHaveLength(0);
  });
});

describe("mapDashboardV3ViewModel — ledger", () => {
  it("does not fabricate discipline score or review queue count", () => {
    const vm = mapFromInput(baseInput());
    const serialized = JSON.stringify(vm.ledger);
    expect(serialized).not.toMatch(/disciplineScore|reviewQueue/);
    expect(vm.ledger.reviewHref).toBe("/trades");
    expect(vm.ledger.reviewLabel).toContain("Review");
  });
});

describe("mapUxVerdictToDecisionMode", () => {
  it("maps PROBE to WAIT", () => {
    expect(mapUxVerdictToDecisionMode("PROBE")).toBe("WAIT");
  });
});

describe("v3 user-facing copy", () => {
  it("humanizes breakout_recency gate failure without internal codes", () => {
    const copy = formatGateFailureForUser(
      "Failed Gate 2 because: No recent breakout (breakout_recency)"
    );
    expect(copy).toMatch(/Not ready/i);
    expect(copy).not.toMatch(/breakout_recency/);
    expect(copy).not.toMatch(/Failed Gate 2 because/);
  });

  it("humanizes relative strength summary lines", () => {
    const copy = formatRelativeStrengthSummaryForUser("RS20 +18.16 pp · RS50 +24.91 pp");
    expect(copy).toMatch(/20 sessions/i);
    expect(copy).not.toMatch(/RS20/);
    expect(copy).not.toMatch(/pp · RS50/);
  });
});

describe("mapDashboardV3ViewModel — readable breadth and diagnostics", () => {
  it("formats breadth without G2 shorthand", () => {
    const vm = mapFromInput(
      baseInput({
        latestScan: {
          id: "scan-breadth",
          runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
          gate1Level: "PASS",
          candidateCountA: 1,
          candidateCountB: 0,
          candidateCountSurfaced: 1,
          universeScannedCount: 400,
        },
      })
    );
    expect(vm.marketPulse.breadth).toMatch(/1 strong setup/i);
    expect(vm.marketPulse.breadth).not.toMatch(/G2/);
    expect(vm.marketPulse.breadth).not.toMatch(/surfaced 1$/);
  });

  it("maps RS watchlist to V3 intelligence cards without raw diagnostics", () => {
    const vm = mapFromInput(
      baseInput({
        rsNearMissWatchlist: {
          title: "Relative-strength watchlist",
          subtitle: "Diagnostic only",
          disclaimerLines: [
            "Relative strength diagnostic only — not used in current Gate 2 pass/fail.",
            "Not a Gate 2 SetupCandidate.",
          ],
          actionHint: "Not used in current trading decision.",
          emptyReason: null,
          rows: [
            {
              symbol: "CTR",
              sessionDate: "2026-05-25",
              failedGate2Because:
                "Failed Gate 2 because: No recent breakout (breakout_recency)",
              topRejectionReason: "Not a Gate 2 SetupCandidate.",
              rs20SpreadPct: 18.16,
              rs50SpreadPct: 24.91,
              terminalCode: "breakout_recency",
              stageRank: 58,
              distanceToPullbackZoneFrac: null,
              actionHint: "Diagnostic only",
              disclaimerLines: ["Not part of rankScore yet."],
              rsDiagnostic: {
                summary: "RS20 +18.16 pp · RS50 +24.91 pp",
                disclaimer:
                  "Relative strength diagnostic only — not used in current Gate 2 pass/fail and not part of rankScore yet.",
                lines: ["RS20 +18.16 pp vs VNINDEX"],
                rs20SpreadPct: 18.16,
              },
            },
          ],
        },
      })
    );
    const card = vm.rsWatchlist.cards[0]!;
    const serialized = JSON.stringify(vm.rsWatchlist);
    expect(vm.rsWatchlist.title).toBe("Relative Strength Radar");
    expect(card.primaryInsight).toMatch(/breakout/i);
    expect(card.stateBadge).toBe("Watch: breakout");
    expect(card.setupState).toBe("Watch: breakout");
    expect(serialized).not.toMatch(/Failed Gate 2 because/);
    expect(serialized).not.toMatch(/SetupCandidate/);
    expect(serialized).not.toMatch(/rankScore/);
    expect(serialized).not.toMatch(/breakout_recency/);
    expect(serialized).not.toMatch(/diagnostic only/i);
  });
});

describe("mapDashboardV3ViewModel — product spec v1 acceptance", () => {
  it("NO_TRADE never shows Go in trade gate and safe nextAction", () => {
    const vm = mapFromInput(baseInput());
    expect(vm.decision.mode).toBe("PROTECT CAPITAL");
    expect(vm.decision.nextAction).not.toMatch(/HPG/);
    expect(vm.risk.tradeGate.rows.every((r) => r.action !== "Go")).toBe(true);
    expect(vm.setupCards).toHaveLength(0);
    expect(JSON.stringify(vm.risk.tradeGate.rows)).not.toMatch(/extension_cap/);
  });

  it("hides duplicate Open pipeline CTA when NO_TRADE and no open positions", () => {
    const vm = mapFromInput(baseInput());
    expect(vm.headerCta.primaryLabel).toBe("Open pipeline");
    expect(vm.headerCta.secondaryHref).toBeNull();
    expect(vm.headerCta.secondaryLabel).toBeNull();
  });

  it("prioritizes review CTA when NO_TRADE and open positions exist", () => {
    const vm = mapFromInput(baseInput(), { openPositionCount: 2 });
    expect(vm.headerCta.primaryHref).toBe("/trades");
    expect(vm.headerCta.primaryLabel).toBe("Review open positions");
    expect(vm.headerCta.secondaryHref).toBe("/setups");
    expect(vm.headerCta.secondaryLabel).toBe("Open pipeline");
    expect(vm.headerCta.tertiaryHref).toBe("/trades/new");
    expect(vm.headerCta.tertiaryLabel).toBe("Log exit or adjustment");
  });

  it("pluralizes watch state copy", () => {
    expect(mapFromInput(baseInput(), { watchItemCount: 1 }).marketPulse.watchState).toBe(
      "1 symbol on watch"
    );
    expect(mapFromInput(baseInput(), { watchItemCount: 3 }).marketPulse.watchState).toBe(
      "3 symbols on watch"
    );
  });

  it("humanizes trade gate stop-level copy", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const stopRule = dto.risk.rules.find((r) => r.text.toLowerCase().includes("stop"));
    expect(stopRule?.text).toBe("Stop levels are reference only; size risk separately.");
  });

  it("builds NO TRADE evidence summary from view model evidence", () => {
    const vm = mapFromInput(baseInput({ marketContext: prodLikeMarketContext }));
    const summary = buildEvidenceSummaryLine(vm.decision.mode, vm.evidence);
    expect(summary).toMatch(/^Why no trade today:/);
    expect(summary).toMatch(/foreign flow negative/);
  });

  it("clarifies scan vs live regime mismatch on NO_TRADE", () => {
    const vm = mapFromInput(
      baseInput({
        liveRegime: {
          level: "WARNING",
          symbol: "VNINDEX",
          latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1245.5 },
        },
      })
    );
    expect(vm.marketPulse.regime).toBe("Favorable (scan)");
    expect(vm.marketPulse.gate1MismatchNote).toMatch(/Scan tagged Favorable, live Caution/i);
    expect(vm.decision.primaryReason).toMatch(/Live VNINDEX has weakened to Caution/i);
    expect(vm.decision.mainRisk).toMatch(/Live regime is Caution while the scan was Favorable/i);
  });
});

describe("mapDashboardV3ViewModel — market foreign evidence", () => {
  it("maps Foreign 1D and Foreign cov. into V3 evidence when market context is present", () => {
    const vm = mapFromInput(baseInput({ marketContext: prodLikeMarketContext }));
    const foreign1d = vm.evidence.find((e) => e.label === "Foreign 1D");
    const foreignCov = vm.evidence.find((e) => e.label === "Foreign cov.");

    expect(foreign1d).toEqual({
      label: "Foreign 1D",
      value: "−458.37B ₫ net",
      state: "danger",
      provenance: "real",
    });
    expect(foreignCov).toEqual({
      label: "Foreign cov.",
      value: "159/206 OK (77%)",
      state: "ok",
      provenance: "derived",
    });
  });

  it("omits foreign evidence when market context is unavailable", () => {
    const vm = mapFromInput(baseInput());
    expect(vm.evidence.some((e) => e.label.startsWith("Foreign"))).toBe(false);
  });

  it("includes 5D/10D evidence items only when DTO chips exist", () => {
    const withRollups: MarketContextUiDto = {
      ...prodLikeMarketContext,
      market: {
        ...prodLikeMarketContext.market!,
        foreignNetValue5d: -100_000_000_000,
        foreignNetValue10d: 50_000_000_000,
      },
    };
    const vm = mapFromInput(baseInput({ marketContext: withRollups }));
    expect(vm.evidence.some((e) => e.label === "Foreign 5D")).toBe(true);
    expect(vm.evidence.some((e) => e.label === "Foreign 10D")).toBe(true);

    const vmBase = mapFromInput(baseInput({ marketContext: prodLikeMarketContext }));
    expect(vmBase.evidence.some((e) => e.label === "Foreign 5D")).toBe(false);
    expect(vmBase.evidence.some((e) => e.label === "Foreign 10D")).toBe(false);
  });

  it("mapMarketForeignEvidenceFromDto preserves chip order", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        marketContext: {
          ...prodLikeMarketContext,
          market: {
            ...prodLikeMarketContext.market!,
            foreignNetValue5d: -1,
            foreignNetValue10d: 2,
          },
        },
      })
    );
    expect(mapMarketForeignEvidenceFromDto(dto, prodLikeMarketContext).map((e) => e.label)).toEqual([
      "Foreign 1D",
      "Foreign cov.",
      "Foreign 5D",
      "Foreign 10D",
    ]);
  });
});
