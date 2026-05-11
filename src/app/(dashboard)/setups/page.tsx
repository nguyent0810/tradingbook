import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MomentumWatchSection } from "@/components/momentum-watch-section";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Setups
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Breakout-pullback scan — what cleared, what didn’t, and what to watch next.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[var(--accent-text)] hover:underline">
          ← Dashboard
        </Link>
      </div>

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
