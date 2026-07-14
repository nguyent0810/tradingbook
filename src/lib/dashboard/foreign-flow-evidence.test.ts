import { describe, expect, it } from "vitest";
import {
  computeRollingForeignFlowDangerVnd,
  FOREIGN_FLOW_DANGER_VND,
  FOREIGN_FLOW_MIN_HISTORY_SESSIONS,
  FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS,
  foreignFlowEvidenceState,
} from "./foreign-flow-evidence";

describe("computeRollingForeignFlowDangerVnd", () => {
  it("returns null with fewer than the minimum history sessions", () => {
    const short = Array.from({ length: FOREIGN_FLOW_MIN_HISTORY_SESSIONS - 1 }, () => -1_000_000);
    expect(computeRollingForeignFlowDangerVnd(short)).toBeNull();
  });

  it("computes the 10th percentile of the trailing window once enough history exists", () => {
    // 30 values ascending from -30 to -1 (all negative, evenly spaced) — 10th
    // percentile (floor(30*0.1)=3rd index, 0-based) of the sorted ascending array.
    const values = Array.from({ length: 30 }, (_, i) => -(30 - i)); // -30..-1
    const result = computeRollingForeignFlowDangerVnd(values);
    const sorted = [...values].sort((a, b) => a - b);
    const expectedIdx = Math.floor(sorted.length * 0.1);
    expect(result).toBe(sorted[expectedIdx]);
  });

  it("only considers the trailing window, not older history", () => {
    const old = Array.from({ length: 50 }, () => -1_000_000_000_000); // very negative, old
    const recent = Array.from({ length: FOREIGN_FLOW_ROLLING_WINDOW_SESSIONS }, () => -1_000);
    const combined = [...old, ...recent];
    const result = computeRollingForeignFlowDangerVnd(combined);
    // Result should reflect only the recent (mild) window, not the old extreme values.
    expect(result).toBeGreaterThan(-1_000_000);
  });
});

describe("foreignFlowEvidenceState — absolute floor + rolling percentile", () => {
  it("absolute floor still triggers danger even with no rolling threshold available", () => {
    expect(foreignFlowEvidenceState(FOREIGN_FLOW_DANGER_VND - 1)).toBe("danger");
    expect(foreignFlowEvidenceState(FOREIGN_FLOW_DANGER_VND - 1, null)).toBe("danger");
  });

  it("rolling threshold can trigger danger even above the absolute floor", () => {
    const rollingThreshold = -50_000_000_000; // milder than the absolute floor
    expect(foreignFlowEvidenceState(-60_000_000_000, rollingThreshold)).toBe("danger");
    expect(foreignFlowEvidenceState(-40_000_000_000, rollingThreshold)).toBe("warn");
  });

  it("absolute floor cannot be bypassed by a very negative rolling threshold during a prolonged sell-off", () => {
    // Simulates a long sell-off: rolling 10th percentile itself has drifted
    // very negative, but a session at/below the absolute floor must still be "danger".
    const deeplyNegativeRollingThreshold = -900_000_000_000;
    expect(
      foreignFlowEvidenceState(FOREIGN_FLOW_DANGER_VND - 1, deeplyNegativeRollingThreshold)
    ).toBe("danger");
  });

  it("still ok/warn/danger correctly with no rolling threshold (backward compatible)", () => {
    expect(foreignFlowEvidenceState(100)).toBe("ok");
    expect(foreignFlowEvidenceState(-1)).toBe("warn");
    expect(foreignFlowEvidenceState(null)).toBe("ok");
  });
});
