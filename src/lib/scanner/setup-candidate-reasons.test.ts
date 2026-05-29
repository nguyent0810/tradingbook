import { describe, expect, it } from "vitest";
import {
  parseSetupCandidateReasons,
  serializeSetupCandidateReasons,
} from "./setup-candidate-reasons";
import { computeGate2RankBreakdown } from "./gate2/rank-components";

describe("setup-candidate-reasons", () => {
  it("parses legacy string array", () => {
    const parsed = parseSetupCandidateReasons(["line one", "line two"]);
    expect(parsed.lines).toEqual(["line one", "line two"]);
    expect(parsed.rankComponents).toBeNull();
  });

  it("round-trips v1 payload with rank components", () => {
    const breakdown = computeGate2RankBreakdown({
      volRatio: 1.8,
      close: 105,
      breakoutLevel: 100,
      ma50: 95,
      minLowSinceBreakout: 99,
    });
    const serialized = serializeSetupCandidateReasons(["Tier A — strong"], breakdown);
    const parsed = parseSetupCandidateReasons(serialized);
    expect(parsed.lines).toEqual(["Tier A — strong"]);
    expect(parsed.rankComponents?.rankScore).toBe(breakdown.rankScore);
  });

  it("serializes without object wrapper when no rank components", () => {
    const serialized = serializeSetupCandidateReasons(["only lines"]);
    expect(Array.isArray(serialized)).toBe(true);
    expect(serialized).toEqual(["only lines"]);
  });
});
