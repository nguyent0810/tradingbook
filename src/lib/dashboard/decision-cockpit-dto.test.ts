import { describe, expect, it } from "vitest";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { RS_DIAGNOSTIC_DISCLAIMER } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import {
  buildDecisionCockpitDto,
  computeConfidenceBand,
  mapDecisionLevelToUxVerdict,
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
    error: null,
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
      topRejectionCategories: {
        pullback_zone_interaction: 42,
        extension_cap: 18,
      },
      rejectionSymbolsByCategory: {
        pullback_zone_interaction: ["HPG", "FPT", "VNM"],
        extension_cap: ["SSI", "VCB"],
      },
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
        likelyBottleneck: "pullback_zone",
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
    now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
    ...overrides,
  };
}

describe("resolveCanonicalGate1 (DC-1)", () => {
  it("falls back to live regime when no scan", () => {
    const r = resolveCanonicalGate1({ scanGate1: null, liveRegimeGate1: "WARNING" });
    expect(r.canonical).toBe("WARNING");
    expect(r.source).toBe("live_regime");
    expect(r.mismatch).toBe(false);
    expect(r.liveOverrideApplied).toBe(false);
  });

  it("keeps scan-run Gate 1 when live regime is not worse (aligned)", () => {
    const r = resolveCanonicalGate1({ scanGate1: "PASS", liveRegimeGate1: "PASS" });
    expect(r.canonical).toBe("PASS");
    expect(r.source).toBe("scan_run");
    expect(r.mismatch).toBe(false);
    expect(r.liveOverrideApplied).toBe(false);
  });

  it("fail-closed: overrides toward live WARNING when scan said PASS", () => {
    const r = resolveCanonicalGate1({ scanGate1: "PASS", liveRegimeGate1: "WARNING" });
    expect(r.canonical).toBe("WARNING");
    expect(r.source).toBe("scan_run");
    expect(r.mismatch).toBe(true);
    expect(r.liveOverrideApplied).toBe(true);
  });

  it("fail-closed: overrides toward live FAIL when scan said PASS", () => {
    const r = resolveCanonicalGate1({ scanGate1: "PASS", liveRegimeGate1: "FAIL" });
    expect(r.canonical).toBe("FAIL");
    expect(r.liveOverrideApplied).toBe(true);
  });

  it("fail-closed: overrides toward live FAIL when scan said WARNING", () => {
    const r = resolveCanonicalGate1({ scanGate1: "WARNING", liveRegimeGate1: "FAIL" });
    expect(r.canonical).toBe("FAIL");
    expect(r.liveOverrideApplied).toBe(true);
  });

  it("never upgrades toward a BETTER live reading — stale caution stays cautious", () => {
    const r = resolveCanonicalGate1({ scanGate1: "FAIL", liveRegimeGate1: "PASS" });
    expect(r.canonical).toBe("FAIL");
    expect(r.mismatch).toBe(true);
    expect(r.liveOverrideApplied).toBe(false);
  });
});

describe("mapDecisionLevelToUxVerdict", () => {
  it("maps NORMAL to TRADE without confidence percent", () => {
    expect(mapDecisionLevelToUxVerdict("NORMAL")).toBe("TRADE");
  });
});

describe("buildDecisionCockpitDto — production-like zero surfaced", () => {
  it("fail-closed: live WARNING (worse than scan PASS) overrides the verdict", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.verdict.persistedLevel.value).toBe("NO_TRADE");
    expect(dto.verdict.uxLevel.value).toBe("NO_TRADE");
    expect(dto.verdict.gate1Resolution.canonical).toBe("WARNING");
    expect(dto.verdict.gate1Resolution.mismatch).toBe(true);
    expect(dto.verdict.gate1Resolution.liveOverrideApplied).toBe(true);
  });

  it("acceptance audit regression: persistedLevel/persistedLevelNote keep showing the TRUE scan-time decision under a live override, not the recomputed active one", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          gate1Level: "PASS",
          candidateCountA: 2,
          candidateCountB: 0,
          candidateCountSurfaced: 2,
        },
        scanNotes: {
          ...baseInput().scanNotes!,
          decision: { level: "NORMAL", allocation: "50-70%", explanation: "Valid setups." },
        },
        // Scan persisted PASS/NORMAL; live regime has since turned FAIL.
        liveRegime: { level: "FAIL", symbol: "VNINDEX", latestBar: null },
      })
    );

    expect(dto.verdict.gate1Resolution.liveOverrideApplied).toBe(true);
    // Active/headline-facing level correctly reflects the override.
    expect(dto.verdict.uxLevel.value).toBe("NO_TRADE");
    // But the "what the scan actually persisted" fields must NOT collapse to
    // the override value — that would hide the fact that anything changed.
    expect(dto.verdict.persistedLevel.value).toBe("NORMAL");
    expect(dto.verdict.persistedLevelNote.value).toMatch(/Trạng thái đã ghi nhận: NORMAL/);
  });

  it("surfaces near-miss opportunity board when zero candidates", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.opportunity.mode).toBe("near_miss");
    expect(dto.opportunity.nearMiss[0]?.symbol).toBe("HPG");
    expect(dto.opportunity.nearMiss[0]?.waitFor).toContain("pullback");
    expect(dto.opportunity.nearMiss[0]?.executionStatusLabel).not.toBe("At entry zone");
    expect(dto.opportunity.nearMiss[0]?.actionHint).toMatch(
      /không phải tín hiệu giao dịch|chỉ theo dõi|không giao dịch/i
    );
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
            rankSummary: null,
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
    expect(dto.verdict.headline.value).toBe("TRADE MODE");
    expect(dto.verdict.subtitle.value).toMatch(/không phải là chỉ thị tự động/i);
    expect(dto.opportunity.mode).toBe("candidates");
    expect(dto.opportunity.candidates[0]?.ladderStage).toBe("tier_a");
    expect(dto.opportunity.candidates[0]?.actionHint).toBe("Ghi lệnh — đã xác nhận điểm vào");
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
        rankSummary: null,
        close: 1,
        pullbackZoneLow: 0.9,
        pullbackZoneHigh: 1.1,
        stopLevel: 0.8,
        rankScore: 1,
      })
    ).toBe("extended");
  });

  it("NO_DATA (missing eval bar) is never Tier A/B — classified invalid like DEAD", () => {
    expect(
      resolveSetupLadderStage({
        id: "y",
        symbolKey: "VNM",
        quality: "A",
        lifecycleSortLabel: "READY",
        healthLevel: "NO_DATA",
        healthScore: 0,
        healthScoreLabel: "Risky",
        healthFlags: [],
        healthSummary: null,
        reasons: [],
        rankSummary: null,
        close: 1,
        pullbackZoneLow: 0.9,
        pullbackZoneHigh: 1.1,
        stopLevel: 0.8,
        rankScore: 1,
      })
    ).toBe("invalid");
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
    expect(dto.tomorrow.watchNote.value).toContain("Không có mã suýt đạt");
    expect(dto.tomorrow.watchNote.value).toContain("/setups");
  });

  it("candidate day: watch includes surfaced symbol", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        // Aligned live regime — this test is about tomorrow-plan copy, not Gate 1 override behavior.
        liveRegime: { ...baseInput().liveRegime, level: "PASS" },
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
            rankSummary: null,
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
    expect(dto.tomorrow.watchReasons.MWG).toBeTruthy();
  });

  it("watchReasons carries the near-miss waitFor text per symbol (not a shared line)", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    const [firstSymbol] = dto.tomorrow.watchSymbols.value;
    expect(firstSymbol).toBeTruthy();
    expect(dto.tomorrow.watchReasons[firstSymbol!]).toBeTruthy();
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
            rankSummary: null,
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

describe("buildDecisionCockpitDto — scan pulse summary (S5 reframe)", () => {
  it("active day: tier A/B clears produce an 'Active day' summary with the cleared count", () => {
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
            rankSummary: null,
            close: 10,
            pullbackZoneLow: 9.5,
            pullbackZoneHigh: 10.2,
            stopLevel: 9,
            rankScore: 1,
          },
        ],
      })
    );
    expect(dto.setupQualityLadder.summary).toContain("Ngày sôi động");
    expect(dto.setupQualityLadder.summary).toContain("1 mã");
  });

  it("quiet day: only watch-stage matches produce a 'Quiet day' summary", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    expect(dto.setupQualityLadder.stages.find((s) => s.stage === "tier_a")?.count).toBe(0);
    expect(dto.setupQualityLadder.stages.find((s) => s.stage === "watch")?.count).toBeGreaterThan(0);
    expect(dto.setupQualityLadder.summary).toContain("Ngày yên ắng");
  });

  it("no candidates at all: falls back to a neutral no-classification summary", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        scanNotes: {
          ...baseInput().scanNotes!,
          closestToValidSymbols: [],
        },
      })
    );
    expect(dto.setupQualityLadder.totalClassified).toBe(0);
    expect(dto.setupQualityLadder.summary).toBe("Không có ứng viên nào được phân loại trong lần quét gần nhất.");
  });
});

describe("buildDecisionCockpitDto — RS diagnostic (Batch D1)", () => {
  it("omits rsDiagnostic when rsDiagnosticsBySymbol not provided", () => {
    const dto = buildDecisionCockpitDto(baseInput());
    if (dto.opportunity.nearMiss.length > 0) {
      expect(dto.opportunity.nearMiss[0]?.rsDiagnostic).toBeNull();
    }
  });

  it("attaches RS copy without changing opportunity mode or rank fields", () => {
    const rsDiagnostic = {
      summary: "RS20 +6.00pp",
      lines: ["RS20: +6.00 pp vs VNINDEX — Outperforming VNINDEX over 20 sessions."],
      disclaimer: RS_DIAGNOSTIC_DISCLAIMER,
      rs20SpreadPct: 6.0,
      rs50SpreadPct: null,
      stockAboveMa50: true,
      indexAboveMa50: false,
      trendLabel: "leading" as const,
    };
    const dto = buildDecisionCockpitDto(
      baseInput({
        rsDiagnosticsBySymbol: { HPG: rsDiagnostic },
      })
    );
    expect(dto.opportunity.mode).toBe("near_miss");
    const row = dto.opportunity.nearMiss.find((n) => n.symbol === "HPG");
    expect(row?.rsDiagnostic?.lines[0]).toMatch(/outperforming/i);
    expect(row?.actionHint).toMatch(/không phải tín hiệu giao dịch|chỉ theo dõi|không giao dịch/i);
  });

  it("rsNearMissWatchlist panel uses non-actionable diagnostic copy", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        rsNearMissWatchlist: {
          title: "Relative-strength watchlist",
          subtitle: "test",
          disclaimerLines: [
            "Diagnostic only",
            "Not a Gate 2 SetupCandidate",
            "Not used in current trading decision",
          ],
          actionHint:
            "Relative-strength watchlist — Diagnostic only. Not a Gate 2 SetupCandidate. Not used in current trading decision.",
          rows: [
            {
              symbol: "HPG",
              sessionDate: "2026-05-28",
              rs20SpreadPct: 4.2,
              rs50SpreadPct: 2.1,
              terminalCode: "volume_ratio",
              failedGate2Because: "Failed Gate 2 because: Participation too thin vs median volume (volume_ratio)",
              topRejectionReason: "Participation too thin",
              stageRank: 72,
              distanceToPullbackZoneFrac: 0.02,
              rsDiagnostic: null,
              disclaimerLines: ["Diagnostic only", "Not a Gate 2 SetupCandidate", "Not used in current trading decision"],
              actionHint:
                "Relative-strength watchlist — Diagnostic only. Not a Gate 2 SetupCandidate. Not used in current trading decision.",
            },
          ],
          emptyReason: null,
        },
      })
    );
    expect(dto.rsNearMissWatchlist.title).toBe("Relative-strength watchlist");
    expect(dto.rsNearMissWatchlist.rows[0]?.failedGate2Because).toMatch(/^Failed Gate 2 because:/);
    expect(dto.opportunity.mode).toBe("near_miss");
  });

  it("negative RS copy uses underperforming wording", () => {
    const rsDiagnostic = {
      summary: "RS20 -2.00pp",
      lines: ["RS20: -2.00 pp vs VNINDEX — Underperforming VNINDEX over 20 sessions."],
      disclaimer: RS_DIAGNOSTIC_DISCLAIMER,
      rs20SpreadPct: -2.0,
      rs50SpreadPct: null,
      stockAboveMa50: false,
      indexAboveMa50: true,
      trendLabel: "lagging" as const,
    };
    const dto = buildDecisionCockpitDto(
      baseInput({
        rsDiagnosticsBySymbol: { HPG: rsDiagnostic },
      })
    );
    expect(dto.opportunity.nearMiss[0]?.rsDiagnostic?.lines[0]).toMatch(/underperforming/i);
  });
});

describe("buildDecisionCockpitDto — Gate funnel (Batch F)", () => {
  it("WARNING + Tier B qualified: evidence shows suppressed Tier B, not actionable surfaced B", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          gate1Level: "WARNING",
          candidateCountA: 1,
          candidateCountB: 2,
          candidateCountSurfaced: 1,
        },
        liveRegime: { level: "WARNING", symbol: "VNINDEX", latestBar: null },
      })
    );
    expect(dto.gateFunnel?.suppressedCountB).toBe(2);
    expect(dto.gateFunnel?.surfacedCountB).toBe(0);
    const suppressed = dto.evidence.find((c) => c.id === "gate2_suppressed");
    expect(suppressed?.display).toMatch(/Hạng B bị ẩn/i);
    const surfaced = dto.evidence.find((c) => c.id === "gate2_surfaced");
    expect(surfaced?.display).toMatch(/B 0/);
  });

  it("FAIL: zero surfaced in funnel but qualified counts preserved", () => {
    const dto = buildDecisionCockpitDto(
      baseInput({
        latestScan: {
          ...baseInput().latestScan!,
          gate1Level: "FAIL",
          candidateCountA: 2,
          candidateCountB: 1,
          candidateCountSurfaced: 0,
        },
        liveRegime: { level: "FAIL", symbol: "VNINDEX", latestBar: null },
      })
    );
    expect(dto.gateFunnel?.surfacedTotal).toBe(0);
    expect(dto.gateFunnel?.qualifiedTotal).toBe(3);
    expect(dto.gateFunnel?.suppressedTotal).toBe(3);
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
      gateFunnel: dto.gateFunnel,
    });
    expect(p.mode).toBe("compact_empty");
    expect(p.emptyTitle).toMatch(/Không có thiết lập breakout-pullback/i);
    expect(p.emptyReason).toMatch(/trước chế độ|Đạt Gate 2/i);
    expect(p.emptyReason).toMatch(/chẩn đoán/i);
  });
});

describe("computeConfidenceBand", () => {
  it("returns low when scan session coverage is weak", () => {
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 0, 0)),
        error: null,
      },
      scanSessionCoverage: {
        expectedSessionDate: "2026-05-25",
        universeScanned: 100,
        tradabilityEvaluated: 100,
        tradabilityPassed: 10,
        staleSessionCount: 40,
        staleSessionFrac: 0.4,
        sessionAlignedCount: 60,
        sessionAlignedFrac: 0.6,
        weakCoverage: true,
        headline: "Weak",
        operatorWarning: "Data coverage is weak for the expected session.",
      },
    });
    expect(
      computeConfidenceBand({
        hasScan: true,
        freshness: fresh,
        gate1: "PASS",
        surfacedCount: 2,
        now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
        scanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 0, 0)),
      })
    ).toBe("low");
  });

  it("returns low when benchmark missing", () => {
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: null,
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestScanRunAt: null,
        error: null,
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

  it("session-aware: Friday scan viewed Monday morning is NOT stale (weekend gap, no false low)", () => {
    // Friday 2026-05-22 scan; freshness still anchored to that same Friday session
    // (no newer session imported yet) — viewed Monday 2026-05-25 morning, ~63h later.
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 22)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 22)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 22, 12, 30, 0)),
        error: null,
      },
    });
    const band = computeConfidenceBand({
      hasScan: true,
      freshness: fresh,
      gate1: "PASS",
      surfacedCount: 3,
      now: new Date(Date.UTC(2026, 4, 25, 9, 0, 0)),
      scanRunAt: new Date(Date.UTC(2026, 4, 22, 12, 30, 0)),
    });
    expect(band).toBe("high");
  });

  it("session-aware: a newer session's data being available downgrades confidence even a few hours later", () => {
    // Scan ran for Friday's session; by the time the dashboard loads, Monday's
    // session has already been imported (benchmarkDate moved forward) but the
    // scan hasn't re-run yet — this IS real staleness regardless of hours.
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 22, 12, 30, 0)),
        error: null,
      },
    });
    const band = computeConfidenceBand({
      hasScan: true,
      freshness: fresh,
      gate1: "PASS",
      surfacedCount: 3,
      now: new Date(Date.UTC(2026, 4, 25, 20, 0, 0)),
      scanRunAt: new Date(Date.UTC(2026, 4, 22, 12, 30, 0)),
    });
    expect(band).toBe("low");
  });

  it("absolute failsafe: catches a scan far older than any realistic holiday even with no newer session", () => {
    const fresh = buildMarketFreshnessDto({
      snapshot: {
        benchmarkSessionDate: new Date(Date.UTC(2026, 4, 1)),
        latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 1)),
        latestScanRunAt: new Date(Date.UTC(2026, 4, 1, 12, 30, 0)),
        error: null,
      },
    });
    const band = computeConfidenceBand({
      hasScan: true,
      freshness: fresh,
      gate1: "PASS",
      surfacedCount: 3,
      now: new Date(Date.UTC(2026, 4, 20, 9, 0, 0)), // 19 days later
      scanRunAt: new Date(Date.UTC(2026, 4, 1, 12, 30, 0)),
    });
    expect(band).toBe("low");
  });

  it("an info-severity-only stale flag does NOT force low (cosmetic noise must not block trade recommendations)", () => {
    // Constructed literally (not via a real flag-producing function) because no
    // current code path in market-freshness-dto.ts / market-data-alignment.ts
    // actually emits an "info" flag today — this guards computeConfidenceBand
    // itself against ever over-blocking on a future purely-informational flag.
    const fresh: MarketFreshnessDto = {
      benchmarkDate: "2026-05-25",
      equityMaxDate: "2026-05-25",
      scanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)).toISOString(),
      delayedBackdrop: false,
      staleFlags: [
        { code: "cosmetic_info_flag", severity: "info", message: "Informational only." },
      ],
      scanSessionCoverage: null,
      dataTimingMode: "eod",
    };
    const band = computeConfidenceBand({
      hasScan: true,
      freshness: fresh,
      gate1: "PASS",
      surfacedCount: 3,
      now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
      scanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
    });
    expect(band).toBe("high");
  });
});

const prodLikeMarketContext: MarketContextUiDto = {
  sessionDate: "2026-06-03",
  available: true,
  market: {
    foreignNetValue1d: -458_371_893_440,
    foreignNetValue5d: null,
    foreignNetValue10d: null,
    foreignSymbolsOk: 159,
    foreignSymbolsTotal: 206,
    foreignCoveragePct: 77.18,
    foreignFlowRollingDangerVnd: null,
    foreignFlowRolling5dDangerVnd: null,
    foreignFlowRolling10dDangerVnd: null,
    gate1Level: "PASS",
    vnindexVolRatioMa20: 1.1,
  },
  bySymbol: {},
};

describe("buildDecisionCockpitDto — market context Phase 1B invariance", () => {
  it("leaves verdict and opportunity unchanged when market context is present", () => {
    const input = baseInput();
    const without = buildDecisionCockpitDto(input);
    const withContext = buildDecisionCockpitDto({
      ...input,
      marketContext: prodLikeMarketContext,
    });

    expect(withContext.verdict).toEqual(without.verdict);
    expect(withContext.opportunity).toEqual(without.opportunity);
    expect(withContext.gateFunnel).toEqual(without.gateFunnel);
    expect(withContext.ladder).toEqual(without.ladder);
    expect(withContext.setupQualityLadder).toEqual(without.setupQualityLadder);
    expect(withContext.tomorrow).toEqual(without.tomorrow);
  });

  it("appends market foreign evidence chips without removing existing chips", () => {
    const dto = buildDecisionCockpitDto({
      ...baseInput(),
      marketContext: prodLikeMarketContext,
    });
    const ids = dto.evidence.map((c) => c.id);
    expect(ids).toContain("gate1");
    expect(ids).toContain("market_foreign_1d");
    expect(ids).toContain("market_foreign_coverage");
    expect(ids).not.toContain("market_foreign_5d");
    expect(ids).not.toContain("market_foreign_10d");
  });
});

