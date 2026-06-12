import { describe, expect, it } from "vitest";
import type { RadarNode } from "./types";
import {
  RADAR_DOMAIN_PAD,
  clampRadarDomain,
  clampRadarPixel,
  toRadarPlotPoint,
} from "./radar-plot-utils";

const highRiskNode: RadarNode = {
  symbol: "VJC",
  readiness: 22,
  risk: 88,
  classification: "avoid",
  tier: "Rejected",
  reason: "Extension cap",
  sparkline: [48, 44, 38, 32, 28],
};

describe("radar plot utils", () => {
  it("clamps domain values inside padding band", () => {
    expect(clampRadarDomain(88)).toBe(100 - RADAR_DOMAIN_PAD);
    expect(clampRadarDomain(5)).toBe(RADAR_DOMAIN_PAD);
    expect(clampRadarDomain(50)).toBe(50);
  });

  it("clamps pixel coordinates with dot padding", () => {
    expect(clampRadarPixel(4, 0, 400, 30)).toBe(30);
    expect(clampRadarPixel(396, 0, 400, 30)).toBe(370);
  });

  it("keeps logical readiness/risk on node while plotting clamped coords", () => {
    const plot = toRadarPlotPoint(highRiskNode);
    expect(plot.risk).toBe(88);
    expect(plot.readiness).toBe(22);
    expect(plot.riskPlot).toBeLessThanOrEqual(100 - RADAR_DOMAIN_PAD);
    expect(plot.readinessPlot).toBeGreaterThanOrEqual(RADAR_DOMAIN_PAD);
  });
});
