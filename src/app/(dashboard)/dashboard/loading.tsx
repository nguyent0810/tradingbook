import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import "@/components/command-deck/command-deck.css";

export default function DashboardLoading() {
  return (
    <div className="cd-root" aria-busy="true" data-testid="dashboard-cyber-loading">
      <div className="cd-shell">
        <LoadingSkeleton className="mb-6 h-10 w-full max-w-2xl rounded-lg" />
        <LoadingSkeleton className="mb-5 h-24 w-full rounded-xl" />
        <div className="cd-grid cd-grid--main">
          <LoadingSkeleton className="cd-span-6 min-h-[320px] rounded-xl" />
          <LoadingSkeleton className="cd-span-6 min-h-[320px] rounded-xl" />
          <LoadingSkeleton className="cd-span-6 min-h-[360px] rounded-xl" />
          <LoadingSkeleton className="cd-span-6 min-h-[360px] rounded-xl" />
          <LoadingSkeleton className="cd-span-12 min-h-[120px] rounded-xl" />
          <LoadingSkeleton className="cd-span-12 min-h-[80px] rounded-xl" />
          <LoadingSkeleton className="cd-span-12 min-h-[160px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
