import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type SetupsFunnelCompactProps = {
  latestScan: LatestScanWithCandidates;
  nearMissCount: number;
};

export function SetupsFunnelCompact({ latestScan, nearMissCount }: SetupsFunnelCompactProps) {
  const gate1Label = displayGate1ScanLevel(String(latestScan.gate1Level));

  const steps = [
    { label: "Universe", value: latestScan.symbolCountTotal, hint: "scanned" },
    { label: "Regime", value: latestScan.symbolCountScanned, hint: gate1Label },
    { label: "Tradable", value: latestScan.symbolCountAfterTradability, hint: "passed" },
    { label: "Surfaced", value: latestScan.candidateCountSurfaced, hint: "Tier A/B" },
    { label: "Near-miss", value: nearMissCount, hint: "queue" },
  ];

  return (
    <div className="tosv3-setups-funnel-compact" data-testid="setups-pipeline-funnel">
      <p className="tosv3-setups-funnel-compact__intro">
        Symbols remaining after each stage — not rejection counts.
      </p>
      <ul className="tosv3-setups-funnel-compact__steps">
        {steps.map((step) => (
          <li key={step.label} className="tosv3-setups-funnel-compact__step">
            <span className="tosv3-setups-funnel-compact__label">{step.label}</span>
            <span className="tosv3-setups-funnel-compact__value tabular-nums">{step.value}</span>
            <span className="tosv3-setups-funnel-compact__hint">{step.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
