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
        <LoadingSkeleton className="mb-6 h-10 w-full max-w-2xl rounded-lg" />
        <div className="ccd-dashboard-grid">
          <div className="ccd-zone ccd-zone--header">
            <LoadingSkeleton className="min-h-[72px] w-full rounded-xl" />
          </div>
          <div className="ccd-zone ccd-zone--decision">
            <LoadingSkeleton className="min-h-[300px] w-full rounded-xl" />
          </div>
          <div className="ccd-zone ccd-zone--ai">
            <LoadingSkeleton className="min-h-[300px] w-full rounded-xl" />
          </div>
          <div className="ccd-zone ccd-zone--risk">
            <LoadingSkeleton className="min-h-[300px] w-full rounded-xl" />
          </div>
          <div className="ccd-zone ccd-zone--radar">
            <LoadingSkeleton className="min-h-[360px] w-full rounded-xl" />
          </div>
          <div className="ccd-zone ccd-zone--rs">
            <LoadingSkeleton className="min-h-[360px] w-full rounded-xl" />
          </div>
        </div>
        <LoadingSkeleton className="mt-6 h-20 w-full rounded-xl" />
        <LoadingSkeleton className="mt-6 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
