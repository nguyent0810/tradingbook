import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildGate2ScanDiagnosticsSummary,
  type Gate2DiagnosticEvaluationRow,
  type Gate2ScanDiagnosticsSummary,
} from "../gate2-scan-diagnostics";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";
import { tradabilityLookbackFromDate } from "../tradability-constants";
import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import type { Gate1Level, Gate2BarInput, SetupCandidate } from "./types";

export type Gate1SurfacingRule = "none" | "tier-a-only" | "all";

/**
 * Gate 1 × Gate 2 surfacing rule — FAIL surfaces nothing; WARNING surfaces A only;
 * PASS surfaces A and B. Single source of truth for this decision — called by both
 * `run-daily-scan-job.ts` (the production scan path) and the dashboard's funnel
 * reconstruction (`gate-funnel-copy.ts`) so the two can't drift out of sync.
 */
export function deriveGate1SurfacingRule(gate1Level: Gate1Level): Gate1SurfacingRule {
  if (gate1Level === "FAIL") return "none";
  if (gate1Level === "WARNING") return "tier-a-only";
  return "all";
}

export function filterCandidatesByGate1Level(
  gate1Level: Gate1Level,
  candidates: SetupCandidate[]
): SetupCandidate[] {
  const rule = deriveGate1SurfacingRule(gate1Level);
  if (rule === "none") return [];
  if (rule === "tier-a-only") return candidates.filter((c) => c.quality === "A");
  return candidates;
}

function barRowToInput(row: {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Gate2BarInput {
  return {
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  };
}

export type Gate2CollectionStats = {
  candidateCountA: number;
  candidateCountB: number;
  surfaced: SetupCandidate[];
  diagnostics: Gate2ScanDiagnosticsSummary;
};

/**
 * Evaluates Gate 2 for each tradable symbol, counts A/B before Gate 1, then returns
 * candidates that pass Gate 1 surfacing rules.
 */
export async function collectGate2SetupCandidatesWithStats(
  prisma: PrismaClient,
  tradableSymbolIds: readonly string[],
  gate1Level: Gate1Level,
  expectedLatestSession: Date,
  symbolKeyById: ReadonlyMap<string, string> = new Map()
): Promise<Gate2CollectionStats> {
  let candidateCountA = 0;
  let candidateCountB = 0;
  const surfaced: SetupCandidate[] = [];
  const diagnosticRows: Gate2DiagnosticEvaluationRow[] = [];

  // One batched, bounded-lookback query instead of a full-history findMany per symbol.
  const fromDate = tradabilityLookbackFromDate(expectedLatestSession);
  const barsBySymbolId = await fetchStockBarsGroupedAscThroughDate(
    prisma,
    tradableSymbolIds,
    expectedLatestSession,
    fromDate
  );

  for (const symbolId of tradableSymbolIds) {
    const bars = (barsBySymbolId.get(symbolId) ?? []).map(barRowToInput);
    const ev = evaluateBreakoutPullbackCandidate(bars, expectedLatestSession);
    diagnosticRows.push({
      symbol: symbolKeyById.get(symbolId) ?? symbolId,
      symbolId,
      evaluation: ev,
    });
    if (ev.quality === "INVALID") continue;

    if (ev.quality === "A") candidateCountA++;
    else candidateCountB++;

    if (gate1Level === "FAIL") continue;
    if (gate1Level === "WARNING" && ev.quality !== "A") continue;

    surfaced.push({
      symbolId,
      quality: ev.quality,
      close: ev.close,
      rankScore: ev.rankScore,
      rankComponents: ev.rankComponents,
      breakoutLevel: ev.breakoutLevel,
      pullbackZoneLow: ev.pullbackZoneLow,
      pullbackZoneHigh: ev.pullbackZoneHigh,
      stopLevel: ev.stopLevel,
      reasons: ev.reasons,
      barDate: ev.barDate,
    });
  }

  const diagnostics = buildGate2ScanDiagnosticsSummary(diagnosticRows);
  return { candidateCountA, candidateCountB, surfaced, diagnostics };
}

/**
 * Load daily bars for tradable symbols, evaluate Gate 2, return A/B candidates filtered by Gate 1.
 */
export async function collectGate2SetupCandidates(
  prisma: PrismaClient,
  tradableSymbolIds: readonly string[],
  gate1Level: Gate1Level,
  expectedLatestSession: Date
): Promise<SetupCandidate[]> {
  const { surfaced } = await collectGate2SetupCandidatesWithStats(
    prisma,
    tradableSymbolIds,
    gate1Level,
    expectedLatestSession
  );
  return surfaced;
}
