import { describe, expect, it } from "vitest";
import {
  buildSetupReason,
  buildSetupStateLabel,
  rsStrengthLabelFromRs20,
} from "./rs-setup-labels";

describe("rs-setup-labels", () => {
  it("maps terminal codes to reason-first setup states", () => {
    expect(buildSetupStateLabel("pullback_zone_interaction")).toBe("Blocked: zone");
    expect(buildSetupStateLabel("breakout_recency")).toBe("Watch: breakout");
    expect(buildSetupStateLabel("trend_below_ma50")).toBe("Blocked: MA50");
  });

  it("assigns RS strength labels from RS20 thresholds only", () => {
    expect(rsStrengthLabelFromRs20(15)).toBe("Strong RS");
    expect(rsStrengthLabelFromRs20(14.9)).toBe("Positive RS");
    expect(rsStrengthLabelFromRs20(5)).toBe("Positive RS");
    expect(rsStrengthLabelFromRs20(2)).toBe("Mild RS");
  });

  it("returns terminal-specific setup reasons", () => {
    const reason = buildSetupReason({
      symbol: "VND",
      sessionDate: "2026-05-28",
      rs20SpreadPct: 11.6,
      rs50SpreadPct: -0.2,
      terminalCode: "pullback_zone_interaction",
      failedGate2Because: "Failed Gate 2 because: Not in pullback entry zone",
      topRejectionReason: "Trend OK",
      stageRank: 58,
      distanceToPullbackZoneFrac: 0.02,
      actionHint: "",
      disclaimerLines: [],
      rsDiagnostic: null,
    });
    expect(reason).toBe("Not in pullback entry zone");
    expect(reason).not.toMatch(/Blocked/i);
  });
});
