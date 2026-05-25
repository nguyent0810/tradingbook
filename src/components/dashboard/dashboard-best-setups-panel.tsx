import Link from "next/link";
import { Fragment } from "react";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import { distanceToZonePct } from "@/lib/setup-health";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import {
  formatBarDataDateUtcLong,
  formatEquityThousandVndPerShare,
} from "@/lib/formatters";
import {
  displayCandidateLifecycleSortLabel,
  displayGate1ScanLevel,
  displayScanQualityTier,
} from "@/lib/trading-display-labels";

export type DashboardBestSetupsPanelProps = {
  topSetups: SurfacedCandidateHealthView[];
  latestScan: LatestScanWithCandidates | null;
};

export function DashboardBestSetupsPanel({
  topSetups,
  latestScan,
}: DashboardBestSetupsPanelProps) {
  return (
    <section className="dash-panel dash-surface-1" data-testid="dashboard-best-setups-panel">
      <header className="dash-panel__header">
        <h2 className="dash-section-title">Best setups</h2>
        <p className="dash-panel__subtitle">Tier A/B surfaced — top five for today</p>
      </header>

      {topSetups.length === 0 ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="No qualified setups in the latest scan"
            reason={
              latestScan
                ? `Zero Tier A/B surfaced is normal when Gate 1 is ${displayGate1ScanLevel(latestScan.gate1Level)} and filters are strict (${latestScan.candidateCountSurfaced} surfaced). Near-miss symbols and rejection detail live on Setups.`
                : "No daily scan yet — wait for production bar import + scan automation."
            }
            data-testid="dashboard-best-setups-empty"
          >
            <Link href="/setups" className="btn btn-secondary text-xs">
              Open Setups pipeline
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : (
        <div className="table-container">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Status</th>
                <th>Health</th>
                <th className="table-num">Score</th>
                <th className="table-num">Close (k ₫)</th>
                <th className="table-num">Zone (k ₫)</th>
                <th className="table-num">Stop</th>
                <th className="table-num">Bar (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {topSetups.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td className="max-w-[280px] align-top">
                      <SetupsCandidateHealthStrip
                        symbolKey={c.symbolKey}
                        lifecycleSortLabel={c.lifecycleSortLabel}
                        healthLevel={c.healthLevel}
                        healthScore={c.healthScore}
                        healthScoreLabel={c.healthScoreLabel}
                        healthLines={c.healthLines}
                        healthHint={c.healthHint}
                        compact
                      />
                    </td>
                    <td className="align-top">
                      {displayCandidateLifecycleSortLabel(c.lifecycleSortLabel)}
                    </td>
                    <td className="align-top">{c.healthLevel.replace("_", " ")}</td>
                    <td className="table-num align-top">
                      {c.healthScoreLabel} ({c.healthScore})
                    </td>
                    <td className="table-num align-top">
                      {formatEquityThousandVndPerShare(c.close)}
                    </td>
                    <td className="table-num">
                      {formatEquityThousandVndPerShare(c.pullbackZoneLow)} –{" "}
                      {formatEquityThousandVndPerShare(c.pullbackZoneHigh)}
                    </td>
                    <td className="table-num">
                      {formatEquityThousandVndPerShare(c.stopLevel)}
                    </td>
                    <td className="table-num whitespace-nowrap text-xs">
                      {formatBarDataDateUtcLong(new Date(c.barDate))}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={8}
                      className="border-t p-0 align-top"
                      style={{ borderColor: "var(--border-primary)" }}
                    >
                      <details className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <summary
                          className="cursor-pointer font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          Candidate details
                        </summary>
                        {c.healthSummary ? <p className="mt-2">{c.healthSummary}</p> : null}
                        {c.healthHint ? (
                          <p className="mt-1 italic" style={{ color: "var(--text-tertiary)" }}>
                            {c.healthHint}
                          </p>
                        ) : null}
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          <li>
                            Distance to zone:{" "}
                            {(distanceToZonePct(c.close, c.pullbackZoneLow, c.pullbackZoneHigh) * 100).toFixed(1)}%
                          </li>
                          <li>Quality: {displayScanQualityTier(c.quality)}</li>
                          <li>Rank: {c.rankScore.toFixed(2)}</li>
                        </ul>
                        {Array.isArray(c.reasons) && c.reasons.length > 0 ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 leading-snug">
                            {c.reasons.map((line, i) => (
                              <li key={i} className="break-words">
                                {String(line)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
