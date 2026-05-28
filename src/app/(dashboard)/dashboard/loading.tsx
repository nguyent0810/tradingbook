import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="page-container command-deck dash-cockpit dash-cockpit--v2 pb-10"
      aria-busy="true"
    >
      <header className="dash-v2-page-header command-deck-page-header">
        <div className="dash-v2-page-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-32" />
          <LoadingSkeleton className="mb-3 h-9 w-64 max-w-full" />
          <LoadingSkeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex gap-2">
          <LoadingSkeleton className="h-9 w-28 rounded-lg" />
          <LoadingSkeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>

      <div className="dash-cockpit-v2__entrance">
        <div className="command-deck__command-band">
          <LoadingSkeleton className="mb-3 h-10 w-full rounded-lg" />
          <LoadingSkeleton className="mb-3 h-28 w-full rounded-xl" />
          <LoadingSkeleton className="h-16 w-full rounded-lg" />
        </div>

        <div className="command-deck__opportunity-row">
          <LoadingSkeletonGroup rows={4} className="rounded-xl p-4" />
          <LoadingSkeletonGroup rows={3} className="rounded-xl p-4" />
        </div>

        <LoadingSkeleton className="h-36 w-full rounded-xl" />
        <LoadingSkeleton className="h-24 w-full rounded-xl" />
        <LoadingSkeleton className="h-14 w-full rounded-lg" />
        <LoadingSkeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}
