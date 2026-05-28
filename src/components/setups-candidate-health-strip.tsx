import type { SetupHealthLevelValue } from "@/lib/setup-health";
import {
  SignalBadge,
  healthLevelToBadgeVariant,
} from "@/components/command-deck/signal-badge";
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
  const lifecycleVariant = lifecycleSortLabel === "READY" ? "ready" : "watching";

  return (
    <div className="setup-health-strip">
      <div className="setup-health-strip__chips">
        <span className="setup-health-strip__symbol mono">{symbolKey}</span>
        <SignalBadge variant={lifecycleVariant}>
          {displayCandidateLifecycleSortLabel(lifecycleSortLabel)}
        </SignalBadge>
        <SignalBadge
          variant={healthLevelToBadgeVariant(healthLevel)}
          title={`Health: ${healthLevel.replace("_", " ")}`}
        >
          {healthLevel.replace("_", " ")}
        </SignalBadge>
        <span className="setup-health-strip__score" aria-label={`Score label ${healthScoreLabel}`}>
          {healthScoreLabel} ({healthScore})
        </span>
      </div>
      {!compact && healthLines.length > 0 ? (
        <ul className="setup-health-strip__lines">
          {healthLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!compact && healthHint ? (
        <p className="setup-health-strip__hint">{healthHint}</p>
      ) : null}
    </div>
  );
}
