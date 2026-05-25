import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function TradesLoading() {
  return (
    <div className="page-container animate-in space-y-6 pb-10">
      <div className="trades-page-header">
        <div>
          <LoadingSkeleton className="mb-2 h-7 w-24" />
          <LoadingSkeleton className="h-4 w-40" />
        </div>
        <LoadingSkeleton className="h-10 w-28 rounded-lg" />
      </div>

      <LoadingSkeleton className="h-16 w-full rounded-lg" />
      <LoadingSkeleton className="h-20 w-full rounded-lg" />

      <div className="flex flex-wrap gap-3">
        <LoadingSkeleton className="h-10 flex-1 rounded-lg sm:max-w-xs" />
        <LoadingSkeleton className="h-10 w-36 rounded-lg" />
        <LoadingSkeleton className="h-10 w-36 rounded-lg" />
      </div>

      <LoadingSkeletonGroup rows={6} className="card overflow-hidden p-0" />
    </div>
  );
}
