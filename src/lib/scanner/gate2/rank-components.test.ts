import { describe, expect, it } from "vitest";
import {
  computeGate2RankBreakdown,
  formatGate2RankBreakdownLines,
} from "./rank-components";
import { computeGate2RankScore } from "./breakout-pullback";

describe("computeGate2RankBreakdown", () => {
  const params = {
    volRatio: 2.1,
    close: 210,
    breakoutLevel: 200,
    ma50: 190,
    minLowSinceBreakout: 198,
  };

  it("matches legacy computeGate2RankScore exactly", () => {
    const breakdown = computeGate2RankBreakdown(params);
    const legacy = computeGate2RankScore(params);
    expect(breakdown.rankScore).toBe(legacy);
  });

  it("reconciles rankScore from component sum", () => {
    const b = computeGate2RankBreakdown(params);
    const sum = b.volumeTerm + b.extensionTerm + b.maDistanceTerm - b.depthPenalty;
    expect(b.rankScore).toBe(sum);
  });

  it("formats human-readable breakdown lines", () => {
    const b = computeGate2RankBreakdown(params);
    const lines = formatGate2RankBreakdownLines(b);
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/Rank score/);
    expect(lines[1]).toMatch(/Inputs:/);
  });
});
