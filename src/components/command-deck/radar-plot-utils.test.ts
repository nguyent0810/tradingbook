import { describe, expect, it } from "vitest";
import { dedupeRadarNodes } from "./map-dashboard-v3-to-command-deck";
import type { RadarNode } from "./types";
import {
  PLOT_RISK_MAX,
  clampPlotRisk,
  isRadarBubbleInsideBounds,
  toRadarPlotPoint,
} from "./radar-plot-utils";

const vjcAvoid: RadarNode = {
  symbol: "VJC",
  readiness: 22,
  risk: 88,
  classification: "avoid",
  tier: "Rejected",
  reason: "Extension cap",
  sparkline: [48, 44, 38, 32, 28],
};

describe("radar plot utils", () => {
  it("keeps logical readiness/risk while using separate visual plot coords", () => {
    const plot = toRadarPlotPoint(vjcAvoid);
    expect(plot.readiness).toBe(22);
    expect(plot.risk).toBe(88);
    expect(plot.plotReadiness).toBe(22);
    expect(plot.plotRisk).toBe(PLOT_RISK_MAX);
  });

  it("keeps high-risk avoid node bubble inside chart bounds", () => {
    const plot = toRadarPlotPoint(vjcAvoid);
    expect(
      isRadarBubbleInsideBounds(plot.plotReadiness, plot.plotRisk, 520, 320)
    ).toBe(true);
  });

  it("caps extreme risk for visual positioning only", () => {
    expect(clampPlotRisk(88)).toBe(86);
    expect(clampPlotRisk(95)).toBe(86);
    expect(clampPlotRisk(40)).toBe(40);
  });
});

describe("radar dedupe regression", () => {
  it("renders VJC once as avoid when duplicated in watch and rejected lists", () => {
    const nodes: RadarNode[] = [
      { ...vjcAvoid, classification: "watch", tier: "Near miss" },
      vjcAvoid,
    ];
    const merged = dedupeRadarNodes(nodes);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.symbol).toBe("VJC");
    expect(merged[0]?.classification).toBe("avoid");
    expect(toRadarPlotPoint(merged[0]!).plotRisk).toBe(PLOT_RISK_MAX);
    expect(isRadarBubbleInsideBounds(22, PLOT_RISK_MAX, 520, 320)).toBe(true);
  });
});
