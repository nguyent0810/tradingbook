import type { Trade } from "@/generated/prisma/client";
import { CommandDeckCollapsible } from "@/components/command-deck";
import { DashboardPerformancePanelLazy as DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel-lazy";

export type DashboardBookSnapshotProps = {
  trades: Trade[];
  tradesError?: boolean;
};

export function DashboardBookSnapshot({ trades, tradesError = false }: DashboardBookSnapshotProps) {
  return (
    <CommandDeckCollapsible
      summary="Book snapshot — closed-trade performance"
      testId="dashboard-book-snapshot"
    >
      <div className="dash-v2-card dash-v2-card--inset dash-v2-card--muted">
        <DashboardPerformancePanel trades={trades} error={tradesError} />
      </div>
    </CommandDeckCollapsible>
  );
}
