import { afterEach, describe, expect, it } from "vitest";
import { computeGate2RankBreakdown } from "./rank-components";
import {
  buildGate2RankWithRsPreview,
  compareGate2RankOrdering,
  computeRelativeStrengthRankTerm,
  effectiveGate2RankScore,
  GATE2_RS_RANK_TERM_CAP,
  GATE2_RS_RANK_TERM_MULTIPLIER,
  isGate2RsRankTermEnabled,
} from "./rs-rank-term";

describe("computeRelativeStrengthRankTerm", () => {
  it("adds capped bonus for positive RS20", () => {
    expect(computeRelativeStrengthRankTerm(4)).toBe(4 * GATE2_RS_RANK_TERM_MULTIPLIER);
    expect(computeRelativeStrengthRankTerm(20)).toBe(GATE2_RS_RANK_TERM_CAP);
  });

  it("adds capped penalty for negative RS20", () => {
    expect(computeRelativeStrengthRankTerm(-4)).toBe(-4 * GATE2_RS_RANK_TERM_MULTIPLIER);
    expect(computeRelativeStrengthRankTerm(-20)).toBe(-GATE2_RS_RANK_TERM_CAP);
  });

  it("returns 0 for neutral or missing RS20", () => {
    expect(computeRelativeStrengthRankTerm(0)).toBe(0);
    expect(computeRelativeStrengthRankTerm(null)).toBe(0);
    expect(computeRelativeStrengthRankTerm(undefined)).toBe(0);
  });
});

describe("buildGate2RankWithRsPreview", () => {
  it("rankScoreWithRs equals base + rsTerm", () => {
    const p = buildGate2RankWithRsPreview(2100, 3.08);
    expect(p.rankScoreBase).toBe(2100);
    expect(p.rsTerm).toBeCloseTo(3.08 * GATE2_RS_RANK_TERM_MULTIPLIER, 5);
    expect(p.rankScoreWithRs).toBe(p.rankScoreBase + p.rsTerm);
  });
});

describe("effectiveGate2RankScore — default production", () => {
  const prev = process.env.GATE2_RS_RANK_TERM_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.GATE2_RS_RANK_TERM_ENABLED;
    else process.env.GATE2_RS_RANK_TERM_ENABLED = prev;
  });

  it("returns base score when env flag is unset", () => {
    delete process.env.GATE2_RS_RANK_TERM_ENABLED;
    expect(isGate2RsRankTermEnabled()).toBe(false);
    expect(effectiveGate2RankScore(1500, 5)).toBe(1500);
  });

  it("includes RS term only when env enabled or forced", () => {
    process.env.GATE2_RS_RANK_TERM_ENABLED = "true";
    expect(effectiveGate2RankScore(1500, 5)).toBe(1500 + 125);
    delete process.env.GATE2_RS_RANK_TERM_ENABLED;
    expect(effectiveGate2RankScore(1500, 5, { forceIncludeRsTerm: true })).toBe(1625);
  });
});

describe("compareGate2RankOrdering", () => {
  it("promotes higher RS when RS-adjusted score overtakes", () => {
    const cmp = compareGate2RankOrdering([
      { symbol: "ZZZ", rankScoreBase: 1100, rs20SpreadPct: -2 },
      { symbol: "AAA", rankScoreBase: 1000, rs20SpreadPct: 10 },
    ]);
    expect(cmp.entries.find((e) => e.symbol === "AAA")!.rsAdjustedRank).toBe(1);
    expect(cmp.promoted.some((p) => p.symbol === "AAA")).toBe(true);
  });
});

describe("Gate 2 quality unchanged by RS term", () => {
  it("evaluateBreakoutPullbackCandidate rankScore matches breakdown without RS", () => {
    const params = {
      volRatio: 2.1,
      close: 210,
      breakoutLevel: 200,
      ma50: 190,
      minLowSinceBreakout: 198,
    };
    const base = computeGate2RankBreakdown(params).rankScore;
    const preview = buildGate2RankWithRsPreview(base, 10);
    expect(preview.rankScoreBase).toBe(base);
    expect(preview.rankScoreWithRs).not.toBe(base);
  });
});
