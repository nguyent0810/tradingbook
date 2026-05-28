import type { Trade } from "@/generated/prisma/client";
import { CommandDeckCollapsible } from "@/components/command-deck";
import { DashboardPerformancePanel } from "@/components/dashboard/dashboard-performance-panel";

export type DashboardBookSnapshotProps = {
  trades: Trade[];
};

export function DashboardBookSnapshot({ trades }: DashboardBookSnapshotProps) {
  return (
    <CommandDeckCollapsible
      summary="Book snapshot — closed-trade performance"
      testId="dashboard-book-snapshot"
    >
      <div className="dash-v2-card dash-v2-card--inset dash-v2-card--muted">
        <DashboardPerformancePanel trades={trades} />
      </div>
    </CommandDeckCollapsible>
  );
}
