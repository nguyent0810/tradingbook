import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container animate-in space-y-6 pb-10">
      <div className="dashboard-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-36" />
          <LoadingSkeleton className="h-4 w-64" />
        </div>
        <LoadingSkeleton className="h-10 w-28 rounded-lg" />
      </div>

      <LoadingSkeleton className="h-16 w-full rounded-lg" />

      <div className="dashboard-cockpit-grid">
        <LoadingSkeletonGroup rows={4} className="card p-5" />
        <LoadingSkeletonGroup rows={4} className="card p-5" />
      </div>

      <LoadingSkeleton className="h-20 w-full rounded-lg" />

      <LoadingSkeletonGroup rows={3} />
      <LoadingSkeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
