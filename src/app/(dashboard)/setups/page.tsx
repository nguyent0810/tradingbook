import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { V3WorkstationShell } from "@/components/trading-os-v3/shared/v3-workstation-shell";
import { SetupsPageHeader } from "@/components/setups/setups-page-header";
import { getSession } from "@/lib/session";
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

export default async function SetupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <V3WorkstationShell testId="setups-workstation">
      <SetupsPageHeader />

      <div className="tosv3-workstation-flow pipeline-deck__flow">
        <Suspense fallback={<SetupsPipelineContextFallback />}>
          <SetupsPipelineContextAsync />
        </Suspense>

        <Suspense fallback={<SetupsTopFallback />}>
          <SetupsOverviewAsync />
        </Suspense>

        <div className="pipeline-deck__grid tosv3-workstation-grid">
          <div className="pipeline-deck__main tosv3-workstation-main">
            <Suspense fallback={<SetupsCandidatesFallback />}>
              <SetupsCandidatesAsync />
            </Suspense>

            <Suspense fallback={<SetupsTailFallback />}>
              <SetupsTailAsync />
            </Suspense>

            <Suspense fallback={<SetupsMomentumFallback />}>
              <SetupsMomentumDeckAsync />
            </Suspense>
          </div>

          <Suspense fallback={<SetupsSidebarFallback />}>
            <SetupsSidebarAsync />
          </Suspense>
        </div>
      </div>
    </V3WorkstationShell>
  );
}
