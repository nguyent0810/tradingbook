import type { V3RiskConsole, V3RsWatchlistCard, V3SetupCard } from "../types";
import type { RiskTableRow, RsTableRow, SetupTableRow } from "../types";

type RuleState = "pass" | "caution" | "blocked";

function inferRuleState(rule: string, data: V3RiskConsole): RuleState {
  const lower = rule.toLowerCase();
  if (
    lower.includes("no averaging") ||
    lower.includes("pause all new entries") ||
    (data.utilizationTone === "critical" && lower.includes("add risk"))
  ) {
    return "blocked";
  }
  if (lower.includes("do not") || data.utilizationTone === "elevated") return "caution";
  if (data.utilizationTone === "critical") return "caution";
  return "pass";
}

function statusLabel(state: RuleState): string {
  if (state === "blocked") return "Blocked";
  if (state === "caution") return "Guard";
  return "Ready";
}

function actionLabel(state: RuleState): string {
  if (state === "blocked") return "Hold";
  if (state === "caution") return "Watch";
  return "Go";
}

function severityLabel(state: RuleState): string {
  if (state === "blocked") return "High";
  if (state === "caution") return "Med";
  return "Low";
}

export function mapRiskTableRows(data: V3RiskConsole): RiskTableRow[] {
  return data.blockers.map((rule) => {
    const state = inferRuleState(rule, data);
    return {
      id: rule,
      rule,
      status: state,
      severity: severityLabel(state),
      action: actionLabel(state),
    };
  });
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
    setupType: card.setupType,
    entry: card.entry,
    stop: card.stop,
    actionState: card.actionState,
    health: card.health,
  }));
}

export function riskStatusLabel(state: RuleState): string {
  return statusLabel(state);
}
