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
    expect(displayScanSetupTypeKey("BREAKOUT_PULLBACK")).toBe("Breakout-pullback");
  });

  it("maps proximity statuses", () => {
    expect(displayClosestExecutionStatus("READY")).toBe("Tại vùng vào lệnh");
    expect(displayClosestExecutionStatus("WAIT")).toBe("Đang chờ pullback");
    expect(displayClosestExecutionStatus("INVALID")).toBe("Cấu trúc không hợp lệ");
  });

  it("maps near-miss diagnostics without actionable READY wording", () => {
    expect(displayNearMissDiagnosticStatus("READY")).toMatch(/chẩn đoán/i);
    expect(displayNearMissDiagnosticStatus("READY")).not.toBe(displayClosestExecutionStatus("READY"));
    expect(nearMissDiagnosticActionHint("READY")).toMatch(/không phải tín hiệu giao dịch/i);
  });

  it("maps momentum audit labels and risks", () => {
    expect(displayMomentumLabel("FRESH_BREAKOUT")).toBe("Breakout mới");
    expect(displayMomentumRiskAnnotation("STOP_FAR")).toBe("Dừng lỗ quá xa");
  });

  it("maps regime, universe, and trade enums", () => {
    expect(displayGate1ScanLevel("PASS")).toBe("Favorable");
    expect(displayUniverseSource("CORE")).toBe("Vũ trụ chính");
    expect(displayTradeStatus("OPEN")).toBe("Đang mở");
    expect(displayTradeDirection("SHORT")).toBe("Thiên hướng bán");
  });
});
