import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/session";
import { SetupsCandidatesAsync } from "./setups-candidates-async";
import { SetupsOverviewAsync } from "./setups-overview-async";
import { SetupsTailAsync } from "./setups-tail-async";
import {
  SetupsCandidatesFallback,
  SetupsMomentumFallback,
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
      <PageHeader
        title="Setups"
        subtitle="Breakout-pullback scan — what cleared, what didn’t, and what to watch next."
        actions={
          <Link href="/dashboard" className="btn btn-secondary btn-sm">
            ← Dashboard
          </Link>
        }
      />

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
