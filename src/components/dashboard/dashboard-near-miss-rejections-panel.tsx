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
      className="dash-near-miss__card"
      data-testid={`dashboard-near-miss-${row.symbol}`}
      style={{ ["--dash-card-accent" as string]: LADDER_ACCENT[row.ladderStage] ?? "var(--border-primary)" }}
    >
      <div className="dash-near-miss__head">
        <span className="font-mono font-semibold">{row.symbol}</span>
        <span
          className="dash-chip dash-chip--muted text-xs"
          data-testid="dashboard-near-miss-diagnostic-status"
        >
          {row.executionStatusLabel}
        </span>
        <span className="dash-chip dash-chip--muted text-xs">
          {rejectionBucketLabel(row.terminalCategory)}
        </span>
        <span
          className="dash-near-miss__score tabular-nums"
          data-testid={`dashboard-near-miss-score-${row.symbol}`}
          title="Gate 2 pipeline-depth score — how far this symbol got before failing (not a rank score)"
        >
          {Math.round(row.partialPipelineScore)}
        </span>
      </div>
      {note ? <p className="dash-near-miss__note text-sm font-medium">{note}</p> : null}
      <p className="dash-near-miss__wait text-sm">{row.waitFor}</p>
      {dist ? <p className="dash-near-miss__meta text-xs tabular-nums">{dist}</p> : null}
      <div className="dash-near-miss__rs mt-2">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          testId={`dashboard-near-miss-rs-${row.symbol}`}
        />
      </div>
    </li>
  );
}

/** Near-miss / Gate2 rejection explainer (Command Center v1). */
export function DashboardNearMissRejectionsPanel({
  opportunity,
}: DashboardNearMissRejectionsPanelProps) {
  const rows = opportunity.nearMiss;

  return (
    <div className="dash-v2-card dash-v2-card--inset dash-v2-near-miss" data-testid="dashboard-near-miss-panel">
      <header className="dash-v2-card__header">
        <h3 className="dash-v2-card__title">Near miss / rejection</h3>
        <p className="dash-v2-card__lead">
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
          <ul className="dash-near-miss__list">
            {rows.map((row) => (
              <NearMissCard key={row.symbol} row={row} />
            ))}
          </ul>
          <p className="dash-near-miss__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
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
