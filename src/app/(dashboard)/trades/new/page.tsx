import type { Metadata } from "next";
import Link from "next/link";
import { TradeForm } from "@/components/trade-form";
import { StaleSetupCandidateWarning } from "@/components/trades/stale-setup-candidate-warning";
import { V3PageHeader } from "@/components/trading-os-v3/shared/v3-page-header";
import { V3PageShell, V3Panel } from "@/components/trading-os-v3/layout";
import { prisma } from "@/lib/prisma";
import { getLatestDailyScanRun } from "@/lib/scanner/setups-queries";
import { getSession } from "@/lib/session";
import {
  resolveStaleSetupCandidateNotice,
  type StaleSetupCandidateNotice,
} from "@/lib/trades/stale-setup-candidate";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "New Trade — TradeLog",
  description: "Log a new trade.",
};

interface NewTradePageProps {
  searchParams: Promise<{ setupCandidateId?: string }>;
}

export default async function NewTradePage({ searchParams }: NewTradePageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const setupCandidateId = (params.setupCandidateId ?? "").trim();
  let initialValues: Parameters<typeof TradeForm>[0]["initialValues"] | undefined;
  let setupContextLabel: string | null = null;
  let staleNotice: StaleSetupCandidateNotice = { kind: "none" };

  if (setupCandidateId) {
    let latestScanLookupFailed = false;
    let latestScan: Awaited<ReturnType<typeof getLatestDailyScanRun>> = null;

    try {
      latestScan = await getLatestDailyScanRun();
    } catch (e) {
      latestScanLookupFailed = true;
      console.error("[trades/new] getLatestDailyScanRun failed:", e);
    }

    const candidate = await prisma.setupCandidate.findUnique({
      where: { id: setupCandidateId },
      include: {
        symbol: { select: { symbol: true } },
      },
    });

    if (candidate) {
      staleNotice = resolveStaleSetupCandidateNotice({
        candidateScanRunId: candidate.scanRunId,
        latestScanRunId: latestScan?.id,
        latestScanLookupFailed,
      });

      const watch = await prisma.setupWatchItem.findUnique({
        where: {
          symbolId_setupType: {
            symbolId: candidate.symbolId,
            setupType: candidate.setupType,
          },
        },
      });

      initialValues = {
        setupId: candidate.id,
        symbol: candidate.symbol.symbol,
        direction: "LONG",
        entryPrice: candidate.close,
        stopLoss: candidate.stopLevel,
        takeProfit: undefined,
        positionSize: undefined,
        entryReason: "PULLBACK_ENTRY",
        entryLocationVsZone:
          candidate.close >= candidate.pullbackZoneLow &&
          candidate.close <= candidate.pullbackZoneHigh
            ? "IN_ZONE"
            : candidate.close > candidate.pullbackZoneHigh
              ? "ABOVE_ZONE"
              : "BELOW_ZONE",
        healthLevelAtEntry: watch?.healthLevel ?? "",
        healthScoreAtEntry: watch?.healthScore ?? undefined,
        setupSnapshot: JSON.stringify(
          {
            source: "setup_candidate",
            setupCandidateId: candidate.id,
            scanRunId: candidate.scanRunId,
            symbol: candidate.symbol.symbol,
            setupType: candidate.setupType,
            setupTier: candidate.quality,
            breakoutLevel: candidate.breakoutLevel,
            pullbackZoneLow: candidate.pullbackZoneLow,
            pullbackZoneHigh: candidate.pullbackZoneHigh,
            stopLevel: candidate.stopLevel,
            barDate: candidate.barDate.toISOString(),
            reasons: candidate.reasons,
            healthLevel: watch?.healthLevel ?? null,
            healthScore: watch?.healthScore ?? null,
          },
          null,
          0
        ),
      };
      setupContextLabel = `${candidate.symbol.symbol} · ${candidate.quality} · ${candidate.setupType}`;
    }
  }

  const showCurrentSetupMarker =
    setupCandidateId.length > 0 &&
    initialValues != null &&
    staleNotice.kind === "none";

  return (
    <V3PageShell pageClassName="tosv3-ticket-page" testId="log-trade-workstation">
      <div className="tosv3-ticket-page__inner">
        <V3PageHeader
          kicker="Trading ticket"
          title="Log a trade"
          lead="Record execution, risk, and thesis. P&L is computed automatically when you close a position."
          actions={
            <Link href="/trades/journal" className="tosv3-btn tosv3-btn--secondary">
              Back to ledger
            </Link>
          }
        />

        <StaleSetupCandidateWarning notice={staleNotice} />

        <V3Panel
          className="tosv3-ticket-panel"
          {...(showCurrentSetupMarker
            ? { testId: "trades-new-setup-current" }
            : {})}
        >
          <TradeForm initialValues={initialValues} setupContextLabel={setupContextLabel} />
        </V3Panel>
      </div>
    </V3PageShell>
  );
}
