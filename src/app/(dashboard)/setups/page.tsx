import type { Metadata } from "next";
import { Suspense } from "react";
import { V3PageShell } from "@/components/trading-os-v3/layout";
import { WorkstationShell } from "@/components/setups-workstation";
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
    <V3PageShell testId="setups-workstation" pageClassName="tosv3-setups-page bg-[var(--bg-primary)]">
      <WorkstationShell
        header={<SetupsPageHeader />}
        pipeline={
          <Suspense fallback={<SetupsPipelineContextFallback />}>
            <SetupsPipelineContextAsync />
          </Suspense>
        }
        overview={
          <Suspense fallback={<SetupsTopFallback />}>
            <SetupsOverviewAsync />
          </Suspense>
        }
        main={
          <Suspense fallback={<SetupsCandidatesFallback />}>
            <SetupsCandidatesAsync />
          </Suspense>
        }
        aside={
          <Suspense fallback={<SetupsSidebarFallback />}>
            <SetupsSidebarAsync />
          </Suspense>
        }
        tail={
          <Suspense fallback={<SetupsTailFallback />}>
            <SetupsTailAsync />
          </Suspense>
        }
        momentum={
          <Suspense fallback={<SetupsMomentumFallback />}>
            <SetupsMomentumDeckAsync />
          </Suspense>
        }
      />
    </V3PageShell>
  );
}
