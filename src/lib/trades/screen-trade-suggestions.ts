/**
 * Pure half of the screen loader for Gợi ý lệnh (#16): the shared types and the
 * per-candidate build loop. The DB half lives in `load-screen-trade-suggestions`
 * (server-only); F1, F2 and F7 all go through it, so every screen builds the
 * same suggestion from the same inputs.
 */
import type { Gate1Level, Gate2BarInput } from "@/lib/scanner/gate2/types";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import {
  buildTradeSuggestion,
  type TradeSuggestionResult,
  type TradeSuggestionSizingInput,
} from "@/lib/trades/trade-suggestion";

/**
 * Why a page has no sizing input for the suggestion. Each case withholds the
 * size rather than guessing, and matches where the server refuses to log a trade.
 */
export type SizingUnavailable =
  /** No account equity on record. */
  | "NO_EQUITY"
  /**
   * The open trades could not be read. NOT "no open positions": counting them as
   * 0 would give a size ABOVE the cap the server applies when a trade is logged.
   */
  | "OPEN_TRADES_UNREADABLE"
  /** The 20-session average traded value could not be read: the server fails closed here too. */
  | "LIQUIDITY_UNREADABLE";

/** A stored scanner setup, as the loader needs it. Prices kVND. */
export type SuggestionCandidate = {
  id: string;
  symbolId: string;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  barDate: Date;
  quality: string;
  /** `SetupCandidate.reasons` JSON as stored. */
  reasons: unknown;
};

export type TradeSuggestionMarketFacts = {
  /** Newest stored stock bar; bars are loaded through it. */
  latestSession: Date | null;
  /** The index's latest session — what the stale-data risk compares against. */
  expectedSession: Date | null;
  /** Live Gate 1 level; null when it could not be evaluated. */
  gate1Level: Gate1Level | null;
  /**
   * 20-session average traded value by symbol id, at each setup's own session,
   * as the sizing defaults load it. A missing entry reads as "chưa đánh giá được".
   */
  advBySymbolId: ReadonlyMap<string, number | null>;
  /** Settings and open trades for the size (#15); null = no size ("chưa tính được"). */
  sizing: TradeSuggestionSizingInput | null;
};

/**
 * Builds one suggestion per candidate. Each build is isolated: an unexpected
 * throw becomes a `BUILD_FAILED` result for that row ("không đủ dữ liệu" with
 * the error), never a failed batch that would blank every other row.
 */
export function buildScreenTradeSuggestions(input: {
  candidates: readonly SuggestionCandidate[];
  barsBySymbolId: ReadonlyMap<string, readonly Gate2BarInput[]>;
  exchangeBySymbolId: ReadonlyMap<string, string | null>;
  prospectiveN: number | null;
  market: TradeSuggestionMarketFacts;
}): Map<string, TradeSuggestionResult> {
  const { market } = input;
  const bySetupId = new Map<string, TradeSuggestionResult>();
  for (const c of input.candidates) {
    let result: TradeSuggestionResult;
    try {
      result = buildTradeSuggestion({
        setup: {
          pullbackZoneLow: c.pullbackZoneLow,
          pullbackZoneHigh: c.pullbackZoneHigh,
          stopLevel: c.stopLevel,
          barDate: c.barDate,
          // Anything but A or B is not guessed as B: the tier risk is skipped.
          tier: c.quality === "A" || c.quality === "B" ? c.quality : null,
          reasons: parseSetupCandidateReasons(c.reasons).lines,
        },
        bars: input.barsBySymbolId.get(c.symbolId) ?? [],
        exchange: input.exchangeBySymbolId.get(c.symbolId) ?? null,
        prospectiveN: input.prospectiveN,
        gate1Level: market.gate1Level,
        expectedSession: market.expectedSession,
        advVnd: market.advBySymbolId.get(c.symbolId) ?? null,
        sizing: market.sizing,
      });
    } catch (e) {
      console.error(`[trade-suggestion] build failed for setup ${c.id}:`, e);
      result = {
        ok: false,
        reason: "BUILD_FAILED",
        detail: `lỗi khi dựng gợi ý lệnh: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    bySetupId.set(c.id, result);
  }
  return bySetupId;
}
