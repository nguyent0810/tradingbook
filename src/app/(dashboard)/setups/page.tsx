import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CommandDeckEntrance } from "@/components/command-deck";
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
    <div className="page-container command-deck pipeline-deck dash-cockpit dash-cockpit--v2 pb-10">
      <SetupsPageHeader />

      <CommandDeckEntrance className="pipeline-deck__flow">
        <Suspense fallback={<SetupsPipelineContextFallback />}>
          <SetupsPipelineContextAsync />
        </Suspense>

        <Suspense fallback={<SetupsTopFallback />}>
          <SetupsOverviewAsync />
        </Suspense>

        <div className="pipeline-deck__grid">
          <div className="pipeline-deck__main">
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
      </CommandDeckEntrance>
    </div>
  );
}
