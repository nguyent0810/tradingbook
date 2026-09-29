import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";
import { loadProspectiveCount } from "@/lib/evidence/prospective-count";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import {
  buildTradeSuggestion,
  type TradeSuggestionResult,
  type TradeSuggestionSizingInput,
} from "@/lib/trades/trade-suggestion";

/**
 * Calendar days of bars to load before the oldest setup session. The builder
 * needs 65 sessions; 200 calendar days is ~135 sessions even across Tết.
 */
const BAR_LOOKBACK_DAYS = 200;

type SuggestionCandidate = {
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
   * as the page already loads it for sizing (`safeLoadPositionSizingDefaults`).
   * Reused rather than read again; a missing entry reads as "chưa đánh giá được".
   */
  advBySymbolId: ReadonlyMap<string, number | null>;
  /** Settings and open trades for the size (#15); null = no size ("chưa tính được"). */
  sizing: TradeSuggestionSizingInput | null;
};

export type LoadedTradeSuggestions = {
  bySetupId: Map<string, TradeSuggestionResult>;
  /** Registry count; `null` = could not be read ("N không rõ"). */
  prospectiveN: number | null;
  /** Bars/exchange lookup failure. Candidates then show "không đủ dữ liệu". */
  error: string | null;
};

/**
 * Edge of the trade suggestion: loads bars, exchange and the prospective count,
 * then hands them with the market facts and the ADV to the pure builder. A failed lookup leaves the map empty
 * rather than inventing inputs.
 *
 * Bars are loaded through `latestSession` (the newest stored bar), not just the
 * setups' own session: the next-session band must come from the most recent
 * close, and a setup can be older than the data.
 */
export async function loadTradeSuggestions(
  candidates: readonly SuggestionCandidate[],
  market: TradeSuggestionMarketFacts
): Promise<LoadedTradeSuggestions> {
  const { latestSession } = market;
  const prospectiveNPromise = loadProspectiveCount();
  if (candidates.length === 0) {
    return { bySetupId: new Map(), prospectiveN: await prospectiveNPromise, error: null };
  }

  const newestSetup = candidates.reduce(
    (latest, c) => (c.barDate > latest ? c.barDate : latest),
    candidates[0]!.barDate
  );
  const oldestSetup = candidates.reduce(
    (oldest, c) => (c.barDate < oldest ? c.barDate : oldest),
    candidates[0]!.barDate
  );
  const through = latestSession && latestSession > newestSetup ? latestSession : newestSetup;
  const from = new Date(oldestSetup.getTime() - BAR_LOOKBACK_DAYS * 86_400_000);
  const symbolIds = [...new Set(candidates.map((c) => c.symbolId))];

  const [prospectiveN, loaded] = await Promise.all([
    prospectiveNPromise,
    Promise.all([
      fetchStockBarsGroupedAscThroughDate(prisma, symbolIds, through, from),
      prisma.stockSymbol.findMany({
        where: { id: { in: symbolIds } },
        select: { id: true, exchange: true },
      }),
    ])
      .then(([bars, symbols]) => ({ bars, symbols, error: null as string | null }))
      .catch((e) => {
        console.error("[setups] trade suggestion inputs failed:", e);
        return {
          bars: null,
          symbols: null,
          error: "Nạp nến/sàn cho gợi ý lệnh thất bại: " + String(e),
        };
      }),
  ]);

  const bySetupId = new Map<string, TradeSuggestionResult>();
  if (loaded.bars && loaded.symbols) {
    const exchangeById = new Map(loaded.symbols.map((s) => [s.id, s.exchange]));
    for (const c of candidates) {
      bySetupId.set(
        c.id,
        buildTradeSuggestion({
          setup: {
            pullbackZoneLow: c.pullbackZoneLow,
            pullbackZoneHigh: c.pullbackZoneHigh,
            stopLevel: c.stopLevel,
            barDate: c.barDate,
            // Anything but A or B is not guessed as B: the tier risk is skipped.
            tier: c.quality === "A" || c.quality === "B" ? c.quality : null,
            reasons: parseSetupCandidateReasons(c.reasons).lines,
          },
          bars: loaded.bars.get(c.symbolId) ?? [],
          exchange: exchangeById.get(c.symbolId) ?? null,
          prospectiveN,
          gate1Level: market.gate1Level,
          expectedSession: market.expectedSession,
          advVnd: market.advBySymbolId.get(c.symbolId) ?? null,
          sizing: market.sizing,
        })
      );
    }
  }
  return { bySetupId, prospectiveN, error: loaded.error };
}
