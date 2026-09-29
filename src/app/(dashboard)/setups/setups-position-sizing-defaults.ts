import type { PrismaClient } from "@/generated/prisma/client";
import {
  getPositionSizingConfig,
  getTradingAccountEquityVnd,
  type PositionSizingConfigOverrides,
} from "@/lib/trading-account-risk-config";
import { loadSymbolAdvVndBatch } from "@/lib/trades/symbol-adv";
import { POSITION_SIZING_DEFAULTS, openExposureVnd } from "@/lib/position-sizing";
import type { OpenTradeRisk, TradeSuggestionSizingInput } from "@/lib/trades/trade-suggestion";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import type { SizingUnavailable } from "@/lib/setups/terminal/f2-view-model";

export type PositionSizingDefaultsResult = {
  equityVnd: number | null;
  positionSizingConfig: PositionSizingConfigOverrides;
  advBySymbolId: Map<string, number | null>;
  /**
   * True when the ADV lookup itself failed (not when a symbol simply has no
   * row). The server refuses to log a trade then, so no size is shown either.
   */
  advUnavailable: boolean;
  error: string | null;
};

export const EMPTY_POSITION_SIZING_CONFIG: PositionSizingConfigOverrides = {
  riskPerTradePct: null,
  maxPositionPct: null,
  liquidityCapPct: null,
};

/**
 * Sizing inputs of the trade suggestion (#15): the user's settings with the same
 * defaults the server applies when a trade is logged, the open journal trades
 * and the session verdict. No input, with the reason, when the ADV lookup
 * failed (checked first, as the server does), equity is not set or the open
 * trades could not be read: the suggestion then carries no size rather than one
 * built on guesses or one the server would refuse to log.
 */
export function suggestionSizingInput(
  defaults: Pick<PositionSizingDefaultsResult, "equityVnd" | "positionSizingConfig" | "advUnavailable">,
  openTrades: readonly OpenTradeRisk[] | null,
  verdictLevel: VerdictUxLevel | null
):
  | { input: TradeSuggestionSizingInput; unavailable: null }
  | { input: null; unavailable: SizingUnavailable } {
  if (defaults.advUnavailable) return { input: null, unavailable: "LIQUIDITY_UNREADABLE" };
  const equityVnd = defaults.equityVnd;
  if (equityVnd == null || !Number.isFinite(equityVnd) || equityVnd <= 0) {
    return { input: null, unavailable: "NO_EQUITY" };
  }
  if (openTrades == null) return { input: null, unavailable: "OPEN_TRADES_UNREADABLE" };
  const config = defaults.positionSizingConfig;
  const input: TradeSuggestionSizingInput = {
    equityVnd,
    riskPerTradePct: config.riskPerTradePct ?? POSITION_SIZING_DEFAULTS.baseRiskPerTradePct,
    maxPerTradeExposurePct: config.maxPositionPct ?? POSITION_SIZING_DEFAULTS.maxPerTradeExposurePct,
    maxPortfolioExposurePct: POSITION_SIZING_DEFAULTS.maxPortfolioExposurePct,
    liquidityCapPct: config.liquidityCapPct ?? POSITION_SIZING_DEFAULTS.liquidityCapPct,
    currentExposureVnd: openExposureVnd(openTrades),
    openTrades,
    verdictLevel,
  };
  return { input, unavailable: null };
}

/**
 * Risk-config + ADV lookups are DB reads like every other loader on the Setups
 * page — unlike those, they previously had no try/catch, so a single blip here
 * threw the whole /setups page instead of just hiding the sizing panel.
 */
export async function safeLoadPositionSizingDefaults(
  prisma: PrismaClient,
  userId: string | null,
  /** Mỗi ứng viên kèm phiên của chính nó — đúng mốc mà server sẽ dùng. */
  advTargets: readonly { symbolId: string; sessionDate: Date }[]
): Promise<PositionSizingDefaultsResult> {
  try {
    const [equityVnd, positionSizingConfig, adv] = await Promise.all([
      userId ? getTradingAccountEquityVnd(userId) : Promise.resolve(null),
      userId ? getPositionSizingConfig(userId) : Promise.resolve(EMPTY_POSITION_SIZING_CONFIG),
      // ADV phải theo ĐÚNG quy tắc "tại hoặc trước phiên của thiết lập" mà server
      // action dùng khi ghi lệnh. Bản cũ truy vấn khớp CHÍNH XÁC `expectedSession`
      // nên khi thiếu hàng đúng ngày (mà có hàng trước đó), màn và server ra hai
      // khối lượng khác nhau.
      loadSymbolAdvVndBatch(prisma, advTargets),
    ]);
    if (!adv.ok) {
      return {
        equityVnd,
        positionSizingConfig,
        advBySymbolId: new Map(),
        advUnavailable: true,
        error: adv.error,
      };
    }
    return { equityVnd, positionSizingConfig, advBySymbolId: adv.map, advUnavailable: false, error: null };
  } catch (e) {
    console.error("[setups] safeLoadPositionSizingDefaults failed:", e);
    return {
      equityVnd: null,
      positionSizingConfig: EMPTY_POSITION_SIZING_CONFIG,
      advBySymbolId: new Map(),
      advUnavailable: true,
      error:
        "safeLoadPositionSizingDefaults() thất bại " +
        "(getTradingAccountEquityVnd · getPositionSizingConfig · " +
        "prisma.symbolMarketContextDaily.findMany): " +
        String(e),
    };
  }
}
