import { compareClosestRowsExecutionOrder } from "./closest-execution-metrics";
import type { BreakoutPullbackEvaluation } from "./gate2/types";
import type { DailyTradingDecision } from "./trading-decision";

export type TerminalCategory =
  | "insufficient_bars"
  | "stale_or_session_mismatch"
  | "ma_compute"
  | "trend_below_ma50"
  | "trend_ma20_below_ma50"
  | "breakout_recency"
  | "digestion"
  | "breakout_not_holding"
  | "mid_pullback_below_ma50"
  | "swept_breakout_weak_close"
  | "pullback_zone_two_closes"
  | "pullback_zone_interaction"
  | "pullback_zone_malformed"
  | "volume_median_bad"
  | "volume_ratio"
  | "extension_cap"
  | "depth_cap"
  | "stop_structure"
  | "unknown";

const CATEGORY_STAGE_RANK: Record<TerminalCategory, number> = {
  insufficient_bars: 5,
  stale_or_session_mismatch: 8,
  ma_compute: 10,
  trend_below_ma50: 15,
  trend_ma20_below_ma50: 18,
  breakout_recency: 25,
  digestion: 32,
  breakout_not_holding: 38,
  mid_pullback_below_ma50: 42,
  swept_breakout_weak_close: 46,
  pullback_zone_two_closes: 52,
  pullback_zone_interaction: 58,
  pullback_zone_malformed: 59,
  volume_median_bad: 62,
  volume_ratio: 72,
  extension_cap: 80,
  depth_cap: 84,
  stop_structure: 88,
  unknown: 0,
};

export function categorizeTerminalReason(msg: string): {
  category: TerminalCategory;
  stageRank: number;
} {
  const r = msg;
  if (r.includes("Need at least 50 daily bars")) {
    return { category: "insufficient_bars", stageRank: CATEGORY_STAGE_RANK.insufficient_bars };
  }
  if (r.includes("does not match expected session")) {
    return {
      category: "stale_or_session_mismatch",
      stageRank: CATEGORY_STAGE_RANK.stale_or_session_mismatch,
    };
  }
  if (r.includes("Could not compute MA20/MA50")) {
    return { category: "ma_compute", stageRank: CATEGORY_STAGE_RANK.ma_compute };
  }
  if (r.includes("Trend not supportive for long swings")) {
    return { category: "trend_below_ma50", stageRank: CATEGORY_STAGE_RANK.trend_below_ma50 };
  }
  if (r.includes("Intermediate trend weaker than slow trend")) {
    return {
      category: "trend_ma20_below_ma50",
      stageRank: CATEGORY_STAGE_RANK.trend_ma20_below_ma50,
    };
  }
  if (r.includes("No qualifying breakout in the last")) {
    return { category: "breakout_recency", stageRank: CATEGORY_STAGE_RANK.breakout_recency };
  }
  if (r.includes("Need a digestion dip after the impulse")) {
    return { category: "digestion", stageRank: CATEGORY_STAGE_RANK.digestion };
  }
  if (r.includes("Setup failed—session closed back under resistance")) {
    return {
      category: "breakout_not_holding",
      stageRank: CATEGORY_STAGE_RANK.breakout_not_holding,
    };
  }
  if (r.includes("Mid-pullback close dipped under the 50-day line")) {
    return {
      category: "mid_pullback_below_ma50",
      stageRank: CATEGORY_STAGE_RANK.mid_pullback_below_ma50,
    };
  }
  if (r.includes("Lower lows vs the breakout session")) {
    return {
      category: "swept_breakout_weak_close",
      stageRank: CATEGORY_STAGE_RANK.swept_breakout_weak_close,
    };
  }
  if (r.includes("Two closes in a row under the pullback zone floor")) {
    return {
      category: "pullback_zone_two_closes",
      stageRank: CATEGORY_STAGE_RANK.pullback_zone_two_closes,
    };
  }
  if (r.includes("Current bar does not interact with the pullback box")) {
    return {
      category: "pullback_zone_interaction",
      stageRank: CATEGORY_STAGE_RANK.pullback_zone_interaction,
    };
  }
  if (r.includes("Pullback zone is malformed")) {
    return {
      category: "pullback_zone_malformed",
      stageRank: CATEGORY_STAGE_RANK.pullback_zone_malformed,
    };
  }
  if (r.includes("Cannot score participation") || r.includes("median volume over the prior 20")) {
    return { category: "volume_median_bad", stageRank: CATEGORY_STAGE_RANK.volume_median_bad };
  }
  if (r.includes("Participation too thin")) {
    return { category: "volume_ratio", stageRank: CATEGORY_STAGE_RANK.volume_ratio };
  }
  if (r.includes("above the breakout level") && r.includes("swing cap")) {
    return { category: "extension_cap", stageRank: CATEGORY_STAGE_RANK.extension_cap };
  }
  if (r.includes("max depth under the breakout")) {
    return { category: "depth_cap", stageRank: CATEGORY_STAGE_RANK.depth_cap };
  }
  if (
    r.includes("Stop would be at or above entry") ||
    r.includes("Entry→stop distance") ||
    r.includes("Incomplete setup") ||
    r.includes("no actionable downside anchor")
  ) {
    return { category: "stop_structure", stageRank: CATEGORY_STAGE_RANK.stop_structure };
  }
  return { category: "unknown", stageRank: CATEGORY_STAGE_RANK.unknown };
}

export function terminalGate2Reason(ev: BreakoutPullbackEvaluation): string {
  if (ev.reasons.length === 0) return "";
  return ev.reasons[ev.reasons.length - 1]!;
}

export function gate2PartialPipelineScore(ev: BreakoutPullbackEvaluation): number {
  if (ev.quality !== "INVALID") return ev.rankScore;
  const { stageRank } = categorizeTerminalReason(terminalGate2Reason(ev));
  return stageRank * 100 + ev.reasons.length;
}

export type Gate2Recommendation = {
  summary: string;
  likelyBottleneck:
    | "none_obvious"
    | "breakout_recency"
    | "pullback_zone"
    | "volume"
    | "extension_cap"
    | "depth_cap"
    | "stop_validation"
    | "trend_ma"
    | "digestion_structure";
  note: string;
};

export function buildGate2Recommendation(
  byCategory: Record<string, number>,
  totalInvalid: number
): Gate2Recommendation {
  if (totalInvalid === 0) {
    return {
      summary: "No INVALID evaluations — bottleneck analysis not applicable.",
      likelyBottleneck: "none_obvious",
      note: "All tradable symbols produced Tier A or B under current rules.",
    };
  }

  const pct = (n: number) => `${((100 * n) / totalInvalid).toFixed(1)}%`;

  const trend =
    (byCategory.trend_below_ma50 ?? 0) + (byCategory.trend_ma20_below_ma50 ?? 0);
  const recency = byCategory.breakout_recency ?? 0;
  const digestion =
    (byCategory.digestion ?? 0) +
    (byCategory.breakout_not_holding ?? 0) +
    (byCategory.mid_pullback_below_ma50 ?? 0) +
    (byCategory.swept_breakout_weak_close ?? 0);
  const zone =
    (byCategory.pullback_zone_two_closes ?? 0) +
    (byCategory.pullback_zone_interaction ?? 0) +
    (byCategory.pullback_zone_malformed ?? 0);
  const volume =
    (byCategory.volume_median_bad ?? 0) + (byCategory.volume_ratio ?? 0);
  const ext = byCategory.extension_cap ?? 0;
  const depth = byCategory.depth_cap ?? 0;
  const stop = byCategory.stop_structure ?? 0;

  const ranked = [
    { key: "trend_ma" as const, n: trend },
    { key: "breakout_recency" as const, n: recency },
    { key: "digestion_structure" as const, n: digestion },
    { key: "pullback_zone" as const, n: zone },
    { key: "volume" as const, n: volume },
    { key: "extension_cap" as const, n: ext },
    { key: "depth_cap" as const, n: depth },
    { key: "stop_validation" as const, n: stop },
  ].sort((a, b) => b.n - a.n);

  const top = ranked[0]!;
  const second = ranked[1]!;

  type Bottleneck = Gate2Recommendation["likelyBottleneck"];

  let likelyBottleneck: Bottleneck = top.key;
  if (top.n === 0) likelyBottleneck = "none_obvious";

  const dominant =
    top.n >= Math.max(3, Math.ceil(totalInvalid * 0.35)) && top.n >= second.n * 1.25;

  let summary: string;
  if (!dominant || top.n === 0) {
    summary =
      "Rejections are spread across several checks — zero surfacing can be a normal regime/template mismatch rather than one broken threshold.";
  } else {
    summary = `Largest INVALID bucket is "${top.key}" (${top.n} symbols, ${pct(top.n)} of INVALID).`;
  }

  const note =
    "Zero candidates can be normal when the market is not shaped like this playbook (fresh breakout + digestion + zone interaction + liquidity spike on the evaluation bar). Use closest-to-valid rows to see how deep names get before failing.";

  return { summary, likelyBottleneck, note };
}

export type Gate2ClosestSymbolRow = {
  symbol: string;
  partialPipelineScore: number;
  stageRank: number;
  reasonLineCount: number;
  terminalCategory: TerminalCategory | "N/A";
  terminalReasonPreview: string;
  /** Gate 2 rank score at evaluation (sorting / display). */
  rankScore: number;
  close: number;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
};

/** Max symbols persisted per INVALID bucket in scan notes (UI expands from here offline). */
export const REJECTION_SYMBOLS_PER_BUCKET_CAP = 25;

export type Gate2ScanDiagnosticsSummary = {
  gate2QualityCounts: { A: number; B: number; INVALID: number };
  invalidCountByCategory: Record<string, number>;
  topRejectionCategories: Record<string, number>;
  /** Top symbols per terminal bucket (by pipeline depth), capped — persisted on `DailyScanRun.notes`. */
  rejectionSymbolsByCategory: Record<string, string[]>;
  topRejectionTerminalReasons: Record<string, number>;
  closestToValidSymbols: Gate2ClosestSymbolRow[];
  recommendation: Gate2Recommendation;
};

export type Gate2DiagnosticEvaluationRow = {
  symbol: string;
  symbolId: string;
  evaluation: BreakoutPullbackEvaluation;
};

/**
 * Aggregates Gate 2 INVALID reasons across symbols (same buckets as gate2-audit.ts).
 */
export function buildGate2ScanDiagnosticsSummary(
  rows: readonly Gate2DiagnosticEvaluationRow[]
): Gate2ScanDiagnosticsSummary {
  let countA = 0;
  let countB = 0;
  let countInvalid = 0;
  const invalidByCategory: Record<string, number> = {};
  const invalidByRawTerminal: Record<string, number> = {};
  const invalidSymbolScoresByCategory = new Map<string, { symbol: string; score: number }[]>();

  type RankRow = {
    symbol: string;
    symbolId: string;
    quality: string;
    partialPipelineScore: number;
    stageRank: number;
    reasonLineCount: number;
    terminalCategory: TerminalCategory | "N/A";
    terminalReasonPreview: string;
    rankScore: number;
    close: number;
    breakoutLevel: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
  };

  const rankRows: RankRow[] = [];

  for (const { symbol, symbolId, evaluation: ev } of rows) {
    if (ev.quality === "A") countA++;
    else if (ev.quality === "B") countB++;
    else countInvalid++;

    const term = terminalGate2Reason(ev);
    const { category, stageRank } =
      ev.quality === "INVALID"
        ? categorizeTerminalReason(term)
        : { category: "N/A" as const, stageRank: ev.rankScore };

    rankRows.push({
      symbol,
      symbolId,
      quality: ev.quality,
      partialPipelineScore: gate2PartialPipelineScore(ev),
      stageRank: ev.quality === "INVALID" ? stageRank : CATEGORY_STAGE_RANK.unknown,
      reasonLineCount: ev.reasons.length,
      terminalCategory: ev.quality === "INVALID" ? category : "N/A",
      terminalReasonPreview: term.slice(0, 220),
      rankScore: ev.rankScore,
      close: ev.close,
      breakoutLevel: ev.breakoutLevel,
      pullbackZoneLow: ev.pullbackZoneLow,
      pullbackZoneHigh: ev.pullbackZoneHigh,
      stopLevel: ev.stopLevel,
    });

    if (ev.quality === "INVALID") {
      invalidByCategory[category] = (invalidByCategory[category] ?? 0) + 1;
      const rawKey = term.slice(0, 160);
      invalidByRawTerminal[rawKey] = (invalidByRawTerminal[rawKey] ?? 0) + 1;

      const score = gate2PartialPipelineScore(ev);
      const bucketList = invalidSymbolScoresByCategory.get(category) ?? [];
      bucketList.push({ symbol, score });
      invalidSymbolScoresByCategory.set(category, bucketList);
    }
  }

  const invalidRankRows = rankRows.filter((r) => r.quality === "INVALID");
  const closestToValid = [...invalidRankRows]
    .sort(compareClosestRowsExecutionOrder)
    .slice(0, 5);

  const topCategories = Object.entries(invalidByCategory)
    .sort(([, ca], [, cb]) => cb - ca)
    .slice(0, 15);

  const topRawTerminals = Object.entries(invalidByRawTerminal)
    .sort(([, ca], [, cb]) => cb - ca)
    .slice(0, 15);

  const recommendation = buildGate2Recommendation(invalidByCategory, countInvalid);

  const rejectionSymbolsByCategory: Record<string, string[]> = {};
  for (const [cat, scored] of invalidSymbolScoresByCategory.entries()) {
    const sorted = [...scored].sort(
      (a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol)
    );
    const seen = new Set<string>();
    const symbols: string[] = [];
    for (const { symbol } of sorted) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      symbols.push(symbol);
      if (symbols.length >= REJECTION_SYMBOLS_PER_BUCKET_CAP) break;
    }
    rejectionSymbolsByCategory[cat] = symbols;
  }

  return {
    gate2QualityCounts: { A: countA, B: countB, INVALID: countInvalid },
    invalidCountByCategory: invalidByCategory,
    topRejectionCategories: Object.fromEntries(topCategories),
    rejectionSymbolsByCategory,
    topRejectionTerminalReasons: Object.fromEntries(topRawTerminals),
    closestToValidSymbols: closestToValid.map((r) => ({
      symbol: r.symbol,
      partialPipelineScore: r.partialPipelineScore,
      stageRank: r.stageRank,
      reasonLineCount: r.reasonLineCount,
      terminalCategory: r.terminalCategory,
      terminalReasonPreview: r.terminalReasonPreview,
      rankScore: r.rankScore,
      close: r.close,
      breakoutLevel: r.breakoutLevel,
      pullbackZoneLow: r.pullbackZoneLow,
      pullbackZoneHigh: r.pullbackZoneHigh,
      stopLevel: r.stopLevel,
    })),
    recommendation,
  };
}

/** Persisted on scan notes when equity DB max date is after VNINDEX session (backdrop delay). */
export type ScanBenchmarkBackdrop = {
  vnindexSessionDate: string;
  equityBarsMaxDate: string | null;
  delayedBackdrop: boolean;
};

/** Subset persisted on DailyScanRun.notes for dashboards / review. */
export type DailyScanGate2Notes = {
  topRejectionCategories: Record<string, number>;
  /** Sample symbols per rejection bucket from scan time (capped per bucket). */
  rejectionSymbolsByCategory?: Record<string, string[]>;
  closestToValidSymbols: Gate2ClosestSymbolRow[];
  recommendation: Pick<Gate2Recommendation, "likelyBottleneck" | "summary" | "note">;
  decision?: DailyTradingDecision;
  /** Gate 1 uses VNINDEX through `vnindexSessionDate`; equity may be newer in DB. */
  benchmarkBackdrop?: ScanBenchmarkBackdrop;
};

export function toDailyScanGate2Notes(d: Gate2ScanDiagnosticsSummary): DailyScanGate2Notes {
  return {
    topRejectionCategories: d.topRejectionCategories,
    rejectionSymbolsByCategory: d.rejectionSymbolsByCategory,
    closestToValidSymbols: d.closestToValidSymbols,
    recommendation: {
      likelyBottleneck: d.recommendation.likelyBottleneck,
      summary: d.recommendation.summary,
      note: d.recommendation.note,
    },
  };
}
