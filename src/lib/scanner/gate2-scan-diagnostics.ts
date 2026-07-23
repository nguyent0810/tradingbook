import { compareClosestRowsExecutionOrder } from "./closest-execution-metrics";
import type { BreakoutPullbackEvaluation } from "./gate2/types";
import {
  resolveTerminalClassification,
  type Gate2RejectionCode,
  type TerminalCategory,
} from "./gate2/rejection-codes";
import type { ScanSessionCoverage } from "./scan-session-coverage";
import type { DailyTradingDecision } from "./trading-decision";

export type { TerminalCategory } from "./gate2/rejection-codes";

/** Legacy message-based classification — delegates to stable code inference. */
export function categorizeTerminalReason(msg: string): {
  category: TerminalCategory;
  stageRank: number;
} {
  const resolved = resolveTerminalClassification({ terminalMessage: msg });
  return { category: resolved.category, stageRank: resolved.stageRank };
}

function classifyEvaluationTerminal(ev: BreakoutPullbackEvaluation): {
  category: TerminalCategory;
  stageRank: number;
  code: Gate2RejectionCode | null;
} {
  const resolved = resolveTerminalClassification({
    terminalCode: ev.terminalCode,
    terminalMessage: terminalGate2Reason(ev),
  });
  return resolved;
}

export function terminalGate2Reason(ev: BreakoutPullbackEvaluation): string {
  if (ev.reasons.length === 0) return "";
  return ev.reasons[ev.reasons.length - 1]!;
}

export function gate2PartialPipelineScore(ev: BreakoutPullbackEvaluation): number {
  if (ev.quality !== "INVALID") return ev.rankScore;
  const { stageRank } = classifyEvaluationTerminal(ev);
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
      summary: "Không có đánh giá INVALID nào — không áp dụng phân tích điểm nghẽn.",
      likelyBottleneck: "none_obvious",
      note: "Tất cả mã có thể giao dịch đều đạt Hạng A hoặc B theo quy tắc hiện hành.",
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
      "Từ chối trải đều trên nhiều bước kiểm tra — không có mã nào lọt qua có thể chỉ là do chế độ thị trường/mẫu hình không khớp, chứ không phải một ngưỡng bị lỗi.";
  } else {
    summary = `Nhóm INVALID lớn nhất là "${top.key}" (${top.n} mã, ${pct(top.n)} tổng số INVALID).`;
  }

  const note =
    "Không có ứng viên nào có thể là chuyện bình thường khi thị trường không có hình thái phù hợp với playbook này (breakout mới + digestion + tương tác vùng + đột biến thanh khoản tại nến đánh giá). Xem các dòng gần đạt nhất để biết các mã đi được sâu tới đâu trước khi bị loại.";

  return { summary, likelyBottleneck, note };
}

export type Gate2ClosestSymbolRow = {
  symbol: string;
  partialPipelineScore: number;
  stageRank: number;
  reasonLineCount: number;
  terminalCategory: TerminalCategory | "N/A";
  /** Stable code when evaluation carried `terminalCode` (Batch C). */
  terminalCode?: Gate2RejectionCode | null;
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
    terminalCode: Gate2RejectionCode | null;
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
    const classified =
      ev.quality === "INVALID"
        ? classifyEvaluationTerminal(ev)
        : { category: "N/A" as const, stageRank: ev.rankScore, code: null as Gate2RejectionCode | null };
    const { category, stageRank, code: terminalCode } = classified;

    rankRows.push({
      symbol,
      symbolId,
      quality: ev.quality,
      partialPipelineScore: gate2PartialPipelineScore(ev),
      stageRank: ev.quality === "INVALID" ? stageRank : 0,
      reasonLineCount: ev.reasons.length,
      terminalCategory: ev.quality === "INVALID" ? category : "N/A",
      terminalCode: ev.quality === "INVALID" ? terminalCode : null,
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
      terminalCode: r.terminalCode,
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
  /** Per-scan equity bar alignment vs expected VNINDEX session (tradability stale counts). */
  sessionCoverage?: ScanSessionCoverage;
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
