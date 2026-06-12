import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import type {
  DataProvenance,
  DecisionCockpitDto,
  VerdictUxLevel,
} from "./decision-cockpit-dto";
import type {
  V3TradeGate,
  V3TradeGateRow,
  V3TradeGateStatus,
} from "./dashboard-v3-view-model";
import { formatScannerReasonForUser } from "./v3-user-copy";

function tradeGateRow(
  id: string,
  rule: string,
  status: V3TradeGateStatus,
  severity: "High" | "Med" | "Low",
  action: string,
  provenance: DataProvenance = "derived"
): V3TradeGateRow {
  const statusLabels: Record<V3TradeGateStatus, string> = {
    blocked: "Blocked",
    waiting: "Waiting",
    setup_needed: "Setup needed",
    ready: "Ready",
  };
  return {
    id,
    rule,
    status,
    statusLabel: statusLabels[status],
    severity,
    action,
    provenance,
  };
}

export function buildTradeGateSubtitle(ux: VerdictUxLevel): string {
  switch (ux) {
    case "NO_TRADE":
      return "Entry closed — no new swing entries under today's stance.";
    case "PROBE":
      return "Watch only — no confirmed entry. Gates must clear before sizing up.";
    default:
      return "Entry permitted when all gates below show ready.";
  }
}

function canShowGo(
  ux: VerdictUxLevel,
  headroom: DecisionCockpitDto["riskBudgetHeadroom"],
  utilizationTone: "normal" | "elevated" | "critical",
  topSetups: SurfacedCandidateHealthView[],
  gate1: DecisionCockpitDto["verdict"]["gate1Resolution"]["canonical"]
): boolean {
  if (ux !== "TRADE") return false;
  if (gate1 === "FAIL") return false;
  if (headroom.status !== "configured") return false;
  if (headroom.isOverMaxBook) return false;
  if (utilizationTone === "critical") return false;
  return topSetups.some(
    (s) => s.healthLevel === "HEALTHY" && s.lifecycleSortLabel === "READY"
  );
}

function isBudgetPolicyRule(text: string): boolean {
  return /risk budget headroom|book headroom compares open notional/i.test(text);
}

/** Enforce stance overrides — NO TRADE never shows Go; missing budget never shows Ready/Go. */
function applyStanceOverrides(
  rows: V3TradeGateRow[],
  ux: VerdictUxLevel,
  budgetStatus: DecisionCockpitDto["riskBudgetHeadroom"]["status"]
): V3TradeGateRow[] {
  return rows.map((r) => {
    let next = { ...r };

    if (budgetStatus === "unavailable" || budgetStatus === "partial") {
      if (next.action === "Go" || next.status === "ready") {
        next = {
          ...next,
          status: "setup_needed",
          statusLabel: "Setup needed",
          action: budgetStatus === "unavailable" ? "Configure equity" : "Setup needed",
          severity: "Med",
        };
      }
    }

    if (ux === "NO_TRADE") {
      if (next.action === "Go" || next.status === "ready") {
        next = {
          ...next,
          status: "blocked",
          statusLabel: "Blocked",
          action: "No new entries",
          severity: "High",
        };
      } else if (next.action === "Watch" && next.id === "stance") {
        next = {
          ...next,
          status: "blocked",
          statusLabel: "Blocked",
          action: "No new entries",
          severity: "High",
        };
      }
    }

    if (ux === "PROBE" && (next.action === "Go" || next.status === "ready")) {
      next = {
        ...next,
        status: "waiting",
        statusLabel: "Waiting",
        action: "Watch",
        severity: next.severity === "Low" ? "Med" : next.severity,
      };
    }

    return next;
  });
}

export function buildTradeGate(params: {
  cockpitDto: DecisionCockpitDto;
  freshness: MarketFreshnessDto;
  topSetups: SurfacedCandidateHealthView[];
  utilizationTone: "normal" | "elevated" | "critical";
}): V3TradeGate {
  const { cockpitDto, freshness, topSetups, utilizationTone } = params;
  const ux = cockpitDto.verdict.uxLevel.value;
  const gate1 = cockpitDto.verdict.gate1Resolution.canonical;
  const headroom = cockpitDto.riskBudgetHeadroom;
  const showGo = canShowGo(ux, headroom, utilizationTone, topSetups, gate1);
  const rows: V3TradeGateRow[] = [];

  rows.push(
    tradeGateRow(
      "stance",
      "Daily stance",
      ux === "NO_TRADE" ? "blocked" : ux === "TRADE" ? "ready" : "waiting",
      ux === "NO_TRADE" ? "High" : ux === "TRADE" ? "Low" : "High",
      ux === "NO_TRADE" ? "No new entries" : "Watch",
      "derived"
    )
  );

  if (gate1 === "FAIL") {
    rows.push(
      tradeGateRow(
        "gate1",
        "Market regime filter",
        "blocked",
        "High",
        "No new entries",
        "real"
      )
    );
  } else if (gate1 === "WARNING") {
    rows.push(
      tradeGateRow(
        "gate1",
        "Market regime filter",
        ux === "NO_TRADE" ? "blocked" : "waiting",
        "Med",
        ux === "NO_TRADE" ? "No new entries" : "Watch",
        "real"
      )
    );
  }

  if (cockpitDto.opportunity.mode === "empty") {
    rows.push(
      tradeGateRow(
        "surfaced",
        "Qualified setups surfaced",
        ux === "TRADE" ? "waiting" : "blocked",
        "Med",
        ux === "TRADE" ? "Watch" : "No new entries",
        "real"
      )
    );
  } else if (cockpitDto.opportunity.mode === "near_miss") {
    rows.push(
      tradeGateRow(
        "surfaced",
        "Qualified setups surfaced",
        "waiting",
        "Med",
        "Watch",
        "real"
      )
    );
  } else if (cockpitDto.opportunity.mode === "candidates") {
    rows.push(
      tradeGateRow(
        "surfaced",
        "Qualified setups surfaced",
        showGo ? "ready" : "waiting",
        showGo ? "Low" : "Med",
        showGo ? "Go" : "Watch",
        "real"
      )
    );
  }

  if (headroom.status === "unavailable") {
    rows.push(
      tradeGateRow(
        "budget",
        "Risk budget",
        "setup_needed",
        "Med",
        "Configure equity",
        "gap"
      )
    );
  } else if (headroom.status === "partial") {
    rows.push(
      tradeGateRow(
        "budget",
        "Risk budget",
        "setup_needed",
        "Med",
        "Setup needed",
        "gap"
      )
    );
  } else if (headroom.isOverMaxBook) {
    rows.push(
      tradeGateRow("budget", "Book headroom", "blocked", "High", "Hold", "derived")
    );
  }

  if (utilizationTone === "critical") {
    rows.push(
      tradeGateRow("utilization", "Book utilization", "blocked", "High", "Hold", "derived")
    );
  } else if (utilizationTone === "elevated") {
    rows.push(
      tradeGateRow("utilization", "Book utilization", "waiting", "Med", "Watch", "derived")
    );
  }

  if (freshness.staleFlags.length > 0 || freshness.delayedBackdrop) {
    rows.push(
      tradeGateRow("freshness", "Data freshness", "waiting", "Med", "Watch", "derived")
    );
  }

  if (freshness.scanSessionCoverage?.weakCoverage) {
    rows.push(
      tradeGateRow(
        "coverage",
        "Session coverage",
        "waiting",
        "Med",
        "Watch",
        "derived"
      )
    );
  }

  const blockedHealth = topSetups.some(
    (s) => s.healthLevel === "DEAD" || s.healthLevel === "AT_RISK"
  );
  if (blockedHealth) {
    rows.push(
      tradeGateRow(
        "health",
        "Setup health check",
        "blocked",
        "High",
        "No new entries",
        "derived"
      )
    );
  }

  for (const blocker of cockpitDto.blockers.slice(0, 2)) {
    let status: V3TradeGateStatus = "waiting";
    let action = "Watch";
    if (blocker.severity === "market_off" || blocker.severity === "structure_broken") {
      status = "blocked";
      action = "No new entries";
    } else if (blocker.severity === "extension" && ux !== "TRADE") {
      status = "blocked";
      action = "No new entries";
    }
    rows.push(
      tradeGateRow(
        `blocker-${blocker.title.slice(0, 32)}`,
        formatScannerReasonForUser(blocker.title),
        status,
        blocker.severity === "market_off" ? "High" : "Med",
        action,
        "real"
      )
    );
  }

  for (const rule of cockpitDto.risk.rules) {
    const text = formatScannerReasonForUser(rule.text);
    if (!text) continue;
    if (headroom.status !== "configured" && isBudgetPolicyRule(text)) continue;
    rows.push(
      tradeGateRow(`policy-${text.slice(0, 24)}`, text, "waiting", "Low", "Watch", rule.provenance)
    );
  }

  const normalizedRows = applyStanceOverrides(rows, ux, headroom.status);

  return {
    subtitle: buildTradeGateSubtitle(ux),
    rows: normalizedRows,
    budgetStatus: headroom.status,
    budgetProvenance: headroom.equityVnd.provenance,
  };
}
