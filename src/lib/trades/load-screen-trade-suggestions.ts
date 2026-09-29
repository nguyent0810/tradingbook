import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchStockBarsGroupedAscThroughDate } from "@/lib/setup-health/load-bars";
import { loadProspectiveCount } from "@/lib/evidence/prospective-count";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { OhlcvBar } from "@/lib/setup-health/types";
import type { OpenTradeRisk, TradeSuggestionResult } from "@/lib/trades/trade-suggestion";
import {
  safeLoadPositionSizingDefaults,
  suggestionSizingInput,
  type PositionSizingDefaultsResult,
} from "@/lib/trades/position-sizing-defaults";
import {
  buildScreenTradeSuggestions,
  type SizingUnavailable,
  type SuggestionCandidate,
} from "@/lib/trades/screen-trade-suggestions";

/**
 * Calendar days of bars to load before the oldest setup session. The builder
 * needs 65 sessions; 200 calendar days is ~135 sessions even across Tết.
 */
const BAR_LOOKBACK_DAYS = 200;

export type ScreenTradeSuggestions = {
  /** Suggestion by setup id. A missing entry means the bars/exchange lookup failed. */
  bySetupId: Map<string, TradeSuggestionResult>;
  /** Registry count; `null` = could not be read ("N không rõ"). */
  prospectiveN: number | null;
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
 *
 * The bars/exchange/registry reads and the sizing reads are independent, so
 * they run in parallel; only the build needs both.
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
  const [inputs, sizingDefaults, openTrades] = await Promise.all([
    loadSuggestionInputs(candidates, params.latestSession),
    safeLoadPositionSizingDefaults(prisma, params.userId, advTargets),
    loadOpenTrades(params.userId),
  ]);
  // The size carries the session verdict, so every figure is on the share count
  // shown (PROBE 30%, NO-TRADE 0).
  const sizing = suggestionSizingInput(sizingDefaults, openTrades.value, params.verdictLevel);

  const bySetupId =
    inputs.bars && inputs.exchangeBySymbolId
      ? buildScreenTradeSuggestions({
          candidates,
          barsBySymbolId: inputs.bars,
          exchangeBySymbolId: inputs.exchangeBySymbolId,
          prospectiveN: inputs.prospectiveN,
          market: {
            latestSession: params.latestSession,
            expectedSession: params.expectedSession,
            gate1Level: params.gate1Level,
            advBySymbolId: sizingDefaults.advBySymbolId,
            sizing: sizing.input,
          },
        })
      : new Map<string, TradeSuggestionResult>();

  return {
    bySetupId,
    prospectiveN: inputs.prospectiveN,
    sizingDefaults,
    sizingUnavailable: sizing.unavailable,
    errors: [sizingDefaults.error, openTrades.error, inputs.error].filter(
      (e): e is string => e != null
    ),
  };
}

/**
 * Bars, exchange and the prospective count. Bars are loaded through
 * `latestSession` (the newest stored bar), not just the setups' own session:
 * the next-session band must come from the most recent close, and a setup can
 * be older than the data. A failed lookup returns no bars rather than inventing
 * inputs; the candidates then show "không đủ dữ liệu".
 */
async function loadSuggestionInputs(
  candidates: readonly SuggestionCandidate[],
  latestSession: Date | null
): Promise<{
  bars: Map<string, OhlcvBar[]> | null;
  exchangeBySymbolId: Map<string, string | null> | null;
  prospectiveN: number | null;
  error: string | null;
}> {
  const prospectiveNPromise = loadProspectiveCount();
  if (candidates.length === 0) {
    return { bars: new Map(), exchangeBySymbolId: new Map(), prospectiveN: await prospectiveNPromise, error: null };
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
      .then(([bars, symbols]) => ({
        bars,
        exchangeBySymbolId: new Map(symbols.map((s) => [s.id, s.exchange])),
        error: null as string | null,
      }))
      .catch((e) => {
        console.error("[trade-suggestion] bars/exchange lookup failed:", e);
        return {
          bars: null,
          exchangeBySymbolId: null,
          error: "Nạp nến/sàn cho gợi ý lệnh thất bại: " + String(e),
        };
      }),
  ]);
  return { ...loaded, prospectiveN };
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
    console.error("[trade-suggestion] open trades lookup failed:", e);
    return {
      value: null,
      error:
        "prisma.trade.findMany({ userId, status: OPEN }) / stockSymbol.findMany that bai: " + String(e),
    };
  }
}
