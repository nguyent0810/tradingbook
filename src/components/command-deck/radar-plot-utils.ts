import type { RadarNode } from "./types";

/** Domain padding so scatter dots + labels stay inside the chart area. */
export const RADAR_DOMAIN_PAD = 14;

export function clampRadarDomain(value: number, pad = RADAR_DOMAIN_PAD): number {
  return Math.min(100 - pad, Math.max(pad, value));
}

export type RadarPlotPoint = RadarNode & {
  readinessPlot: number;
  riskPlot: number;
  z: number;
};

export function toRadarPlotPoint(node: RadarNode): RadarPlotPoint {
  return {
    ...node,
    readinessPlot: clampRadarDomain(node.readiness),
    riskPlot: clampRadarDomain(node.risk),
    z: node.classification === "avoid" ? 140 : node.classification === "watch" ? 110 : 90,
  };
}

export function clampRadarPixel(
  value: number,
  min: number,
  max: number,
  pad: number
): number {
  return Math.min(max - pad, Math.max(min + pad, value));
}
