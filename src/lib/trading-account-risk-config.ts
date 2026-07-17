/**
 * Account equity + position-sizing overrides for portfolio capacity UX (risk
 * guardrails, recommended position sizing). When equity is unset, Dashboard
 * shows an exposure snapshot instead of implying full risk metrics.
 *
 * All settable from the app's Settings page (`UserTradingSettings`, per-user).
 * `TRADING_ACCOUNT_EQUITY_VND` remains a fallback default for equity for
 * anyone who hasn't set a value in the UI yet — the DB value always wins once
 * set. Position-sizing overrides have no env equivalent; null falls back to
 * the hardcoded defaults in `position-sizing-panel.ts`.
 */
import { cache } from "react";

export function parsePositiveMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Env-only fallback — used when the user hasn't set a value in Settings yet. */
function parseTradingAccountEquityVndFromEnv(): number | null {
  const raw = process.env.TRADING_ACCOUNT_EQUITY_VND;
  if (raw == null) return null;
  return parsePositiveMoney(String(raw));
}

type UserTradingSettingsRow = {
  accountEquityVnd: number | null;
  riskPerTradePct: number | null;
  maxPositionPct: number | null;
  liquidityCapPct: number | null;
};

/** Single DB read, shared (via `cache()` request-dedup) by both getters below. */
const getUserTradingSettingsRow = cache(
  async (userId: string): Promise<UserTradingSettingsRow | null> => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.userTradingSettings.findUnique({
      where: { userId },
      select: {
        accountEquityVnd: true,
        riskPerTradePct: true,
        maxPositionPct: true,
        liquidityCapPct: true,
      },
    });
  }
);

/** Parsed account equity in VND for this user — DB value if set, else the env fallback, else null. */
export const getTradingAccountEquityVnd = cache(
  async (userId: string): Promise<number | null> => {
    const row = await getUserTradingSettingsRow(userId);
    if (row?.accountEquityVnd != null && row.accountEquityVnd > 0) {
      return row.accountEquityVnd;
    }
    return parseTradingAccountEquityVndFromEnv();
  }
);

export type PositionSizingConfigOverrides = {
  /** Decimal fraction (0.0075 = 0.75%) or null to use the system default. */
  riskPerTradePct: number | null;
  /** Decimal fraction (0.15 = 15%) or null to use the system default. */
  maxPositionPct: number | null;
  /** Decimal fraction (0.05 = 5%) or null to use the system default. */
  liquidityCapPct: number | null;
};

/** User overrides for position-sizing params — null fields fall back to position-sizing-panel.ts defaults. */
export const getPositionSizingConfig = cache(
  async (userId: string): Promise<PositionSizingConfigOverrides> => {
    const row = await getUserTradingSettingsRow(userId);
    const positive = (n: number | null | undefined) => (n != null && n > 0 ? n : null);
    return {
      riskPerTradePct: positive(row?.riskPerTradePct),
      maxPositionPct: positive(row?.maxPositionPct),
      liquidityCapPct: positive(row?.liquidityCapPct),
    };
  }
);
