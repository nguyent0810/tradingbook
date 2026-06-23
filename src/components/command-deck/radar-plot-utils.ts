import type { RelativeStrengthRow } from "./types";
import type { RadarNode } from "./types";
import {
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  workbenchActionLabel,
} from "@/lib/dashboard/rs-status-display";

/** Visual-only readiness band — logical values unchanged in tooltip. */
export const PLOT_READINESS_MIN = 8;
export const PLOT_READINESS_MAX = 92;

/** Visual-only risk band — keeps high-risk dots off the top edge (Y domain 100→0). */
export const PLOT_RISK_MIN = 8;
export const PLOT_RISK_MAX = 84;

/** Extra inset so nodes stay off the chart border in compact panels. */
export const RADAR_PLOT_INNER_PAD = 10;

export const RADAR_CHART_MARGIN = { top: 28, right: 24, bottom: 10, left: 28 };
export const RADAR_BUBBLE_OUTER_RADIUS = 22;

export const RADAR_BUBBLE_RADIUS_MIN = 10;
export const RADAR_BUBBLE_RADIUS_MAX = 22;
export const RADAR_BUBBLE_RADIUS_ACTIVE = 24;

export function clampPlotReadiness(readiness: number): number {
  return Math.min(PLOT_READINESS_MAX, Math.max(PLOT_READINESS_MIN, readiness));
}

export function clampPlotRisk(risk: number): number {
  return Math.min(PLOT_RISK_MAX, Math.max(PLOT_RISK_MIN, risk));
}

export type RadarPlotPoint = RadarNode & {
  plotReadiness: number;
  plotRisk: number;
  layoutReadiness: number;
  layoutRisk: number;
  z: number;
};

export function toRadarPlotPoint(node: RadarNode): RadarPlotPoint {
  const plotReadiness = clampPlotReadiness(node.readiness);
  const plotRisk = clampPlotRisk(node.risk);
  return {
    ...node,
    plotReadiness,
    plotRisk,
    layoutReadiness: plotReadiness,
    layoutRisk: plotRisk,
    z: node.classification === "avoid" ? 140 : node.classification === "watch" ? 110 : 90,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 50;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function spreadValue(
  value: number,
  values: number[],
  targetMin: number,
  targetMax: number
): number {
  if (values.length <= 1) {
    return (targetMin + targetMax) / 2;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const pLo = percentile(sorted, 0.12);
  const pHi = percentile(sorted, 0.88);
  const span = pHi - pLo;
  if (span < 2) {
    const idx = values.indexOf(value);
    const t = values.length <= 1 ? 0.5 : idx / Math.max(1, values.length - 1);
    return targetMin + t * (targetMax - targetMin);
  }
  const t = (value - pLo) / span;
  const clamped = Math.max(0, Math.min(1, t));
  return targetMin + clamped * (targetMax - targetMin);
}

/** Percentile-based spread so clustered nodes use the square plot more evenly. */
export function applyPercentileSpread(points: readonly RadarPlotPoint[]): RadarPlotPoint[] {
  if (points.length === 0) return [];
  const readinessValues = points.map((p) => p.plotReadiness);
  const riskValues = points.map((p) => p.plotRisk);
  const rMin = PLOT_READINESS_MIN + RADAR_PLOT_INNER_PAD;
  const rMax = PLOT_READINESS_MAX - RADAR_PLOT_INNER_PAD;
  const kMin = PLOT_RISK_MIN + RADAR_PLOT_INNER_PAD;
  const kMax = PLOT_RISK_MAX - RADAR_PLOT_INNER_PAD;

  return points.map((p) => ({
    ...p,
    layoutReadiness: spreadValue(p.plotReadiness, readinessValues, rMin, rMax),
    layoutRisk: spreadValue(p.plotRisk, riskValues, kMin, kMax),
  }));
}

/** Soft sqrt scaling — preserves relative importance without oversized bubbles. */
export function bubbleRadiusFromNode(
  point: RadarPlotPoint,
  options: { mini?: boolean; active?: boolean } = {}
): number {
  const minR = options.mini ? RADAR_BUBBLE_RADIUS_MIN : RADAR_BUBBLE_RADIUS_MIN + 1;
  const maxR = options.active ? RADAR_BUBBLE_RADIUS_ACTIVE : RADAR_BUBBLE_RADIUS_MAX;
  const classWeight =
    point.classification === "avoid" ? 1.08 : point.classification === "actionable" ? 1.04 : 1;
  const importance = Math.max(0, Math.min(1, (point.readiness / 100) * classWeight));
  const sqrtScaled = Math.sqrt(importance);
  const radius = minR + sqrtScaled * (maxR - minR);
  return Math.min(maxR, Math.max(minR, Math.round(radius * 10) / 10));
}

export type RadarLayoutEntry = {
  symbol: string;
  layoutReadiness: number;
  layoutRisk: number;
  pixelX: number;
  pixelY: number;
  radius: number;
};

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

export function pixelToRadarPlot(
  pixelX: number,
  pixelY: number,
  chartWidth: number,
  chartHeight: number,
  margin = RADAR_CHART_MARGIN
): { layoutReadiness: number; layoutRisk: number } {
  const plotW = chartWidth - margin.left - margin.right;
  const plotH = chartHeight - margin.top - margin.bottom;
  const layoutReadiness = ((pixelX - margin.left) / plotW) * 100;
  const layoutRisk = 100 - ((pixelY - margin.top) / plotH) * 100;
  return {
    layoutReadiness: Math.max(PLOT_READINESS_MIN, Math.min(PLOT_READINESS_MAX, layoutReadiness)),
    layoutRisk: Math.max(PLOT_RISK_MIN, Math.min(PLOT_RISK_MAX, layoutRisk)),
  };
}

export function clampRadarBubblePosition(
  cx: number,
  cy: number,
  chartWidth: number,
  chartHeight: number,
  bubbleRadius = RADAR_BUBBLE_OUTER_RADIUS,
  margin = RADAR_CHART_MARGIN
): { x: number; y: number } {
  const plotSide = Math.min(
    chartWidth - margin.left - margin.right,
    chartHeight - margin.top - margin.bottom
  );
  const pad = bubbleRadius + 6;
  const plotCenterX = margin.left + (chartWidth - margin.left - margin.right) / 2;
  const plotCenterY = margin.top + (chartHeight - margin.top - margin.bottom) / 2;
  const half = plotSide / 2 - pad;
  const minX = plotCenterX - half;
  const maxX = plotCenterX + half;
  const minY = plotCenterY - half;
  const maxY = plotCenterY + half;
  return {
    x: Math.min(maxX, Math.max(minX, cx)),
    y: Math.min(maxY, Math.max(minY, cy)),
  };
}

export function resolveRadarCollisions(
  entries: RadarLayoutEntry[],
  chartWidth: number,
  chartHeight: number,
  minGap = 3,
  maxIterations = 16
): RadarLayoutEntry[] {
  const copy = entries.map((e) => ({ ...e }));

  for (let i = 0; i < copy.length; i++) {
    const angle = (i / Math.max(1, copy.length)) * Math.PI * 2 - Math.PI / 2;
    const seed = (copy[i]!.radius + minGap) * 0.4;
    copy[i]!.pixelX += Math.cos(angle) * seed;
    copy[i]!.pixelY += Math.sin(angle) * seed;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (let i = 0; i < copy.length; i++) {
      for (let j = i + 1; j < copy.length; j++) {
        const a = copy[i]!;
        const b = copy[j]!;
        const dx = b.pixelX - a.pixelX;
        const dy = b.pixelY - a.pixelY;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minDist = a.radius + b.radius + minGap;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.42;
          const nx = dx / dist;
          const ny = dy / dist;
          a.pixelX -= nx * push * 0.5;
          a.pixelY -= ny * push * 0.5;
          b.pixelX += nx * push * 0.5;
          b.pixelY += ny * push * 0.5;
          moved = true;
        }
      }
    }
    for (const entry of copy) {
      const clamped = clampRadarBubblePosition(
        entry.pixelX,
        entry.pixelY,
        chartWidth,
        chartHeight,
        entry.radius + 4
      );
      entry.pixelX = clamped.x;
      entry.pixelY = clamped.y;
      const plot = pixelToRadarPlot(entry.pixelX, entry.pixelY, chartWidth, chartHeight);
      entry.layoutReadiness = plot.layoutReadiness;
      entry.layoutRisk = plot.layoutRisk;
    }
    if (!moved) break;
  }
  return copy;
}

export function layoutRadarBubbles(
  points: readonly RadarPlotPoint[],
  chartWidth: number,
  chartHeight: number,
  options: { mini?: boolean; activeSymbol?: string | null } = {}
): Map<string, RadarLayoutEntry> {
  if (chartWidth <= 0 || chartHeight <= 0 || points.length === 0) {
    return new Map();
  }

  const spread = applyPercentileSpread(points);
  const entries: RadarLayoutEntry[] = spread.map((p) => {
    const radius = bubbleRadiusFromNode(p, {
      mini: options.mini,
      active: p.symbol === options.activeSymbol,
    });
    const { cx, cy } = radarPlotToPixel(p.layoutReadiness, p.layoutRisk, chartWidth, chartHeight);
    const clamped = clampRadarBubblePosition(cx, cy, chartWidth, chartHeight, radius + 4);
    return {
      symbol: p.symbol,
      layoutReadiness: p.layoutReadiness,
      layoutRisk: p.layoutRisk,
      pixelX: clamped.x,
      pixelY: clamped.y,
      radius,
    };
  });

  const resolved = resolveRadarCollisions(entries, chartWidth, chartHeight);
  return new Map(resolved.map((e) => [e.symbol, e]));
}

export function prepareRadarChartData(points: readonly RadarNode[]): RadarPlotPoint[] {
  return points.map((n) => toRadarPlotPoint(n));
}

export function mergeLayoutIntoChartData(
  points: readonly RadarPlotPoint[],
  layout: Map<string, RadarLayoutEntry>
): RadarPlotPoint[] {
  return points.map((p) => {
    const entry = layout.get(p.symbol);
    if (!entry) return p;
    return {
      ...p,
      layoutReadiness: entry.layoutReadiness,
      layoutRisk: entry.layoutRisk,
    };
  });
}

export function radarLabelPriority(point: RadarPlotPoint): number {
  const classBonus =
    point.classification === "avoid" ? 28 : point.classification === "actionable" ? 18 : 8;
  return point.readiness + classBonus - point.risk * 0.15;
}

export function selectRadarLabelSymbols(
  points: readonly RadarPlotPoint[],
  options: {
    maxLabels: number;
    hovered?: string | null;
    selected?: string | null;
    highlighted?: string | null;
  }
): Set<string> {
  const top = [...points]
    .sort((a, b) => radarLabelPriority(b) - radarLabelPriority(a))
    .slice(0, options.maxLabels)
    .map((p) => p.symbol);
  const labels = new Set(top);
  if (options.hovered) labels.add(options.hovered);
  if (options.selected) labels.add(options.selected);
  if (options.highlighted) labels.add(options.highlighted);
  return labels;
}

export function shouldShowRadarLabel(
  symbol: string,
  labelSymbols: Set<string>,
  active: boolean,
  mini: boolean
): boolean {
  if (!mini) return true;
  return active || labelSymbols.has(symbol);
}

export function formatPp(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
}

export type RadarTooltipContent = {
  symbol: string;
  state: string | null;
  metrics: string;
  action: string;
  setup: string | null;
};

export function formatRadarWorkbenchTooltip(row: RelativeStrengthRow): RadarTooltipContent {
  const state = row.earlyEntry
    ? friendlyEarlyStateLabel(row.earlyEntry.proposedTradeState)
    : friendlySetupStateLabel(row.setupState);
  const rr =
    row.earlyEntry?.estimatedRiskReward != null
      ? `${row.earlyEntry.estimatedRiskReward.toFixed(2)}:1`
      : "—";
  return {
    symbol: row.symbol,
    state: state !== row.symbol ? state : null,
    metrics: `RS20 ${formatPp(row.rs20)} · R:R ${rr}`,
    action: workbenchActionLabel(row),
    setup: friendlySetupStateLabel(row.setupState),
  };
}

export function countOverlappingPairs(
  entries: readonly RadarLayoutEntry[],
  minGap = 3
): number {
  let overlaps = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      const dist = Math.hypot(b.pixelX - a.pixelX, b.pixelY - a.pixelY);
      if (dist < a.radius + b.radius + minGap) overlaps += 1;
    }
  }
  return overlaps;
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
  const pad = bubbleRadius + 6;
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
