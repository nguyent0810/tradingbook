import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="tosv3-page-shell pb-10 tosv3-dashboard-page"
      aria-busy="true"
      data-testid="dashboard-v3-loading"
    >
      <div className="tosv3-page-shell__bg-grid" aria-hidden />
      <div className="tosv3-page-shell__bg-noise" aria-hidden />
      <div className="tosv3-page-shell__inner">
        <div className="tosv3-shell tosv3-dashboard-shell">
          <LoadingSkeleton className="mb-4 h-10 w-full max-w-2xl rounded-lg" />
          <LoadingSkeleton className="mb-3 h-16 w-full rounded-xl" />
          <LoadingSkeleton className="mb-3 h-40 w-full rounded-xl" />
          <div className="tosv3-dashboard-grid">
            <LoadingSkeleton className="min-h-[280px] rounded-xl" />
            <LoadingSkeleton className="min-h-[220px] rounded-xl" />
            <LoadingSkeleton className="min-h-[320px] rounded-xl lg:col-span-1" />
            <LoadingSkeleton className="min-h-[280px] rounded-xl" />
          </div>
          <LoadingSkeleton className="mt-3 h-20 w-full rounded-xl" />
          <LoadingSkeleton className="mt-3 h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
