import { describe, expect, it } from "vitest";
import type { ForwardReturnLabels } from "./forward-returns";
import {
  aggregateForwardOutcomeGroup,
  buildRsRankEvidenceReport,
  RS_RANK_ENABLE_MIN_AB_SAMPLES,
} from "./rs-rank-evidence";

function mockForward(ret20: number, futureAvailable = 20): ForwardReturnLabels {
  return {
    evaluationDate: "2026-01-01",
    entryClose: 100,
    futureSessionsAvailable: futureAvailable,
    forwardReturnPct: { 5: ret20 / 2, 10: ret20 * 0.8, 20: ret20 },
    maxFavorableExcursion20Pct: 8,
    maxAdverseExcursion20Pct: -4,
    hitPlus5BeforeMinus3: ret20 > 0,
    hitPlus10Within20: ret20 > 5,
    drawdownWorseThanMinus5Within20: ret20 < -3,
  };
}

describe("aggregateForwardOutcomeGroup", () => {
  it("handles missing future bars", () => {
    const summary = aggregateForwardOutcomeGroup("promoted", [
      {
        symbol: "A@2026-01-01",
        underlying: "A",
        sessionDate: "2026-01-01",
        quality: "A",
        terminalCode: "VALID",
        rankScoreBase: 1000,
        rs20SpreadPct: 5,
        rs50SpreadPct: null,
        rsTerm: 125,
        rankScoreWithRs: 1125,
        forward: {
          ...mockForward(10, 5),
          forwardReturnPct: { 5: 1, 10: null, 20: null },
        },
      },
    ]);
    expect(summary.missingFuture20).toBe(1);
    expect(summary.horizons.find((h) => h.horizon === 20)?.n).toBe(0);
  });
});

describe("buildRsRankEvidenceReport", () => {
  it("flags small sample below enablement threshold", () => {
    const abRows = Array.from({ length: 12 }, (_, i) => ({
      symbol: `S${i}@2026-01-01`,
      underlying: `S${i}`,
      sessionDate: "2026-01-01",
      quality: "A" as const,
      terminalCode: "VALID",
      rankScoreBase: 1000 + i,
      rs20SpreadPct: i % 2 === 0 ? 3 : -2,
      rs50SpreadPct: 1,
      rsTerm: i % 2 === 0 ? 75 : -50,
      rankScoreWithRs: 1000 + i + (i % 2 === 0 ? 75 : -50),
      forward: mockForward(5),
    }));
    const report = buildRsRankEvidenceReport({
      anchorSession: "2026-05-28",
      lookbackSessions: 40,
      mode: "walkforward_ab",
      formula: "test",
      productionRsRankEnabled: false,
      evaluationRowCount: 100,
      rsComputedPerSession: true,
      abRows,
    });
    expect(report.abCandidateCount).toBe(12);
    expect(report.smallSampleWarning).toMatch(/below enablement/i);
    expect(report.enablementReadiness).toBe("insufficient_ab_sample");
  });

  it("promoted group forward aggregation is deterministic", () => {
    const rows = [
      {
        symbol: "AAA@2026-01-01",
        underlying: "AAA",
        sessionDate: "2026-01-01",
        quality: "A" as const,
        terminalCode: "VALID",
        rankScoreBase: 1000,
        rs20SpreadPct: 10,
        rs50SpreadPct: 5,
        rsTerm: 250,
        rankScoreWithRs: 1250,
        forward: mockForward(8),
      },
      {
        symbol: "ZZZ@2026-01-01",
        underlying: "ZZZ",
        sessionDate: "2026-01-01",
        quality: "B" as const,
        terminalCode: "VALID",
        rankScoreBase: 1100,
        rs20SpreadPct: -2,
        rs50SpreadPct: -1,
        rsTerm: -50,
        rankScoreWithRs: 1050,
        forward: mockForward(-2),
      },
    ];
    const r1 = buildRsRankEvidenceReport({
      anchorSession: "2026-05-28",
      lookbackSessions: 40,
      mode: "walkforward_ab",
      formula: "test",
      productionRsRankEnabled: false,
      evaluationRowCount: 200,
      rsComputedPerSession: true,
      abRows: rows,
    });
    const r2 = buildRsRankEvidenceReport({
      anchorSession: "2026-05-28",
      lookbackSessions: 40,
      mode: "walkforward_ab",
      formula: "test",
      productionRsRankEnabled: false,
      evaluationRowCount: 200,
      rsComputedPerSession: true,
      abRows: rows,
    });
    expect(r1.ordering.promoted).toEqual(r2.ordering.promoted);
    expect(r1.forwardOutcomes.find((g) => g.group === "promoted")?.sampleSize).toBe(
      r1.ordering.promoted.length
    );
  });

  it("missing RS produces no ordering movement when base scores differ", () => {
    const report = buildRsRankEvidenceReport({
      anchorSession: "2026-05-28",
      lookbackSessions: 1,
      mode: "anchor_ab",
      formula: "test",
      productionRsRankEnabled: false,
      evaluationRowCount: 2,
      rsComputedPerSession: true,
      abRows: [
        {
          symbol: "HIGH",
          underlying: "HIGH",
          sessionDate: "2026-05-28",
          quality: "A",
          terminalCode: "VALID",
          rankScoreBase: 2000,
          rs20SpreadPct: null,
          rs50SpreadPct: null,
          rsTerm: 0,
          rankScoreWithRs: 2000,
          forward: null,
        },
        {
          symbol: "LOW",
          underlying: "LOW",
          sessionDate: "2026-05-28",
          quality: "B",
          terminalCode: "VALID",
          rankScoreBase: 1500,
          rs20SpreadPct: null,
          rs50SpreadPct: null,
          rsTerm: 0,
          rankScoreWithRs: 1500,
          forward: null,
        },
      ],
    });
    expect(report.ordering.promoted).toHaveLength(0);
    expect(report.ordering.demoted).toHaveLength(0);
  });
});

describe("RS_RANK_ENABLE_MIN_AB_SAMPLES", () => {
  it("is at least 30 for enablement guidance", () => {
    expect(RS_RANK_ENABLE_MIN_AB_SAMPLES).toBeGreaterThanOrEqual(30);
  });
});
