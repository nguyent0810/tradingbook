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
import type { RadarNode, RadarNodeClassification } from "./types";
import { Card, CardHeader } from "./ui/card";
import { Sparkline } from "./ui/sparkline";

type Props = {
  nodes: RadarNode[];
};

type ChartPoint = RadarNode & { z: number };

const NODE_COLORS: Record<RadarNodeClassification, { fill: string; glow: string }> = {
  actionable: { fill: "#00E676", glow: "rgba(0, 230, 118, 0.55)" },
  watch: { fill: "#FFB800", glow: "rgba(255, 184, 0, 0.55)" },
  avoid: { fill: "#FF3366", glow: "rgba(255, 51, 102, 0.6)" },
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
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

function PolarBackdrop() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      <defs>
        <radialGradient id="cd-radar-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 229, 255, 0.04)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#cd-radar-fade)" />
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <ellipse
          key={scale}
          cx="50%"
          cy="50%"
          rx={`${45 * scale}%`}
          ry={`${40 * scale}%`}
          fill="none"
          stroke="rgba(0, 229, 255, 0.08)"
          strokeWidth="1"
        />
      ))}
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.06)" />
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255,255,255,0.06)" />
    </svg>
  );
}

export function OpportunityRadar({ nodes }: Props) {
  const [mounted, setMounted] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData: ChartPoint[] = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        z: n.classification === "avoid" ? 140 : n.classification === "watch" ? 110 : 90,
      })),
    [nodes]
  );

  const grouped = useMemo(() => {
    const map: Record<RadarNodeClassification, ChartPoint[]> = {
      actionable: [],
      watch: [],
      avoid: [],
    };
    for (const n of chartData) map[n.classification].push(n);
    return map;
  }, [chartData]);

  return (
    <Card className="p-4 h-full flex flex-col" data-testid="command-deck-opportunity-radar">
      <CardHeader
        title="Opportunity Radar"
        subtitle="Readiness → · Risk ↓ · Size = priority"
        action={
          <ul className="cd-radar-legend">
            <li>
              <i className="cd-radar-legend__dot" style={{ background: NODE_COLORS.watch.fill }} />
              Watch
            </li>
            <li>
              <i className="cd-radar-legend__dot" style={{ background: NODE_COLORS.avoid.fill }} />
              Avoid
            </li>
          </ul>
        }
      />

      <div className="cd-radar-wrap flex-1 relative min-h-[300px]">
        <PolarBackdrop />
        {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              type="number"
              dataKey="readiness"
              name="Readiness"
              domain={[0, 100]}
              tick={{ fill: "#5c6378", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="risk"
              name="Risk"
              domain={[100, 0]}
              tick={{ fill: "#5c6378", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <ZAxis type="number" dataKey="z" range={[80, 400]} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.15)" }}
            />
            {(["actionable", "watch", "avoid"] as const).map((key) =>
              grouped[key].length > 0 ? (
                <Scatter
                  key={key}
                  name={key}
                  data={grouped[key]}
                  fill={NODE_COLORS[key].fill}
                  onMouseEnter={(d) => {
                    const point = (d as { payload?: ChartPoint }).payload;
                    if (point?.symbol) setHoveredSymbol(point.symbol);
                  }}
                  onMouseLeave={() => setHoveredSymbol(null)}
                  shape={(props) => {
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: ChartPoint;
                    };
                    const active = hoveredSymbol === payload.symbol;
                    const colors = NODE_COLORS[payload.classification];
                    const r = active ? 22 : 18;
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r + 6}
                          fill={colors.glow}
                          opacity={active ? 0.9 : 0.5}
                        />
                        <circle cx={cx} cy={cy} r={r} fill={colors.fill} />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#090a0f"
                          fontSize={9}
                          fontWeight={700}
                          fontFamily="var(--font-geist-mono)"
                        >
                          {payload.symbol}
                        </text>
                      </g>
                    );
                  }}
                />
              ) : null
            )}
          </ScatterChart>
        </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--cd-text-dim)" }}>
            Loading radar…
          </div>
        )}
      </div>

      {nodes.length === 0 ? (
        <p className="text-xs m-0 mt-2" style={{ color: "var(--cd-text-dim)" }}>
          No candidates plotted on the readiness/risk map.
        </p>
      ) : null}
    </Card>
  );
}
