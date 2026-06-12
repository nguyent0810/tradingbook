"use client";

import { useReducedMotion } from "framer-motion";
import type { V3DecisionHero, V3DecisionMode } from "../types";
import { PlasmaProgressBar } from "./PlasmaProgressBar";

type Props = {
  data: V3DecisionHero;
};

function modeGlowClass(mode: V3DecisionMode): string {
  switch (mode) {
    case "PROTECT CAPITAL":
      return "ccd-decision--crimson ccd-decision--priority";
    case "TRADE":
      return "ccd-decision--muted ccd-decision--trade";
    case "WAIT":
      return "ccd-decision--muted ccd-decision--wait";
    default:
      return "ccd-decision--muted";
  }
}

function confidenceLabel(band: V3DecisionHero["confidenceBand"]): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function DecisionCore({ data }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const glowClass = modeGlowClass(data.mode);

  return (
    <section
      className={`ccd-panel ccd-panel-fill p-5 h-full ${glowClass}`}
      aria-label="Decision core"
      data-testid="dashboard-cyber-decision-core"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="ccd-kicker">Decision Core</span>
        <span className="ccd-metric text-xs text-slate-500">
          {confidenceLabel(data.confidenceBand)} confidence
        </span>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <h2 className="ccd-decision__headline m-0">{data.stanceLabel}</h2>
        <span className="ccd-label text-[10px]">Today&apos;s stance</span>
      </div>

      <p className="text-sm text-slate-400 mb-4 max-w-prose leading-relaxed">
        {data.primaryReason}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
        <div className="ccd-decision__metric-cell">
          <span className="ccd-label">Risk posture</span>
          <strong className="block mt-1.5 text-slate-200">{data.riskPosture}</strong>
        </div>
        <div className="ccd-decision__metric-cell">
          <span className="ccd-label">Main risk</span>
          <strong className="block mt-1.5 text-slate-200">{data.mainRisk ?? "—"}</strong>
        </div>
        <div className="ccd-decision__metric-cell">
          <span className="ccd-label">Capital</span>
          <strong className="block mt-1.5 text-slate-200">
            {data.capitalProtection ?? "—"}
          </strong>
        </div>
      </div>

      <PlasmaProgressBar
        widthPercent={data.confidenceMeterWidth}
        label={`Confidence band ${data.confidenceBand}`}
        reducedMotion={reducedMotion}
      />

      {data.nextAction ? (
        <div className="mt-4">
          <span className="ccd-label mb-1.5">Next action</span>
          <pre className="ccd-next-action m-0">{data.nextAction}</pre>
        </div>
      ) : data.highestQualitySetup ? (
        <div className="mt-4">
          <span className="ccd-label mb-1.5">Top setup</span>
          <pre className="ccd-next-action m-0">{data.highestQualitySetup}</pre>
        </div>
      ) : (
        <p className="ccd-empty text-left p-0 mt-4">
          No actionable scan detail surfaced in the latest run.
        </p>
      )}
    </section>
  );
}
