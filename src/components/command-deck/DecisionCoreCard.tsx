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
      className={`p-3 cd-decision--compact ${isNoTrade ? "cd-card--decision-danger" : ""} ${isNoTrade && !reducedMotion ? "cd-pulse-border" : ""}`}
      data-testid="dashboard-cyber-decision-core"
    >
      <CardHeader title="Decision Core" subtitle={data.confidenceLabel} />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h2 className={`${isNoTrade ? "cd-decision__stance" : "cd-decision__stance cd-decision__stance--compact"}`}>
            {data.stance}
          </h2>
        </div>

        <p className="text-xs leading-relaxed m-0 mb-3 cd-decision__reason">
          {data.primaryReason}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--compact">
            <label>Main risk</label>
            <p className="text-[11px] m-0 mb-1 leading-snug" style={{ color: "var(--cd-text)" }}>
              {data.mainRisk}
            </p>
            <AnimatedBar percent={data.mainRiskPercent} tone={mainRiskTone} reducedMotion={reducedMotion} />
          </div>
          <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--compact">
            <label>Capital</label>
            <p className="text-[11px] m-0 mb-1 leading-snug" style={{ color: "var(--cd-text)" }}>
              {data.capital}
            </p>
            <AnimatedBar percent={data.capitalPercent} tone={capitalTone} reducedMotion={reducedMotion} />
          </div>
          <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--compact cd-metric-cell--next-action">
            <label>Next action</label>
            <p className="cd-decision__next-action cd-decision__next-action--compact m-0 leading-snug">
              {data.nextAction}
            </p>
          </div>
        </div>
      </motion.div>
    </Card>
  );
}
