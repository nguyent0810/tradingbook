import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function SetupsLoading() {
  return (
    <div className="page-container tos-setups dash-cockpit animate-in pb-10">
      <div className="tos-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-40" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <LoadingSkeleton className="h-4 w-24" />
      </div>

      <div className="tos-setups-context space-y-3">
        <LoadingSkeleton className="h-12 w-full rounded-lg" />
        <LoadingSkeleton className="h-14 w-full rounded-lg" />
      </div>

      <div className="tos-setups-grid">
        <div className="tos-setups-main space-y-5">
          <LoadingSkeletonGroup rows={4} className="dash-surface-1 rounded-lg p-5" />
          <LoadingSkeleton className="h-28 w-full rounded-lg" />
          <LoadingSkeleton className="h-32 w-full rounded-lg" />
        </div>
        <aside className="tos-setups-sidebar space-y-4">
          <LoadingSkeleton className="h-24 w-full rounded-lg" />
          <LoadingSkeleton className="h-40 w-full rounded-lg" />
          <LoadingSkeleton className="h-36 w-full rounded-lg" />
        </aside>
      </div>
    </div>
  );
}
