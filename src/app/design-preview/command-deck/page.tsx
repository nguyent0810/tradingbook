import Link from "next/link";
import { CommandDeckDashboard } from "@/components/command-deck";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";

export default function CommandDeckPreviewPage() {
  const viewModel = buildNoTradePreviewViewModel();

  return (
    <CommandDeckDashboard
      viewModel={viewModel}
      header={
        <header className="mb-6">
          <p className="cd-kicker mb-1">Design preview</p>
          <h1 className="text-2xl font-semibold m-0 mb-1 tracking-tight">Command Deck</h1>
          <p className="text-sm m-0 mb-4" style={{ color: "var(--cd-text-muted)" }}>
            Premium FinTech UI — same component as production /dashboard
          </p>
          <DashboardPageHeader cta={viewModel.headerCta} />
          <Link
            href="/dashboard"
            className="inline-block mt-3 text-xs underline"
            style={{ color: "var(--cd-cyan)" }}
          >
            Open live dashboard →
          </Link>
        </header>
      }
    />
  );
}
