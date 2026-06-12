import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import { fmtRunDate } from "@/app/(dashboard)/setups/setups-shared-helpers";
import { buildPipelineStages } from "./pipeline-stages";
import { PipelineConnector } from "./PipelineConnector";
import type { PipelineMetricsProps, PipelineStageTone } from "./types";
import "./setups-workstation.css";

function toneClass(tone: PipelineStageTone): string {
  switch (tone) {
    case "success":
      return "sw-pipeline-stage__value--success";
    case "warning":
      return "sw-pipeline-stage__value--warning";
    case "danger":
      return "sw-pipeline-stage__value--danger";
    default:
      return "text-slate-200";
  }
}

export function PipelineMetrics({ latestScan, nearMissCount, gate1Label }: PipelineMetricsProps) {
  if (!latestScan) {
    return (
      <div
        className="sw-glass-panel px-4 py-3"
        data-testid="setups-pipeline-summary-empty"
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          No scan run — pipeline counts unavailable
        </span>
      </div>
    );
  }

  const resolvedGate1 = gate1Label ?? displayGate1ScanLevel(String(latestScan.gate1Level));
  const stages = buildPipelineStages(latestScan, nearMissCount, resolvedGate1);

  return (
    <div
      className="sw-glass-panel px-4 py-3"
      data-testid="setups-pipeline-metrics"
    >
      <div className="flex flex-wrap items-stretch gap-1">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <div className="flex min-w-[7.5rem] flex-col gap-0.5 rounded-lg border border-slate-800/40 bg-slate-950/20 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                {stage.label}
              </span>
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${toneClass(stage.tone)}`}
              >
                {stage.value}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{stage.hint}</span>
            </div>
            {index < stages.length - 1 ? (
              <PipelineConnector active={stage.active && stages[index + 1]!.active} />
            ) : null}
          </div>
        ))}
      </div>
      <span
        className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wide text-slate-500"
        title={latestScan.id}
      >
        Run {fmtRunDate(latestScan.runAt)}
      </span>
    </div>
  );
}
