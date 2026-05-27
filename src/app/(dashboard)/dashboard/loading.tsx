import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container dash-cockpit dash-cockpit--v11 pb-10" aria-busy="true">
      <div className="dashboard-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-36" />
          <LoadingSkeleton className="h-4 w-64" />
        </div>
        <LoadingSkeleton className="h-11 w-28 rounded-lg" />
      </div>

      <div className="dash-cockpit-v11__entrance">
        <LoadingSkeleton className="h-14 w-full rounded-lg" />

        <div className="dash-command-panel__hero">
          <LoadingSkeletonGroup rows={4} className="dash-surface-2 rounded-xl p-6" />
          <LoadingSkeletonGroup rows={3} className="dash-surface-1 rounded-lg p-5" />
        </div>

        <LoadingSkeleton className="h-20 w-full rounded-lg" />

        <LoadingSkeletonGroup rows={2} className="dash-surface-1 rounded-lg p-5" />

        <div className="dash-cockpit-v11__observational rounded-lg p-4">
          <LoadingSkeleton className="mb-3 h-5 w-48" />
          <div className="grid gap-4 lg:grid-cols-2">
            <LoadingSkeleton className="h-32 w-full rounded-lg" />
            <LoadingSkeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>

        <LoadingSkeletonGroup rows={3} className="dash-surface-1 rounded-lg p-5" />
      </div>
    </div>
  );
}
