"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DecisionCoreData, StatusTone } from "./types";
import { Card, CardHeader } from "./ui/card";

type Props = {
  data: DecisionCoreData;
};

type BarTone = "danger" | "warning" | "success" | "info";

/** Risk bars: higher = more risk (red), moderate (amber), low (green/safe). */
function riskTone(percent: number): BarTone {
  if (percent >= 65) return "danger";
  if (percent >= 35) return "warning";
  return "success";
}

function stanceToneClass(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "cd-decision__stance--safe";
    case "warning":
      return "cd-decision__stance--caution";
    case "danger":
      return "cd-decision__stance--danger";
    case "info":
      return "cd-decision__stance--info";
    default:
      return "cd-decision__stance--neutral";
  }
}

function cardGlow(tone: StatusTone): "danger" | "warning" | "success" | "none" {
  if (tone === "danger" || tone === "warning" || tone === "success") return tone;
  return "none";
}

function toneTextClass(tone: BarTone): string {
  if (tone === "danger") return "cd-tone-danger";
  if (tone === "warning") return "cd-tone-warning";
  if (tone === "success") return "cd-tone-success";
  return "cd-tone-info";
}

function AnimatedBar({
  percent,
  tone,
  reducedMotion,
}: {
  percent: number;
  tone: BarTone;
  reducedMotion: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="cd-progress mt-1.5"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={`cd-progress__fill cd-progress__fill--${tone}`}
        initial={reducedMotion ? false : { width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
      />
    </div>
  );
}

function MetricCell({
  label,
  value,
  percent,
  tone,
  reducedMotion,
}: {
  label: string;
  value: string;
  percent: number;
  tone: BarTone;
  reducedMotion: boolean;
}) {
  return (
    <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--compact">
      <div className="cd-metric-cell__head">
        <label>{label}</label>
        <span className={`cd-mono cd-metric-cell__pct ${toneTextClass(tone)}`}>{Math.round(percent)}%</span>
      </div>
      <p className="cd-metric-cell__value">{value}</p>
      <AnimatedBar percent={percent} tone={tone} reducedMotion={reducedMotion} />
    </div>
  );
}

export function DecisionCoreCard({ data }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const isNoTrade = data.stanceTone === "danger";

  return (
    <Card
      variant="glass"
      glow={cardGlow(data.stanceTone)}
      className={`p-3 cd-decision--compact ${isNoTrade ? "cd-card--decision-danger" : ""}`}
      data-testid="dashboard-cyber-decision-core"
    >
      <CardHeader title="Decision Core" />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Hero — stance + conviction, instantly scannable */}
        <div className="cd-decision__hero">
          <h2 className={`cd-decision__stance ${stanceToneClass(data.stanceTone)}`}>
            <span className="cd-decision__stance-dot" aria-hidden />
            {data.stance}
          </h2>
          <span className="cd-decision__conviction" title="Conviction">
            {data.confidenceLabel}
          </span>
        </div>

        <p className="cd-decision__reason">{data.primaryReason}</p>

        <div className="cd-decision__metrics">
          <MetricCell
            label="Main risk"
            value={data.mainRisk}
            percent={data.mainRiskPercent}
            tone={riskTone(data.mainRiskPercent)}
            reducedMotion={reducedMotion}
          />
          <MetricCell
            label="Capital"
            value={data.capital}
            percent={data.capitalPercent}
            tone="info"
            reducedMotion={reducedMotion}
          />
          <div className="cd-metric-cell cd-metric-cell--glass cd-metric-cell--compact cd-metric-cell--next-action">
            <label>Next action</label>
            <p className="cd-decision__next-action">{data.nextAction}</p>
          </div>
        </div>
      </motion.div>
    </Card>
  );
}
