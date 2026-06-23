"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DecisionCoreData } from "./types";
import { Card, CardHeader } from "./ui/card";

type Props = {
  data: DecisionCoreData;
};

function progressTone(percent: number): "danger" | "warning" {
  return percent >= 65 ? "danger" : "warning";
}

function AnimatedBar({
  percent,
  tone,
  reducedMotion,
}: {
  percent: number;
  tone: "danger" | "warning";
  reducedMotion: boolean;
}) {
  return (
    <div className="cd-progress mt-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={`cd-progress__fill cd-progress__fill--${tone}`}
        initial={reducedMotion ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
      />
    </div>
  );
}

export function DecisionCoreCard({ data }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const isNoTrade = data.stanceTone === "danger";
  const mainRiskTone = progressTone(data.mainRiskPercent);
  const capitalTone = progressTone(data.capitalPercent);

  return (
    <Card
      variant="glass"
      glow={isNoTrade ? "danger" : "none"}
      className={`p-5 ${isNoTrade ? "cd-card--decision-danger" : ""} ${isNoTrade && !reducedMotion ? "cd-pulse-border" : ""}`}
      data-testid="dashboard-cyber-decision-core"
    >
      <CardHeader title="Decision Core" subtitle={data.confidenceLabel} />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <h2 className="cd-decision__stance">{data.stance}</h2>
          <span className="cd-kicker" style={{ letterSpacing: "0.08em" }}>
            Today&apos;s stance
          </span>
        </div>

        <p className="text-sm leading-relaxed m-0 mb-4 cd-decision__reason">
          {data.primaryReason}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="cd-metric-cell cd-metric-cell--glass">
            <label>Main risk</label>
            <p className="text-xs m-0 mb-1 leading-snug" style={{ color: "var(--cd-text)" }}>
              {data.mainRisk}
            </p>
            <AnimatedBar percent={data.mainRiskPercent} tone={mainRiskTone} reducedMotion={reducedMotion} />
          </div>
          <div className="cd-metric-cell cd-metric-cell--glass">
            <label>Capital</label>
            <p className="text-xs m-0 mb-1 leading-snug" style={{ color: "var(--cd-text)" }}>
              {data.capital}
            </p>
            <AnimatedBar percent={data.capitalPercent} tone={capitalTone} reducedMotion={reducedMotion} />
          </div>
        </div>

        <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--next-action">
          <label>Next action</label>
          <p className="cd-decision__next-action m-0 leading-relaxed">
            {data.nextAction}
          </p>
        </div>
      </motion.div>
    </Card>
  );
}
