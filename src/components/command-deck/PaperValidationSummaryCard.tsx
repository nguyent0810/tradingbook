"use client";

import type { PaperValidationSummaryUi } from "@/lib/dashboard/load-paper-validation-summary";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  summary: PaperValidationSummaryUi | null;
  showEarlyEntry: boolean;
};

export function PaperValidationSummaryCard({ summary, showEarlyEntry }: Props) {
  if (!showEarlyEntry || !summary) return null;

  return (
    <Card className="p-3 cd-paper-summary" data-testid="paper-validation-summary">
      <div className="cd-paper-summary__grid">
        <div>
          <span className="cd-kicker">Open signals</span>
          <strong className="cd-mono block text-sm">{summary.openLiveSignals}</strong>
        </div>
        <div>
          <span className="cd-kicker">Resolved pilots</span>
          <strong className="cd-mono block text-sm">{summary.resolvedLivePilots}</strong>
        </div>
        <div>
          <span className="cd-kicker">Pilot false rate</span>
          <strong className="cd-mono block text-sm">
            {summary.pilotFalseRatePct != null ? `${summary.pilotFalseRatePct}%` : "—"}
          </strong>
        </div>
        <div>
          <span className="cd-kicker">Extended avoided (5d)</span>
          <strong className="cd-mono block text-sm">
            {summary.extendedAvoidanceRate5d != null
              ? `${summary.extendedAvoidanceRate5d}%`
              : "—"}
          </strong>
        </div>
        <div className="cd-paper-summary__status">
          <Badge tone="warning" size="compact">
            {summary.statusLabel}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
