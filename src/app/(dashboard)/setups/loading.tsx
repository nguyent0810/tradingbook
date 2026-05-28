import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function SetupsLoading() {
  return (
    <div
      className="page-container command-deck pipeline-deck dash-cockpit dash-cockpit--v2 pb-10"
      aria-busy="true"
    >
      <header className="dash-v2-page-header command-deck-page-header">
        <div className="dash-v2-page-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-32" />
          <LoadingSkeleton className="mb-3 h-9 w-56 max-w-full" />
          <LoadingSkeleton className="h-4 w-full max-w-md" />
        </div>
        <LoadingSkeleton className="h-9 w-32 rounded-lg" />
      </header>

      <div className="pipeline-deck__flow">
        <div className="pipeline-deck__trust space-y-3">
          <LoadingSkeleton className="h-10 w-full rounded-lg" />
          <LoadingSkeleton className="h-12 w-full rounded-lg" />
        </div>

        <div className="pipeline-deck__grid">
          <div className="pipeline-deck__main space-y-4">
            <LoadingSkeletonGroup rows={5} className="rounded-xl p-4" />
            <LoadingSkeleton className="h-28 w-full rounded-xl" />
            <LoadingSkeleton className="h-14 w-full rounded-lg" />
          </div>
          <aside className="pipeline-deck__sidebar space-y-4">
            <LoadingSkeleton className="h-24 w-full rounded-xl" />
            <LoadingSkeleton className="h-36 w-full rounded-xl" />
            <LoadingSkeleton className="h-32 w-full rounded-xl" />
          </aside>
        </div>
      </div>
    </div>
  );
}
