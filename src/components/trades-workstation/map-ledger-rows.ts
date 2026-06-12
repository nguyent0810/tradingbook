import type {
  TradesLedgerOpenRowPack,
  TradesLedgerTableItem,
  TradesLedgerTrade,
} from "@/components/trades/trades-ledger-types";
import type { TradeLedgerOpenRowPack, TradeLedgerTableItem } from "./types";

function mapOpenPack(pack: TradesLedgerOpenRowPack): TradeLedgerOpenRowPack {
  return {
    derived: {
      latestBar: pack.derived.latestBar,
      unrealized: pack.derived.unrealized,
      priceUnitMismatch: pack.derived.priceUnitMismatch,
      holdingDays: pack.derived.holdingDays,
      rMultiple: pack.derived.rMultiple,
      distanceToStop: pack.derived.distanceToStop,
      distanceToTakeProfit: pack.derived.distanceToTakeProfit,
    },
    reviewDto: {
      surface: pack.reviewDto.surface,
      stopBand: pack.reviewDto.stopBand,
      stopBandLabel: pack.reviewDto.stopBandLabel,
      cushionPctDisplay: pack.reviewDto.cushionPctDisplay,
      headline: pack.reviewDto.headline,
      primaryReviewLabel: pack.reviewDto.primaryReviewLabel,
      plannedCapitalAtRisk: pack.reviewDto.plannedCapitalAtRisk,
      setupValidityLine: pack.reviewDto.setupValidityLine,
      latestChecklist: pack.reviewDto.latestChecklist,
    },
    priorityTier: pack.priorityTier,
    memoryLines: [...pack.memoryLines],
    escalationCues: [...pack.escalationCues],
    postureExplainLines: [...pack.postureExplainLines],
    positionEvolution: pack.positionEvolution,
    positionEvolutionLine: pack.positionEvolutionLine,
  };
}

export function mapLedgerTableItems(
  items: TradesLedgerTableItem[]
): TradeLedgerTableItem[] {
  return items.map((item) => {
    if (item !== null && typeof item === "object" && "kind" in item && item.kind === "divider") {
      return item;
    }
    const trade = item as TradesLedgerTrade;
    return {
      id: trade.id,
      symbol: trade.symbol,
      status: trade.status,
      direction: trade.direction,
      playbook: trade.playbook,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      entryDate: trade.entryDate,
      exitDate: trade.exitDate,
      realizedPnl: trade.realizedPnl,
      setupCandidate: trade.setupCandidate
        ? {
            setupType: trade.setupCandidate.setupType,
            quality: trade.setupCandidate.quality,
          }
        : null,
    };
  });
}

export function mapOpenRowPacks(
  packs: Map<string, TradesLedgerOpenRowPack>
): Map<string, TradeLedgerOpenRowPack> {
  const out = new Map<string, TradeLedgerOpenRowPack>();
  for (const [id, pack] of packs) {
    out.set(id, mapOpenPack(pack));
  }
  return out;
}
