import Link from "next/link";
import type {
  OpportunityBoardDto,
  OpportunityNearMissDto,
  SetupLadderStage,
} from "@/lib/dashboard/decision-cockpit-dto";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { rejectionBucketLabel } from "@/lib/scanner/setups-trader-copy";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

export type DashboardNearMissRejectionsPanelProps = {
  opportunity: OpportunityBoardDto;
};

/** Near-miss cards have no quality tier — accent by ladder stage instead. */
const LADDER_ACCENT: Partial<Record<SetupLadderStage, string>> = {
  watch: "var(--cd-warning, var(--warning))",
  extended: "var(--cd-warning, var(--warning))",
  invalid: "var(--cd-text-dim, var(--text-tertiary))",
  avoid: "var(--cd-danger, var(--danger))",
};

function nearMissTraderNote(row: OpportunityNearMissDto): string | null {
  if (row.symbol === "VND" && row.terminalCategory === "pullback_zone_interaction") {
    return "Near-miss — price is above the pullback box, not actionable in the current breakout-pullback template.";
  }
  if (row.symbol === "PDR" && row.terminalCategory === "breakout_recency") {
    return "Gate2 failed breakout-recency; may still appear in Momentum Watch (observational fresh breakout, not a validated setup).";
  }
  return null;
}

function NearMissCard({ row }: { row: OpportunityNearMissDto }) {
  const note = nearMissTraderNote(row);
  const dist =
    row.distanceToZonePct != null
      ? `${row.distanceToZonePct.toFixed(1)}% from pullback zone`
      : null;

  return (
    <li
      className="dash-card dash-card--interactive dash-tile"
      data-testid={`dashboard-near-miss-${row.symbol}`}
      style={{ ["--dash-card-accent" as string]: LADDER_ACCENT[row.ladderStage] ?? "var(--border-primary)" }}
    >
      <div className="dash-tile__head">
        <span className="dash-tile__symbol font-mono">{row.symbol}</span>
        <span
          className="dash-chip dash-chip--muted text-xs"
          data-testid="dashboard-near-miss-diagnostic-status"
        >
          {row.executionStatusLabel}
        </span>
      </div>
      <div className="dash-tile__meta-row">
        <span className="dash-chip dash-chip--muted text-xs">
          {rejectionBucketLabel(row.terminalCategory)}
        </span>
        {dist ? <span className="dash-chip dash-chip--muted text-xs tabular-nums">{dist}</span> : null}
      </div>
      <p className="dash-tile__insight text-sm">{row.waitFor}</p>
      <div className="dash-tile__rs">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          detail="summary"
          testId={`dashboard-near-miss-rs-${row.symbol}`}
        />
      </div>
      {note ? (
        <details className="dash-tile__why">
          <summary className="dash-tile__why-toggle">Note</summary>
          <p className="dash-tile__why-line text-xs">{note}</p>
        </details>
      ) : null}
    </li>
  );
}

/** Near-miss / Gate2 rejection explainer (Command Center v1). */
export function DashboardNearMissRejectionsPanel({
  opportunity,
}: DashboardNearMissRejectionsPanelProps) {
  const rows = opportunity.nearMiss;

  return (
    <div className="dash-card dash-card--muted" data-testid="dashboard-near-miss-panel">
      <header className="dash-card__header">
        <h3 className="dash-card__title">Near miss / rejection</h3>
        <p className="dash-card__lead">
          Gate 2 diagnostics only — closest INVALID names, not SetupCandidate trade signals.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="dash-v2-empty">
          <EmptyStateWithReason
            title="No near-miss ranking in latest scan"
            reason={
              opportunity.emptyReason ??
              "Scanner notes did not include closest-to-valid symbols for this run."
            }
            data-testid="dashboard-near-miss-empty"
          >
            <Link href="/setups" className="btn btn-secondary dash-v2-btn-secondary">
              Open pipeline
            </Link>
          </EmptyStateWithReason>
        </div>
      ) : (
        <>
          <ul className="dash-tile-grid">
            {rows.map((row) => (
              <NearMissCard key={row.symbol} row={row} />
            ))}
          </ul>
          <p className="dash-near-miss__footer text-xs">
            Full rejection buckets and symbol lists are on{" "}
            <Link href="/setups" className="dash-v2-link">
              Setups pipeline
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
