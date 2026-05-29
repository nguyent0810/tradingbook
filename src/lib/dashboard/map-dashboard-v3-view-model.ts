import type { Trade } from "@/generated/prisma/client";
import { computeEquityCurve } from "@/lib/analytics";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { MarketRegimeFromDbResult } from "@/lib/playbook/get-market-regime";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import {
  formatSetupLadderStageLabel,
  type ConfidenceBand,
  type DecisionCockpitDto,
  type OpportunityCandidateDto,
  type SetupLadderStage,
  type VerdictUxLevel,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";
import type { GateFunnelSnapshot } from "@/lib/dashboard/gate-funnel-copy";
import type {
  DashboardV3ViewModel,
  V3DecisionMode,
  V3RadarAvoidPlaceholder,
  V3RadarBandEntry,
  V3RadarMapDot,
  V3RiskConsole,
  V3SetupCard,
} from "./dashboard-v3-view-model";
import {
  formatActionHintForUser,
  formatBreadthSummary,
  formatRadarReason,
  formatScannerReasonForUser,
  formatSetupDiagnosticCopy,
  mapRsWatchlistToV3Panel,
} from "./v3-user-copy";

export type MapDashboardV3Params = {
  cockpitDto: DecisionCockpitDto;
  freshness: MarketFreshnessDto;
  regime: MarketRegimeFromDbResult;
  latestScan: LatestScanWithCandidates | null;
  topSetups: SurfacedCandidateHealthView[];
  trades: Trade[];
  watchItemCount: number;
  openPositionCount: number;
  dbLoadError?: string | null;
};

export function confidenceBandMeterWidth(band: ConfidenceBand): number {
  switch (band) {
    case "high":
      return 85;
    case "medium":
      return 65;
    default:
      return 40;
  }
}

export function mapUxVerdictToDecisionMode(ux: VerdictUxLevel): V3DecisionMode {
  switch (ux) {
    case "TRADE":
      return "TRADE";
    case "PROBE":
      return "WAIT";
    case "NO_TRADE":
      return "PROTECT CAPITAL";
    default:
      return "WATCHLIST ONLY";
  }
}

function formatFreshnessLabel(freshness: MarketFreshnessDto, now = new Date()): string {
  if (!freshness.scanRunAt) return "No scan run";
  const scanMs = new Date(freshness.scanRunAt).getTime();
  if (!Number.isFinite(scanMs)) return "Scan time unknown";
  const hours = Math.max(0, (now.getTime() - scanMs) / (1000 * 60 * 60));
  if (hours < 1) return "Fresh <1h ago";
  if (hours < 24) return `Fresh ${Math.round(hours)}h ago`;
  return `Scan ${freshness.scanRunAt.slice(0, 10)}`;
}

function momentumVolatilityLabel(momentum?: string): string | null {
  if (momentum === "up") return "Momentum up";
  if (momentum === "down") return "Momentum down";
  if (momentum === "neutral") return "Contained";
  return null;
}

function formatBreadth(
  latestScan: LatestScanWithCandidates | null,
  gateFunnel: GateFunnelSnapshot | null
): string | null {
  return formatBreadthSummary(latestScan, gateFunnel);
}

function healthLevelToRisk(healthLevel: string): number {
  switch (healthLevel) {
    case "HEALTHY":
      return 28;
    case "WARNING":
      return 52;
    case "AT_RISK":
      return 72;
    case "DEAD":
      return 88;
    default:
      return 50;
  }
}

function healthLevelToUi(healthLevel: string): V3SetupCard["health"] {
  if (healthLevel === "HEALTHY") return "Healthy";
  if (healthLevel === "DEAD" || healthLevel === "AT_RISK") return "Blocked";
  return "Warning";
}

function ladderStageToTier(stage: SetupLadderStage, quality?: "A" | "B"): string {
  if (stage === "tier_a") return quality === "A" ? "A+" : "A";
  if (stage === "tier_b") return "B";
  if (stage === "watch") return "WATCH";
  return "AVOID";
}

function formatZone(low: number, high: number): string {
  return `${low.toFixed(2)} – ${high.toFixed(2)}`;
}

function formatStop(stop: number, entryMid: number): string {
  if (!Number.isFinite(stop) || !Number.isFinite(entryMid) || entryMid <= 0) {
    return String(stop);
  }
  const pct = ((entryMid - stop) / entryMid) * 100;
  return `${stop.toFixed(2)} (${pct >= 0 ? "-" : "+"}${Math.abs(pct).toFixed(1)}%)`;
}

function formatRiskReward(
  zoneLow: number,
  zoneHigh: number,
  stop: number
): string | null {
  const entryMid = (zoneLow + zoneHigh) / 2;
  const risk = entryMid - stop;
  if (risk <= 0 || !Number.isFinite(risk)) return null;
  const reward = zoneHigh - entryMid;
  if (reward <= 0) return null;
  const ratio = reward / risk;
  return `1 : ${ratio.toFixed(1)}`;
}

function candidateToMapDot(
  c: OpportunityCandidateDto,
  setupBySymbol: Map<string, SurfacedCandidateHealthView>
): V3RadarMapDot {
  const setup = setupBySymbol.get(c.symbol);
  const readiness = setup?.healthScore ?? 70;
  const risk = setup ? healthLevelToRisk(setup.healthLevel) : 45;
  return {
    symbol: c.symbol,
    tier: ladderStageToTier(c.ladderStage, c.quality),
    readiness: Math.max(10, Math.min(95, readiness)),
    risk: Math.max(10, Math.min(95, risk)),
    status: "qualified",
    reason: formatRadarReason(
      c.healthSummary ?? (c.primaryReasons.join(" · ") || c.actionHint)
    ),
  };
}

function nearMissToMapDot(n: DecisionCockpitDto["opportunity"]["nearMiss"][number]): V3RadarMapDot {
  const dist = n.distanceToZonePct;
  let readiness = 55;
  if (dist != null && Number.isFinite(dist)) {
    readiness = Math.max(15, Math.min(85, 70 - Math.abs(dist)));
  }
  const risk =
    n.executionStatus === "INVALID" ? 82 : n.executionStatus === "WAIT" ? 58 : 48;
  return {
    symbol: n.symbol,
    tier: ladderStageToTier(n.ladderStage),
    readiness,
    risk,
    status: "near-miss",
    reason: formatRadarReason(n.waitFor),
  };
}

function buildHighestQualitySetup(
  opportunity: DecisionCockpitDto["opportunity"],
  topSetups: SurfacedCandidateHealthView[]
): string | null {
  const first = opportunity.candidates[0];
  if (first) {
    return `${first.symbol} ${formatSetupLadderStageLabel(first.ladderStage)}`;
  }
  const top = topSetups[0];
  if (top) {
    return `${top.symbolKey} Tier ${top.quality}`;
  }
  return null;
}

function buildMainRisk(dto: DecisionCockpitDto): string | null {
  const blocker = dto.blockers[0];
  if (blocker) return formatScannerReasonForUser(blocker.meaning);
  if (dto.verdict.gate1Resolution.canonical === "FAIL") {
    return "Market regime filter failed — new swing risk is suppressed.";
  }
  const avoid = dto.tomorrow.avoidLine.value;
  return avoid ? formatScannerReasonForUser(avoid) : null;
}

function buildSetupCards(topSetups: SurfacedCandidateHealthView[]): V3SetupCard[] {
  return topSetups.map((s) => {
    const entryMid = (s.pullbackZoneLow + s.pullbackZoneHigh) / 2;
    const rr = formatRiskReward(s.pullbackZoneLow, s.pullbackZoneHigh, s.stopLevel);
    let actionState = s.lifecycleSortLabel === "READY" ? "ARMED" : "WATCH FOR CONFIRM";
    if (s.healthLevel === "DEAD" || s.healthLevel === "AT_RISK") {
      actionState = "DO NOT TRADE";
    } else if (s.healthLevel === "HEALTHY" && s.lifecycleSortLabel === "READY") {
      actionState = "EXECUTE WINDOW OPEN";
    }

    return {
      symbol: s.symbolKey,
      tier: s.quality === "A" ? "A" : "B",
      setupType: "Breakout pullback",
      entry: formatZone(s.pullbackZoneLow, s.pullbackZoneHigh),
      stop: formatStop(s.stopLevel, entryMid),
      riskToReward: rr,
      confidenceLabel: s.healthScoreLabel,
      health: healthLevelToUi(s.healthLevel),
      blocker: formatSetupDiagnosticCopy(s.healthSummary),
      actionState,
    };
  });
}

function collectRejectedBandEntries(dto: DecisionCockpitDto): V3RadarBandEntry[] {
  const entries: V3RadarBandEntry[] = [];
  const seen = new Set<string>();

  for (const stage of ["avoid", "invalid"] as const) {
    const group = dto.setupQualityLadder.stages.find((s) => s.stage === stage);
    if (!group) continue;
    for (const symbol of group.sampleSymbols) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      entries.push({
        symbol,
        reason: formatScannerReasonForUser(`${group.label} — ${group.subtitle}`),
      });
    }
  }

  for (const blocker of dto.blockers) {
    for (const symbol of blocker.sampleSymbols) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      entries.push({
        symbol,
        reason: formatScannerReasonForUser(blocker.title),
      });
    }
  }

  return entries.slice(0, 8);
}

function collectAvoidPlaceholders(rejected: V3RadarBandEntry[]): V3RadarAvoidPlaceholder[] {
  return rejected.slice(0, 3).map((r) => ({
    symbol: r.symbol,
    caption: "Blocked sample",
  }));
}

function buildRecentOutcomeChips(trades: Trade[], limit = 4): Array<"W" | "L"> {
  const closed = trades
    .filter((t) => t.status === "CLOSED" && t.realizedPnl != null)
    .sort((a, b) => {
      const ta = (a.exitDate ?? a.entryDate).getTime();
      const tb = (b.exitDate ?? b.entryDate).getTime();
      return tb - ta;
    })
    .slice(0, limit);

  return closed.map((t) => (t.realizedPnl! > 0 ? "W" : "L"));
}

function buildPulseBarHeights(trades: Trade[]): number[] {
  const curve = computeEquityCurve(trades);
  const recent = curve.slice(-8);
  if (recent.length === 0) return [];
  const values = recent.map((p) => p.cumulativePnl);
  const max = Math.max(...values.map(Math.abs), 1);
  return values.map((v) => Math.max(12, Math.min(100, 50 + (v / max) * 50)));
}

function buildEvidence(dto: DecisionCockpitDto, freshness: MarketFreshnessDto): DashboardV3ViewModel["evidence"] {
  const items: DashboardV3ViewModel["evidence"] = [];

  if (dto.scanRunId) {
    const scan = dto.evidence.find((c) => c.id === "surfaced");
    items.push({
      label: "Scanner diagnostics",
      value: formatScannerReasonForUser(scan?.display ?? "See latest scan"),
      state: "ok",
    });
  }

  const staleSeverity = freshness.staleFlags.some((f) => f.severity === "error")
    ? "danger"
    : freshness.staleFlags.length > 0 || freshness.delayedBackdrop
      ? "warn"
      : "ok";
  items.push({
    label: "Data freshness",
    value:
      freshness.staleFlags[0]?.message ??
      (freshness.delayedBackdrop ? "Delayed backdrop" : "Aligned"),
    state: staleSeverity,
  });

  if (dto.blockers.length > 0) {
    items.push({
      label: "Market blockers",
      value: dto.blockers
        .slice(0, 2)
        .map((b) => formatScannerReasonForUser(b.title))
        .join(" · "),
      state: dto.blockers.some((b) => b.severity === "market_off") ? "danger" : "warn",
    });
  }

  const gate1 = dto.evidence.find((c) => c.id === "gate1");
  if (gate1) {
    items.push({
      label: "Technical evidence",
      value: formatScannerReasonForUser(gate1.display),
      state: dto.verdict.gate1Resolution.canonical === "PASS" ? "ok" : "warn",
    });
  }

  const topReject = dto.blockers.find((b) => b.severity === "extension");
  if (topReject) {
    items.push({
      label: "Rejected reasons",
      value: `${formatScannerReasonForUser(topReject.title)} (${topReject.count})`,
      state: "warn",
    });
  }

  return items;
}

export function mapDashboardV3ViewModel(params: MapDashboardV3Params): DashboardV3ViewModel {
  const { cockpitDto, freshness, regime, latestScan, topSetups, trades, watchItemCount } =
    params;
  const band = cockpitDto.verdict.confidenceBand.value;
  const setupBySymbol = new Map(topSetups.map((s) => [s.symbolKey, s]));

  const mapDots: V3RadarMapDot[] = [];
  if (cockpitDto.opportunity.mode === "candidates") {
    for (const c of cockpitDto.opportunity.candidates) {
      mapDots.push(candidateToMapDot(c, setupBySymbol));
    }
  } else if (cockpitDto.opportunity.mode === "near_miss") {
    for (const n of cockpitDto.opportunity.nearMiss.slice(0, 6)) {
      mapDots.push(nearMissToMapDot(n));
    }
  }

  const qualified: V3RadarBandEntry[] = cockpitDto.opportunity.candidates.map((c) => ({
    symbol: c.symbol,
    reason: formatRadarReason(c.healthSummary ?? c.actionHint),
  }));

  const nearMiss: V3RadarBandEntry[] = cockpitDto.opportunity.nearMiss.map((n) => ({
    symbol: n.symbol,
    reason: formatRadarReason(`${n.executionStatusLabel} — ${n.waitFor}`),
  }));

  const rejected = collectRejectedBandEntries(cockpitDto);

  const headroom = cockpitDto.riskBudgetHeadroom;
  let exposurePercent: number | null = null;
  let maxRiskPercent: number | null = null;
  let utilizationPercent: number | null = null;
  let utilizationTone: V3RiskConsole["utilizationTone"] = "normal";

  if (
    headroom.status === "configured" &&
    headroom.equityVnd.value != null &&
    headroom.equityVnd.value > 0 &&
    headroom.maxBookPercent.value != null
  ) {
    maxRiskPercent = Math.round(headroom.maxBookPercent.value * 100);
    exposurePercent = Math.round(
      (headroom.openExposureVnd.value / headroom.equityVnd.value) * 100
    );
    utilizationPercent = Math.round((exposurePercent / maxRiskPercent) * 100);
    if (utilizationPercent >= 85) utilizationTone = "critical";
    else if (utilizationPercent >= 65) utilizationTone = "elevated";
  }

  const curve = computeEquityCurve(trades);
  const recentCurve = curve.slice(-18);
  const signalPoints = recentCurve.map((p) => p.cumulativePnl);

  const blockers = [
    ...cockpitDto.risk.rules.map((r) => formatScannerReasonForUser(r.text)),
    ...cockpitDto.blockers.map((b) => formatScannerReasonForUser(b.waitFor)),
  ].filter(Boolean);

  return {
    marketPulse: {
      session: regime.latestBar
        ? `VNINDEX EOD · ${regime.latestBar.date.toISOString().slice(0, 10)}`
        : "VNINDEX · session unknown",
      freshness: formatFreshnessLabel(freshness),
      vnindex: regime.latestBar ? regime.latestBar.close.toFixed(2) : null,
      regime: displayGate1ScanLevel(cockpitDto.verdict.gate1Resolution.canonical),
      breadth: formatBreadth(latestScan, cockpitDto.gateFunnel),
      volatility: momentumVolatilityLabel(regime.momentum),
      watchState:
        watchItemCount > 0 ? `${watchItemCount} symbols on watch` : "No active watch items",
    },
    decision: {
      mode: mapUxVerdictToDecisionMode(cockpitDto.verdict.uxLevel.value),
      stanceLabel: cockpitDto.verdict.headline.value,
      confidenceBand: band,
      confidenceMeterWidth: confidenceBandMeterWidth(band),
      primaryReason: formatScannerReasonForUser(
        cockpitDto.verdict.subtitle.value || cockpitDto.verdict.explanation.value
      ),
      highestQualitySetup: buildHighestQualitySetup(cockpitDto.opportunity, topSetups),
      mainRisk: buildMainRisk(cockpitDto),
      nextAction: formatActionHintForUser(
        cockpitDto.tomorrow.triggerLine.value ||
          cockpitDto.opportunity.candidates[0]?.actionHint ||
          null
      ),
      riskPosture: cockpitDto.risk.stanceCopy.value,
      capitalProtection:
        formatScannerReasonForUser(
          cockpitDto.tomorrow.avoidLine.value || headroom.statusCopy || null
        ) || null,
    },
    signalTrajectory: {
      points: signalPoints,
      emptyMessage:
        signalPoints.length < 2 ? "No closed trades yet — equity trajectory unavailable." : null,
    },
    radar: {
      mapDots,
      qualified,
      nearMiss,
      rejected,
      avoidPlaceholders: collectAvoidPlaceholders(rejected),
    },
    setupCards: buildSetupCards(topSetups),
    risk: {
      exposurePercent,
      maxRiskPercent,
      openPositions: params.openPositionCount,
      lossLimit: null,
      posture: cockpitDto.risk.stanceCopy.value,
      blockers,
      capitalProtectionState: formatScannerReasonForUser(headroom.statusCopy) || headroom.statusCopy,
      utilizationPercent,
      utilizationTone,
    },
    ledger: {
      outcomeChips: buildRecentOutcomeChips(trades),
      openTrades: params.openPositionCount,
      pnlPulse:
        curve.length > 0
          ? `${curve[curve.length - 1]!.cumulativePnl >= 0 ? "+" : ""}${(curve[curve.length - 1]!.cumulativePnl / 1_000_000).toFixed(2)}M closed book`
          : null,
      pulseBarHeights: buildPulseBarHeights(trades),
      reviewHref: "/trades",
      reviewLabel: "Review on Trades",
    },
    evidence: buildEvidence(cockpitDto, freshness),
    rsWatchlist: mapRsWatchlistToV3Panel(cockpitDto.rsNearMissWatchlist),
    partialError: params.dbLoadError ?? null,
  };
}
