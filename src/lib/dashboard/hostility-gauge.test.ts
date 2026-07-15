import { describe, expect, it } from "vitest";
import { resolveHostilityGauge } from "./hostility-gauge";

describe("resolveHostilityGauge", () => {
  it("maps PASS to the calm zone, low score", () => {
    const g = resolveHostilityGauge("PASS");
    expect(g.tone).toBe("calm");
    expect(g.label).toBe("Calm");
    expect(g.score).toBeLessThan(40);
  });

  it("maps WARNING to the caution zone, mid score", () => {
    const g = resolveHostilityGauge("WARNING");
    expect(g.tone).toBe("caution");
    expect(g.label).toBe("Caution");
    expect(g.score).toBeGreaterThanOrEqual(40);
    expect(g.score).toBeLessThan(70);
  });

  it("maps FAIL to the hostile zone, high score", () => {
    const g = resolveHostilityGauge("FAIL");
    expect(g.tone).toBe("hostile");
    expect(g.label).toBe("Hostile");
    expect(g.score).toBeGreaterThanOrEqual(70);
  });

  it("score is always within the 0-100 dial range", () => {
    for (const level of ["PASS", "WARNING", "FAIL"] as const) {
      const g = resolveHostilityGauge(level);
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(100);
    }
  });
});
