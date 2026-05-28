import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function TradesLoading() {
  return (
    <div
      className="page-container command-deck ledger-deck pipeline-deck dash-cockpit dash-cockpit--v2 pb-10"
      aria-busy="true"
    >
      <header className="dash-v2-page-header command-deck-page-header">
        <div className="dash-v2-page-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-28" />
          <LoadingSkeleton className="mb-3 h-9 w-48 max-w-full" />
          <LoadingSkeleton className="h-4 w-64 max-w-full" />
        </div>
        <LoadingSkeleton className="h-9 w-28 rounded-lg" />
      </header>

      <div className="ledger-deck__flow">
        <LoadingSkeleton className="h-12 w-full rounded-lg" />
        <div className="ledger-deck__summary-row">
          <LoadingSkeleton className="h-24 w-full rounded-xl" />
          <LoadingSkeleton className="h-28 w-full rounded-xl" />
        </div>
        <LoadingSkeleton className="h-32 w-full rounded-xl" />
        <div className="ledger-deck-filters-skeleton">
          <LoadingSkeleton className="h-10 flex-1 rounded-lg sm:max-w-xs" />
          <LoadingSkeleton className="h-10 w-32 rounded-lg" />
          <LoadingSkeleton className="h-10 w-32 rounded-lg" />
        </div>
        <LoadingSkeletonGroup rows={6} className="ledger-deck-panel rounded-xl p-4" />
      </div>
    </div>
  );
}
