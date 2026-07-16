"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { ChartFrame, ChartPlot } from "@/components/command-deck";
import type { HostilityGaugeDto, HostilityGaugeTone } from "@/lib/dashboard/hostility-gauge";

export type DashboardHostilityGaugeProps = {
  gauge: HostilityGaugeDto;
};

const TONE_COLOR: Record<HostilityGaugeTone, string> = {
  calm: "var(--success)",
  caution: "var(--warning)",
  hostile: "var(--danger)",
};

const GAUGE_HEIGHT = 140;

const TONE_CAPTION: Record<HostilityGaugeTone, string> = {
  calm: "Favorable risk environment",
  caution: "Mixed risk environment",
  hostile: "High risk environment",
};

export function DashboardHostilityGauge({ gauge }: DashboardHostilityGaugeProps) {
  const color = TONE_COLOR[gauge.tone];
  const data = [{ name: "hostility", value: gauge.score, fill: color }];

  return (
    <ChartFrame
      testId="dashboard-hostility-gauge"
      title="Hostility Index"
      height={GAUGE_HEIGHT}
      className="dash-hostility-gauge"
    >
      <div className="dash-hostility-gauge__plot">
        <ChartPlot height={GAUGE_HEIGHT}>
          <RadialBarChart
            width={GAUGE_HEIGHT}
            height={GAUGE_HEIGHT}
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={10}
            data={data}
            startAngle={220}
            endAngle={-40}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: "var(--cd-glass-bg)" }}
              dataKey="value"
              cornerRadius={8}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ChartPlot>
        <div className="dash-hostility-gauge__center">
          <span className="dash-hostility-gauge__score tabular-nums" style={{ color }}>
            {Math.round(gauge.score)}
          </span>
          <span className="dash-hostility-gauge__label" style={{ color }}>
            {gauge.label}
          </span>
        </div>
      </div>
      <p className="dash-hostility-gauge__caption text-xs">{TONE_CAPTION[gauge.tone]}</p>
    </ChartFrame>
  );
}
