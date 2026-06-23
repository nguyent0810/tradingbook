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
import type { RadarNode, RadarNodeClassification } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Sparkline } from "./ui/sparkline";
import {
  RADAR_BUBBLE_OUTER_RADIUS,
  RADAR_CHART_MARGIN,
  clampRadarBubblePosition,
  type RadarPlotPoint,
  toRadarPlotPoint,
} from "./radar-plot-utils";

type Props = {
  nodes: RadarNode[];
  decisionMode?: V3DecisionMode;
  variant?: "default" | "mini";
  selectedSymbol?: string | null;
  onNodeClick?: (symbol: string) => void;
  rsRows?: Array<{ symbol: string; rs20: number }>;
};

const NODE_COLORS: Record<RadarNodeClassification, { fill: string; glow: string }> = {
  actionable: { fill: "#00E676", glow: "rgba(0, 230, 118, 0.55)" },
  watch: { fill: "#FFB800", glow: "rgba(255, 184, 0, 0.55)" },
  avoid: { fill: "#f43f5e", glow: "rgba(244, 63, 94, 0.55)" },
};

const AXIS_TICK = { fill: "#9ca3af", fontSize: 11 };
const CHART_MARGIN = RADAR_CHART_MARGIN;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RadarPlotPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const node = payload[0].payload;
  const colors = NODE_COLORS[node.classification];

  return (
    <div className="cd-radar-tooltip" style={{ position: "relative", pointerEvents: "none" }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <strong className="cd-mono text-sm">{node.symbol}</strong>
        <span className="text-[10px] uppercase cd-tone-warning">{node.tier}</span>
      </div>
      <p className="text-xs m-0 mb-1" style={{ color: "var(--cd-text-muted)" }}>
        {node.reason}
      </p>
      <p className="text-[10px] cd-mono m-0 mb-1" style={{ color: "var(--cd-text-dim)" }}>
        Readiness {node.readiness} · Risk {node.risk}
      </p>
      <Sparkline values={node.sparkline} color={colors.fill} width={140} height={28} />
    </div>
  );
}

function PolarBackdrop({ mini = false }: { mini?: boolean }) {
  const strokeOpacity = mini ? 0.08 : 0.14;
  return (
    <svg className="cd-radar-grid absolute inset-0 w-full h-full pointer-events-none" aria-hidden viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="cd-radar-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 229, 255, 0.06)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#cd-radar-fade)" />
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <circle
          key={scale}
          cx="50"
          cy="50"
          r={45 * scale}
          fill="none"
          stroke={`rgba(156, 163, 175, ${strokeOpacity})`}
          strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line x1="0" y1="50" x2="100" y2="50" stroke={`rgba(156, 163, 175, ${strokeOpacity})`} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      <line x1="50" y1="0" x2="50" y2="100" stroke={`rgba(156, 163, 175, ${strokeOpacity})`} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function OpportunityRadar({
  nodes,
  decisionMode = "PROTECT CAPITAL",
  variant = "default",
  selectedSymbol = null,
  onNodeClick,
  rsRows = [],
}: Props) {
  const mini = variant === "mini";
  const [mounted, setMounted] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData: RadarPlotPoint[] = useMemo(
    () => nodes.map((n) => toRadarPlotPoint(n)),
    [nodes]
  );

  const labelSymbols = useMemo(() => {
    if (!mini) return null;
    const top = [...chartData]
      .sort((a, b) => b.readiness - a.readiness)
      .slice(0, 3)
      .map((n) => n.symbol);
    if (selectedSymbol && !top.includes(selectedSymbol)) {
      return [...top.slice(0, 2), selectedSymbol];
    }
    return top;
  }, [mini, chartData, selectedSymbol]);

  const summary = useMemo(() => {
    const leaders = nodes.filter((n) => n.classification === "actionable").length;
    const watch = nodes.filter((n) => n.classification === "watch").length;
    const extended = nodes.filter((n) => n.classification === "avoid").length;
    const bestRs =
      rsRows.length > 0
        ? [...rsRows].sort((a, b) => b.rs20 - a.rs20).slice(0, 3).map((r) => r.symbol)
        : [...nodes].sort((a, b) => b.readiness - a.readiness).slice(0, 3).map((n) => n.symbol);
    return { leaders, watch, extended, bestRs };
  }, [nodes, rsRows]);

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
        title={mini ? "Opportunity Radar" : "Opportunity Radar"}
        subtitle={mini ? "Compact map" : "Readiness → · Risk ↓ · Size = priority"}
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
              Avoid
            </li>
          </ul>
          )
        }
      />

      <div className="cd-radar-stage">
        <div
          className={`cd-radar-plot aspect-square ${mini ? "cd-radar-plot--mini" : ""}`}
          data-testid="command-deck-radar-plot"
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
                  strokeDasharray="2 6"
                  stroke={mini ? "rgba(156, 163, 175, 0.06)" : "rgba(156, 163, 175, 0.1)"}
                />
                <XAxis
                  type="number"
                  dataKey="plotReadiness"
                  name="Readiness"
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="plotRisk"
                  name="Risk"
                  domain={[100, 0]}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <ZAxis type="number" dataKey="z" range={[80, 400]} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.18)" }}
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
                        const active = hoveredSymbol === payload.symbol || selectedSymbol === payload.symbol;
                        const colors = NODE_COLORS[payload.classification];
                        const r = active ? 22 : mini ? 14 : 18;
                        const outerR = r + 6;
                        let x = cx;
                        let y = cy;
                        if (chartSize.width > 0 && chartSize.height > 0) {
                          const clamped = clampRadarBubblePosition(
                            cx,
                            cy,
                            chartSize.width,
                            chartSize.height,
                            Math.max(outerR, RADAR_BUBBLE_OUTER_RADIUS)
                          );
                          x = clamped.x;
                          y = clamped.y;
                        }
                        return (
                          <g>
                            <circle
                              cx={x}
                              cy={y}
                              r={r + 6}
                              fill={colors.glow}
                              opacity={active ? 0.9 : 0.5}
                            />
                            <circle cx={x} cy={y} r={r} fill={colors.fill} />
                            {!mini || labelSymbols?.includes(payload.symbol) ? (
                            <text
                              x={x}
                              y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#090a0f"
                              fontSize={mini ? 7 : 9}
                              fontWeight={700}
                              fontFamily="var(--font-geist-mono)"
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
        <div className="cd-radar-mini-summary" data-testid="radar-mini-summary">
          <span>Leaders {summary.leaders}</span>
          <span>Watch {summary.watch}</span>
          <span>Extended {summary.extended}</span>
          <span>Best RS {summary.bestRs.join(", ") || "—"}</span>
        </div>
      ) : null}

      {nodes.length === 0 ? (
        <p className="text-xs m-0 mt-2" style={{ color: "var(--cd-text-dim)" }}>
          No candidates plotted on the readiness/risk map.
        </p>
      ) : null}
    </Card>
  );
}
