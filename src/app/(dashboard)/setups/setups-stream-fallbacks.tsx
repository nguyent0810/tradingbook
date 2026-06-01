import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import { V3Dock, V3Panel } from "@/components/trading-os-v3/layout";

export function SetupsPipelineContextFallback() {
  return (
    <div className="tos-setups-context space-y-3" aria-busy="true">
      <LoadingSkeleton className="h-12 w-full rounded-lg" />
      <LoadingSkeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

export function SetupsSidebarFallback() {
  return (
    <V3Dock testId="setups-sidebar-loading" aria-label="Pipeline dock loading">
      <LoadingSkeleton className="h-8 w-full rounded-md" />
      <div className="tosv3-layout-dock__body p-2">
        <LoadingSkeleton className="h-36 w-full rounded-lg" />
      </div>
    </V3Dock>
  );
}

export function SetupsTopFallback() {
  return (
    <div className="tosv3-setups-overview-fallback space-y-3" aria-busy="true">
      <V3Panel className="p-4">
        <LoadingSkeleton className="mb-3 h-3 w-36 rounded-md" />
        <LoadingSkeleton className="mb-2 h-8 w-full max-w-lg rounded-md" />
        <LoadingSkeleton className="h-16 w-full max-w-3xl rounded-md" />
      </V3Panel>
      <V3Panel className="p-4">
        <LoadingSkeleton className="mb-2 h-5 w-2/3 max-w-xl rounded-md" />
        <LoadingSkeleton className="mb-2 h-4 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
          <LoadingSkeleton className="h-12 rounded-lg" />
          <LoadingSkeleton className="h-12 rounded-lg" />
          <LoadingSkeleton className="h-12 rounded-lg" />
        </div>
      </V3Panel>
    </div>
  );
}

export function SetupsCandidatesFallback() {
  return (
    <section className="tosv3-setups-cockpit__panel space-y-3" aria-busy="true">
      <header className="tosv3-setups-cockpit__panel-head">
        <LoadingSkeleton className="h-5 w-56 rounded-md" />
        <LoadingSkeleton className="mt-2 h-3 w-72 rounded-md" />
      </header>
      <div className="tosv3-layout-master-detail tosv3-layout-master-detail--compact">
        <aside className="tosv3-layout-master-detail__selector">
          <LoadingSkeletonGroup rows={4} className="rounded-lg border p-3" />
        </aside>
        <div className="tosv3-layout-master-detail__detail">
          <LoadingSkeleton className="min-h-[200px] w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}

export function SetupsMomentumFallback() {
  return (
    <V3Panel className="tosv3-setups-tail__panel p-4" aria-busy="true">
      <LoadingSkeleton className="mb-2 h-5 w-44 rounded-md" />
      <LoadingSkeleton className="mb-3 h-4 w-72 rounded-md" />
      <LoadingSkeleton className="min-h-[140px] w-full rounded-lg" />
    </V3Panel>
  );
}

export function SetupsTailFallback() {
  return (
    <div className="tosv3-setups-tail space-y-3" aria-busy="true">
      <LoadingSkeleton className="h-36 w-full rounded-xl" />
      <LoadingSkeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
