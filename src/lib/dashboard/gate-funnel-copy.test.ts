import { describe, expect, it } from "vitest";
import {
  buildVerdictUxCopy,
  computeGateFunnelSnapshot,
  formatGateFunnelSummaryLine,
} from "./gate-funnel-copy";

describe("computeGateFunnelSnapshot", () => {
  it("PASS surfaces A then B up to candidateCountSurfaced", () => {
    const f = computeGateFunnelSnapshot(
      { candidateCountA: 2, candidateCountB: 3, candidateCountSurfaced: 4 },
      "PASS"
    );
    expect(f.surfacedCountA).toBe(2);
    expect(f.surfacedCountB).toBe(2);
    expect(f.suppressedCountB).toBe(1);
  });

  it("WARNING surfaces Tier A only — Tier B is pre-regime hidden", () => {
    const f = computeGateFunnelSnapshot(
      { candidateCountA: 1, candidateCountB: 2, candidateCountSurfaced: 1 },
      "WARNING"
    );
    expect(f.surfacedCountA).toBe(1);
    expect(f.surfacedCountB).toBe(0);
    expect(f.suppressedCountB).toBe(2);
    expect(f.qualifiedCountB).toBe(2);
  });

  it("FAIL shows zero surfaced but preserves qualified counts", () => {
    const f = computeGateFunnelSnapshot(
      { candidateCountA: 2, candidateCountB: 1, candidateCountSurfaced: 0 },
      "FAIL"
    );
    expect(f.surfacedTotal).toBe(0);
    expect(f.qualifiedTotal).toBe(3);
    expect(f.suppressedTotal).toBe(3);
  });
});

describe("formatGateFunnelSummaryLine", () => {
  it("mentions suppression when Tier B hidden", () => {
    const line = formatGateFunnelSummaryLine(
      computeGateFunnelSnapshot(
        { candidateCountA: 1, candidateCountB: 2, candidateCountSurfaced: 1 },
        "WARNING"
      )
    );
    expect(line).toMatch(/pre-regime/i);
    expect(line).toMatch(/Suppressed by Gate 1/i);
    expect(line).toMatch(/Tier B/);
  });
});

describe("buildVerdictUxCopy", () => {
  it("TRADE MODE clarifies normal risk, not guaranteed entries", () => {
    const copy = buildVerdictUxCopy({
      uxLevel: "TRADE",
      persistedLevel: "NORMAL",
      gate1: "PASS",
      funnel: computeGateFunnelSnapshot(
        { candidateCountA: 1, candidateCountB: 0, candidateCountSurfaced: 1 },
        "PASS"
      ),
    });
    expect(copy.headline).toBe("TRADE MODE");
    expect(copy.subtitle).toMatch(/not an automatic instruction/i);
    expect(copy.persistedLevelNote).toMatch(/NORMAL/);
  });
});
