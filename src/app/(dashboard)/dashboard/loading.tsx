import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container dash-cockpit animate-in pb-10">
      <div className="dashboard-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-36" />
          <LoadingSkeleton className="h-4 w-64" />
        </div>
        <LoadingSkeleton className="h-10 w-28 rounded-lg" />
      </div>

      <LoadingSkeleton className="h-12 w-full rounded-lg" />

      <div className="dash-cockpit__hero-row">
        <LoadingSkeletonGroup rows={5} className="dash-surface-2 rounded-xl p-6" />
        <LoadingSkeletonGroup rows={4} className="dash-surface-1 rounded-lg p-5" />
      </div>

      <div className="dash-cockpit__secondary-row">
        <LoadingSkeleton className="h-14 w-full rounded-lg" />
        <LoadingSkeletonGroup rows={3} className="dash-surface-1 rounded-lg p-5" />
      </div>

      <LoadingSkeletonGroup rows={2} className="dash-surface-1 rounded-lg p-5" />
      <LoadingSkeleton className="h-24 w-full rounded-lg" />
      <LoadingSkeletonGroup rows={3} className="dash-surface-1 rounded-lg p-5" />
    </div>
  );
}
