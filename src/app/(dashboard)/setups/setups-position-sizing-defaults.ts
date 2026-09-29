import type { PrismaClient } from "@/generated/prisma/client";
import {
  getPositionSizingConfig,
  getTradingAccountEquityVnd,
  type PositionSizingConfigOverrides,
} from "@/lib/trading-account-risk-config";
import { loadSymbolAdvVndBatch } from "@/lib/trades/symbol-adv";
import { POSITION_SIZING_DEFAULTS } from "@/lib/position-sizing";
import type { TradeSuggestionSizingInput } from "@/lib/trades/trade-suggestion";

export type PositionSizingDefaultsResult = {
  equityVnd: number | null;
  positionSizingConfig: PositionSizingConfigOverrides;
  advBySymbolId: Map<string, number | null>;
  error: string | null;
};

export const EMPTY_POSITION_SIZING_CONFIG: PositionSizingConfigOverrides = {
  riskPerTradePct: null,
  maxPositionPct: null,
  liquidityCapPct: null,
};

export type OpenTradeRisk = TradeSuggestionSizingInput["openTrades"][number];

/**
 * Sizing inputs of the trade suggestion (#15): the user's settings with the same
 * defaults the server applies when a trade is logged, plus the open journal
 * trades. `null` when equity is not set or the open trades could not be read:
 * the suggestion then carries no size rather than one built on guesses.
 */
export function suggestionSizingInput(
  defaults: Pick<PositionSizingDefaultsResult, "equityVnd" | "positionSizingConfig">,
  openTrades: readonly OpenTradeRisk[] | null
): TradeSuggestionSizingInput | null {
  const equityVnd = defaults.equityVnd;
  if (equityVnd == null || !Number.isFinite(equityVnd) || equityVnd <= 0 || openTrades == null) {
    return null;
  }
  const config = defaults.positionSizingConfig;
  return {
    equityVnd,
    riskPerTradePct: config.riskPerTradePct ?? POSITION_SIZING_DEFAULTS.baseRiskPerTradePct,
    maxPerTradeExposurePct: config.maxPositionPct ?? POSITION_SIZING_DEFAULTS.maxPerTradeExposurePct,
    maxPortfolioExposurePct: POSITION_SIZING_DEFAULTS.maxPortfolioExposurePct,
    liquidityCapPct: config.liquidityCapPct ?? POSITION_SIZING_DEFAULTS.liquidityCapPct,
    // Exposure: same formula as the server action that logs a trade.
    currentExposureVnd: openTrades.reduce((sum, t) => sum + t.entryKvnd * 1000 * t.quantity, 0),
    openTrades,
  };
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
        error: adv.error,
      };
    }
    return { equityVnd, positionSizingConfig, advBySymbolId: adv.map, error: null };
  } catch (e) {
    console.error("[setups] safeLoadPositionSizingDefaults failed:", e);
    return {
      equityVnd: null,
      positionSizingConfig: EMPTY_POSITION_SIZING_CONFIG,
      advBySymbolId: new Map(),
      error:
        "safeLoadPositionSizingDefaults() thất bại " +
        "(getTradingAccountEquityVnd · getPositionSizingConfig · " +
        "prisma.symbolMarketContextDaily.findMany): " +
        String(e),
    };
  }
}
