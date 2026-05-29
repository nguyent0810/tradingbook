import type { DailyScanGate2Notes, Gate2ClosestSymbolRow } from "./gate2-scan-diagnostics";
import { isGate2RejectionCode } from "./gate2/rejection-codes";
import type { ScanSessionCoverage } from "./scan-session-coverage";
import { parsePersistedDailyDecision } from "./trading-decision";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseScanSessionCoverage(raw: unknown): ScanSessionCoverage | undefined {
  if (!isRecord(raw)) return undefined;
  const expectedSessionDate = raw.expectedSessionDate;
  const universeScanned = raw.universeScanned;
  const tradabilityEvaluated = raw.tradabilityEvaluated;
  const tradabilityPassed = raw.tradabilityPassed;
  const staleSessionCount = raw.staleSessionCount;
  const staleSessionFrac = raw.staleSessionFrac;
  const sessionAlignedCount = raw.sessionAlignedCount;
  const sessionAlignedFrac = raw.sessionAlignedFrac;
  const weakCoverage = raw.weakCoverage;
  const headline = raw.headline;
  const operatorWarning = raw.operatorWarning;

  const nums = [
    universeScanned,
    tradabilityEvaluated,
    tradabilityPassed,
    staleSessionCount,
    staleSessionFrac,
    sessionAlignedCount,
    sessionAlignedFrac,
  ];
  if (
    typeof expectedSessionDate !== "string" ||
    !nums.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    typeof weakCoverage !== "boolean" ||
    typeof headline !== "string"
  ) {
    return undefined;
  }

  return {
    expectedSessionDate,
    universeScanned: universeScanned as number,
    tradabilityEvaluated: tradabilityEvaluated as number,
    tradabilityPassed: tradabilityPassed as number,
    staleSessionCount: staleSessionCount as number,
    staleSessionFrac: staleSessionFrac as number,
    sessionAlignedCount: sessionAlignedCount as number,
    sessionAlignedFrac: sessionAlignedFrac as number,
    weakCoverage,
    headline,
    operatorWarning:
      operatorWarning === null
        ? null
        : typeof operatorWarning === "string"
          ? operatorWarning
          : null,
  };
}

/** Safe parse for `DailyScanRun.notes` JSON persisted by run-daily-scanner. */
export function parseDailyScanGate2Notes(raw: unknown): DailyScanGate2Notes | null {
  if (!isRecord(raw)) return null;

  const topRaw = raw.topRejectionCategories;
  const closestRaw = raw.closestToValidSymbols;
  const recRaw = raw.recommendation;

  const topRejectionCategories: Record<string, number> = {};
  if (isRecord(topRaw)) {
    for (const [k, v] of Object.entries(topRaw)) {
      if (typeof v === "number" && Number.isFinite(v)) topRejectionCategories[k] = v;
    }
  }

  const closestToValidSymbols: Gate2ClosestSymbolRow[] = [];
  if (Array.isArray(closestRaw)) {
    for (const item of closestRaw) {
      if (!isRecord(item)) continue;
      const symbol = item.symbol;
      if (typeof symbol !== "string") continue;
      const partialPipelineScore =
        typeof item.partialPipelineScore === "number" ? item.partialPipelineScore : 0;
      const stageRank = typeof item.stageRank === "number" ? item.stageRank : 0;
      const reasonLineCount =
        typeof item.reasonLineCount === "number" ? item.reasonLineCount : 0;
      const terminalCategory =
        typeof item.terminalCategory === "string" ? item.terminalCategory : "unknown";
      const terminalCodeRaw = item.terminalCode;
      const terminalCode =
        typeof terminalCodeRaw === "string" && isGate2RejectionCode(terminalCodeRaw)
          ? terminalCodeRaw
          : null;
      const terminalReasonPreview =
        typeof item.terminalReasonPreview === "string" ? item.terminalReasonPreview : "";
      const rankScore = typeof item.rankScore === "number" && Number.isFinite(item.rankScore) ? item.rankScore : 0;
      const close = typeof item.close === "number" && Number.isFinite(item.close) ? item.close : 0;
      const breakoutLevel =
        typeof item.breakoutLevel === "number" && Number.isFinite(item.breakoutLevel)
          ? item.breakoutLevel
          : 0;
      const pullbackZoneLow =
        typeof item.pullbackZoneLow === "number" && Number.isFinite(item.pullbackZoneLow)
          ? item.pullbackZoneLow
          : 0;
      const pullbackZoneHigh =
        typeof item.pullbackZoneHigh === "number" && Number.isFinite(item.pullbackZoneHigh)
          ? item.pullbackZoneHigh
          : 0;
      const stopLevel =
        typeof item.stopLevel === "number" && Number.isFinite(item.stopLevel) ? item.stopLevel : 0;
      closestToValidSymbols.push({
        symbol,
        partialPipelineScore,
        stageRank,
        reasonLineCount,
        terminalCategory: terminalCategory as Gate2ClosestSymbolRow["terminalCategory"],
        ...(terminalCode ? { terminalCode } : {}),
        terminalReasonPreview,
        rankScore,
        close,
        breakoutLevel,
        pullbackZoneLow,
        pullbackZoneHigh,
        stopLevel,
      });
    }
  }

  let recommendation: DailyScanGate2Notes["recommendation"] = {
    likelyBottleneck: "none_obvious",
    summary: "",
    note: "",
  };
  if (isRecord(recRaw)) {
    const lb = recRaw.likelyBottleneck;
    const sum = recRaw.summary;
    const note = recRaw.note;
    recommendation = {
      likelyBottleneck:
        typeof lb === "string"
          ? (lb as DailyScanGate2Notes["recommendation"]["likelyBottleneck"])
          : "none_obvious",
      summary: typeof sum === "string" ? sum : "",
      note: typeof note === "string" ? note : "",
    };
  }

  const parsedDecision = parsePersistedDailyDecision(raw.decision);

  let benchmarkBackdrop: DailyScanGate2Notes["benchmarkBackdrop"];
  const bdRaw = raw.benchmarkBackdrop;
  if (isRecord(bdRaw)) {
    const vn = bdRaw.vnindexSessionDate;
    const eq = bdRaw.equityBarsMaxDate;
    const delayed = bdRaw.delayedBackdrop;
    if (typeof vn === "string" && typeof delayed === "boolean") {
      benchmarkBackdrop = {
        vnindexSessionDate: vn,
        equityBarsMaxDate: typeof eq === "string" ? eq : null,
        delayedBackdrop: delayed,
      };
    }
  }

  const symRaw = raw.rejectionSymbolsByCategory;
  let rejectionSymbolsByCategory: Record<string, string[]> | undefined;
  if (isRecord(symRaw)) {
    const acc: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(symRaw)) {
      if (!Array.isArray(v)) continue;
      const syms = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (syms.length > 0) acc[k] = syms;
    }
    if (Object.keys(acc).length > 0) rejectionSymbolsByCategory = acc;
  }

  const sessionCoverage = parseScanSessionCoverage(raw.sessionCoverage);

  const hasSignal =
    Object.keys(topRejectionCategories).length > 0 ||
    closestToValidSymbols.length > 0 ||
    Boolean(recommendation.summary || recommendation.note) ||
    recommendation.likelyBottleneck !== "none_obvious" ||
    parsedDecision !== null ||
    benchmarkBackdrop?.delayedBackdrop === true ||
    sessionCoverage?.weakCoverage === true ||
    (rejectionSymbolsByCategory !== undefined &&
      Object.keys(rejectionSymbolsByCategory).length > 0);

  if (!hasSignal) return null;

  return {
    topRejectionCategories,
    closestToValidSymbols,
    recommendation,
    ...(rejectionSymbolsByCategory ? { rejectionSymbolsByCategory } : {}),
    ...(parsedDecision ? { decision: parsedDecision } : {}),
    ...(benchmarkBackdrop ? { benchmarkBackdrop } : {}),
    ...(sessionCoverage ? { sessionCoverage } : {}),
  };
}

/** Short label for dashboard / empty states (matches persisted `likelyBottleneck`). */
export function bottleneckShortLabel(key: string): string {
  switch (key) {
    case "trend_ma":
      return "weak trend structure";
    case "breakout_recency":
      return "breakout timing / recency";
    case "pullback_zone":
      return "pullback zone alignment";
    case "volume":
      return "participation vs median volume";
    case "extension_cap":
      return "extension vs breakout level";
    case "depth_cap":
      return "pullback depth";
    case "stop_validation":
      return "entry vs stop structure";
    case "digestion_structure":
      return "digestion / structure after breakout";
    case "none_obvious":
    default:
      return "mixed factors";
  }
}

/** User-facing line under symbol for closest-to-valid list. */
export function closestSymbolWaitLine(row: Gate2ClosestSymbolRow): string {
  const c = row.terminalCategory;
  switch (c) {
    case "pullback_zone_interaction":
      return "waiting for pullback zone interaction";
    case "pullback_zone_two_closes":
      return "waiting for reclaim above pullback zone floor";
    case "pullback_zone_malformed":
      return "pullback zone structure unclear";
    case "volume_ratio":
      return "needs stronger participation vs median volume";
    case "volume_median_bad":
      return "volume baseline unusable for scoring";
    case "extension_cap":
      return "extended too far above breakout level";
    case "depth_cap":
      return "pullback too deep vs playbook";
    case "stop_structure":
      return "entry/stop structure not actionable";
    case "breakout_recency":
      return "needs fresher breakout vs range";
    case "digestion":
      return "needs digestion after impulse";
    case "breakout_not_holding":
      return "price closed back under breakout resistance";
    case "trend_below_ma50":
      return "close below 50-day trend filter";
    case "trend_ma20_below_ma50":
      return "intermediate trend weaker than slow trend";
    case "mid_pullback_below_ma50":
      return "mid-pullback violated 50-day line";
    default:
      return "does not yet match Gate 2 template";
  }
}
