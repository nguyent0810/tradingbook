import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { classifyRegimeForSession } from "./classify-regime";

const SESSION_DATE = new Date(Date.UTC(2026, 0, 1));

type FakeBarRow = { date: Date; open: number; high: number; low: number; close: number; volume: number };

function buildFakePrisma(indexBarsDesc: FakeBarRow[]): PrismaClient {
  return {
    indexDailyBar: {
      findMany: async (args: { orderBy: { date: "asc" | "desc" }; take: number }) => {
        const sorted = [...indexBarsDesc].sort((a, b) =>
          args.orderBy.date === "desc"
            ? b.date.getTime() - a.date.getTime()
            : a.date.getTime() - b.date.getTime()
        );
        return sorted.slice(0, args.take);
      },
    },
    marketContextDaily: {
      findUnique: async () => null,
    },
    dailyScanRun: {
      findFirst: async () => null,
    },
  } as unknown as PrismaClient;
}

/** Bar rows for `daysBeforeSession` days back from SESSION_DATE, oldest first, at a given close. */
function flatBars(count: number, startDaysBeforeSession: number, close: number): FakeBarRow[] {
  return Array.from({ length: count }, (_, i) => {
    const daysBefore = startDaysBeforeSession - i;
    const date = new Date(SESSION_DATE.getTime() - daysBefore * 86_400_000);
    return { date, open: close, high: close, low: close, close, volume: 1_000_000 };
  });
}

function rampBars(count: number, startDaysBeforeSession: number, fromClose: number, toClose: number): FakeBarRow[] {
  return Array.from({ length: count }, (_, i) => {
    const daysBefore = startDaysBeforeSession - i;
    const date = new Date(SESSION_DATE.getTime() - daysBefore * 86_400_000);
    const close = fromClose + ((toClose - fromClose) * i) / Math.max(1, count - 1);
    return { date, open: close, high: close, low: close, close, volume: 1_000_000 };
  });
}

describe("classifyRegimeForSession", () => {
  it("flags insufficient data (< 50 bars) instead of fabricating a regime", async () => {
    const prisma = buildFakePrisma(flatBars(10, 10, 100));
    const snapshot = await classifyRegimeForSession(prisma, SESSION_DATE);

    expect(snapshot.hasSufficientData).toBe(false);
    expect(snapshot.confidence).toBe(0);
    expect(snapshot.gate1Level).toBeNull();
  });

  it("uses the 260 bars nearest sessionDate, not the oldest 260 (pagination regression)", async () => {
    // 260 flat days, then a strong 140-day uptrend ending at sessionDate.
    // Total > 260 bars: with the old asc+take(260) bug this would return the
    // flat leading window; the fix must return the trailing uptrend window.
    const bars = [
      ...flatBars(260, 400, 100),
      ...rampBars(140, 140, 100, 200),
    ];
    const prisma = buildFakePrisma(bars);
    const snapshot = await classifyRegimeForSession(prisma, SESSION_DATE);

    expect(snapshot.dimensions.trendRegime).toBe("StrongBull");
  });

  it("classifies a flat market as Sideways instead of leaving it unreachable", async () => {
    const prisma = buildFakePrisma(flatBars(120, 120, 100));
    const snapshot = await classifyRegimeForSession(prisma, SESSION_DATE);

    expect(snapshot.dimensions.trendRegime).toBe("Sideways");
  });
});
