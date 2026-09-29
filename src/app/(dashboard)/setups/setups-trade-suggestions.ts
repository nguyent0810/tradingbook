import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";
import { loadProspectiveCount } from "@/lib/evidence/prospective-count";
import {
  buildTradeSuggestion,
  type TradeSuggestionResult,
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
 * then hands them to the pure builder. A failed lookup leaves the map empty
 * rather than inventing inputs.
 *
 * Bars are loaded through `latestSession` (the newest stored bar), not just the
 * setups' own session: the next-session band must come from the most recent
 * close, and a setup can be older than the data.
 */
export async function loadTradeSuggestions(
  candidates: readonly SuggestionCandidate[],
  latestSession: Date | null
): Promise<LoadedTradeSuggestions> {
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
          setup: c,
          bars: loaded.bars.get(c.symbolId) ?? [],
          exchange: exchangeById.get(c.symbolId) ?? null,
          prospectiveN,
        })
      );
    }
  }
  return { bySetupId, prospectiveN, error: loaded.error };
}
