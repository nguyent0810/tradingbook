/**
 * Account equity for portfolio capacity UX (position sizing, book-risk caps).
 * When unset, Dashboard shows an exposure snapshot instead of implying full risk metrics.
 *
 * Settable from the app's Settings page (`UserTradingSettings.accountEquityVnd`,
 * per-user). `TRADING_ACCOUNT_EQUITY_VND` remains a fallback default for anyone
 * who hasn't set a value in the UI yet — the DB value always wins once set.
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

/** Parsed account equity in VND for this user — DB value if set, else the env fallback, else null. */
export const getTradingAccountEquityVnd = cache(
  async (userId: string): Promise<number | null> => {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.userTradingSettings.findUnique({
      where: { userId },
      select: { accountEquityVnd: true },
    });
    if (row?.accountEquityVnd != null && row.accountEquityVnd > 0) {
      return row.accountEquityVnd;
    }
    return parseTradingAccountEquityVndFromEnv();
  }
);
