import type { PrismaClient } from "@/generated/prisma/client";
import {
  getPositionSizingConfig,
  getTradingAccountEquityVnd,
  type PositionSizingConfigOverrides,
} from "@/lib/trading-account-risk-config";

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

/**
 * Risk-config + ADV lookups are DB reads like every other loader on the Setups
 * page — unlike those, they previously had no try/catch, so a single blip here
 * threw the whole /setups page instead of just hiding the sizing panel.
 */
export async function safeLoadPositionSizingDefaults(
  prisma: PrismaClient,
  userId: string | null,
  symbolIds: string[],
  expectedSession: Date | null
): Promise<PositionSizingDefaultsResult> {
  try {
    const [equityVnd, positionSizingConfig, advRows] = await Promise.all([
      userId ? getTradingAccountEquityVnd(userId) : Promise.resolve(null),
      userId ? getPositionSizingConfig(userId) : Promise.resolve(EMPTY_POSITION_SIZING_CONFIG),
      expectedSession && symbolIds.length > 0
        ? prisma.symbolMarketContextDaily.findMany({
            where: { sessionDate: expectedSession, symbolId: { in: symbolIds } },
            select: { symbolId: true, close: true, volMa20: true },
          })
        : Promise.resolve([]),
    ]);
    const advBySymbolId = new Map(
      advRows.map((r) => [r.symbolId, r.close != null && r.volMa20 != null ? r.close * 1000 * r.volMa20 : null])
    );
    return { equityVnd, positionSizingConfig, advBySymbolId, error: null };
  } catch (e) {
    console.error("[setups] safeLoadPositionSizingDefaults failed:", e);
    return {
      equityVnd: null,
      positionSizingConfig: EMPTY_POSITION_SIZING_CONFIG,
      advBySymbolId: new Map(),
      error: "Position sizing defaults unavailable (risk-config/ADV).",
    };
  }
}
