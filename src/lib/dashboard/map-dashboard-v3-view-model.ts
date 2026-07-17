import type { Trade } from "@/generated/prisma/client";
import { computeEquityCurve } from "@/lib/analytics";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import type { MarketRegimeFromDbResult } from "@/lib/playbook/get-market-regime";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import {
  formatSetupLadderStageLabel,
  type ConfidenceBand,
  type DataProvenance,
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
  V3HeaderCta,
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
import {
  buildRsScoringMapFromEntries,
  isRsScoringV1Enabled,
} from "@/lib/scanner/gate2/rs-scoring-v1";
import type { MarketContextUiDto } from "@/lib/market/market-context-ui-dto";
import { foreignFlowEvidenceState } from "./foreign-flow-evidence";

export type MapDashboardV3Params = {
  cockpitDto: DecisionCockpitDto;
  freshness: MarketFreshnessDto;
  regime: MarketRegimeFromDbResult;
  latestScan: LatestScanWithCandidates | null;
  topSetups: SurfacedCandidateHealthView[];
  trades: Trade[];
  watchItemCount: number;
  openPositionCount: number;
  marketContext?: MarketContextUiDto | null;
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
    case "NO_DATA":
      return 95;
    default:
      return 50;
  }
}

function healthLevelToUi(healthLevel: string): V3SetupCard["health"] {
  if (healthLevel === "HEALTHY") return "Healthy";
  if (healthLevel === "DEAD" || healthLevel === "AT_RISK" || healthLevel === "NO_DATA") {
    return "Blocked";
  }
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

function buildNextAction(
  cockpitDto: DecisionCockpitDto,
  openPositionCount: number
): { text: string | null; provenance: DataProvenance } {
  const ux = cockpitDto.verdict.uxLevel.value;

  if (ux === "NO_TRADE") {
    if (openPositionCount > 0) {
      return {
        text: "Do not enter new trades today. Review open positions on Ledger, or open the pipeline to see what is developing.",
        provenance: "static_copy",
      };
    }
    return {
      text: "Do not enter new trades today. Open the pipeline to see near-miss names and wait for the next scan.",
      provenance: "static_copy",
    };
  }

  if (ux === "PROBE") {
    const raw =
      cockpitDto.tomorrow.triggerLine.value ||
      cockpitDto.opportunity.candidates[0]?.actionHint ||
      null;
    const formatted = formatActionHintForUser(raw);
    if (!formatted) return { text: null, provenance: "derived" };
    const suffix = " — watch only, not a trade signal.";
    const text = formatted.toLowerCase().includes("watch only")
      ? formatted
      : `${formatted}${suffix}`;
    return { text, provenance: "derived" };
  }

  const raw =
    cockpitDto.tomorrow.triggerLine.value ||
    cockpitDto.opportunity.candidates[0]?.actionHint ||
    null;
  return {
    text: formatActionHintForUser(raw),
    provenance: "derived",
  };
}

function buildHeaderCta(
  mode: V3DecisionMode,
  openPositionCount: number
): V3HeaderCta {
  if (mode === "PROTECT CAPITAL") {
    if (openPositionCount > 0) {
      return {
        lead: "No new swing entries today. Review risk, watch the pipeline, and wait for the next scan.",
        primaryHref: "/setups",
        primaryLabel: "Review setups",
        secondaryHref: "/paper-lab",
        secondaryLabel: "Open Arena",
        tertiaryHref: null,
        tertiaryLabel: null,
      };
    }
    return {
      lead: "No new swing entries today. Review risk, watch the pipeline, and wait for the next scan.",
      primaryHref: "/setups",
      primaryLabel: "Open pipeline",
      secondaryHref: null,
      secondaryLabel: null,
      tertiaryHref: null,
      tertiaryLabel: null,
    };
  }

  if (mode === "WAIT") {
    return {
      lead: "Reduced-risk day. Watch developing setups — nothing is confirmed for full-size entry yet.",
      primaryHref: "/setups",
      primaryLabel: "Open pipeline",
      secondaryHref: "/paper-lab",
      secondaryLabel: "Open Arena",
      tertiaryHref: null,
      tertiaryLabel: null,
    };
  }

  if (mode === "TRADE") {
    return {
      lead: "Normal risk mode. Qualified setups passed filters — enter only when your playbook confirms.",
      primaryHref: "/setups",
      primaryLabel: "Review setups",
      secondaryHref: "/paper-lab",
      secondaryLabel: "Open Arena",
      tertiaryHref: null,
      tertiaryLabel: null,
    };
  }

  return {
    lead: "Watchlist-only day. Monitor names on your list — no new swing entries from the latest scan.",
    primaryHref: "/setups",
    primaryLabel: "Open pipeline",
    secondaryHref: "/paper-lab",
    secondaryLabel: "Open Arena",
    tertiaryHref: null,
    tertiaryLabel: null,
  };
}

function buildSetupIntelligenceCopy(
  ux: VerdictUxLevel,
  setupCount: number
): DashboardV3ViewModel["setupIntelligence"] {
  if (setupCount > 0) {
    return {
      emptyMessage: "",
      populatedSubtitle: `${setupCount} qualified setup${setupCount === 1 ? "" : "s"} — review entry, stop, and health before logging a trade.`,
    };
  }
  if (ux === "PROBE") {
    return {
      emptyMessage:
        "No setups cleared for full entry today. Use the pipeline to monitor watch-list names.",
      populatedSubtitle: "Trigger · risk · action",
    };
  }
  return {
    emptyMessage:
      "0 qualified setups in the latest scan. Open the pipeline to see near-miss names and rejection reasons.",
    populatedSubtitle: "Trigger · risk · action",
  };
}

function buildEvidenceDefaultOpen(
  cockpitDto: DecisionCockpitDto,
  freshness: MarketFreshnessDto,
  evidence: DashboardV3ViewModel["evidence"]
): boolean {
  if (cockpitDto.verdict.uxLevel.value === "NO_TRADE") return true;
  if (cockpitDto.verdict.gate1Resolution.mismatch) return true;
  if (freshness.scanSessionCoverage?.weakCoverage) return true;
  return evidence.some((e) => e.state === "warn" || e.state === "danger");
}

function rsWatchlistContextNote(ux: VerdictUxLevel): string {
  switch (ux) {
    case "NO_TRADE":
      return "Context only — relative strength does not qualify a setup and does not change today's no-trade stance.";
    case "PROBE":
      return "Context only — strong relative strength does not override today's watch stance.";
    case "TRADE":
      return "Context only — use for relative strength background; qualified setups are listed below.";
    default:
      return "Context only — does not count as a qualified setup or change today's trade decision.";
  }
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

function buildGate1MismatchNote(
  gate1: DecisionCockpitDto["verdict"]["gate1Resolution"],
  _ux: DecisionCockpitDto["verdict"]["uxLevel"]["value"]
): string | null {
  if (!gate1.mismatch || gate1.scanGate1 == null) return null;
  const scan = displayGate1ScanLevel(gate1.scanGate1);
  const live = displayGate1ScanLevel(gate1.liveRegimeGate1);
  if (gate1.liveOverrideApplied) {
    return `Scan tagged ${scan}, live ${live} — today's stance has been downgraded to the live reading.`;
  }
  return `Scan regime ${scan} · live ${live}`;
}

function buildMarketPulseRegimeLabel(
  gate1: DecisionCockpitDto["verdict"]["gate1Resolution"]
): string {
  const label = displayGate1ScanLevel(gate1.canonical);
  // liveOverrideApplied: canonical IS the live value now — label it as an override,
  // not "(scan)", which would wrongly imply the stale scan-time reading is showing.
  if (gate1.liveOverrideApplied) {
    return `${label} (live override)`;
  }
  if (gate1.mismatch && gate1.scanGate1 != null) {
    return `${label} (scan)`;
  }
  return label;
}

function augmentPrimaryReasonForMismatch(
  primaryReason: string,
  dto: DecisionCockpitDto
): string {
  const gate1 = dto.verdict.gate1Resolution;
  if (gate1.liveOverrideApplied) {
    return `${primaryReason} Live VNINDEX has weakened to ${displayGate1ScanLevel(gate1.liveRegimeGate1)} since the scan (was ${displayGate1ScanLevel(gate1.scanGate1!)}) — that shift supports staying out.`;
  }
  return primaryReason;
}

function buildMainRisk(dto: DecisionCockpitDto): string | null {
  const gate1 = dto.verdict.gate1Resolution;
  if (gate1.liveOverrideApplied) {
    return `Live regime is ${displayGate1ScanLevel(gate1.liveRegimeGate1)} while the scan was ${displayGate1ScanLevel(gate1.scanGate1!)} — prioritize capital preservation until conditions realign.`;
  }
  const blocker = dto.blockers[0];
  if (blocker) return formatScannerReasonForUser(blocker.meaning);
  if (gate1.canonical === "FAIL") {
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
    if (s.healthLevel === "DEAD" || s.healthLevel === "AT_RISK" || s.healthLevel === "NO_DATA") {
      actionState = "DO NOT TRADE";
    } else if (s.healthLevel === "HEALTHY" && s.lifecycleSortLabel === "READY") {
      actionState = "EXECUTE WINDOW OPEN";
    }

    return {
      symbol: s.symbolKey,
      tier: s.quality === "A" ? "A" : "B",
      setupType: "Breakout pullback",
      setupTypeProvenance: "static_copy",
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

/** Market-level foreign flow chips from Phase 1B — order preserved; 5D/10D omitted when absent in DTO. */
const MARKET_FOREIGN_EVIDENCE_IDS = [
  "market_foreign_1d",
  "market_foreign_coverage",
  "market_foreign_5d",
  "market_foreign_10d",
] as const;

export function mapMarketForeignEvidenceFromDto(
  dto: DecisionCockpitDto,
  marketContext?: MarketContextUiDto | null
): DashboardV3ViewModel["evidence"] {
  const byId = new Map(dto.evidence.map((chip) => [chip.id, chip]));
  const items: DashboardV3ViewModel["evidence"] = [];
  const market = marketContext?.market;

  for (const id of MARKET_FOREIGN_EVIDENCE_IDS) {
    const chip = byId.get(id);
    if (!chip) continue;

    let state: DashboardV3ViewModel["evidence"][number]["state"] = "ok";
    if (id === "market_foreign_1d") {
      state = foreignFlowEvidenceState(market?.foreignNetValue1d, market?.foreignFlowRollingDangerVnd);
    } else if (id === "market_foreign_5d") {
      state = foreignFlowEvidenceState(
        market?.foreignNetValue5d,
        market?.foreignFlowRolling5dDangerVnd
      );
    } else if (id === "market_foreign_10d") {
      state = foreignFlowEvidenceState(
        market?.foreignNetValue10d,
        market?.foreignFlowRolling10dDangerVnd
      );
    }

    items.push({
      label: chip.label,
      value: chip.display,
      state,
      provenance: chip.provenance,
    });
  }

  return items;
}

function buildEvidence(
  dto: DecisionCockpitDto,
  freshness: MarketFreshnessDto,
  marketContext?: MarketContextUiDto | null
): DashboardV3ViewModel["evidence"] {
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

  items.push(...mapMarketForeignEvidenceFromDto(dto, marketContext));

  return items;
}

export function mapDashboardV3ViewModel(params: MapDashboardV3Params): DashboardV3ViewModel {
  const {
    cockpitDto,
    freshness,
    regime,
    latestScan,
    topSetups,
    trades,
    watchItemCount,
    marketContext,
  } = params;
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

  // Book-level risk headroom (equity vs. max-book cap) was Trade-table-derived
  // and removed alongside the Risk guardrail / Trade gate Dashboard panels —
  // see decision-cockpit-dto.ts. These fields stay in V3RiskConsole's shape
  // (currently unread by any Dashboard consumer) as inert defaults rather than
  // reworking the type now.
  const exposurePercent: number | null = null;
  const maxRiskPercent: number | null = null;
  const utilizationPercent: number | null = null;
  const utilizationTone: V3RiskConsole["utilizationTone"] = "normal";

  const curve = computeEquityCurve(trades);
  const recentCurve = curve.slice(-18);
  const signalPoints = recentCurve.map((p) => p.cumulativePnl);

  const decisionMode = mapUxVerdictToDecisionMode(cockpitDto.verdict.uxLevel.value);
  const nextActionResult = buildNextAction(cockpitDto, params.openPositionCount);
  const setupCards = buildSetupCards(topSetups);
  const evidence = buildEvidence(cockpitDto, freshness, marketContext);

  const gate1Mismatch = cockpitDto.verdict.gate1Resolution.mismatch;

  return {
    marketPulse: {
      session: regime.latestBar
        ? `VNINDEX EOD · ${regime.latestBar.date.toISOString().slice(0, 10)}`
        : "VNINDEX · session unknown",
      freshness: formatFreshnessLabel(freshness),
      vnindex: regime.latestBar ? regime.latestBar.close.toFixed(2) : null,
      regime: buildMarketPulseRegimeLabel(cockpitDto.verdict.gate1Resolution),
      breadth: formatBreadth(latestScan, cockpitDto.gateFunnel),
      volatility: momentumVolatilityLabel(regime.momentum),
      watchState:
        watchItemCount === 1
          ? "1 symbol on watch"
          : watchItemCount > 0
            ? `${watchItemCount} symbols on watch`
            : "No active watch items",
      gate1Mismatch,
      gate1MismatchNote: buildGate1MismatchNote(
        cockpitDto.verdict.gate1Resolution,
        cockpitDto.verdict.uxLevel.value
      ),
    },
    headerCta: buildHeaderCta(decisionMode, params.openPositionCount),
    decision: {
      mode: decisionMode,
      stanceLabel: cockpitDto.verdict.headline.value,
      confidenceBand: band,
      confidenceMeterWidth: confidenceBandMeterWidth(band),
      primaryReason: augmentPrimaryReasonForMismatch(
        formatScannerReasonForUser(
          cockpitDto.verdict.subtitle.value || cockpitDto.verdict.explanation.value
        ),
        cockpitDto
      ),
      highestQualitySetup:
        decisionMode === "TRADE"
          ? buildHighestQualitySetup(cockpitDto.opportunity, topSetups)
          : null,
      mainRisk: buildMainRisk(cockpitDto),
      nextAction: nextActionResult.text,
      nextActionProvenance: nextActionResult.provenance,
      // Risk guardrail's stance copy was Trade-table-derived and removed —
      // tomorrow's posture line is the closest still-real substitute.
      riskPosture: cockpitDto.tomorrow.postureLine.value,
      capitalProtection:
        formatScannerReasonForUser(cockpitDto.tomorrow.avoidLine.value || null) || null,
    },
    signalTrajectory: {
      points: signalPoints,
      emptyMessage:
        signalPoints.length < 2 ? "No closed positions yet — equity trajectory unavailable." : null,
    },
    radar: {
      mapDots,
      qualified,
      nearMiss,
      rejected,
      avoidPlaceholders: collectAvoidPlaceholders(rejected),
      sparklineProvenance: "derived",
    },
    setupCards,
    setupIntelligence: buildSetupIntelligenceCopy(
      cockpitDto.verdict.uxLevel.value,
      setupCards.length
    ),
    risk: {
      exposurePercent,
      maxRiskPercent,
      openPositions: params.openPositionCount,
      lossLimit: null,
      posture: cockpitDto.tomorrow.postureLine.value,
      capitalProtectionState:
        formatScannerReasonForUser(cockpitDto.tomorrow.avoidLine.value) || "",
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
      reviewHref: "/setups",
      reviewLabel: "Review setups",
    },
    evidence,
    evidenceDefaultOpen: buildEvidenceDefaultOpen(cockpitDto, freshness, evidence),
    rsWatchlist: (() => {
      const scoringBySymbol = isRsScoringV1Enabled()
        ? buildRsScoringMapFromEntries(cockpitDto.rsNearMissWatchlist.rows, {
            gate1Level: cockpitDto.verdict.gate1Resolution.canonical,
          })
        : undefined;
      return {
        ...mapRsWatchlistToV3Panel(cockpitDto.rsNearMissWatchlist, {
          scoringBySymbol: scoringBySymbol
            ? new Map(
                [...scoringBySymbol.entries()].map(([sym, s]) => [
                  sym,
                  {
                    rsStrengthScore: s.rsStrengthScore,
                    setupReadinessScore: s.setupReadinessScore,
                    rsConfidence: s.rsConfidence,
                  },
                ])
              )
            : undefined,
        }),
        contextNote: rsWatchlistContextNote(cockpitDto.verdict.uxLevel.value),
      };
    })(),
    partialError: params.dbLoadError ?? null,
  };
}
