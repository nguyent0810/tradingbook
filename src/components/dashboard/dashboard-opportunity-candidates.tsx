import Link from "next/link";
import type { OpportunityBoardDto, OpportunityCandidateDto } from "@/lib/dashboard/decision-cockpit-dto";
import { formatSetupLadderStageLabel } from "@/lib/dashboard/decision-cockpit-dto";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export type DashboardOpportunityCandidatesProps = {
  opportunity: OpportunityBoardDto;
};

function healthLevelToBadgeTone(level: string): BadgeTone {
  switch (level) {
    case "HEALTHY":
      return "success";
    case "WARNING":
      return "warning";
    case "AT_RISK":
      return "at-risk";
    case "DEAD":
      return "dead";
    case "NO_DATA":
      return "dead";
    default:
      return "neutral";
  }
}

const TIER_ACCENT: Record<OpportunityCandidateDto["quality"], string> = {
  A: "var(--cd-success, var(--success))",
  B: "var(--cd-warning, var(--warning))",
};

function CandidateCard({ row }: { row: OpportunityCandidateDto }) {
  return (
    <li
      className="dash-near-miss__card"
      data-testid={`dashboard-opportunity-${row.symbol}`}
      style={{ ["--dash-card-accent" as string]: TIER_ACCENT[row.quality] }}
    >
      <div className="dash-near-miss__head">
        <span className="font-mono font-semibold">{row.symbol}</span>
        <Badge tone={row.quality === "A" ? "tier-a" : "tier-b"} size="compact">
          {row.quality}
        </Badge>
        <Badge tone={healthLevelToBadgeTone(row.healthLevel)} size="compact">
          {row.healthLevel}
        </Badge>
        <span className="dash-chip dash-chip--muted text-xs">
          {formatSetupLadderStageLabel(row.ladderStage)}
        </span>
        <span
          className="dash-near-miss__score tabular-nums"
          data-testid={`dashboard-opportunity-score-${row.symbol}`}
          title="Gate 2 rank score at time of scan"
        >
          {Math.round(row.rankScore)}
        </span>
      </div>
      {row.rankSummary ? <p className="dash-near-miss__note text-sm font-medium">{row.rankSummary}</p> : null}
      {row.primaryReasons.length > 0 ? (
        <p className="dash-near-miss__wait text-sm">{row.primaryReasons.slice(0, 2).join(" · ")}</p>
      ) : null}
      {row.healthSummary ? (
        <p className="dash-near-miss__meta text-xs">{row.healthSummary}</p>
      ) : null}
      <p className="dash-near-miss__meta text-xs" data-testid={`dashboard-opportunity-action-${row.symbol}`}>
        {row.actionHint}
      </p>
      <div className="dash-near-miss__rs mt-2">
        <RelativeStrengthDiagnosticPanel
          diagnostic={row.rsDiagnostic}
          compact
          detail="summary"
          testId={`dashboard-opportunity-rs-${row.symbol}`}
        />
      </div>
    </li>
  );
}

/** Opportunity Board — Tier A/B surfaced candidates, max 5 (UX spec §5.1). */
export function DashboardOpportunityCandidates({
  opportunity,
}: DashboardOpportunityCandidatesProps) {
  const rows = opportunity.candidates.slice(0, 5);

  return (
    <div
      className="dash-v2-card dash-v2-card--inset dash-v2-near-miss"
      data-testid="dashboard-opportunity-candidates-panel"
    >
      <header className="dash-v2-card__header">
        <h3 className="dash-v2-card__title">Best setups</h3>
        <p className="dash-v2-card__lead">
          Surfaced Tier A/B candidates — validated, ready to review.
        </p>
      </header>

      <ul className="dash-near-miss__list">
        {rows.map((row) => (
          <CandidateCard key={row.candidateId} row={row} />
        ))}
      </ul>

      <p className="dash-near-miss__footer text-xs" style={{ color: "var(--text-tertiary)" }}>
        Full pipeline and sizing on{" "}
        <Link href="/setups" className="dash-v2-link">
          Setups pipeline
        </Link>
        .
      </p>
    </div>
  );
}
