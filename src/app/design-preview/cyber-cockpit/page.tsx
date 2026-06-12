import { CommandDeckDashboard } from "@/components/command-deck";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";

/** Non-production — same Command Deck UI as /dashboard with a NO TRADE fixture. */
export default function CyberCockpitPreviewPage() {
  const viewModel = buildNoTradePreviewViewModel();

  return (
    <CommandDeckDashboard
      viewModel={viewModel}
      header={
        <div className="mb-6">
          <DashboardPageHeader cta={viewModel.headerCta} />
        </div>
      }
    />
  );
}
