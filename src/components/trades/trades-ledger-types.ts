import type { Prisma } from "@/generated/prisma/client";
import type { deriveTradesLedgerRowFields } from "@/lib/trades/trades-ledger-row-derived";
import type { OpenPositionReviewDto } from "@/lib/trades/open-position-intelligence";
import type { ReviewOutcomeId } from "@/lib/trades/review-outcome";
import type { ReviewPriorityTier } from "@/lib/trades/review-priority-queue";
import type { OperatingPosture } from "@/lib/trades/operating-posture";
import type { PositionEvolutionState } from "@/lib/trades/position-state-evolution";
import type { buildOpenLedgerReviewOrder } from "@/lib/trades/review-priority-queue";

export type TradesLedgerTrade = Prisma.TradeGetPayload<{
  include: {
    setupCandidate: {
      select: {
        id: true;
        setupType: true;
        quality: true;
        breakoutLevel: true;
        pullbackZoneLow: true;
        pullbackZoneHigh: true;
        stopLevel: true;
        barDate: true;
      };
    };
  };
}>;

export type TradesLedgerTableItem =
  | TradesLedgerTrade
  | { kind: "divider"; label: string };

export type TradesLedgerOpenRowPack = {
  derived: ReturnType<typeof deriveTradesLedgerRowFields>;
  reviewDto: OpenPositionReviewDto;
  priorityTier: ReviewPriorityTier;
  sortKey: ReturnType<typeof buildOpenLedgerReviewOrder>;
  memoryLines: string[];
  escalationCues: string[];
  latestReviewOutcome: ReviewOutcomeId | null;
  operatingPosture: OperatingPosture;
  postureExplainLines: string[];
  positionEvolution: PositionEvolutionState;
  positionEvolutionLine: string | null;
};
