import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { SetupsPageHeader } from "@/components/setups/setups-page-header";
import { getSession } from "@/lib/session";
import { SetupsCandidatesAsync } from "./setups-candidates-async";
import { SetupsOverviewAsync } from "./setups-overview-async";
import { SetupsPipelineContextAsync } from "./setups-pipeline-context-async";
import { SetupsTailAsync } from "./setups-tail-async";
import {
  SetupsCandidatesFallback,
  SetupsMomentumFallback,
  SetupsPipelineContextFallback,
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
    <div className="page-container animate-in space-y-8 pb-10">
      <SetupsPageHeader />

      <Suspense fallback={<SetupsPipelineContextFallback />}>
        <SetupsPipelineContextAsync />
      </Suspense>

      <Suspense fallback={<SetupsTopFallback />}>
        <SetupsOverviewAsync />
      </Suspense>

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
  );
}
