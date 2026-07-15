import { describe, expect, it, vi } from "vitest";
import { fetchVnindexHistory } from "./fetch-vnindex-history";
import type { PrismaClient } from "@/generated/prisma/client";

function mockPrisma(bars: Array<{ date: Date; close: number }>): PrismaClient {
  return {
    indexDailyBar: {
      findMany: vi.fn(async () => bars),
    },
  } as unknown as PrismaClient;
}

describe("fetchVnindexHistory", () => {
  it("returns points ascending by date, even though the query fetches newest-first", () => {
    const bars = [
      { date: new Date("2026-07-14T00:00:00.000Z"), close: 1300 },
      { date: new Date("2026-07-13T00:00:00.000Z"), close: 1290 },
      { date: new Date("2026-07-10T00:00:00.000Z"), close: 1280 },
    ];
    return fetchVnindexHistory(mockPrisma(bars), 30).then((result) => {
      expect(result).toEqual([
        { date: "2026-07-10", close: 1280 },
        { date: "2026-07-13", close: 1290 },
        { date: "2026-07-14", close: 1300 },
      ]);
    });
  });

  it("returns an empty array on query failure (fail-soft, chart-only data)", () => {
    const prisma = {
      indexDailyBar: {
        findMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as PrismaClient;
    return fetchVnindexHistory(prisma).then((result) => {
      expect(result).toEqual([]);
    });
  });

  it("passes the requested session count through to the query", () => {
    const prisma = mockPrisma([]);
    return fetchVnindexHistory(prisma, 7).then(() => {
      expect(prisma.indexDailyBar.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 7 })
      );
    });
  });
});
