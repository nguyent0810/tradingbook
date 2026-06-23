import type {
  V3EarlyEntryDisplay,
  V3RiskConsole,
  V3RsWatchlistCard,
  V3SetupCard,
  V3TradeGateRow,
} from "@/lib/dashboard/dashboard-v3-view-model";
import { formatRsSpreadPp } from "@/lib/dashboard/rs-setup-labels";
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

export function mapRsTableRows(cards: V3RsWatchlistCard[]): RsTableRow[] {
  return cards.map((card) => {
    const strength =
      card.strengthLabel != null && card.rsStrengthScore != null
        ? `${card.strengthLabel} · ${card.rsStrengthScore}`
        : (card.strengthLabel ?? "—");

    return {
      id: card.symbol,
      symbol: card.symbol,
      rs20: formatRsSpreadPp(card.rs20SpreadPct),
      rs50:
        card.rs50SpreadPct != null && Number.isFinite(card.rs50SpreadPct)
          ? formatRsSpreadPp(card.rs50SpreadPct)
          : "—",
      setupState: card.setupState,
      strengthLabel: strength,
      reason: card.setupReason,
      rsStrengthScore: card.rsStrengthScore,
      stateTone: card.stateTone,
      earlyEntry: card.earlyEntry,
    };
  });
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
