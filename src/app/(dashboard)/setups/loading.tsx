import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export default function SetupsLoading() {
  return (
    <div className="tosv3-page-shell tosv3-workstation pb-10 tosv3-setups-page" aria-busy="true">
      <div className="tosv3-page-shell__bg-grid tosv3-workstation__bg-grid" aria-hidden />
      <div className="tosv3-page-shell__bg-noise tosv3-workstation__bg-noise" aria-hidden />
      <div className="tosv3-page-shell__inner tosv3-workstation__inner">
        <header className="tosv3-workstation-header">
          <div className="tosv3-workstation-header__copy">
            <LoadingSkeleton className="mb-2 h-3 w-32" />
            <LoadingSkeleton className="mb-3 h-9 w-56 max-w-full" />
            <LoadingSkeleton className="h-4 w-full max-w-md" />
          </div>
          <LoadingSkeleton className="h-9 w-32 rounded-lg" />
        </header>

        <div className="tosv3-page-shell__flow tosv3-workstation-flow tosv3-setups-flow">
          <LoadingSkeleton className="h-10 w-full rounded-lg" />
          <LoadingSkeleton className="h-12 w-full rounded-lg" />

          <section className="tosv3-layout-cockpit" aria-hidden>
            <div className="tosv3-layout-cockpit__main">
              <div className="tosv3-panel tosv3-glass-panel tosv3-setups-cockpit-panel space-y-3">
                <LoadingSkeletonGroup rows={5} className="rounded-xl p-4" />
                <LoadingSkeleton className="h-28 w-full rounded-xl" />
              </div>
            </div>
            <aside className="tosv3-layout-cockpit__aside">
              <div className="tosv3-layout-dock tosv3-panel tosv3-glass-panel space-y-3 p-3">
                <LoadingSkeleton className="h-8 w-full rounded-lg" />
                <LoadingSkeleton className="h-36 w-full rounded-xl" />
                <LoadingSkeleton className="h-32 w-full rounded-xl" />
              </div>
            </aside>
          </section>

          <LoadingSkeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
