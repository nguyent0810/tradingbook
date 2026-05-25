import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { SetupsPageHeader } from "@/components/setups/setups-page-header";
import { getSession } from "@/lib/session";
import { SetupsCandidatesAsync } from "./setups-candidates-async";
import { SetupsOverviewAsync } from "./setups-overview-async";
import { SetupsPipelineContextAsync } from "./setups-pipeline-context-async";
import { SetupsSidebarAsync } from "./setups-sidebar-async";
import { SetupsTailAsync } from "./setups-tail-async";
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
    <div className="page-container tos-setups dash-cockpit animate-in pb-10">
      <SetupsPageHeader />

      <Suspense fallback={<SetupsPipelineContextFallback />}>
        <SetupsPipelineContextAsync />
      </Suspense>

      <Suspense fallback={<SetupsTopFallback />}>
        <SetupsOverviewAsync />
      </Suspense>

      <div className="tos-setups-grid">
        <div className="tos-setups-main space-y-5">
          <Suspense fallback={<SetupsCandidatesFallback />}>
            <SetupsCandidatesAsync />
          </Suspense>

          <Suspense fallback={<SetupsMomentumFallback />}>
            <MomentumWatchSection />
          </Suspense>

          <Suspense fallback={<SetupsTailFallback />}>
            <SetupsTailAsync />
          </Suspense>
        </div>

        <Suspense fallback={<SetupsSidebarFallback />}>
          <SetupsSidebarAsync />
        </Suspense>
      </div>
    </div>
  );
}
