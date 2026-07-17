import type {
  ActionableBlockerDto,
  EvidenceChipDto,
  VerdictDto,
} from "@/lib/dashboard/decision-cockpit-dto";
import { DashboardDecisionHero } from "@/components/dashboard/dashboard-decision-hero";

export type DashboardCommandPanelProps = {
  verdict: VerdictDto;
  surfacedCount: number;
  evidence: EvidenceChipDto[];
  blockers: ActionableBlockerDto[];
};

/**
 * Freshness/scan-meta/conviction/VNINDEX/hostility all moved to the
 * DashboardSignalsRail (collapsible right rail) — this panel is now just
 * the verdict hero, full width.
 */
export function DashboardCommandPanel({
  verdict,
  surfacedCount,
  evidence,
  blockers,
}: DashboardCommandPanelProps) {
  return (
    <section
      className="dash-card dash-card--command"
      data-testid="dashboard-cockpit-zone-decision"
      aria-labelledby="dash-v2-command-heading"
    >
      <h2 id="dash-v2-command-heading" className="dash-sr-only">
        Command center
      </h2>

      <DashboardDecisionHero
        verdict={verdict}
        surfacedCount={surfacedCount}
        evidence={evidence}
        blockers={blockers}
      />
    </section>
  );
}
