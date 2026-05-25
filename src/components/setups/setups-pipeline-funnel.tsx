import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

export type SetupsPipelineFunnelProps = {
  latestScan: LatestScanWithCandidates;
  nearMissCount: number;
};

/** Vertical funnel — counts are remaining symbols after each stage. */
export function SetupsPipelineFunnel({ latestScan, nearMissCount }: SetupsPipelineFunnelProps) {
  const gate1Label = displayGate1ScanLevel(String(latestScan.gate1Level));

  const steps = [
    {
      label: "1. Universe scanned",
      value: String(latestScan.symbolCountTotal),
      hint: "Total symbols in daily run",
      accent: "",
    },
    {
      label: `2. Gate 1 (${gate1Label})`,
      value: String(latestScan.symbolCountScanned),
      hint: "Remaining after universe / regime stage",
      accent: "tos-funnel__row--ok",
    },
    {
      label: "3. Tradability & session",
      value: String(latestScan.symbolCountAfterTradability),
      hint: "Remaining after liquidity filters",
      accent: "tos-funnel__row--accent",
    },
    {
      label: "4. Surfaced Tier A/B",
      value: String(latestScan.candidateCountSurfaced),
      hint: "Qualified pullback/breakout setups",
      accent: "tos-funnel__row--warn",
    },
    {
      label: "5. Near-miss queue",
      value: String(nearMissCount),
      hint: "Closest-to-valid (not surfaced)",
      accent: nearMissCount > 0 ? "tos-funnel__row--muted" : "",
    },
  ];

  return (
    <section className="tos-funnel dash-surface-1" data-testid="setups-pipeline-funnel">
      <h2 className="dash-section-title">Pipeline funnel</h2>
      <p className="tos-funnel__intro">
        Counts show symbols <strong>remaining after each stage</strong>, not how many were rejected.
      </p>
      <ul className="tos-funnel__list">
        {steps.map((step) => (
          <li key={step.label} className={`tos-funnel__row ${step.accent}`.trim()}>
            <span className="tos-funnel__label">{step.label}</span>
            <span className="tos-funnel__value tabular-nums">{step.value}</span>
            <span className="tos-funnel__hint">{step.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
