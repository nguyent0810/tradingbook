import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import { V3PageShell, V3Panel } from "@/components/trading-os-v3/layout";

export default function TradesLoading() {
  return (
    <V3PageShell pageClassName="tosv3-trades-page" testId="trades-workstation-loading">
      <header className="tosv3-workstation-header" aria-hidden>
        <div className="tosv3-workstation-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-28" />
          <LoadingSkeleton className="mb-3 h-9 w-48 max-w-full" />
          <LoadingSkeleton className="h-4 w-64 max-w-full" />
        </div>
        <LoadingSkeleton className="h-9 w-28 rounded-lg" />
      </header>

      <div className="tosv3-page-shell__flow tosv3-workstation-flow" aria-busy="true">
        <LoadingSkeleton className="h-12 w-full rounded-lg" />
        <div className="tosv3-ledger-summary-row">
          <LoadingSkeleton className="h-24 w-full rounded-xl" />
          <LoadingSkeleton className="h-28 w-full rounded-xl" />
        </div>
        <V3Panel className="tosv3-ledger-filters p-3">
          <LoadingSkeleton className="h-10 flex-1 rounded-lg sm:max-w-xs" />
        </V3Panel>
        <LoadingSkeletonGroup rows={6} className="tosv3-ledger-table-section rounded-xl p-4" />
      </div>
    </V3PageShell>
  );
}
