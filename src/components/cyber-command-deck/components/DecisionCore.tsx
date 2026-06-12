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
      return "ccd-decision--crimson";
    case "TRADE":
      return "ccd-decision--emerald";
    case "WAIT":
      return "ccd-decision--amber";
    default:
      return "ccd-decision--cyan";
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
      className={`ccd-panel p-4 ${glowClass}`}
      aria-label="Decision core"
      data-testid="dashboard-cyber-decision-core"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="ccd-kicker">Decision Core</span>
        <span className="ccd-metric text-xs text-slate-400">
          {confidenceLabel(data.confidenceBand)} confidence
        </span>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100 m-0">
          {data.stanceLabel}
        </h2>
        <span className="ccd-label text-[10px]">Today&apos;s stance</span>
      </div>

      <p className="text-sm text-slate-400 mb-3 max-w-prose">{data.primaryReason}</p>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <span className="ccd-label">Risk posture</span>
          <strong className="block mt-1 text-slate-200">{data.riskPosture}</strong>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <span className="ccd-label">Main risk</span>
          <strong className="block mt-1 text-slate-200">{data.mainRisk ?? "—"}</strong>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <span className="ccd-label">Capital</span>
          <strong className="block mt-1 text-slate-200">
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
        <div className="mt-3">
          <span className="ccd-label mb-1">Next action</span>
          <pre className="ccd-next-action m-0">{data.nextAction}</pre>
        </div>
      ) : data.highestQualitySetup ? (
        <div className="mt-3">
          <span className="ccd-label mb-1">Top setup</span>
          <pre className="ccd-next-action m-0">{data.highestQualitySetup}</pre>
        </div>
      ) : (
        <p className="ccd-empty text-left p-0 mt-3">
          No actionable scan detail surfaced in the latest run.
        </p>
      )}
    </section>
  );
}
