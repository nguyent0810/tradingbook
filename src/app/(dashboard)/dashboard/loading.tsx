import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import "@/components/cyber-command-deck/cyber-command-deck.css";

export default function DashboardLoading() {
  return (
    <div
      className="ccd-root pb-10"
      aria-busy="true"
      data-testid="dashboard-cyber-loading"
    >
      <div className="ccd-bg-grid" aria-hidden />
      <div className="ccd-bg-noise" aria-hidden />
      <div className="ccd-shell">
        <LoadingSkeleton className="mb-4 h-10 w-full max-w-2xl rounded-lg" />
        <LoadingSkeleton className="mb-3 h-16 w-full rounded-xl" />
        <div className="ccd-dashboard-grid">
          <LoadingSkeleton className="min-h-[72px] rounded-xl col-span-full" />
          <LoadingSkeleton className="min-h-[280px] rounded-xl" />
          <LoadingSkeleton className="min-h-[320px] rounded-xl" />
          <LoadingSkeleton className="min-h-[360px] rounded-xl" />
          <LoadingSkeleton className="min-h-[280px] rounded-xl" />
        </div>
        <LoadingSkeleton className="mt-3 h-20 w-full rounded-xl" />
        <LoadingSkeleton className="mt-3 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
