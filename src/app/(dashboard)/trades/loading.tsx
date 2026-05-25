import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function TradesLoading() {
  return (
    <div className="page-container tos-trades dash-cockpit animate-in space-y-5 pb-10">
      <div className="tos-page-header trades-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-32" />
          <LoadingSkeleton className="h-4 w-48" />
        </div>
        <LoadingSkeleton className="h-10 w-28 rounded-lg" />
      </div>

      <LoadingSkeleton className="h-12 w-full rounded-lg" />
      <LoadingSkeleton className="h-20 w-full rounded-lg" />

      <div className="tos-trades-filters dash-surface-1 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <LoadingSkeleton className="h-10 flex-1 rounded-lg sm:max-w-xs" />
          <LoadingSkeleton className="h-10 w-36 rounded-lg" />
          <LoadingSkeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      <LoadingSkeletonGroup rows={6} className="tos-ledger-table-wrap overflow-hidden p-0" />
    </div>
  );
}
