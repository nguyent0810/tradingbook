import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";
import { loadProspectiveCount } from "@/lib/evidence/prospective-count";
import { parseSetupCandidateReasons } from "@/lib/scanner/setup-candidate-reasons";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { SizingUnavailable } from "@/lib/setups/terminal/f2-view-model";
import {
  buildTradeSuggestion,
  type OpenTradeRisk,
  type TradeSuggestionResult,
  type TradeSuggestionSizingInput,
} from "@/lib/trades/trade-suggestion";
import {
  safeLoadPositionSizingDefaults,
  suggestionSizingInput,
  type PositionSizingDefaultsResult,
} from "./setups-position-sizing-defaults";

/**
 * Calendar days of bars to load before the oldest setup session. The builder
 * needs 65 sessions; 200 calendar days is ~135 sessions even across Tết.
 */
const BAR_LOOKBACK_DAYS = 200;

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

export type ScreenTradeSuggestions = LoadedTradeSuggestions & {
  /** Equity, sizing settings and ADV the size was built from (F2 shows them too). */
  sizingDefaults: PositionSizingDefaultsResult;
  /** Why the suggestions carry no size; null when they do. */
  sizingUnavailable: SizingUnavailable | null;
  /** Every lookup failure, verbatim, for the screen's error panel. */
  errors: string[];
};

/**
 * The one way a screen gets its trade suggestions (#16): F1, F2 and F7 all call
 * this, so every screen builds the same `TradeSuggestion` from the same inputs:
 * the user's sizing settings and ADV at each setup's own session, the open
 * journal trades, the session verdict, the live Gate 1 level and the two
 * session marks. The caller passes what it has already read for its own panels
 * (verdict, Gate 1, sessions) instead of this reading them a second time.
 *
 * `latestSession` is the newest stored stock bar: bars are loaded through it so
 * the next-session band comes from the most recent close. A caller that shows a
 * single symbol may pass that symbol's own newest bar; no bar of the symbol is
 * newer, so the bars loaded are the same.
 */
export async function loadScreenTradeSuggestions(params: {
  userId: string;
  candidates: readonly SuggestionCandidate[];
  latestSession: Date | null;
  expectedSession: Date | null;
  gate1Level: Gate1Level | null;
  verdictLevel: VerdictUxLevel | null;
}): Promise<ScreenTradeSuggestions> {
  const { candidates } = params;
  // Each candidate carries its own session (`barDate`): the same mark the server
  // action uses for ADV when a trade is logged from that setup.
  const advTargets = candidates.map((c) => ({ symbolId: c.symbolId, sessionDate: c.barDate }));
  const [sizingDefaults, openTrades] = await Promise.all([
    safeLoadPositionSizingDefaults(prisma, params.userId, advTargets),
    loadOpenTrades(params.userId),
  ]);
  // The size carries the session verdict, so every figure is on the share count
  // shown (PROBE 30%, NO-TRADE 0).
  const sizing = suggestionSizingInput(sizingDefaults, openTrades.value, params.verdictLevel);
  const loaded = await loadTradeSuggestions(candidates, {
    latestSession: params.latestSession,
    expectedSession: params.expectedSession,
    gate1Level: params.gate1Level,
    advBySymbolId: sizingDefaults.advBySymbolId,
    sizing: sizing.input,
  });
  return {
    ...loaded,
    sizingDefaults,
    sizingUnavailable: sizing.unavailable,
    errors: [sizingDefaults.error, openTrades.error, loaded.error].filter(
      (e): e is string => e != null
    ),
  };
}

/**
 * Các lệnh đang mở trong sổ: giá vào, stop, khối lượng và sàn của mã. Size tham
 * khảo lấy exposure (cùng công thức server dùng khi ghi lệnh) và Tổng rủi ro mở
 * (có đệm gap theo sàn của từng lệnh) từ đây.
 * `value: null` = không đọc được, KHÔNG phải "không có lệnh nào".
 *
 * `Trade.symbol` là chuỗi, không có quan hệ tới `StockSymbol`, nên sàn đến từ
 * MỘT truy vấn gộp theo danh sách mã (không N+1).
 */
async function loadOpenTrades(
  userId: string
): Promise<{ value: OpenTradeRisk[] | null; error: string | null }> {
  try {
    const open = await prisma.trade.findMany({
      where: { userId, status: "OPEN" },
      select: { symbol: true, entryPrice: true, stopLoss: true, quantity: true },
    });
    const keys = [...new Set(open.flatMap((t) => [t.symbol, t.symbol.toUpperCase()]))];
    const symbols =
      keys.length > 0
        ? await prisma.stockSymbol.findMany({
            where: { symbol: { in: keys } },
            select: { symbol: true, exchange: true },
          })
        : [];
    const exchangeBySymbol = new Map(symbols.map((s) => [s.symbol.toUpperCase(), s.exchange]));
    return {
      value: open.map((t) => ({
        entryKvnd: t.entryPrice,
        stopKvnd: t.stopLoss,
        quantity: t.quantity,
        exchange: exchangeBySymbol.get(t.symbol.toUpperCase()) ?? null,
      })),
      error: null,
    };
  } catch (e) {
    console.error("[setups] open exposure lookup failed:", e);
    return {
      value: null,
      error:
        "prisma.trade.findMany({ userId, status: OPEN }) / stockSymbol.findMany that bai: " + String(e),
    };
  }
}
