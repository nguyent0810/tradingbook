import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { DailyScanGate2Notes, Gate2ClosestSymbolRow } from "@/lib/scanner/gate2-scan-diagnostics";
import {
  computeClosestExecutionStatus,
  computeDistanceToPullbackZoneFrac,
  closestExecutionActionHint,
  isStructureBrokenCategory,
} from "@/lib/scanner/closest-execution-metrics";
import type { MarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  computeDailyTradingDecision,
  type DailyTradingDecision,
  type DailyTradingDecisionLevel,
} from "@/lib/scanner/trading-decision";
import {
  rejectionBucketLabel,
  rejectionBucketTraderGuide,
} from "@/lib/scanner/setups-trader-copy";
import type { SetupHealthFlag, SetupHealthLevelValue } from "@/lib/setup-health/types";
import { healthFlagSummary } from "@/lib/setup-health/health-ui-copy";
import { displayGate1ScanLevel } from "@/lib/trading-display-labels";

/** How a cockpit field is sourced (UX spec §10). */
export type DataProvenance = "real" | "derived" | "static_copy" | "config" | "gap";

/** Trader-facing verdict (NORMAL → TRADE in UI only). */
export type VerdictUxLevel = "NO_TRADE" | "PROBE" | "TRADE";

export type ConfidenceBand = "high" | "medium" | "low";

export type SetupLadderStage =
  | "tier_a"
  | "tier_b"
  | "watch"
  | "extended"
  | "invalid"
  | "avoid";

export type BlockerSeverity = "market_off" | "structure_broken" | "timing" | "extension" | "info";

export type Gate1CanonicalSource = "scan_run" | "live_regime" | "none";

/** DC-1: which Gate 1 drives verdict + evidence primary chip. */
export type Gate1Resolution = {
  canonical: Gate1Level;
  source: Gate1CanonicalSource;
  scanGate1: Gate1Level | null;
  liveRegimeGate1: Gate1Level;
  mismatch: boolean;
  note: string;
};

export type DecisionCockpitScanSnapshot = {
  id: string;
  runAt: Date;
  gate1Level: Gate1Level;
  candidateCountA: number;
  candidateCountB: number;
  candidateCountSurfaced: number;
  universeScannedCount?: number | null;
};

export type DecisionCockpitRegimeSnapshot = {
  level: Gate1Level;
  symbol: string;
  latestBar: { date: Date; close: number } | null;
};

export type DecisionCockpitCandidateSnapshot = {
  id: string;
  symbolKey: string;
  quality: "A" | "B";
  lifecycleSortLabel: "READY" | "WATCHING";
  healthLevel: SetupHealthLevelValue;
  healthScore: number;
  healthScoreLabel: string;
  healthFlags: SetupHealthFlag[];
  healthSummary: string | null;
  reasons: unknown[];
  close: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  rankScore: number;
};

export type DecisionCockpitWatchSnapshot = {
  symbol: string;
  lifecycleStatus: string;
  healthLevel: SetupHealthLevelValue | null;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
};

export type DecisionCockpitInput = {
  latestScan: DecisionCockpitScanSnapshot | null;
  scanNotes: DailyScanGate2Notes | null;
  liveRegime: DecisionCockpitRegimeSnapshot;
  freshness: MarketFreshnessDto;
  surfacedCandidates: DecisionCockpitCandidateSnapshot[];
  watchlist: DecisionCockpitWatchSnapshot[];
  /** Sum of entryPrice × quantity for OPEN trades (VND). */
  openExposureVnd: number;
  /** From `TRADING_ACCOUNT_EQUITY_VND` when set — not live broker balance. */
  accountEquityVnd: number | null;
  portfolioRiskConfigured: boolean;
  /** When set, used for scan-age confidence (tests). */
  now?: Date;
};

export type ProvenanceField<T> = {
  value: T;
  provenance: DataProvenance;
};

export type EvidenceChipDto = {
  id: string;
  label: string;
  display: string;
  provenance: DataProvenance;
};

export type VerdictDto = {
  uxLevel: ProvenanceField<VerdictUxLevel>;
  persistedLevel: ProvenanceField<DailyTradingDecisionLevel>;
  headline: ProvenanceField<string>;
  explanation: ProvenanceField<string>;
  allocation: ProvenanceField<string>;
  perTradeGuidance: ProvenanceField<string>;
  confidenceBand: ProvenanceField<ConfidenceBand>;
  gate1Resolution: Gate1Resolution;
};

export type OpportunityCandidateDto = {
  candidateId: string;
  symbol: string;
  quality: "A" | "B";
  ladderStage: SetupLadderStage;
  healthLevel: SetupHealthLevelValue;
  healthSummary: string | null;
  primaryReasons: string[];
  actionHint: string;
  provenance: DataProvenance;
};

export type OpportunityNearMissDto = {
  symbol: string;
  terminalCategory: string;
  ladderStage: SetupLadderStage;
  executionStatus: ReturnType<typeof computeClosestExecutionStatus>;
  waitFor: string;
  distanceToZonePct: number | null;
  actionHint: string;
  provenance: DataProvenance;
};

export type OpportunityBoardDto = {
  mode: "candidates" | "near_miss" | "empty";
  candidates: OpportunityCandidateDto[];
  nearMiss: OpportunityNearMissDto[];
  emptyReason: string | null;
};

export type LadderRowDto = {
  symbol: string;
  ladderStage: SetupLadderStage;
  quality: string;
  healthLevel: string;
  provenance: DataProvenance;
};

/** Ordered pipeline stages for the setup quality ladder panel (S5). */
export const SETUP_LADDER_STAGE_ORDER: SetupLadderStage[] = [
  "tier_a",
  "tier_b",
  "watch",
  "extended",
  "invalid",
  "avoid",
];

export type LadderStageGroupDto = {
  stage: SetupLadderStage;
  label: string;
  subtitle: string;
  count: number;
  sampleSymbols: string[];
  provenance: DataProvenance;
};

export type SetupQualityLadderDto = {
  stages: LadderStageGroupDto[];
  /** Sum of per-stage counts (each symbol counted once in one stage). */
  totalClassified: number;
};

export type BestSetupsPanelMode = "full_table" | "compact_empty";

export type BestSetupsPanelPresentation = {
  mode: BestSetupsPanelMode;
  emptyTitle: string;
  emptyReason: string;
};

export type RiskGuardrailDto = {
  maxBookAllocation: ProvenanceField<string>;
  perTradeGuidance: ProvenanceField<string>;
  openExposureVnd: ProvenanceField<number>;
  stanceCopy: ProvenanceField<string>;
  rules: Array<{ text: string; provenance: DataProvenance }>;
};

/** DC-5 book-level headroom — not stop/R-multiple risk. */
export type RiskBudgetHeadroomStatus = "configured" | "partial" | "unavailable";

export type RiskBudgetHeadroomDto = {
  status: RiskBudgetHeadroomStatus;
  statusCopy: string;
  equityVnd: ProvenanceField<number | null>;
  openExposureVnd: ProvenanceField<number>;
  maxBookVnd: ProvenanceField<number | null>;
  remainingBookVnd: ProvenanceField<number | null>;
  /** Upper bound of verdict allocation range as decimal (e.g. 0.7 for 70%). */
  maxBookPercent: ProvenanceField<number | null>;
  perTradeRiskGuidance: ProvenanceField<string>;
  isOverMaxBook: boolean;
  caveats: string[];
};

export type TomorrowPlanDto = {
  watchSymbols: ProvenanceField<string[]>;
  /** Set when watch list is empty — honest fallback copy (derived/static). */
  watchNote: ProvenanceField<string | null>;
  triggerLine: ProvenanceField<string>;
  avoidLine: ProvenanceField<string>;
  postureLine: ProvenanceField<string>;
};

export type ActionableBlockerDto = {
  severity: BlockerSeverity;
  title: string;
  /** Plain-language meaning (trader copy mapped from scanner category). */
  meaning: string;
  count: number;
  sampleSymbols: string[];
  waitFor: string;
  provenance: DataProvenance;
};

export type ActionableDiagnosticsDto = {
  blockers: ActionableBlockerDto[];
  maxShown: number;
  emptyReason: string | null;
};

export type DecisionCockpitDto = {
  verdict: VerdictDto;
  evidence: EvidenceChipDto[];
  opportunity: OpportunityBoardDto;
  ladder: LadderRowDto[];
  /** Grouped pipeline counts + sample symbols (S5). */
  setupQualityLadder: SetupQualityLadderDto;
  risk: RiskGuardrailDto;
  /** DC-5 book cap vs configured equity — no fabricated R/stop risk. */
  riskBudgetHeadroom: RiskBudgetHeadroomDto;
  tomorrow: TomorrowPlanDto;
  /** Dashboard compact blockers (max 3); same source as `blockers`. */
  actionableDiagnostics: ActionableDiagnosticsDto;
  blockers: ActionableBlockerDto[];
  scanRunId: string | null;
};

const LADDER_STAGE_UI: Record<SetupLadderStage, { label: string; subtitle: string }> = {
  tier_a: { label: "Tier A", subtitle: "Tradeable" },
  tier_b: { label: "Tier B", subtitle: "Reduced size" },
  watch: { label: "Watch", subtitle: "Near miss" },
  extended: { label: "Extended", subtitle: "Good stock, bad entry" },
  invalid: { label: "Invalid", subtitle: "Rule broken" },
  avoid: { label: "Avoid", subtitle: "Risk too high" },
};

/** Trader-facing ladder stage label (shared with dashboard panels). */
export function formatSetupLadderStageLabel(stage: SetupLadderStage): string {
  return LADDER_STAGE_UI[stage]?.label ?? stage;
}

/** Trader-facing severity group for dashboard blockers. */
export function formatBlockerSeverity(severity: BlockerSeverity): string {
  switch (severity) {
    case "market_off":
      return "Market off";
    case "structure_broken":
      return "Structure broken";
    case "extension":
      return "Extension / chase";
    case "timing":
      return "Timing / wait";
    default:
      return "Data / liquidity";
  }
}

const EXTENSION_FLAGS: SetupHealthFlag[] = ["EXTENDED", "TOO_EXTENDED", "CHASE"];
const EXTENSION_CATEGORIES = new Set(["extension_cap", "volume_ratio"]);

export function mapDecisionLevelToUxVerdict(
  level: DailyTradingDecisionLevel
): VerdictUxLevel {
  if (level === "NORMAL") return "TRADE";
  return level;
}

export function resolveCanonicalGate1(input: {
  scanGate1: Gate1Level | null;
  liveRegimeGate1: Gate1Level;
}): Gate1Resolution {
  const { scanGate1, liveRegimeGate1 } = input;
  if (scanGate1 != null) {
    const mismatch = scanGate1 !== liveRegimeGate1;
    return {
      canonical: scanGate1,
      source: "scan_run",
      scanGate1,
      liveRegimeGate1,
      mismatch,
      note: mismatch
        ? "Verdict uses scan-run Gate 1; live regime differs — see evidence chips."
        : "Verdict uses scan-run Gate 1 (aligned with Setups page).",
    };
  }
  return {
    canonical: liveRegimeGate1,
    source: "live_regime",
    scanGate1: null,
    liveRegimeGate1,
    mismatch: false,
    note: "No daily scan — verdict uses live VNINDEX regime only.",
  };
}

export function resolveSetupLadderStage(
  candidate: DecisionCockpitCandidateSnapshot
): SetupLadderStage {
  if (candidate.healthLevel === "DEAD") return "invalid";
  if (candidate.healthLevel === "AT_RISK") return "avoid";
  if (candidate.healthFlags.some((f) => EXTENSION_FLAGS.includes(f))) return "extended";
  if (
    candidate.quality === "A" &&
    candidate.lifecycleSortLabel === "READY" &&
    candidate.healthLevel === "HEALTHY"
  ) {
    return "tier_a";
  }
  if (candidate.quality === "B" && candidate.lifecycleSortLabel === "READY") {
    return "tier_b";
  }
  return "watch";
}

function resolveNearMissLadderStage(
  row: Gate2ClosestSymbolRow,
  status: ReturnType<typeof computeClosestExecutionStatus>
): SetupLadderStage {
  if (status === "INVALID" || isStructureBrokenCategory(row.terminalCategory)) {
    return "invalid";
  }
  if (row.terminalCategory === "extension_cap") return "extended";
  return "watch";
}

function classifyBlockerSeverity(category: string, gate1: Gate1Level): BlockerSeverity {
  if (gate1 === "FAIL") return "market_off";
  if (isStructureBrokenCategory(category)) return "structure_broken";
  if (EXTENSION_CATEGORIES.has(category)) return "extension";
  if (
    category === "insufficient_bars" ||
    category === "stale_or_session_mismatch" ||
    category === "volume_median_bad"
  ) {
    return "info";
  }
  return "timing";
}

export function computeConfidenceBand(params: {
  hasScan: boolean;
  freshness: MarketFreshnessDto;
  gate1: Gate1Level;
  surfacedCount: number;
  now: Date;
  scanRunAt: Date | null;
}): ConfidenceBand {
  const { hasScan, freshness, gate1, surfacedCount, now, scanRunAt } = params;

  if (!hasScan || freshness.staleFlags.some((f) => f.severity === "error")) {
    return "low";
  }

  const scanAgeHours =
    scanRunAt != null ? (now.getTime() - scanRunAt.getTime()) / (1000 * 60 * 60) : null;
  const scanStale = scanAgeHours != null && scanAgeHours > 36;

  if (
    freshness.delayedBackdrop ||
    freshness.staleFlags.length > 0 ||
    scanStale ||
    gate1 === "FAIL"
  ) {
    return "low";
  }

  if (
    !freshness.delayedBackdrop &&
    freshness.staleFlags.length === 0 &&
    gate1 === "PASS" &&
    surfacedCount > 0 &&
    scanAgeHours != null &&
    scanAgeHours <= 24
  ) {
    return "high";
  }

  return "medium";
}

function resolveDecision(
  scanNotes: DailyScanGate2Notes | null,
  gate1: Gate1Level,
  latestScan: DecisionCockpitScanSnapshot | null
): DailyTradingDecision {
  if (scanNotes?.decision) return scanNotes.decision;
  if (latestScan) {
    return computeDailyTradingDecision({
      gate1Level: gate1,
      candidateCountA: latestScan.candidateCountA,
      candidateCountB: latestScan.candidateCountB,
    });
  }
  return {
    level: "NO_TRADE",
    allocation: "0%",
    explanation: "No scan run found yet.",
  };
}

function perTradeGuidanceForLevel(level: DailyTradingDecisionLevel): string {
  return level === "PROBE" ? "10–15% of equity" : level === "NORMAL" ? "10–20% of equity" : "None";
}

const RISK_BUDGET_CAVEATS = [
  "Equity from TRADING_ACCOUNT_EQUITY_VND — not a live broker balance.",
  "Open exposure is sum of entry × quantity on OPEN trades — not mark-to-market or stop-based risk.",
  "Per-trade guidance is static copy — not R-multiple sizing from stops.",
] as const;

/**
 * Parse upper bound of verdict max-book allocation string (e.g. "50-70%" → 0.7).
 * Returns null when the string cannot be parsed.
 */
export function parseMaxBookFractionFromAllocation(allocation: string): number | null {
  const range = allocation.match(/(\d+)\s*-\s*(\d+)%/);
  if (range) return Number(range[2]) / 100;
  const single = allocation.match(/(\d+)%/);
  if (single) return Number(single[1]) / 100;
  return null;
}

/**
 * DC-5: book-level headroom from env equity + verdict cap + open notional only.
 */
export function buildRiskBudgetHeadroom(params: {
  accountEquityVnd: number | null;
  openExposureVnd: number;
  maxBookAllocation: string;
  perTradeGuidance: string;
}): RiskBudgetHeadroomDto {
  const { accountEquityVnd, openExposureVnd, maxBookAllocation, perTradeGuidance } = params;
  const openField: ProvenanceField<number> = {
    value: openExposureVnd,
    provenance: "derived",
  };
  const perTradeField: ProvenanceField<string> = {
    value: perTradeGuidance,
    provenance: "static_copy",
  };

  if (accountEquityVnd == null || accountEquityVnd <= 0) {
    return {
      status: "unavailable",
      statusCopy:
        "Risk budget headroom not configured — set TRADING_ACCOUNT_EQUITY_VND to compare open notional to a book cap.",
      equityVnd: { value: null, provenance: "gap" },
      openExposureVnd: openField,
      maxBookVnd: { value: null, provenance: "gap" },
      remainingBookVnd: { value: null, provenance: "gap" },
      maxBookPercent: { value: null, provenance: "gap" },
      perTradeRiskGuidance: perTradeField,
      isOverMaxBook: false,
      caveats: [...RISK_BUDGET_CAVEATS],
    };
  }

  const maxBookPercent = parseMaxBookFractionFromAllocation(maxBookAllocation);
  if (maxBookPercent == null) {
    return {
      status: "partial",
      statusCopy:
        "Account equity is configured but verdict max-book allocation could not be parsed — caps stay qualitative.",
      equityVnd: { value: accountEquityVnd, provenance: "config" },
      openExposureVnd: openField,
      maxBookVnd: { value: null, provenance: "gap" },
      remainingBookVnd: { value: null, provenance: "gap" },
      maxBookPercent: { value: null, provenance: "gap" },
      perTradeRiskGuidance: perTradeField,
      isOverMaxBook: false,
      caveats: [...RISK_BUDGET_CAVEATS],
    };
  }

  const maxBookVnd = Math.round(accountEquityVnd * maxBookPercent);
  const remainingBookVnd = maxBookVnd - openExposureVnd;

  return {
    status: "configured",
    statusCopy:
      remainingBookVnd < 0
        ? "Open notional exceeds parsed max-book cap — reduce exposure or raise cap only after review."
        : "Book headroom uses configured equity and verdict max-book upper bound.",
    equityVnd: { value: accountEquityVnd, provenance: "config" },
    openExposureVnd: openField,
    maxBookVnd: { value: maxBookVnd, provenance: "derived" },
    remainingBookVnd: { value: remainingBookVnd, provenance: "derived" },
    maxBookPercent: { value: maxBookPercent, provenance: "derived" },
    perTradeRiskGuidance: perTradeField,
    isOverMaxBook: remainingBookVnd < 0,
    caveats: [...RISK_BUDGET_CAVEATS],
  };
}

function stanceCopyForLevel(ux: VerdictUxLevel): string {
  switch (ux) {
    case "NO_TRADE":
      return "Preserve capital — no new swing entries.";
    case "PROBE":
      return "Small, selective probes only.";
    default:
      return "Normal risk with discipline.";
  }
}

function buildEvidenceStack(
  gate1: Gate1Resolution,
  latestScan: DecisionCockpitScanSnapshot | null,
  liveRegime: DecisionCockpitRegimeSnapshot,
  freshness: MarketFreshnessDto
): EvidenceChipDto[] {
  const chips: EvidenceChipDto[] = [
    {
      id: "gate1",
      label: "Gate 1",
      display: displayGate1ScanLevel(gate1.canonical),
      provenance: gate1.source === "scan_run" ? "real" : "derived",
    },
  ];

  if (gate1.mismatch) {
    chips.push({
      id: "gate1_live",
      label: "Gate 1 (live)",
      display: displayGate1ScanLevel(gate1.liveRegimeGate1),
      provenance: "real",
    });
  }

  if (liveRegime.latestBar) {
    chips.push({
      id: "vnindex",
      label: "VNINDEX",
      display: `${liveRegime.latestBar.close.toFixed(2)} · ${liveRegime.latestBar.date.toISOString().slice(0, 10)}`,
      provenance: "real",
    });
  }

  if (latestScan) {
    chips.push(
      {
        id: "tier_a",
        label: "Tier A",
        display: String(latestScan.candidateCountA),
        provenance: "real",
      },
      {
        id: "tier_b",
        label: "Tier B",
        display: String(latestScan.candidateCountB),
        provenance: "real",
      },
      {
        id: "surfaced",
        label: "Surfaced",
        display: String(latestScan.candidateCountSurfaced),
        provenance: "real",
      }
    );
    if (latestScan.universeScannedCount != null) {
      chips.push({
        id: "universe",
        label: "Universe scanned",
        display: String(latestScan.universeScannedCount),
        provenance: "real",
      });
    }
  }

  chips.push({
    id: "aligned",
    label: "Data aligned",
    display:
      freshness.delayedBackdrop || freshness.staleFlags.length > 0 ? "Review flags" : "Yes",
    provenance: "derived",
  });

  if (freshness.scanRunAt) {
    chips.push({
      id: "scan_at",
      label: "Scan",
      display: freshness.scanRunAt.slice(0, 16).replace("T", " "),
      provenance: "real",
    });
  }

  return chips;
}

function buildOpportunityBoard(
  candidates: DecisionCockpitCandidateSnapshot[],
  nearMiss: Gate2ClosestSymbolRow[],
  latestScan: DecisionCockpitScanSnapshot | null
): OpportunityBoardDto {
  const top = candidates.slice(0, 5);
  if (top.length > 0) {
    return {
      mode: "candidates",
      candidates: top.map((c) => {
        const ladder = resolveSetupLadderStage(c);
        const reasons = (Array.isArray(c.reasons) ? c.reasons : [])
          .slice(0, 2)
          .map((r) => String(r));
        const summary = c.healthSummary ?? healthFlagSummary(c.healthFlags);
        let actionHint = "Review on Setups";
        if (ladder === "tier_a" || ladder === "tier_b") {
          actionHint =
            c.lifecycleSortLabel === "READY"
              ? `Log trade → /trades/new?setupCandidateId=${c.id}`
              : "Wait for entry zone";
        }
        return {
          candidateId: c.id,
          symbol: c.symbolKey,
          quality: c.quality,
          ladderStage: ladder,
          healthLevel: c.healthLevel,
          healthSummary: summary,
          primaryReasons: reasons,
          actionHint,
          provenance: "derived",
        };
      }),
      nearMiss: [],
      emptyReason: null,
    };
  }

  const nearRows = nearMiss.slice(0, 8);
  if (nearRows.length > 0) {
    return {
      mode: "near_miss",
      candidates: [],
      nearMiss: nearRows.map((row) => {
        const status = computeClosestExecutionStatus(
          row.terminalCategory,
          row.close,
          row.pullbackZoneLow,
          row.pullbackZoneHigh
        );
        const guide = rejectionBucketTraderGuide(row.terminalCategory);
        const dist = computeDistanceToPullbackZoneFrac(
          row.close,
          row.pullbackZoneLow,
          row.pullbackZoneHigh
        );
        return {
          symbol: row.symbol,
          terminalCategory: row.terminalCategory,
          ladderStage: resolveNearMissLadderStage(row, status),
          executionStatus: status,
          waitFor: guide.waitFor,
          distanceToZonePct: Number.isFinite(dist) ? dist * 100 : null,
          actionHint: closestExecutionActionHint(status),
          provenance: "real",
        };
      }),
      emptyReason: null,
    };
  }

  return {
    mode: "empty",
    candidates: [],
    nearMiss: [],
    emptyReason: latestScan
      ? "No surfaced candidates and no near-miss ranking in latest scan notes."
      : "No daily scan yet.",
  };
}

function buildLadderRows(
  opportunity: OpportunityBoardDto,
  candidates: DecisionCockpitCandidateSnapshot[]
): LadderRowDto[] {
  if (opportunity.mode === "candidates") {
    return candidates.slice(0, 8).map((c) => ({
      symbol: c.symbolKey,
      ladderStage: resolveSetupLadderStage(c),
      quality: c.quality,
      healthLevel: c.healthLevel,
      provenance: "derived" as const,
    }));
  }
  return opportunity.nearMiss.map((n) => ({
    symbol: n.symbol,
    ladderStage: n.ladderStage,
    quality: "—",
    healthLevel: n.terminalCategory,
    provenance: "derived" as const,
  }));
}

function buildSetupQualityLadder(
  candidates: DecisionCockpitCandidateSnapshot[],
  nearMiss: Gate2ClosestSymbolRow[]
): SetupQualityLadderDto {
  const symbolsByStage = new Map<SetupLadderStage, string[]>();
  for (const stage of SETUP_LADDER_STAGE_ORDER) {
    symbolsByStage.set(stage, []);
  }

  for (const c of candidates) {
    const stage = resolveSetupLadderStage(c);
    const bucket = symbolsByStage.get(stage)!;
    if (!bucket.includes(c.symbolKey)) bucket.push(c.symbolKey);
  }

  for (const row of nearMiss) {
    const status = computeClosestExecutionStatus(
      row.terminalCategory,
      row.close,
      row.pullbackZoneLow,
      row.pullbackZoneHigh
    );
    const stage = resolveNearMissLadderStage(row, status);
    const bucket = symbolsByStage.get(stage)!;
    if (!bucket.includes(row.symbol)) bucket.push(row.symbol);
  }

  const stages: LadderStageGroupDto[] = SETUP_LADDER_STAGE_ORDER.map((stage) => {
    const symbols = symbolsByStage.get(stage) ?? [];
    return {
      stage,
      label: LADDER_STAGE_UI[stage].label,
      subtitle: LADDER_STAGE_UI[stage].subtitle,
      count: symbols.length,
      sampleSymbols: symbols.slice(0, 3),
      provenance: "derived",
    };
  });

  return {
    stages,
    totalClassified: stages.reduce((sum, s) => sum + s.count, 0),
  };
}

/**
 * Best Setups table vs compact empty (S5 dedup with Opportunity preview).
 * Uses only setup row count + opportunity mode — no new queries.
 */
export function resolveBestSetupsPanelPresentation(params: {
  setupRowCount: number;
  opportunity: OpportunityBoardDto;
  latestScan: DecisionCockpitScanSnapshot | null;
}): BestSetupsPanelPresentation {
  if (params.setupRowCount > 0) {
    return {
      mode: "full_table",
      emptyTitle: "",
      emptyReason: "",
    };
  }

  const { opportunity, latestScan } = params;

  function emptyBestSetupsCopy(extraNearMissHint: boolean): BestSetupsPanelPresentation {
    if (!latestScan) {
      return {
        mode: "compact_empty",
        emptyTitle: "No validated breakout-pullback setups today",
        emptyReason: "No daily scan yet — check Setups after the next scan run.",
      };
    }
    const gate1 = latestScan.gate1Level;
    const gate1Note =
      gate1 === "WARNING"
        ? "Gate 1 is WARNING (Tier B would not surface even if present)."
        : gate1 === "FAIL"
          ? "Gate 1 is FAIL — new swing setups are suppressed."
          : "Gate 1 is PASS.";
    const nearHint = extraNearMissHint
      ? " See Near miss / rejection panel for closest names (e.g. VND pullback-box near-miss)."
      : " See Near miss / rejection and Momentum Watch below for observational context.";
    return {
      mode: "compact_empty",
      emptyTitle: "No validated breakout-pullback setups today",
      emptyReason: [
        "Coverage is fresh; the scanner found 0 Tier A/B candidates under current Gate2 rules.",
        `${gate1Note} Surfaced: ${latestScan.candidateCountSurfaced} (Tier A ${latestScan.candidateCountA} · Tier B ${latestScan.candidateCountB}).`,
        nearHint,
      ].join(" "),
    };
  }

  if (opportunity.mode === "near_miss") {
    return emptyBestSetupsCopy(true);
  }

  if (opportunity.mode === "candidates") {
    return {
      mode: "compact_empty",
      emptyTitle: "No validated breakout-pullback setups today",
      emptyReason:
        "Surfaced names appear in Opportunity preview — none scored for this detail table.",
    };
  }

  return emptyBestSetupsCopy(false);
}

function buildActionableBlockers(
  scanNotes: DailyScanGate2Notes | null,
  gate1: Gate1Level,
  max = 3
): ActionableBlockerDto[] {
  const buckets = Object.entries(scanNotes?.topRejectionCategories ?? {}).sort(
    (a, b) => b[1] - a[1]
  );

  const blockers: ActionableBlockerDto[] = [];

  if (gate1 === "FAIL") {
    blockers.push({
      severity: "market_off",
      title: "Gate 1 — market backdrop unfavorable",
      meaning: "Index trend filter failed — new swing longs are off the table.",
      count: 0,
      sampleSymbols: [],
      waitFor: "VNINDEX regime to improve before new swing risk.",
      provenance: "derived",
    });
  }

  for (const [category, count] of buckets) {
    const guide = rejectionBucketTraderGuide(category);
    blockers.push({
      severity: classifyBlockerSeverity(category, gate1),
      title: rejectionBucketLabel(category),
      meaning: guide.meaning,
      count,
      sampleSymbols: (scanNotes?.rejectionSymbolsByCategory?.[category] ?? []).slice(0, 3),
      waitFor: guide.waitFor,
      provenance: "real",
    });
  }

  const severityOrder: Record<BlockerSeverity, number> = {
    market_off: 0,
    structure_broken: 1,
    extension: 2,
    timing: 3,
    info: 4,
  };

  return blockers
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count)
    .slice(0, max);
}

function buildTomorrowPlan(
  ux: VerdictUxLevel,
  decision: DailyTradingDecision,
  opportunity: OpportunityBoardDto,
  watchlist: DecisionCockpitWatchSnapshot[],
  blockers: ActionableBlockerDto[]
): TomorrowPlanDto {
  const watchSymbols: string[] = [];
  for (const c of opportunity.candidates) watchSymbols.push(c.symbol);
  for (const n of opportunity.nearMiss) {
    if (!watchSymbols.includes(n.symbol)) watchSymbols.push(n.symbol);
  }
  for (const w of watchlist.slice(0, 5)) {
    if (!watchSymbols.includes(w.symbol)) watchSymbols.push(w.symbol);
  }

  const triggerParts: string[] = [];
  if (opportunity.mode === "near_miss" && opportunity.nearMiss[0]) {
    const first = opportunity.nearMiss[0];
    triggerParts.push(`${first.symbol}: ${first.waitFor}`);
  } else if (opportunity.candidates[0]) {
    const c = opportunity.candidates[0];
    triggerParts.push(`${c.symbol}: ${c.actionHint}`);
  } else {
    triggerParts.push("Next scan with Gate 1 PASS and Tier A/B surfaced.");
  }

  const avoidParts: string[] = [];
  if (ux === "NO_TRADE") {
    avoidParts.push(`No new swing risk — ${decision.allocation} book cap.`);
  }
  const topExtension = blockers.find((b) => b.severity === "extension");
  if (topExtension) {
    avoidParts.push(`Avoid chase: ${topExtension.title} (${topExtension.count} names).`);
  }

  const posture = `${ux.replace("_", " ")} · ${decision.allocation} max book`;

  let watchNote: string | null = null;
  if (watchSymbols.length === 0) {
    if (opportunity.mode === "near_miss") {
      watchNote = null;
    } else if (opportunity.mode === "candidates") {
      watchNote = "Focus on surfaced Tier A/B names above; add manual watches from Setups if needed.";
    } else {
      watchNote =
        "No near-miss symbols surfaced in the latest scan; review /setups for full pipeline diagnostics.";
    }
  }

  return {
    watchSymbols: { value: watchSymbols.slice(0, 8), provenance: "derived" },
    watchNote: { value: watchNote, provenance: watchNote ? "static_copy" : "derived" },
    triggerLine: { value: triggerParts.join(" "), provenance: "derived" },
    avoidLine: { value: avoidParts.join(" ") || "Follow verdict caps.", provenance: "derived" },
    postureLine: { value: posture, provenance: "derived" },
  };
}

/**
 * Server-side view model for the proposed Decision Cockpit dashboard.
 * Pure function — callers pass data already loaded by RSC (no Prisma here).
 */
export function buildDecisionCockpitDto(input: DecisionCockpitInput): DecisionCockpitDto {
  const now = input.now ?? new Date();
  const gate1 = resolveCanonicalGate1({
    scanGate1: input.latestScan?.gate1Level ?? null,
    liveRegimeGate1: input.liveRegime.level,
  });

  const decision = resolveDecision(input.scanNotes, gate1.canonical, input.latestScan);
  const ux = mapDecisionLevelToUxVerdict(decision.level);
  const confidence = computeConfidenceBand({
    hasScan: input.latestScan != null,
    freshness: input.freshness,
    gate1: gate1.canonical,
    surfacedCount: input.latestScan?.candidateCountSurfaced ?? 0,
    now,
    scanRunAt: input.latestScan?.runAt ?? null,
  });

  const nearMiss = input.scanNotes?.closestToValidSymbols ?? [];
  const opportunity = buildOpportunityBoard(
    input.surfacedCandidates,
    nearMiss,
    input.latestScan
  );
  const setupQualityLadder = buildSetupQualityLadder(
    input.surfacedCandidates,
    nearMiss
  );
  const blockers = buildActionableBlockers(input.scanNotes, gate1.canonical);

  const verdict: VerdictDto = {
    uxLevel: { value: ux, provenance: "derived" },
    persistedLevel: {
      value: decision.level,
      provenance: input.scanNotes?.decision ? "real" : "derived",
    },
    headline: {
      value: ux.replace("_", " "),
      provenance: "derived",
    },
    explanation: {
      value: decision.explanation,
      provenance: input.scanNotes?.decision ? "real" : "derived",
    },
    allocation: { value: decision.allocation, provenance: "real" },
    perTradeGuidance: {
      value: perTradeGuidanceForLevel(decision.level),
      provenance: "static_copy",
    },
    confidenceBand: { value: confidence, provenance: "derived" },
    gate1Resolution: gate1,
  };

  const perTradeGuidance = perTradeGuidanceForLevel(decision.level);
  const riskBudgetHeadroom = buildRiskBudgetHeadroom({
    accountEquityVnd: input.accountEquityVnd,
    openExposureVnd: input.openExposureVnd,
    maxBookAllocation: decision.allocation,
    perTradeGuidance,
  });

  const risk: RiskGuardrailDto = {
    maxBookAllocation: { value: decision.allocation, provenance: "real" },
    perTradeGuidance: {
      value: perTradeGuidance,
      provenance: "static_copy",
    },
    openExposureVnd: { value: input.openExposureVnd, provenance: "derived" },
    stanceCopy: { value: stanceCopyForLevel(ux), provenance: "static_copy" },
    rules: [
      { text: "No-chase when extended or extension_cap dominates.", provenance: "static_copy" },
      {
        text: "Stop levels from scanner — not portfolio R-multiple enforcement on this panel.",
        provenance: "gap",
      },
      {
        text:
          riskBudgetHeadroom.status === "configured"
            ? "Book headroom compares open notional to parsed max-book cap (DC-5)."
            : "Risk budget headroom unavailable until equity env and parseable cap.",
        provenance: riskBudgetHeadroom.status === "configured" ? "derived" : "gap",
      },
    ],
  };

  const tomorrow = buildTomorrowPlan(ux, decision, opportunity, input.watchlist, blockers);

  return {
    verdict,
    evidence: buildEvidenceStack(gate1, input.latestScan, input.liveRegime, input.freshness),
    opportunity,
    ladder: buildLadderRows(opportunity, input.surfacedCandidates),
    setupQualityLadder,
    risk,
    riskBudgetHeadroom,
    tomorrow,
    actionableDiagnostics: {
      blockers,
      maxShown: 3,
      emptyReason:
        blockers.length === 0
          ? input.latestScan
            ? "No Gate 2 rejection buckets in latest scan notes."
            : "Run a daily scan to populate actionable blockers."
          : null,
    },
    blockers,
    scanRunId: input.latestScan?.id ?? null,
  };
}
