import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import { fmtRunDate } from "@/app/(dashboard)/setups/setups-shared-helpers";
import { V3Panel } from "@/components/trading-os-v3/layout";

export type SetupsPipelineSummaryStripProps = {
  latestScan: LatestScanWithCandidates | null;
  nearMissCount: number;
};

export function SetupsPipelineSummaryStrip({
  latestScan,
  nearMissCount,
}: SetupsPipelineSummaryStripProps) {
  if (!latestScan) {
    return (
      <V3Panel className="tosv3-pipeline-command tos-pipeline-summary" glass={false}>
        <span className="tosv3-meta-chip tosv3-meta-chip--muted" data-testid="setups-pipeline-summary-empty">
          No scan run — pipeline counts unavailable
        </span>
      </V3Panel>
    );
  }

  const gate1Label = displayGate1ScanLevel(String(latestScan.gate1Level));

  return (
    <V3Panel
      className="tosv3-pipeline-command tos-pipeline-summary"
      glass={false}
      testId="setups-pipeline-summary"
    >
      <div className="tos-pipeline-summary__flow">
        <div className="tos-pipeline-summary__step">
          <span className="tos-pipeline-summary__label">Universe scanned</span>
          <span className="tos-pipeline-summary__value tabular-nums">
            {latestScan.symbolCountTotal}
          </span>
          <span className="tos-pipeline-summary__hint">symbols in run</span>
        </div>
        <span className="tos-pipeline-summary__arrow" aria-hidden>
          →
        </span>
        <div className="tos-pipeline-summary__step">
          <span className="tos-pipeline-summary__label">Regime filter</span>
          <span className="tos-pipeline-summary__value">{gate1Label}</span>
          <span className="tos-pipeline-summary__hint">
            {latestScan.symbolCountScanned} remaining after stage
          </span>
        </div>
        <span className="tos-pipeline-summary__arrow" aria-hidden>
          →
        </span>
        <div className="tos-pipeline-summary__step">
          <span className="tos-pipeline-summary__label">Tradability</span>
          <span className="tos-pipeline-summary__value tabular-nums">
            {latestScan.symbolCountAfterTradability}
          </span>
          <span className="tos-pipeline-summary__hint">remaining after filters</span>
        </div>
        <span className="tos-pipeline-summary__arrow" aria-hidden>
          →
        </span>
        <div className="tos-pipeline-summary__step">
          <span className="tos-pipeline-summary__label">Surfaced</span>
          <span className="tos-pipeline-summary__value tabular-nums">
            {latestScan.candidateCountSurfaced}
          </span>
          <span className="tos-pipeline-summary__hint">Tier A/B candidates</span>
        </div>
        {nearMissCount > 0 ? (
          <>
            <span className="tos-pipeline-summary__arrow" aria-hidden>
              →
            </span>
            <div className="tos-pipeline-summary__step">
              <span className="tos-pipeline-summary__label">Near-miss</span>
              <span className="tos-pipeline-summary__value tabular-nums">{nearMissCount}</span>
              <span className="tos-pipeline-summary__hint">closest-to-valid symbols</span>
            </div>
          </>
        ) : null}
      </div>
      <span className="tos-pipeline-summary__run tosv3-meta-chip" title={latestScan.id}>
        Run {fmtRunDate(latestScan.runAt)}
      </span>
    </V3Panel>
  );
}
