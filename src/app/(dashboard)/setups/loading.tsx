import { LoadingSkeleton, LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";
import { V3ContentGrid, V3PageShell, V3Panel } from "@/components/trading-os-v3/layout";

export default function SetupsLoading() {
  return (
    <V3PageShell pageClassName="tosv3-setups-page" testId="setups-workstation-loading">
      <header className="tosv3-workstation-header" aria-hidden>
        <div className="tosv3-workstation-header__copy">
          <LoadingSkeleton className="mb-2 h-3 w-32" />
          <LoadingSkeleton className="mb-3 h-9 w-56 max-w-full" />
          <LoadingSkeleton className="h-4 w-full max-w-md" />
        </div>
        <LoadingSkeleton className="h-9 w-32 rounded-lg" />
      </header>

      <div className="tosv3-page-shell__flow tosv3-workstation-flow tosv3-setups-flow" aria-busy="true">
        <LoadingSkeleton className="h-10 w-full rounded-lg" />
        <LoadingSkeleton className="h-12 w-full rounded-lg" />

        <V3ContentGrid aria-label="Setup pipeline cockpit loading">
          <V3ContentGrid.Main>
            <V3Panel className="tosv3-setups-cockpit-panel space-y-3">
              <LoadingSkeleton className="h-5 w-48 rounded-md" />
              <LoadingSkeleton className="h-3 w-64 rounded-md" />
              <section className="tosv3-layout-master-detail tosv3-layout-master-detail--compact" aria-hidden>
                <aside className="tosv3-layout-master-detail__selector">
                  <LoadingSkeletonGroup rows={4} className="rounded-lg p-3" />
                </aside>
                <div className="tosv3-layout-master-detail__detail">
                  <LoadingSkeleton className="min-h-[220px] w-full rounded-xl" />
                </div>
              </section>
            </V3Panel>
          </V3ContentGrid.Main>
          <V3ContentGrid.Aside>
            <div className="tosv3-layout-dock tosv3-panel tosv3-glass-panel space-y-3 p-3" aria-hidden>
              <LoadingSkeleton className="h-8 w-full rounded-lg" />
              <LoadingSkeleton className="h-36 w-full rounded-xl" />
              <LoadingSkeleton className="h-32 w-full rounded-xl" />
            </div>
          </V3ContentGrid.Aside>
        </V3ContentGrid>

        <LoadingSkeleton className="h-14 w-full rounded-lg" />
      </div>
    </V3PageShell>
  );
}
