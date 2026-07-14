import { describe, expect, it, vi } from "vitest";
import { fetchMarketContextUi } from "@/lib/market/fetch-market-context-ui";
import { parseSessionDateUtc } from "@/lib/market/session-date";
import type { PrismaClient } from "@/generated/prisma/client";

function mockPrisma(overrides: {
  marketRow?: Record<string, unknown> | null;
  symbolRows?: Array<Record<string, unknown>>;
  throwOnMarket?: boolean;
  priorRows?: Array<Record<string, unknown>>;
}): PrismaClient {
  return {
    marketContextDaily: {
      findUnique: vi.fn(async () => {
        if (overrides.throwOnMarket) throw new Error("db down");
        return overrides.marketRow ?? null;
      }),
      findMany: vi.fn(async () => overrides.priorRows ?? []),
    },
    symbolMarketContextDaily: {
      findMany: vi.fn(async () => overrides.symbolRows ?? []),
    },
  } as unknown as PrismaClient;
}

describe("fetchMarketContextUi", () => {
  const session = parseSessionDateUtc("2026-06-03");

  it("returns available:false when no market row", async () => {
    const dto = await fetchMarketContextUi(mockPrisma({ marketRow: null }), "2026-06-03");
    expect(dto.available).toBe(false);
    expect(dto.sessionDate).toBe("2026-06-03");
    expect(dto.market).toBeNull();
    expect(dto.bySymbol).toEqual({});
  });

  it("maps market row and symbol contexts", async () => {
    const dto = await fetchMarketContextUi(
      mockPrisma({
        marketRow: {
          sessionDate: session,
          foreignNetValue1d: -458_371_893_440,
          foreignNetValue5d: null,
          foreignNetValue10d: null,
          foreignSymbolsOk: 159,
          foreignSymbolsTotal: 206,
          foreignCoveragePct: 77.18,
          gate1Level: "PASS",
          vnindexVolRatioMa20: 1.1,
        },
        symbolRows: [
          {
            foreignNetValue1d: -12_400_000_000,
            foreignNetValue5d: null,
            foreignNetValue10d: null,
            foreignDataQuality: "OK",
            volRatioMa20: 1.3,
            symbol: { symbol: "VIC" },
          },
        ],
      }),
      session,
      { symbols: ["VIC"] }
    );

    expect(dto.available).toBe(true);
    expect(dto.market?.foreignNetValue1d).toBe(-458_371_893_440);
    expect(dto.bySymbol.VIC?.foreignNetValue1d).toBe(-12_400_000_000);
  });

  it("fail-soft on query error", async () => {
    const dto = await fetchMarketContextUi(
      mockPrisma({ throwOnMarket: true }),
      "2026-06-03"
    );
    expect(dto.available).toBe(false);
    expect(dto.bySymbol).toEqual({});
  });

  it("returns empty context for missing session date", async () => {
    const dto = await fetchMarketContextUi(mockPrisma({}), null);
    expect(dto.available).toBe(false);
    expect(dto.sessionDate).toBe("");
  });

  it("rolling danger threshold is null with insufficient prior history", async () => {
    const dto = await fetchMarketContextUi(
      mockPrisma({
        marketRow: {
          sessionDate: session,
          foreignNetValue1d: -1_000_000,
          foreignNetValue5d: null,
          foreignNetValue10d: null,
          foreignSymbolsOk: 1,
          foreignSymbolsTotal: 1,
          foreignCoveragePct: 1,
          gate1Level: "PASS",
          vnindexVolRatioMa20: 1,
        },
        priorRows: [{ foreignNetValue1d: -1, foreignNetValue5d: null, foreignNetValue10d: null }],
      }),
      session
    );
    expect(dto.market?.foreignFlowRollingDangerVnd).toBeNull();
  });

  it("computes rolling danger threshold from prior session history", async () => {
    const priorRows = Array.from({ length: 30 }, (_, i) => ({
      foreignNetValue1d: -(i + 1) * 1_000_000_000,
      foreignNetValue5d: null,
      foreignNetValue10d: null,
    }));
    const dto = await fetchMarketContextUi(
      mockPrisma({
        marketRow: {
          sessionDate: session,
          foreignNetValue1d: -1_000_000,
          foreignNetValue5d: null,
          foreignNetValue10d: null,
          foreignSymbolsOk: 1,
          foreignSymbolsTotal: 1,
          foreignCoveragePct: 1,
          gate1Level: "PASS",
          vnindexVolRatioMa20: 1,
        },
        priorRows,
      }),
      session
    );
    expect(dto.market?.foreignFlowRollingDangerVnd).not.toBeNull();
    expect(dto.market?.foreignFlowRollingDangerVnd).toBeLessThan(0);
  });
});
