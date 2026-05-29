import { describe, expect, it } from "vitest";
import type { Gate2BarInput } from "./types";
import {
  aggregateLookbackReadiness,
  buildEvidenceReadinessReport,
  recommendLookbackForAbTarget,
  type ReplayRowGate2Snapshot,
} from "./gate2-evidence-readiness";
import {
  buildReplayRowsForSymbol,
  filterReplayRowsForForwardHorizon,
  hasSufficientForwardSessions,
} from "./gate2-replay-dataset";

function ascendingBars(count: number, start = 100): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  let t = Date.UTC(2026, 0, 1);
  for (let i = 0; i < count; i++) {
    const c = start + i;
    out.push({
      date: new Date(t),
      open: c,
      high: c + 1,
      low: c - 1,
      close: c,
      volume: 1_000_000,
    });
    t += 86400000;
  }
  return out;
}

function snap(
  partial: Partial<ReplayRowGate2Snapshot> & Pick<ReplayRowGate2Snapshot, "quality">
): ReplayRowGate2Snapshot {
  return {
    symbol: "X@2026-01-01",
    sessionDate: "2026-01-01",
    terminalCode: partial.quality === "INVALID" ? "trend_below_ma50" : "VALID",
    futureSessionsAvailable: partial.futureSessionsAvailable ?? 25,
    hasForward5: partial.hasForward5 ?? true,
    hasForward10: partial.hasForward10 ?? true,
    hasForward20: partial.hasForward20 ?? true,
    ...partial,
  };
}

describe("hasSufficientForwardSessions / buildReplayRows requireForward20d", () => {
  it("excludes tail sessions without 20 future bars when requireForward20d", () => {
    const bars = ascendingBars(80);
    const allRows = buildReplayRowsForSymbol({
      symbol: "TST",
      allBars: bars,
      lookbackSessions: 40,
      asOf: null,
      requireForward20d: false,
    });
    const filtered = buildReplayRowsForSymbol({
      symbol: "TST",
      allBars: bars,
      lookbackSessions: 40,
      asOf: null,
      requireForward20d: true,
    });
    expect(filtered.length).toBeLessThan(allRows.length);
    for (const r of filtered) {
      expect(hasSufficientForwardSessions(r.fullBars, r.sessionDate, 20)).toBe(true);
    }
  });

  it("filterReplayRowsForForwardHorizon matches requireForward20d build", () => {
    const bars = ascendingBars(70);
    const rows = buildReplayRowsForSymbol({
      symbol: "TST",
      allBars: bars,
      lookbackSessions: 20,
      asOf: null,
    });
    const filtered = filterReplayRowsForForwardHorizon(rows);
    expect(filtered.every((r) => hasSufficientForwardSessions(r.fullBars, r.sessionDate))).toBe(
      true
    );
  });
});

describe("aggregateLookbackReadiness", () => {
  it("computes missing 20d rate", () => {
    const all = [
      snap({ quality: "A", hasForward20: true }),
      snap({ quality: "INVALID", hasForward20: false, futureSessionsAvailable: 5 }),
    ];
    const fwd = [snap({ quality: "A", hasForward20: true })];
    const w = aggregateLookbackReadiness({
      lookbackSessions: 40,
      tradableSymbolCount: 10,
      snapshots: all,
      forward20EligibleSnapshots: fwd,
    });
    expect(w.missingForward20Count).toBe(1);
    expect(w.missingForward20Rate).toBeCloseTo(0.5, 5);
    expect(w.abCount).toBe(1);
    expect(w.abCountForward20Eligible).toBe(1);
  });
});

describe("recommendLookbackForAbTarget", () => {
  it("returns smallest lookback that reaches target A/B", () => {
    const windows = [
      {
        lookbackSessions: 40,
        abCountForward20Eligible: 10,
      },
      {
        lookbackSessions: 80,
        abCountForward20Eligible: 35,
      },
      {
        lookbackSessions: 60,
        abCountForward20Eligible: 32,
      },
    ] as Parameters<typeof recommendLookbackForAbTarget>[0];
    expect(recommendLookbackForAbTarget(windows, 30)).toBe(60);
  });
});

describe("buildEvidenceReadinessReport", () => {
  it("flags decision-grade when achievable", () => {
    const report = buildEvidenceReadinessReport({
      anchorSession: "2026-05-28",
      activeSymbolCount: 200,
      symbolSummaries: [],
      tradableAtAnchorCount: 54,
      lookbackWindows: [
        {
          lookbackSessions: 80,
          tradableSymbolCount: 54,
          replayRowCount: 4000,
          replayRowCountForward20Eligible: 3800,
          qualityCounts: { A: 40, B: 5, INVALID: 3955 },
          qualityCountsForward20Eligible: { A: 35, B: 4, INVALID: 3761 },
          abCount: 45,
          abCountForward20Eligible: 39,
          missingForward20Count: 200,
          missingForward20Rate: 0.05,
          rowsWithForward5: 3900,
          rowsWithForward10: 3850,
          rowsWithForward20: 3800,
          terminalCodeCounts: {},
          decisionGradeAb: true,
        },
      ],
    });
    expect(report.decisionGradeAbAchievable).toBe(true);
    expect(report.recommendedLookbackForAb30).toBe(80);
  });
});
