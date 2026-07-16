import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import "@/components/setups-workstation/setups-workstation.css";

export function SetupsPipelineContextFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <LoadingSkeleton className="h-12 w-full rounded-lg" />
      <LoadingSkeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

export function SetupsSidebarFallback() {
  return (
    <div
      className="sw-glass-panel flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl"
      data-testid="setups-sidebar-loading"
      aria-busy="true"
      aria-label="Pipeline dock loading"
    >
      <LoadingSkeleton className="h-10 w-full rounded-none" />
      <div className="flex-1 p-3">
        <LoadingSkeleton className="h-36 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function SetupsTopFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="sw-glass-panel rounded-xl p-4">
        <LoadingSkeleton className="mb-3 h-3 w-36 rounded-md" />
        <LoadingSkeleton className="mb-2 h-8 w-full max-w-lg rounded-md" />
        <LoadingSkeleton className="h-16 w-full max-w-3xl rounded-md" />
      </div>
      <div className="sw-glass-panel rounded-xl p-4">
        <LoadingSkeleton className="mb-2 h-5 w-2/3 max-w-xl rounded-md" />
        <LoadingSkeleton className="mb-2 h-4 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
          <LoadingSkeleton className="h-12 rounded-lg" />
          <LoadingSkeleton className="h-12 rounded-lg" />
          <LoadingSkeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SetupsCandidatesFallback() {
  return (
    <section className="sw-glass-panel space-y-3 rounded-xl p-4" aria-busy="true">
      <header>
        <LoadingSkeleton className="h-3 w-40 rounded-md" />
        <LoadingSkeleton className="mt-2 h-5 w-56 rounded-md" />
      </header>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        <LoadingSkeletonGroup rows={4} className="rounded-lg border border-[var(--border-primary)]/40 p-3" />
        <LoadingSkeleton className="min-h-[200px] w-full rounded-xl" />
      </div>
    </section>
  );
}

export function SetupsMomentumFallback() {
  return (
    <div className="sw-glass-panel rounded-xl p-4" aria-busy="true">
      <LoadingSkeleton className="mb-2 h-5 w-44 rounded-md" />
      <LoadingSkeleton className="mb-3 h-4 w-72 rounded-md" />
      <LoadingSkeleton className="min-h-[140px] w-full rounded-lg" />
    </div>
  );
}

export function SetupsTailFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="sw-glass-panel grid grid-cols-1 gap-0 rounded-xl lg:grid-cols-[1fr_320px]">
        <LoadingSkeleton className="min-h-[180px] w-full rounded-none lg:rounded-l-xl" />
        <LoadingSkeleton className="min-h-[180px] w-full rounded-none lg:rounded-r-xl" />
      </div>
      <LoadingSkeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
