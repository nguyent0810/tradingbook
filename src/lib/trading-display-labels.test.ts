import { describe, expect, it } from "vitest";
import {
  displayClosestExecutionStatus,
  displayNearMissDiagnosticStatus,
  nearMissDiagnosticActionHint,
  displayGate1ScanLevel,
  displayMomentumLabel,
  displayMomentumRiskAnnotation,
  displayScanSetupTypeKey,
  displayTradeDirection,
  displayTradeStatus,
  displayUniverseSource,
} from "./trading-display-labels";

describe("trading-display-labels", () => {
  it("maps playbook/setup keys", () => {
    expect(displayScanSetupTypeKey("BREAKOUT_PULLBACK")).toBe("Breakout pullback");
  });

  it("maps proximity statuses", () => {
    expect(displayClosestExecutionStatus("READY")).toBe("At entry zone");
    expect(displayClosestExecutionStatus("WAIT")).toBe("Waiting for pullback");
    expect(displayClosestExecutionStatus("INVALID")).toBe("Structure invalid");
  });

  it("maps near-miss diagnostics without actionable READY wording", () => {
    expect(displayNearMissDiagnosticStatus("READY")).toMatch(/diagnostic/i);
    expect(displayNearMissDiagnosticStatus("READY")).not.toBe("At entry zone");
    expect(nearMissDiagnosticActionHint("READY")).toMatch(/not a trade signal/i);
  });

  it("maps momentum audit labels and risks", () => {
    expect(displayMomentumLabel("FRESH_BREAKOUT")).toBe("Fresh breakout");
    expect(displayMomentumRiskAnnotation("STOP_FAR")).toBe("Stop too far");
  });

  it("maps regime, universe, and trade enums", () => {
    expect(displayGate1ScanLevel("PASS")).toBe("Favorable");
    expect(displayUniverseSource("CORE")).toBe("Primary universe");
    expect(displayTradeStatus("OPEN")).toBe("Active");
    expect(displayTradeDirection("SHORT")).toBe("Short bias");
  });
});
