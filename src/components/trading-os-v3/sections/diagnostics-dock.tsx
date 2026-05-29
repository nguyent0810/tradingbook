import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { EvidenceLayer } from "./evidence-layer";
import { RelativeStrengthRadar } from "./relative-strength-radar";

type Props = {
  rsWatchlist: DashboardV3ViewModel["rsWatchlist"];
  evidence: DashboardV3ViewModel["evidence"];
};

export function DiagnosticsDock({ rsWatchlist, evidence }: Props) {
  return (
    <div className="tosv3-diagnostics-dock" data-testid="dashboard-v3-diagnostics-dock">
      <div className="tosv3-diagnostics-dock__intel">
        <RelativeStrengthRadar panel={rsWatchlist} />
      </div>
      <EvidenceLayer items={evidence} />
    </div>
  );
}
