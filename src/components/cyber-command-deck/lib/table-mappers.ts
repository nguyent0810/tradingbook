import type {
  V3RiskConsole,
  V3RsWatchlistCard,
  V3SetupCard,
  V3TradeGateRow,
} from "@/lib/dashboard/dashboard-v3-view-model";
import type { RiskTableRow, RsTableRow, SetupTableRow } from "../types";

function gateStatusToVariant(
  status: V3TradeGateRow["status"]
): RiskTableRow["status"] {
  if (status === "ready") return "pass";
  if (status === "blocked") return "blocked";
  return "caution";
}

export function mapTradeGateRows(data: V3RiskConsole): RiskTableRow[] {
  return data.tradeGate.rows.map((row) => ({
    id: row.id,
    rule: row.rule,
    status: gateStatusToVariant(row.status),
    statusLabel: row.statusLabel,
    severity: row.severity,
    action: row.action,
  }));
}

/** @deprecated Use mapTradeGateRows — server-driven trade gate rows. */
export function mapRiskTableRows(data: V3RiskConsole): RiskTableRow[] {
  return mapTradeGateRows(data);
}

function rsMetricValue(card: V3RsWatchlistCard, label: string): string {
  return card.metrics.find((m) => m.label === label)?.value ?? "—";
}

export function mapRsTableRows(cards: V3RsWatchlistCard[]): RsTableRow[] {
  return cards.map((card) => ({
    id: card.symbol,
    symbol: card.symbol,
    stateBadge: card.stateBadge,
    stateTone: card.stateTone,
    strengthLabel: card.strengthLabel,
    blockerLabel: card.blockerLabel,
    rsValue: rsMetricValue(card, "RS rank") || rsMetricValue(card, "RS vs bench"),
  }));
}

export function mapSetupTableRows(cards: V3SetupCard[]): SetupTableRow[] {
  return cards.map((card) => ({
    id: card.symbol,
    symbol: card.symbol,
    tier: card.tier,
    setupType:
      card.setupTypeProvenance === "static_copy"
        ? card.setupType
        : card.setupType || "Pattern pending",
    entry: card.entry,
    stop: card.stop,
    actionState: card.actionState,
    health: card.health,
  }));
}
