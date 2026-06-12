import type { RadarNode } from "./types";

/** Visual-only readiness band — logical values unchanged in tooltip. */
export const PLOT_READINESS_MIN = 6;
export const PLOT_READINESS_MAX = 94;

/** Visual-only risk band — keeps high-risk dots off the top edge (Y domain 100→0). */
export const PLOT_RISK_MIN = 6;
export const PLOT_RISK_MAX = 86;

export const RADAR_CHART_MARGIN = { top: 32, right: 28, bottom: 12, left: 32 };
export const RADAR_BUBBLE_OUTER_RADIUS = 28;

export function clampPlotReadiness(readiness: number): number {
  return Math.min(PLOT_READINESS_MAX, Math.max(PLOT_READINESS_MIN, readiness));
}

export function clampPlotRisk(risk: number): number {
  return Math.min(PLOT_RISK_MAX, Math.max(PLOT_RISK_MIN, risk));
}

export type RadarPlotPoint = RadarNode & {
  plotReadiness: number;
  plotRisk: number;
  z: number;
};

export function toRadarPlotPoint(node: RadarNode): RadarPlotPoint {
  return {
    ...node,
    plotReadiness: clampPlotReadiness(node.readiness),
    plotRisk: clampPlotRisk(node.risk),
    z: node.classification === "avoid" ? 140 : node.classification === "watch" ? 110 : 90,
  };
}

/** Map visual plot coords to scatter pixel space (Y axis domain [100, 0]). */
export function radarPlotToPixel(
  plotReadiness: number,
  plotRisk: number,
  chartWidth: number,
  chartHeight: number,
  margin = RADAR_CHART_MARGIN
): { cx: number; cy: number } {
  const plotW = chartWidth - margin.left - margin.right;
  const plotH = chartHeight - margin.top - margin.bottom;
  const cx = margin.left + (plotReadiness / 100) * plotW;
  const cy = margin.top + ((100 - plotRisk) / 100) * plotH;
  return { cx, cy };
}

export function clampRadarBubblePosition(
  cx: number,
  cy: number,
  chartWidth: number,
  chartHeight: number,
  bubbleRadius = RADAR_BUBBLE_OUTER_RADIUS,
  margin = RADAR_CHART_MARGIN
): { x: number; y: number } {
  const pad = bubbleRadius + 8;
  const minX = margin.left + pad;
  const maxX = chartWidth - margin.right - pad;
  const minY = margin.top + pad;
  const maxY = chartHeight - margin.bottom - pad;
  return {
    x: Math.min(maxX, Math.max(minX, cx)),
    y: Math.min(maxY, Math.max(minY, cy)),
  };
}

export function isRadarBubbleInsideBounds(
  plotReadiness: number,
  plotRisk: number,
  chartWidth: number,
  chartHeight: number,
  bubbleRadius = RADAR_BUBBLE_OUTER_RADIUS,
  margin = RADAR_CHART_MARGIN
): boolean {
  const { cx, cy } = radarPlotToPixel(plotReadiness, plotRisk, chartWidth, chartHeight, margin);
  const { x, y } = clampRadarBubblePosition(
    cx,
    cy,
    chartWidth,
    chartHeight,
    bubbleRadius,
    margin
  );
  const pad = bubbleRadius + 8;
  const minX = margin.left + pad;
  const maxX = chartWidth - margin.right - pad;
  const minY = margin.top + pad;
  const maxY = chartHeight - margin.bottom - pad;

  return (
    x >= minX &&
    x <= maxX &&
    y >= minY &&
    y <= maxY &&
    x - bubbleRadius >= margin.left &&
    x + bubbleRadius <= chartWidth - margin.right &&
    y - bubbleRadius >= margin.top &&
    y + bubbleRadius <= chartHeight - margin.bottom
  );
}
