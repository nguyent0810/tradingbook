import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("@/lib/trading-account-risk-config", () => ({
  getTradingAccountEquityVnd: vi.fn(async () => 500_000_000),
  getPositionSizingConfig: vi.fn(async () => ({
    riskPerTradePct: 0.01,
    maxPositionPct: 0.2,
    liquidityCapPct: 0.1,
  })),
}));

import { safeLoadPositionSizingDefaults } from "./setups-position-sizing-defaults";
import { getTradingAccountEquityVnd } from "@/lib/trading-account-risk-config";

const SESSION = new Date(Date.UTC(2026, 6, 17));

function fakePrisma(advRows: Array<{ symbolId: string; close: number; volMa20: number }>): PrismaClient {
  return {
    symbolMarketContextDaily: {
      findMany: async () => advRows,
    },
  } as unknown as PrismaClient;
}

describe("safeLoadPositionSizingDefaults", () => {
  it("returns equity/config/ADV together on the happy path", async () => {
    const prisma = fakePrisma([{ symbolId: "s1", close: 20, volMa20: 1_000_000 }]);
    const r = await safeLoadPositionSizingDefaults(prisma, "user-1", ["s1"], SESSION);

    expect(r.error).toBeNull();
    expect(r.equityVnd).toBe(500_000_000);
    expect(r.positionSizingConfig.liquidityCapPct).toBe(0.1);
    expect(r.advBySymbolId.get("s1")).toBe(20 * 1000 * 1_000_000);
  });

  it("falls back to null/empty defaults without throwing when a userId is absent", async () => {
    const prisma = fakePrisma([]);
    const r = await safeLoadPositionSizingDefaults(prisma, null, [], SESSION);

    expect(r.error).toBeNull();
    expect(r.equityVnd).toBeNull();
    expect(r.positionSizingConfig).toEqual({ riskPerTradePct: null, maxPositionPct: null, liquidityCapPct: null });
    expect(r.advBySymbolId.size).toBe(0);
  });

  it("degrades to safe fallback + error string instead of throwing when a call fails", async () => {
    vi.mocked(getTradingAccountEquityVnd).mockRejectedValueOnce(new Error("DB timeout"));
    const prisma = fakePrisma([]);

    const r = await safeLoadPositionSizingDefaults(prisma, "user-1", ["s1"], SESSION);

    expect(r.error).toBe("Giá trị mặc định định cỡ vị thế không khả dụng (risk-config/ADV).");
    expect(r.equityVnd).toBeNull();
    expect(r.positionSizingConfig).toEqual({ riskPerTradePct: null, maxPositionPct: null, liquidityCapPct: null });
    expect(r.advBySymbolId.size).toBe(0);
  });
});
