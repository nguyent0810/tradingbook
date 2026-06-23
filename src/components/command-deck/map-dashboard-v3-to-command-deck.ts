import type { DashboardV3ViewModel, V3DecisionMode, V3EvidenceItem } from "@/lib/dashboard/dashboard-v3-view-model";
import { sectorLabelForSymbol } from "@/lib/dashboard/rs-sector-display";
import { buildRadarNodesFromWorkbenchRows } from "@/lib/dashboard/rs-radar-from-workbench";
import type {
  CommandDeckData,
  DecisionCoreData,
  EvidenceItem,
  RadarNode,
  RadarNodeClassification,
  RelativeStrengthRow,
  SetupIntelligenceRow,
  StatusTone,
} from "./types";

function stanceTone(mode: V3DecisionMode): StatusTone {
  if (mode === "PROTECT CAPITAL") return "danger";
  if (mode === "WAIT") return "warning";
  if (mode === "TRADE") return "success";
  return "neutral";
}

function evidenceTone(state: V3EvidenceItem["state"]): StatusTone {
  if (state === "danger") return "danger";
  if (state === "warn") return "warning";
  if (state === "ok") return "success";
  return "neutral";
}

function sparklineFromReadinessRisk(readiness: number, risk: number): number[] {
  const base = Math.max(8, Math.min(92, readiness));
  const caution = Math.max(6, Math.min(34, Math.round(risk / 3)));
  return [
    Math.max(5, base - caution),
    Math.max(5, base - Math.round(caution * 0.6)),
    Math.max(5, base - Math.round(caution * 0.35)),
    Math.max(5, base - Math.round(caution * 0.2)),
    Math.max(5, base),
  ];
}

const RADAR_CLASSIFICATION_PRIORITY: Record<RadarNodeClassification, number> = {
  avoid: 3,
  watch: 2,
  actionable: 1,
};

/** Merge radar nodes by symbol — strictest classification wins (avoid > watch > actionable). */
export function dedupeRadarNodes(nodes: RadarNode[]): RadarNode[] {
  const bySymbol = new Map<string, RadarNode>();
  for (const node of nodes) {
    const existing = bySymbol.get(node.symbol);
    if (!existing) {
      bySymbol.set(node.symbol, node);
      continue;
    }
    if (
      RADAR_CLASSIFICATION_PRIORITY[node.classification] >
      RADAR_CLASSIFICATION_PRIORITY[existing.classification]
    ) {
      bySymbol.set(node.symbol, node);
    }
  }
  return [...bySymbol.values()];
}

function mapRadarNodes(vm: DashboardV3ViewModel, decisionMode: V3DecisionMode): RadarNode[] {
  const dots: RadarNode[] = vm.radar.mapDots.map((dot) => {
    let classification: RadarNodeClassification = dot.status === "qualified" ? "actionable" : "watch";
    if (decisionMode !== "TRADE" && classification === "actionable") {
      classification = "watch";
    }
    return {
      symbol: dot.symbol,
      readiness: dot.readiness,
      risk: dot.risk,
      classification,
      tier: dot.tier,
      reason: dot.reason,
      sparkline: sparklineFromReadinessRisk(dot.readiness, dot.risk),
    };
  });

  const avoid: RadarNode[] = vm.radar.avoidPlaceholders.map((p) => ({
    symbol: p.symbol,
    readiness: 22,
    risk: 88,
    classification: "avoid" as const,
    tier: "Rejected",
    reason: p.caption,
    sparkline: [48, 44, 38, 32, 28],
  }));

  return dedupeRadarNodes([...dots, ...avoid]);
}

function mapRelativeStrength(vm: DashboardV3ViewModel): RelativeStrengthRow[] {
  return vm.rsWatchlist.cards.map((card) => {
    let status: RelativeStrengthRow["status"] = "watch";
    if (card.stateTone === "supportive") status = "aligned";
    if (card.stateTone === "not-ready") status = "blocked";

    const rsStrength =
      card.strengthLabel != null && card.rsStrengthScore != null
        ? `${card.strengthLabel} · ${card.rsStrengthScore}`
        : (card.strengthLabel ?? "—");

    return {
      symbol: card.symbol,
      rs20: card.rs20SpreadPct,
      rs50: card.rs50SpreadPct,
      rsStrength,
      setupState: card.setupState,
      reason: card.setupReason,
      status,
      rsStrengthScore: card.rsStrengthScore,
      setupReadinessScore: card.setupReadinessScore,
      terminalCode: card.terminalCode,
      sectorLabel: sectorLabelForSymbol(card.symbol),
      actionLabel: card.nextCondition || card.blockerLabel || "—",
      earlyEntry: card.earlyEntry,
    };
  });
}

function mapDecision(vm: DashboardV3ViewModel): DecisionCoreData {
  const utilization = vm.risk.utilizationPercent ?? 0;
  const mainRiskPercent =
    vm.risk.utilizationTone === "critical"
      ? Math.min(95, Math.max(70, utilization))
      : vm.risk.utilizationTone === "elevated"
        ? Math.min(75, Math.max(50, utilization))
        : Math.min(65, 100 - vm.decision.confidenceMeterWidth);

  return {
    stance: vm.decision.stanceLabel,
    stanceTone: stanceTone(vm.decision.mode),
    confidenceLabel: `${vm.decision.confidenceBand.charAt(0).toUpperCase()}${vm.decision.confidenceBand.slice(1)} confidence`,
    primaryReason: vm.decision.primaryReason,
    mainRisk: vm.decision.mainRisk ?? vm.risk.posture,
    mainRiskPercent,
    capital: vm.decision.capitalProtection ?? vm.risk.capitalProtectionState,
    capitalPercent: Math.min(100, Math.max(8, vm.decision.confidenceMeterWidth)),
    nextAction: vm.decision.nextAction ?? "No actionable scan detail surfaced in the latest run.",
  };
}

function mapSetupRows(vm: DashboardV3ViewModel): SetupIntelligenceRow[] {
  return vm.setupCards.map((card) => ({
    symbol: card.symbol,
    trigger: card.entry,
    risk: card.stop,
    action: card.actionState,
    sparkline: sparklineFromReadinessRisk(
      card.health === "Healthy" ? 78 : card.health === "Warning" ? 52 : 28,
      card.health === "Blocked" ? 82 : 40
    ),
  }));
}

function foreignStats(vm: DashboardV3ViewModel) {
  return vm.evidence
    .filter((e) => e.label.startsWith("Foreign"))
    .map((e) => ({
      label: e.label,
      value: e.value,
      tone: evidenceTone(e.state),
    }));
}

export function mapDashboardV3ToCommandDeck(vm: DashboardV3ViewModel): CommandDeckData {
  const relativeStrength = mapRelativeStrength(vm);
  const radar =
    relativeStrength.length > 0
      ? buildRadarNodesFromWorkbenchRows(relativeStrength, vm.decision.mode)
      : mapRadarNodes(vm, vm.decision.mode);

  return {
    commandBar: {
      session: vm.marketPulse.session,
      vnindex: vm.marketPulse.vnindex ?? "—",
      freshness: vm.marketPulse.freshness,
      regime: vm.marketPulse.regime,
      regimeNote: vm.marketPulse.gate1MismatchNote ?? undefined,
      breadth: vm.marketPulse.breadth,
      volatility: vm.marketPulse.volatility ?? "—",
      watchState: vm.marketPulse.watchState,
      stats: foreignStats(vm),
    },
    decision: mapDecision(vm),
    radar,
    relativeStrength,
    setupIntelligence: mapSetupRows(vm),
    evidence: vm.evidence.map((e) => ({
      label: e.label,
      value: e.value,
      tone: evidenceTone(e.state),
    })),
    rsContextNote: vm.rsWatchlist.contextNote,
    setupEmptyMessage: vm.setupIntelligence.emptyMessage,
    setupSubtitle:
      vm.setupCards.length > 0
        ? vm.setupIntelligence.populatedSubtitle
        : vm.setupIntelligence.populatedSubtitle || "Trigger · risk · action",
  };
}
