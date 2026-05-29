import Link from "next/link";
import type {
  OpportunityBoardDto,
  OpportunityCandidateDto,
  OpportunityNearMissDto,
  SetupLadderStage,
} from "@/lib/dashboard/decision-cockpit-dto";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { displayScanQualityTier } from "@/lib/trading-display-labels";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardOpportunityPreviewProps = {
  opportunity: OpportunityBoardDto;
};

function formatLadderStage(stage: SetupLadderStage): string {
  const labels: Record<SetupLadderStage, string> = {
    tier_a: "Tier A",
    tier_b: "Tier B",
    watch: "Watch",
    extended: "Extended",
    invalid: "Invalid",
    avoid: "Avoid",
  };
  return labels[stage] ?? stage;
}

function candidateAction(candidate: OpportunityCandidateDto) {
  const match = candidate.actionHint.match(/setupCandidateId=([^)\s]+)/);
  if (match && candidate.actionHint.includes("/trades/new")) {
    return (
      <Link
        href={`/trades/new?setupCandidateId=${match[1]}`}
        className="dash-opportunity__action text-xs font-medium"
      >
        Log trade
      </Link>
    );
  }
  return (
    <Link href="/setups" className="dash-opportunity__action text-xs font-medium">
      View on Setups
    </Link>
  );
}

function NearMissRow({ row }: { row: OpportunityNearMissDto }) {
  const dist =
    row.distanceToZonePct != null
      ? `${row.distanceToZonePct.toFixed(1)}% to zone`
      : null;
  return (
    <li className="dash-opportunity__row" data-testid="dashboard-opportunity-near-miss-row">
      <div className="dash-opportunity__row-head">
        <span className="font-mono font-semibold">{row.symbol}</span>
        <span
          className="dash-opportunity__badge"
          data-testid="dashboard-opportunity-near-miss-status"
        >
          {row.executionStatusLabel}
        </span>
        {dist ? <span className="dash-opportunity__meta tabular-nums">{dist}</span> : null}
      </div>
      <p className="dash-opportunity__summary dash-opportunity__line-clamp">
        {rejectionBucketLabel(row.terminalCategory)} — {row.waitFor}
      </p>
      <p className="dash-opportunity__hint dash-opportunity__line-clamp">{row.actionHint}</p>
      <div className="dash-opportunity__rs mt-2">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          testId={`dashboard-opportunity-near-miss-rs-${row.symbol}`}
        />
      </div>
      <details className="dash-opportunity__details text-xs">
        <summary>Details</summary>
        <p className="mt-1">
          Wait-for: {row.waitFor}
          {dist ? ` · ${dist}` : ""}
        </p>
        <Link href="/setups" className="dash-opportunity__action font-medium">
          Full pipeline →
        </Link>
      </details>
    </li>
  );
}

function CandidateRow({ row }: { row: OpportunityCandidateDto }) {
  return (
    <li className="dash-opportunity__row" data-testid="dashboard-opportunity-candidate-row">
      <div className="dash-opportunity__row-head">
        <span className="font-mono font-semibold">{row.symbol}</span>
        <span className="dash-opportunity__badge">{displayScanQualityTier(row.quality)}</span>
        <span className="dash-opportunity__badge">{formatLadderStage(row.ladderStage)}</span>
      </div>
      {row.healthSummary ? (
        <p className="dash-opportunity__summary dash-opportunity__line-clamp">{row.healthSummary}</p>
      ) : null}
      {row.primaryReasons.length > 0 ? (
        <p className="dash-opportunity__hint dash-opportunity__line-clamp">{row.primaryReasons[0]}</p>
      ) : null}
      {row.rsDiagnostic ? (
        <div className="dash-opportunity__rs mt-2">
          <RelativeStrengthDiagnosticPanel
            diagnostic={row.rsDiagnostic}
            compact
            testId={`dashboard-opportunity-candidate-rs-${row.symbol}`}
          />
        </div>
      ) : null}
      <div className="dash-opportunity__row-actions">
        {candidateAction(row)}
        {(row.primaryReasons.length > 1 || row.healthSummary) ? (
          <details className="dash-opportunity__details text-xs">
            <summary>Details</summary>
            {row.healthSummary ? <p className="mt-1">{row.healthSummary}</p> : null}
            {row.primaryReasons.length > 0 ? (
              <ul className="dash-opportunity__reasons">
                {row.primaryReasons.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
      </div>
    </li>
  );
}

export function DashboardOpportunityPreview({ opportunity }: DashboardOpportunityPreviewProps) {
  const visibleCandidateRows = opportunity.candidates.slice(0, 3);
  const hiddenCandidateCount = Math.max(0, opportunity.candidates.length - visibleCandidateRows.length);
  const visibleNearMissRows = opportunity.nearMiss.slice(0, 3);
  const hiddenNearMissCount = Math.max(0, opportunity.nearMiss.length - visibleNearMissRows.length);

  return (
    <section
      className="dash-opportunity dash-panel dash-surface-1"
      data-testid="dashboard-opportunity-preview"
      aria-labelledby="dashboard-opportunity-heading"
    >
      <header className="dash-panel__header">
        <h2 id="dashboard-opportunity-heading" className="dash-section-title">
          Opportunity preview
        </h2>
        <p className="dash-panel__subtitle">
          Surfaced SetupCandidates when present; otherwise near-miss diagnostics (watch only)
        </p>
      </header>

      {opportunity.mode === "candidates" ? (
        <ul className="dash-opportunity__list" data-testid="dashboard-opportunity-candidates">
          {visibleCandidateRows.map((c) => (
            <CandidateRow key={c.candidateId} row={c} />
          ))}
          {hiddenCandidateCount > 0 ? (
            <li className="dash-opportunity__more text-xs" data-testid="dashboard-opportunity-more">
              +{hiddenCandidateCount} more in{" "}
              <Link href="/setups" className="dash-opportunity__action font-medium">
                Setups
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {opportunity.mode === "near_miss" ? (
        <ul className="dash-opportunity__list" data-testid="dashboard-opportunity-near-miss">
          {visibleNearMissRows.map((row) => (
            <NearMissRow key={row.symbol} row={row} />
          ))}
          {hiddenNearMissCount > 0 ? (
            <li className="dash-opportunity__more text-xs" data-testid="dashboard-opportunity-more">
              +{hiddenNearMissCount} more in{" "}
              <Link href="/setups" className="dash-opportunity__action font-medium">
                Setups
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {opportunity.mode === "empty" ? (
        <div className="dash-empty-compact">
          <EmptyStateWithReason
            title="No opportunity preview from latest scan"
            reason={
              opportunity.emptyReason ??
              "Scan notes did not include surfaced candidates or near-miss rankings."
            }
            data-testid="dashboard-opportunity-empty"
          >
            <Link href="/setups" className="btn btn-secondary text-xs">
              Open Setups pipeline
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : null}
    </section>
  );
}
