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

import { safeLoadPositionSizingDefaults, suggestionSizingInput } from "./position-sizing-defaults";
import { getTradingAccountEquityVnd } from "@/lib/trading-account-risk-config";

const SESSION = new Date(Date.UTC(2026, 6, 17));

function fakePrisma(
  advRows: Array<{ symbolId: string; sessionDate: Date; close: number; volMa20: number }>
): PrismaClient {
  return {
    symbolMarketContextDaily: {
      findMany: async () => advRows,
    },
  } as unknown as PrismaClient;
}

const TARGETS = [{ symbolId: "s1", sessionDate: SESSION }];

describe("safeLoadPositionSizingDefaults", () => {
  it("returns equity/config/ADV together on the happy path", async () => {
    const prisma = fakePrisma([
      { symbolId: "s1", sessionDate: SESSION, close: 20, volMa20: 1_000_000 },
    ]);
    const r = await safeLoadPositionSizingDefaults(prisma, "user-1", TARGETS);

    expect(r.error).toBeNull();
    expect(r.equityVnd).toBe(500_000_000);
    expect(r.positionSizingConfig.liquidityCapPct).toBe(0.1);
    expect(r.advBySymbolId.get("s1")).toBe(20 * 1000 * 1_000_000);
  });

  it("falls back to null/empty defaults without throwing when a userId is absent", async () => {
    const prisma = fakePrisma([]);
    const r = await safeLoadPositionSizingDefaults(prisma, null, []);

    expect(r.error).toBeNull();
    expect(r.equityVnd).toBeNull();
    expect(r.positionSizingConfig).toEqual({ riskPerTradePct: null, maxPositionPct: null, liquidityCapPct: null });
    expect(r.advBySymbolId.size).toBe(0);
  });

  it("degrades to safe fallback + error string instead of throwing when a call fails", async () => {
    vi.mocked(getTradingAccountEquityVnd).mockRejectedValueOnce(new Error("DB timeout"));
    const prisma = fakePrisma([]);

    const r = await safeLoadPositionSizingDefaults(prisma, "user-1", TARGETS);

    // Bàn giao §6: trạng thái lỗi phải kèm BẰNG CHỨNG thật — tên truy vấn đã
    // hỏng và nguyên văn exception, không phải một câu chung chung.
    expect(r.error).toContain("safeLoadPositionSizingDefaults()");
    expect(r.error).toContain("getTradingAccountEquityVnd");
    expect(r.error).toContain("DB timeout");
    expect(r.equityVnd).toBeNull();
    expect(r.positionSizingConfig).toEqual({ riskPerTradePct: null, maxPositionPct: null, liquidityCapPct: null });
    expect(r.advBySymbolId.size).toBe(0);
  });

  it("dùng hàng ADV của phiên TRƯỚC khi thiếu hàng đúng ngày — khớp quy tắc server", () => {
    // Server ghi lệnh lấy ADV "tại hoặc trước" phiên của thiết lập. Nếu màn chỉ
    // khớp chính xác ngày, hai bên ra hai khối lượng khác nhau.
    const earlier = new Date(Date.UTC(2026, 6, 15));
    const prisma = fakePrisma([
      { symbolId: "s1", sessionDate: earlier, close: 20, volMa20: 1_000_000 },
    ]);
    return safeLoadPositionSizingDefaults(prisma, "user-1", TARGETS).then((r) => {
      expect(r.error).toBeNull();
      expect(r.advBySymbolId.get("s1")).toBe(20 * 1000 * 1_000_000);
    });
  });
});
describe("safeLoadPositionSizingDefaults — ADV lookup failure", () => {
  it("flags the ADV as unavailable when the lookup fails, and only then", async () => {
    const failing = {
      symbolMarketContextDaily: { findMany: async () => Promise.reject(new Error("ADV timeout")) },
    } as unknown as PrismaClient;
    const failed = await safeLoadPositionSizingDefaults(failing, "user-1", TARGETS);
    expect(failed.advUnavailable).toBe(true);
    expect(failed.equityVnd).toBe(500_000_000);

    // A symbol with no row is not a failure: screen and server agree on "no ADV".
    const missing = await safeLoadPositionSizingDefaults(fakePrisma([]), "user-1", TARGETS);
    expect(missing.advUnavailable).toBe(false);
  });
});

describe("suggestionSizingInput", () => {
  const defaults = {
    equityVnd: 500_000_000,
    positionSizingConfig: { riskPerTradePct: null, maxPositionPct: null, liquidityCapPct: null },
    advUnavailable: false,
  };
  const trades = [
    { entryKvnd: 25.5, stopKvnd: 24, quantity: 1000, exchange: "HOSE" },
    { entryKvnd: 12, stopKvnd: null, quantity: 500, exchange: null },
  ];

  it("resolves the settings with the server's defaults and sums exposure", () => {
    // 25.5 × 1000 × 1,000 + 12 × 1000 × 500 = 31,500,000 đ
    expect(suggestionSizingInput(defaults, trades, "PROBE")).toEqual({
      unavailable: null,
      input: {
        equityVnd: 500_000_000,
        riskPerTradePct: 0.01,
        maxPerTradeExposurePct: 0.2,
        maxPortfolioExposurePct: 0.7,
        liquidityCapPct: 0.1,
        currentExposureVnd: 31_500_000,
        openTrades: trades,
        verdictLevel: "PROBE",
      },
    });
  });

  it("an ADV lookup failure means no size, as the server fails closed there", () => {
    expect(suggestionSizingInput({ ...defaults, advUnavailable: true }, trades, null)).toEqual({
      input: null,
      unavailable: "LIQUIDITY_UNREADABLE",
    });
  });

  it("no equity, or unreadable open trades, means no size", () => {
    expect(suggestionSizingInput({ ...defaults, equityVnd: null }, trades, null).unavailable).toBe("NO_EQUITY");
    expect(suggestionSizingInput(defaults, null, null).unavailable).toBe("OPEN_TRADES_UNREADABLE");
  });
});
