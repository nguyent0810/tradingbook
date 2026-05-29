import { describe, expect, it } from "vitest";
import type { ForwardReturnLabels } from "./forward-returns";
import {
  aggregateCohort,
  buildForwardReturnValidationReport,
  classifyInvalidRs20Cohort,
  HIGH_MISSING_FUTURE_20D_RATE,
  type LabeledForwardRow,
} from "./forward-return-validation";
import type { Gate2ReplayEvaluationRow } from "./gate2-replay-dataset";
import type { Gate2BarInput } from "./types";

function mockForward(ret20: number): ForwardReturnLabels {
  return {
    evaluationDate: "2026-01-01",
    entryClose: 100,
    futureSessionsAvailable: 20,
    forwardReturnPct: { 5: ret20 / 2, 10: ret20 * 0.8, 20: ret20 },
    maxFavorableExcursion20Pct: 8,
    maxAdverseExcursion20Pct: -4,
    hitPlus5BeforeMinus3: ret20 > 0,
    hitPlus10Within20: ret20 > 5,
    drawdownWorseThanMinus5Within20: ret20 < -3,
  };
}

describe("aggregateCohort", () => {
  it("summarizes averages, medians, and win rates", () => {
    const rows: LabeledForwardRow[] = [
      {
        symbol: "A",
        sessionDate: "2026-01-01",
        cohorts: ["baseline_tier_a"],
        baselineQuality: "A",
        terminalCode: "VALID",
        rs20SpreadPct: 2,
        forward: mockForward(10),
      },
      {
        symbol: "B",
        sessionDate: "2026-01-02",
        cohorts: ["baseline_tier_a"],
        baselineQuality: "A",
        terminalCode: "VALID",
        rs20SpreadPct: -1,
        forward: mockForward(-5),
      },
    ];
    const s = aggregateCohort(rows, "baseline_tier_a");
    expect(s.sampleSize).toBe(2);
    expect(s.horizons.find((h) => h.horizon === 20)?.avgPct).toBeCloseTo(2.5, 5);
    expect(s.horizons.find((h) => h.horizon === 20)?.winRate).toBe(0.5);
    expect(s.smallSampleWarning).toMatch(/Small sample/i);
  });
});

describe("classifyInvalidRs20Cohort", () => {
  it("splits INVALID rows into positive, negative, and neutral/missing", () => {
    expect(classifyInvalidRs20Cohort("INVALID", 2.5)).toBe("invalid_rs20_positive");
    expect(classifyInvalidRs20Cohort("INVALID", -1)).toBe("invalid_rs20_negative");
    expect(classifyInvalidRs20Cohort("INVALID", 0)).toBe("invalid_rs20_neutral_or_missing");
    expect(classifyInvalidRs20Cohort("INVALID", null)).toBe("invalid_rs20_neutral_or_missing");
    expect(classifyInvalidRs20Cohort("A", 5)).toBeNull();
  });
});

describe("aggregateCohort — missing 20d warning", () => {
  it("warns when more than 30% lack 20-session forward labels", () => {
    const rows: LabeledForwardRow[] = [];
    for (let i = 0; i < 10; i++) {
      rows.push({
        symbol: `S${i}`,
        sessionDate: "2026-01-01",
        cohorts: ["invalid_rs20_positive"],
        baselineQuality: "INVALID",
        terminalCode: "trend_below_ma50",
        rs20SpreadPct: 1,
        forward:
          i < 3
            ? mockForward(5)
            : {
                evaluationDate: "2026-01-01",
                entryClose: 100,
                futureSessionsAvailable: 5,
                forwardReturnPct: { 5: 1, 10: null, 20: null },
                maxFavorableExcursion20Pct: null,
                maxAdverseExcursion20Pct: null,
                hitPlus5BeforeMinus3: null,
                hitPlus10Within20: null,
                drawdownWorseThanMinus5Within20: null,
              },
      });
    }
    const s = aggregateCohort(rows, "invalid_rs20_positive");
    expect(s.missingFutureBars).toBe(7);
    expect(s.missingFuture20Pct).toBeCloseTo(0.7, 5);
    expect(s.highMissingFuture20Warning).toMatch(
      new RegExp(String(HIGH_MISSING_FUTURE_20D_RATE * 100))
    );
  });
});

describe("buildForwardReturnValidationReport", () => {
  it("builds baseline cohorts from replay fixtures", () => {
    const path = baselineBars();
    const session = path[path.length - 1]!.date;
    const replayRows: Gate2ReplayEvaluationRow[] = [
      {
        symbol: "FIX",
        bars: path,
        fullBars: path,
        sessionDate: session,
      },
    ];
    const report = buildForwardReturnValidationReport({
      replayRows,
      includeSweepArms: false,
    });
    expect(report.cohorts.some((c) => c.cohort === "baseline_tier_a" || c.cohort === "baseline_tier_b")).toBe(
      true
    );
    expect(report.evaluationRowCount).toBe(1);
  });
});

function baselineBars(): Gate2BarInput[] {
  const BASE = 200;
  const V = 1_000_000;
  const out: Gate2BarInput[] = [];
  for (let i = 0; i <= 69; i++) {
    const unix = 1_700_000_000 + i * 86400;
    const d = new Date(unix * 1000);
    if (i < 59) {
      out.push({ date: d, open: BASE, high: BASE, low: BASE - 1, close: BASE - 1, volume: V });
    } else if (i === 59) {
      out.push({ date: d, open: BASE, high: BASE + 2, low: BASE, close: BASE + 1, volume: V });
    } else if (i === 60) {
      out.push({ date: d, open: BASE + 1, high: BASE + 1, low: BASE - 3, close: BASE + 0.5, volume: V });
    } else if (i < 68) {
      out.push({ date: d, open: BASE, high: BASE + 0.6, low: BASE - 0.2, close: BASE, volume: V });
    } else if (i === 68) {
      out.push({ date: d, open: BASE, high: BASE + 0.6, low: BASE - 0.2, close: BASE + 0.5, volume: V });
    } else {
      out.push({ date: d, open: BASE + 5, high: BASE + 7, low: BASE - 1, close: BASE + 6, volume: V * 2 });
    }
  }
  return out;
}
