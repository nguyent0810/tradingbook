import type { Metadata } from "next";
import { Suspense } from "react";
import {
  V3ContentGrid,
  V3PageShell,
  V3Panel,
} from "@/components/trading-os-v3/layout";
import { SetupsPageHeader } from "@/components/setups/setups-page-header";
import { SetupsCandidatesAsync } from "./setups-candidates-async";
import { SetupsOverviewAsync } from "./setups-overview-async";
import { SetupsPipelineContextAsync } from "./setups-pipeline-context-async";
import { SetupsSidebarAsync } from "./setups-sidebar-async";
import { SetupsTailAsync } from "./setups-tail-async";
import { SetupsMomentumDeckAsync } from "./setups-momentum-deck-async";
import {
  SetupsCandidatesFallback,
  SetupsMomentumFallback,
  SetupsPipelineContextFallback,
  SetupsSidebarFallback,
  SetupsTailFallback,
  SetupsTopFallback,
} from "./setups-stream-fallbacks";

export const metadata: Metadata = {
  title: "Setups — TradeLog",
  description: "Latest daily scanner run and breakout/pullback candidates.",
};

/** Skip SSG — page runs heavy read-only DB diagnostics (e.g. Gate 2 breakdown) at request time. */
export const dynamic = "force-dynamic";

export default async function SetupsPage() {
  return (
    <V3PageShell testId="setups-workstation" pageClassName="tosv3-setups-page">
      <SetupsPageHeader />

      <div className="tosv3-page-shell__flow tosv3-workstation-flow tosv3-setups-flow">
        <Suspense fallback={<SetupsPipelineContextFallback />}>
          <SetupsPipelineContextAsync />
        </Suspense>

        <Suspense fallback={<SetupsTopFallback />}>
          <SetupsOverviewAsync />
        </Suspense>

        <V3ContentGrid aria-label="Setup pipeline cockpit">
          <V3ContentGrid.Main>
            <V3Panel className="tosv3-setups-cockpit-panel">
              <Suspense fallback={<SetupsCandidatesFallback />}>
                <SetupsCandidatesAsync />
              </Suspense>
            </V3Panel>
          </V3ContentGrid.Main>
          <V3ContentGrid.Aside>
            <Suspense fallback={<SetupsSidebarFallback />}>
              <SetupsSidebarAsync />
            </Suspense>
          </V3ContentGrid.Aside>
        </V3ContentGrid>

        <Suspense fallback={<SetupsTailFallback />}>
          <SetupsTailAsync />
        </Suspense>

        <Suspense fallback={<SetupsMomentumFallback />}>
          <SetupsMomentumDeckAsync />
        </Suspense>
      </div>
    </V3PageShell>
  );
}
