import type { Metadata } from "next";
import { TradeForm } from "@/components/trade-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
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

  if (setupCandidateId) {
    const candidate = await prisma.setupCandidate.findUnique({
      where: { id: setupCandidateId },
      include: {
        symbol: { select: { symbol: true } },
      },
    });
    if (candidate) {
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

  return (
    <div className="page-container animate-in">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Log a Trade
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Record your trade details. P&L is computed automatically for closed
            trades.
          </p>
        </div>

        <div className="card p-6">
          <TradeForm initialValues={initialValues} setupContextLabel={setupContextLabel} />
        </div>
      </div>
    </div>
  );
}
