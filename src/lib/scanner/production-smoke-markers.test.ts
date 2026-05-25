import { describe, expect, it } from "vitest";
import {
  isSmokeDailyScanRunNotes,
  isSmokeProductionSymbol,
  isSmokeSetupCandidateRow,
} from "./production-smoke-markers";

describe("production-smoke-markers", () => {
  it("detects P0D scan run notes", () => {
    expect(isSmokeDailyScanRunNotes({ p0dExitHealthSmoke: true })).toBe(true);
    expect(isSmokeDailyScanRunNotes({ demoSeed: true })).toBe(true);
    expect(isSmokeDailyScanRunNotes({ decision: { level: "NO_TRADE" } })).toBe(
      false
    );
  });

  it("detects smoke symbols and reasons", () => {
    expect(isSmokeProductionSymbol("p0dexit")).toBe(true);
    expect(isSmokeSetupCandidateRow({
      symbol: "VNM",
      reasons: ["P0D_EXIT_HEALTH_SMOKE setup candidate"],
    })).toBe(true);
    expect(isSmokeSetupCandidateRow({ symbol: "VNM", reasons: ["breakout"] })).toBe(
      false
    );
  });
});
