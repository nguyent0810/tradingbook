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
      "Trượt Gate 2 vì: Chưa có breakout gần đây (breakout_recency)",
    ]);
    const joined = lines.join(" ");
    for (const phrase of FORBIDDEN) {
      expect(joined).not.toMatch(new RegExp(phrase, "i"));
    }
    expect(joined).toMatch(/chưa sẵn sàng/i);
  });

  it("humanizeDisplayLine formats gate failures for traders", () => {
    const out = humanizeDisplayLine(
      "Trượt Gate 2 vì: Chưa có breakout gần đây (breakout_recency)"
    );
    expect(out).toMatch(/chưa sẵn sàng/i);
    expect(out).not.toMatch(/breakout_recency/i);
  });
});
