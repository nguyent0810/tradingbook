import type { CSSProperties } from "react";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import { displayCandidateLifecycleSortLabel } from "@/lib/trading-display-labels";

type Props = {
  symbolKey: string;
  lifecycleSortLabel: "READY" | "WATCHING";
  healthLevel: SetupHealthLevelValue;
  healthScore: number;
  healthScoreLabel: "Strong" | "Decent" | "Weak" | "Risky";
  healthLines: string[];
  healthHint: string | null;
  compact?: boolean;
};

function pillClassneutral(): string {
  return "rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide";
}

function lifecycleStyles(label: "READY" | "WATCHING"): CSSProperties {
  if (label === "READY") {
    return {
      backgroundColor: "color-mix(in srgb, var(--accent-text) 14%, transparent)",
      color: "var(--accent-text)",
    };
  }
  return {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-secondary)",
  };
}

function healthLevelStyles(level: SetupHealthLevelValue): CSSProperties {
  switch (level) {
    case "HEALTHY":
      return {
        backgroundColor: "color-mix(in srgb, #22c55e 18%, transparent)",
        color: "#166534",
      };
    case "WARNING":
      return {
        backgroundColor: "color-mix(in srgb, #eab308 22%, transparent)",
        color: "#854d0e",
      };
    case "AT_RISK":
      return {
        backgroundColor: "color-mix(in srgb, #f97316 22%, transparent)",
        color: "#9a3412",
      };
    case "DEAD":
      return {
        backgroundColor: "color-mix(in srgb, #ef4444 20%, transparent)",
        color: "#991b1b",
      };
    default:
      return { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" };
  }
}

export function SetupsCandidateHealthStrip({
  symbolKey,
  lifecycleSortLabel,
  healthLevel,
  healthScore,
  healthScoreLabel,
  healthLines,
  healthHint,
  compact = false,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
          {symbolKey}
        </span>
        <span className={pillClassneutral()} style={lifecycleStyles(lifecycleSortLabel)}>
          {displayCandidateLifecycleSortLabel(lifecycleSortLabel)}
        </span>
        <span className={pillClassneutral()} style={healthLevelStyles(healthLevel)}>
          {healthLevel.replace("_", " ")}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {healthScoreLabel} ({healthScore})
        </span>
      </div>
      {!compact && healthLines.length > 0 ? (
        <ul className="space-y-0.5 text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
          {healthLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!compact && healthHint ? (
        <p className="text-xs italic leading-snug" style={{ color: "var(--text-tertiary)" }}>
          {healthHint}
        </p>
      ) : null}
    </div>
  );
}
