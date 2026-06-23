import { describe, expect, it } from "vitest";
import { dedupeRadarNodes } from "./map-dashboard-v3-to-command-deck";
import type { RadarNode, RelativeStrengthRow } from "./types";
import {
  PLOT_RISK_MAX,
  RADAR_BUBBLE_RADIUS_MAX,
  RADAR_BUBBLE_RADIUS_MIN,
  applyPercentileSpread,
  bubbleRadiusFromNode,
  clampPlotRisk,
  countOverlappingPairs,
  formatRadarWorkbenchTooltip,
  isRadarBubbleInsideBounds,
  layoutRadarBubbles,
  prepareRadarChartData,
  resolveRadarCollisions,
  selectRadarLabelSymbols,
  shouldShowRadarLabel,
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

const WORKBENCH_ROW: RelativeStrengthRow = {
  symbol: "BVB",
  rs20: 13.7,
  rs50: 2.1,
  rsStrength: "Strong RS",
  setupState: "Blocked: zone",
  reason: "Not in zone",
  status: "blocked",
  rsStrengthScore: null,
  setupReadinessScore: null,
  terminalCode: "pullback_zone_interaction",
  sectorLabel: "Bank",
  actionLabel: "Wait",
  earlyEntry: {
    earlyReversalScore: 28,
    proposedTradeState: "Extended — Do Not Chase",
    entryType: "pilot",
    reasonCodes: ["EXTENDED_FROM_MA20"],
    transitionReasonCodes: [],
    invalidLevel: 11,
    invalidLevelReason: null,
    stopDistancePct: 4,
    targetPrice: 14,
    targetReason: null,
    estimatedRewardPct: 2,
    estimatedRiskReward: 0.3,
    suggestedPilotSizePct: 0,
    sizingNote: null,
    whyNotPilotYet: null,
    rrRejectionReason: null,
    distFromMa20Pct: 7.2,
  },
};

function clusteredNodes(): RadarNode[] {
  return [
    { ...vjcAvoid, symbol: "A", readiness: 52, risk: 55, classification: "watch" },
    { ...vjcAvoid, symbol: "B", readiness: 54, risk: 53, classification: "watch" },
    { ...vjcAvoid, symbol: "C", readiness: 51, risk: 56, classification: "watch" },
    { ...vjcAvoid, symbol: "D", readiness: 53, risk: 54, classification: "watch" },
  ];
}

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

  it("keeps high-risk avoid bubble inside square plot bounds", () => {
    const plot = toRadarPlotPoint(vjcAvoid);
    expect(
      isRadarBubbleInsideBounds(plot.plotReadiness, plot.plotRisk, 352, 352)
    ).toBe(true);
  });

  it("caps extreme risk for visual positioning only", () => {
    expect(clampPlotRisk(88)).toBe(PLOT_RISK_MAX);
    expect(clampPlotRisk(95)).toBe(PLOT_RISK_MAX);
    expect(clampPlotRisk(40)).toBe(40);
  });

  it("clamps bubble radius to compact range with sqrt scaling", () => {
    const low = toRadarPlotPoint({ ...vjcAvoid, readiness: 10, risk: 40 });
    const high = toRadarPlotPoint({ ...vjcAvoid, readiness: 95, risk: 40 });
    const lowR = bubbleRadiusFromNode(low, { mini: true });
    const highR = bubbleRadiusFromNode(high, { mini: true });
    expect(lowR).toBeGreaterThanOrEqual(RADAR_BUBBLE_RADIUS_MIN);
    expect(highR).toBeLessThanOrEqual(RADAR_BUBBLE_RADIUS_MAX);
    expect(highR).toBeGreaterThan(lowR);
  });

  it("spreads clustered coordinates across the safe plot band", () => {
    const spread = applyPercentileSpread(prepareRadarChartData(clusteredNodes()));
    const readinessSpan =
      Math.max(...spread.map((p) => p.layoutReadiness)) -
      Math.min(...spread.map((p) => p.layoutReadiness));
    expect(readinessSpan).toBeGreaterThan(8);
  });

  it("reduces overlapping pairs after collision resolution", () => {
    const points = prepareRadarChartData(clusteredNodes());
    const entries = points.map((p) => ({
      symbol: p.symbol,
      layoutReadiness: 50,
      layoutRisk: 50,
      pixelX: 160,
      pixelY: 160,
      radius: bubbleRadiusFromNode(p, { mini: true }),
    }));
    const before = countOverlappingPairs(entries);
    const after = countOverlappingPairs(resolveRadarCollisions(entries, 320, 320));
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it("preserves real symbols in layout map", () => {
    const layout = layoutRadarBubbles(prepareRadarChartData(clusteredNodes()), 320, 320, {
      mini: true,
    });
    expect([...layout.keys()].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("shows labels only for top nodes, hover, and selection in mini mode", () => {
    const points = prepareRadarChartData(clusteredNodes());
    const labels = selectRadarLabelSymbols(points, {
      maxLabels: 2,
      hovered: "C",
      selected: null,
    });
    expect(labels.has("C")).toBe(true);
    expect(labels.size).toBeLessThanOrEqual(3);
    expect(shouldShowRadarLabel("C", labels, false, true)).toBe(true);
    expect(shouldShowRadarLabel("A", labels, false, true)).toBe(
      labels.has("A")
    );
  });

  it("formats compact workbench tooltip without sample wording", () => {
    const tip = formatRadarWorkbenchTooltip(WORKBENCH_ROW);
    expect(tip.symbol).toBe("BVB");
    expect(tip.state).toBe("Too Extended");
    expect(tip.metrics).toContain("RS20 +13.7pp");
    expect(tip.metrics).toContain("R:R 0.30:1");
    expect(tip.action).toBe("Avoid chase");
    expect(JSON.stringify(tip)).not.toContain("Blocked sample");
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
