import { describe, expect, it } from "vitest";
import { humanizeDisplayLine, reasonsToStrings } from "./setups-shared-helpers";

const FORBIDDEN = [
  "Failed Gate 2 because",
  "SetupCandidate",
  "rankScore",
  "diagnostic only",
  "not used in current",
  "breakout_recency",
];

describe("setups-shared-helpers humanized copy", () => {
  it("reasonsToStrings does not leak raw scanner phrases", () => {
    const lines = reasonsToStrings([
      "Failed Gate 2 because: No recent breakout (breakout_recency)",
    ]);
    const joined = lines.join(" ");
    for (const phrase of FORBIDDEN) {
      expect(joined).not.toMatch(new RegExp(phrase, "i"));
    }
    expect(joined).toMatch(/not ready/i);
  });

  it("humanizeDisplayLine formats gate failures for traders", () => {
    const out = humanizeDisplayLine(
      "Failed Gate 2 because: No recent breakout (breakout_recency)"
    );
    expect(out).toMatch(/not ready/i);
    expect(out).not.toMatch(/breakout_recency/i);
  });
});
