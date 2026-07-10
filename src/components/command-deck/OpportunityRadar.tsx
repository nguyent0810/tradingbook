"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { V3DecisionMode } from "@/lib/dashboard/dashboard-v3-view-model";
import { summarizeWorkbenchRadar } from "@/lib/dashboard/rs-radar-from-workbench";
import type { RadarNode, RadarNodeClassification, RelativeStrengthRow } from "./types";
import { Card, CardHeader } from "./ui/card";
import {
  RADAR_CHART_MARGIN,
  bubbleRadiusFromNode,
  formatRadarWorkbenchTooltip,
  layoutRadarBubbles,
  mergeLayoutIntoChartData,
  prepareRadarChartData,
  selectRadarLabelSymbols,
  shouldShowRadarLabel,
  type RadarPlotPoint,
} from "./radar-plot-utils";

type Props = {
  nodes: RadarNode[];
  decisionMode?: V3DecisionMode;
  variant?: "default" | "mini";
  selectedSymbol?: string | null;
  highlightedSymbol?: string | null;
  onNodeClick?: (symbol: string) => void;
  workbenchRows?: RelativeStrengthRow[];
};

const NODE_COLORS: Record<RadarNodeClassification, { fill: string; glow: string }> = {
  actionable: { fill: "#00E676", glow: "rgba(0, 230, 118, 0.35)" },
  watch: { fill: "#FFB800", glow: "rgba(255, 184, 0, 0.32)" },
  avoid: { fill: "#f43f5e", glow: "rgba(244, 63, 94, 0.32)" },
};

const AXIS_TICK = { fill: "#8c94a8", fontSize: 10 };
const CHART_MARGIN = RADAR_CHART_MARGIN;

function WorkbenchTooltip({
  active,
  payload,
  workbenchBySymbol,
}: {
  active?: boolean;
  payload?: Array<{ payload: RadarPlotPoint }>;
  workbenchBySymbol: Map<string, RelativeStrengthRow>;
}) {
  if (!active || !payload?.[0]) return null;
  const node = payload[0].payload;
  const row = workbenchBySymbol.get(node.symbol);

  if (row) {
    const tip = formatRadarWorkbenchTooltip(row);
    return (
      <div className="cd-radar-tooltip cd-radar-tooltip--compact" data-testid="radar-workbench-tooltip">
        <strong className="cd-mono text-sm block">{tip.symbol}</strong>
        {tip.state ? (
          <p className="text-xs m-0 mt-0.5 cd-tone-warning">{tip.state}</p>
        ) : null}
        <p className="text-[10px] cd-mono m-0 mt-1" style={{ color: "var(--cd-text-muted)" }}>
          {tip.metrics}
        </p>
        <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--cd-text-dim)" }}>
          {tip.action}
          {tip.setup && tip.setup !== tip.state ? ` · ${tip.setup}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="cd-radar-tooltip cd-radar-tooltip--compact">
      <strong className="cd-mono text-sm">{node.symbol}</strong>
      <p className="text-xs m-0 mt-1" style={{ color: "var(--cd-text-muted)" }}>
        {node.tier}
      </p>
    </div>
  );
}

function PolarBackdrop({ mini = false }: { mini?: boolean }) {
  const strokeOpacity = mini ? 0.05 : 0.1;
  return (
    <svg
      className="cd-radar-grid absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="cd-radar-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 229, 255, 0.04)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#cd-radar-fade)" />
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <circle
          key={scale}
          cx="50"
          cy="50"
          r={42 * scale}
          fill="none"
          stroke={`rgba(156, 163, 175, ${strokeOpacity})`}
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1="0"
        y1="50"
        x2="100"
        y2="50"
        stroke={`rgba(156, 163, 175, ${strokeOpacity})`}
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="50"
        y1="0"
        x2="50"
        y2="100"
        stroke={`rgba(156, 163, 175, ${strokeOpacity})`}
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function OpportunityRadar({
  nodes,
  decisionMode = "PROTECT CAPITAL",
  variant = "default",
  selectedSymbol = null,
  highlightedSymbol = null,
  onNodeClick,
  workbenchRows = [],
}: Props) {
  const mini = variant === "mini";
  const [mounted, setMounted] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const workbenchBySymbol = useMemo(
    () => new Map(workbenchRows.map((r) => [r.symbol, r])),
    [workbenchRows]
  );

  useEffect(() => {
    // Client-mount gate to avoid SSR/hydration mismatch for the layout-measured
    // radar; setting state once on mount is the intended, one-shot behavior.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const baseChartData = useMemo(() => prepareRadarChartData(nodes), [nodes]);

  const focusSymbol = hoveredSymbol ?? highlightedSymbol ?? selectedSymbol;

  const layoutMap = useMemo(() => {
    if (chartSize.width <= 0 || chartSize.height <= 0) return new Map();
    return layoutRadarBubbles(baseChartData, chartSize.width, chartSize.height, {
      mini,
      activeSymbol: focusSymbol,
    });
  }, [baseChartData, chartSize.width, chartSize.height, mini, focusSymbol]);

  const chartData: RadarPlotPoint[] = useMemo(() => {
    if (layoutMap.size === 0) return baseChartData;
    return mergeLayoutIntoChartData(baseChartData, layoutMap);
  }, [baseChartData, layoutMap]);

  const labelSymbols = useMemo(
    () =>
      selectRadarLabelSymbols(chartData, {
        maxLabels: mini ? 4 : chartData.length,
        hovered: hoveredSymbol,
        selected: selectedSymbol,
        highlighted: highlightedSymbol,
      }),
    [chartData, mini, hoveredSymbol, selectedSymbol, highlightedSymbol]
  );

  const summary = useMemo(() => {
    if (workbenchRows.length > 0) {
      return summarizeWorkbenchRadar(workbenchRows);
    }
    return {
      pilotResearch: nodes.filter((n) => n.classification === "actionable").length,
      watch: nodes.filter((n) => n.classification === "watch").length,
      tooExtended: nodes.filter((n) => n.classification === "avoid").length,
      bestRs: [...nodes].sort((a, b) => b.readiness - a.readiness).slice(0, 3).map((n) => n.symbol),
    };
  }, [workbenchRows, nodes]);

  const grouped = useMemo(() => {
    const map: Record<RadarNodeClassification, RadarPlotPoint[]> = {
      actionable: [],
      watch: [],
      avoid: [],
    };
    for (const n of chartData) map[n.classification].push(n);
    return map;
  }, [chartData]);

  return (
    <Card className={`${mini ? "p-3" : "p-4"}`} data-testid="command-deck-opportunity-radar">
      <CardHeader
        title="Opportunity Radar"
        subtitle={mini ? "RS workbench map" : "Readiness → · Risk ↓"}
        action={
          mini ? null : (
            <ul className="cd-radar-legend">
              {decisionMode === "TRADE" ? (
                <li>
                  <i
                    className="cd-radar-legend__dot"
                    style={{ background: NODE_COLORS.actionable.fill }}
                  />
                  Actionable
                </li>
              ) : null}
              <li>
                <i className="cd-radar-legend__dot" style={{ background: NODE_COLORS.watch.fill }} />
                Watch
              </li>
              <li>
                <i className="cd-radar-legend__dot" style={{ background: NODE_COLORS.avoid.fill }} />
                Too Extended
              </li>
            </ul>
          )
        }
      />

      <div className="cd-radar-stage">
        <div
          className={`cd-radar-plot aspect-square ${mini ? "cd-radar-plot--mini" : ""}`}
          data-testid="command-deck-radar-plot"
          role="img"
          aria-label="Opportunity map — readiness (horizontal) versus risk (vertical); bubble color shows classification"
        >
          <PolarBackdrop mini={mini} />
          {mounted ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
              onResize={(width, height) => setChartSize({ width, height })}
            >
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="2 8"
                  stroke={mini ? "rgba(156, 163, 175, 0.04)" : "rgba(156, 163, 175, 0.07)"}
                />
                <XAxis
                  type="number"
                  dataKey="layoutReadiness"
                  name="Readiness"
                  domain={[0, 100]}
                  tick={mini ? false : AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="layoutRisk"
                  name="Risk"
                  domain={[100, 0]}
                  tick={mini ? false : AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={mini ? 8 : 28}
                />
                <ZAxis type="number" dataKey="z" range={[48, 48]} />
                <Tooltip
                  content={<WorkbenchTooltip workbenchBySymbol={workbenchBySymbol} />}
                  cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.12)" }}
                />
                {(["actionable", "watch", "avoid"] as const).map((key) =>
                  grouped[key].length > 0 ? (
                    <Scatter
                      key={key}
                      name={key}
                      data={grouped[key]}
                      fill={NODE_COLORS[key].fill}
                      onMouseEnter={(d) => {
                        const point = (d as { payload?: RadarPlotPoint }).payload;
                        if (point?.symbol) setHoveredSymbol(point.symbol);
                      }}
                      onMouseLeave={() => setHoveredSymbol(null)}
                      onClick={(d) => {
                        const point = (d as { payload?: RadarPlotPoint }).payload;
                        if (point?.symbol) onNodeClick?.(point.symbol);
                      }}
                      shape={(props) => {
                        const { cx, cy, payload } = props as {
                          cx: number;
                          cy: number;
                          payload: RadarPlotPoint;
                        };
                        const active =
                          hoveredSymbol === payload.symbol ||
                          selectedSymbol === payload.symbol ||
                          highlightedSymbol === payload.symbol;
                        const colors = NODE_COLORS[payload.classification];
                        const layout = layoutMap.get(payload.symbol);
                        const r =
                          layout?.radius ??
                          bubbleRadiusFromNode(payload, { mini, active });
                        const glowR = r + (active ? 4 : 3);
                        const x = layout?.pixelX ?? cx;
                        const y = layout?.pixelY ?? cy;
                        const showLabel = shouldShowRadarLabel(
                          payload.symbol,
                          labelSymbols,
                          active,
                          mini
                        );
                        return (
                          <g data-testid={`radar-node-${payload.symbol}`}>
                            <circle
                              cx={x}
                              cy={y}
                              r={glowR}
                              fill={colors.glow}
                              opacity={active ? 0.5 : 0.28}
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r={r}
                              fill={colors.fill}
                              stroke={active ? "rgba(0, 229, 255, 0.85)" : "transparent"}
                              strokeWidth={active ? 1.75 : 0}
                            />
                            {showLabel ? (
                              <text
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#090a0f"
                                fontSize={mini ? (active ? 8 : 7) : 9}
                                fontWeight={700}
                                fontFamily="var(--font-geist-mono)"
                                pointerEvents="none"
                              >
                                {payload.symbol}
                              </text>
                            ) : null}
                          </g>
                        );
                      }}
                    />
                  ) : null
                )}
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs"
              style={{ color: "var(--cd-text-dim)" }}
            >
              Loading radar…
            </div>
          )}
        </div>
      </div>

      {mini ? (
        <div
          className="cd-radar-mini-summary"
          data-testid="radar-mini-summary"
          role="group"
          aria-label="Radar classification counts"
        >
          <span className="cd-radar-stat">
            <i className="cd-radar-stat__dot cd-radar-stat__dot--actionable" aria-hidden />
            Pilot Research: {summary.pilotResearch}
          </span>
          <span className="cd-radar-stat">
            <i className="cd-radar-stat__dot cd-radar-stat__dot--watch" aria-hidden />
            Watch: {summary.watch}
          </span>
          <span className="cd-radar-stat">
            <i className="cd-radar-stat__dot cd-radar-stat__dot--avoid" aria-hidden />
            Too Extended: {summary.tooExtended}
          </span>
          <span className="cd-radar-stat cd-radar-stat--wide">Best RS: {summary.bestRs.join(", ") || "—"}</span>
          {selectedSymbol ? (
            <span className="cd-radar-mini-summary__focus" data-testid="radar-selected-summary">
              Focus: {selectedSymbol}
            </span>
          ) : null}
        </div>
      ) : null}

      {nodes.length === 0 ? (
        <p className="cd-radar-empty" role="status">
          No candidates on the readiness × risk map yet — clears as the workbench surfaces setups.
        </p>
      ) : null}
    </Card>
  );
}
