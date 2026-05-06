/**
 * Gate 2 sensitivity audit for **tradable** active symbols only — diagnostic output only.
 * Does not change scanner rules or persist candidates.
 *
 * Usage:
 *   npx tsx scripts/audit-gate2-sensitivity.ts
 *   npx tsx scripts/audit-gate2-sensitivity.ts --near-miss-limit=30
 */
import "./load-env";
import { sma } from "../src/lib/playbook/indicators";
import { getMarketRegimeFromDb } from "../src/lib/playbook/get-market-regime";
import { prisma } from "../src/lib/prisma";
import {
  buildGate2ScanDiagnosticsSummary,
  categorizeTerminalReason,
  terminalGate2Reason,
  type Gate2DiagnosticEvaluationRow,
  type TerminalCategory,
} from "../src/lib/scanner/gate2-scan-diagnostics";
import {
  evaluateBreakoutPullbackCandidate,
  sortDedupeGate2Bars,
} from "../src/lib/scanner/gate2/breakout-pullback";
import type {
  BreakoutPullbackEvaluation,
  Gate1Level,
} from "../src/lib/scanner/gate2/types";
import {
  computeDistanceToPullbackZoneFrac,
  computeRiskToStopFrac,
} from "../src/lib/scanner/closest-execution-metrics";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import { describeDatabaseUrl } from "./load-env";

const SETUP_TYPE_LABEL = "breakout_pullback_daily";

function parseNearMissLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--near-miss-limit="));
  if (!raw) return 25;
  const n = Number.parseInt(raw.slice("--near-miss-limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 25;
}

/** Roll up terminal categories into audit-facing buckets (diagnostic labels only). */
function auditBucketForTerminal(cat: TerminalCategory): string {
  switch (cat) {
    case "trend_below_ma50":
      return "trend_below_ma50";
    case "trend_ma20_below_ma50":
      return "weak_ma20_ma50";
    case "breakout_recency":
      return "no_pullback_breakout_recency";
    case "digestion":
      return "no_pullback_digestion";
    case "breakout_not_holding":
    case "mid_pullback_below_ma50":
    case "swept_breakout_weak_close":
    case "pullback_zone_two_closes":
    case "pullback_zone_interaction":
    case "pullback_zone_malformed":
      return "pullback_structure_zone";
    case "volume_median_bad":
    case "volume_ratio":
      return "volatility_participation_volume";
    case "extension_cap":
    case "depth_cap":
      return "volatility_range_extension_depth";
    case "stop_structure":
      return "poor_risk_reward_stop_structure";
    case "insufficient_bars":
    case "stale_or_session_mismatch":
    case "ma_compute":
      return "data_or_ma_prereq";
    default:
      return "other_or_unknown";
  }
}

/** Gate 2 INVALID paths often clear pullback zone fields; recover bounds from reason text when present. */
function tryExtractPullbackZoneFromReason(reason: string): {
  low: number;
  high: number;
} | null {
  const m = reason.match(/\(([0-9]+\.?[0-9]*)\s*[–—\-]\s*([0-9]+\.?[0-9]*)\)/);
  if (!m) return null;
  const a = Number.parseFloat(m[1]!);
  const b = Number.parseFloat(m[2]!);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function maAtLastBar(bars: Parameters<typeof sortDedupeGate2Bars>[0]): {
  ma20: number | null;
  ma50: number | null;
} {
  const sorted = sortDedupeGate2Bars(bars);
  if (sorted.length < 50) return { ma20: null, ma50: null };
  const closes = sorted.map((b) => b.close);
  const ma20s = sma(closes, 20);
  const ma50s = sma(closes, 50);
  const L = sorted.length - 1;
  const m20 = ma20s[L];
  const m50 = ma50s[L];
  return {
    ma20:
      m20 !== undefined && Number.isFinite(m20) && !Number.isNaN(m20) ? m20 : null,
    ma50:
      m50 !== undefined && Number.isFinite(m50) && !Number.isNaN(m50) ? m50 : null,
  };
}

type BarRow = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function enrichNearMiss(params: {
  symbol: string;
  ev: BreakoutPullbackEvaluation;
  bars: readonly BarRow[];
}): Record<string, unknown> {
  const { symbol, ev } = params;
  const rows = params.bars;
  const term = terminalGate2Reason(ev);
  const { category: terminalCategory, stageRank } = categorizeTerminalReason(term);
  const auditBucket = auditBucketForTerminal(terminalCategory);
  const { ma20, ma50 } = maAtLastBar(rows);

  const zoneFromEv =
    ev.pullbackZoneLow > 0 && ev.pullbackZoneHigh > 0
      ? { low: ev.pullbackZoneLow, high: ev.pullbackZoneHigh }
      : tryExtractPullbackZoneFromReason(term);

  const riskToStopFrac =
    ev.stopLevel > 0 ? computeRiskToStopFrac(ev.close, ev.stopLevel) : null;
  const distToZoneFrac =
    zoneFromEv != null
      ? computeDistanceToPullbackZoneFrac(
          ev.close,
          zoneFromEv.low,
          zoneFromEv.high
        )
      : null;

  const maRelationship =
    ma20 != null && ma50 != null
      ? ma20 >= ma50
        ? "ma20_gte_ma50"
        : "ma20_lt_ma50"
      : "unknown";

  return {
    symbol,
    setupType: SETUP_TYPE_LABEL,
    gate2Quality: ev.quality,
    terminalCategory,
    auditBucket,
    stageRank,
    failedReasons: ev.reasons,
    terminalReason: term,
    close: ev.close,
    ma20,
    ma50,
    maRelationship,
    breakoutLevel: ev.breakoutLevel,
    pullbackZoneLow: zoneFromEv?.low ?? ev.pullbackZoneLow,
    pullbackZoneHigh: zoneFromEv?.high ?? ev.pullbackZoneHigh,
    stopLevel: ev.stopLevel,
    riskToStopFrac:
      riskToStopFrac != null && Number.isFinite(riskToStopFrac)
        ? Number(riskToStopFrac.toFixed(6))
        : null,
    distanceToPullbackZoneFrac:
      distToZoneFrac != null && Number.isFinite(distToZoneFrac)
        ? Number(distToZoneFrac.toFixed(6))
        : null,
    rankScore: ev.rankScore,
    reasonLineCount: ev.reasons.length,
  };
}

async function main(): Promise<void> {
  const nearMissLimit = parseNearMissLimit(process.argv.slice(2));

  console.error("audit-gate2-sensitivity.ts → DATABASE_URL:", describeDatabaseUrl());

  const expectedLatestSession = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!expectedLatestSession) {
    console.log(JSON.stringify({ error: "No VNINDEX session date." }, null, 2));
    process.exit(1);
  }

  const regime = await getMarketRegimeFromDb();
  const gate1Level = regime.level as Gate1Level;

  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const tradable: { id: string; symbol: string }[] = [];
  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(prisma, s.id, expectedLatestSession);
    if (tr.passed) tradable.push({ id: s.id, symbol: s.symbol });
  }

  const diagnosticRows: Gate2DiagnosticEvaluationRow[] = [];
  const barsBySymbol = new Map<
    string,
    Array<{
      date: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  >();

  for (const t of tradable) {
    const rows = await prisma.stockDailyBar.findMany({
      where: { symbolId: t.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });
    barsBySymbol.set(t.symbol, rows);
    const ev = evaluateBreakoutPullbackCandidate(rows, expectedLatestSession);
    diagnosticRows.push({
      symbol: t.symbol,
      symbolId: t.id,
      evaluation: ev,
    });
  }

  const summary = buildGate2ScanDiagnosticsSummary(diagnosticRows);

  const auditBucketCounts: Record<string, number> = {};
  for (const row of diagnosticRows) {
    const ev = row.evaluation;
    if (ev.quality !== "INVALID") continue;
    const term = terminalGate2Reason(ev);
    const { category } = categorizeTerminalReason(term);
    const b = auditBucketForTerminal(category);
    auditBucketCounts[b] = (auditBucketCounts[b] ?? 0) + 1;
  }

  let countA = 0;
  let countB = 0;
  let countInvalid = 0;
  const tierBNear: Record<string, unknown>[] = [];
  const tierANear: Record<string, unknown>[] = [];

  for (const row of diagnosticRows) {
    const ev = row.evaluation;
    const bars = barsBySymbol.get(row.symbol) ?? [];
    if (ev.quality === "A") {
      countA++;
      tierANear.push(enrichNearMiss({ symbol: row.symbol, ev, bars }));
    } else if (ev.quality === "B") {
      countB++;
      tierBNear.push(enrichNearMiss({ symbol: row.symbol, ev, bars }));
    } else {
      countInvalid++;
    }
  }

  const invalidRows = diagnosticRows.filter((r) => r.evaluation.quality === "INVALID");
  const invalidWithRank = invalidRows.map((r) => {
    const term = terminalGate2Reason(r.evaluation);
    const { category, stageRank } = categorizeTerminalReason(term);
    return { row: r, stageRank, category, term };
  });

  const singleCheckpointFails = invalidWithRank
    .filter((x) => x.row.evaluation.reasons.length === 1)
    .sort((a, b) => b.stageRank - a.stageRank || a.row.symbol.localeCompare(b.row.symbol));

  const deepestInvalid = [...invalidWithRank].sort(
    (a, b) => b.stageRank - a.stageRank || a.row.symbol.localeCompare(b.row.symbol)
  );

  const nearMissLimitFn = (arr: typeof deepestInvalid) =>
    arr.slice(0, nearMissLimit).map((x) =>
      enrichNearMiss({
        symbol: x.row.symbol,
        ev: x.row.evaluation,
        bars: barsBySymbol.get(x.row.symbol) ?? [],
      })
    );

  const surfacedUnderGate1 =
    gate1Level === "FAIL"
      ? 0
      : gate1Level === "WARNING"
        ? countA
        : countA + countB;

  const out = {
    generatedAt: new Date().toISOString(),
    expectedLatestSession: expectedLatestSession.toISOString(),
    gate1Level,
    tradabilityPassedCount: tradable.length,
    gate2QualityAmongTradable: {
      tierA: countA,
      tierB: countB,
      invalid: countInvalid,
      /** Candidates that would surface given Gate 1-only filtering (same as scanner surfacing rules). */
      surfacedCandidateCountUnderCurrentGate1: surfacedUnderGate1,
    },
    rejectionBucketsTerminal: summary.invalidCountByCategory,
    rejectionBucketsAuditAggregate: auditBucketCounts,
    diagnosticsRecommendation: summary.recommendation,
    nearMiss: {
      tierBQuietBlockedByGate1Warning: tierBNear,
      tierAFlat: tierANear,
      invalidSingleReasonLineOnly: nearMissLimitFn(singleCheckpointFails),
      invalidClosestToPassingByPipelineDepth: nearMissLimitFn(deepestInvalid),
    },
    notes: {
      setupType: SETUP_TYPE_LABEL,
      bucketDefinitions:
        "Audit aggregates map Gate 2 terminal categories into coarse buckets: weak_ma20_ma50=trend_ma20_below_ma50; no_pullback_* = breakout_recency vs digestion; pullback_structure_zone = breakout hold / zone / mid-pullback failures; volatility_* = volume/extension/depth caps; poor_risk_reward_stop_structure = stop/R validation.",
      gate1WarningNote:
        "When gate1Level is WARNING, Tier B evaluations exist but are not persisted as SetupCandidates — check tierBQuietBlockedByGate1Warning.",
    },
  };

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
