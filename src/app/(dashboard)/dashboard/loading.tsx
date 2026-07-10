import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="page-container command-deck dash-cockpit dash-cockpit--v2 pb-10"
      aria-busy="true"
      data-testid="dashboard-cockpit-loading"
    >
      <LoadingSkeleton className="mb-4 h-10 w-full max-w-2xl rounded-lg" />
      <LoadingSkeleton className="mb-5 h-40 w-full rounded-xl" />
      <div className="command-deck__opportunity-row">
        <LoadingSkeleton className="min-h-[260px] rounded-xl" />
        <LoadingSkeleton className="min-h-[260px] rounded-xl" />
      </div>
      <LoadingSkeleton className="mb-5 mt-5 min-h-[160px] rounded-xl" />
      <LoadingSkeleton className="mb-5 min-h-[100px] rounded-xl" />
      <LoadingSkeleton className="min-h-[200px] rounded-xl" />
    </div>
  );
}
