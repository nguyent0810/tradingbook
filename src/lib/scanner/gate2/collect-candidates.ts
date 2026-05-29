import type { PrismaClient } from "@/generated/prisma/client";
import {
  buildGate2ScanDiagnosticsSummary,
  type Gate2DiagnosticEvaluationRow,
  type Gate2ScanDiagnosticsSummary,
} from "../gate2-scan-diagnostics";
import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import type { Gate1Level, Gate2BarInput, SetupCandidate } from "./types";

/**
 * Gate 1 × Gate 2 — FAIL surfaces nothing; WARNING surfaces A only; PASS surfaces A and B.
 */
export function filterCandidatesByGate1Level(
  gate1Level: Gate1Level,
  candidates: SetupCandidate[]
): SetupCandidate[] {
  if (gate1Level === "FAIL") return [];
  if (gate1Level === "WARNING") {
    return candidates.filter((c) => c.quality === "A");
  }
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

  for (const symbolId of tradableSymbolIds) {
    const rows = await prisma.stockDailyBar.findMany({
      where: { symbolId },
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

    const bars = rows.map(barRowToInput);
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
