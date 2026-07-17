import { afterEach, describe, expect, it, vi } from "vitest";
import { getTradingAccountEquityVnd, parsePositiveMoney } from "./trading-account-risk-config";

const findUniqueMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userTradingSettings: {
      findUnique: findUniqueMock,
    },
  },
}));

const ORIGINAL_ENV = process.env.TRADING_ACCOUNT_EQUITY_VND;

afterEach(() => {
  findUniqueMock.mockReset();
  if (ORIGINAL_ENV == null) delete process.env.TRADING_ACCOUNT_EQUITY_VND;
  else process.env.TRADING_ACCOUNT_EQUITY_VND = ORIGINAL_ENV;
});

describe("parsePositiveMoney", () => {
  it("parses a comma-formatted positive amount", () => {
    expect(parsePositiveMoney("500,000,000")).toBe(500_000_000);
  });

  it("rejects zero, negative, and non-numeric input", () => {
    expect(parsePositiveMoney("0")).toBeNull();
    expect(parsePositiveMoney("-100")).toBeNull();
    expect(parsePositiveMoney("not a number")).toBeNull();
    expect(parsePositiveMoney("")).toBeNull();
  });
});

describe("getTradingAccountEquityVnd", () => {
  it("returns the DB value when a settings row with a positive equity exists", async () => {
    findUniqueMock.mockResolvedValueOnce({ accountEquityVnd: 750_000_000 });
    delete process.env.TRADING_ACCOUNT_EQUITY_VND;

    const result = await getTradingAccountEquityVnd("user-db-value");

    expect(result).toBe(750_000_000);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { userId: "user-db-value" },
      select: { accountEquityVnd: true },
    });
  });

  it("falls back to the env var when no settings row exists", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    process.env.TRADING_ACCOUNT_EQUITY_VND = "300000000";

    const result = await getTradingAccountEquityVnd("user-env-fallback");

    expect(result).toBe(300_000_000);
  });

  it("falls back to the env var when the DB row's equity is null", async () => {
    findUniqueMock.mockResolvedValueOnce({ accountEquityVnd: null });
    process.env.TRADING_ACCOUNT_EQUITY_VND = "200000000";

    const result = await getTradingAccountEquityVnd("user-null-db-value");

    expect(result).toBe(200_000_000);
  });

  it("returns null when neither the DB row nor the env var is set", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    delete process.env.TRADING_ACCOUNT_EQUITY_VND;

    const result = await getTradingAccountEquityVnd("user-unconfigured");

    expect(result).toBeNull();
  });
});
