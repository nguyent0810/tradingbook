import type { PrismaClient } from "@/generated/prisma/client";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { sortDedupeGate2Bars } from "@/lib/scanner/gate2/breakout-pullback";
import { barsThroughSession, computeAtr14 } from "@/lib/scanner/early-entry/bar-metrics";
import {
  collectResistanceCandidates,
  selectRewardTarget,
  type TargetReason,
} from "@/lib/scanner/early-entry/risk-reward";

/**
 * Auto-derived trade levels for a qualified SetupCandidate. All prices are in
 * the same unit the scanner already stores (thousand VND — "nghìn đồng").
 *
 * `entryRangeLow/High` come from the candidate's own Gate-2 pullback zone
 * (breakoutLevel ceiling, structural floor) — already the playbook's defined
 * "valid entry location," not a new estimate. When that zone is unusually
 * wide relative to the prior session's true range, it's tightened around the
 * boundary closest to that session's close so the suggestion stays realistic
 * for a next-session limit order (this app has no live/intraday price feed —
 * see stopLoss/takeProfit below for why those don't have this problem).
 *
 * `stopLoss` is the candidate's own canonical Gate-2 `stopLevel` — final,
 * already validated, no new computation.
 *
 * `takeProfit`/`riskRewardRatio` reuse the early-entry module's structural
 * resistance scan (`collectResistanceCandidates` + `selectRewardTarget`)
 * but anchor it to `stopLoss` above, NOT early-entry's own independently
 * computed stop — so the numbers on a logged trade are internally
 * consistent with the stop the user actually sees on the Setups page.
 */
export type AutoPopulatedTradeLevels = {
  entryRangeLow: number;
  entryRangeHigh: number;
  suggestedEntry: number;
  stopLoss: number;
  takeProfit: number | null;
  targetReason: TargetReason | null;
  riskRewardRatio: number | null;
  /** Session the levels were computed from — surface as "as of <date>" in the UI. */
  asOfBarDate: Date;
};

export type SetupLevelsInput = {
  symbolId: string;
  close: number;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  /** SetupCandidate.barDate — the scan session these levels belong to. */
  barDate: Date;
};

const MIN_BARS_FOR_STRUCTURAL_SCAN = 65; // covers the 60-session resistance lookback + buffer
const ZONE_TIGHTEN_TRUE_RANGE_MULT = 1.5;
const TIGHTENED_HALF_WIDTH_TRUE_RANGE_MULT = 0.5;

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

/** Pure — no DB access. Exposed separately so it's independently testable. */
export function deriveAutoPopulatedTradeLevels(
  setup: SetupLevelsInput,
  bars: readonly Gate2BarInput[]
): AutoPopulatedTradeLevels | null {
  const through = barsThroughSession(sortDedupeGate2Bars(bars), setup.barDate);
  if (!through || through.sorted.length < MIN_BARS_FOR_STRUCTURAL_SCAN) return null;
  const { sorted, idx } = through;
  const lastBar = sorted[idx]!;

  const trueRange = lastBar.high - lastBar.low;
  let entryRangeLow = setup.pullbackZoneLow;
  let entryRangeHigh = setup.pullbackZoneHigh;
  const zoneWidth = entryRangeHigh - entryRangeLow;
  if (trueRange > 0 && zoneWidth > trueRange * ZONE_TIGHTEN_TRUE_RANGE_MULT) {
    const nearBoundary =
      Math.abs(lastBar.close - entryRangeLow) <= Math.abs(entryRangeHigh - lastBar.close)
        ? entryRangeLow
        : entryRangeHigh;
    const halfWidth = trueRange * TIGHTENED_HALF_WIDTH_TRUE_RANGE_MULT;
    entryRangeLow = Math.max(entryRangeLow, nearBoundary - halfWidth);
    entryRangeHigh = Math.min(entryRangeHigh, nearBoundary + halfWidth);
    if (entryRangeLow > entryRangeHigh) {
      // Degenerate tightening (shouldn't happen given the guards above) — fall back to the boundary itself.
      entryRangeLow = nearBoundary;
      entryRangeHigh = nearBoundary;
    }
  }
  const suggestedEntry = (entryRangeLow + entryRangeHigh) / 2;

  const atr14 = computeAtr14(sorted, idx);
  const structural = collectResistanceCandidates(sorted, idx, setup.close);
  // Target selection stays anchored to the actual last close (a real-market-
  // structure question: which resistance is realistically reachable from
  // here), but the R:R shown to the user must anchor to the entry we're
  // actually suggesting they pay — using setup.close there would silently
  // mismatch whenever suggestedEntry drifts from close (e.g. after zone
  // tightening).
  const { targetPrice, targetReason } = selectRewardTarget(
    structural,
    setup.close,
    atr14,
    setup.stopLevel
  );
  const risk = suggestedEntry - setup.stopLevel;
  const reward = targetPrice - suggestedEntry;
  const riskRewardRatio = risk > 0 ? reward / risk : null;

  return {
    entryRangeLow,
    entryRangeHigh,
    suggestedEntry,
    stopLoss: setup.stopLevel,
    takeProfit: targetPrice,
    targetReason,
    riskRewardRatio,
    asOfBarDate: lastBar.date,
  };
}

/** Loads the symbol's recent bar history and derives levels. Returns null if there isn't enough history. */
export async function loadAutoPopulatedTradeLevels(
  prisma: PrismaClient,
  setup: SetupLevelsInput
): Promise<AutoPopulatedTradeLevels | null> {
  const rows = await prisma.stockDailyBar.findMany({
    where: { symbolId: setup.symbolId },
    orderBy: { date: "desc" },
    take: 120,
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });
  if (rows.length < MIN_BARS_FOR_STRUCTURAL_SCAN) return null;
  const bars = rows.reverse().map(barRowToInput);
  return deriveAutoPopulatedTradeLevels(setup, bars);
}
