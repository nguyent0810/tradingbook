import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container dash-cockpit dash-cockpit--v2 pb-12" aria-busy="true">
      <header className="dash-v2-page-header">
        <div className="dash-v2-page-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-40" />
          <LoadingSkeleton className="mb-3 h-9 w-72 max-w-full" />
          <LoadingSkeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex gap-2">
          <LoadingSkeleton className="h-11 w-28 rounded-lg" />
          <LoadingSkeleton className="h-11 w-28 rounded-lg" />
        </div>
      </header>

      <div className="dash-cockpit-v2__entrance">
        <div className="dash-v2-hero-band">
          <LoadingSkeleton className="mb-4 h-12 w-full rounded-xl" />
          <div className="dash-v2-command__hero">
            <LoadingSkeletonGroup rows={3} className="rounded-2xl p-6" />
            <LoadingSkeletonGroup rows={2} className="rounded-2xl p-5" />
          </div>
        </div>
        <LoadingSkeleton className="h-24 w-full rounded-2xl" />
        <LoadingSkeleton className="h-32 w-full rounded-2xl" />
        <LoadingSkeleton className="h-40 w-full rounded-2xl" />
        <LoadingSkeleton className="h-36 w-full rounded-2xl" />
        <LoadingSkeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
